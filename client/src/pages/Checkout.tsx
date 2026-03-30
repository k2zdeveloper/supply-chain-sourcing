import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/useAuthStore';

// Add this inside your Checkout component:
const queryClient = useQueryClient();
const { user } = useAuthStore();

const recordOrderMutation = useMutation({
  mutationFn: async ({ workspaceId, totalValue, itemCount }: { workspaceId: string, totalValue: number, itemCount: number }) => {
    if (!user) throw new Error("Unauthorized");

    // 1. (Optional but advanced) Find the last order's value to calculate the trend
    const { data: lastOrder } = await supabase
      .from('procurement_orders')
      .select('total_value')
      .eq('workspace_id', workspaceId)
      .order('ordered_at', { ascending: false })
      .limit(1)
      .single();

    // 2. Insert the new order record
    const { error } = await supabase
      .from('procurement_orders')
      .insert([{
        tenant_id: user.id,
        workspace_id: workspaceId,
        total_value: totalValue,
        previous_value: lastOrder ? lastOrder.total_value : null, // This powers the trend arrows!
        item_count: itemCount
      }]);

    if (error) throw new Error(error.message);
  },
  onSuccess: () => {
    // This tells the BOM Manager to immediately refresh the History tab!
    queryClient.invalidateQueries({ queryKey: ['bom_history'] }); 
  }
});

// Then, inside your 'handleConfirmOrder' function, you just call:
// recordOrderMutation.mutate({ workspaceId: currentWorkspaceId, totalValue: cartTotal, itemCount: cartItems.length });