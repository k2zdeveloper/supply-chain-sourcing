import React, { Component, type ErrorInfo, type ReactNode, Suspense, lazy, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ShieldAlert, RefreshCcw, Home, Loader2, Database, Shield, Settings } from 'lucide-react';

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
const GeneratePO = lazy(() => import('@/features/po/GeneratePO')); // NEW: Purchase Order Generator
const GlobalProcurement = lazy(() => import('@/features/bom/GlobalProcurement')); 

// Intelligence Suite
const LifecycleRadar = lazy(() => import('@/features/intelligence/LifecycleRadar'));
const CostAnalysis = lazy(() => import('@/features/intelligence/CostAnalysis'));

// Core & Auth
const QuoteWizard = lazy(() => import('@/features/onboarding/components/QuoteWizard').then(m => ({ default: m.QuoteWizard })));
const ProtectedRoute = lazy(() => import('@/features/auth/components/ProtectedRoute').then(m => ({ default: m.ProtectedRoute })));

// ============================================================================
// FEATURE PLACEHOLDERS
// ============================================================================
const PlaceholderView = ({ title, icon: Icon, description }: { title: string, icon: React.ElementType, description: string }) => (
  <div className="flex-1 flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] bg-slate-50 rounded-3xl border border-dashed border-slate-300 m-4 md:m-6 lg:m-8 animate-in fade-in duration-500 font-sans">
    <div className="w-16 h-16 bg-white shadow-sm rounded-full flex items-center justify-center mb-4 ring-1 ring-slate-900/5">
      <Icon className="w-8 h-8 text-slate-400" />
    </div>
    <h2 className="text-xl font-extrabold text-slate-900 mb-1 tracking-tight">{title}</h2>
    <p className="text-slate-500 font-medium text-xs max-w-sm text-center leading-relaxed">{description}</p>
    <div className="mt-6 px-3 py-1.5 bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-widest rounded-lg border border-blue-100/50 shadow-sm">
      Module in Development
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

const GlobalLoader = () => (
  <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-500 font-sans">
    <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
    <span className="text-[10px] font-bold tracking-widest uppercase animate-pulse">Initializing SupplyOS...</span>
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
      <div className="flex-1 flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] font-sans animate-in fade-in duration-300">
        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-5 shadow-inner ring-1 ring-blue-100">
          <Database className="w-6 h-6 text-blue-600 animate-pulse" />
        </div>
        <h3 className="text-xl font-extrabold tracking-tight text-slate-900 mb-1.5">Securing Data Payload</h3>
        <p className="text-xs font-medium text-slate-500">Injecting your components into the database.</p>
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
  public componentDidCatch(error: Error, errorInfo: ErrorInfo) { console.error('Fatal React Error:', error, errorInfo); }
  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-slate-900 font-sans">
          <div className="max-w-md w-full text-center space-y-6 bg-white p-8 md:p-10 rounded-[2rem] shadow-xl border border-slate-200/80 animate-in zoom-in-95 duration-500">
            <div className="w-16 h-16 bg-red-50 border border-red-100 rounded-full flex items-center justify-center mx-auto shadow-sm ring-4 ring-red-50/50">
              <ShieldAlert className="w-8 h-8 text-red-600" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">System Exception</h1>
              <p className="text-slate-500 text-xs font-medium mt-2.5 leading-relaxed px-4">{this.state.error?.message || 'An unexpected runtime error occurred.'}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <button onClick={() => window.location.reload()} className="flex-1 bg-white border border-slate-200/80 text-slate-700 px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-slate-50 focus:outline-none shadow-sm active:scale-95 transition-all"><RefreshCcw className="w-3.5 h-3.5" /> Restart App</button>
              <button onClick={() => window.location.href = '/'} className="flex-1 bg-slate-900 text-white px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-black focus:outline-none shadow-md active:scale-95 transition-all"><Home className="w-3.5 h-3.5" /> Return Home</button>
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
                  <Route path="quotes/:quoteId/po" element={<GeneratePO />} /> {/* ⚡ NEW PO GENERATOR ROUTE */}
                  
                  <Route path="orders" element={<GlobalProcurement />} />
                  
                  <Route path="intelligence">
                    {/* OPTIMIZATION: Auto-redirect base intelligence path to lifecycle */}
                    <Route index element={<Navigate to="lifecycle" replace />} />
                    <Route path="lifecycle" element={<LifecycleRadar />} />
                    <Route path="cost-analysis" element={<CostAnalysis />} />
                    <Route path="compliance" element={<PlaceholderView title="Compliance Hub" icon={Shield} description="RoHS, REACH, and conflict mineral tracking documentation." />} />
                  </Route>

                  <Route path="settings" element={<PlaceholderView title="Account Settings" icon={Settings} description="Manage team permissions, API keys, and notification preferences." />} />

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