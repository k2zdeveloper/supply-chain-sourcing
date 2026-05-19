import React, { Component, type ErrorInfo, type ReactNode, Suspense, lazy, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ShieldAlert, RefreshCcw, Home, Loader2, Database, Shield, Settings, TerminalSquare } from 'lucide-react';
import * as Sentry from '@sentry/react';

import { useAuthStore } from '@/stores/useAuthStore';
import { createWorkspace, addBomRows } from '@/features/bom/api';
import type { ParsedBomPayload } from '@/features/onboarding/components/QuoteWizard';

// ============================================================================
// ENTERPRISE ROUTE SPLITTING 
// ============================================================================
const LandingPage = lazy(() => import('@/pages/LandingPage'));
const DashboardLayout = lazy(() => import('@/pages/DashboardLayout'));
const DashboardIndex = lazy(() => import('@/pages/DashboardIndex'));

// BOM / Projects
const BomBuilder = lazy(() => import('@/features/bom/BomBuilder'));

// Quotes & Procurement
const ActiveQuotes = lazy(() => import('@/features/bom/ActiveQuotes')); 
const QuoteReviewPage = lazy(() => import('@/features/bom/QuoteReview')); 
const GeneratePO = lazy(() => import('@/features/po/GeneratePO')); 
const GlobalProcurement = lazy(() => import('@/features/bom/GlobalProcurement')); 

// Intelligence Suite
const LifecycleRadar = lazy(() => import('@/features/intelligence/LifecycleRadar'));
const CostAnalysis = lazy(() => import('@/features/intelligence/CostAnalysis'));

// Core & Auth
const QuoteWizard = lazy(() => import('@/features/onboarding/components/QuoteWizard').then(m => ({ default: m.QuoteWizard })));
const ProtectedRoute = lazy(() => import('@/features/auth/components/ProtectedRoute').then(m => ({ default: m.ProtectedRoute })));

// ============================================================================
// FEATURE PLACEHOLDERS (CYBERPUNK THEME)
// ============================================================================
const PlaceholderView = ({ title, icon: Icon, description }: { title: string, icon: React.ElementType, description: string }) => (
  <div className="flex-1 flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] bg-[#020617] rounded-sm border border-dashed border-slate-800 m-4 md:m-6 lg:m-8 animate-in fade-in duration-500 font-mono relative overflow-hidden">
    <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: `linear-gradient(to right, #D4AF37 1px, transparent 1px), linear-gradient(to bottom, #D4AF37 1px, transparent 1px)`, backgroundSize: '32px 32px' }} />
    <div className="w-16 h-16 bg-slate-900 border border-slate-700 rounded-sm flex items-center justify-center mb-6 relative z-10 shadow-[0_0_15px_rgba(0,0,0,0.5)]">
      <Icon className="w-8 h-8 text-slate-500" />
    </div>
    <h2 className="text-xl font-black text-white mb-2 tracking-[0.1em] uppercase relative z-10">{title}</h2>
    <p className="text-slate-500 font-medium text-xs max-w-sm text-center leading-relaxed relative z-10">&gt; {description}</p>
    <div className="mt-6 px-4 py-2 bg-amber-500/10 text-amber-400 text-[10px] font-bold uppercase tracking-widest rounded-sm border border-amber-500/30 shadow-sm relative z-10 animate-pulse">
      MODULE IN DEVELOPMENT
    </div>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false, 
      staleTime: 1000 * 60 * 5, 
    },
  },
});

// GLOBAL BOOT LOADER
const GlobalLoader = () => (
  <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center text-[#D4AF37] font-mono relative overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-br from-[#D4AF37]/5 to-transparent pointer-events-none" />
    <Loader2 className="w-10 h-10 animate-spin mb-4 relative z-10" />
    <span className="text-[10px] font-bold tracking-widest uppercase animate-pulse relative z-10">&gt; Initializing SCS_CORE...</span>
  </div>
);

const AuthenticatedProjectCreator = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const handleSaveToDatabase = async (payload: ParsedBomPayload) => {
    if (!user) return;
    setIsSaving(true);
    
    try {
      const newWorkspace = await createWorkspace(user.id, payload.projectName);
      const itemsToInsert = payload.items.map(item => ({
        ...item,
        tenant_id: user.id,
        workspace_id: newWorkspace.id
      }));

      const CHUNK_SIZE = 500;
      for (let i = 0; i < itemsToInsert.length; i += CHUNK_SIZE) {
        await addBomRows(itemsToInsert.slice(i, i + CHUNK_SIZE));
      }

      await queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      await queryClient.invalidateQueries({ queryKey: ['bom_records'] });
      
      navigate('/dashboard/projects', { replace: true });
    } catch (error) {
      console.error("Failed to save project:", error);
      alert("Database insertion failed. Please try again.");
      setIsSaving(false);
    }
  };

  if (isSaving) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] font-mono animate-in fade-in duration-300 bg-[#020617]">
        <div className="w-16 h-16 bg-[#D4AF37]/10 rounded-sm border border-[#D4AF37]/30 flex items-center justify-center mb-6 shadow-[0_0_15px_rgba(212,175,55,0.2)]">
          <Database className="w-8 h-8 text-[#FCD34D] animate-pulse" />
        </div>
        <h3 className="text-xl font-black tracking-[0.1em] text-white mb-2 uppercase">Securing Payload</h3>
        <p className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-widest">&gt; Injecting components into main database...</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-4 lg:p-8 w-full max-w-5xl mx-auto font-sans">
      <QuoteWizard onSuccess={handleSaveToDatabase} defaultStep="select-method" />
    </div>
  );
};

