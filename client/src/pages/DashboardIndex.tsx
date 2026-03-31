import { memo, useCallback, useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/useAuthStore';
import { timeAgo } from '@/lib/utils';
import { 
  Activity, AlertTriangle, 
  Globe, Cpu, BarChart3, UploadCloud, Newspaper, ArrowRight, ShoppingCart, Loader2, Clock, ShoppingBag,
  Search, CheckSquare, CreditCard, Truck, Calendar, ExternalLink, Folder,
  MapPin, Star, MoreVertical, Copy, Filter, ArrowDownUp, Zap,
  CheckCircle2, FileText
} from 'lucide-react';

// ============================================================================
// STRICT ENTERPRISE TYPES
// ============================================================================
export type PipelinePhase = 'SOURCING' | 'ALTERNATES' | 'QUOTE_READY' | 'PAID' | 'ORDERED' | 'REJECTED';

type BomPipelineSummary = {
  id: string; // The unified route ID
  workspaceId: string;
  quoteId?: string;
  poId?: string;
  poNumber?: string;
  projectName: string; 
  partCount: number; 
  quotedValue: number; 
  phase: PipelinePhase; 
  pendingAlternates: number;
  createdAt: string;
  lastUpdated: string;
};

type NewsArticle = {
  id: string; 
  category: string; 
  headline: string; 
  summary: string; 
  created_at: string;
  url: string;
};

type DashboardMetrics = {
  total_boms: number;
  procured_boms: number;
  parts_in_cart: number;
  total_spend: number;
  avg_turnaround_hours: number;
};

// ============================================================================
// FORMATTERS & UTILS
// ============================================================================
const formatCurrency = (val: number) => 
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact' }).format(val);

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

// ============================================================================
// UNIFIED DATA FETCHERS (Supabase Direct Integration)
// ============================================================================
const fetchMetrics = async (tenantId: string | undefined): Promise<DashboardMetrics> => {
  if (!tenantId) throw new Error('Unauthorized');
  const { data, error } = await supabase.rpc('get_dashboard_metrics', { tenant_uuid: tenantId });
  if (error) throw new Error(error.message);
  return data as DashboardMetrics;
};

const fetchUnifiedPipeline = async (userId: string | undefined): Promise<BomPipelineSummary[]> => {
  if (!userId) throw new Error('Unauthorized');

  // 1. Parallel fetch all relevant tables to construct the complete pipeline
  const [wsRes, bomRes, quoteRes, poRes] = await Promise.all([
    supabase.from('workspaces').select('id, name, created_at, updated_at').eq('tenant_id', userId),
    supabase.from('bom_records').select('workspace_id, target_price, quantity').eq('tenant_id', userId),
    supabase.from('procurement_orders').select('id, workspace_id, total_value, status, updated_at').eq('tenant_id', userId),
    supabase.from('purchase_orders').select('id, quote_id, po_number, status, grand_total, updated_at').eq('user_id', userId),
  ]);

  if (wsRes.error) throw new Error(wsRes.error.message);

  // 2. Fetch Quote Line Items for Shortage tracking
  let allLines: any[] = [];
  if (quoteRes.data && quoteRes.data.length > 0) {
    const quoteIds = quoteRes.data.map(q => q.id);
    const { data: lines } = await supabase.from('quote_line_items').select('quote_id, status, user_decision').in('quote_id', quoteIds);
    if (lines) allLines = lines;
  }

  // 3. Map into Unified Pipeline View
  return wsRes.data.map(ws => {
    const boms = bomRes.data?.filter(b => b.workspace_id === ws.id) || [];
    const quote = quoteRes.data?.find(q => q.workspace_id === ws.id);
    const po = quote ? poRes.data?.find(p => p.quote_id === quote.id) : null;
    const qLines = quote ? allLines.filter(l => l.quote_id === quote.id) : [];

    const partCount = boms.length;
    let estValue = boms.reduce((acc, b) => acc + ((b.target_price || 0) * b.quantity), 0);

    let phase: PipelinePhase = 'SOURCING';
    let pendingAlternates = 0;
    let quotedValue = estValue;
    let routeId = ws.id; 
    let lastUpdated = ws.updated_at;

    // Highest Priority: Purchase Order Exists
    if (po) {
      phase = po.status === 'issued' ? 'PAID' : 'ORDERED';
      quotedValue = po.grand_total;
      routeId = po.quote_id; // Route using quote_id to hit /quotes/:id/po
      lastUpdated = po.updated_at;
    } 
    // Medium Priority: Quotation Exists
    else if (quote) {
      routeId = quote.id;
      quotedValue = quote.total_value;
      lastUpdated = quote.updated_at;
      
      if (quote.status === 'REJECTED') {
         phase = 'REJECTED';
      } else if (quote.status === 'FINALIZED') {
         phase = 'QUOTE_READY';
      } else {
         const hasShortages = qLines.some(l => l.status !== 'MATCHED' && l.user_decision === 'PENDING');
         phase = hasShortages ? 'ALTERNATES' : 'QUOTE_READY';
         pendingAlternates = qLines.filter(l => l.status !== 'MATCHED' && l.user_decision === 'PENDING').length;
      }
    }

    return {
      id: routeId,
      workspaceId: ws.id,
      quoteId: quote?.id,
      poId: po?.id,
      poNumber: po?.po_number,
      projectName: ws.name,
      partCount,
      quotedValue,
      phase,
      pendingAlternates,
      createdAt: ws.created_at,
      lastUpdated
    };
  });
};

const fetchNews = async (): Promise<NewsArticle[]> => {
  try {
    const response = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent('https://epsnews.com/feed/')}`);
    if (!response.ok) throw new Error('Gateway degraded.');
    const data = await response.json();
    return data.items.slice(0, 5).map((item: any) => ({
      id: item.guid || item.link,
      category: item.categories?.[0] || 'Market Update',
      headline: item.title,
      summary: item.description.replace(/<[^>]*>?/gm, '').substring(0, 110) + '...', 
      created_at: item.pubDate,
      url: item.link
    }));
  } catch (err) {
    return [];
  }
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function DashboardIndex() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  
  const greeting = getGreeting();
  const userName = user?.user_metadata?.full_name?.split(' ')[0] || 'there';

  const [searchQuery, setSearchQuery] = useState('');
  const [phaseFilter, setPhaseFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<string>('DATE_DESC');
  const [pinnedProjects, setPinnedProjects] = useState<Set<string>>(new Set());
  const [newsFilter, setNewsFilter] = useState<'ALL' | 'MARKET'>('ALL');

  const { data: metrics, isLoading: metricsLoading } = useQuery({ 
    queryKey: ['dashboard_metrics', user?.id], 
    queryFn: () => fetchMetrics(user?.id),
    enabled: !!user?.id,
    staleTime: 60000 
  });

  const { data: pipelines = [], isLoading: pipesLoading } = useQuery({ 
    queryKey: ['pipelines', user?.id], 
    queryFn: () => fetchUnifiedPipeline(user?.id), 
    enabled: !!user?.id,
    staleTime: 30000 
  });

  const { data: news = [], isLoading: newsLoading } = useQuery({ 
    queryKey: ['market-news'], 
    queryFn: fetchNews,
    staleTime: 300000 
  });

  // --- Advanced Filtering Engine ---
  const activePipelines = useMemo(() => {
    let result = pipelines.filter(p => p.phase !== 'REJECTED');

    if (phaseFilter !== 'ALL') {
      result = result.filter(p => p.phase === phaseFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(p => 
        p.projectName.toLowerCase().includes(q) || 
        p.id.toLowerCase().includes(q) ||
        (p.poNumber && p.poNumber.toLowerCase().includes(q))
      );
    }

    result.sort((a, b) => {
      const aPinned = pinnedProjects.has(a.id);
      const bPinned = pinnedProjects.has(b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;

      switch (sortBy) {
        case 'VALUE_DESC': return b.quotedValue - a.quotedValue;
        case 'NAME_ASC': return a.projectName.localeCompare(b.projectName);
        case 'DATE_DESC': default: return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return result;
  }, [pipelines, searchQuery, phaseFilter, sortBy, pinnedProjects]);

  const actionItems = pipelines.reduce((sum, p) => sum + (p.phase !== 'REJECTED' ? p.pendingAlternates : 0), 0);
  const totalActiveValue = activePipelines.reduce((sum, p) => sum + p.quotedValue, 0);

  const togglePin = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPinnedProjects(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto font-sans text-slate-900 pb-24 relative flex flex-col h-full min-h-[calc(100vh-4rem)] animate-in fade-in duration-500 overflow-hidden bg-slate-50/30">
      
      {/* HEADER & CONTEXT */}
      <header className="mb-6 shrink-0 flex flex-col md:flex-row md:items-end justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-500 ease-out">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
            {greeting}, {userName}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 flex items-center gap-1"><MapPin className="w-3 h-3 text-slate-400"/> Nasugbu, Calabarzon</span>
            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 flex items-center gap-1"><Calendar className="w-3 h-3 text-slate-400"/> Mar 31, 2026</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2 bg-white border border-slate-200/80 px-3 py-2 rounded-lg shadow-sm mr-2">
            <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400">Pipeline Value</span>
            <span className="text-xs font-black tracking-tight text-slate-900">{formatCurrency(totalActiveValue)}</span>
          </div>
          <button 
            onClick={() => navigate('/dashboard/projects')} 
            className="w-full md:w-auto bg-slate-900 hover:bg-black text-white px-5 py-2.5 rounded-lg text-xs font-bold transition-all shadow-sm focus:outline-none flex items-center justify-center gap-1.5 active:scale-95 shrink-0"
          >
            <UploadCloud className="w-3.5 h-3.5" /> Start New Project
          </button>
        </div>
      </header>

      {/* KPI GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6 shrink-0 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100 fill-mode-both">
        {metricsLoading ? (
          <>
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
          </>
        ) : (
          <>
            <KpiCard title="Total Spent" value={formatCurrency(metrics?.total_spend || 0)} trend="Lifetime" trendLabel="Completed orders" icon={BarChart3} positive={true} />
            <KpiCard title="Projects Ordered" value={`${metrics?.procured_boms || 0} of ${metrics?.total_boms || 0}`} trend="Completion" trendLabel="Successfully executed" icon={Activity} positive={true} />
            <KpiCard title="Ready to Order" value={(metrics?.parts_in_cart || 0).toLocaleString()} trend="In Cart" trendLabel="Awaiting checkout" icon={ShoppingBag} positive={true} />
            <KpiCard title="Avg. Turnaround" value={`${metrics?.avg_turnaround_hours || 0} hrs`} trend="Speed" trendLabel="Upload to PO" icon={Clock} positive={true} alert={(metrics?.avg_turnaround_hours || 0) > 48} />
          </>
        )}
      </div>

      {/* MAIN CONTENT SPLIT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 flex-1 min-h-0">
        
        {/* ACTIVE PROJECTS DATAGRID */}
        <div className="lg:col-span-2 bg-white border border-slate-200/80 shadow-sm rounded-2xl flex flex-col min-h-[500px] overflow-hidden min-w-0 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-200 fill-mode-both">
          
          <div className="px-5 py-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <h2 className="font-extrabold text-slate-900 flex items-center gap-2 text-sm tracking-tight">
                <Cpu className="w-4 h-4 text-blue-600" /> Active Pipeline
              </h2>
              {actionItems > 0 && <span className="text-[9px] font-bold px-2 py-0.5 bg-amber-50 text-amber-700 rounded border border-amber-200 uppercase tracking-widest animate-pulse shadow-sm flex items-center gap-1"><Zap className="w-2.5 h-2.5 fill-amber-500"/> {actionItems} Action Needed</span>}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto custom-scrollbar pb-1 sm:pb-0">
              <div className="relative shrink-0 group">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <input 
                  type="text" placeholder="Search (Cmd+K)" 
                  value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-36 md:w-48 pl-8 pr-3 py-1.5 text-[11px] bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-slate-900 transition-all placeholder:text-slate-400 placeholder:font-medium"
                />
              </div>
              <div className="relative shrink-0">
                <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                <select value={phaseFilter} onChange={(e) => setPhaseFilter(e.target.value)} className="pl-7 pr-6 py-1.5 text-[10px] bg-white border border-slate-200 rounded-md focus:outline-none font-bold text-slate-700 uppercase tracking-wider appearance-none cursor-pointer hover:bg-slate-50">
                  <option value="ALL">All Phases</option>
                  <option value="SOURCING">Workspace Staging</option>
                  <option value="ALTERNATES">Needs Review</option>
                  <option value="QUOTE_READY">Quotation Ready</option>
                  <option value="ORDERED">PO Executed</option>
                </select>
              </div>
              <div className="relative shrink-0">
                <ArrowDownUp className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="pl-7 pr-6 py-1.5 text-[10px] bg-white border border-slate-200 rounded-md focus:outline-none font-bold text-slate-700 uppercase tracking-wider appearance-none cursor-pointer hover:bg-slate-50">
                  <option value="DATE_DESC">Newest</option>
                  <option value="VALUE_DESC">High Value</option>
                  <option value="NAME_ASC">A-Z</option>
                </select>
              </div>
              {(searchQuery || phaseFilter !== 'ALL') && (
                <button onClick={() => {setSearchQuery(''); setPhaseFilter('ALL');}} className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 hover:text-slate-700 px-1 transition-colors">Clear</button>
              )}
            </div>
          </div>
            
          <div className="flex-1 overflow-x-auto w-full custom-scrollbar bg-slate-50/30">
            {pipesLoading ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 py-20">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500 mb-3" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Loading Pipeline...</span>
              </div>
            ) : activePipelines.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 py-20 animate-in fade-in duration-300">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 border border-slate-200 shadow-sm">
                  <Search className="w-6 h-6 text-slate-300" />
                </div>
                <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">No projects found</h3>
                <p className="text-[11px] font-medium text-slate-500 mt-1">Adjust your filters or start a new project.</p>
              </div>
            ) : (
              <>
                <div className="hidden md:block">
                  <table className="w-full text-left text-xs whitespace-nowrap min-w-[700px]">
                    <thead className="bg-white/90 text-slate-400 text-[9px] uppercase tracking-widest sticky top-0 border-b border-slate-200/80 font-bold z-10 backdrop-blur-xl">
                      <tr>
                        <th className="px-5 py-3 pl-6 w-8"></th>
                        <th className="px-5 py-3">Project Ref</th>
                        <th className="px-5 py-3">Pipeline Tracker</th>
                        <th className="px-5 py-3 text-right">Est. Value</th>
                        <th className="px-5 py-3 text-right pr-6">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {activePipelines.map((pipe, idx) => (
                        <PipelineRow 
                          key={pipe.id} 
                          pipeline={pipe} 
                          index={idx} 
                          isPinned={pinnedProjects.has(pipe.id)}
                          onPin={(e) => togglePin(pipe.id, e)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="md:hidden divide-y divide-slate-100 p-2 space-y-2">
                  {activePipelines.map((pipe, idx) => (
                    <MobilePipelineCard 
                      key={pipe.id} 
                      pipeline={pipe} 
                      index={idx}
                      isPinned={pinnedProjects.has(pipe.id)}
                      onPin={(e) => togglePin(pipe.id, e)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* INTELLIGENCE FEED */}
        <div className="bg-white border border-slate-200/80 shadow-sm rounded-2xl flex flex-col min-h-[500px] overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300 fill-mode-both">
          <div className="px-5 py-4 border-b border-slate-100 bg-white flex flex-col gap-3 shrink-0">
            <h2 className="font-extrabold text-slate-900 flex items-center gap-2 text-sm tracking-tight">
              <Newspaper className="w-4 h-4 text-blue-600" /> Market Intelligence
            </h2>
            <div className="flex gap-2">
              <button onClick={() => setNewsFilter('ALL')} className={`px-2.5 py-1 rounded text-[9px] font-bold uppercase tracking-widest transition-all ${newsFilter === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>All</button>
              <button onClick={() => setNewsFilter('MARKET')} className={`px-2.5 py-1 rounded text-[9px] font-bold uppercase tracking-widest transition-all ${newsFilter === 'MARKET' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>Supply Chain</button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3 bg-slate-50/30">
            {newsLoading ? (
              <>
                <NewsSkeleton />
                <NewsSkeleton />
                <NewsSkeleton />
              </>
            ) : news.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <Globe className="w-6 h-6 mb-3 opacity-30 text-slate-300" />
                <p className="text-[11px] font-bold">No intelligence available.</p>
              </div>
            ) : (
              news.map((article, idx) => <NewsItem key={article.id} article={article} index={idx} />)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MICRO-COMPONENTS
// ============================================================================

const CurrentStatusIndicator = memo(({ pipeline }: { pipeline: BomPipelineSummary }) => {
  const navigate = useNavigate();
  const { phase, pendingAlternates, lastUpdated, workspaceId, quoteId } = pipeline;
  
  const getStatusConfig = () => {
    switch (phase) {
      case 'SOURCING': return { icon: Search, label: 'Draft Project', color: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-200/60' };
      case 'ALTERNATES': return { icon: AlertTriangle, label: `${pendingAlternates} Needs Review`, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200/60' };
      case 'QUOTE_READY': return { icon: CheckSquare, label: 'Ready to Order', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200/60' };
      case 'PAID': return { icon: CreditCard, label: 'Processing', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200/60' };
      case 'ORDERED': return { icon: Truck, label: 'PO Executed', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200/60' };
      default: return { icon: Activity, label: 'Pending', color: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-200/60' };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  // Compute Active Step for Interactive Stepper
  let currentStep = 0;
  if (['ALTERNATES', 'QUOTE_READY'].includes(phase)) currentStep = 1;
  if (['PAID', 'ORDERED'].includes(phase)) currentStep = 2;

  // Interactive Route Resolvers
  const steps = [
    { label: 'Staging', route: '/dashboard/projects', active: true },
    { label: 'Quotation', route: quoteId ? `/dashboard/quotes/${quoteId}` : null, active: !!quoteId },
    { label: 'PO', route: quoteId && pipeline.poId ? `/dashboard/quotes/${quoteId}/po` : null, active: !!pipeline.poId }
  ];

  return (
    <div className="flex flex-col gap-3 w-full max-w-[210px]">
      <div className="flex items-center justify-between mb-0.5">
        <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border ${config.bg} ${config.border} ${config.color} text-[9px] font-bold uppercase tracking-widest shadow-sm`}>
          <Icon className="w-2.5 h-2.5" /> {config.label}
        </div>
        <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest">{timeAgo(lastUpdated)}</span>
      </div>
      
      {/* Interactive Visual Stepper */}
      <div className="flex items-center justify-between relative px-2">
        <div className="absolute left-3 right-3 top-1.5 -translate-y-1/2 h-[2px] bg-slate-200 rounded-full z-0">
           <div className="h-full bg-blue-500 rounded-full transition-all duration-700 ease-out" style={{ width: currentStep === 0 ? '0%' : currentStep === 1 ? '50%' : '100%' }} />
        </div>

        {steps.map((step, idx) => {
          const isPast = idx < currentStep;
          const isCurrent = idx === currentStep;
          const isActive = isPast || isCurrent;
          
          return (
            <div 
              key={step.label} 
              className={`relative z-10 flex flex-col items-center gap-1.5 group ${step.active ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-not-allowed opacity-60'}`}
              onClick={(e) => {
                e.stopPropagation();
                if (step.active && step.route) navigate(step.route);
              }}
              title={step.active ? `Open ${step.label}` : `Pending ${step.label}`}
            >
              <div className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-300 flex items-center justify-center
                ${isPast ? 'bg-blue-500 border-blue-500' : 
                  isCurrent ? 'bg-white border-blue-600 ring-[3px] ring-blue-100 shadow-sm' : 
                  'bg-white border-slate-300'}`}
              >
                {isPast && <CheckCircle2 className="w-2.5 h-2.5 text-white" />}
                {isCurrent && <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse" />}
              </div>
              <span className={`text-[7px] font-extrabold uppercase tracking-widest absolute -bottom-4 whitespace-nowrap
                ${isCurrent ? 'text-slate-900' : isActive ? 'text-slate-500' : 'text-slate-400'}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
      <div className="h-1"></div>
    </div>
  );
});
CurrentStatusIndicator.displayName = 'CurrentStatusIndicator';

const PipelineRow = memo(({ pipeline, index, isPinned, onPin }: { pipeline: BomPipelineSummary, index: number, isPinned: boolean, onPin: (e: any) => void }) => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const shortId = pipeline.workspaceId.split('-')[0].toUpperCase();
  const createdDate = new Date(pipeline.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const handleRouting = useCallback(() => {
    if (pipeline.phase === 'SOURCING') navigate('/dashboard/projects');
    else if (['ORDERED', 'PAID'].includes(pipeline.phase)) navigate(`/dashboard/quotes/${pipeline.quoteId}/po`);
    else navigate(`/dashboard/quotes/${pipeline.quoteId}`);
  }, [navigate, pipeline.phase, pipeline.quoteId]);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(pipeline.poNumber || `PRJ-${shortId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <tr 
      className="hover:bg-slate-50/80 transition-all duration-200 group cursor-pointer bg-white animate-in fade-in slide-in-from-bottom-2 relative"
      onClick={handleRouting}
      style={{ animationDelay: `${index * 30}ms`, animationFillMode: 'both' }}
    >
      <td className="px-5 py-4 pl-6 w-8 text-center">
        <button onClick={onPin} className="focus:outline-none p-1 -ml-1 transition-transform active:scale-90">
          <Star className={`w-4 h-4 transition-colors ${isPinned ? 'fill-amber-400 text-amber-400' : 'text-slate-300 group-hover:text-slate-400'}`} />
        </button>
      </td>
      <td className="px-5 py-4">
        <div className="font-extrabold tracking-tight text-slate-900 text-sm mb-1 truncate max-w-[200px] group-hover:text-blue-600 transition-colors">{pipeline.projectName}</div>
        <div className="flex items-center gap-2">
          {pipeline.poNumber ? (
            <button onClick={handleCopy} className="text-[9px] text-emerald-700 font-black uppercase tracking-widest flex items-center gap-1 hover:bg-emerald-100 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 transition-colors">
              {pipeline.poNumber} {copied ? <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" /> : <Copy className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />}
            </button>
          ) : (
            <button onClick={handleCopy} className="text-[9px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1 hover:text-blue-600 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200/60 transition-colors">
              PRJ-{shortId} {copied ? <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" /> : <Copy className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />}
            </button>
          )}
          <span className="w-1 h-1 rounded-full bg-slate-300"></span>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{createdDate}</span>
        </div>
      </td>

      <td className="px-5 py-4 w-64">
        <CurrentStatusIndicator pipeline={pipeline} />
      </td>

      <td className="px-5 py-4 text-right">
        <div className="font-black tracking-tight text-slate-900 text-sm mb-1">
          {pipeline.quotedValue > 0 ? formatCurrency(pipeline.quotedValue) : <span className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Pending</span>}
        </div>
        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-end gap-1">
          <Cpu className="w-2.5 h-2.5" /> {pipeline.partCount} Components
        </div>
      </td>
      
      <td className="px-5 py-4 text-right pr-6">
        <div className="flex items-center justify-end gap-2">
          
          {/* Direct PO Access Shortcut */}
          {['ORDERED', 'PAID'].includes(pipeline.phase) && pipeline.poId && (
             <button onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/quotes/${pipeline.quoteId}/po`); }} className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-200 text-[9px] font-bold uppercase tracking-wider transition-all inline-flex items-center justify-center gap-1.5 focus:outline-none shadow-sm active:scale-95">
               <FileText className="w-3 h-3" /> View PO
             </button>
          )}

          <button className="bg-white hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200/80 text-[9px] font-bold uppercase tracking-wider transition-all inline-flex items-center justify-center gap-1.5 focus:outline-none shadow-sm active:scale-95">
            {pipeline.phase === 'SOURCING' ? <><Folder className="w-3 h-3 text-blue-600" /> Workspace</> : 
             pipeline.phase === 'ALTERNATES' ? <><ArrowRight className="w-3 h-3 text-amber-600" /> Review</> : 
             pipeline.phase === 'QUOTE_READY' ? <><ShoppingCart className="w-3 h-3 text-blue-600" /> Order</> : 
             <><ArrowRight className="w-3 h-3" /> Details</>}
          </button>
          <button onClick={(e) => {e.stopPropagation(); alert("Action menu opened");}} className="p-1.5 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors opacity-0 group-hover:opacity-100">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
});
PipelineRow.displayName = 'PipelineRow';

