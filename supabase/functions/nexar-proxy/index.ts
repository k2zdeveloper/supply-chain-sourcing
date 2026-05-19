import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import * as Sentry from "https://deno.land/x/sentry/index.mjs";
import { getValidNexarToken } from "./auth.ts";

const SENTRY_DSN = Deno.env.get('SENTRY_DSN');
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: Deno.env.get('SENTRY_ENVIRONMENT') ?? 'production',
    tracesSampleRate: 0.1,
  });
}

// Format: starts with alphanumeric, then alphanumerics + - / . _, total length 2-50.
const MPN_REGEX = /^[A-Z0-9][A-Z0-9\-\/\._]{1,49}$/i;
const MAX_MPNS_PER_REQUEST = 100;
const MAX_LIFECYCLE_SCAN = 200;

function validateMpnList(input: unknown, max: number): string[] {
  if (!Array.isArray(input)) throw new Error("Payload 'mpns' must be an array.");
  if (input.length === 0) throw new Error("Payload 'mpns' cannot be empty.");
  if (input.length > max) {
    throw new Error(`Too many MPNs: ${input.length}. Max ${max} per request.`);
  }
  const cleaned: string[] = [];
  for (const raw of input) {
    if (typeof raw !== 'string') {
      throw new Error(`Invalid MPN type: expected string, got ${typeof raw}.`);
    }
    const trimmed = raw.trim();
    if (!MPN_REGEX.test(trimmed)) {
      throw new Error(`Invalid MPN format: "${raw}". Allowed: A-Z, 0-9, '-', '/', '.', '_', length 2-50.`);
    }
    cleaned.push(trimmed);
  }
  return cleaned;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. STRICT SECURITY PATCH: Explicitly extract and pass the JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header." }), { 
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const jwt = authHeader.replace('Bearer ', '');
    
    const supabaseUserClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    );

    // Pass the JWT directly into getUser() - This is the Deno bulletproof method
    const { data: { user }, error: authError } = await supabaseUserClient.auth.getUser(jwt);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: `Auth Error: ${authError?.message || 'Invalid Token'}` }), { 
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // 2. Parse Request
    const body = await req.json();
    const { action, mpn, mpns, tenant_id, forceRefresh } = body;
    const token = await getValidNexarToken();

    // ========================================================================
    // ACTION 1: BATCHED ALTERNATIVES
    // ========================================================================
    if (action === 'get_batched_alternatives') {
      const validMpns = validateMpnList(mpns, MAX_MPNS_PER_REQUEST);

      const { data: cachedRecords } = await supabaseAdmin
        .from('nexar_cache')
        .select('*')
        .in('mpn', validMpns);

      const now = Date.now();
      const validCache = new Map();
      const staleOrMissing: string[] = [];
      const cachedMap = new Map((cachedRecords || []).map(c => [c.mpn, c]));

      for (const currentMpn of validMpns) {
        const cachedItem = cachedMap.get(currentMpn);
        if (!forceRefresh && cachedItem && (now - new Date(cachedItem.last_scanned).getTime() < 7 * 24 * 60 * 60 * 1000)) {
          validCache.set(currentMpn, cachedItem.data);
        } else {
          staleOrMissing.push(currentMpn);
        }
      }

      const fetchPromises = staleOrMissing.slice(0, 10).map(async (searchMpn) => {
        const query = `
          query GetDropInReplacements($mpn: String!) {
            supSearch(q: $mpn, filters: { inStockOnly: true }, limit: 5) {
              results { part { mpn manufacturer { name } medianPrice1000 { price } totalAvail } }
            }
          }
        `;
        
        try {
          const res = await fetch("https://api.nexar.com/graphql", {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, variables: { mpn: searchMpn } })
          });
          
          const data = await res.json();
          if (data.errors) return { mpn: searchMpn, data: [] };

          const formatted = (data.data.supSearch?.results || []).map((r: any) => ({
            id: crypto.randomUUID(), 
            part_number: r.part.mpn, 
            manufacturer: r.part.manufacturer?.name || 'Unknown', 
            available_qty: r.part.totalAvail || 0, 
            unit_cost: r.part.medianPrice1000?.price || 0
          }));
          
          return { mpn: searchMpn, data: formatted };
        } catch (e) {
          return { mpn: searchMpn, data: [] }; 
        }
      });

      const newlyFetched = await Promise.all(fetchPromises);

      for (const item of newlyFetched) {
        validCache.set(item.mpn, item.data);
        await supabaseAdmin.from('nexar_cache').upsert({
          mpn: item.mpn, 
          data: item.data, 
          last_scanned: new Date().toISOString(), 
          checksum: btoa(item.mpn) 
        });
      }

      return new Response(JSON.stringify(Object.fromEntries(validCache)), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // ========================================================================
    // ACTION 2: SCAN LIFECYCLE 
    // ========================================================================
    if (action === 'scan_lifecycle') {
      if (!tenant_id || typeof tenant_id !== 'string') throw new Error("Tenant ID is required.");

      const { data: bomRecords, error: dbError } = await supabaseUserClient
        .from('bom_records')
        .select('*, workspace:workspaces(name)')
        .eq('tenant_id', tenant_id)
        .limit(MAX_LIFECYCLE_SCAN);

      if (dbError) throw dbError;
      if (!bomRecords || bomRecords.length === 0) {
         return new Response(JSON.stringify([]), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Filter out any historical garbage MPNs before hitting Nexar — protects quota.
      const sanitizedRecords = bomRecords.filter(
        (r: any) => typeof r.mpn === 'string' && MPN_REGEX.test(r.mpn.trim())
      );
      if (sanitizedRecords.length === 0) {
        return new Response(JSON.stringify([]), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const queries = sanitizedRecords.map((record: any) => ({ mpn: record.mpn.trim() }));

      const query = `
        query GetLifecycle($queries: [SupPartMatchQuery!]!) {
          supMultiMatch(queries: $queries) {
            parts { mpn lifecycleStatus }
          }
        }
      `;

      const nexarRes = await fetch("https://api.nexar.com/graphql", {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables: { queries } }),
      });

      const nexarData = await nexarRes.json();
      if (nexarData.errors) throw new Error(nexarData.errors[0].message);

      const nexarParts = nexarData.data.supMultiMatch?.parts || [];
      const riskMap = new Map(nexarParts.map((p: any) => [p.mpn, p.lifecycleStatus]));

      const evaluatedRecords = bomRecords.map((record: any) => {
        const nexarStatus = riskMap.get(record.mpn) || 'Production';
        let calculatedRisk = 'low';
        let formattedStatus = 'Active';

        if (['Obsolete', 'EOL'].includes(nexarStatus)) {
          calculatedRisk = 'critical';
          formattedStatus = 'Obsolete';
        } else if (nexarStatus === 'NRND') {
          calculatedRisk = 'high';
          formattedStatus = 'NRND';
        }

        return { ...record, lifecycle_status: formattedStatus, risk_level: calculatedRisk };
      });

      return new Response(JSON.stringify(evaluatedRecords), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Invalid action.' }), { status: 400, headers: corsHeaders });

  } catch (error: any) {
    console.error("Proxy Error:", error.message);
    Sentry.captureException(error, { tags: { function: 'nexar-proxy' } });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});