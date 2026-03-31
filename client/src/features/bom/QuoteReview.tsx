import React, { useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  CheckCircle2, AlertTriangle, XCircle, PackageSearch, 
  Check, X, Loader2, ChevronLeft, Printer, RefreshCcw, 
  Clock, AlertCircle, ShieldCheck, Zap, Activity, 
  Search, PackageX, Ban, ArrowUpRight, FileText
} from 'lucide-react';
import { z } from 'zod';
import { pdf } from '@react-pdf/renderer';

import { formatCurrency } from '@/features/bom/utils';
import { fetchQuoteDetails, resolveAlternative, finalizeQuote, rejectQuote, fetchBatchedAlternatives } from './api';
import { QuoteDocument } from './components/QuotePDF';
import type { QuoteDetails } from './types'; 

// ============================================================================
// STRICT ENTERPRISE TYPES
// ============================================================================
type AppNotification = { 
  title: string; 
  message: string; 
  type: 'error' | 'success'; 
};

type FinancialSummary = { 
  subtotal: number; 
  shipping: number; 
  tax_amount: number; 
  discount: number; 
  final_total: number; 
};

type ResolutionDecision = 'ACCEPTED' | 'REJECTED';

type LineItemRowProps = {
  line: any;
  isQuoteLocked: boolean;
  resolvingId: string | null;
  onResolve: (lineId: string, altId: string | undefined, decision: ResolutionDecision, altData?: any) => void;
  liveAlts: any[];
  isSearching: boolean;
};

