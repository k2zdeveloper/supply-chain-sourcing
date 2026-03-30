import { memo, useState } from 'react';
import { X, Trash2, Cpu } from 'lucide-react';
import type { BomRecord } from '../types';

// Simple fallback if mpnSanitizer isn't available
const sanitizeMpn = (val: string) => val.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');

interface AlternatesModalProps {
  row: BomRecord;
  onClose: () => void;
  onUpdate: (updates: Partial<BomRecord>) => void;
  onError: (msg: string) => void;
}

export const AlternatesModal = memo(({ row, onClose, onUpdate, onError }: AlternatesModalProps) => {
  const [newAlt, setNewAlt] = useState('');
  const alternates = row.alternates || [];

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const cleanMpn = sanitizeMpn(newAlt);
      if (!cleanMpn) throw new Error('Part number cannot be empty.');
      if (alternates.length >= 3) throw new Error('Maximum of 3 alternatives allowed.');
      if (row.mpn.toUpperCase() === cleanMpn || alternates.some(a => a.toUpperCase() === cleanMpn)) {
        throw new Error(`"${cleanMpn}" is already listed.`);
      }
      onUpdate({ alternates: [...alternates, cleanMpn] });
      setNewAlt('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid Part Number';
      onError(msg);
    }
  };

  const handleRemove = (index: number) => {
    const updated = [...alternates];
    updated.splice(index, 1);
    onUpdate({ alternates: updated });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/40 backdrop-blur-md p-4" role="dialog">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-300 ring-1 ring-gray-900/10">
        
        <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
          <h3 className="font-extrabold text-lg text-gray-900 tracking-tight">Manage Alternates</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors focus:outline-none focus:ring-4 focus:ring-gray-200 rounded-full p-1.5">
            <X className="w-4 h-4"/>
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center">
              <Cpu className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-0.5">Target Component</p>
              <p className="font-mono font-bold text-gray-900">{row.mpn}</p>
            </div>
          </div>
          
          <div className="space-y-2">
            {alternates.map((alt, i) => (
              <div key={i} className="flex justify-between items-center border border-gray-200 px-4 py-3 rounded-xl bg-white shadow-sm transition-all hover:border-gray-300">
                <span className="font-mono text-sm font-bold text-gray-700">{alt}</span>
                <button onClick={() => handleRemove(i)} className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-200">
                  <Trash2 className="w-4 h-4"/>
                </button>
              </div>
            ))}
            {alternates.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4 font-medium border border-dashed border-gray-200 rounded-xl bg-gray-50/50">No alternatives added.</p>
            )}
          </div>

          {alternates.length < 3 && (
            <form onSubmit={handleAdd} className="flex gap-2 pt-2">
              <input 
                value={newAlt} 
                onChange={e => setNewAlt(e.target.value)} 
                placeholder="Enter alternative MPN..." 
                className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono uppercase outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 shadow-sm transition-all" 
                required 
              />
              <button type="submit" className="bg-gray-900 hover:bg-black text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md focus:outline-none focus:ring-4 focus:ring-gray-900/20 active:scale-95">
                Add
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
});
AlternatesModal.displayName = 'AlternatesModal';