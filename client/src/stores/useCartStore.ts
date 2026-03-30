import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 1. Define the type directly here so the compiler stops complaining.
// You can export it so other files can import it from this store if needed.
export type BomRecord = {
  id: string;
  tenant_id: string;
  project_name: string;
  mpn: string;
  manufacturer: string;
  quantity: number;
  lifecycle_status: string;
  target_price: number | null;
  global_stock: number;
  risk_level: 'low' | 'high' | 'critical';
  created_at: string;
  alternates?: string[];
};

// 2. Strictly use 'type' instead of 'interface'
type CartStore = {
  items: any;
  selectedItems: BomRecord[];
  setItems: (items: BomRecord[]) => void;
  clearCart: () => void;
};

export const useCartStore = create<CartStore>()(
  persist(
    (set) => ({
      selectedItems: [],
      setItems: (items) => set({ selectedItems: items }),
      clearCart: () => set({ selectedItems: [] }),
    }),
    { name: 'scs-procurement-cart' }
  )
);