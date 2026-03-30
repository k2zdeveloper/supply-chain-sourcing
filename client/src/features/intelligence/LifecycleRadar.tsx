import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Activity, ShieldAlert, AlertTriangle, Cpu, Loader2, 
  RefreshCcw, Radar, ShieldCheck, FileText, 
  Zap, CheckCircle2, X, Search, Filter, ArrowDownUp,
  EyeOff, Copy, ArrowRight, Package, Clock, Check
} from 'lucide-react';

import { useAuthStore } from '@/stores/useAuthStore';
import { fetchLifecycleIntelligence, fetchCrossReferences, globalSwapComponent } from '@/features/bom/api';
import type { BomRecord } from '@/features/bom/types';
import { formatCurrency } from '@/features/bom/utils';

// ============================================================================
// STRICT TYPES
// ============================================================================
type WorkspaceRelation = { name: string };

// ⚡ FIX: Extended the type so TypeScript knows about target_price and stock
type IntelligenceRecord = BomRecord & { 
  workspace: WorkspaceRelation | WorkspaceRelation[] | null;
  target_price?: number | null;
  quantity?: number;
  global_stock?: number;
};

// ============================================================================
// UTILS & MICRO-COMPONENTS
// ============================================================================
const getWorkspaceName = (workspace: WorkspaceRelation | WorkspaceRelation[] | null) => {
  if (!workspace) return 'Unknown Project';
  if (Array.isArray(workspace)) return workspace[0]?.name || 'Unknown Project';
  return workspace.name || 'Unknown Project';
};

const getCategory = (mpn: string) => {
  if (/^(STM|ESP|ATMEGA|PIC|MAX)/i.test(mpn)) return 'MCU';
  if (/^(RC|CC|C0|C1|GRM)/i.test(mpn)) return 'Passive';
  if (/^(LM|TPS|SN|TI)/i.test(mpn)) return 'Power IC';
  return 'Component';
};

