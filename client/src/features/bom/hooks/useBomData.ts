import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import type { Workspace, BomRecord, OrderHistory } from '../types'; // Adjust imports as needed
import { 
  fetchWorkspaces, 
  fetchBomRecords, 
  fetchOrderHistory, 
  createWorkspace, 
  deleteBomRow, 
  addBomRows, 
  updateBomRow, 
  requestWorkspaceQuotation 
} from '../api';

export function useBomData(userId: string | undefined) {
  const queryClient = useQueryClient();
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);

  // --- Queries ---
  const { 
    data: workspaces = [], 
    isError: isWorkspaceError 
  } = useQuery<Workspace[], Error>({ 
    queryKey: ['workspaces', userId], 
    queryFn: () => fetchWorkspaces(userId),
    enabled: !!userId
  });

  const { 
    data: bomRecords = [], 
    isLoading: isLoadingBoms, 
    isError: isBomError 
  } = useQuery<BomRecord[], Error>({ 
    queryKey: ['bom_records', activeWorkspaceId], 
    queryFn: () => fetchBomRecords(activeWorkspaceId),
    enabled: !!activeWorkspaceId
  });

  const { 
    data: rawOrderHistory = [], 
    isLoading: isLoadingHistory, 
    isError: isHistoryError 
  } = useQuery<OrderHistory[], Error>({
    queryKey: ['order_history', activeWorkspaceId],
    queryFn: () => fetchOrderHistory(activeWorkspaceId),
    enabled: !!activeWorkspaceId
  });

  // Filter out empty premature history records safely
  const orderHistory = useMemo(() => {
    return rawOrderHistory.filter(order => order.item_count > 0);
  }, [rawOrderHistory]);

  // Auto-select the first workspace if none is active
  useEffect(() => {
    if (activeWorkspaceId === null && workspaces.length > 0) {
      setActiveWorkspaceId(workspaces[0].id);
    }
  }, [activeWorkspaceId, workspaces]);

  // --- Mutations ---
  const createNewWorkspace = useMutation({
    mutationFn: (name: string) => createWorkspace(userId!, name),
    onSuccess: (newWs) => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      setActiveWorkspaceId(newWs.id); 
    }
  });

  const deleteRow = useMutation({ 
    mutationFn: deleteBomRow, 
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom_records'] });
    }
  });
  
  const addRows = useMutation({ 
    mutationFn: addBomRows, 
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['bom_records'] }); 
      queryClient.invalidateQueries({ queryKey: ['workspaces'] }); 
    }
  });

  const updateRow = useMutation({ 
    mutationFn: updateBomRow, 
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom_records'] });
    }
  });

  const requestQuote = useMutation({
    mutationFn: ({ wsId, partIds }: { wsId: string; partIds: string[] }) => 
      requestWorkspaceQuotation(wsId, partIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom_records'] });
      queryClient.invalidateQueries({ queryKey: ['order_history'] });
    }
  });

  return {
    // State
    activeWorkspaceId,
    setActiveWorkspaceId,
    
    // Data
    workspaces,
    isWorkspaceError,
    bomRecords,
    isLoadingBoms,
    isBomError,
    orderHistory,
    isLoadingHistory,
    isHistoryError,
    
    // Actions
    createNewWorkspace,
    deleteRow,
    addRows,
    updateRow,
    requestQuote
  };
}