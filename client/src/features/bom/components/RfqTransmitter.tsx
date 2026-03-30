import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCartStore } from '@/stores/useCartStore';
import { 
  ArrowLeft, ShieldCheck, Cpu, Send, Loader2, 
  Clock, FileText, Building, CheckCircle2
} from 'lucide-react';

export default function RfqTransmitter() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { items: cartItems, clearCart } = useCartStore();
  const [isSuccess, setIsSuccess] = useState(false);

  // Derive the active workspace being submitted
  const activeWorkspaceId = cartItems.length > 0 ? cartItems[0].workspace_id : null;

  // Aggregate telemetry for the UI
  const totalParts = useMemo(() => cartItems.reduce((sum: any, item: { quantity: any; }) => sum + item.quantity, 0), [cartItems]);
  const uniqueLines = cartItems.length;

  const transmitMutation = useMutation({
    mutationFn: async (workspaceId: string) => {
      const { error } = await supabase.rpc('transmit_rfq', { target_workspace_id: workspaceId });
      if (error) throw new Error(error.message);
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      setIsSuccess(true);
      clearCart();
    }
  });

  const handleTransmit = () => {
    if (!activeWorkspaceId) return;
    transmitMutation.mutate(activeWorkspaceId);
  };

  if (!activeWorkspaceId && !isSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <Cpu className="w-12 h-12 text-slate-300 mb-4" />
        <h2 className="text-xl font-extrabold text-slate-900">Payload Empty</h2>
        <button onClick={() => navigate('/dashboard')} className="mt-6 text-blue-600 font-bold hover:underline">Return to Dashboard</button>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-slate-50 flex flex-col items-center justify-center p-6 animate-in fade-in zoom-in-95 duration-500">
        <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mb-8 border-4 border-emerald-50">
          <CheckCircle2 className="w-12 h-12 text-emerald-600" />
        </div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-3">RFQ Transmitted Successfully</h1>
        <p className="text-slate-500 font-medium text-center max-w-md mb-8 leading-relaxed">
          Your Bill of Materials has been locked and securely routed to our global sourcing desk. Our engineers are now querying the market for the best allocations.
        </p>
        
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm w-full max-w-md mb-8">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Next Steps</h3>
          <ul className="space-y-4">
            <li className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-blue-500 shrink-0" />
              <div>
                <p className="text-sm font-bold text-slate-900">Sourcing & Mitigation</p>
                <p className="text-xs text-slate-500 mt-1">Please allow 24-48 hours for market analysis and shortage mitigation.</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-blue-500 shrink-0" />
              <div>
                <p className="text-sm font-bold text-slate-900">Official Quotation</p>
                <p className="text-xs text-slate-500 mt-1">You will be notified when your official quote and alternatives are ready for review.</p>
              </div>
            </li>
          </ul>
        </div>

        <button onClick={() => navigate('/dashboard')} className="bg-slate-900 hover:bg-black text-white px-8 py-3.5 rounded-xl text-sm font-bold transition-all shadow-md">
          Return to Overview
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12 pt-8 font-sans px-4">
      <header className="flex items-center gap-4 border-b border-slate-200 pb-6">
        <button onClick={() => navigate(-1)} className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors focus:outline-none">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Transmit Request for Quote (RFQ)</h1>
          <p className="text-slate-500 text-sm mt-1 font-medium flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" /> Secure handoff to SCS Sourcing Team
          </p>
        </div>
      </header>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Left: Explainer */}
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-100 p-6 rounded-2xl">
            <h3 className="text-blue-900 font-bold text-lg mb-2">What happens next?</h3>
            <p className="text-blue-700 text-sm leading-relaxed mb-4">
              By submitting this payload, your workspace will be locked to prevent data drift. Our engineers will immediately begin mapping your components against our global supplier network.
            </p>
            <ul className="space-y-2 text-sm text-blue-800 font-medium">
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-600"/> Real-time stock verification</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-600"/> Algorithmic price negotiation</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-600"/> Identification of drop-in replacements</li>
            </ul>
          </div>
        </div>

        {/* Right: Summary & Action */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 bg-slate-50 border-b border-slate-100">
            <h2 className="font-extrabold text-slate-900 flex items-center gap-2">Payload Summary</h2>
          </div>
          
          <div className="p-6 space-y-5 flex-1">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3 text-slate-600">
                <Cpu className="w-5 h-5 text-slate-400" />
                <span className="font-bold">Unique Components</span>
              </div>
              <span className="font-mono text-lg font-black text-slate-900">{uniqueLines}</span>
            </div>

            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3 text-slate-600">
                <Building className="w-5 h-5 text-slate-400" />
                <span className="font-bold">Total Volume</span>
              </div>
              <span className="font-mono text-lg font-black text-slate-900">{totalParts.toLocaleString()}</span>
            </div>
          </div>

          <div className="p-6 bg-slate-50 border-t border-slate-200">
            <button 
              onClick={handleTransmit}
              disabled={transmitMutation.isPending}
              className="w-full bg-slate-900 hover:bg-black text-white px-6 py-4 rounded-xl text-sm font-extrabold transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 focus:outline-none focus:ring-4 focus:ring-slate-900/20"
            >
              {transmitMutation.isPending ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Transmitting...</>
              ) : (
                <><Send className="w-5 h-5" /> Lock & Transmit to Sourcing</>
              )}
            </button>
            <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-3">
              No financial commitment required yet
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}