import { memo, useState } from 'react';
import { ChevronDown, Plus, FileSpreadsheet, Printer, Loader2, X, Layers, BrainCircuit } from 'lucide-react';
import type { Workspace } from '../types'; // Adjust based on your setup

interface BomHeaderProps {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  onWorkspaceChange: (id: string) => void;
  onCreateWorkspace: (name: string) => void;
  isCreating: boolean;
  onUploadClick: () => void;
  isUploading: boolean;
  onToggleQuickAdd: () => void;
  onGetQuotation: () => void;
  selectedCount: number;
  isRequestingQuote: boolean;
}

export const BomHeader = memo(({ 
  workspaces, 
  activeWorkspaceId, 
  onWorkspaceChange, 
  onCreateWorkspace, 
  isCreating,
  onUploadClick, 
  isUploading, 
  onToggleQuickAdd, 
  onGetQuotation, 
  selectedCount, 
  isRequestingQuote 
}: BomHeaderProps) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');

  const activeWorkspaceName = workspaces.find(w => w.id === activeWorkspaceId)?.name || 'Select Project';

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;
    onCreateWorkspace(newWorkspaceName.trim());
    setNewWorkspaceName('');
    setIsCreatingWorkspace(false);
  };

  return (
    <header className="relative bg-white border-b border-gray-100 px-6 py-5 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-5 z-20 transition-all duration-300">
      
      {/* =====================================================================
          LEFT SIDE: PROJECT SELECTOR
          ===================================================================== */}
      <div className="relative w-full md:w-auto min-h-[48px] flex flex-col justify-center">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
          <Layers className="w-3 h-3" /> Engineering Project
        </p>
        
        {isCreatingWorkspace ? (
          <form onSubmit={handleCreate} className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
            <input 
              autoFocus 
              value={newWorkspaceName} 
              onChange={(e) => setNewWorkspaceName(e.target.value)} 
              placeholder="e.g., Drone V4 Mainboard" 
              className="w-full md:w-64 px-4 py-2 text-sm font-bold text-gray-900 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all" 
            />
            <button type="submit" disabled={isCreating || !newWorkspaceName.trim()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50 transition-all flex items-center gap-1.5 shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-500/20">
              {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
            </button>
            <button type="button" onClick={() => setIsCreatingWorkspace(false)} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors focus:outline-none">
              <X className="w-5 h-5" />
            </button>
          </form>
        ) : (
          <>
            <button 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)} 
              className="flex items-center justify-between gap-3 text-2xl font-extrabold text-gray-900 hover:text-blue-600 focus:outline-none transition-colors w-full md:w-auto text-left rounded-lg group"
            >
              {activeWorkspaceName} 
              <div className={`w-7 h-7 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center group-hover:bg-blue-50 group-hover:border-blue-200 transition-all ${isDropdownOpen ? 'rotate-180 bg-blue-50 border-blue-200' : ''}`}>
                <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
              </div>
            </button>

            {/* Custom Dropdown Menu */}
            {isDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)}></div>
                <div className="absolute top-full left-0 mt-3 w-full md:w-80 bg-white border border-gray-100 shadow-2xl rounded-2xl z-20 overflow-hidden animate-in fade-in slide-in-from-top-2 ring-1 ring-gray-900/5">
                  <div className="max-h-72 overflow-y-auto custom-scrollbar p-2">
                    {workspaces.length === 0 ? (
                      <div className="p-6 text-center text-gray-400 text-sm font-medium">No projects found.</div>
                    ) : (
                      workspaces.map(ws => (
                        <button 
                          key={ws.id} 
                          onClick={() => { onWorkspaceChange(ws.id); setIsDropdownOpen(false); }} 
                          className={`w-full text-left px-4 py-3 rounded-xl flex flex-col focus:outline-none transition-all mb-1 ${ws.id === activeWorkspaceId ? 'bg-blue-50 border border-blue-100/50' : 'hover:bg-gray-50 border border-transparent'}`}
                        >
                          <span className={`text-sm font-bold ${ws.id === activeWorkspaceId ? 'text-blue-700' : 'text-gray-900'}`}>{ws.name}</span>
                        </button>
                      ))
                    )}
                  </div>
                  <div className="p-2 bg-gray-50/50 border-t border-gray-100">
                    <button onClick={() => { setIsCreatingWorkspace(true); setIsDropdownOpen(false); }} className="w-full py-3 flex items-center justify-center gap-2 text-sm font-bold text-gray-700 hover:text-gray-900 bg-white border border-gray-200 hover:border-gray-300 rounded-xl transition-all shadow-sm focus:outline-none focus:ring-4 focus:ring-gray-100 active:scale-95">
                      <Plus className="w-4 h-4" /> New Empty Project
                    </button>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
      
      {/* =====================================================================
          RIGHT SIDE: ACTION TOOLBAR
          ===================================================================== */}
      <div className="flex flex-wrap items-center gap-3">
        <button 
          onClick={onUploadClick} 
          disabled={isUploading || !activeWorkspaceId} 
          className="text-sm font-bold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 hover:text-gray-900 px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 disabled:opacity-50 shadow-sm focus:outline-none focus:ring-4 focus:ring-gray-100"
        >
          {isUploading ? <Loader2 className="w-4 h-4 animate-spin text-blue-600"/> : <FileSpreadsheet className="w-4 h-4" />}
          <span className="hidden sm:inline">Upload CSV</span>
        </button>

        <button 
          onClick={onToggleQuickAdd} 
          disabled={!activeWorkspaceId} 
          className="text-sm font-bold text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 disabled:opacity-50 shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-500/20"
        >
          <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Manual Entry</span>
        </button>

        <div className="h-8 w-px bg-gray-200 mx-1 hidden sm:block"></div>
        
        <button onClick={() => window.print()} className="text-gray-400 hover:text-gray-900 hover:bg-gray-100 p-2.5 rounded-xl hidden sm:block focus:outline-none transition-colors">
          <Printer className="w-5 h-5" />
        </button>

        <button 
          onClick={onGetQuotation} 
          disabled={selectedCount === 0 || isRequestingQuote} 
          className="bg-gray-900 hover:bg-black text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-gray-900/10 focus:outline-none focus:ring-4 focus:ring-gray-900/20 active:scale-95"
        >
          {isRequestingQuote ? (
            <Loader2 className="w-4 h-4 animate-spin" /> 
          ) : (
            <BrainCircuit className="w-4 h-4 text-blue-400" />
          )}
          Run Market Analysis
          {selectedCount > 0 && (
            <span className="ml-1.5 bg-white/20 text-white px-2 py-0.5 rounded-md text-[10px] font-mono leading-none flex items-center">
              {selectedCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
});

BomHeader.displayName = 'BomHeader';