type ErrorBoundaryState = { hasError: boolean; error: Error | null; };
export class ErrorBoundary extends Component<{children?: ReactNode}, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false, error: null };
  public static getDerivedStateFromError(error: Error): ErrorBoundaryState { return { hasError: true, error }; }
  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Fatal React Error:', error, errorInfo);
    Sentry.captureException(error, { contexts: { react: { componentStack: errorInfo.componentStack } } });
  }
  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-4 text-slate-200 font-mono relative overflow-hidden">
          {/* Subtle Red Warning Glow */}
          <div className="absolute inset-0 bg-red-950/10 pointer-events-none" />
          
          <div className="max-w-xl w-full text-center space-y-6 bg-slate-900/80 p-8 md:p-12 border border-red-900/50 rounded-sm shadow-[0_0_50px_rgba(220,38,38,0.1)] animate-in zoom-in-95 duration-500 relative z-10 backdrop-blur-xl">
            
            <div className="w-full flex justify-between items-center border-b border-red-900/30 pb-4 mb-6">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-slate-800"></div>
                <div className="w-3 h-3 rounded-full bg-slate-800"></div>
                <div className="w-3 h-3 rounded-full bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.8)]"></div>
              </div>
              <div className="text-[10px] text-red-500 font-bold uppercase tracking-widest flex items-center gap-2">
                <TerminalSquare className="w-3 h-3" /> FATAL_ERR
              </div>
            </div>

            <div className="w-20 h-20 bg-red-950/30 border border-red-900/50 rounded flex items-center justify-center mx-auto shadow-inner mb-6">
              <ShieldAlert className="w-10 h-10 text-red-500 animate-pulse" />
            </div>
            
            <div>
              <h1 className="text-2xl font-black tracking-[0.1em] text-white uppercase mb-3">System Exception</h1>
              <div className="bg-black/50 p-4 border border-slate-800 rounded-sm text-left">
                 <p className="text-red-400 text-xs font-medium leading-relaxed font-mono break-words">
                   &gt; {this.state.error?.message || 'An unexpected runtime anomaly severed the connection.'}
                 </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mt-8 pt-6 border-t border-slate-800">
              <button onClick={() => window.location.reload()} className="flex-1 bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:border-[#D4AF37] px-4 py-3.5 rounded-sm text-xs font-bold flex items-center justify-center gap-2 uppercase tracking-widest focus:outline-none shadow-sm active:scale-95 transition-all">
                <RefreshCcw className="w-4 h-4" /> Reboot Seq
              </button>
              <button onClick={() => window.location.href = '/'} className="flex-1 bg-[#D4AF37] hover:bg-[#FCD34D] text-black px-4 py-3.5 rounded-sm text-xs font-black flex items-center justify-center gap-2 uppercase tracking-widest focus:outline-none shadow-[0_0_15px_rgba(212,175,55,0.2)] active:scale-95 transition-all">
                <Home className="w-4 h-4" /> Return Root
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children || null;
  }
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <BrowserRouter>
          <Suspense fallback={<GlobalLoader />}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              
              <Route element={<ProtectedRoute allowedRoles={['admin', 'manager', 'buyer', 'viewer']} />}>
                <Route path="/dashboard" element={<DashboardLayout />}>
                  <Route index element={<DashboardIndex />} />
                  
                  <Route path="projects" element={<BomBuilder />} />
                  <Route path="new-project" element={<AuthenticatedProjectCreator />} />
                  
                  <Route path="quotes" element={<ActiveQuotes />} />
                  <Route path="quotes/:quoteId" element={<QuoteReviewPage />} />
                  <Route path="quotes/:quoteId/po" element={<GeneratePO />} /> 
                  
                  <Route path="orders" element={<GlobalProcurement />} />
                  
                  <Route path="intelligence">
                    <Route index element={<Navigate to="lifecycle" replace />} />
                    <Route path="lifecycle" element={<LifecycleRadar />} />
                    <Route path="cost-analysis" element={<CostAnalysis />} />
                    <Route path="compliance" element={<PlaceholderView title="Compliance Hub" icon={Shield} description="RoHS, REACH, and conflict mineral tracking documentation." />} />
                  </Route>

                  <Route path="settings" element={<PlaceholderView title="System Config" icon={Settings} description="Manage clearance levels, API keys, and notification protocols." />} />

                  {/* Catch-all for inside the dashboard */}
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Route>
              </Route>

              {/* Global Catch-all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}