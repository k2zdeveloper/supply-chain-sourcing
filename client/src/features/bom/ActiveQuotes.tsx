import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Clock, AlertTriangle, CheckCircle2, ChevronRight, 
  Package, ShieldAlert, ArrowUpRight, Loader2, Inbox, 
  XCircle, RefreshCcw, Check, X, Ban, Eye, ArrowLeft,
  Zap, Search, ListFilter, ArrowDownUp, CalendarDays
} from 'lucide-react';
import { formatCurrency } from '@/features/bom/utils';
import { useAuthStore } from '@/stores/useAuthStore';
import { fetchActiveQuotes, finalizeQuote, rejectQuote } from './api';
import type { QuoteLineItem } from './types';

// ============================================================================
// STRICT TYPES
// ============================================================================
type WorkspaceRelation = { name: string };

type ActiveQuotePayload = {
  id: string;
  status: string;
  total_value: number;
  ordered_at: string;
  workspace: WorkspaceRelation | WorkspaceRelation[] | null;
  line_items: QuoteLineItem[];
};

type AppNotification = { 
  title: string; 
  message: string; 
  type: 'error' | 'success'; 
};

type ConfirmState = {
  isOpen: boolean;
  action: 'APPROVE' | 'DECLINE';
  quoteId: string;
} | null;

// ============================================================================
// UTILS
// ============================================================================
const getWorkspaceName = (workspace: WorkspaceRelation | WorkspaceRelation[] | null) => {
  if (!workspace) return 'Unnamed Project';
  if (Array.isArray(workspace)) return workspace[0]?.name || 'Unnamed Project';
  return workspace.name || 'Unnamed Project';
};

const getTrueQuoteTotal = (quote: ActiveQuotePayload) => {
  return quote.line_items.reduce((acc, item) => {
    if (item.status === 'UNSOURCED' || item.user_decision === 'REJECTED') return acc;
    return acc + ((item.unit_cost || 0) * item.requested_qty);
  }, 0);
};

const hasQuoteShortage = (quote: ActiveQuotePayload) => {
  return quote.line_items.some(l => l.status !== 'MATCHED' && l.user_decision === 'PENDING');
};

