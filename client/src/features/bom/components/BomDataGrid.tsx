import { memo } from 'react';
import { Loader2, AlertCircle, Cpu, Plus } from 'lucide-react';
import type { BomRecord } from '../types';
import { BomTableRow, BomMobileCard } from './BomTableRow';

interface BomDataGridProps {
  data: BomRecord[];
  isLoading: boolean;
  isError: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onManageAlternates: (row: BomRecord) => void;
  onDelete: (id: string) => void;
}

export const BomDataGrid = memo(({ 
  data, isLoading, isError, selectedIds, onToggleSelect, onSelectAll, onManageAlternates, onDelete 
}: BomDataGridProps) => {
  const allSelected = data.length > 0 && selectedIds.size === data.length;

  return (
    <div className="flex-1 overflow-auto custom-scrollbar relative bg-white">
      {/* =====================================================================
          DESKTOP DATA GRID
          ===================================================================== */}
      <table className="w-full text-left text-sm whitespace-nowrap hidden md:table border-separate border-spacing-0">
        <thead className="bg-white/90 backdrop-blur-md text-gray-500 sticky top-0 z-20 shadow-sm">
          <tr>
            <th className="px-6 py-4 pl-8 w-12 border-b border-gray-100" scope="col">
              <input 
                type="checkbox" 
                onChange={onSelectAll} 
                checked={allSelected} 
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer transition-all shadow-sm" 
              />
            </th>
            <th className="px-6 py-4 border-b border-gray-100 text-[11px] font-bold uppercase tracking-widest text-gray-400" scope="col">Part Number</th>
            <th className="px-6 py-4 border-b border-gray-100 text-[11px] font-bold uppercase tracking-widest text-gray-400" scope="col">Manufacturer</th>
            <th className="px-6 py-4 border-b border-gray-100 text-[11px] font-bold uppercase tracking-widest text-gray-400" scope="col">Quantity</th>
            <th className="px-6 py-4 border-b border-gray-100 text-[11px] font-bold uppercase tracking-widest text-gray-400" scope="col">Status</th>
            <th className="px-6 py-4 border-b border-gray-100 text-[11px] font-bold uppercase tracking-widest text-gray-400 text-right" scope="col">Unit Price</th>
            <th className="px-6 py-4 border-b border-gray-100 text-[11px] font-bold uppercase tracking-widest text-gray-400 text-right" scope="col">Line Total</th>
            <th className="px-6 py-4 border-b border-gray-100 text-[11px] font-bold uppercase tracking-widest text-gray-400 text-right" scope="col">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white">
          {isLoading ? (
            <tr>
              <td colSpan={8} className="px-6 py-32 text-center text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-500" />
                <span className="text-xs font-bold tracking-widest uppercase">Syncing Components...</span>
              </td>
            </tr>
          ) : isError ? (
            <tr>
              <td colSpan={8} className="px-6 py-32 text-center text-red-500 animate-in fade-in zoom-in-95">
                <AlertCircle className="w-8 h-8 mx-auto mb-3" />
                <span className="text-sm font-bold">Failed to load Bill of Materials.</span>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-6 py-32">
                <div className="flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-500">
                  <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6 shadow-inner ring-1 ring-gray-900/5">
                    <Cpu className="w-8 h-8 text-gray-300" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">No Components Found</h3>
                  <p className="text-gray-500 text-sm font-medium mb-6">Add parts manually or upload a CSV to populate this project.</p>
                </div>
              </td>
            </tr>
          ) : (
            data.map((row, index) => (
              <BomTableRow 
                key={row.id} 
                row={row} 
                index={index} 
                isSelected={selectedIds.has(row.id)} 
                onToggleSelect={onToggleSelect} 
                onManageAlternates={onManageAlternates} 
                onDelete={onDelete}                       
              />
            ))
          )}
        </tbody>
      </table>

      {/* =====================================================================
          MOBILE / COMPACT VIEW
          ===================================================================== */}
      <div className="md:hidden space-y-3 p-4 bg-gray-50/50 min-h-full">
        {isLoading ? (
          <div className="p-20 text-center text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-500" />
            <span className="text-xs font-bold tracking-widest uppercase">Syncing...</span>
          </div>
        ) : isError ? (
           <div className="p-12 text-center text-red-500">
             <AlertCircle className="w-6 h-6 mx-auto mb-2" /> Failed to load items.
           </div>
        ) : data.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm font-medium">No items found.</div>
        ) : (
          data.map((row, index) => (
            <BomMobileCard 
              key={row.id} 
              row={row} 
              index={index}
              isSelected={selectedIds.has(row.id)} 
              onToggleSelect={onToggleSelect} 
              onManageAlternates={onManageAlternates} 
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </div>
  );
});
BomDataGrid.displayName = 'BomDataGrid';