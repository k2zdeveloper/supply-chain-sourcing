import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  FileText, Search, Filter, Loader2, ArrowDownUp, 
  ExternalLink, Printer, CheckCircle2, Clock, Truck, 
  Package, Inbox
} from 'lucide-react';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/useAuthStore';
import { formatCurrency } from '@/features/bom/utils';

// ============================================================================
// TYPES
// ============================================================================
type PurchaseOrder = {
  id: string;
  po_number: string;
  quote_id: string;
  issue_date: string;
  delivery_date: string | null;
  grand_total: number;
  status: string;
  document_snapshot: any; // Contains requester, vendor, items
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function GlobalProcurement() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Fetch all Purchase Orders for this user
  const { data: orders = [], isLoading } = useQuery<PurchaseOrder[]>({
    queryKey: ['purchase_orders', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error("Unauthorized");
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as PurchaseOrder[];
    },
    enabled: !!user?.id,
  });

  const filteredOrders = useMemo(() => {
    let result = [...orders];

    if (statusFilter !== 'ALL') {
      result = result.filter(o => o.status.toLowerCase() === statusFilter.toLowerCase());
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(o => 
        o.po_number.toLowerCase().includes(q) || 
        (o.document_snapshot?.projectName || '').toLowerCase().includes(q) ||
        (o.document_snapshot?.vendor?.name || '').toLowerCase().includes(q)
      );
    }

    return result;
  }, [orders, searchQuery, statusFilter]);

  const totalSpend = useMemo(() => orders.reduce((sum, o) => sum + o.grand_total, 0), [orders]);

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
        <p className="text-[10px] font-bold tracking-widest uppercase text-slate-500 animate-pulse">Loading Procurement Ledger...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto font-sans text-slate-900 pb-24 h-full flex flex-col animate-in fade-in duration-500">
      
      {/* Header */}
      <header className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Truck className="w-6 h-6 text-blue-600" /> Purchase Orders
          </h1>
          <p className="text-xs font-medium text-slate-500 mt-1">Manage and track all issued procurement contracts.</p>
        </div>
        <div className="flex items-center gap-3 bg-white border border-slate-200/80 px-4 py-2.5 rounded-xl shadow-sm">
          <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center">
            <FileText className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400">Total Committed Spend</p>
            <p className="text-lg font-black tracking-tight text-slate-900">{formatCurrency(totalSpend)}</p>
          </div>
        </div>
      </header>

      {/* Main Card */}
      <div className="bg-white border border-slate-200/80 shadow-sm rounded-2xl flex flex-col flex-1 overflow-hidden min-h-[500px]">
        
        {/* Toolbar */}
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 shrink-0">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search PO Number, Project, or Vendor..." 
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs font-bold text-slate-900 bg-white border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select 
              value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="text-[10px] font-bold text-slate-700 bg-white border border-slate-200/80 rounded-lg px-3 py-2 uppercase tracking-widest outline-none cursor-pointer shadow-sm focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="ISSUED">Issued</option>
              <option value="FULFILLED">Fulfilled</option>
            </select>
          </div>
        </div>

        {/* Data Table */}
        <div className="flex-1 overflow-auto custom-scrollbar">
          {filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 py-20">
              <Inbox className="w-12 h-12 mb-4 opacity-20" />
              <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">No Purchase Orders Found</h3>
              <p className="text-[11px] font-medium text-slate-500 mt-1">You haven't issued any purchase orders yet.</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-white text-slate-400 text-[9px] uppercase tracking-widest sticky top-0 border-b border-slate-200 font-bold z-10">
                <tr>
                  <th className="px-6 py-4">PO Number</th>
                  <th className="px-6 py-4">Date Issued</th>
                  <th className="px-6 py-4">Project / Workspace</th>
                  <th className="px-6 py-4">Vendor</th>
                  <th className="px-6 py-4 text-right">Total Value</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredOrders.map((order) => {
                  const project = order.document_snapshot?.requester?.projectName || 'Corporate Procurement';
                  const vendor = order.document_snapshot?.vendor?.name || 'Authorized Supplier';

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/80 transition-colors group cursor-pointer" onClick={() => navigate(`/dashboard/quotes/${order.quote_id}/po`)}>
                      <td className="px-6 py-4">
                        <span className="font-extrabold tracking-tight text-slate-900 bg-slate-100 border border-slate-200 px-2 py-1 rounded">
                          {order.po_number}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-slate-500 font-bold text-[10px] uppercase tracking-widest">
                          <Clock className="w-3 h-3" /> {order.issue_date}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-900">{project}</td>
                      <td className="px-6 py-4 font-medium text-slate-600">{vendor}</td>
                      <td className="px-6 py-4 text-right font-black text-slate-900 text-sm">
                        {formatCurrency(order.grand_total)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> Issued
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/quotes/${order.quote_id}/po`); }} 
                          className="bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-300 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all shadow-sm focus:outline-none inline-flex items-center gap-1.5"
                        >
                          <ExternalLink className="w-3 h-3" /> View
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