type AlternativeCardProps = {
  alt: any;
  targetQty: number;
  isResolving: boolean;
  onAccept: () => void;
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function QuoteReview() {
  const { quoteId } = useParams<{ quoteId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // --- UI State ---
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState<boolean>(false);
  const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [notification, setNotification] = useState<AppNotification | null>(null);

  const showNotification = useCallback((title: string, payload: unknown, type: 'error' | 'success' = 'error') => {
    let message = 'An unexpected system error occurred.';
    if (type === 'success' && typeof payload === 'string') message = payload;
    else if (payload instanceof z.ZodError) message = payload.issues[0]?.message || 'Input validation failed.';
    else if (payload instanceof Error) message = payload.message.replace('Error: ', '');
    else if (typeof payload === 'string') message = payload;

    setNotification({ title, message, type });
    setTimeout(() => setNotification(prev => prev?.title === title ? null : prev), 6000);
  }, []);

  // --- Queries ---
  const { data: quote, isLoading, isError } = useQuery<QuoteDetails, Error>({
    queryKey: ['quote_review', quoteId],
    queryFn: () => fetchQuoteDetails(quoteId!),
    enabled: !!quoteId,
    staleTime: 1000 * 60 * 5 
  });

  const isQuoteLocked = quote?.status === 'FINALIZED' || quote?.status === 'REJECTED';

  // Extract pending MPNs to fetch live alternatives in a single batch
  const pendingMpns = useMemo(() => {
    if (!quote || isQuoteLocked) return [];
    const mpns = quote.line_items
      .filter(line => line.status !== 'MATCHED' && line.user_decision === 'PENDING')
      .map(line => line.requested_mpn);
    return Array.from(new Set(mpns)); 
  }, [quote, isQuoteLocked]);

  const { data: liveBatchedAlts = {}, isLoading: isLiveAltsLoading } = useQuery({
    queryKey: ['live_quote_alts', pendingMpns],
    queryFn: () => fetchBatchedAlternatives(pendingMpns, true), 
    enabled: pendingMpns.length > 0,
    staleTime: Infinity, 
  });

  // --- Mutations ---
  
  // 1. Line Item Resolution (Optimistic UI Update)
  const { mutate: handleResolution } = useMutation({
    mutationFn: ({ lineId, altId, decision, altData }: { lineId: string, altId?: string, decision: ResolutionDecision, altData?: any }) => 
      resolveAlternative(quoteId!, lineId, altId, decision, altData),
    
    onMutate: async ({ lineId, decision, altData }) => {
      setResolvingId(lineId);
      await queryClient.cancelQueries({ queryKey: ['quote_review', quoteId] });
      const previousQuote = queryClient.getQueryData<QuoteDetails>(['quote_review', quoteId]);

      // Optimistically update the cache for instant user feedback
      queryClient.setQueryData(['quote_review', quoteId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          line_items: old.line_items.map((line: any) => {
            if (line.id === lineId) {
              return {
                ...line,
                user_decision: decision,
                status: decision === 'ACCEPTED' ? 'MATCHED' : (decision === 'REJECTED' ? 'UNSOURCED' : line.status),
                ...(decision === 'ACCEPTED' && altData ? {
                  unit_cost: altData.unit_cost,
                  requested_mpn: altData.mpn || altData.part_number || line.requested_mpn,
                  fulfilled_qty: altData.available_qty || 0
                } : {})
              };
            }
            return line;
          })
        };
      });

      return { previousQuote };
    },
    
    onError: (err: Error, variables, context) => {
      if (context?.previousQuote) {
        queryClient.setQueryData(['quote_review', quoteId], context.previousQuote);
      }
      showNotification('Resolution Failed', err);
      setResolvingId(null);
    },
    
    onSuccess: () => {
      setResolvingId(null);
      // Re-fetch in the background to ensure perfect sync
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['quote_review', quoteId] }), 1500);
    }
  });

  const onResolveAction = useCallback((lineId: string, altId: string | undefined, decision: ResolutionDecision, altData?: any) => {
    handleResolution({ lineId, altId, decision, altData });
  }, [handleResolution]);

  // 2. Finalize Quote & Route to PO Generator
  const { mutate: submitFinalQuote, isPending: isFinalizing } = useMutation({
    mutationFn: () => finalizeQuote(quoteId!),
    onSuccess: () => {
      showNotification('Quote Finalized', 'Proceeding to Purchase Order configuration...', 'success');
      setIsFinalizeModalOpen(false);
      // ⚡ STRICT APP ROUTING: Immediately pass state to PO generator
      setTimeout(() => navigate(`/dashboard/quotes/${quoteId}/po`), 800);
    },
    onError: (err: Error) => {
      showNotification('Finalization Failed', err, 'error');
      setIsFinalizeModalOpen(false);
    }
  });

  // 3. Reject Quote completely
  const { mutate: submitRejectQuote, isPending: isRejecting } = useMutation({
    mutationFn: () => rejectQuote(quoteId!),
    onSuccess: () => {
      showNotification('Quote Cancelled', 'Quotation permanently rejected.', 'success');
      setIsRejectModalOpen(false);
      setTimeout(() => navigate('/dashboard/projects', { replace: true }), 1500);
    },
    onError: (err: Error) => {
      showNotification('Rejection Failed', err);
      setIsRejectModalOpen(false);
    }
  });

  // --- Data Processing Engine ---
  const calculations = useMemo<FinancialSummary>(() => {
    if (!quote) return { subtotal: 0, shipping: 0, tax_amount: 0, discount: 0, final_total: 0 };
    const subtotal = quote.line_items.reduce((acc, item) => {
      if (item.status === 'UNSOURCED' || item.user_decision === 'REJECTED') return acc;
      return acc + ((item.unit_cost || 0) * item.requested_qty);
    }, 0);
    const shipping = subtotal > 5000 ? 0 : 150; 
    const tax_rate = 0.0825; 
    const tax_amount = subtotal * tax_rate;
    const discount = subtotal > 10000 ? subtotal * 0.05 : 0; 
    const final_total = Number((subtotal + shipping + tax_amount - discount).toFixed(2));
    return { subtotal, shipping, tax_amount, discount, final_total };
  }, [quote]);

  const resolutionMetrics = useMemo(() => {
    if (!quote) return { total: 0, resolved: 0, percent: 0, requiresAttention: false };
    const total = quote.line_items.length;
    const resolved = quote.line_items.filter(item => item.status === 'MATCHED' || item.user_decision !== 'PENDING').length;
    return { 
      total, 
      resolved, 
      percent: total === 0 ? 0 : Math.round((resolved / total) * 100),
      requiresAttention: resolved < total 
    };
  }, [quote]);

  const handleDownloadPDF = async () => {
    if (!quote) return;
    setIsExporting(true);
    try {
      const blob = await pdf(<QuoteDocument quote={quote} calculations={calculations} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `SupplyOS_Quote_${quote.id.split('-')[0].toUpperCase()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showNotification('Success', 'PDF generated and downloaded.', 'success');
    } catch (err) {
      showNotification('Export Error', 'Failed to generate PDF document.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // --- Render States ---
  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
        <h2 className="text-xs font-bold tracking-widest uppercase text-slate-500">Compiling Sourcing Data...</h2>
      </div>
    );
  }

  if (isError || !quote) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 bg-slate-50 min-h-[calc(100vh-3.5rem)] text-slate-900">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-sm w-full text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-extrabold text-slate-900 mb-2">Quotation Not Found</h2>
          <p className="text-xs text-slate-500 font-medium mb-6">This quote may have been deleted or the link is invalid.</p>
          <button onClick={() => navigate('/dashboard/projects')} className="w-full bg-slate-900 text-white font-bold py-2.5 rounded-lg hover:bg-black transition-all text-sm active:scale-[0.98]">
            Return to Workspaces
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[calc(100vh-3.5rem)] bg-slate-50 flex flex-col text-slate-900 min-w-0 relative">
      
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-24 right-4 md:right-6 z-[100] animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className={`bg-white border-l-4 p-3 rounded-lg shadow-xl md:min-w-[280px] flex items-start gap-2.5 w-full ring-1 ring-slate-900/5 ${notification.type === 'success' ? 'border-emerald-500' : 'border-red-500'}`}>
            {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />}
            <div className="flex-1 min-w-0">
              <h3 className="text-xs font-bold text-slate-900 truncate">{notification.title}</h3>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug font-medium break-words">{notification.message}</p>
            </div>
            <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-900 focus:outline-none"><X className="w-3.5 h-3.5"/></button>
          </div>
        </div>
      )}

      {/* FINALIZATION MODAL */}
      {isFinalizeModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95">
            <h3 className="text-lg font-extrabold text-slate-900 mb-2 tracking-tight">Finalize Quotation?</h3>
            <p className="text-xs text-slate-500 font-medium mb-6 leading-relaxed">
              This action locks current pricing and inventory availability. You will be redirected to configure the Purchase Order.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setIsFinalizeModalOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
              <button onClick={() => submitFinalQuote()} disabled={isFinalizing} className="px-6 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg shadow-sm hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50">
                {isFinalizing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm & Generate PO'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Dashboard Header */}
      <header className="bg-white border-b border-slate-200/60 px-4 md:px-6 py-3 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-3 z-20 sticky top-0">
        <div>
          <button onClick={() => navigate('/dashboard/quotes')} className="text-[10px] font-bold text-slate-400 hover:text-slate-900 flex items-center gap-1 mb-1 transition-colors focus:outline-none uppercase tracking-wider">
            <ChevronLeft className="w-3 h-3" /> Inbox
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
              Quotation <span className="text-slate-400 font-mono font-medium">#{quote.id.split('-')[0].toUpperCase()}</span>
            </h1>
            <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border shrink-0
              ${quote.status === 'FINALIZED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                quote.status === 'REJECTED' ? 'bg-red-50 text-red-700 border-red-200' : 
                'bg-blue-50 text-blue-700 border-blue-200'}`}>
              {quote.status.replace('_', ' ')}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {quote.status === 'FINALIZED' ? (
             <button onClick={() => navigate(`/dashboard/quotes/${quoteId}/po`)} className="flex-1 sm:flex-none justify-center bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all focus:outline-none flex items-center gap-2">
               <FileText className="w-4 h-4" /> Open PO Workspace
             </button>
          ) : (
            <>
              <button onClick={() => window.location.reload()} className="flex-1 sm:flex-none justify-center text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 px-3 py-2 rounded-xl transition-all shadow-sm focus:outline-none flex items-center gap-1.5">
                <RefreshCcw className="w-3.5 h-3.5 text-slate-400" /> <span className="hidden sm:inline">Refresh</span>
              </button>
              <button 
                onClick={handleDownloadPDF} 
                disabled={isExporting}
                className="flex-1 sm:flex-none justify-center text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 px-3 py-2 rounded-xl transition-all shadow-sm focus:outline-none flex items-center gap-1.5 disabled:opacity-50"
              >
                {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" /> : <Printer className="w-3.5 h-3.5 text-slate-400" />} 
                <span className="hidden sm:inline">{isExporting ? 'Generating...' : 'Export PDF'}</span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto p-3 md:p-5 lg:p-6 custom-scrollbar pb-32">
        <div className="max-w-[1600px] w-full mx-auto space-y-4 md:space-y-6">
          
          {/* Metrics & Progress Bar */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-3 bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex flex-col justify-center relative overflow-hidden">
              <div className="flex justify-between items-end mb-3">
                <div>
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5"><Activity className="w-3 h-3"/> Order Resolution</h3>
                  <p className="text-xl font-black text-slate-900">{resolutionMetrics.resolved} <span className="text-sm font-medium text-slate-400">/ {resolutionMetrics.total} Items Ready</span></p>
                </div>
                <span className="text-sm font-black text-blue-600">{resolutionMetrics.percent}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-1000 ${resolutionMetrics.percent === 100 ? 'bg-emerald-500' : 'bg-blue-600'}`} 
                  style={{ width: `${resolutionMetrics.percent}%` }}
                />
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-md flex flex-col justify-center relative overflow-hidden">
              <div className="absolute right-0 top-0 w-24 h-24 bg-blue-500/10 rounded-full blur-xl -mr-8 -mt-8 pointer-events-none" />
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Quote Value</p>
              <p className="text-3xl font-black text-white font-mono tracking-tight relative z-10">{formatCurrency(calculations.final_total)}</p>
            </div>
          </div>

          {/* Warning Banner */}
          {resolutionMetrics.requiresAttention && !isQuoteLocked && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3 shadow-sm animate-in fade-in">
              <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center shrink-0 ring-1 ring-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-amber-900">Action Required: Sourcing Shortages</h3>
                <p className="text-xs font-medium text-amber-700 mt-0.5">Live market data has found alternatives for your out-of-stock components.</p>
              </div>
            </div>
          )}

          {/* Desktop Table */}
          <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden hidden lg:block">
            <table className="w-full min-w-[1000px] text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 text-[9px] font-bold uppercase tracking-widest">
                <tr>
                  <th className="px-5 py-4 w-1/4">Component MPN</th>
                  <th className="px-5 py-4 w-1/6">Status</th>
                  <th className="px-5 py-4 text-right">Requested Qty</th>
                  <th className="px-5 py-4 text-right">Available</th>
                  <th className="px-5 py-4 text-right">Unit Cost</th>
                  <th className="px-5 py-4 text-right">Extended Price</th>
                  <th className="px-5 py-4 text-center">Resolution Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quote.line_items.map((line) => (
                  <DesktopLineItemRow 
                    key={line.id} 
                    line={line} 
                    isQuoteLocked={isQuoteLocked}
                    resolvingId={resolvingId}
                    onResolve={onResolveAction}
                    liveAlts={liveBatchedAlts[line.requested_mpn] || []}
                    isSearching={isLiveAltsLoading}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile View */}
          <div className="lg:hidden space-y-3">
             {quote.line_items.map((line) => (
                <MobileLineItemCard 
                  key={line.id} 
                  line={line} 
                  isQuoteLocked={isQuoteLocked}
                  resolvingId={resolvingId}
                  onResolve={onResolveAction}
                  liveAlts={liveBatchedAlts[line.requested_mpn] || []}
                  isSearching={isLiveAltsLoading}
                />
             ))}
          </div>

        </div>
      </main>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-[240px] bg-white/95 backdrop-blur-xl border-t border-slate-200/60 p-3 md:p-4 z-40 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.08)]">
        <div className="hidden sm:block">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Order Ready Value</p>
          <p className="text-xl font-black text-slate-900 font-mono tracking-tight">{formatCurrency(calculations.final_total)}</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
          {!isQuoteLocked && (
            <button
              onClick={() => setIsRejectModalOpen(true)}
              disabled={isFinalizing || isRejecting}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors focus:outline-none"
            >
              Cancel Quote
            </button>
          )}
          
          <button
            onClick={() => setIsFinalizeModalOpen(true)}
            disabled={resolutionMetrics.requiresAttention || isFinalizing || isQuoteLocked}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md disabled:opacity-50 focus:outline-none flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            {isFinalizing ? <Loader2 className="w-4 h-4 animate-spin" /> : 
              quote.status === 'FINALIZED' ? 'PO Generated' : 
              quote.status === 'REJECTED' ? 'Quote Closed' : 
              'Generate PO'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SUB-COMPONENT: DESKTOP LINE ITEM ROW
// ============================================================================
const DesktopLineItemRow = React.memo(({ line, isQuoteLocked, resolvingId, onResolve, liveAlts, isSearching }: LineItemRowProps) => {
  const needsResolution = line.status !== 'MATCHED' && line.user_decision === 'PENDING' && !isQuoteLocked;
  const isResolving = resolvingId === line.id;

  const formattedLiveAlts = useMemo(() => liveAlts.map((alt: any) => ({
    inventory_id: alt.id, 
    mpn: alt.part_number,
    manufacturer: alt.manufacturer,
    unit_cost: alt.unit_cost,
    available_qty: alt.available_qty
  })), [liveAlts]);

  const displayAlternatives = useMemo(() => {
    const raw = formattedLiveAlts.length > 0 ? formattedLiveAlts : (line.alternatives || []);
    return [...raw].sort((a, b) => {
      const aInStock = (a.available_qty || 0) > 0 ? 1 : 0;
      const bInStock = (b.available_qty || 0) > 0 ? 1 : 0;
      if (aInStock !== bInStock) return bInStock - aInStock; 
      return (a.unit_cost || 0) - (b.unit_cost || 0);
    });
  }, [formattedLiveAlts, line.alternatives]);

  let displayAvailable = 0;
  let availableColor = 'text-slate-500';
  if (line.user_decision === 'REJECTED' || line.status === 'UNSOURCED') {
      displayAvailable = 0;
      availableColor = 'text-slate-400';
  } else if (line.status === 'MATCHED') {
      displayAvailable = line.fulfilled_qty || line.requested_qty;
      availableColor = 'text-emerald-600';
  } else if (displayAlternatives.length > 0) {
      displayAvailable = Math.max(...displayAlternatives.map((a:any) => a.available_qty || 0));
      availableColor = 'text-amber-600';
  }

  const handleDropItem = useCallback(() => {
    onResolve(line.id, undefined, 'REJECTED');
  }, [line.id, onResolve]);

  return (
    <>
      <tr className={`transition-colors ${needsResolution ? 'bg-slate-50/50' : 'hover:bg-slate-50/50 group'}`}>
        <td className="px-5 py-4">
          <div className="font-mono font-bold text-slate-900 text-sm">{line.requested_mpn}</div>
        </td>
        <td className="px-5 py-4">
          {line.status === 'MATCHED' && <span className="inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest shadow-sm"><CheckCircle2 className="w-3.5 h-3.5" /> Allocated</span>}
          {line.status === 'SHORTAGE' && <span className="inline-flex items-center gap-1.5 text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest shadow-sm"><AlertTriangle className="w-3.5 h-3.5" /> Shortage</span>}
          {line.status === 'UNSOURCED' && <span className="inline-flex items-center gap-1.5 text-red-700 bg-red-50 border border-red-100 px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest shadow-sm"><XCircle className="w-3.5 h-3.5" /> No Stock</span>}
        </td>
        <td className="px-5 py-4 text-right font-medium text-slate-700 text-xs">{line.requested_qty?.toLocaleString() || 0}</td>
        <td className={`px-5 py-4 text-right font-mono text-xs font-bold ${availableColor}`}>
          {displayAvailable.toLocaleString()}
        </td>
        <td className="px-5 py-4 text-right font-mono text-slate-500 text-xs">{line.unit_cost ? formatCurrency(line.unit_cost) : '-'}</td>
        <td className="px-5 py-4 text-right font-mono font-bold text-slate-900 text-sm">{line.unit_cost ? formatCurrency(line.unit_cost * line.requested_qty) : '-'}</td>
        <td className="px-5 py-4 text-center">
           {line.user_decision === 'ACCEPTED' && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 uppercase tracking-widest"><Check className="w-3.5 h-3.5"/> Resolved</span>}
           {line.user_decision === 'REJECTED' && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest line-through"><X className="w-3.5 h-3.5"/> Dropped</span>}
           {needsResolution && <span className="text-[10px] font-bold text-amber-600 animate-pulse uppercase tracking-widest flex justify-center items-center gap-1"><Zap className="w-3 h-3 fill-amber-600"/> Action Required</span>}
        </td>
      </tr>
      
      {needsResolution && (
        <tr>
          <td colSpan={7} className="p-0 border-b-2 border-slate-200">
            <div className="bg-slate-100/80 px-5 py-5 shadow-inner flex gap-5 animate-in slide-in-from-top-2 duration-300">
              <div className="w-10 flex flex-col items-center">
                <div className="w-0.5 h-full bg-slate-300 rounded-full"></div>
              </div>
              <div className="flex-1 pb-2">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-[11px] font-extrabold text-slate-900 uppercase tracking-widest flex items-center gap-2">
                    <PackageSearch className="w-4 h-4 text-blue-600" /> Sourcing Intelligence Alternatives
                  </h4>
                  {!isSearching && displayAlternatives.length > 0 && (
                    <button 
                      onClick={handleDropItem}
                      disabled={isResolving}
                      className="text-[9px] font-bold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-100 px-2.5 py-1 rounded uppercase tracking-widest transition-colors focus:outline-none"
                    >
                      Drop Item from Quote
                    </button>
                  )}
                </div>
                
                {isSearching ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-8 text-center shadow-sm flex flex-col items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-500 mb-3" />
                    <p className="text-xs font-bold text-slate-900 mb-1">Scanning Global Market...</p>
                    <p className="text-[11px] text-slate-500">Checking live stock data via Nexar API.</p>
                  </div>
                ) : displayAlternatives.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {displayAlternatives.map((alt: any) => (
                      <AlternativeCard 
                        key={alt.inventory_id} 
                        alt={alt} 
                        targetQty={line.requested_qty} 
                        isResolving={isResolving}
                        onAccept={() => onResolve(line.id, alt.inventory_id, 'ACCEPTED', alt)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200 rounded-xl p-6 text-center shadow-sm relative overflow-hidden">
                    <PackageX className="absolute -right-4 -top-4 w-24 h-24 text-slate-100 opacity-50 rotate-12 pointer-events-none" />
                    <AlertCircle className="w-6 h-6 text-slate-300 mx-auto mb-2 relative z-10" />
                    <p className="text-xs font-bold text-slate-900 mb-1 relative z-10">No Alternatives Found</p>
                    <p className="text-[11px] text-slate-500 mb-4 relative z-10">Nexar could not locate a drop-in replacement currently in stock.</p>
                    <button 
                      onClick={handleDropItem}
                      disabled={isResolving}
                      className="px-4 py-2 bg-slate-900 text-white hover:bg-black rounded-lg text-xs font-bold transition-colors focus:outline-none relative z-10"
                    >
                      {isResolving ? 'Updating...' : 'Drop Item from Quote'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
});

// ============================================================================
// SUB-COMPONENT: CREATIVE ALTERNATIVE CARD
// ============================================================================
const AlternativeCard = React.memo(({ alt, targetQty, isResolving, onAccept }: AlternativeCardProps) => {
  const safeQty = alt.available_qty || 0;
  const isOutOfStock = safeQty === 0;
  
  const stockRatio = targetQty > 0 ? safeQty / targetQty : 0;
  const isHealthy = stockRatio >= 1.5;
  const isLow = stockRatio < 1 && stockRatio > 0;

  return (
    <div className={`border rounded-xl p-4 transition-all flex flex-col justify-between group relative overflow-hidden ${
      isOutOfStock 
        ? 'bg-slate-50/50 border-slate-200/80 grayscale-[0.3] opacity-80' 
        : 'bg-white border-slate-200 shadow-sm hover:border-blue-400 hover:shadow-md'
    }`}>
      
      {isOutOfStock && (
        <div className="absolute -right-4 -top-4 text-slate-200 pointer-events-none">
          <PackageX className="w-28 h-28 opacity-40 rotate-12" />
        </div>
      )}

      <div className="relative z-10">
        <div className="flex justify-between items-start mb-2">
          <p className={`font-mono text-sm font-extrabold ${isOutOfStock ? 'text-slate-400 line-through decoration-slate-300' : 'text-slate-900'}`}>
            {alt.mpn}
          </p>
          <span className={`font-mono font-black ${isOutOfStock ? 'text-slate-400' : 'text-slate-900'}`}>
            {formatCurrency(alt.unit_cost)}
          </span>
        </div>
        
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">{alt.manufacturer}</p>
        
        <div className="mb-4">
          {isOutOfStock ? (
            <div className="flex items-center gap-1.5 text-slate-500 bg-slate-100 border border-slate-200/80 rounded-md px-2 py-1 w-max">
              <Ban className="w-3 h-3" />
              <span className="text-[9px] font-bold uppercase tracking-widest">Unavailable</span>
            </div>
          ) : (
            <>
              <div className="flex justify-between text-[10px] font-bold mb-1">
                <span className="text-slate-500">Stock Health</span>
                <span className={isHealthy ? 'text-emerald-600' : isLow ? 'text-red-600' : 'text-amber-600'}>
                  {safeQty.toLocaleString()} available
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div 
                  className={`h-full rounded-full ${isHealthy ? 'bg-emerald-500' : isLow ? 'bg-red-500' : 'bg-amber-500'}`} 
                  style={{ width: `${Math.min(stockRatio * 100, 100)}%` }}
                />
              </div>
              {isLow && <p className="text-[9px] text-red-500 font-bold mt-1">Warning: Insufficient to fulfill entire order.</p>}
            </>
          )}
        </div>
      </div>

      <button 
        onClick={onAccept}
        disabled={isResolving || isOutOfStock}
        className={`w-full mt-auto py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 focus:outline-none border relative z-10 ${
          isOutOfStock
            ? 'bg-slate-100 text-slate-400 border-transparent cursor-not-allowed'
            : 'bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 border-blue-200 hover:border-blue-600 shadow-sm'
        }`}
      >
        {isResolving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isOutOfStock ? 'No Stock Available' : 'Accept Alternative'}
      </button>
    </div>
  );
});

// ============================================================================
// SUB-COMPONENT: MOBILE LINE ITEM CARD
// ============================================================================
const MobileLineItemCard = React.memo(({ line, isQuoteLocked, resolvingId, onResolve, liveAlts, isSearching }: LineItemRowProps) => {
  const needsResolution = line.status !== 'MATCHED' && line.user_decision === 'PENDING' && !isQuoteLocked;
  const isResolving = resolvingId === line.id;

  const formattedLiveAlts = useMemo(() => liveAlts.map((alt: any) => ({
    inventory_id: alt.id, 
    mpn: alt.part_number,
    manufacturer: alt.manufacturer,
    unit_cost: alt.unit_cost,
    available_qty: alt.available_qty
  })), [liveAlts]);

  const displayAlternatives = useMemo(() => {
    const raw = formattedLiveAlts.length > 0 ? formattedLiveAlts : (line.alternatives || []);
    return [...raw].sort((a, b) => {
      const aInStock = (a.available_qty || 0) > 0 ? 1 : 0;
      const bInStock = (b.available_qty || 0) > 0 ? 1 : 0;
      if (aInStock !== bInStock) return bInStock - aInStock; 
      return (a.unit_cost || 0) - (b.unit_cost || 0);
    });
  }, [formattedLiveAlts, line.alternatives]);

  const handleDropItem = useCallback(() => {
    onResolve(line.id, undefined, 'REJECTED');
  }, [line.id, onResolve]);

  return (
    <div className={`bg-white rounded-2xl border p-4 shadow-sm ${needsResolution ? 'border-amber-200 ring-1 ring-amber-50' : 'border-slate-200'}`}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="font-mono font-bold text-slate-900 text-sm">{line.requested_mpn}</div>
          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1 flex gap-2">
            <span>Qty: {line.requested_qty?.toLocaleString() || 0}</span>
            {line.unit_cost && <span>• {formatCurrency(line.unit_cost)}/ea</span>}
          </div>
        </div>
        <div>
          {line.status === 'MATCHED' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
          {line.status === 'SHORTAGE' && <AlertTriangle className="w-5 h-5 text-amber-500" />}
          {line.status === 'UNSOURCED' && <XCircle className="w-5 h-5 text-red-500" />}
        </div>
      </div>
      
      {needsResolution && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest flex items-center gap-1.5">
              {isSearching ? <Search className="w-3.5 h-3.5 animate-pulse" /> : <PackageSearch className="w-3.5 h-3.5" />} 
              {isSearching ? 'Searching Nexar...' : 'Select Alternative'}
            </p>
            {!isSearching && displayAlternatives.length > 0 && (
              <button onClick={handleDropItem} disabled={isResolving} className="text-[9px] font-bold text-red-500 hover:text-red-700 bg-red-50 px-2 py-1 rounded focus:outline-none">Drop Item</button>
            )}
          </div>
          
          {isSearching ? (
            <div className="flex justify-center p-6 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : displayAlternatives.length > 0 ? (
            <div className="space-y-3">
              {displayAlternatives.map((alt: any) => (
                <AlternativeCard 
                  key={alt.inventory_id} 
                  alt={alt} 
                  targetQty={line.requested_qty} 
                  isResolving={isResolving}
                  onAccept={() => onResolve(line.id, alt.inventory_id, 'ACCEPTED', alt)}
                />
              ))}
            </div>
          ) : (
             <div className="text-center p-4 border border-dashed border-slate-200 rounded-xl bg-slate-50 mb-3">
               <PackageX className="w-8 h-8 text-slate-300 mx-auto mb-2 opacity-50" />
               <p className="text-[11px] font-bold text-slate-600">No Inventory Found</p>
             </div>
          )}
          
          {!isSearching && displayAlternatives.length === 0 && (
             <button onClick={handleDropItem} disabled={isResolving} className="w-full py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-black rounded-xl shadow-sm">
                Drop Item from Quote
             </button>
          )}
        </div>
      )}
    </div>
  );
});