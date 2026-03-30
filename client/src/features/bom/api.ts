import { supabase } from '@/lib/supabase';
import type { Workspace, BomRecord, OrderHistory, QuoteDetails } from './types';

// ============================================================================
// WORKSPACE MANAGEMENT
// ============================================================================

export const fetchWorkspaces = async (userId?: string): Promise<Workspace[]> => {
  if (!userId) return [];
  
  const { data, error } = await supabase
    .from('workspaces')
    .select('*, bom_records(count)')
    .eq('tenant_id', userId)
    .order('created_at', { ascending: false });
    
  if (error) throw new Error(`Workspace fetch failed: ${error.message}`);
  
  return (data || []).map((ws: Record<string, unknown>) => ({
    ...(ws as Workspace),
    total_items: Array.isArray(ws.bom_records) ? Number(ws.bom_records[0]?.count) || 0 : 0,
  }));
};

export const createWorkspace = async (tenant_id: string, name: string): Promise<Workspace> => {
  const { data, error } = await supabase
    .from('workspaces')
    .insert([{ tenant_id, name }])
    .select()
    .single();
    
  if (error) throw new Error(`Workspace creation failed: ${error.message}`);
  return { ...data, total_items: 0 } as Workspace;
};

export const updateWorkspace = async ({ id, updates }: { id: string; updates: Partial<Workspace> }): Promise<void> => {
  const { error } = await supabase.from('workspaces').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(`Workspace update failed: ${error.message}`);
};

export const deleteWorkspace = async (id: string): Promise<void> => {
  const { error } = await supabase.from('workspaces').delete().eq('id', id);
  if (error) throw new Error(`Workspace deletion failed: ${error.message}`);
};

// ============================================================================
// BOM (BILL OF MATERIALS) MANAGEMENT
// ============================================================================

