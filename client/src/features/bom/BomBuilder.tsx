import { useState, useMemo, useCallback, useEffect, useRef, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual'; 
import { useAuthStore } from '@/stores/useAuthStore';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Papa, { type ParseResult } from 'papaparse';
import { 
  Search, Loader2, Edit2, Trash2, Check, X, 
  Cpu, Plus, AlertTriangle, FileSpreadsheet, 
  ChevronDown, Layers, Database, Save, Zap, Folder, ShoppingCart,
  MoreVertical, Copy, CheckCircle2, Clock,
  DollarSign
} from 'lucide-react';

import type { Workspace, BomRecord, ConfirmModalConfig, LifecycleStatus, RiskLevel } from './types';
import { 
  fetchWorkspaces, fetchBomRecords, updateWorkspace, deleteWorkspace, 
  deleteBomRow, addBomRows, createWorkspace, updateBomRow, requestWorkspaceQuotation 
} from './api';
import { ConfirmModal } from './components/ConfirmModal';
import { AlternatesModal } from './components/AlternatesModal';
import { GlobalNotification, type AppNotification } from './components/GlobalNotification';

// ============================================================================
// CONSTANTS & SCHEMAS
// ============================================================================
const PLATFORM_MARGIN = 1.15;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; 

const addPartSchema = z.object({
  mpn: z.string().min(2, 'Please enter a valid part number.').trim().toUpperCase(),
  manufacturer: z.string().trim().optional(),
  quantity: z.number().int().min(1, 'Quantity needs to be at least 1.'),
  target_price: z.number().positive('Target price must be greater than 0.').optional(),
});

type AddPartData = z.infer<typeof addPartSchema>;
type PendingBomRow = Omit<BomRecord, 'id' | 'created_at' | 'updated_at'>;
type BomRowUpdatePayload = Partial<BomRecord>;

const csvRowSchema = z.object({
  mpn: z.string().min(1, 'MPN is missing').trim(),
  manufacturer: z.string().trim().default('Unknown'),
  quantity: z.number().int().positive('Quantity must be a valid number').default(1),
  target_price: z.number().positive().nullable(),
  lead_time_weeks: z.number().int().nonnegative().nullable().optional()
});

// ============================================================================
// UTILS & MICRO-COMPONENTS
// ============================================================================
const formatCurrency = (val: number | null | undefined): string => 
  (val !== null && val !== undefined) ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(val) : '-';

const timeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  const days = Math.floor(seconds / 86400);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const getCategory = (mpn: string) => {
  if (/^(STM|ESP|ATMEGA|PIC|MAX)/i.test(mpn)) return 'MCU';
  if (/^(RC|CC|C0|C1|GRM)/i.test(mpn)) return 'Passive';
  if (/^(LM|TPS|SN|TI)/i.test(mpn)) return 'Power IC';
  return 'Component';
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function BomBuilder() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const parentRef = useRef<HTMLDivElement>(null); 
  const [isMounted, setIsMounted] = useState<boolean>(false);

  useEffect(() => { requestAnimationFrame(() => setIsMounted(true)); }, []);

  // --- State ---
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [projectSearchTerm, setProjectSearchTerm] = useState<string>(''); 
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // --- UI State ---
  const [isRenaming, setIsRenaming] = useState<boolean>(false);
  const [renameValue, setRenameValue] = useState<string>('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);
  
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState<boolean>(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState<string>('');

  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [alternatesRow, setAlternatesRow] = useState<BomRecord | null>(null);
  const [notification, setNotification] = useState<AppNotification | null>(null);
  const [modalConfig, setModalConfig] = useState<ConfirmModalConfig>({ 
    isOpen: false, title: '', message: '', confirmText: '', onConfirm: () => {}, variant: 'primary' 
  });

  // --- Upload State ---
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const addPartForm = useForm<AddPartData>({
    resolver: zodResolver(addPartSchema),
    defaultValues: { mpn: '', manufacturer: '', quantity: 1, target_price: undefined }
  });

  // --- Queries ---
  const { data: workspaces = [], isLoading: isLoadingWorkspaces } = useQuery<Workspace[], Error>({
    queryKey: ['workspaces', user?.id],
    queryFn: () => fetchWorkspaces(user?.id),
    enabled: !!user?.id
  });

  const { data: records = [], isLoading: isLoadingRecords } = useQuery<BomRecord[], Error>({
    queryKey: ['bom_records', activeWorkspaceId],
    queryFn: () => fetchBomRecords(activeWorkspaceId),
    enabled: !!activeWorkspaceId
  });

  // --- Filters ---
  const filteredWorkspaces = useMemo(() => {
    if (!projectSearchTerm) return workspaces;
    const q = projectSearchTerm.toLowerCase();
    return workspaces.filter(w => w.name.toLowerCase().includes(q));
  }, [workspaces, projectSearchTerm]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm) return records;
    const q = searchTerm.toLowerCase();
    return records.filter(r => r.mpn.toLowerCase().includes(q) || r.manufacturer.toLowerCase().includes(q));
  }, [records, searchTerm]);

  const totalWorkspaceValue = useMemo(() => {
    return filteredRecords.reduce((sum, r) => sum + ((r.target_price || 0) * PLATFORM_MARGIN * r.quantity), 0);
  }, [filteredRecords]);

  const selectedValue = useMemo(() => {
    return filteredRecords
      .filter(r => selectedIds.has(r.id))
      .reduce((sum, r) => sum + ((r.target_price || 0) * PLATFORM_MARGIN * r.quantity), 0);
  }, [filteredRecords, selectedIds]);

  // --- VIRTUALIZATION ---
  const rowVirtualizer = useVirtualizer({
    count: filteredRecords.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64, 
    overscan: 10, 
  });

  // --- Mutations ---
  const showNotification = useCallback((title: string, message: string, type: 'error' | 'success' = 'error') => {
    setNotification({ title, message, type });
  }, []);

  const closeConfirmModal = useCallback(() => setModalConfig(prev => ({ ...prev, isOpen: false })), []);

  const confirmAction = useCallback((title: string, message: string, confirmText: string, variant: 'danger' | 'primary', action: () => void) => {
    setModalConfig({ isOpen: true, title, message, confirmText, variant, onConfirm: action });
  }, []);

  const createWorkspaceMutation = useMutation({
    mutationFn: (name: string) => {
      if (!user?.id) throw new Error("Authentication required.");
      return createWorkspace(user.id, name);
    },
    onSuccess: (newWs: Workspace) => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      setActiveWorkspaceId(newWs.id);
      setIsCreatingWorkspace(false);
      setNewWorkspaceName('');
      showNotification('Project Created', `"${newWs.name}" is ready to go.`, 'success');
      setIsDropdownOpen(false);
    },
    onError: (err: Error) => showNotification('Oops', err.message || 'We ran into an issue creating your project.', 'error')
  });

  const renameMutation = useMutation({
    mutationFn: (payload: { id: string; updates: Partial<Workspace> }) => updateWorkspace(payload),
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['workspaces'] }); 
      setIsRenaming(false); setRenameError(null); setIsWorkspaceMenuOpen(false);
    },
    onError: () => setRenameError("We couldn't save that name. Try again.")
  });

  const deleteWorkspaceMutation = useMutation({
    mutationFn: (id: string) => deleteWorkspace(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      setActiveWorkspaceId(null);
      setIsWorkspaceMenuOpen(false);
      showNotification('Project Deleted', 'That project has been removed.', 'success');
    },
    onError: () => showNotification('Error', 'We could not delete that project right now.', 'error')
  });

  const deleteRowMutation = useMutation({
    mutationFn: (id: string) => deleteBomRow(id),
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({ queryKey: ['bom_records', activeWorkspaceId] });
      const previous = queryClient.getQueryData<BomRecord[]>(['bom_records', activeWorkspaceId]);
      queryClient.setQueryData(['bom_records', activeWorkspaceId], (old: BomRecord[] | undefined) => 
        old ? old.filter(r => r.id !== deletedId) : []
      );
      return { previous };
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['workspaces'] });
        showNotification('Part Removed', 'Component removed from your list.', 'success');
    },
    onError: (err, variables, context) => {
      if (context?.previous) queryClient.setQueryData(['bom_records', activeWorkspaceId], context.previous);
      showNotification('Error', 'We hit a snag trying to remove that part.', 'error');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['bom_records', activeWorkspaceId] });
    }
  });

  // Feature 3: Bulk Delete
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) { await deleteBomRow(id); }
      return ids.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['bom_records', activeWorkspaceId] });
      setSelectedIds(new Set());
      showNotification('Success', `Removed ${count} components.`, 'success');
    }
  });

  const addPartMutation = useMutation({
    mutationFn: (rows: PendingBomRow[]) => addBomRows(rows),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom_records'] });
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      setIsAddModalOpen(false);
      addPartForm.reset();
      showNotification('Part Added', 'Your list has been updated.', 'success');
    },
    onError: (err: Error) => showNotification('Error', err.message || 'Failed to add component.', 'error')
  });

  const updateRowMutation = useMutation({
    mutationFn: (payload: { id: string; updates: Partial<BomRecord> }) => updateBomRow(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bom_records'] }),
    onError: () => showNotification('Error', 'Could not update that component.', 'error')
  });

  const generateQuoteMutation = useMutation({
    mutationFn: (partIds: string[]) => {
      if (!activeWorkspaceId) throw new Error("Workspace context is missing.");
      return requestWorkspaceQuotation(activeWorkspaceId, partIds);
    },
    // ⚡ STRICT MODIFICATION: Route accurately reflects the App.tsx configuration
    onSuccess: (quoteId: string) => navigate(`/dashboard/quotes/${quoteId}`),
    onError: (err: Error) => showNotification('Generation Failed', err.message || 'Could not generate quote.', 'error')
  });

  useEffect(() => {
    if (!activeWorkspaceId && workspaces.length > 0) setActiveWorkspaceId(workspaces[0].id);
  }, [workspaces, activeWorkspaceId]);
  
  const activeWorkspace = useMemo(() => workspaces.find(w => w.id === activeWorkspaceId), [workspaces, activeWorkspaceId]);

  const handleCreateWorkspace = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newWorkspaceName.trim();
    if (!trimmedName) return;
    if (workspaces.some(w => w.name.toLowerCase() === trimmedName.toLowerCase())) {
      showNotification('Name in use', 'You already have a project with that name.', 'error');
      return;
    }
    createWorkspaceMutation.mutate(trimmedName);
  };

  const handleRenameSave = useCallback(() => {
    if (!activeWorkspaceId) return;
    const trimmedName = renameValue.trim();
    if (!trimmedName) return setRenameError("Name can't be empty.");
    if (trimmedName.toLowerCase() === activeWorkspace?.name.toLowerCase()) { setIsRenaming(false); return setRenameError(null); }
    if (workspaces.some(w => w.name.toLowerCase() === trimmedName.toLowerCase() && w.id !== activeWorkspaceId)) {
      return setRenameError("You already have a project with that name.");
    }
    setRenameError(null);
    renameMutation.mutate({ id: activeWorkspaceId, updates: { name: trimmedName } });
  }, [renameValue, activeWorkspaceId, activeWorkspace, workspaces, renameMutation]);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
      return newSet;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (selectedIds.size > 0) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredRecords.map(r => r.id)));
  }, [selectedIds.size, filteredRecords]);

  const handleAlternatesUpdate = useCallback((updates: BomRowUpdatePayload) => {
    if (alternatesRow) updateRowMutation.mutate({ id: alternatesRow.id, updates });
  }, [alternatesRow, updateRowMutation]);

  // --- CSV Processing Engine ---
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile || !user?.id || !activeWorkspaceId) return;

    if (uploadedFile.size > MAX_FILE_SIZE_BYTES) {
        showNotification('File Too Large', 'For performance, CSV uploads are capped at 10MB.', 'error');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
    }

    if (uploadedFile.type !== 'text/csv' && !uploadedFile.name.match(/\.csv$/i)) {
      showNotification('Wrong File Type', "Please upload a standard .CSV file.", 'error');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsUploading(true); setUploadProgress(10);

    Papa.parse<Record<string, string | undefined>>(uploadedFile, {
      header: true, skipEmptyLines: true, worker: true,
      complete: async (results: ParseResult<Record<string, string | undefined>>) => {
        try {
          const itemsToInsert: PendingBomRow[] = [];
          setUploadProgress(30);
          
          results.data.forEach((row, index) => {
            const rawMpn = row['Manufacturer Part Number (MPN)'] || row['MPN'];
            const rawQty = String(row['Quantity'] || row['Qty'] || '').replace(/,/g, ''); 
            const rawPrice = String(row['Target Price (Optional)'] || row['Target Price'] || '').replace(/[^0-9.]/g, '');

            const rawData = {
              mpn: rawMpn ? String(rawMpn).trim().toUpperCase() : '',
              manufacturer: (row['Manufacturer'] || row['Mfr'])?.trim() || 'Unknown',
              quantity: parseInt(rawQty, 10) || 0,
              target_price: parseFloat(rawPrice) || null,
              lead_time_weeks: parseInt(String(row['Lead Time (Weeks)']), 10) || null
            };

            const validatedRow = csvRowSchema.safeParse(rawData);
            if (!validatedRow.success) throw new Error(`We found an issue on row ${index + 1}: ${validatedRow.error.issues[0].message}`);

            itemsToInsert.push({
              ...validatedRow.data,
              tenant_id: user.id, workspace_id: activeWorkspaceId,
              lifecycle_status: 'Active' as LifecycleStatus, global_stock: 0, 
              risk_level: 'low' as RiskLevel, alternates: [],
              lead_time_weeks: validatedRow.data.lead_time_weeks || null
            });
          });

          if (itemsToInsert.length === 0) throw new Error("We couldn't find any valid parts in that document.");
          setUploadProgress(50);

          const CHUNK_SIZE = 500;
          for (let i = 0; i < itemsToInsert.length; i += CHUNK_SIZE) {
            await addBomRows(itemsToInsert.slice(i, i + CHUNK_SIZE));
            setUploadProgress(50 + Math.floor(((i + CHUNK_SIZE) / itemsToInsert.length) * 50));
          }

          await queryClient.invalidateQueries({ queryKey: ['bom_records'] });
          await queryClient.invalidateQueries({ queryKey: ['workspaces'] });
          showNotification('Upload Complete', `Added ${itemsToInsert.length} parts to your project.`, 'success');

        } catch (err: unknown) { 
          showNotification('Upload Paused', err instanceof Error ? err.message : 'Something went wrong reading your file.', 'error');
        } finally {
          setTimeout(() => {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }, 500);
        }
      }
    });
  }, [user, activeWorkspaceId, queryClient, showNotification]);

  const handleAddPartSubmit = addPartForm.handleSubmit((data) => {
    if (!user?.id || !activeWorkspaceId) return showNotification('Session Error', 'Please log in.', 'error');
    const newRow: PendingBomRow = {
        tenant_id: user.id, workspace_id: activeWorkspaceId, mpn: data.mpn,
        manufacturer: data.manufacturer || 'Unknown', quantity: data.quantity,
        target_price: data.target_price ?? null, lead_time_weeks: null, 
        lifecycle_status: 'Active' as LifecycleStatus, global_stock: 0, risk_level: 'low', alternates: []
    };
    addPartMutation.mutate([newRow]);
  });

  if (isLoadingWorkspaces) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50/50 min-h-[calc(100vh-3.5rem)] font-sans">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600 mb-3" />
        <p className="text-[10px] font-bold text-slate-500 tracking-widest uppercase animate-pulse">Loading Workspace</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full min-h-[calc(100vh-4rem)] bg-white rounded-2xl shadow-sm border border-slate-200/60 font-sans relative overflow-hidden transition-all duration-700 ease-out m-4 md:m-6 lg:m-8 max-w-[1400px] mx-auto ${isMounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
      <GlobalNotification notification={notification} onClose={() => setNotification(null)} />
      <ConfirmModal config={modalConfig} onClose={closeConfirmModal} />

      {alternatesRow && (
        <AlternatesModal row={alternatesRow} onClose={() => setAlternatesRow(null)} onUpdate={handleAlternatesUpdate} onError={(msg: string) => showNotification('Error', msg, 'error')} />
      )}

      <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileUpload} />

      {/* CSV Processing Overlay */}
      {isUploading && (
        <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-white/95 backdrop-blur-md animate-in fade-in duration-300">
          <div className="relative w-16 h-16 mb-5 flex items-center justify-center">
            <div className="absolute inset-0 bg-blue-500/10 rounded-full animate-ping" />
            <div className="absolute inset-2 bg-blue-600/20 rounded-full animate-pulse" />
            <Database className="w-6 h-6 text-blue-600 relative z-10" />
          </div>
          <h3 className="text-xl font-extrabold text-slate-900 mb-2 tracking-tight">Processing Parts</h3>
          <div className="w-48 h-1.5 bg-slate-100 rounded-full overflow-hidden shadow-inner">
            <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-300 ease-out" style={{ width: `${uploadProgress}%` }} />
          </div>
          <p className="text-slate-500 text-[10px] mt-3 font-bold tracking-widest uppercase">{uploadProgress}% Complete</p>
        </div>
      )}

      {/* Add Component Modal */}
      {isAddModalOpen && (
        <div className="absolute inset-0 z-[80] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 ring-1 ring-slate-900/5 flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-white shrink-0">
              <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2 tracking-tight"><Plus className="w-4 h-4 text-blue-600"/> Add a Part</h3>
              <button onClick={() => { setIsAddModalOpen(false); addPartForm.reset(); }} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-md focus:outline-none transition-colors"><X className="w-4 h-4"/></button>
            </div>
            <form onSubmit={handleAddPartSubmit} className="p-5 space-y-4 bg-slate-50/50 flex-1">
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-1">Part Number (MPN)</label>
                <input {...addPartForm.register('mpn')} autoFocus className="w-full border border-slate-200/80 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 uppercase shadow-sm transition-all" placeholder="STM32F405" />
                {addPartForm.formState.errors.mpn && <p className="text-[9px] text-red-500 font-bold pl-1">{addPartForm.formState.errors.mpn.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-1">Manufacturer</label>
                <input {...addPartForm.register('manufacturer')} className="w-full border border-slate-200/80 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm transition-all" placeholder="Optional" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-1">Quantity</label>
                  <input type="number" min="1" {...addPartForm.register('quantity', { setValueAs: (v) => v === '' ? undefined : parseInt(v, 10) })} className="w-full border border-slate-200/80 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm transition-all" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-1">Target Price</label>
                  <input type="number" step="0.001" {...addPartForm.register('target_price', { setValueAs: (v) => v === '' ? undefined : parseFloat(v) })} className="w-full border border-slate-200/80 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm transition-all" placeholder="$0.00" />
                </div>
              </div>
              <div className="pt-3">
                <button type="submit" disabled={addPartMutation.isPending} className="w-full py-3 text-xs font-bold text-white bg-slate-900 hover:bg-black rounded-xl flex items-center justify-center gap-1.5 shadow-md focus:outline-none disabled:opacity-50 active:scale-95 transition-all">
                  {addPartMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : 'Save to Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* HEADER & DROPDOWN VIEW */}
      <header className="relative bg-white border-b border-slate-200/60 px-5 py-4 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4 z-[60]">
        
        {/* Workspace Selector */}
        <div className="relative">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5"><Layers className="w-3 h-3" /> Active Workspace</p>
          <div className="flex items-center gap-2">
            {isRenaming ? (
              <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-left-2">
                <input 
                  type="text" value={renameValue} 
                  onChange={e => { setRenameValue(e.target.value); if (renameError) setRenameError(null); }} 
                  onKeyDown={e => { if (e.key === 'Enter') handleRenameSave(); }}
                  className={`border ${renameError ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'} rounded-lg px-2.5 py-1.5 text-sm font-extrabold text-slate-900 outline-none shadow-sm transition-all`}
                  autoFocus 
                />
                <button onClick={handleRenameSave} disabled={renameMutation.isPending} className="p-1.5 bg-emerald-50 text-emerald-600 rounded-md hover:bg-emerald-100 focus:outline-none disabled:opacity-50 transition-colors">
                  {renameMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4"/>}
                </button>
                <button onClick={() => { setIsRenaming(false); setRenameError(null); }} className="p-1.5 bg-slate-50 text-slate-500 rounded-md hover:bg-slate-100 focus:outline-none transition-colors"><X className="w-4 h-4"/></button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="flex items-center gap-1.5 text-xl font-extrabold tracking-tight text-slate-900 hover:text-blue-600 focus:outline-none transition-colors group">
                  {activeWorkspace?.name || 'Select a Project'} 
                  <div className={`w-5 h-5 rounded-md bg-slate-50 flex items-center justify-center group-hover:bg-blue-50 transition-all duration-300 ${isDropdownOpen ? 'rotate-180 bg-blue-100' : ''}`}>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 transition-colors" />
                  </div>
                </button>
                
                {/* Feature 15: Contextual Workspace Menu */}
                {activeWorkspace && (
                  <div className="relative">
                    <button onClick={() => setIsWorkspaceMenuOpen(!isWorkspaceMenuOpen)} className="p-1 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors focus:outline-none ml-1">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {isWorkspaceMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-[65]" onClick={() => setIsWorkspaceMenuOpen(false)}></div>
                        <div className="absolute top-full left-0 mt-1 w-32 bg-white border border-slate-200/80 shadow-lg rounded-xl z-[70] overflow-hidden animate-in fade-in slide-in-from-top-1 py-1">
                          <button onClick={() => { setRenameValue(activeWorkspace.name); setRenameError(null); setIsRenaming(true); setIsWorkspaceMenuOpen(false); }} className="w-full text-left px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-blue-600 flex items-center gap-2 transition-colors focus:outline-none">
                            <Edit2 className="w-3.5 h-3.5" /> Rename
                          </button>
                          <button onClick={() => confirmAction("Delete Project", "This will permanently erase your BOM.", "Delete", "danger", () => { if (activeWorkspaceId) deleteWorkspaceMutation.mutate(activeWorkspaceId); setIsWorkspaceMenuOpen(false); })} className="w-full text-left px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors focus:outline-none">
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Feature 20: Dropdown Blur Backdrop */}
          {isDropdownOpen && (
            <>
              <div className="fixed inset-0 z-[55] bg-slate-900/5 backdrop-blur-[1px] animate-in fade-in duration-200" onClick={() => setIsDropdownOpen(false)}></div>
              <div className="absolute top-full left-0 mt-2 w-full md:w-[320px] bg-white border border-slate-200/80 shadow-xl rounded-xl z-[60] overflow-hidden animate-in fade-in slide-in-from-top-2 flex flex-col">
                <div className="p-2 border-b border-slate-100 bg-slate-50/50">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input 
                      type="text" autoFocus placeholder="Find project..." value={projectSearchTerm} onChange={(e) => setProjectSearchTerm(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200/80 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm transition-all placeholder:text-slate-400 placeholder:font-medium"
                    />
                  </div>
                </div>
                <div className="max-h-[250px] overflow-y-auto custom-scrollbar p-1.5 flex-1">
                  {filteredWorkspaces.length === 0 ? (
                    <div className="p-4 text-center text-slate-500 text-[10px] font-bold uppercase tracking-widest">No matches found.</div>
                  ) : (
                    filteredWorkspaces.map(ws => (
                      <button 
                        key={ws.id} 
                        onClick={() => { setActiveWorkspaceId(ws.id); setIsDropdownOpen(false); setSelectedIds(new Set()); setProjectSearchTerm(''); }} 
                        className={`w-full text-left px-2.5 py-2 rounded-lg flex items-center gap-3 focus:outline-none transition-all mb-0.5 
                          ${ws.id === activeWorkspaceId ? 'bg-blue-50/80 border border-blue-100/50' : 'hover:bg-slate-50 border border-transparent'}
                        `}
                      >
                        <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 shadow-sm transition-colors ${ws.id === activeWorkspaceId ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-400'}`}>
                          <Folder className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className={`block text-xs font-extrabold truncate tracking-tight ${ws.id === activeWorkspaceId ? 'text-blue-900' : 'text-slate-900'}`}>{ws.name}</span>
                          <span className="block text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Created {timeAgo(ws.created_at)}</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
                <div className="p-2 bg-slate-50 border-t border-slate-100">
                  {isCreatingWorkspace ? (
                    <form onSubmit={handleCreateWorkspace} className="flex gap-1.5 animate-in fade-in slide-in-from-bottom-1">
                      <input 
                        value={newWorkspaceName} onChange={(e) => setNewWorkspaceName(e.target.value)} placeholder="Name..." autoFocus
                        className="flex-1 border border-slate-200/80 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm transition-all" 
                      />
                      <button type="submit" disabled={createWorkspaceMutation.isPending || !newWorkspaceName.trim()} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold disabled:opacity-50 shadow-sm transition-all focus:outline-none">Save</button>
                      <button type="button" onClick={() => setIsCreatingWorkspace(false)} className="text-slate-400 hover:bg-slate-200 px-2 py-1.5 rounded-lg transition-colors focus:outline-none"><X className="w-3.5 h-3.5" /></button>
                    </form>
                  ) : (
                    <button onClick={() => setIsCreatingWorkspace(true)} className="w-full py-2 flex items-center justify-center gap-1.5 text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg shadow-sm active:scale-[0.98] transition-all focus:outline-none">
                      <Plus className="w-3.5 h-3.5 text-slate-400" /> Start New Project
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Global Actions */}
        <div className="flex items-center gap-2">
          <button onClick={() => fileInputRef.current?.click()} disabled={isUploading || !activeWorkspaceId} className="hidden lg:flex bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80 px-4 py-2.5 rounded-xl text-xs font-bold transition-all items-center gap-2 shadow-sm focus:outline-none disabled:opacity-50 active:scale-95">
            {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500"/> : <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400" />} Upload CSV
          </button>
          <button onClick={() => setIsAddModalOpen(true)} disabled={!activeWorkspaceId} className="hidden md:flex bg-slate-900 hover:bg-black text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all items-center gap-1.5 shadow-sm focus:outline-none disabled:opacity-50 active:scale-95">
            <Plus className="w-3.5 h-3.5" /> Add Part
          </button>
        </div>
      </header>

      {/* MAIN VIEWPORT (Virtualized) */}
      {activeWorkspace ? (
        <div className="flex-1 flex flex-col min-h-0 bg-white relative">
          
          {/* Feature 1: Dynamic Workspace Summary & Command Bar */}
          <div className={`px-5 py-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 transition-colors duration-300 ${selectedIds.size > 0 ? 'bg-blue-50/40' : 'bg-slate-50/50'}`}>
            <div className="relative w-full sm:max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Filter MPN or Manufacturer..." className="w-full bg-white border border-slate-200/80 focus:border-blue-400 rounded-xl pl-9 pr-8 py-2 text-xs font-bold text-slate-900 outline-none transition-all shadow-sm focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-400 placeholder:font-medium" />
              {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600 focus:outline-none"><X className="w-3.5 h-3.5"/></button>}
            </div>
            
            <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 overflow-x-auto custom-scrollbar pb-1 sm:pb-0">
              <div className="flex items-center gap-1.5 shrink-0"><Database className="w-3 h-3 text-slate-300"/> {filteredRecords.length} Lines</div>
              <span className="w-1 h-1 rounded-full bg-slate-200 shrink-0"></span>
              <div className="flex items-center gap-1.5 shrink-0"><CheckCircle2 className="w-3 h-3 text-slate-300"/> {filteredRecords.reduce((acc, r) => acc + r.quantity, 0).toLocaleString()} Units</div>
              <span className="w-1 h-1 rounded-full bg-slate-200 shrink-0"></span>
              <div className="flex items-center gap-1.5 text-slate-900 shrink-0"><DollarSign className="w-3 h-3 text-emerald-500"/> {formatCurrency(totalWorkspaceValue)} Est.</div>
            </div>
          </div>

          {/* VIRTUALIZED TABLE CONTAINER */}
          <div ref={parentRef} className="flex-1 overflow-auto custom-scrollbar relative bg-white">
            {isLoadingRecords ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 py-20 animate-in fade-in">
                <Loader2 className="w-6 h-6 animate-spin mb-3 text-blue-500" /> 
                <span className="text-[10px] font-bold uppercase tracking-widest">Loading BOM Data...</span>
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 py-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-5 ring-1 ring-slate-100 shadow-inner">
                  <Cpu className="w-10 h-10 text-slate-300" />
                </div>
                <h3 className="text-lg font-extrabold text-slate-900 mb-1.5 tracking-tight">{searchTerm ? 'No matches found' : 'Workspace is Empty'}</h3>
                <p className="text-xs font-medium text-slate-500 mb-5 text-center max-w-xs leading-relaxed">
                  {searchTerm ? 'Try adjusting your search criteria.' : 'Upload a CSV or add components manually to start building your BOM.'}
                </p>
                {!searchTerm && (
                  <button onClick={() => fileInputRef.current?.click()} className="bg-white border border-slate-200/80 px-5 py-2.5 rounded-xl text-xs font-bold text-slate-700 shadow-sm hover:shadow-md hover:border-slate-300 transition-all active:scale-95 flex items-center gap-2 focus:outline-none">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600"/> Select File
                  </button>
                )}
              </div>
            ) : (
              <div className="w-full min-w-[900px]">
                
                {/* CSS-Grid Based Table Header (Stays sticky, won't break virtualization) */}
                <div className="sticky top-0 z-10 bg-slate-50/90 backdrop-blur-md border-b border-slate-200/80 text-slate-400 text-[9px] font-bold uppercase tracking-widest flex items-center shadow-sm">
                  <div className="w-12 px-4 py-3 flex items-center justify-center border-r border-slate-100/50">
                    <input type="checkbox" onChange={selectAll} checked={selectedIds.size > 0 && selectedIds.size === filteredRecords.length} className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer transition-all" />
                  </div>
                  <div className="flex-1 min-w-[200px] px-4 py-3">Part Number</div>
                  <div className="w-48 px-4 py-3">Manufacturer</div>
                  <div className="w-32 px-4 py-3 text-right">Quantity</div>
                  <div className="w-36 px-4 py-3 text-center">Status</div>
                  <div className="w-32 px-4 py-3 text-right">Target Cost</div>
                  <div className="w-36 px-4 py-3 text-right pr-6">Actions</div>
                </div>

                {/* Virtualized Body */}
                <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const row = filteredRecords[virtualRow.index];
                    return (
                      <BomVirtualRow 
                        key={row.id}
                        row={row}
                        virtualRow={virtualRow}
                        isSelected={selectedIds.has(row.id)}
                        onToggleSelect={handleToggleSelect}
                        onManageAlternates={setAlternatesRow}
                        onDelete={(id: string) => deleteRowMutation.mutate(id)}
                        updateRow={updateRowMutation.mutate}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Feature 22: FLOATING ACTION BAR (Appears when items selected) */}
          {selectedIds.size > 0 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-4 z-50 animate-in slide-in-from-bottom-10 fade-in duration-300 ring-1 ring-white/10">
              <div className="flex items-center gap-3 border-r border-slate-700 pr-4">
                <span className="bg-blue-600 text-white text-xs font-black px-2 py-0.5 rounded-md">{selectedIds.size}</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Selected</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                  <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Est. Value</p>
                  <p className="text-xs font-black tracking-tight">{formatCurrency(selectedValue)}</p>
                </div>
                <div className="flex items-center gap-2 pl-2 sm:border-l border-slate-700 sm:pl-4">
                  <button onClick={() => confirmAction("Bulk Delete", `Remove ${selectedIds.size} components from this project?`, "Delete", "danger", () => bulkDeleteMutation.mutate(Array.from(selectedIds)))} className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors focus:outline-none" title="Delete Selected"><Trash2 className="w-4 h-4"/></button>
                  <button 
                    onClick={() => generateQuoteMutation.mutate(Array.from(selectedIds))} 
                    disabled={generateQuoteMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50 focus:outline-none shadow-lg shadow-blue-500/20"
                  >
                    {generateQuoteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShoppingCart className="w-3.5 h-3.5" />} 
                    Quote
                  </button>
                  <button onClick={() => setSelectedIds(new Set())} className="p-2 text-slate-400 hover:text-white rounded-lg focus:outline-none"><X className="w-4 h-4"/></button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-50/50 m-4 md:m-6 lg:m-8 rounded-3xl border border-dashed border-slate-300 animate-in fade-in duration-500">
          <div className="w-20 h-20 bg-white shadow-sm rounded-full flex items-center justify-center mb-5 ring-1 ring-slate-900/5"><Layers className="w-8 h-8 text-blue-500" /></div>
          <h2 className="text-2xl font-extrabold text-slate-900 mb-2 tracking-tight">Select a Project</h2>
          <p className="text-slate-500 font-medium text-sm text-center max-w-sm">Use the dropdown menu to open an existing workspace or create a new one to get started.</p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// VIRTUALIZED MICRO-COMPONENT (CSS Grid based for perfect alignment)
// ============================================================================
const BomVirtualRow = memo(({ row, virtualRow, isSelected, onToggleSelect, onManageAlternates, onDelete, updateRow }: any) => {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editQty, setEditQty] = useState<number>(row.quantity);
  const [copied, setCopied] = useState(false);

  const handleSave = () => {
    if (editQty !== row.quantity && editQty > 0) updateRow({ id: row.id, updates: { quantity: editQty } });
    setIsEditing(false);
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(row.mpn);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const markedUpPrice = row.target_price ? row.target_price * PLATFORM_MARGIN : null;
  const isCritical = row.risk_level === 'critical';
  const hasAlternates = row.alternates?.length > 0;

  return (
    <div 
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: `${virtualRow.size}px`,
        transform: `translateY(${virtualRow.start}px)`
      }}
      className={`flex items-center text-sm border-b border-slate-100 group transition-all duration-200 ${isSelected ? 'bg-blue-50/40' : 'bg-white hover:bg-slate-50/80 hover:shadow-[0_2px_8px_-4px_rgba(0,0,0,0.1)] hover:z-10 relative'}`}
    >
      <div className="w-12 h-full flex items-center justify-center border-r border-slate-100/50">
        <input type="checkbox" checked={isSelected} onChange={() => onToggleSelect(row.id)} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer transition-all" />
      </div>
      
      <div className="flex-1 min-w-[200px] px-4 flex items-center gap-2.5">
        <Cpu className={`w-4 h-4 shrink-0 transition-colors ${isCritical ? 'text-red-500' : 'text-slate-300 group-hover:text-blue-500'}`} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold tracking-tight text-slate-900 text-sm truncate" title={row.mpn}>{row.mpn}</span>
            <button onClick={handleCopy} className="text-slate-300 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-all focus:outline-none active:scale-90"><Copy className="w-3 h-3" /></button>
            {copied && <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-100 uppercase tracking-widest animate-in zoom-in duration-200">Copied</span>}
          </div>
          <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider uppercase text-slate-500 mt-0.5 inline-block">{getCategory(row.mpn)}</span>
        </div>
      </div>
      
      <div className="w-48 px-4 text-xs font-semibold text-slate-600 truncate" title={row.manufacturer}>{row.manufacturer}</div>
      
      <div className="w-32 px-4 flex justify-end">
        {isEditing ? (
          <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-right-2">
            <input 
              type="number" min="1" value={editQty} 
              onChange={(e) => setEditQty(parseInt(e.target.value, 10) || 1)} 
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              className="w-16 px-2 py-1 text-xs font-bold bg-white border border-blue-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm text-center" 
              autoFocus 
              onBlur={handleSave}
            />
          </div>
        ) : (
          <button onClick={() => setIsEditing(true)} className="flex items-center justify-end w-full gap-1.5 group/edit hover:bg-slate-100 px-2 py-1 rounded-md transition-colors focus:outline-none">
            <span className="font-black tracking-tight text-slate-900 text-sm">{row.quantity.toLocaleString()}</span>
            <Edit2 className="w-3 h-3 text-slate-300 opacity-0 group-hover/edit:opacity-100 hover:text-blue-600 transition-opacity" />
          </button>
        )}
      </div>

      <div className="w-36 px-4 flex justify-center">
        {isCritical ? (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-red-200 bg-red-50 text-red-700 text-[9px] font-black uppercase tracking-widest shadow-sm"><AlertTriangle className="w-3 h-3" /> High Risk</span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-blue-200/60 bg-blue-50 text-blue-700 text-[9px] font-black uppercase tracking-widest shadow-sm"><Zap className="w-3 h-3" /> Staged</span>
        )}
      </div>

      <div className="w-32 px-4 text-right">
        <span className="font-black tracking-tight text-sm text-slate-600">{formatCurrency(markedUpPrice)}</span>
      </div>

      <div className="w-36 px-4 flex items-center justify-end gap-2 pr-6">
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
          <button 
            onClick={() => onManageAlternates(row)} 
            className={`text-[9px] uppercase tracking-widest font-bold px-2.5 py-1.5 rounded-lg border transition-all focus:outline-none shadow-sm active:scale-95 ${hasAlternates ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
          >
            Alts ({row.alternates?.length || 0})
          </button>
          <button onClick={() => onDelete(row.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg focus:outline-none transition-colors"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
});
BomVirtualRow.displayName = 'BomVirtualRow';