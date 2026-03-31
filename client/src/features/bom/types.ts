import { z } from 'zod';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type CartRiskLevel = 'low' | 'high' | 'critical';
export type LifecycleStatus = 'Active' | 'Obsolete' | 'NRND' | 'EOL';

export type Workspace = {
  id: string;
  tenant_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  total_items?: number; 
};

export type BomRecord = {
  id: string;
  tenant_id: string;
  workspace_id: string;
  mpn: string;
  manufacturer: string;
  quantity: number;
  // STRICT FIX: Removed "| string" to force explicit literal types
  lifecycle_status: LifecycleStatus; 
  target_price: number | null;
  global_stock: number;
  lead_time_weeks: number | null;
  // STRICT FIX: Removed "| string" to force explicit literal types
  risk_level: RiskLevel; 
  alternates: string[];
  created_at: string;
  updated_at: string;
};

export type OrderHistory = {
  updated_at: string | number | Date;
  id: string;
  workspace_id: string;
  tenant_id: string;
  total_value: number;
  previous_value: number | null;
  item_count: number;
  ordered_at: string;
  status: QuoteStatus; // <-- Added this so we can track validity
};

export type ConfirmModalConfig = {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  onConfirm: () => void;
  variant: 'danger' | 'primary';
};

export const mpnSanitizer = z.string()
  .trim()
  .toUpperCase()
  .min(2, 'MPN too short')
  .regex(/^[A-Z0-9\-_]+$/, 'Only alphanumeric, dashes, and underscores allowed');

export const quickAddSchema = z.object({
  mpn: mpnSanitizer,
  manufacturer: z.string().trim().min(1, 'Required'),
  quantity: z.number().int().min(1, 'Min qty 1'),
  target_price: z.number().min(0.01).optional().nullable()
});

export type QuickAddForm = z.infer<typeof quickAddSchema>;

// ============================================================================
// STRICT QUOTATION TYPES
// ============================================================================

export type QuoteStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'FINALIZED' | 'REJECTED';
export type MatchStatus = 'MATCHED' | 'SHORTAGE' | 'UNSOURCED';

export type AlternativePart = {
  inventory_id: string;
  mpn: string;
  manufacturer: string;
  unit_cost: number;
  available_qty: number;
};

export type QuoteLineItem = {
  risk_level: "low" | "high" | "critical";
  manufacturer: string;
  id: string;
  requested_mpn: string;
  requested_qty: number;
  status: MatchStatus;
  matched_inventory_id: string | null;
  fulfilled_qty: number;
  unit_cost: number | null;
  alternatives: AlternativePart[];
  user_decision: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'AUTO_MATCHED';
};

export type QuoteDetails = {
  id: string;
  status: QuoteStatus;
  total_value: number;
  ordered_at: string; // STRICT FIX: Matches DB schema fix
  line_items: QuoteLineItem[];
};


export interface ActiveQuote {
  id: string;
  workspace_name: string;
  supplier_name: string;
  total_value: number;
  received_at: string;
  expires_at: string;
  status: 'PENDING_REVIEW' | 'ACCEPTED' | 'EXPIRED';
  line_items: QuoteLineItem[];
}