export const fetchBomRecords = async (workspaceId: string | null): Promise<BomRecord[]> => {
  let query = supabase.from('bom_records').select('*').order('created_at', { ascending: false });
  
  if (workspaceId) {
    query = query.eq('workspace_id', workspaceId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`BOM fetch failed: ${error.message}`);
  return data as BomRecord[];
};

export const addBomRows = async (payload: Omit<BomRecord, 'id' | 'created_at' | 'updated_at'>[]): Promise<void> => {
  const CHUNK_SIZE = 500;
  for (let i = 0; i < payload.length; i += CHUNK_SIZE) {
    const chunk = payload.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase.from('bom_records').insert(chunk);
    if (error) throw new Error(`Bulk insertion failed: ${error.message}`);
  }
};

export const updateBomRow = async ({ id, updates }: { id: string; updates: Partial<BomRecord> }): Promise<void> => {
  const { error } = await supabase.from('bom_records').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(`BOM update failed: ${error.message}`);
};

export const deleteBomRow = async (id: string): Promise<void> => {
  const { error } = await supabase.from('bom_records').delete().eq('id', id);
  if (error) throw new Error(`BOM deletion failed: ${error.message}`);
};

// ============================================================================
// PROCUREMENT & QUOTATIONS
// ============================================================================

export const requestWorkspaceQuotation = async (workspaceId: string, partIds: string[]): Promise<string> => {
  if (!workspaceId) throw new Error("A valid Workspace ID is required to generate a quote.");
  if (!partIds || partIds.length === 0) throw new Error("No parts selected. Please select at least one component to quote.");

  try {
    const { data, error } = await supabase.rpc('generate_automated_quotation', { 
      p_workspace_id: workspaceId,
      p_part_ids: partIds 
    });
    
    if (error) throw new Error(error.message || "Failed to generate quotation from the server.");
    if (!data) throw new Error("The server did not return a valid quotation response.");

    return typeof data === 'object' && 'order_id' in data ? String(data.order_id) : String(data); 
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
    throw new Error(`Quotation request failed: ${errorMessage}`);
  }
};

export const fetchOrderHistory = async (workspaceId: string | null): Promise<OrderHistory[]> => {
  if (!workspaceId) return [];
  const { data, error } = await supabase
    .from('procurement_orders')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('ordered_at', { ascending: false });
    
  if (error) throw new Error(`History fetch failed: ${error.message}`);
  return data as OrderHistory[];
};

export const fetchAllTenantOrders = async (tenantId: string | undefined): Promise<OrderHistory[]> => {
  if (!tenantId) return [];
  const { data, error } = await supabase
    .from('procurement_orders')
    .select('*')
    .eq('tenant_id', tenantId)
    .in('status', ['FINALIZED', 'PAID', 'ORDERED']) 
    .order('ordered_at', { ascending: false });
    
  if (error) throw new Error(`Failed to fetch global orders: ${error.message}`);
  return data as OrderHistory[];
};

export const fetchActiveQuotes = async (tenantId: string | undefined) => {
  if (!tenantId) return [];
  const { data, error } = await supabase
    .from('procurement_orders')
    .select(`
      id, status, total_value, ordered_at,
      workspace:workspaces(name),
      line_items:quote_line_items (
        id, requested_mpn, requested_qty, status, matched_inventory_id,
        fulfilled_qty, unit_cost, user_decision,
        alternatives:quote_alternatives (
          inventory_id, mpn, manufacturer, unit_cost, available_qty
        )
      )
    `)
    .eq('tenant_id', tenantId)
    .in('status', ['DRAFT', 'PENDING_APPROVAL']) 
    .order('ordered_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch quotes: ${error.message}`);
  return data;
};

export const fetchQuoteDetails = async (quoteIdOrWorkspaceId: string): Promise<QuoteDetails> => {
  let { data, error } = await supabase
    .from('procurement_orders')
    .select(`
      id, status, total_value, ordered_at,
      line_items:quote_line_items (
        id, requested_mpn, requested_qty, status, matched_inventory_id,
        fulfilled_qty, unit_cost, user_decision,
        alternatives:quote_alternatives (
          inventory_id, mpn, manufacturer, unit_cost, available_qty
        )
      )
    `)
    .eq('id', quoteIdOrWorkspaceId)
    .maybeSingle();

  if (!data) {
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('procurement_orders')
      .select(`
        id, status, total_value, ordered_at,
        line_items:quote_line_items (
          id, requested_mpn, requested_qty, status, matched_inventory_id,
          fulfilled_qty, unit_cost, user_decision,
          alternatives:quote_alternatives (
            inventory_id, mpn, manufacturer, unit_cost, available_qty
          )
        )
      `)
      .eq('workspace_id', quoteIdOrWorkspaceId)
      .order('ordered_at', { ascending: false })
      .limit(1)
      .maybeSingle();
      
      data = fallbackData;
      if (fallbackError) error = fallbackError;
  }

  if (error) throw new Error(`Failed to load quotation details: ${error.message}`);
  if (!data) throw new Error("Quotation not found. The project may not have been quoted yet.");

  return data as unknown as QuoteDetails;
};

// ⚡ ENTERPRISE FIX: Synchronize Live Stock Data into Database
export const resolveAlternative = async (
  quoteId: string, 
  lineId: string, 
  altId: string | undefined, 
  decision: 'ACCEPTED' | 'REJECTED',
  altData?: any
): Promise<void> => {
  // 1. Fetch the current line item so we know exactly WHICH old MPN we are replacing
  const { data: currentLine, error: lineErr } = await supabase
    .from('quote_line_items')
    .select('requested_mpn, quote_id')
    .eq('id', lineId)
    .single();
    
  if (lineErr || !currentLine) throw new Error("Could not find original line item.");

  const oldMpn = currentLine.requested_mpn;
  const updates: Record<string, any> = { user_decision: decision };
  
  if (decision === 'ACCEPTED') {
    updates.status = 'MATCHED';
    let safeInventoryId = null;
    
    if (altData && (altData.mpn || altData.part_number)) {
      const newMpn = altData.mpn || altData.part_number;
      const newManufacturer = altData.manufacturer || 'Unknown';
      const availableStock = altData.available_qty || 0; // ⚡ Capture exact stock
      
      // 2. Auto-Upsert to Internal Inventory (Fixes 409 errors)
      const { data: invData, error: invError } = await supabase
        .from('internal_inventory')
        .upsert({
          part_number: newMpn,
          manufacturer: newManufacturer,
          unit_cost: altData.unit_cost || 0,
          available_qty: availableStock
        }, { onConflict: 'part_number' })
        .select('id')
        .single();

      if (!invError && invData) {
        safeInventoryId = invData.id;
      }

      // Step A: Find out which workspace this quote belongs to
      const { data: orderData } = await supabase
        .from('procurement_orders')
        .select('workspace_id')
        .eq('id', currentLine.quote_id)
        .single();
        
      // Step B: Update the BOM Record to permanently swap the part and set Global Stock
      if (orderData?.workspace_id) {
         await supabase
           .from('bom_records')
           .update({
             mpn: newMpn,
             manufacturer: newManufacturer,
             global_stock: availableStock // ⚡ Sync exact stock to the Master BOM
           })
           .eq('workspace_id', orderData.workspace_id)
           .eq('mpn', oldMpn); 
      }

      // 3. Update the Quote Line Item payload
      updates.requested_mpn = newMpn;
      updates.fulfilled_qty = availableStock; // ⚡ Sync exact stock to the Quotation Row
      if (altData.unit_cost !== undefined) updates.unit_cost = altData.unit_cost;
      
    } else {
      // Fallback for older legacy UI flows without altData
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(altId || '');
      safeInventoryId = isUUID ? altId : null;
    }

    updates.matched_inventory_id = safeInventoryId;
  }

  // 4. Finally, save the decision to the quote line item
  const { data, error } = await supabase
    .from('quote_line_items')
    .update(updates)
    .eq('id', lineId)
    .select(); 

  if (error) {
    console.error("[Supabase Update Error]", error);
    throw new Error(`Failed to record decision: ${error.message}`);
  }
  
  if (!data || data.length === 0) {
    throw new Error("Update failed: Line item not found in the database.");
  }
};

export const finalizeQuote = async (quoteId: string): Promise<void> => {
  const { error } = await supabase.from('procurement_orders').update({ status: 'FINALIZED' }).eq('id', quoteId);
  if (error) throw new Error(`Failed to finalize quotation: ${error.message}`);
};

export const rejectQuote = async (quoteId: string): Promise<void> => {
  const { error } = await supabase.from('procurement_orders').update({ status: 'REJECTED' }).eq('id', quoteId);
  if (error) throw new Error(`Failed to reject quotation: ${error.message}`);
};

// ============================================================================
// NEXAR SUPPLY CHAIN INTELLIGENCE
// ============================================================================

export const fetchLifecycleIntelligence = async (tenantId: string | undefined) => {
  if (!tenantId) return [];
  
  const { data, error } = await supabase.functions.invoke('nexar-proxy', {
    body: { action: 'scan_lifecycle', tenant_id: tenantId }
  });

  if (error) {
    console.error("[Nexar Proxy Error] fetchLifecycleIntelligence:", error);
    throw new Error(`Failed to reach supply chain intelligence: ${error.message}`);
  }
  
  return data;
};

export const fetchCrossReferences = async (mpn: string) => {
  if (!mpn) throw new Error("MPN is required to find alternatives.");

  const { data, error } = await supabase.functions.invoke('nexar-proxy', {
    body: { action: 'get_alternatives', mpn }
  });

  if (error) throw new Error(`Failed to fetch alternatives from Nexar: ${error.message}`);
  return data;
};

export const fetchBatchedAlternatives = async (mpns: string[], forceRefresh: boolean = false) => {
  if (!mpns || mpns.length === 0) return {};

  const { data, error } = await supabase.functions.invoke('nexar-proxy', {
    body: { 
      action: 'get_batched_alternatives', 
      mpns,
      forceRefresh 
    }
  });

  if (error) {
    console.error("[Nexar Proxy Error] fetchBatchedAlternatives:", error);
    throw new Error(`Failed to batch fetch alternatives: ${error.message}`);
  }

  return data; 
};

// ⚡ ENTERPRISE FIX: Accept availableQty parameter to lock in stock levels during Cost Analysis swaps
export const globalSwapComponent = async (
  tenantId: string, 
  oldMpn: string, 
  newMpn: string, 
  newManufacturer: string,
  availableQty: number = 0 // Default to 0 if not provided
) => {
  const { data, error } = await supabase
    .from('bom_records')
    .update({ 
      mpn: newMpn, 
      manufacturer: newManufacturer,
      global_stock: availableQty, // ⚡ Capture stock instantly
      lifecycle_status: 'Active', 
      risk_level: 'low'
    })
    .eq('tenant_id', tenantId)
    .eq('mpn', oldMpn);

  if (error) {
    console.error("[DB Error] globalSwapComponent:", error);
    throw new Error(`Global swap failed: ${error.message}`);
  }
  return data;
};