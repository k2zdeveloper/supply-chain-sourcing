import { memo } from 'react';
import { 
  Loader2, AlertCircle, Receipt, CheckCircle2, 
  Clock, TrendingUp, RefreshCcw, ArrowRight, XCircle, Eye 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '../utils'; // Adjust based on your setup
import type { OrderHistory } from '../types';

interface OrderHistoryViewProps {
  history: OrderHistory[];
  isLoading: boolean;
  isError: boolean;
  onResubmitQuote: () => void;
  onPay: () => void;
}

// Helper to format dates cleanly with time (e.g., "Mar 24, 2026 at 2:30 PM")
const formatDateTime = (dateString: string | undefined | null) => {
  if (!dateString) return 'Unknown Date';
  return new Date(dateString).toLocaleDateString(undefined, {
    month: 'short', 
    day: 'numeric', 
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};

export const OrderHistoryView = memo(({ history, isLoading, isError, onResubmitQuote, onPay }: OrderHistoryViewProps) => {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex-1 bg-[#F9FAFB] p-12 flex justify-center items-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }
  
  if (isError) {
    return (
      <div className="flex-1 bg-[#F9FAFB] p-6 overflow-auto">
        <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-3xl border border-red-100 shadow-sm max-w-lg mx-auto mt-10">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Failed to load history</h3>
          <p className="text-sm text-gray-500 mt-2">There was a problem retrieving your past orders. Please refresh the page.</p>
        </div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="flex-1 bg-[#F9FAFB] p-6 overflow-auto">
        <div className="flex flex-col items-center justify-center p-16 text-center bg-white rounded-3xl border border-gray-200 border-dashed max-w-2xl mx-auto mt-10">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-5">
            <Receipt className="w-10 h-10 text-gray-300" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900">No Quotations Found</h3>
          <p className="text-sm text-gray-500 mt-2 max-w-sm">Generate your first quote from the Current BOM tab to start tracking your procurement history here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#F9FAFB] p-6 lg:p-8 overflow-auto">
      <div className="grid gap-5 max-w-5xl mx-auto">
        {history.map(order => {
          // 1. We strictly extend the type locally to tell TS that updated_at might exist
          const typedOrder = order as OrderHistory & { updated_at?: string | null };
          
          const orderedDate = new Date(typedOrder.ordered_at);
          const expirationDate = new Date(orderedDate.getTime() + 14 * 24 * 60 * 60 * 1000); 
          
          // Strict Status Logic
          const normalizedStatus = String(typedOrder.status || '').toUpperCase().trim();
          const isRejected = normalizedStatus === 'REJECTED' || normalizedStatus === 'CANCELLED';
          const isExpired = !isRejected && new Date() > expirationDate;
          const isApproved = normalizedStatus === 'FINALIZED' && !isExpired;

          // 2. Safely resolve the date without throwing TS errors
          const resolvedDate = typedOrder.updated_at ? typedOrder.updated_at : typedOrder.ordered_at;

          return (
            <div 
              key={typedOrder.id} 
              className={`group bg-white border p-6 lg:p-8 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-8 transition-all duration-300 hover:shadow-md
                ${isExpired || isRejected ? 'border-gray-200 opacity-90' : isApproved ? 'border-emerald-200/60 shadow-sm ring-1 ring-emerald-500/10' : 'border-gray-200 shadow-sm'}
              `}
            >
              {/* Left Column: Details & Dates */}
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <h4 className="font-mono text-lg font-semibold text-gray-900 tracking-tight">
                    Quote #{typedOrder.id.split('-')[0].toUpperCase()}
                  </h4>
                  
                  {isRejected ? (
                    <span className="text-[11px] font-bold uppercase tracking-wider bg-red-50 text-red-700 px-3 py-1 rounded-full border border-red-100/50 flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5" /> Rejected</span>
                  ) : isExpired ? (
                    <span className="text-[11px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600 px-3 py-1 rounded-full border border-gray-200/50 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> Expired</span>
                  ) : isApproved ? (
                    <span className="text-[11px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-100/50 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Approved for Payment</span>
                  ) : (
                    <span className="text-[11px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 px-3 py-1 rounded-full border border-amber-100/50 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Pending Review</span>
                  )}
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-[13px]">
                  <p className="text-gray-500 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                    <span className="font-medium text-gray-700">Created:</span> 
                    {formatDateTime(typedOrder.ordered_at)}
                  </p>
                  
                  {isRejected ? (
                    <p className="text-red-600/80 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-300"></span>
                      <span className="font-medium text-red-800">Rejected:</span> 
                      {formatDateTime(resolvedDate)}
                    </p>
                  ) : isExpired ? (
                     <p className="text-gray-500 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                      <span className="font-medium text-gray-700">Expired:</span> 
                      {formatDateTime(expirationDate.toISOString())}
                    </p>
                  ) : (
                    <p className="text-gray-500 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-300"></span>
                      <span className="font-medium text-gray-700">Valid until:</span> 
                      {formatDateTime(expirationDate.toISOString())}
                    </p>
                  )}
                  
                  <p className="text-gray-500 flex items-center gap-2 sm:col-span-2 mt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-300"></span>
                    <span className="font-medium text-gray-700">Scope:</span> 
                    {typedOrder.item_count} Unique Components
                  </p>
                </div>
              </div>

              {/* Right Column: Pricing & Actions */}
              <div className="flex flex-col sm:flex-row items-end sm:items-center gap-6 border-t border-gray-100 pt-5 md:border-none md:pt-0">
                
                {/* Pricing Block */}
                <div className="text-right w-full sm:w-auto">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Total Value</p>
                  <span className="font-mono text-2xl font-light tracking-tight text-gray-900">{formatCurrency(typedOrder.total_value)}</span>
                  {typedOrder.previous_value && typedOrder.previous_value > typedOrder.total_value && !isRejected && (
                    <div className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md flex items-center justify-end gap-1.5 mt-1.5">
                      <TrendingUp className="w-3.5 h-3.5 rotate-180" /> Saved {formatCurrency(typedOrder.previous_value - typedOrder.total_value)}
                    </div>
                  )}
                </div>
                
                {/* Action Buttons */}
                <div className="shrink-0 w-full sm:w-auto flex flex-col sm:flex-row items-center gap-3">
                  {isRejected || isExpired ? (
                    <>
                      {/* Secondary Action: Allow viewing the rejected/expired quote */}
                      <button 
                        onClick={() => navigate(`/dashboard/quotes/${typedOrder.id}`)} 
                        className="w-full sm:w-auto text-gray-600 bg-white hover:bg-gray-50 border border-gray-200 px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all focus:outline-none focus:ring-4 focus:ring-gray-100"
                      >
                        <Eye className="w-4 h-4" /> View Details
                      </button>
                      
                      {/* Primary Action: Resubmit */}
                      <button 
                        onClick={onResubmitQuote} 
                        className="w-full sm:w-auto bg-gray-900 hover:bg-black text-white px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-md focus:outline-none focus:ring-4 focus:ring-gray-900/20"
                      >
                        <RefreshCcw className="w-4 h-4" /> Resubmit
                      </button>
                    </>
                  ) : isApproved ? (
                    <button 
                      onClick={onPay} 
                      className="w-full sm:w-auto bg-gray-900 hover:bg-black text-white px-8 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-md focus:outline-none focus:ring-4 focus:ring-gray-900/20"
                    >
                      Process Payment <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button 
                      onClick={() => navigate(`/dashboard/quotes/${typedOrder.id}`)} 
                      className="w-full sm:w-auto bg-white hover:bg-blue-50 text-blue-700 border border-gray-200 hover:border-blue-200 px-8 py-3 rounded-xl text-sm font-semibold transition-all shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-500/20"
                    >
                      Review Quote
                    </button>
                  )}
                </div>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
});

OrderHistoryView.displayName = 'OrderHistoryView';