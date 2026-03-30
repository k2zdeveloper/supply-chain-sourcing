import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  TrendingDown, ShieldCheck, Zap, AlertCircle, Loader2, ArrowRight, 
  RefreshCcw, Activity, ServerCrash, CheckCircle2, Box, Package,
  Search, SlidersHorizontal, Filter, Download, Wand2, EyeOff, Copy,
  ArrowDownUp, Clock, FolderGit2, AlertTriangle, Check, DollarSign
} from 'lucide-react';

import { useAuthStore } from '@/stores/useAuthStore';
import { fetchBomRecords, fetchBatchedAlternatives, globalSwapComponent, fetchWorkspaces } from '@/features/bom/api';
import { formatCurrency } from '@/features/bom/utils';
import type { BomRecord } from '@/features/bom/types';

// ============================================================================
// CONSTANTS & TYPES
// ============================================================================
const PLATFORM_MARGIN = 1.15; 

type SwapConfirmation = {
  oldPart: any;
  newPart: any;
  reason: 'PRICE' | 'STOCK';
} | null;

type WorkspaceRelation = { name: string };

type ExtendedBomRecord = BomRecord & {
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
export default function CostAnalysis() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  
  const [isForceSyncing, setIsForceSyncing] = useState(false);
  const [swapTarget, setSwapTarget] = useState<SwapConfirmation>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('SAVINGS_DESC');
  const [opportunitiesOnly, setOpportunitiesOnly] = useState(false);
  const [ignoredParts, setIgnoredParts] = useState<Set<string>>(new Set());
  const [copiedMpn, setCopiedMpn] = useState<string | null>(null);
  const [lastScan, setLastScan] = useState<Date>(new Date());
  const [isAnimating, setIsAnimating] = useState(false);

  // --- Data Fetching ---
  const { data: workspaces = [] } = useQuery({
    queryKey: ['workspaces', user?.id],
    queryFn: () => fetchWorkspaces(user?.id),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 60, 
  });

  const workspaceMap = useMemo(() => {
    return new Map(workspaces.map((ws: any) => [ws.id, ws.name]));
  }, [workspaces]);

  const { data: bomRecords = [], isLoading: isBomLoading } = useQuery<ExtendedBomRecord[], Error>({
    queryKey: ['bom_records_global', user?.id],
    queryFn: () => fetchBomRecords(null) as Promise<ExtendedBomRecord[]>,
    enabled: !!user?.id,
  });

  // Analytics Base
  const baseCostDrivers = useMemo(() => {
    return [...bomRecords]
      .sort((a, b) => {
        const costA = ((Number(a.target_price) || 0) * PLATFORM_MARGIN) * (Number(a.quantity) || 1);
        const costB = ((Number(b.target_price) || 0) * PLATFORM_MARGIN) * (Number(b.quantity) || 1);
        return costB - costA;
      })
      .slice(0, 30);
  }, [bomRecords]);

  const mpnsToAnalyze = useMemo(() => baseCostDrivers.map(p => p.mpn), [baseCostDrivers]);

  const { data: batchedAlts = {}, isLoading: isAltsLoading, isError: isAltsError, error: altsError } = useQuery({
    queryKey: ['batched_alts', mpnsToAnalyze],
    queryFn: () => fetchBatchedAlternatives(mpnsToAnalyze, false),
    enabled: mpnsToAnalyze.length > 0,
    staleTime: Infinity, 
  });

  // --- Advanced Data Processing ---
  const processedData = useMemo(() => {
    return baseCostDrivers.map(part => {
      const alts = batchedAlts[part.mpn] || [];
      const validPricedAlts = alts.filter((a: any) => Number(a.unit_cost) > 0);
      const validStockAlts = alts.filter((a: any) => Number(a.available_qty) > 0 && Number(a.unit_cost) > 0);

      const bestPrice = validPricedAlts.length > 0 
        ? [...validPricedAlts].sort((a, b) => Number(a.unit_cost) - Number(b.unit_cost))[0] : null;
        
      const bestStock = validStockAlts.length > 0 
        ? [...validStockAlts].sort((a, b) => Number(b.available_qty) - Number(a.available_qty))[0] : null;

      const baseTargetPrice = Number(part.target_price) || 0;
      const displayTargetPrice = baseTargetPrice > 0 ? baseTargetPrice * PLATFORM_MARGIN : 0;
      const bestUnitCost = bestPrice ? Number(bestPrice.unit_cost) : 0;
      const hasTargetPrice = displayTargetPrice > 0;
      
      const savingsPercent = hasTargetPrice && bestUnitCost > 0 ? (((displayTargetPrice - bestUnitCost) / displayTargetPrice) * 100) : 0;
      const absoluteSavings = hasTargetPrice && bestUnitCost > 0 ? ((displayTargetPrice - bestUnitCost) * (part.quantity || 1)) : 0;
      const isSavings = savingsPercent > 0;

      return {
        ...part, bestPrice, bestStock, displayTargetPrice, hasTargetPrice, 
        bestUnitCost, savingsPercent, absoluteSavings, isSavings,
        workspaceName: workspaceMap.get(part.workspace_id) || 'Unknown Workspace'
      };
    });
  }, [baseCostDrivers, batchedAlts, workspaceMap]);

  // --- KPI Calculators ---
  const { totalSpend, potentialSavings, partsAtRisk } = useMemo(() => {
    let spend = 0; let savings = 0; let risk = 0;
    processedData.forEach(p => {
      spend += (p.displayTargetPrice * (p.quantity || 1));
      if (p.isSavings && !ignoredParts.has(p.id)) savings += p.absoluteSavings;
      if ((p.global_stock || 0) < (p.quantity || 1)) risk += 1;
    });
    return { totalSpend: spend, potentialSavings: savings, partsAtRisk: risk };
  }, [processedData, ignoredParts]);

  // --- Filtering & Sorting ---
  const displayList = useMemo(() => {
    let result = processedData.filter(p => !ignoredParts.has(p.id));

    if (opportunitiesOnly) {
      result = result.filter(p => p.isSavings);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(p => 
        p.mpn.toLowerCase().includes(q) || 
        p.manufacturer.toLowerCase().includes(q) || 
        p.workspaceName.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'SAVINGS_DESC': return b.absoluteSavings - a.absoluteSavings;
        case 'COST_DESC': return (b.displayTargetPrice * (b.quantity || 1)) - (a.displayTargetPrice * (a.quantity || 1));
        case 'QTY_DESC': return (b.quantity || 0) - (a.quantity || 0);
        case 'MPN_ASC': return a.mpn.localeCompare(b.mpn);
        default: return 0;
      }
    });

    return result;
  }, [processedData, ignoredParts, opportunitiesOnly, searchQuery, sortBy]);

  // --- Actions ---
  const handleForceSync = async () => {
    if (mpnsToAnalyze.length === 0) return;
    setIsAnimating(true);
    setIsForceSyncing(true);
    try {
      const freshData = await fetchBatchedAlternatives(mpnsToAnalyze, true);
      queryClient.setQueryData(['batched_alts', mpnsToAnalyze], freshData);
      setLastScan(new Date());
    } catch (error) {
      console.error("Sync failed:", error);
    } finally {
      setIsForceSyncing(false);
      setTimeout(() => setIsAnimating(false), 800);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMpn(text);
    setTimeout(() => setCopiedMpn(null), 2000);
  };

  const { mutate: executeSwap, isPending: isSwapping } = useMutation({
    mutationFn: (args: { oldMpn: string, newPart: any }) => 
      globalSwapComponent(user!.id, args.oldMpn, args.newPart.part_number, args.newPart.manufacturer, args.newPart.available_qty || 0),
    onMutate: async ({ oldMpn, newPart }) => {
      setSwapTarget(null);
      await queryClient.cancelQueries({ queryKey: ['bom_records_global', user?.id] });
      const previousBom = queryClient.getQueryData<ExtendedBomRecord[]>(['bom_records_global', user?.id]);
      
      queryClient.setQueryData(['bom_records_global', user?.id], (old: ExtendedBomRecord[] | undefined) => {
        if (!old) return old;
        return old.map(record => {
          if (record.mpn === oldMpn) {
            return { ...record, mpn: newPart.part_number, manufacturer: newPart.manufacturer, target_price: newPart.unit_cost, global_stock: newPart.available_qty || 0 };
          }
          return record;
        });
      });
      return { previousBom };
    },
    onError: (err: Error, variables, context) => {
      if (context?.previousBom) queryClient.setQueryData(['bom_records_global', user?.id], context.previousBom);
      alert(`Swap Failed: ${err.message}`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['bom_records_global', user?.id] });
    }
  });

  const handleBulkSwap = () => {
    const opportunities = displayList.filter(p => p.isSavings && p.bestPrice);
    if (opportunities.length === 0) return alert("No active arbitrage opportunities to apply.");
    if (window.confirm(`Are you sure you want to bulk swap ${opportunities.length} components to save ${formatCurrency(potentialSavings)}?`)) {
      opportunities.forEach(op => executeSwap({ oldMpn: op.mpn, newPart: op.bestPrice }));
    }
  };

  if (isBomLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] bg-slate-50 font-sans">
        <div className="relative flex items-center justify-center w-16 h-16 mb-5">
          <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping duration-1000" />
          <div className="absolute inset-2 bg-blue-500/30 rounded-full animate-pulse duration-700" />
          <Loader2 className="w-6 h-6 animate-spin text-blue-600 relative z-10" />
        </div>
        <h2 className="text-[10px] font-bold tracking-widest uppercase text-slate-500 animate-pulse">Compiling Cost Data</h2>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto font-sans text-slate-900 pb-24 relative flex flex-col h-full min-h-[calc(100vh-4rem)] animate-in fade-in duration-500 overflow-hidden">
      
      {/* CONFIRMATION MODAL */}
      {swapTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden border border-slate-200 p-6">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-5 border border-blue-100">
              <RefreshCcw className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-extrabold text-slate-900 mb-2 tracking-tight">Confirm Global Swap</h3>
            <p className="text-xs font-medium text-slate-500 mb-6">Update Master BOM and replace component across all workspaces.</p>
            <div className="bg-slate-50 rounded-xl border border-slate-200/60 p-3 mb-6 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Replacing</p>
                  <p className="text-xs font-extrabold tracking-tight text-slate-900 truncate">{swapTarget.oldPart.mpn}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
                <div className="flex-1 min-w-0 text-right">
                  <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest mb-1">New Part</p>
                  <p className="text-xs font-extrabold tracking-tight text-emerald-700 truncate">{swapTarget.newPart.part_number}</p>
                </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setSwapTarget(null)} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors focus:outline-none">Cancel</button>
              <button onClick={() => executeSwap({ oldMpn: swapTarget.oldPart.mpn, newPart: swapTarget.newPart })} className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all focus:outline-none active:scale-95">Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* --- TOP BAR: HEADER & KPIS --- */}
      <div className="mb-6 shrink-0 animate-in fade-in slide-in-from-top-4 duration-500 ease-out">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2.5">
              <TrendingDown className="w-6 h-6 text-blue-600" /> Cost Intelligence
            </h1>
            <p className="text-xs font-medium text-slate-500 mt-1.5 flex items-center gap-2 max-w-xl">
              AI-driven arbitrage monitoring. 
              <span className="flex items-center gap-1 text-[9px] uppercase tracking-wider font-bold text-slate-400 bg-slate-200/40 px-1.5 py-0.5 rounded-full border border-slate-200/80 shadow-sm transition-all duration-300">
                <Clock className="w-2.5 h-2.5"/> Synced: {lastScan.toLocaleTimeString()}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <button onClick={() => alert("CSV Export Triggered")} className="flex-1 md:flex-none bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-lg text-xs font-bold transition-all duration-300 shadow-sm hover:shadow-md flex items-center justify-center gap-1.5 active:scale-95 focus:outline-none"><Download className="w-3.5 h-3.5" /> Export</button>
            <button onClick={handleForceSync} disabled={isForceSyncing} className="flex-1 md:flex-none bg-slate-900 hover:bg-black text-white px-5 py-2.5 rounded-lg text-xs font-bold transition-all duration-300 shadow-sm hover:shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-95 focus:outline-none focus:ring-4 focus:ring-slate-900/20">
              {isForceSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className={`w-3.5 h-3.5 ${isAnimating ? 'animate-spin' : ''}`} />} 
              {isForceSyncing ? 'Syncing...' : 'Live Sync'}
            </button>
          </div>
        </div>

        {/* Feature 5, 6, 7: KPI Dash */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Total Target Spend</p>
              <p className="font-black tracking-tight text-2xl text-slate-900">{formatCurrency(totalSpend)}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100"><DollarSign className="w-5 h-5 text-slate-400" /></div>
          </div>
          
          <div className="bg-emerald-50 border border-emerald-200/60 rounded-2xl p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-between relative overflow-hidden group">
            <div className="relative z-10">
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-1 flex items-center gap-1"><Zap className="w-3 h-3 fill-emerald-600" /> Potential Savings</p>
              <p className="font-black tracking-tight text-2xl text-emerald-700">{formatCurrency(potentialSavings)}</p>
            </div>
            <button onClick={handleBulkSwap} className="relative z-10 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-sm active:scale-95 transition-all focus:outline-none"><Wand2 className="w-3 h-3" /> Apply All</button>
            <Zap className="absolute -right-2 -bottom-2 w-20 h-20 text-emerald-100/50 rotate-12 pointer-events-none transition-transform duration-500 group-hover:scale-110" />
          </div>
          
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1">Shortage Risk</p>
              <p className="font-black tracking-tight text-2xl text-amber-600">{partsAtRisk} <span className="text-sm text-slate-400 font-semibold">Parts</span></p>
            </div>
            <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center border border-amber-100"><AlertTriangle className="w-5 h-5 text-amber-500" /></div>
          </div>
        </div>
      </div>

      {/* --- COMMAND BAR (Search, Filters, Sort) --- */}
      <div className="flex flex-col xl:flex-row gap-3 items-center bg-white border border-slate-200/80 p-3 rounded-xl mb-4 shrink-0 shadow-sm z-20 sticky top-0 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150 fill-mode-both">
        <div className="relative w-full xl:max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" placeholder="Search MPN, Manufacturer, or Project..."
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50/50 border border-slate-200/80 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium text-slate-900 transition-all duration-300 placeholder:text-slate-400"
          />
        </div>
        
        <div className="flex items-center gap-2.5 w-full xl:w-auto overflow-x-auto custom-scrollbar pb-1 xl:pb-0">
          <button 
            onClick={() => setOpportunitiesOnly(!opportunitiesOnly)}
            className={`shrink-0 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all duration-300 flex items-center gap-1.5 focus:outline-none active:scale-95 ${opportunitiesOnly ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-inner' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
          >
            <Filter className={`w-3.5 h-3.5 transition-transform ${opportunitiesOnly ? 'rotate-180 text-emerald-600' : 'text-slate-400'}`} /> Arbitrage Only
          </button>
          
          <div className="relative shrink-0 group">
            <ArrowDownUp className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 transition-colors group-hover:text-blue-500" />
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="pl-7 pr-6 py-2 text-[10px] bg-white hover:bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-slate-700 uppercase tracking-wider appearance-none cursor-pointer transition-all duration-300 shadow-sm">
              <option value="SAVINGS_DESC">Highest Savings</option>
              <option value="COST_DESC">Highest Cost</option>
              <option value="QTY_DESC">Highest Qty</option>
              <option value="MPN_ASC">Alphabetical</option>
            </select>
          </div>

          {(searchQuery || opportunitiesOnly || ignoredParts.size > 0) && (
            <button onClick={() => { setSearchQuery(''); setOpportunitiesOnly(false); setIgnoredParts(new Set()); }} className="shrink-0 text-[10px] font-bold text-slate-400 hover:text-slate-800 px-2 underline decoration-slate-300 underline-offset-4 transition-colors duration-300 focus:outline-none">Clear Filters</button>
          )}
        </div>
      </div>

      {/* --- MAIN DATA LIST --- */}
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 min-h-0 pb-10">
        {displayList.length === 0 ? (
           <div className="p-10 text-center bg-white border border-slate-200/60 rounded-2xl shadow-sm animate-in fade-in duration-500">
             <Activity className="w-8 h-8 text-slate-300 mx-auto mb-3" />
             <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">No components match your filters.</h3>
           </div>
        ) : displayList.map((part, index) => {
          return (
            <div key={part.id} className="bg-white border border-slate-200/80 rounded-xl p-3 sm:p-4 shadow-sm flex flex-col xl:flex-row xl:items-stretch gap-4 hover:border-blue-300 hover:shadow-md transition-all animate-in fade-in slide-in-from-bottom-2" style={{ animationDelay: `${index * 30}ms`, animationFillMode: 'both' }}>
              
              {/* 1. ORIGINAL PART INFO */}
              <div className="flex flex-col justify-between w-full xl:w-[35%] shrink-0 xl:pr-4 xl:border-r border-slate-100 relative group">
                <button onClick={() => setIgnoredParts(prev => new Set(prev).add(part.id))} className="absolute right-0 top-0 p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none" title="Ignore this part"><EyeOff className="w-3.5 h-3.5" /></button>
                
                <div className="flex items-start gap-3 w-[90%]">
                  <BrandLogo name={part.manufacturer} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <h3 className="font-extrabold text-sm text-slate-900 tracking-tight truncate" title={part.mpn}>{part.mpn}</h3>
                      <button onClick={() => handleCopy(part.mpn)} className="text-slate-300 hover:text-blue-500 focus:outline-none active:scale-90 transition-all opacity-0 group-hover:opacity-100"><Copy className="w-3 h-3" /></button>
                      {copiedMpn === part.mpn && <span className="text-[8px] font-bold text-emerald-500 uppercase tracking-widest animate-in zoom-in duration-200">Copied!</span>}
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium flex items-center gap-1.5 truncate">
                      {part.manufacturer} <span className="w-1 h-1 rounded-full bg-slate-300"></span> <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider uppercase">{getCategory(part.mpn)}</span>
                    </p>
                  </div>
                </div>

                <div className="mt-4 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1"><FolderGit2 className="w-3 h-3" /> <span className="truncate max-w-[120px]">{part.workspaceName}</span></span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Qty: {part.quantity}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-bold mb-1">
                    <span className="text-slate-600">Global Stock</span>
                    <span className={(part.global_stock || 0) < (part.quantity || 1) ? 'text-red-600' : 'text-emerald-600'}>{(part.global_stock || 0).toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1 overflow-hidden">
                    <div className={`h-full rounded-full ${(part.global_stock || 0) < (part.quantity || 1) ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(((part.global_stock || 0) / (part.quantity || 1)) * 100, 100)}%` }} />
                  </div>
                </div>
              </div>

              {/* 2. AI ALTERNATIVES */}
              <div className="flex-1 flex flex-col sm:flex-row gap-3 min-w-0">
                {isAltsLoading || isForceSyncing ? (
                  <div className="flex-1 flex items-center justify-center py-2 text-slate-400 bg-slate-50/50 rounded-lg border border-dashed border-slate-200"><Loader2 className="w-4 h-4 animate-spin mr-2" /><span className="text-[10px] font-bold uppercase tracking-widest">Scanning...</span></div>
                ) : (!part.bestPrice && !part.bestStock) ? (
                  <div className="flex-1 flex items-center justify-center py-2 text-slate-400 bg-slate-50/50 rounded-lg border border-dashed border-slate-200"><span className="text-xs font-semibold">No direct alternatives found.</span></div>
                ) : (
                  <>
                    {/* BEST VALUE */}
                    {part.bestPrice && (
                      <div className={`flex-1 flex flex-col justify-between p-3 rounded-lg border ${part.isSavings ? 'bg-emerald-50/30 border-emerald-200/60' : 'bg-slate-50/50 border-slate-200/60'}`}>
                        <div className="flex justify-between items-start mb-2">
                          <div className="min-w-0 pr-2">
                            <p className={`text-[9px] font-extrabold uppercase tracking-widest mb-0.5 flex items-center gap-1 ${part.isSavings ? 'text-emerald-600' : 'text-slate-500'}`}>
                              <Zap className={`w-3 h-3 ${part.isSavings ? 'fill-emerald-500 text-emerald-500' : 'text-slate-400'}`} /> Best Price
                            </p>
                            <p className="font-extrabold tracking-tight text-xs text-slate-900 truncate" title={part.bestPrice.part_number}>{part.bestPrice.part_number}</p>
                            <p className="text-[9px] text-slate-500 font-medium truncate flex items-center gap-1 mt-0.5">
                              <BrandLogo name={part.bestPrice.manufacturer} /> {part.bestPrice.manufacturer}
                            </p>
                          </div>
                          <div className="shrink-0 text-right flex flex-col items-end">
                            <span className="text-[9px] font-bold text-slate-600 bg-slate-200/50 border border-slate-200 px-1.5 py-0.5 rounded flex items-center gap-1 mb-1">
                              <Package className="w-2.5 h-2.5" /> {(Number(part.bestPrice.available_qty) || 0).toLocaleString()}
                            </span>
                            <span className="text-[8px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-1 rounded-sm uppercase tracking-wider">99% Match</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-200/60">
                          <div className="flex items-baseline gap-1.5 relative group/tooltip">
                            <span className="font-black tracking-tight text-sm text-slate-900">{formatCurrency(part.bestUnitCost)}</span>
                            {part.hasTargetPrice && (
                              <span className={`text-[10px] font-bold cursor-help ${part.isSavings ? 'text-emerald-600' : 'text-amber-600'}`}>
                                {part.isSavings ? `Save ${part.savingsPercent.toFixed(1)}%` : `+${Math.abs(part.savingsPercent).toFixed(1)}%`}
                              </span>
                            )}
                            {part.isSavings && (
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover/tooltip:block bg-slate-900 text-white text-[9px] font-bold py-0.5 px-2 rounded whitespace-nowrap z-50 animate-in fade-in">
                                Saves {formatCurrency(part.absoluteSavings)} total
                              </div>
                            )}
                          </div>
                          <button 
                            onClick={() => setSwapTarget({ oldPart: part, newPart: part.bestPrice, reason: 'PRICE' })}
                            disabled={isSwapping}
                            className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all active:scale-95 flex items-center gap-1 focus:outline-none ${part.isSavings ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'}`}
                          >
                            Swap <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* HIGHEST STOCK */}
                    {part.bestStock && part.bestStock.id !== part.bestPrice?.id && (
                      <div className="flex-1 flex flex-col justify-between p-3 rounded-lg border bg-blue-50/30 border-blue-200/60">
                        <div className="flex justify-between items-start mb-2">
                          <div className="min-w-0 pr-2">
                            <p className="text-[9px] font-extrabold uppercase tracking-widest mb-0.5 flex items-center gap-1 text-blue-600">
                              <ShieldCheck className="w-3 h-3 text-blue-500" /> High Stock
                            </p>
                            <p className="font-extrabold tracking-tight text-xs text-slate-900 truncate" title={part.bestStock.part_number}>{part.bestStock.part_number}</p>
                            <p className="text-[9px] text-slate-500 font-medium truncate flex items-center gap-1 mt-0.5">
                              <BrandLogo name={part.bestStock.manufacturer} /> {part.bestStock.manufacturer}
                            </p>
                          </div>
                          <div className="shrink-0 text-right flex flex-col items-end">
                            <span className="text-[9px] font-bold text-blue-700 bg-blue-100/60 border border-blue-200/50 px-1.5 py-0.5 rounded flex items-center gap-1 mb-1">
                              <Package className="w-2.5 h-2.5" /> {(Number(part.bestStock.available_qty) || 0).toLocaleString()}
                            </span>
                            <span className="text-[8px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-1 rounded-sm uppercase tracking-wider">Active</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-auto pt-2 border-t border-blue-200/50">
                          <div className="flex items-baseline gap-1.5">
                            <span className="font-black tracking-tight text-sm text-slate-900">{formatCurrency(Number(part.bestStock.unit_cost))}</span>
                          </div>
                          <button 
                            onClick={() => setSwapTarget({ oldPart: part, newPart: part.bestStock, reason: 'STOCK' })}
                            disabled={isSwapping}
                            className="px-3 py-1.5 rounded-md text-[10px] font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all active:scale-95 flex items-center gap-1 focus:outline-none"
                          >
                            Swap <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
              
            </div>
          );
        })}
      </div>
    </div>
  );
}