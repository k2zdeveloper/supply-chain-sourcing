import { useState, useCallback, memo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Cpu, AlertCircle, CheckCircle2, Edit2, Save, X, Trash2, Clock, Zap } from 'lucide-react';
import { updateBomRow } from '../api';
import type { BomRecord } from '../types';

const PLATFORM_MARGIN = 1.15;
const formatCurrency = (val: number | null | undefined): string => 
  (val !== null && val !== undefined) ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(val) : '-';

type BomItemProps = {
  row: BomRecord;
  index: number;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onManageAlternates: (row: BomRecord) => void;
  onDelete: (id: string) => void;
};

// ============================================================================
// DESKTOP TABLE ROW (<tr>)
// ============================================================================
export const BomTableRow = memo(({ row, index, isSelected, onToggleSelect, onManageAlternates, onDelete }: BomItemProps) => {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editQty, setEditQty] = useState<number>(row.quantity);

  const { mutate: saveUpdate, isPending } = useMutation({
    mutationFn: updateBomRow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom_records'] });
      setIsEditing(false);
    }
  });

  const handleSave = useCallback(() => {
    if (editQty !== row.quantity && editQty > 0) saveUpdate({ id: row.id, updates: { quantity: editQty } });
    else setIsEditing(false);
  }, [editQty, row.id, row.quantity, saveUpdate]);

  const markedUpPrice = row.target_price ? row.target_price * PLATFORM_MARGIN : null;
  const lineTotal = markedUpPrice ? markedUpPrice * row.quantity : null;
  const altCount = Array.isArray(row.alternates) ? row.alternates.length : 0;
  const isCritical = row.risk_level === 'critical';

  return (
    <tr 
      className={`group transition-colors text-sm border-b border-gray-100 animate-in fade-in slide-in-from-bottom-2 
        ${isSelected ? 'bg-blue-50/50' : 'hover:bg-gray-50/80 bg-white'}
      `}
      style={{ animationDelay: `${Math.min(index * 30, 800)}ms` }} // Caps delay at 800ms for massive lists
    >
      <td className="px-6 py-4 w-12 pl-8 border-b border-gray-100/50">
        <input 
          type="checkbox" 
          checked={isSelected} 
          onChange={() => onToggleSelect(row.id)} 
          aria-label={`Select part ${row.mpn}`}
          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer transition-all shadow-sm" 
        />
      </td>
      <td className="px-6 py-4 border-b border-gray-100/50">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 font-mono font-bold text-gray-900">
            <Cpu className={`w-4 h-4 ${isCritical ? 'text-red-500' : 'text-gray-400 group-hover:text-blue-500 transition-colors'}`} aria-hidden="true" />
            {row.mpn}
          </div>
          {row.lead_time_weeks && (
            <span className="text-[10px] text-gray-400 flex items-center gap-1 mt-1.5 font-sans font-bold uppercase tracking-widest">
              <Clock className="w-3 h-3" aria-hidden="true" /> {row.lead_time_weeks}W Lead
            </span>
          )}
        </div>
      </td>
      <td className="px-6 py-4 border-b border-gray-100/50 text-gray-600 font-medium">{row.manufacturer}</td>
      <td className="px-6 py-4 border-b border-gray-100/50">
        {isEditing ? (
          <div className="flex items-center gap-1.5">
            <input 
              type="number" min="1" value={editQty} 
              onChange={(e) => setEditQty(parseInt(e.target.value, 10) || 1)} 
              className="w-20 px-3 py-1.5 text-sm font-mono font-bold bg-white border border-blue-300 rounded-lg outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm" 
              autoFocus 
            />
            <button onClick={handleSave} disabled={isPending} className="text-emerald-600 hover:bg-emerald-50 p-1.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/20"><Save className="w-4 h-4" /></button>
            <button onClick={() => setIsEditing(false)} className="text-gray-400 hover:bg-gray-100 hover:text-gray-700 p-1.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500/20"><X className="w-4 h-4" /></button>
          </div>
        ) : (
          <button 
            onClick={() => setIsEditing(true)} 
            className="flex items-center gap-2 group/edit cursor-pointer w-fit focus:outline-none focus:ring-2 focus:ring-blue-500/20 rounded-md px-1 -ml-1 transition-colors hover:bg-gray-100"
          >
            <span className="font-mono font-bold text-gray-900">{row.quantity.toLocaleString()}</span>
            <Edit2 className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover/edit:opacity-100 transition-all hover:text-blue-600" />
          </button>
        )}
      </td>
      <td className="px-6 py-4 border-b border-gray-100/50">
        {isCritical ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-50 text-red-700 text-[11px] font-bold uppercase tracking-widest border border-red-100"><AlertCircle className="w-3.5 h-3.5" /> High Risk</span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50/50 text-blue-700 text-[11px] font-bold uppercase tracking-widest border border-blue-100/50"><Zap className="w-3.5 h-3.5 text-blue-500" /> Staged</span>
        )}
      </td>
      <td className="px-6 py-4 border-b border-gray-100/50 text-right font-mono font-medium text-gray-500">
        {formatCurrency(markedUpPrice)}
      </td>
      <td className="px-6 py-4 border-b border-gray-100/50 text-right font-mono font-bold text-gray-900">
        {formatCurrency(lineTotal)}
      </td>
      <td className="px-6 py-4 border-b border-gray-100/50 text-right">
        {/* Actions are completely hidden until hover to keep the UI perfectly clean */}
        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity focus-within:opacity-100">
          <button 
            onClick={() => onManageAlternates(row)} 
            className={`text-[10px] uppercase tracking-widest font-bold px-3 py-1.5 rounded-lg border transition-all focus:outline-none focus:ring-4 focus:ring-blue-500/20 active:scale-95
              ${altCount > 0 ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50 hover:text-gray-900'}
            `}
          >
            Alts ({altCount})
          </button>
          <button 
            onClick={() => onDelete(row.id)} 
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all focus:outline-none focus:ring-4 focus:ring-red-500/20 active:scale-95"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
});
BomTableRow.displayName = 'BomTableRow';

