import { memo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { quickAddSchema } from '../types'; // Adjust import based on your setup
import type { QuickAddForm } from '../types';

interface QuickAddBarProps {
  onAdd: (part: QuickAddForm) => void;
  isAdding: boolean;
  onError: (msg: string) => void;
}

export const QuickAddBar = memo(({ onAdd, isAdding, onError }: QuickAddBarProps) => {
  const [form, setForm] = useState<QuickAddForm>({ mpn: '', manufacturer: '', quantity: 1 });

  const handleSubmit = () => {
    try {
      const sanitized = quickAddSchema.parse(form);
      onAdd(sanitized);
      setForm({ mpn: '', manufacturer: '', quantity: 1, target_price: undefined }); // Reset on success assumption
    } catch (err: any) {
      onError(err.issues?.[0]?.message || 'Invalid input requirements.');
    }
  };

  return (
    <div className="bg-white border-b border-slate-200 p-4 shrink-0 animate-in slide-in-from-top-2">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 max-w-4xl">
        <input value={form.mpn} onChange={e=>setForm({...form, mpn: e.target.value})} placeholder="MPN" aria-label="Manufacturer Part Number" className="flex-1 w-full px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none font-mono uppercase focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" />
        <input value={form.manufacturer} onChange={e=>setForm({...form, manufacturer: e.target.value})} placeholder="Manufacturer" aria-label="Manufacturer" className="w-full sm:w-40 px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" />
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <input type="number" min="1" value={form.quantity} onChange={e=>setForm({...form, quantity: parseInt(e.target.value, 10)||1})} placeholder="Qty" aria-label="Quantity" className="w-full sm:w-24 px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" />
          <input type="number" step="0.01" value={form.target_price || ''} onChange={e=>setForm({...form, target_price: e.target.value ? parseFloat(e.target.value) : undefined})} placeholder="Target $" aria-label="Target Price" className="w-full sm:w-28 px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" />
          <button onClick={handleSubmit} disabled={isAdding} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50 w-full sm:w-auto transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50">
            {isAdding ? <Loader2 className="w-4 h-4 animate-spin mx-auto"/> : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
});
QuickAddBar.displayName = 'QuickAddBar';