// ============================================================================
// COMPONENT
// ============================================================================
export default function ActiveQuotes() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // --- States ---
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [notification, setNotification] = useState<AppNotification | null>(null);
  const [confirmModal, setConfirmModal] = useState<ConfirmState>(null);
  
  // Quotes List Controls
  const [quoteSearch, setQuoteSearch] = useState<string>('');
  const [quoteSort, setQuoteSort] = useState<string>('DATE_DESC');

  // Line Items Controls
  const [itemSearch, setItemSearch] = useState<string>('');
  const [itemSort, setItemSort] = useState<string>('STATUS');
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);

  const showNotification = useCallback((title: string, message: string, type: 'error' | 'success' = 'error') => {
    setNotification({ title, message, type });
    setTimeout(() => setNotification(null), 5000);
  }, []);

  // --- Real Data Fetching ---
  const { data: quotes = [], isLoading, isError, refetch } = useQuery<ActiveQuotePayload[], Error>({
    queryKey: ['active_quotes', user?.id],
    queryFn: () => fetchActiveQuotes(user?.id) as Promise<ActiveQuotePayload[]>,
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 2, 
  });

  useEffect(() => {
    if (quotes.length > 0 && !selectedQuoteId && window.innerWidth >= 1024) {
      setSelectedQuoteId(quotes[0].id);
    }
  }, [quotes, selectedQuoteId]);

  useEffect(() => {
    setItemSearch(''); 
  }, [selectedQuoteId]);

  const selectedQuote = useMemo(() => quotes.find(q => q.id === selectedQuoteId), [quotes, selectedQuoteId]);

  // --- Search & Sort: Quotes List ---
  const filteredAndSortedQuotes = useMemo(() => {
    let result = [...quotes];

    if (quoteSearch.trim()) {
      const query = quoteSearch.toLowerCase().trim();
      result = result.filter(q => {
        const name = getWorkspaceName(q.workspace).toLowerCase();
        const shortId = `qt-${q.id.split('-')[0].toLowerCase()}`;
        return name.includes(query) || shortId.includes(query);
      });
    }

    result.sort((a, b) => {
      switch (quoteSort) {
        case 'DATE_DESC': return new Date(b.ordered_at).getTime() - new Date(a.ordered_at).getTime();
        case 'DATE_ASC': return new Date(a.ordered_at).getTime() - new Date(b.ordered_at).getTime();
        case 'VALUE_DESC': return getTrueQuoteTotal(b) - getTrueQuoteTotal(a);
        case 'VALUE_ASC': return getTrueQuoteTotal(a) - getTrueQuoteTotal(b);
        case 'STATUS': 
          const aShort = hasQuoteShortage(a) ? 1 : 0;
          const bShort = hasQuoteShortage(b) ? 1 : 0;
          return bShort - aShort; 
        default: return 0;
      }
    });

    return result;
  }, [quotes, quoteSearch, quoteSort]);

  // --- Search & Sort: Line Items ---
  const filteredAndSortedLineItems = useMemo(() => {
    if (!selectedQuote) return [];
    
    let result = [...selectedQuote.line_items];

    if (itemSearch.trim()) {
      const query = itemSearch.toLowerCase().trim();
      result = result.filter(item => item.requested_mpn.toLowerCase().includes(query));
    }

    result.sort((a, b) => {
      switch (itemSort) {
        case 'MPN_ASC': return a.requested_mpn.localeCompare(b.requested_mpn);
        case 'PRICE_DESC': return ((b.unit_cost || 0) * b.requested_qty) - ((a.unit_cost || 0) * a.requested_qty);
        case 'PRICE_ASC': return ((a.unit_cost || 0) * a.requested_qty) - ((b.unit_cost || 0) * b.requested_qty);
        case 'STATUS':
          const getStatusRank = (item: QuoteLineItem) => {
            if (item.user_decision === 'REJECTED') return 4;
            if (item.status === 'UNSOURCED') return 1;
            if (item.status === 'SHORTAGE') return 2;
            return 3; // MATCHED
          };
          return getStatusRank(a) - getStatusRank(b);
        default: return 0;
      }
    });

    return result;
  }, [selectedQuote, itemSearch, itemSort]);

  const searchSuggestions = useMemo(() => {
    if (!selectedQuote || !itemSearch.trim()) return [];
    const query = itemSearch.toLowerCase().trim();
    return selectedQuote.line_items
      .map(i => i.requested_mpn)
      .filter(mpn => mpn.toLowerCase().includes(query) && mpn.toLowerCase() !== query)
      .slice(0, 5);
  }, [selectedQuote, itemSearch]);

  const calculatedTotal = selectedQuote ? getTrueQuoteTotal(selectedQuote) : 0;
  const needsAttention = selectedQuote ? hasQuoteShortage(selectedQuote) : false;

  const renderAvailableStock = (item: any) => {
    let displayAvailable = 0;
    let availableColor = 'text-slate-500';

    if (item.user_decision === 'REJECTED' || item.status === 'UNSOURCED') {
        displayAvailable = 0;
        availableColor = 'text-slate-400';
    } else if (item.status === 'MATCHED') {
        displayAvailable = item.fulfilled_qty || item.requested_qty;
        availableColor = 'text-emerald-600';
    } else if (item.alternatives && item.alternatives.length > 0) {
        displayAvailable = Math.max(...item.alternatives.map((a:any) => a.available_qty || 0));
        availableColor = 'text-amber-600';
    }

    return <span className={availableColor}>{displayAvailable.toLocaleString()}</span>;
  };

  // --- Mutations ---
  const approveMutation = useMutation({
    mutationFn: (id: string) => finalizeQuote(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active_quotes'] });
      showNotification('Quote Approved', 'The purchase order has been generated.', 'success');
      setConfirmModal(null);
      const remaining = quotes.filter(q => q.id !== selectedQuoteId);
      setSelectedQuoteId(remaining.length > 0 && window.innerWidth >= 1024 ? remaining[0].id : null);
    },
    onError: (err: Error) => {
      showNotification('Approval Failed', err.message, 'error');
      setConfirmModal(null);
    }
  });

  const declineMutation = useMutation({
    mutationFn: (id: string) => rejectQuote(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active_quotes'] });
      showNotification('Quote Declined', 'The quotation was rejected and archived.', 'success');
      setConfirmModal(null);
      const remaining = quotes.filter(q => q.id !== selectedQuoteId);
      setSelectedQuoteId(remaining.length > 0 && window.innerWidth >= 1024 ? remaining[0].id : null);
    },
    onError: (err: Error) => {
      showNotification('Decline Failed', err.message, 'error');
      setConfirmModal(null);
    }
  });

  // --- UI States (Loading & Error) ---
  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
        <h2 className="text-[11px] font-bold tracking-widest uppercase text-slate-500">Retrieving Quotations...</h2>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] bg-slate-50 p-4">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 text-center max-w-sm w-full">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5 ring-1 ring-red-100">
            <ShieldAlert className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Connection Error</h2>
          <p className="text-sm text-slate-500 mb-8 leading-relaxed">
            We couldn't connect to the server to retrieve your quotes. Please verify your connection.
          </p>
          <button 
            onClick={() => refetch()} 
            className="w-full bg-slate-900 text-white text-sm font-semibold py-3.5 rounded-xl hover:bg-black transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95"
          >
            <RefreshCcw className="w-4 h-4" /> Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] animate-in fade-in duration-500 font-sans text-slate-900 bg-slate-50 relative p-3 md:p-5 lg:p-6">
      
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className={`bg-white border-l-4 p-4 rounded-xl shadow-xl min-w-[320px] flex items-start gap-3 ring-1 ring-slate-900/5 ${notification.type === 'success' ? 'border-emerald-500' : 'border-red-500'}`}>
            {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" /> : <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />}
            <div className="flex-1">
              <h3 className="text-sm font-bold text-slate-900">{notification.title}</h3>
              <p className="text-xs text-slate-500 mt-1">{notification.message}</p>
            </div>
            <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-900 transition-colors"><X className="w-4 h-4"/></button>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200/50 p-8">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 ${confirmModal.action === 'APPROVE' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
              {confirmModal.action === 'APPROVE' ? <CheckCircle2 className="w-7 h-7" /> : <Ban className="w-7 h-7" />}
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-3 tracking-tight">
              {confirmModal.action === 'APPROVE' ? 'Approve Quotation' : 'Decline Quotation'}
            </h3>
            <p className="text-sm text-slate-500 mb-8 leading-relaxed">
              {confirmModal.action === 'APPROVE' 
                ? 'This will instantly finalize the quote and move the approved items into your active procurement pipeline.' 
                : 'This will permanently reject this quotation and archive it. You will need to request a new quote to proceed.'}
            </p>
            <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
              <button 
                onClick={() => setConfirmModal(null)}
                className="w-full sm:w-auto px-6 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors focus:outline-none"
              >
                Cancel
              </button>
              <button 
                onClick={() => confirmModal.action === 'APPROVE' ? approveMutation.mutate(confirmModal.quoteId) : declineMutation.mutate(confirmModal.quoteId)}
                disabled={approveMutation.isPending || declineMutation.isPending}
                className={`w-full sm:w-auto px-6 py-3 text-sm font-semibold text-white rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 focus:outline-none ${
                  confirmModal.action === 'APPROVE' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {(approveMutation.isPending || declineMutation.isPending) ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                {confirmModal.action === 'APPROVE' ? 'Confirm Approval' : 'Yes, Decline'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GLOBAL HEADER */}
      <header className="mb-4 lg:mb-6 shrink-0 flex items-end justify-between px-1">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Quotation Inbox</h1>
          <p className="text-slate-500 text-xs mt-1 font-medium">Review supplier pricing, resolve stock shortages, and approve purchase orders.</p>
        </div>
      </header>

      {/* RESPONSIVE MASTER-DETAIL LAYOUT */}
      <div className="flex-1 flex min-h-0 relative gap-5">
        
        {/* LEFT PANE: Quote List (Master) */}
        <div className={`w-full lg:w-[320px] flex-col bg-white border border-slate-200/60 rounded-3xl shadow-sm shrink-0 overflow-hidden ${selectedQuoteId ? 'hidden lg:flex' : 'flex'}`}>
          
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col gap-3 shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                <Inbox className="w-4 h-4" /> Pending Review
              </h2>
              <span className="text-[10px] font-bold text-slate-500 bg-slate-200/50 px-2.5 py-0.5 rounded-full">
                {filteredAndSortedQuotes.length} items
              </span>
            </div>
            
            <div className="flex flex-col gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search project or ID..."
                  value={quoteSearch}
                  onChange={(e) => setQuoteSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-900"
                />
              </div>
              <div className="relative">
                <ArrowDownUp className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <select 
                  value={quoteSort}
                  onChange={(e) => setQuoteSort(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-700 appearance-none cursor-pointer"
                >
                  <option value="DATE_DESC">Newest First</option>
                  <option value="DATE_ASC">Oldest First</option>
                  <option value="VALUE_DESC">Value: High to Low</option>
                  <option value="VALUE_ASC">Value: Low to High</option>
                  <option value="STATUS">Needs Review First</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 rotate-90" />
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2.5 space-y-2 bg-slate-50/30">
            {filteredAndSortedQuotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 p-6 text-center">
                <ListFilter className="w-12 h-12 mb-4 text-slate-300 opacity-80" />
                <h3 className="text-sm font-bold text-slate-900 mb-1.5">No quotes found</h3>
                <p className="text-xs text-slate-500">Adjust your search or sorting criteria.</p>
              </div>
            ) : (
              filteredAndSortedQuotes.map(quote => {
                const isSelected = selectedQuoteId === quote.id;
                const projectName = getWorkspaceName(quote.workspace);
                const shortId = quote.id.split('-')[0].toUpperCase();
                const hasShortage = hasQuoteShortage(quote);
                const quoteTotal = getTrueQuoteTotal(quote);

                return (
                  <button
                    key={quote.id}
                    onClick={() => setSelectedQuoteId(quote.id)}
                    className={`w-full text-left p-4 rounded-xl transition-all outline-none block group ${
                      isSelected 
                        ? 'bg-slate-900 shadow-xl transform scale-[1.02] z-10 relative ring-1 ring-slate-800' 
                        : 'bg-white border border-slate-200/60 hover:border-slate-300 hover:shadow-md hover:-translate-y-px'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md font-mono tracking-widest ${
                        isSelected ? 'bg-slate-800 text-slate-300 border border-slate-700' : 'bg-slate-100 text-slate-500 border border-slate-200/60'
                      }`}>
                        QT-{shortId}
                      </span>
                      <span className={`text-[10px] font-semibold flex items-center gap-1.5 ${isSelected ? 'text-slate-400' : 'text-slate-400'}`}>
                        <Clock className="w-3 h-3" /> {new Date(quote.ordered_at).toLocaleDateString()}
                      </span>
                    </div>
                    
                    <h3 className={`text-sm font-bold truncate mb-4 ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                      {projectName}
                    </h3>
                    
                    <div className="flex justify-between items-end">
                      <div>
                        {hasShortage ? (
                          <span className={`text-[9px] font-bold px-2 py-1 rounded-md flex items-center gap-1.5 w-fit uppercase tracking-wider ${
                            isSelected ? 'bg-amber-500/20 text-amber-200 border border-amber-500/30' : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            <AlertTriangle className="w-3 h-3" /> Action Needed
                          </span>
                        ) : (
                          <span className={`text-[9px] font-bold px-2 py-1 rounded-md flex items-center gap-1.5 w-fit uppercase tracking-wider ${
                            isSelected ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}>
                            <CheckCircle2 className="w-3 h-3" /> Ready to Order
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`font-mono font-bold text-base leading-none ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                          {formatCurrency(quoteTotal)}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT PANE: Quote Details (Detail) */}
        <div className={`flex-1 flex-col bg-white border border-slate-200/60 rounded-3xl shadow-sm overflow-hidden min-w-0 ${selectedQuoteId ? 'flex' : 'hidden lg:flex'}`}>
          
          {selectedQuote ? (
            <>
              {/* --- 1. HEADER (Identity & Totals) --- */}
              <div className="p-5 md:p-6 bg-white shrink-0 z-20 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100">
                <button 
                  onClick={() => setSelectedQuoteId(null)}
                  className="lg:hidden flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-900 focus:outline-none w-fit"
                >
                  <ArrowLeft className="w-3 h-3" /> Back to Quotes
                </button>

                {/* Left: Identity */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold text-slate-500 mb-1.5">
                    <span className="font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/60">
                      QT-{selectedQuote.id.split('-')[0].toUpperCase()}
                    </span>
                    <span className="flex items-center gap-1">
                      <CalendarDays className="w-3 h-3 text-slate-400" />
                      {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(selectedQuote.ordered_at))}
                    </span>
                    <span>•</span>
                    <span>{selectedQuote.line_items.length} Component{selectedQuote.line_items.length !== 1 && 's'}</span>
                  </div>
                  <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight truncate max-w-xl">
                    {getWorkspaceName(selectedQuote.workspace)}
                  </h2>
                </div>
                
                {/* Right: Totals */}
                <div className="text-left md:text-right shrink-0 w-full md:w-auto">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Total Value</p>
                  <p className="text-3xl font-mono font-black text-slate-900 tracking-tighter leading-none">
                    {formatCurrency(calculatedTotal)}
                  </p>
                </div>
              </div>

              {/* --- 2. TOOLBAR (Search, Sort & Actions) --- */}
              <div className="px-5 md:px-6 py-3.5 bg-slate-50/80 border-b border-slate-200/60 flex flex-col xl:flex-row gap-4 justify-between items-center z-10 shrink-0 backdrop-blur-sm">
                
                {/* Prominent Search */}
                <div className="relative w-full xl:max-w-md flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500" />
                  <input 
                    type="text" 
                    placeholder="Search components by MPN..."
                    value={itemSearch}
                    onChange={(e) => {
                      setItemSearch(e.target.value);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm font-medium text-slate-900 placeholder:text-slate-400"
                  />
                  {showSuggestions && searchSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200/80 rounded-xl shadow-xl z-50 overflow-hidden py-1 animate-in fade-in slide-in-from-top-2">
                      {searchSuggestions.map(suggestion => (
                        <div 
                          key={suggestion}
                          onClick={() => {
                            setItemSearch(suggestion);
                            setShowSuggestions(false);
                          }}
                          className="px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer font-mono transition-colors"
                        >
                          {suggestion}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right side: Sort + Actions */}
                <div className="flex flex-wrap items-center gap-2.5 w-full xl:w-auto shrink-0 justify-end">
                  
                  {/* Compact Sort */}
                  <div className="relative w-full sm:w-auto shrink-0">
                    <ArrowDownUp className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <select 
                      value={itemSort}
                      onChange={(e) => setItemSort(e.target.value)}
                      className="w-full sm:w-auto pl-8 pr-7 py-2.5 text-[11px] bg-white hover:bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500/20 transition-all font-bold text-slate-600 appearance-none cursor-pointer shadow-sm"
                    >
                      <option value="STATUS">Priority</option>
                      <option value="PRICE_DESC">High Value</option>
                      <option value="PRICE_ASC">Low Value</option>
                      <option value="MPN_ASC">A-Z</option>
                    </select>
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                      <ChevronRight className="w-3 h-3 text-slate-400 rotate-90" />
                    </div>
                  </div>

                  <div className="w-px h-5 bg-slate-200 hidden sm:block mx-1"></div>

                  {/* Small Action Buttons */}
                  <button 
                    onClick={() => navigate(`/dashboard/quotes/${selectedQuote.id}`)}
                    className="flex-1 sm:flex-none bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3 py-2 rounded-xl text-[11px] font-bold transition-all shadow-sm focus:outline-none flex items-center justify-center gap-1.5 active:scale-95"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-400" /> Details
                  </button>
                  
                  <button 
                    onClick={() => setConfirmModal({ isOpen: true, action: 'DECLINE', quoteId: selectedQuote.id })}
                    className="flex-1 sm:flex-none bg-white hover:bg-red-50 text-red-600 border border-slate-200 hover:border-red-200 px-3 py-2 rounded-xl text-[11px] font-bold transition-all shadow-sm focus:outline-none active:scale-95"
                  >
                    Decline
                  </button>
                  
                  {needsAttention ? (
                    <button 
                      onClick={() => navigate(`/dashboard/quotes/${selectedQuote.id}`)}
                      className="flex-1 sm:flex-none w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm focus:outline-none active:scale-95"
                    >
                      Resolve <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button 
                      onClick={() => setConfirmModal({ isOpen: true, action: 'APPROVE', quoteId: selectedQuote.id })}
                      className="flex-1 sm:flex-none w-full sm:w-auto bg-slate-900 hover:bg-black text-white px-4 py-2 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm focus:outline-none active:scale-95"
                    >
                      <Check className="w-3.5 h-3.5" /> Approve
                    </button>
                  )}
                </div>
              </div>

              {/* --- 3. DATA TABLE --- */}
              <div className="flex-1 overflow-auto custom-scrollbar bg-white relative">
                {filteredAndSortedLineItems.length === 0 ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 p-8 text-center bg-slate-50/30">
                    <ListFilter className="w-12 h-12 mb-4 opacity-20 text-slate-400" />
                    <p className="text-base font-bold text-slate-900">No parts found</p>
                    <p className="text-sm mt-1.5 font-medium">Adjust your search or sorting criteria to see results.</p>
                  </div>
                ) : (
                  <table className="w-full text-left text-sm whitespace-nowrap min-w-[800px]">
                    <thead className="bg-white/90 text-slate-400 text-[10px] uppercase tracking-widest sticky top-0 border-b border-slate-200/80 font-bold z-10 backdrop-blur-md">
                      <tr>
                        <th className="px-5 py-3 pl-6">Component Info</th>
                        <th className="px-5 py-3 text-right">Requested</th>
                        <th className="px-5 py-3 text-right">Available</th>
                        <th className="px-5 py-3 text-center">Status</th>
                        <th className="px-5 py-3 text-right">Unit Price</th>
                        <th className="px-5 py-3 pr-6 text-right">Total Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {filteredAndSortedLineItems.map((item, idx) => {
                        const isShortage = item.status === 'SHORTAGE' || item.status === 'UNSOURCED';
                        const isRejected = item.user_decision === 'REJECTED';

                        return (
                          <tr key={item.id || idx} className={`hover:bg-slate-50/80 transition-colors group ${isRejected ? 'opacity-50 grayscale bg-slate-50/40' : ''}`}>
                            <td className="px-5 py-3.5 pl-6">
                              <div className={`font-mono font-bold text-xs mb-1 ${isRejected ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                                {item.requested_mpn}
                              </div>
                              {item.alternatives && item.alternatives.length > 0 && isShortage && !isRejected && (
                                <span className="inline-flex items-center gap-1.5 text-[10px] text-blue-600 font-bold bg-blue-50/80 border border-blue-100/50 px-2 py-0.5 rounded-md mt-0.5">
                                  <Zap className="w-3 h-3 fill-blue-600" /> {item.alternatives.length} Alts Found
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-3.5 text-right font-medium text-slate-600 text-xs">
                              {item.requested_qty?.toLocaleString() || 0}
                            </td>
                            <td className="px-5 py-3.5 text-right font-mono font-bold text-xs">
                              {renderAvailableStock(item)}
                            </td>
                            <td className="px-5 py-3.5 flex justify-center items-center h-full">
                              {isRejected ? (
                                 <span className="inline-flex items-center gap-1.5 text-slate-500 bg-slate-100 border border-slate-200/60 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest"><X className="w-3.5 h-3.5" /> Dropped</span>
                              ) : (
                                <>
                                  {item.status === 'MATCHED' && <span className="inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-100/50 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest"><CheckCircle2 className="w-3.5 h-3.5" /> In Stock</span>}
                                  {item.status === 'SHORTAGE' && <span className="inline-flex items-center gap-1.5 text-amber-700 bg-amber-50 border border-amber-100/50 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest"><AlertTriangle className="w-3.5 h-3.5" /> Shortage</span>}
                                  {item.status === 'UNSOURCED' && <span className="inline-flex items-center gap-1.5 text-red-700 bg-red-50 border border-red-100/50 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest"><XCircle className="w-3.5 h-3.5" /> Out of Stock</span>}
                                </>
                              )}
                            </td>
                            <td className="px-5 py-3.5 text-right font-mono text-slate-500 text-xs">
                              {item.unit_cost ? formatCurrency(item.unit_cost) : '-'}
                            </td>
                            <td className={`px-5 py-3.5 pr-6 text-right font-mono font-bold text-sm ${isRejected ? 'text-slate-400' : 'text-slate-900'}`}>
                              {item.unit_cost ? formatCurrency(item.unit_cost * item.requested_qty) : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center bg-slate-50/30">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-6 shadow-sm border border-slate-100">
                <Package className="w-10 h-10 text-slate-300" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">No Quote Selected</h3>
              <p className="text-sm font-medium text-slate-500 max-w-md leading-relaxed">
                Select a quotation from the list on the left to review pricing, resolve shortages, and approve orders.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}