// ============================================================================
// MOBILE CARD (<div>)
// ============================================================================
export const BomMobileCard = memo(({ row, index, isSelected, onToggleSelect, onManageAlternates, onDelete }: BomItemProps) => {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editQty, setEditQty] = useState<number>(row.quantity);

  const { mutate: saveUpdate, isPending } = useMutation({
    mutationFn: updateBomRow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom_records'] });
      setIsEditing(false);
    }
  });

  const handleSave = useCallback(() => {
    if (editQty !== row.quantity && editQty > 0) saveUpdate({ id: row.id, updates: { quantity: editQty } });
    else setIsEditing(false);
  }, [editQty, row.id, row.quantity, saveUpdate]);

  const markedUpPrice = row.target_price ? row.target_price * PLATFORM_MARGIN : null;
  const lineTotal = markedUpPrice ? markedUpPrice * row.quantity : null;
  const altCount = Array.isArray(row.alternates) ? row.alternates.length : 0;
  const isCritical = row.risk_level === 'critical';

  return (
    <div 
      className={`p-5 rounded-2xl transition-all shadow-sm animate-in fade-in slide-in-from-bottom-2 ring-1
        ${isSelected ? 'bg-blue-50/30 ring-blue-200 shadow-blue-500/5' : 'bg-white ring-gray-900/5 hover:shadow-md'}
      `}
      style={{ animationDelay: `${Math.min(index * 30, 800)}ms` }}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-start gap-3 w-full">
          <input 
            type="checkbox" checked={isSelected} onChange={() => onToggleSelect(row.id)} 
            className="mt-1 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 cursor-pointer shadow-sm transition-all" 
          />
          <div className="flex-1 min-w-0">
            <div className="font-mono text-sm font-bold text-gray-900 flex items-center gap-2 truncate">
              {row.mpn}
              {isCritical ? <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" /> : <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
            </div>
            <div className="text-xs text-gray-500 font-medium mt-1 truncate">{row.manufacturer}</div>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-4 bg-gray-50 rounded-xl p-3 border border-gray-100">
         <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Unit Price</p>
            <p className="font-mono text-xs font-semibold text-gray-600">{formatCurrency(markedUpPrice)}</p>
         </div>
         <div className="text-right">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Line Total</p>
            <p className="font-mono text-sm font-bold text-gray-900">{formatCurrency(lineTotal)}</p>
         </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase text-gray-400 tracking-widest">Qty:</span>
          {isEditing ? (
            <div className="flex items-center gap-1.5">
              <input type="number" min="1" value={editQty} onChange={(e) => setEditQty(parseInt(e.target.value, 10) || 1)} className="w-16 px-2 py-1 text-xs font-mono font-bold bg-white border border-blue-300 rounded outline-none focus:ring-2 focus:ring-blue-500/20" autoFocus />
              <button onClick={handleSave} disabled={isPending} className="text-emerald-600 p-1.5 rounded hover:bg-emerald-50"><Save className="w-3.5 h-3.5" /></button>
              <button onClick={() => setIsEditing(false)} className="text-gray-400 p-1.5 rounded hover:bg-gray-100"><X className="w-3.5 h-3.5" /></button>
            </div>
          ) : (
            <button onClick={() => setIsEditing(true)} className="font-mono text-sm font-bold hover:text-blue-600 flex items-center gap-1.5 focus:outline-none rounded p-1 -ml-1 transition-colors hover:bg-gray-50">
              {row.quantity.toLocaleString()} <Edit2 className="w-3 h-3 text-gray-300" />
            </button>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <button onClick={() => onManageAlternates(row)} className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-colors focus:outline-none focus:ring-4 focus:ring-blue-500/20 active:scale-95 ${altCount > 0 ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
            Alts ({altCount})
          </button>
          <button onClick={() => onDelete(row.id)} className="text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors focus:outline-none focus:ring-4 focus:ring-red-500/20 rounded-lg p-1.5"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
});
BomMobileCard.displayName = 'BomMobileCard';