const BrandLogo = ({ name }: { name: string }) => {
  const [error, setError] = useState(false);
  const cleanName = name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  
  if (error || !cleanName || cleanName === 'unknown') {
    return (
      <div className="w-5 h-5 rounded bg-slate-100 text-slate-500 flex items-center justify-center text-[9px] font-bold uppercase shrink-0 transition-all duration-300">
        {name.substring(0, 1)}
      </div>
    );
  }
  return (
    <img 
      src={`https://logo.clearbit.com/${cleanName}.com`} 
      alt={name}
      onError={() => setError(true)}
      className="w-5 h-5 rounded object-contain bg-white shrink-0 border border-slate-100 transition-all duration-300 hover:scale-110"
    />
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function LifecycleRadar() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  // --- States ---
  const [resolvingPart, setResolvingPart] = useState<IntelligenceRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('RISK_DESC');
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [ignoredParts, setIgnoredParts] = useState<Set<string>>(new Set());
  const [acknowledgedParts, setAcknowledgedParts] = useState<Set<string>>(new Set());
  const [copiedMpn, setCopiedMpn] = useState<string | null>(null);
  const [lastScan, setLastScan] = useState<Date>(new Date());
  const [isAnimating, setIsAnimating] = useState(false);

  // --- Real Database Sourcing ---
  const { data: rawParts = [], isLoading, refetch } = useQuery<IntelligenceRecord[], Error>({
    queryKey: ['lifecycle_intelligence', user?.id],
    queryFn: () => fetchLifecycleIntelligence(user?.id) as Promise<IntelligenceRecord[]>,
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, 
  });

  const handleRescan = () => {
    setIsAnimating(true);
    setLastScan(new Date());
    refetch().finally(() => setTimeout(() => setIsAnimating(false), 800));
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMpn(text);
    setTimeout(() => setCopiedMpn(null), 2000);
  };

  // --- Advanced Data Processing ---
  const displayList = useMemo(() => {
    let result = rawParts.filter(p => !ignoredParts.has(p.id));

    if (criticalOnly) {
      result = result.filter(p => p.risk_level === 'critical');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(p => 
        p.mpn.toLowerCase().includes(q) || 
        p.manufacturer.toLowerCase().includes(q) || 
        getWorkspaceName(p.workspace).toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'RISK_DESC':
          const riskA = a.risk_level === 'critical' ? 3 : a.risk_level === 'high' ? 2 : 1;
          const riskB = b.risk_level === 'critical' ? 3 : b.risk_level === 'high' ? 2 : 1;
          return riskB - riskA;
        case 'MPN_ASC': return a.mpn.localeCompare(b.mpn);
        case 'STATUS': return a.lifecycle_status.localeCompare(b.lifecycle_status);
        default: return 0;
      }
    });

    return result;
  }, [rawParts, ignoredParts, criticalOnly, searchQuery, sortBy]);

  // --- KPI Metrics ---
  const metrics = useMemo(() => {
    if (!rawParts.length) return { obsolete: 0, nrnd: 0, criticalRisk: 0, affectedProjects: 0, healthScore: 100 };
    
    const obsolete = rawParts.filter(p => p.lifecycle_status === 'Obsolete' || p.lifecycle_status === 'EOL').length;
    const nrnd = rawParts.filter(p => p.lifecycle_status === 'NRND').length;
    const criticalRisk = rawParts.filter(p => p.risk_level === 'critical').length;
    const uniqueProjects = new Set(rawParts.map(p => p.workspace_id));
    
    const penalty = (obsolete * 5) + (nrnd * 2) + (criticalRisk * 3);
    const healthScore = Math.max(0, 100 - penalty);

    return { obsolete, nrnd, criticalRisk, affectedProjects: uniqueProjects.size, healthScore };
  }, [rawParts]);

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] bg-slate-50 font-sans">
        <div className="relative flex items-center justify-center w-16 h-16 mb-5">
          <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping duration-1000" />
          <div className="absolute inset-2 bg-blue-500/30 rounded-full animate-pulse duration-700" />
          <Radar className="w-6 h-6 text-blue-600 relative z-10" />
        </div>
        <h2 className="text-[10px] font-bold tracking-widest uppercase text-slate-500 animate-pulse">Scanning Supply Chain</h2>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto font-sans text-slate-900 pb-24 relative flex flex-col h-full min-h-[calc(100vh-4rem)] animate-in fade-in duration-500 overflow-hidden">
      
      {/* SMART RESOLUTION MODAL */}
      {resolvingPart && (
        <SmartResolutionModal 
          part={resolvingPart} 
          onClose={() => setResolvingPart(null)} 
          onSuccess={() => {
            setResolvingPart(null);
            queryClient.invalidateQueries({ queryKey: ['lifecycle_intelligence'] });
          }}
        />
      )}

      {/* HEADER & CONTROLS */}
      <header className="mb-6 shrink-0 flex flex-col md:flex-row md:items-end justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-500 ease-out">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Activity className="w-7 h-7 text-blue-600" /> Lifecycle Radar
          </h1>
          <p className="text-xs font-medium text-slate-500 mt-1.5 flex items-center gap-2 max-w-xl">
            Predictive obsolescence tracking. 
            <span className="flex items-center gap-1 text-[9px] uppercase tracking-wider font-bold text-slate-400 bg-slate-200/40 px-1.5 py-0.5 rounded-full border border-slate-200/80 shadow-sm transition-all duration-300">
              <Clock className="w-2.5 h-2.5"/> Last Scan: {lastScan.toLocaleTimeString()}
            </span>
          </p>
        </div>
        <button 
          onClick={handleRescan} 
          className="text-[11px] font-bold text-white bg-slate-900 hover:bg-black px-5 py-2.5 rounded-lg transition-all duration-300 shadow-sm hover:shadow-md flex items-center justify-center gap-1.5 active:scale-95 focus:outline-none focus:ring-4 focus:ring-slate-900/20 w-full md:w-auto"
        >
          <RefreshCcw className={`w-3.5 h-3.5 ${isAnimating ? 'animate-spin' : ''}`} /> Rescan Database
        </button>
      </header>

      {/* KPI DASHBOARD */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4 mb-6 shrink-0">
        
        {/* Global Health Score */}
        <div className="col-span-2 lg:col-span-1 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-center relative overflow-hidden group">
          <div className={`absolute right-0 top-0 w-24 h-24 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none transition-all duration-700 ${metrics.healthScore > 80 ? 'bg-emerald-500/20 group-hover:bg-emerald-500/30' : metrics.healthScore > 50 ? 'bg-amber-500/20 group-hover:bg-amber-500/30' : 'bg-red-500/20 group-hover:bg-red-500/30'}`} />
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1 z-10"><Activity className="w-3.5 h-3.5 text-blue-400"/> Global Health</p>
          <div className="flex items-baseline gap-1 relative z-10">
            <p className={`text-3xl font-black tracking-tight transition-colors duration-500 ${metrics.healthScore > 80 ? 'text-emerald-400' : metrics.healthScore > 50 ? 'text-amber-400' : 'text-red-400'}`}>{metrics.healthScore}</p>
            <span className="text-xs font-bold text-slate-500">/100</span>
          </div>
        </div>

        <div className={`p-4 rounded-2xl border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-center ${metrics.obsolete > 0 ? 'bg-red-50 border-red-200/60' : 'bg-white border-slate-200/60'}`}>
          <p className={`text-[9px] font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1.5 ${metrics.obsolete > 0 ? 'text-red-700' : 'text-slate-400'}`}>
            <ShieldAlert className="w-3.5 h-3.5"/> Obsolete / EOL
          </p>
          <p className={`text-2xl font-black tracking-tight ${metrics.obsolete > 0 ? 'text-red-700' : 'text-slate-900'}`}>{metrics.obsolete}</p>
        </div>
        
        <div className={`p-4 rounded-2xl border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-center ${metrics.nrnd > 0 ? 'bg-amber-50 border-amber-200/60' : 'bg-white border-slate-200/60'}`}>
          <p className={`text-[9px] font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1.5 ${metrics.nrnd > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
            <AlertTriangle className="w-3.5 h-3.5"/> NRND Risk
          </p>
          <p className={`text-2xl font-black tracking-tight ${metrics.nrnd > 0 ? 'text-amber-700' : 'text-slate-900'}`}>{metrics.nrnd}</p>
        </div>
        
        <div className="bg-white border border-slate-200/60 p-4 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-center">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-amber-500"/> Critical Flags</p>
          <p className="text-2xl font-black text-slate-900 tracking-tight">{metrics.criticalRisk}</p>
        </div>
        
        <div className="bg-white border border-slate-200/60 p-4 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-center">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-blue-500"/> Projects Affected</p>
          <p className="text-2xl font-black text-slate-900 tracking-tight">{metrics.affectedProjects}</p>
        </div>
      </div>

      {/* COMMAND BAR */}
      <div className="flex flex-col xl:flex-row gap-3 items-center bg-white border border-slate-200/80 p-3 rounded-xl mb-5 shrink-0 shadow-sm z-20 sticky top-0 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150 fill-mode-both">
        <div className="relative w-full xl:max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input 
            type="text" placeholder="Search MPN, Manufacturer, or Project..."
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50/50 border border-slate-200/80 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium text-slate-900 transition-all duration-300 placeholder:text-slate-400"
          />
        </div>
        
        <div className="flex items-center gap-2.5 w-full xl:w-auto overflow-x-auto custom-scrollbar pb-1 xl:pb-0">
          <button 
            onClick={() => setCriticalOnly(!criticalOnly)}
            className={`shrink-0 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all duration-300 flex items-center gap-1.5 focus:outline-none focus:ring-4 focus:ring-red-500/10 active:scale-95 ${criticalOnly ? 'bg-red-50 text-red-700 border-red-200 shadow-inner' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:shadow-sm'}`}
          >
            <Filter className={`w-3.5 h-3.5 transition-transform duration-300 ${criticalOnly ? 'rotate-180 text-red-600' : 'text-slate-400'}`} /> Critical Only
          </button>
          
          <div className="relative shrink-0 group">
            <ArrowDownUp className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 transition-colors group-hover:text-blue-500" />
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="pl-8 pr-8 py-2 text-[10px] bg-white hover:bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-slate-700 uppercase tracking-wider appearance-none cursor-pointer transition-all duration-300 shadow-sm">
              <option value="RISK_DESC">Sort: Highest Risk</option>
              <option value="MPN_ASC">Sort: Alphabetical</option>
              <option value="STATUS">Sort: By Status</option>
            </select>
          </div>

          {(searchQuery || criticalOnly || ignoredParts.size > 0) && (
            <button onClick={() => { setSearchQuery(''); setCriticalOnly(false); setIgnoredParts(new Set()); }} className="shrink-0 text-[11px] font-bold text-slate-400 hover:text-slate-800 px-2 underline decoration-slate-300 underline-offset-4 transition-colors duration-300 focus:outline-none">Clear Filters</button>
          )}
        </div>
      </div>

      {/* DATAGRID */}
      <div className="flex-1 bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden flex flex-col min-w-0 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-300 fill-mode-both">
        <div className="flex-1 overflow-x-auto w-full custom-scrollbar relative">
          {displayList.length === 0 ? (
             <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-50/30">
               <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4 ring-1 ring-emerald-100/50 shadow-inner">
                 <ShieldCheck className="w-8 h-8 text-emerald-500 animate-pulse" />
               </div>
               <h3 className="text-xl font-extrabold text-slate-900 mb-1.5 tracking-tight">Supply Chain is Healthy</h3>
               <p className="text-xs font-medium text-slate-500 max-w-sm leading-relaxed">
                 We scanned your active workspaces. Zero Obsolete, EOL, or NRND components matched your criteria.
               </p>
             </div>
          ) : (
            <table className="w-full text-left text-xs whitespace-nowrap min-w-[900px]">
              <thead className="bg-slate-50/90 text-slate-400 text-[9px] uppercase tracking-widest sticky top-0 border-b border-slate-200/80 font-bold z-10 backdrop-blur-xl">
                <tr>
                  <th className="px-5 py-4 pl-6 w-[30%]">Component Info</th>
                  <th className="px-5 py-4">Lifecycle Status</th>
                  <th className="px-5 py-4 w-40 text-center">Risk Analysis</th>
                  <th className="px-5 py-4">Affected Project</th>
                  <th className="px-5 py-4 text-right pr-6">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {displayList.map((part, index) => {
                  const isDead = part.lifecycle_status === 'Obsolete' || part.lifecycle_status === 'EOL';
                  const isWarning = part.lifecycle_status === 'NRND';
                  const isAck = acknowledgedParts.has(part.id);

                  return (
                    <tr 
                      key={part.id} 
                      className={`hover:bg-slate-50/80 transition-all duration-300 group animate-in fade-in slide-in-from-bottom-2 ${isAck ? 'opacity-40 grayscale hover:grayscale-0 hover:opacity-100' : ''}`} 
                      style={{ animationDelay: `${index * 30}ms`, animationFillMode: 'both' }}
                    >
                      <td className="px-5 py-3.5 pl-6">
                        <div className="flex items-center gap-3">
                          <BrandLogo name={part.manufacturer} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="font-extrabold text-slate-900 text-xs tracking-tight truncate" title={part.mpn}>{part.mpn}</span>
                              <button onClick={() => handleCopy(part.mpn)} className="text-slate-300 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-all focus:outline-none active:scale-90"><Copy className="w-3 h-3" /></button>
                              {copiedMpn === part.mpn && <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-100 uppercase tracking-widest animate-in zoom-in duration-200">Copied</span>}
                            </div>
                            <p className="text-[10px] text-slate-500 font-medium flex items-center gap-1.5 truncate">
                              {part.manufacturer} 
                              <span className="w-1 h-1 rounded-full bg-slate-300"></span> 
                              <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider uppercase">{getCategory(part.mpn)}</span>
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        {isDead && <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 border border-red-100 px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest shadow-sm"><ShieldAlert className="w-3 h-3" /> {part.lifecycle_status}</span>}
                        {isWarning && <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest shadow-sm"><AlertTriangle className="w-3 h-3" /> NRND</span>}
                        {!isDead && !isWarning && <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{part.lifecycle_status}</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex justify-center w-full">
                          {part.risk_level === 'critical' ? (
                            <div className="w-full max-w-[100px]">
                              <span className="text-[9px] font-black text-red-600 uppercase tracking-widest flex items-center gap-1.5 mb-1.5"><div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse"/> Critical</span>
                              <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden"><div className="bg-gradient-to-r from-red-400 to-red-600 h-full rounded-full w-[90%]"></div></div>
                            </div>
                          ) : part.risk_level === 'high' ? (
                            <div className="w-full max-w-[100px]">
                              <span className="text-[9px] font-black text-orange-600 uppercase tracking-widest flex items-center gap-1.5 mb-1.5"><div className="w-1.5 h-1.5 rounded-full bg-orange-500"/> High</span>
                              <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden"><div className="bg-orange-500 h-full rounded-full w-[60%]"></div></div>
                            </div>
                          ) : (
                            <div className="w-full max-w-[100px]">
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1.5"><div className="w-1.5 h-1.5 rounded-full bg-slate-300"/> Low</span>
                              <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden"><div className="bg-slate-300 h-full rounded-full w-[20%]"></div></div>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[11px] font-bold text-slate-700 bg-slate-50 px-2 py-1 rounded-md border border-slate-200/60 truncate max-w-[180px] w-fit">
                            {getWorkspaceName(part.workspace)}
                          </span>
                          <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest ml-1">Impacted</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right pr-6">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => setIgnoredParts(prev => new Set(prev).add(part.id))} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-md opacity-0 group-hover:opacity-100 transition-all focus:outline-none" title="Ignore this alert"><EyeOff className="w-3.5 h-3.5"/></button>
                          
                          {isAck ? (
                            <button onClick={() => { const newSet = new Set(acknowledgedParts); newSet.delete(part.id); setAcknowledgedParts(newSet); }} className="bg-slate-100 hover:bg-slate-200 text-slate-500 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors focus:outline-none">Acknowledged <Check className="w-3 h-3"/></button>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => setAcknowledgedParts(prev => new Set(prev).add(part.id))} className="text-[9px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest px-1.5 py-1 transition-colors focus:outline-none opacity-0 group-hover:opacity-100">Ack Risk</button>
                              <button 
                                onClick={() => setResolvingPart(part)}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all inline-flex items-center gap-1.5 focus:outline-none focus:ring-4 focus:ring-blue-500/20 shadow-sm active:scale-95"
                              >
                                Auto-Resolve <Zap className="w-3 h-3 fill-blue-300 text-blue-300" />
                              </button>
                            </div>
                          )}
                        </div>
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

// ============================================================================
// MICRO-COMPONENT: SMART RESOLUTION MODAL
// ============================================================================
const SmartResolutionModal = ({ part, onClose, onSuccess }: { part: IntelligenceRecord, onClose: () => void, onSuccess: () => void }) => {
  const { user } = useAuthStore();
  const [copiedMpn, setCopiedMpn] = useState(false);

  const { data: crossRefs = [], isLoading } = useQuery({
    queryKey: ['cross_refs', part.mpn],
    queryFn: () => fetchCrossReferences(part.mpn),
  });

  const { mutate: executeSwap, isPending } = useMutation({
    mutationFn: (newPart: any) => globalSwapComponent(user!.id, part.mpn, newPart.part_number, newPart.manufacturer, newPart.available_qty || 0),
    onSuccess: () => onSuccess(),
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(part.mpn);
    setCopiedMpn(true);
    setTimeout(() => setCopiedMpn(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-300 font-sans">
      <div className="bg-white rounded-[1.5rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-300 ring-1 ring-white/10 flex flex-col max-h-[90vh]">
        
        <div className="p-5 md:p-6 border-b border-slate-100 bg-white flex justify-between items-start shrink-0 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-600"></div>
          <div className="relative z-10">
            <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-2.5 mb-1.5 tracking-tight">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-100"><Zap className="w-4 h-4 text-blue-600 fill-blue-600/20" /></div> Smart Resolution
            </h3>
            <div className="text-xs font-medium text-slate-500 flex flex-wrap items-center gap-1.5">
              Replacing <span className="font-extrabold tracking-tight text-slate-900 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200/80 shadow-sm flex items-center gap-1 transition-all">{part.mpn} <button onClick={handleCopy} className="focus:outline-none"><Copy className="w-3 h-3 text-slate-400 hover:text-blue-600 transition-colors"/></button></span>
              {copiedMpn && <span className="text-[8px] font-bold uppercase tracking-widest text-emerald-600 animate-in fade-in">Copied!</span>}
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full focus:outline-none transition-colors relative z-10"><X className="w-4 h-4"/></button>
        </div>

        <div className="p-5 md:p-6 overflow-y-auto custom-scrollbar bg-slate-50/50 flex-1">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Activity className="w-3 h-3"/> Compatible Replacements</p>
          
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200 shadow-sm">
              <Loader2 className="w-6 h-6 animate-spin mb-3 text-blue-500" />
              <p className="text-[10px] font-bold uppercase tracking-widest animate-pulse">Searching Inventory...</p>
            </div>
          ) : crossRefs.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200 shadow-sm px-5">
              <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-3 border border-amber-100"><AlertTriangle className="w-6 h-6 text-amber-500" /></div>
              <p className="text-base font-bold text-slate-900 mb-1">No drop-in replacements found.</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">We couldn't find a direct cross-reference. You may need to manually source a new component.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {crossRefs.map((ref: any, idx: number) => {
                const isHealthyStock = ref.available_qty > 1000;
                const targetPriceValue = part.target_price || 0;
                const priceDelta = (ref.unit_cost || 0) - targetPriceValue;
                
                return (
                  <div key={ref.id || idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border border-slate-200/80 hover:border-blue-300 hover:shadow-sm transition-all duration-200 bg-white gap-3 group animate-in fade-in slide-in-from-bottom-2" style={{ animationDelay: `${idx * 30}ms`, animationFillMode: 'both' }}>
                    <div className="flex items-start gap-2.5">
                      <BrandLogo name={ref.manufacturer} />
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="font-extrabold text-slate-900 text-sm tracking-tight">{ref.part_number}</span>
                          <span className="text-[8px] font-bold text-blue-700 bg-blue-50 border border-blue-200/60 px-1.5 py-0.5 rounded uppercase tracking-widest flex items-center gap-1"><CheckCircle2 className="w-2.5 h-2.5"/> 99% Match</span>
                        </div>
                        <p className="text-[10px] font-medium text-slate-500 mb-1.5">{ref.manufacturer}</p>
                        <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-md ${isHealthyStock ? 'bg-emerald-50 text-emerald-700 border border-emerald-100/60' : 'bg-amber-50 text-amber-700 border border-amber-100/60'}`}>
                          <Package className="w-2.5 h-2.5" /> {ref.available_qty.toLocaleString()} in stock
                        </span>
                      </div>
                    </div>
                    <div className="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 border-slate-100 pt-3 sm:pt-0 gap-2 w-full sm:w-auto">
                      <div className="text-left sm:text-right">
                        <span className="font-black tracking-tight text-lg text-slate-900 block">{formatCurrency(ref.unit_cost)}</span>
                        {targetPriceValue > 0 && (
                           <span className={`text-[9px] font-bold uppercase tracking-wider ${priceDelta <= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                             {priceDelta <= 0 ? 'Saves ' : 'Costs '}{formatCurrency(Math.abs(priceDelta))}
                           </span>
                        )}
                      </div>
                      <button 
                        onClick={() => executeSwap(ref)}
                        disabled={isPending}
                        className="bg-slate-900 text-white hover:bg-blue-600 px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-sm focus:outline-none flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 w-full sm:w-auto mt-1"
                      >
                        {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : 'Swap'} <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};