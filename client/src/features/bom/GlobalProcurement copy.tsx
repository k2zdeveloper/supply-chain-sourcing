import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  ShoppingCart, Search, Filter, Download, ChevronRight, 
  Loader2, Globe, Clock, CheckCircle2, Truck, CreditCard,
  FileText, ArrowUpRight
} from 'lucide-react';

import { useAuthStore } from '@/stores/useAuthStore';
import { formatCurrency } from '@/features/bom/utils';
import type { OrderHistory } from './types';
// Note: Ensure fetchAllTenantOrders is exported from your api.ts
import { fetchAllTenantOrders } from './api';

// ============================================================================
// STRICT TYPES
// ============================================================================
type OrderTab = 'ALL' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED';

// ============================================================================
// COMPONENT
// ============================================================================
export default function GlobalProcurement() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<OrderTab>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const { data: orders = [], isLoading, isError } = useQuery<OrderHistory[], Error>({
    queryKey: ['global_orders', user?.id],
    queryFn: () => fetchAllTenantOrders(user?.id),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 2, // 2 minute cache
  });

  // --- Analytical Engine & Filters ---
  const { filteredOrders, metrics } = useMemo(() => {
    let filtered = orders;

    // 1. Apply Search
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(o => 
        o.id.toLowerCase().includes(q) || 
        o.workspace_id.toLowerCase().includes(q)
      );
    }

    // 2. Apply Tabs (Mapping DB status to UI Tabs)
    if (activeTab === 'PROCESSING') {
      filtered = filtered.filter(o => o.status === 'FINALIZED' || o.status === 'PENDING_APPROVAL');
    } else if (activeTab === 'SHIPPED') {
      filtered = filtered.filter(o => o.status === 'ORDERED' as any); // Assuming 'ORDERED' maps to shipped in transit
    }

    // 3. Rollup Metrics (Always based on ALL orders, not filtered, so KPIs remain stable)
    const totalSpend = orders.reduce((sum, o) => sum + (o.total_value || 0), 0);
    const activeProcessing = orders.filter(o => o.status === 'FINALIZED').length;
    const avgOrderValue = orders.length > 0 ? totalSpend / orders.length : 0;

    return { 
      filteredOrders: filtered, 
      metrics: { totalSpend, activeProcessing, avgOrderValue, totalCount: orders.length } 
    };
  }, [orders, searchTerm, activeTab]);

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
        <h2 className="text-xs font-bold tracking-widest uppercase text-slate-500">Loading Order Ledger...</h2>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 bg-slate-50 min-h-[calc(100vh-3.5rem)] text-slate-900">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 max-w-sm w-full text-center">
          <Globe className="w-10 h-10 text-slate-300 mx-auto mb-4" />
          <h2 className="text-base font-extrabold text-slate-900 mb-1">Ledger Unavailable</h2>
          <p className="text-xs text-slate-500 font-medium">We could not retrieve the procurement history.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out font-sans text-slate-900 pb-12">
      
      {/* HEADER */}
      <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 pb-4 border-b border-slate-200/60">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Procurement Ledger</h1>
          <p className="text-slate-500 text-xs mt-1 font-medium">Track and manage all finalized corporate purchase orders.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-sm px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 focus:outline-none">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
      </header>

      {/* KPI GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-white border border-slate-200/60 p-4 rounded-2xl shadow-sm flex flex-col justify-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5"/> Total PO Spend</p>
          <p className="text-2xl font-black text-slate-900 font-mono tracking-tight">{formatCurrency(metrics.totalSpend)}</p>
        </div>
        <div className="bg-white border border-slate-200/60 p-4 rounded-2xl shadow-sm flex flex-col justify-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5"/> Processing Now</p>
          <p className="text-2xl font-black text-blue-600">{metrics.activeProcessing}</p>
        </div>
        <div className="bg-white border border-slate-200/60 p-4 rounded-2xl shadow-sm flex flex-col justify-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5"/> Total Orders</p>
          <p className="text-2xl font-black text-slate-900">{metrics.totalCount}</p>
        </div>
        <div className="bg-white border border-slate-200/60 p-4 rounded-2xl shadow-sm flex flex-col justify-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><ShoppingCart className="w-3.5 h-3.5"/> Avg. Order Value</p>
          <p className="text-2xl font-black text-slate-900 font-mono tracking-tight">{formatCurrency(metrics.avgOrderValue)}</p>
        </div>
      </div>

      {/* DATAGRID CONTAINER */}
      <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden flex flex-col min-w-0">
        
        {/* Toolbar & Filters */}
        <div className="p-3 md:p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
          
          <div className="flex bg-slate-200/50 p-1 rounded-xl w-full md:w-auto overflow-x-auto custom-scrollbar">
            {(['ALL', 'PROCESSING', 'SHIPPED', 'DELIVERED'] as OrderTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap focus:outline-none ${
                  activeTab === tab 
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search PO or Project ID..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none transition-all shadow-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" 
              />
            </div>
            <button className="p-2 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-50 shadow-sm transition-colors focus:outline-none">
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* Datagrid Body */}
        <div className="flex-1 overflow-x-auto w-full custom-scrollbar min-h-[400px]">
          {filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-20 text-slate-500">
              <ShoppingCart className="w-10 h-10 mb-4 opacity-20 text-slate-400" />
              <p className="text-sm font-extrabold text-slate-900 mb-1">No Orders Found</p>
              <p className="text-xs font-medium">Try adjusting your filters or search terms.</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm whitespace-nowrap min-w-[900px]">
              <thead className="bg-white text-slate-400 text-[10px] uppercase tracking-widest sticky top-0 border-b border-slate-100 font-bold z-10">
                <tr>
                  <th className="px-5 py-3">PO Number</th>
                  <th className="px-5 py-3">Date Executed</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Line Items</th>
                  <th className="px-5 py-3 text-right">Total Amount</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-slate-700">
                {filteredOrders.map(order => {
                  const shortId = order.id.split('-')[0].toUpperCase();
                  const projId = order.workspace_id.split('-')[0].toUpperCase();
                  
                  return (
                    <tr key={order.id} className="hover:bg-slate-50/80 transition-colors group">
                      
                      <td className="px-5 py-3.5">
                        <div className="font-mono font-extrabold text-slate-900 text-xs mb-0.5">PO-{shortId}</div>
                        <div className="text-[10px] text-slate-500 font-medium">PRJ-{projId}</div>
                      </td>
                      
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-xs text-slate-700">
                          {new Date(order.ordered_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        {order.status === 'FINALIZED' ? (
                          <span className="inline-flex items-center gap-1.5 text-blue-700 bg-blue-50 border border-blue-100 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest">
                            <Clock className="w-3 h-3" /> Processing
                          </span>
                        ) : order.status === 'ORDERED' as any ? (
                          <span className="inline-flex items-center gap-1.5 text-purple-700 bg-purple-50 border border-purple-100 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest">
                            <Truck className="w-3 h-3" /> In Transit
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest">
                            <CheckCircle2 className="w-3 h-3" /> Delivered
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="text-xs font-bold text-slate-600 bg-slate-100/50 px-2 py-1 rounded border border-slate-200 inline-block">
                          {order.item_count || 0} Items
                        </div>
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <div className="font-mono font-black text-sm text-slate-900">
                          {formatCurrency(order.total_value || 0)}
                        </div>
                      </td>
                      
                      <td className="px-5 py-3.5 text-right">
                        <button 
                          onClick={() => navigate(`/dashboard/quotes/${order.id}`)}
                          className="opacity-0 group-hover:opacity-100 bg-white hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 text-[10px] font-bold uppercase tracking-wider transition-all inline-flex items-center gap-1.5 focus:outline-none shadow-sm"
                        >
                          View Details <ArrowUpRight className="w-3 h-3" />
                        </button>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}