const MobilePipelineCard = memo(({ pipeline, index, isPinned, onPin }: { pipeline: BomPipelineSummary, index: number, isPinned: boolean, onPin: (e: any) => void }) => {
  const navigate = useNavigate();
  const shortId = pipeline.workspaceId.split('-')[0].toUpperCase();
  
  const handleRouting = useCallback(() => {
    if (pipeline.phase === 'SOURCING') navigate('/dashboard/projects');
    else if (['ORDERED', 'PAID'].includes(pipeline.phase)) navigate(`/dashboard/quotes/${pipeline.quoteId}/po`);
    else navigate(`/dashboard/quotes/${pipeline.quoteId}`);
  }, [navigate, pipeline.phase, pipeline.quoteId]);

  return (
    <div 
      onClick={handleRouting} 
      className="p-4 bg-white border border-slate-200/60 rounded-xl hover:border-blue-300 hover:shadow-md transition-all cursor-pointer flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2 relative"
      style={{ animationDelay: `${index * 30}ms`, animationFillMode: 'both' }}
    >
      <div className="flex justify-between items-start gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <button onClick={onPin} className="mt-0.5 focus:outline-none active:scale-90 shrink-0">
            <Star className={`w-3.5 h-3.5 ${isPinned ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
          </button>
          <div className="min-w-0">
            <div className="font-extrabold tracking-tight text-slate-900 text-sm truncate">{pipeline.projectName}</div>
            {pipeline.poNumber ? (
               <div className="text-[9px] font-black uppercase tracking-widest text-emerald-600 mt-1">{pipeline.poNumber} • {pipeline.partCount} Parts</div>
            ) : (
               <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-1">PRJ-{shortId} • {pipeline.partCount} Parts</div>
            )}
          </div>
        </div>
        <div className="font-black tracking-tight text-slate-900 text-sm shrink-0">
          {pipeline.quotedValue > 0 ? formatCurrency(pipeline.quotedValue) : <span className="text-slate-400 text-[9px] font-bold uppercase tracking-widest">Pending</span>}
        </div>
      </div>
      <div className="mt-1 pb-2">
        <CurrentStatusIndicator pipeline={pipeline} />
      </div>
    </div>
  );
});
MobilePipelineCard.displayName = 'MobilePipelineCard';

const KpiCard = memo(({ title, value, trend, trendLabel, icon: Icon, positive, alert = false }: any) => (
  <div className={`p-4 rounded-2xl border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-center relative overflow-hidden group ${alert ? 'bg-red-50 border-red-200/60' : 'bg-white border-slate-200/80'}`}>
    <Icon className={`absolute -right-4 -bottom-4 w-24 h-24 transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6 pointer-events-none ${alert ? 'text-red-500/10' : 'text-slate-900/[0.03]'}`} />
    
    <div className="z-10 relative">
      <h3 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">{title}</h3>
      <p className={`text-2xl font-black tracking-tight ${alert ? 'text-red-700' : 'text-slate-900'}`}>{value}</p>
      <div className="flex items-center gap-1.5 mt-3">
        <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider ${positive ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
          {trend}
        </span>
        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest truncate">{trendLabel}</span>
      </div>
    </div>
  </div>
));
KpiCard.displayName = 'KpiCard';

const KpiSkeleton = () => (
  <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm animate-pulse relative overflow-hidden">
    <div className="h-2 bg-slate-100 rounded w-16 mb-3"></div>
    <div className="h-6 bg-slate-100 rounded w-24 mb-4"></div>
    <div className="flex gap-2">
      <div className="h-3 bg-slate-100 rounded w-12"></div>
      <div className="h-3 bg-slate-100 rounded w-20"></div>
    </div>
  </div>
);

const NewsSkeleton = () => (
  <div className="border border-slate-100 bg-white p-4 rounded-2xl shadow-sm animate-pulse">
    <div className="flex justify-between mb-3">
      <div className="h-3 bg-slate-100 rounded w-16"></div>
      <div className="h-2 bg-slate-100 rounded w-10"></div>
    </div>
    <div className="h-3 bg-slate-100 rounded w-[80%] mb-2"></div>
    <div className="h-3 bg-slate-100 rounded w-[60%] mb-3"></div>
    <div className="h-2 bg-slate-50 rounded w-full mb-1"></div>
    <div className="h-2 bg-slate-50 rounded w-[90%]"></div>
  </div>
);

const NewsItem = memo(({ article, index }: { article: NewsArticle, index: number }) => (
  <a 
    href={article.url} 
    target="_blank" 
    rel="noopener noreferrer" 
    className="block group border border-slate-100 bg-white hover:bg-slate-50/80 hover:border-slate-200/80 p-4 rounded-2xl transition-all duration-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300 animate-in fade-in slide-in-from-bottom-2 relative overflow-hidden"
    style={{ animationDelay: `${index * 40}ms`, animationFillMode: 'both' }}
  >
    {index === 0 && <div className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />}

    <div className="flex items-center justify-between mb-2.5">
      <span className="text-[8px] uppercase tracking-widest font-extrabold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
        {article.category}
      </span>
      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1">
        <Clock className="w-2.5 h-2.5" /> {timeAgo(article.created_at)}
      </span>
    </div>
    <h4 className="text-xs font-extrabold tracking-tight text-slate-900 group-hover:text-blue-700 transition-colors leading-snug mb-2 pr-4 relative">
      {article.headline}
      <ExternalLink className="w-3 h-3 absolute right-0 top-0 text-slate-300 opacity-0 group-hover:opacity-100 transition-all duration-300 transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
    </h4>
    <p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed font-medium">{article.summary}</p>
  </a>
));
NewsItem.displayName = 'NewsItem';