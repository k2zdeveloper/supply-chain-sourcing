import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// The Service Role key bypasses RLS, allowing the backend to read the hidden api_tokens table
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

export async function getValidNexarToken(): Promise<string> {
  // 1. Check our database cache first
  const { data: existingToken } = await supabaseAdmin
    .from('api_tokens')
    .select('token, expires_at')
    .eq('service', 'nexar')
    .single();

  // If we have a token and it's good for at least another 5 minutes, use it.
  if (existingToken && new Date(existingToken.expires_at).getTime() > Date.now() + 300000) {
    return existingToken.token;
  }

  // 2. If no valid token exists, use your secure Edge Function keys to hit Nexar
  const clientId = Deno.env.get('NEXAR_CLIENT_ID');
  const clientSecret = Deno.env.get('NEXAR_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error("Missing Nexar API credentials in Supabase Vault.");
  }

  const res = await fetch("https://identity.nexar.com/connect/token", {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  });

  if (!res.ok) throw new Error("Nexar Auth Failed");
  const data = await res.json();
  
  // Calculate exact expiration time
  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

  // 3. Save the fresh token to the database for the next request
  await supabaseAdmin
    .from('api_tokens')
    .upsert({ service: 'nexar', token: data.access_token, expires_at: expiresAt });

  return data.access_token;
}