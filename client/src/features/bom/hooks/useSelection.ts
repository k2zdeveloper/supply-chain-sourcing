import { useState, useCallback } from 'react';
import type { BomRecord } from '../types';

export function useSelection() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Toggles a single row's selection state
  const handleToggleSelect = useCallback((row: BomRecord | { id: string }) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(row.id)) {
        next.delete(row.id);
      } else {
        next.add(row.id);
      }
      return next;
    });
  }, []);

  // Selects or deselects all currently visible/filtered rows
  const selectAll = useCallback((currentViewIds: string[]) => {
    setSelectedIds(prev => {
      // If everything in the current view is already selected, deselect them
      const areAllSelected = currentViewIds.length > 0 && currentViewIds.every(id => prev.has(id));
      
      if (areAllSelected) {
        return new Set(); // Or you can selectively remove just the currentViewIds if doing pagination
      } 
      
      // Otherwise, select all in the current view
      return new Set(currentViewIds);
    });
  }, []);

  // Completely resets the selection (useful when switching workspaces or submitting a quote)
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  return {
    selectedIds,
    handleToggleSelect,
    selectAll,
    clearSelection,
    setSelectedIds // Exposed just in case you need direct manipulation
  };
}