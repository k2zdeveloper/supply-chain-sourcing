import { useState, useMemo, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, History, Search } from 'lucide-react';
import { z } from 'zod';

import { useAuthStore } from '@/stores/useAuthStore';
import { useBomData } from '@/features/bom/hooks/useBomData';
import { useCsvUpload } from '@/features/bom/hooks/useCsvUpload';
import { useSelection } from '@/features/bom/hooks/useSelection';

// Types
import type { BomRecord, QuickAddForm } from '@/features/bom/types';

// UI Components
import { BomHeader } from '@/features/bom/components/BomHeader';
import { QuickAddBar } from '@/features/bom/components/QuickAddBar';
import { BomDataGrid } from '@/features/bom/components/BomDataGrid';
import { OrderHistoryView } from '@/features/bom/components/OrderHistoryView';
import { AlternatesModal } from '@/features/bom/components/AlternatesModal';
import { GlobalNotification, type AppNotification } from '@/features/bom/components/GlobalNotification';
import { PrintManifest } from '@/features/bom/components/PrintManifest';

export default function BomManager() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  // --- Local UI State ---
  const [activeTab, setActiveTab] = useState<'BOM' | 'HISTORY'>('BOM'); 
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isQuickAdding, setIsQuickAdding] = useState<boolean>(false);
  const [alternatesRow, setAlternatesRow] = useState<BomRecord | null>(null);
  const [notification, setNotification] = useState<AppNotification | null>(null);

  // --- Custom Hooks (Data & Logic) ---
  const { 
    workspaces, activeWorkspaceId, setActiveWorkspaceId, 
    bomRecords, isLoadingBoms, isBomError, 
    orderHistory, isLoadingHistory, isHistoryError,
    addRows, deleteRow, updateRow, requestQuote, createNewWorkspace 
  } = useBomData(user?.id);

  const { selectedIds, handleToggleSelect, selectAll, clearSelection } = useSelection();

  const activeWorkspaceName = workspaces.find(w => w.id === activeWorkspaceId)?.name || 'Unknown Workspace';

  // --- Handlers ---
  const showNotification = useCallback((title: string, payload: unknown, type: 'error' | 'success' = 'error') => {
    let message = 'An unexpected system error occurred. Please try again.';
    if (type === 'success' && typeof payload === 'string') message = payload;
    else if (payload instanceof z.ZodError) message = payload.issues[0]?.message || 'Please check your input fields.';
    else if (payload instanceof Error) message = payload.message.replace('Error: ', '');
    else if (typeof payload === 'string') message = payload;

    setNotification({ title, message, type });
    setTimeout(() => setNotification(prev => prev?.title === title ? null : prev), 6000);
  }, []);

  // --- CSV Upload Logic ---
  const existingMpns = useMemo(() => new Set(bomRecords.map(r => r.mpn.toLowerCase())), [bomRecords]);

  const { isUploading, fileInputRef, handleFileUpload, setIsUploading } = useCsvUpload(
    user?.id, 
    activeWorkspaceId, 
    existingMpns,
    (payload) => addRows.mutate(payload, { 
      onSuccess: () => {
        setIsUploading(false);
        showNotification('Parts Added', 'Successfully uploaded BOM', 'success');
      } 
    }),
    (title: string, err: unknown) => showNotification(title, err, 'error')
  );

  // --- Action Handlers ---
  const handleQuickAdd = useCallback((part: QuickAddForm) => {
    if (!user?.id || !activeWorkspaceId) return;

    addRows.mutate([{
      tenant_id: user.id,
      workspace_id: activeWorkspaceId,
      mpn: part.mpn,
      manufacturer: part.manufacturer,
      quantity: part.quantity,
      target_price: part.target_price ?? null, // Safely handle undefined to null conversion
      lifecycle_status: 'Active',
      global_stock: 1000,
      risk_level: 'low',
      alternates: [],
      lead_time_weeks: null
    }], { 
      onSuccess: () => {
        showNotification('Added', 'Part added successfully', 'success');
      },
      onError: (err: unknown) => {
        showNotification('Add Failed', err, 'error');
      }
    });
  }, [user?.id, activeWorkspaceId, addRows, showNotification]);

  const handleGetQuotation = useCallback(() => {
    if (!activeWorkspaceId || selectedIds.size === 0) return;
    requestQuote.mutate({ wsId: activeWorkspaceId, partIds: Array.from(selectedIds) }, {
      onSuccess: (newQuoteId) => {
        clearSelection();
        showNotification('Quotation Submitted', 'Your parts have been submitted for quotation.', 'success');
        navigate(`/dashboard/quotes/${newQuoteId}`);
      },
      onError: (err: unknown) => showNotification('Quotation Failed', err, 'error')
    });
  }, [activeWorkspaceId, selectedIds, requestQuote, clearSelection, showNotification, navigate]);

  const handleResubmitQuote = useCallback(() => {
    if (!activeWorkspaceId || bomRecords.length === 0) return;
    const allPartIds = bomRecords.map(r => String(r.id));
    requestQuote.mutate({ wsId: activeWorkspaceId, partIds: allPartIds }, {
      onSuccess: (newQuoteId) => {
        showNotification('Quote Resubmitted', 'Your new quotation is processing.', 'success');
        navigate(`/dashboard/quotes/${newQuoteId}`);
      },
      onError: (err: unknown) => showNotification('Resubmission Failed', err, 'error')
    });
  }, [activeWorkspaceId, bomRecords, requestQuote, showNotification, navigate]);

  // --- Derived View States ---
  const filteredData = useMemo(() => {
    if (!searchTerm) return bomRecords;
    const q = searchTerm.toLowerCase();
    return bomRecords.filter(r => r.mpn.toLowerCase().includes(q) || r.manufacturer.toLowerCase().includes(q));
  }, [bomRecords, searchTerm]);

  const showOnboarding = bomRecords.length === 0 && !isLoadingBoms && !isQuickAdding && activeTab === 'BOM';

  return (
    <div className="font-sans text-slate-900 antialiased w-full h-full flex flex-col min-h-screen bg-slate-50">
      <GlobalNotification notification={notification} onClose={() => setNotification(null)} />
      <PrintManifest workspaceName={activeWorkspaceName} dataLength={filteredData.length} />
      
      {/* Hidden File Input managed by hook */}
      <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileUpload} aria-hidden="true" />

      {alternatesRow && (
        <AlternatesModal 
          row={alternatesRow} 
          onClose={() => setAlternatesRow(null)} 
          onUpdate={(updates) => updateRow.mutate({ id: String(alternatesRow.id), updates })} 
          onError={(msg: string) => showNotification('Invalid Entry', msg, 'error')}
        />
      )}

      {/* Abstracted Header Component */}
      <BomHeader 
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        onWorkspaceChange={setActiveWorkspaceId}
        onCreateWorkspace={(name: string) => createNewWorkspace.mutate(name, {
          onSuccess: () => showNotification('Workspace Created', `Successfully created ${name}`, 'success'),
          onError: (err: unknown) => showNotification('Creation Failed', err, 'error')
        })}
        isCreating={createNewWorkspace.isPending}
        onUploadClick={() => fileInputRef.current?.click()}
        isUploading={isUploading}
        onToggleQuickAdd={() => setIsQuickAdding(prev => !prev)}
        onGetQuotation={handleGetQuotation}
        selectedCount={selectedIds.size}
        isRequestingQuote={requestQuote.isPending}
        isHistoryTab={activeTab === 'HISTORY'}
      />

      {/* Navigation Tabs */}
      {activeWorkspaceId !== null && workspaces.length > 0 && (
        <nav className="bg-white border-b border-slate-100 px-6 flex items-center gap-6 shrink-0" aria-label="Workspace views">
          <TabButton 
            active={activeTab === 'BOM'} 
            onClick={() => setActiveTab('BOM')} 
            icon={<Layers className="w-4 h-4"/>} 
            label="Current BOM" 
          />
          <TabButton 
            active={activeTab === 'HISTORY'} 
            onClick={() => setActiveTab('HISTORY')} 
            icon={<History className="w-4 h-4"/>} 
            label="Order History" 
          />
        </nav>
      )}

      {/* Main Content Router */}
      {activeTab === 'HISTORY' ? (
        <OrderHistoryView 
          history={orderHistory} 
          isLoading={isLoadingHistory} 
          isError={isHistoryError} 
          onResubmitQuote={handleResubmitQuote} 
          onPay={() => showNotification("Payment Gateway", "Routing to secure checkout...", "success")}
        />
      ) : showOnboarding ? (
        <OnboardingState onUploadClick={() => fileInputRef.current?.click()} />
      ) : (
        <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50">
           
           <div className="px-6 py-3 border-b border-slate-200 bg-white shrink-0">
             <SearchInput value={searchTerm} onChange={setSearchTerm} />
           </div>
           
           {isQuickAdding && (
             <QuickAddBar 
                onAdd={handleQuickAdd} 
                isAdding={addRows.isPending} 
                onError={(msg: string) => showNotification('Invalid Entry', msg, 'error')}
             />
           )}
           
           <BomDataGrid 
             data={filteredData}
             isLoading={isLoadingBoms}
             isError={isBomError}
             selectedIds={selectedIds}
             onToggleSelect={handleToggleSelect}
             onSelectAll={() => selectAll(filteredData.map(r => String(r.id)))}
             onManageAlternates={setAlternatesRow}
             onDelete={(id: string) => deleteRow.mutate(id, { 
               onSuccess: () => showNotification('Removed', 'Part removed from BOM', 'success') 
             })}
           />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// LOCAL MICRO-COMPONENTS (Strictly typed & Memoized)
// ============================================================================

type TabButtonProps = {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
};

const TabButton = memo(({ active, onClick, icon, label }: TabButtonProps) => (
  <button 
    onClick={onClick}
    aria-current={active ? 'page' : undefined}
    className={`py-3 text-sm font-bold transition-colors border-b-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-t-sm ${active ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
  >
    <div className="flex items-center gap-1.5">{icon} {label}</div>
  </button>
));
TabButton.displayName = 'TabButton';

type SearchInputProps = {
  value: string;
  onChange: (v: string) => void;
};

const SearchInput = memo(({ value, onChange }: SearchInputProps) => (
  <div className="relative flex-1 max-w-md">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
    <input 
      type="text" 
      value={value} 
      onChange={(e) => onChange(e.target.value)} 
      placeholder="Filter parts..." 
      aria-label="Filter parts"
      className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-900 outline-none transition-all focus:bg-white focus:ring-2 focus:ring-blue-500/20" 
    />
  </div>
));
SearchInput.displayName = 'SearchInput';

type OnboardingStateProps = {
  onUploadClick: () => void;
};

const OnboardingState = memo(({ onUploadClick }: OnboardingStateProps) => (
  <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-700 bg-slate-50">
    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-6 border border-slate-200 shadow-sm">
      <Layers className="w-8 h-8 text-slate-400" />
    </div>
    <h2 className="text-xl font-semibold text-slate-900 mb-2">No parts in this workspace</h2>
    <p className="text-slate-500 mb-8 max-w-sm text-sm">Upload a CSV or add items manually to start calculating procurement costs.</p>
    <button onClick={onUploadClick} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-all shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-500/30">
      Upload BOM CSV
    </button>
  </div>
));
OnboardingState.displayName = 'OnboardingState';