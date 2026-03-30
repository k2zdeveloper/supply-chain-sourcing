import { useState, useMemo, memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { supabase } from '@/lib/supabase';
import { 
  Search, Loader2, History, Package, CreditCard, Truck, 
  ArrowRight, Download, Filter, Receipt, Calendar, Box, 
  CheckCircle2
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

type OrderStatus = 'processing' | 'paid' | 'shipped' | 'delivered';

interface OrderHistoryRecord {
  id: string;
  project_name: string;
  total_value: number;
  item_count: number;
  status: OrderStatus;
  ordered_at: string;
  tracking_number?: string;
}

// --- Formatter ---
const formatCurrency = (val: number) => 
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

const formatDate = (dateString: string) => 
  new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// ============================================================================
// DATA FETCHER
// ============================================================================
// Note: Adjust this RPC call or use your existing `useBomData` hook if you prefer
const fetchOrderHistory = async (tenantId: string | undefined): Promise<OrderHistoryRecord[]> => {
  if (!tenantId) return [];
  // Fallback gracefully if the RPC doesn't exist yet while you're building
  try {
    const { data, error } = await supabase.rpc('get_order_history', { tenant_uuid: tenantId });
    if (error) throw error;
    return data as OrderHistoryRecord[] || [];
  } catch (err) {
    console.warn("Order history endpoint not found. Returning empty state.");
    return [];
  }
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function GlobalProcurement() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['order_history', user?.id],
    queryFn: () => fetchOrderHistory(user?.id),
    enabled: !!user?.id,
  });

  const filteredOrders = useMemo(() => {
    if (!searchTerm) return orders;
    const q = searchTerm.toLowerCase();
    return orders.filter(o => 
      o.project_name.toLowerCase().includes(q) || 
      o.id.toLowerCase().includes(q)
    );
  }, [orders, searchTerm]);

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-6rem)] bg-white rounded-[2rem] shadow-sm border border-gray-200 font-sans relative overflow-hidden animate-in fade-in duration-500 ring-1 ring-gray-900/5">
      
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-8 py-8 shrink-0 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <GlobeBackground />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 border border-purple-100 text-[10px] font-bold text-purple-600 tracking-widest uppercase mb-3">
              <Receipt className="w-3 h-3" /> Procurement Ledger
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">Order History</h1>
            <p className="text-sm text-gray-500 font-medium mt-1.5">Track active shipments, download invoices, and reorder past BOMs.</p>
          </div>

          <div className="flex items-center gap-3">
            <button className="bg-white hover:bg-gray-50 text-gray-600 border border-gray-200 px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-sm focus:outline-none focus:ring-4 focus:ring-gray-100">
              <Filter className="w-4 h-4" /> Filter
            </button>
            <button className="bg-gray-900 hover:bg-black text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-md focus:outline-none focus:ring-4 focus:ring-gray-900/20">
              <Download className="w-4 h-4" /> Export Ledger
            </button>
          </div>
        </div>
      </header>

      {/* Toolbar */}
      <div className="px-8 py-4 border-b border-gray-100 bg-gray-50/50 shrink-0">
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text" 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            placeholder="Search by Project Name or Order ID..." 
            className="w-full bg-white border border-gray-200 focus:border-purple-500 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-900 outline-none transition-all shadow-sm focus:ring-4 focus:ring-purple-500/10" 
          />
        </div>
      </div>

      {/* Main Viewport */}
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-gray-50/30 p-8">
        <div className="max-w-5xl mx-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-32 text-gray-400">
              <Loader2 className="w-10 h-10 animate-spin text-purple-500 mb-4" />
              <span className="text-xs font-bold tracking-widest uppercase">Syncing Ledger...</span>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-32 animate-in fade-in zoom-in-95 duration-500 bg-white rounded-3xl border border-dashed border-gray-200 shadow-sm">
              <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6 ring-1 ring-gray-900/5">
                <Package className="w-10 h-10 text-gray-300" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2 tracking-tight">No Procurement History</h3>
              <p className="text-gray-500 text-sm font-medium max-w-sm mb-6">Orders placed from your Quotation Review will appear here for tracking and accounting.</p>
              <button onClick={() => navigate('/dashboard/projects')} className="bg-gray-900 hover:bg-black text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md focus:outline-none focus:ring-4 focus:ring-gray-900/20">
                Go to Engineering Sandbox
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order, index) => (
                <OrderCard key={order.id} order={order} index={index} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MICRO-COMPONENTS
// ============================================================================

const OrderCard = memo(({ order, index }: { order: OrderHistoryRecord, index: number }) => {
  return (
    <div 
      className="bg-white border border-gray-200 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm hover:shadow-md transition-all group animate-in fade-in slide-in-from-bottom-4"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-start gap-5">
        <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
          <History className="w-6 h-6 text-gray-400" />
        </div>
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h3 className="text-lg font-bold text-gray-900 tracking-tight">{order.project_name}</h3>
            <OrderStatusBadge status={order.status} />
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mt-2">
            <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {formatDate(order.ordered_at)}</span>
            <span className="flex items-center gap-1.5"><Box className="w-3.5 h-3.5" /> {order.item_count} Components</span>
            <span className="flex items-center gap-1.5">ID: {order.id.split('-')[0].toUpperCase()}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:items-end gap-4 border-t md:border-t-0 border-gray-100 pt-4 md:pt-0 shrink-0">
        <div className="text-left md:text-right">
          <p className="text-2xl font-light text-gray-900 tracking-tight">{formatCurrency(order.total_value)}</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="text-xs font-bold text-gray-500 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 px-4 py-2 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-gray-200">
            Invoice
          </button>
          <button className="text-xs font-bold text-purple-600 hover:text-white bg-purple-50 hover:bg-purple-600 px-4 py-2 rounded-xl transition-colors flex items-center gap-1.5 focus:outline-none focus:ring-4 focus:ring-purple-500/20">
            Order Details <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
});
OrderCard.displayName = 'OrderCard';

const OrderStatusBadge = memo(({ status }: { status: OrderStatus }) => {
  switch (status) {
    case 'processing':
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-widest border border-blue-100"><Loader2 className="w-3 h-3 animate-spin" /> Processing</span>;
    case 'paid':
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 text-[10px] font-bold uppercase tracking-widest border border-purple-100"><CreditCard className="w-3 h-3" /> Paid</span>;
    case 'shipped':
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 text-[10px] font-bold uppercase tracking-widest border border-amber-100"><Truck className="w-3 h-3" /> Shipped</span>;
    case 'delivered':
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-widest border border-emerald-100"><CheckCircle2 className="w-3 h-3" /> Delivered</span>;
    default:
      return null;
  }
});
OrderStatusBadge.displayName = 'OrderStatusBadge';

// Decorative background SVG for the header
const GlobeBackground = () => (
  <svg width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-gray-900">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="2" y1="12" x2="22" y2="12"></line>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
  </svg>
);