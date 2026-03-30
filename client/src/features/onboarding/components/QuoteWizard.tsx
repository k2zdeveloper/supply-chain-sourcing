import { useState, useRef, useCallback, memo, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Papa, { type ParseResult } from 'papaparse';
import { 
  UploadCloud, FileSpreadsheet, Edit3, ShieldCheck, 
  ArrowLeft, Plus, Trash2, Cpu, BrainCircuit, Activity
} from 'lucide-react';

import type { BomRecord, RiskLevel, LifecycleStatus } from '@/features/bom/types';

// ============================================================================
// TYPES & SCHEMAS
// ============================================================================

export type ParsedBomPayload = {
  projectName: string;
  items: Omit<BomRecord, 'id' | 'workspace_id' | 'tenant_id' | 'created_at' | 'updated_at'>[];
};

type WizardStep = 'select-method' | 'upload' | 'manual' | 'processing';

const manualEntrySchema = z.object({
  projectName: z.string().min(2, 'A project name helps you track this later.').trim(),
  parts: z.array(z.object({
    mpn: z.string().min(2, 'We need an MPN to find this part.').trim(),
    manufacturer: z.string().optional(),
    quantity: z.number().int().min(1, 'Need at least 1.'),
    targetPrice: z.number().positive('Price must be greater than zero.').optional()
  })).min(1, 'You need at least one component to start a project.')
});

type ManualEntryData = z.infer<typeof manualEntrySchema>;

const csvRowSchema = z.object({
  mpn: z.string().min(1, 'MPN required').trim(),
  manufacturer: z.string().trim().default('Unknown'),
  quantity: z.number().int().positive('Quantity must be > 0').default(1),
  target_price: z.number().positive().nullable(),
  lead_time_weeks: z.number().int().nonnegative().nullable().optional()
});

interface QuoteWizardProps {
  onSuccess: (payload: ParsedBomPayload) => void;
  defaultStep?: WizardStep;
}

// Processing Log Sequence to make the wait time engaging
const PROCESSING_LOGS = [
  "Initializing neural parser...",
  "Extracting component parameters...",
  "Validating MPN nomenclature...",
  "Mapping global supplier chains...",
  "Finalizing data payload..."
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const QuoteWizard = memo(({ onSuccess, defaultStep = 'select-method' }: QuoteWizardProps) => {
  const [step, setStep] = useState<WizardStep>(defaultStep);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [logIndex, setLogIndex] = useState(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { register, control, handleSubmit, formState: { errors } } = useForm<ManualEntryData>({
    resolver: zodResolver(manualEntrySchema),
    defaultValues: { 
      projectName: '', 
      parts: [{ mpn: '', manufacturer: '', quantity: 1, targetPrice: undefined }] 
    }
  });

  const { fields, append, remove } = useFieldArray({ control, name: "parts" });

  // Cycles the processing text while the parser runs
  useEffect(() => {
    if (step === 'processing') {
      const interval = setInterval(() => {
        setLogIndex((prev) => (prev < PROCESSING_LOGS.length - 1 ? prev + 1 : prev));
      }, 400); // Shift text every 400ms
      return () => clearInterval(interval);
    } else {
      setLogIndex(0);
    }
  }, [step]);

  const parseSafeNumber = (val: unknown): number | null => {
    if (!val || (typeof val !== 'string' && typeof val !== 'number')) return null;
    const clean = String(val).replace(/[^0-9.]/g, '');
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? null : parsed;
  };

  const processFile = useCallback((uploadedFile: File) => {
    setError(null);

    if (uploadedFile.type !== 'text/csv' && !uploadedFile.name.match(/\.csv$/i)) {
      setError("Format violation: Strict .CSV enforcement active. Please upload a valid CSV file."); 
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setStep('processing'); 
    setProgress(15);
    const projectName = uploadedFile.name.replace(/\.[^/.]+$/, "");

    Papa.parse<Record<string, string | undefined>>(uploadedFile, {
      header: true, skipEmptyLines: true, worker: true,
      complete: (results: ParseResult<Record<string, string | undefined>>) => {
        try {
          const items: ParsedBomPayload['items'] = [];
          setProgress(40);
          
          results.data.forEach((row, index) => {
            const rawData = {
              mpn: (row['Manufacturer Part Number (MPN)'] || row['MPN'])?.trim() || '',
              manufacturer: (row['Manufacturer'] || row['Mfr'])?.trim() || 'Unknown',
              quantity: parseInt(String(row['Quantity'] || row['Qty']), 10) || 0,
              target_price: parseSafeNumber(row['Target Price (Optional)'] || row['Target Price']),
              lead_time_weeks: parseSafeNumber(row['Lead Time (Weeks)'])
            };

            const validatedRow = csvRowSchema.safeParse(rawData);
            
            if (!validatedRow.success) {
              const errorMsg = validatedRow.error.issues[0].message;
              throw new Error(`Data corruption at row ${index + 1}: ${errorMsg}.`);
            }

            items.push({
              ...validatedRow.data,
              lifecycle_status: 'Active' as LifecycleStatus, 
              global_stock: 0, 
              risk_level: 'low' as RiskLevel,
              alternates: [],
              lead_time_weeks: validatedRow.data.lead_time_weeks || null
            });
          });

          if (items.length === 0) throw new Error("Ingestion failed: No valid components found.");
          
          setProgress(100);
          // Extend delay slightly so user can enjoy the high-tech animation completing
          setTimeout(() => onSuccess({ projectName, items }), 1200);
          
        } catch (err: unknown) { 
          const msg = err instanceof Error ? err.message : 'Parsing sequence failed.';
          setError(msg); 
          setStep('upload'); 
        } finally {
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      },
      error: () => { 
        setError("I/O Error: Failed to read file stream."); 
        setStep('upload'); 
        if (fileInputRef.current) fileInputRef.current.value = ''; 
      }
    });
  }, [onSuccess]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) processFile(e.dataTransfer.files[0]);
  }, [processFile]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) processFile(e.target.files[0]);
  }, [processFile]);

  const onSubmitManual = useCallback((data: ManualEntryData) => {
    setStep('processing'); setProgress(50);
    const items: ParsedBomPayload['items'] = data.parts.map(part => ({
      mpn: part.mpn, manufacturer: part.manufacturer || 'Unknown', quantity: part.quantity,
      target_price: part.targetPrice ?? null, lifecycle_status: 'Active' as LifecycleStatus,
      global_stock: 0, lead_time_weeks: null, risk_level: 'low' as RiskLevel, alternates: []
    }));
    setProgress(100);
    setTimeout(() => onSuccess({ projectName: data.projectName, items }), 1200);
  }, [onSuccess]);

  const handleDownloadTemplate = useCallback(() => {
    const headers = "Manufacturer Part Number (MPN),Manufacturer,Quantity,Target Price (Optional),Lead Time (Weeks)\n";
    const sampleData = "STM32F405RGT6,STMicroelectronics,100,5.50,12\n";
    const blob = new Blob([headers + sampleData], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = "SCS_BOM_Template.csv"; a.click();
    window.URL.revokeObjectURL(url);
  }, []);

  return (
    <div className={`w-full rounded-[2rem] shadow-2xl relative overflow-hidden font-sans transition-all duration-700 ease-out flex flex-col min-h-[460px]
      ${step === 'processing' ? 'bg-gray-950 border-gray-800' : 'bg-white border-gray-100 ring-1 ring-gray-900/5'}
    `}>
      
      {/* Inline Keyframes for the Cinematic Scanner */}
      <style>{`
        @keyframes scan {
          0% { transform: translateY(-100px); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(400px); opacity: 0; }
        }
      `}</style>

      {/* Decorative Top Accent Line */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 z-20" />

      {/* =====================================================================
          SHOW-STOPPING PROCESSING STATE (DARK THEME INVERSION)
          ===================================================================== */}
      {step === 'processing' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center text-white animate-in fade-in zoom-in-95 duration-500 overflow-hidden">
          
          {/* Animated Tech Grid */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#3b82f61a_1px,transparent_1px),linear-gradient(to_bottom,#3b82f61a_1px,transparent_1px)] bg-[size:32px_32px]" />
          
          {/* Laser Scanner Line */}
          <div className="absolute top-0 left-0 w-full h-[2px] bg-blue-400 shadow-[0_0_20px_5px_rgba(59,130,246,0.6)] animate-[scan_2.5s_ease-in-out_infinite] z-0" />

          <div className="relative z-10 flex flex-col items-center">
            <div className="relative w-20 h-20 mb-8 flex items-center justify-center">
              <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping" />
              <div className="absolute inset-2 bg-blue-600/30 rounded-full animate-pulse" />
              <BrainCircuit className="w-10 h-10 text-blue-400" />
            </div>
            
            <h3 className="text-2xl font-extrabold text-white mb-3 tracking-tight">Processing Payload</h3>
            
            {/* Dynamic Console Text */}
            <div className="h-6 flex items-center justify-center overflow-hidden">
              <p key={logIndex} className="text-blue-300 text-[11px] font-mono uppercase tracking-widest animate-in slide-in-from-bottom-2 fade-in duration-300">
                {PROCESSING_LOGS[logIndex]}
              </p>
            </div>

            {/* Glowing Progress Bar */}
            <div className="w-64 h-1.5 bg-gray-800 rounded-full overflow-hidden mt-8 shadow-inner ring-1 ring-white/10">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-400 transition-all duration-[400ms] ease-out relative" 
                style={{ width: `${progress}%` }} 
              >
                <div className="absolute top-0 right-0 bottom-0 w-10 bg-gradient-to-r from-transparent to-white/50 animate-pulse" />
              </div>
            </div>
            <p className="text-gray-500 text-[10px] mt-3 font-mono tracking-widest">{progress}% VERIFIED</p>
          </div>
        </div>
      )}

      {/* =====================================================================
          STANDARD UI CONTENT
          ===================================================================== */}
      <div className={`flex-1 flex flex-col pt-8 transition-opacity duration-500 ${step === 'processing' ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        
        {/* Dynamic Header */}
        <div className="px-8 mb-6 shrink-0">
          {step !== 'select-method' && (
            <button onClick={() => setStep('select-method')} className="text-[11px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-900 transition-all flex items-center gap-1.5 mb-5 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded p-1 -ml-1 group">
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" /> Start Over
            </button>
          )}
          <h3 className="text-3xl font-extrabold tracking-tight text-gray-900">
            {step === 'select-method' ? "Let's build your BOM." : step === 'upload' ? "Upload your list." : "Tell us what you need."}
          </h3>
          <p className="text-sm text-gray-500 font-medium mt-1.5 max-w-sm">
            {step === 'select-method' && "Choose how you'd like to import your components to launch the AI engine."}
            {step === 'upload' && "Drop your CSV file below. The AI will handle the parsing and MPN mapping."}
            {step === 'manual' && "Enter your parts manually below to start a quick, precision spot-buy."}
          </p>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-700 text-sm font-semibold flex items-start gap-3 animate-in slide-in-from-top-4 shadow-sm">
               <ShieldCheck className="w-5 h-5 text-red-500 shrink-0 mt-0.5" /> 
               <span className="leading-snug">{error}</span>
            </div>
          )}
        </div>

        {/* Sliding Content Container */}
        <div className="flex-1 px-8 pb-8 flex flex-col min-h-0 relative overflow-hidden">
          
          {/* STEP 1: Select Method */}
          {step === 'select-method' && (
            <div className="grid sm:grid-cols-2 gap-4 flex-1 animate-in zoom-in-[0.98] fade-in duration-500 ease-out">
              <button onClick={() => setStep('upload')} className="group relative flex flex-col justify-center items-start p-6 bg-white hover:bg-gray-50 border border-gray-200 hover:border-blue-300 rounded-[1.5rem] transition-all text-left outline-none focus-visible:border-blue-500 focus-visible:ring-4 focus-visible:ring-blue-500/20 shadow-sm hover:shadow-lg hover:-translate-y-1">
                <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center shadow-inner mb-4 group-hover:bg-blue-50 group-hover:scale-110 transition-all duration-300 border border-gray-100">
                  <FileSpreadsheet className="w-6 h-6 text-blue-600" />
                </div>
                <span className="font-bold text-gray-900 text-lg">Upload a CSV</span>
                <span className="text-xs text-gray-500 mt-2 font-medium leading-relaxed">Perfect for large projects. Drop your existing list right into our engine.</span>
              </button>

              <button onClick={() => setStep('manual')} className="group relative flex flex-col justify-center items-start p-6 bg-white hover:bg-gray-50 border border-gray-200 hover:border-blue-300 rounded-[1.5rem] transition-all text-left outline-none focus-visible:border-blue-500 focus-visible:ring-4 focus-visible:ring-blue-500/20 shadow-sm hover:shadow-lg hover:-translate-y-1">
                <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center shadow-inner mb-4 group-hover:bg-blue-50 group-hover:scale-110 transition-all duration-300 border border-gray-100">
                  <Edit3 className="w-6 h-6 text-blue-600" />
                </div>
                <span className="font-bold text-gray-900 text-lg">Enter Manually</span>
                <span className="text-xs text-gray-500 mt-2 font-medium leading-relaxed">Great for quick spot-buys or checking availability on a few specific parts.</span>
              </button>
            </div>
          )}

          {/* STEP 2A: Upload Zone (Tactical Dropzone) */}
          {step === 'upload' && (
            <div className="flex flex-col gap-6 flex-1 animate-in slide-in-from-right-12 fade-in duration-500 ease-out">
              <div 
                className={`flex-1 border-2 border-dashed rounded-[1.5rem] p-10 flex flex-col items-center justify-center text-center transition-all duration-300 cursor-pointer group outline-none focus-visible:border-blue-500 focus-visible:ring-4 focus-visible:ring-blue-500/20 min-h-[220px] relative overflow-hidden
                  ${isDragging 
                    ? 'border-blue-500 bg-blue-50/80 scale-[1.02] shadow-[0_0_30px_rgba(59,130,246,0.15)] ring-4 ring-blue-500/20' 
                    : 'border-gray-300 hover:border-blue-400 bg-gray-50/50 hover:bg-white'
                  }
                `}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onKeyDown={(e) => { if (e.key === 'Enter') fileInputRef.current?.click(); }}
                tabIndex={0}
                role="button"
              >
                {/* Internal Decorative Grid */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#00000005_1px,transparent_1px),linear-gradient(to_bottom,#00000005_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />

                <div className={`w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-5 transition-all duration-500 shadow-sm ring-1 ring-gray-900/5 relative z-10
                  ${isDragging ? 'scale-125 shadow-lg shadow-blue-500/20 rotate-6' : 'group-hover:scale-110 group-hover:-rotate-3 group-hover:shadow-md'}
                `}>
                  <UploadCloud className={`w-8 h-8 transition-colors ${isDragging ? 'text-blue-600' : 'text-gray-400 group-hover:text-blue-500'}`} />
                </div>
                <p className={`text-lg font-bold transition-colors relative z-10 ${isDragging ? 'text-blue-700' : 'text-gray-900'}`}>
                  {isDragging ? 'Release to Initialize' : 'Click or Drag CSV Here'}
                </p>
                <p className="text-xs text-gray-400 mt-2 font-bold tracking-widest uppercase relative z-10">Max payload: 5MB</p>
                <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileChange} tabIndex={-1} />
              </div>

              <div className="bg-white border border-gray-200 rounded-[1.25rem] p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0 shadow-sm">
                <div className="space-y-1">
                  <p className="text-sm font-bold text-gray-900">Need a clean start?</p>
                  <p className="text-xs text-gray-500 font-medium">Download our template to ensure perfect accuracy.</p>
                </div>
                <button type="button" onClick={handleDownloadTemplate} className="w-full sm:w-auto px-5 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 text-xs font-bold rounded-xl transition-all shadow-sm focus:outline-none focus:ring-4 focus:ring-gray-100 active:scale-95">
                  Download Template
                </button>
              </div>
            </div>
          )}

          {/* STEP 2B: Manual Form */}
          {step === 'manual' && (
            <form onSubmit={handleSubmit(onSubmitManual)} className="flex flex-col gap-6 flex-1 min-h-0 animate-in slide-in-from-right-12 fade-in duration-500 ease-out">
              <div className="space-y-2 shrink-0">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">Project Name</label>
                <input 
                  {...register('projectName')} 
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3.5 text-gray-900 text-sm font-semibold focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all shadow-sm" 
                  placeholder="e.g., Drone V4 Mainboard" 
                  autoFocus
                />
                {errors.projectName && <p className="text-[10px] text-red-500 font-bold pl-1">{errors.projectName.message}</p>}
              </div>

              <div className="flex-1 flex flex-col bg-gray-50/50 rounded-2xl border border-gray-200 p-2 overflow-hidden min-h-0 shadow-inner">
                <div className="flex items-center justify-between px-3 py-2 shrink-0">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Components</label>
                  <span className="text-[10px] text-gray-500 font-bold bg-white border border-gray-200 px-2 py-0.5 rounded-md shadow-sm">{fields.length} Line{fields.length !== 1 ? 's' : ''}</span>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar p-1 space-y-2">
                  {fields.map((field, index) => (
                    <div key={field.id} className="flex gap-2 items-start bg-white p-3 rounded-xl border border-gray-100 shadow-sm transition-all focus-within:ring-1 focus-within:ring-blue-500/30 focus-within:border-blue-300">
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-2">
                        <div className="sm:col-span-5">
                          <input {...register(`parts.${index}.mpn` as const)} placeholder="Part Number (Req)" className="w-full bg-transparent border-b border-gray-100 px-2 py-1.5 text-gray-900 font-mono text-xs font-semibold focus:border-blue-500 outline-none transition-colors" />
                          {errors.parts?.[index]?.mpn && <p className="text-[10px] text-red-500 font-bold mt-1 px-2">{errors.parts[index]?.mpn?.message}</p>}
                        </div>
                        <div className="sm:col-span-3">
                          <input {...register(`parts.${index}.manufacturer` as const)} placeholder="Mfr (Opt)" className="w-full bg-transparent border-b border-gray-100 px-2 py-1.5 text-gray-600 text-xs focus:border-blue-500 outline-none transition-colors" />
                        </div>
                        <div className="sm:col-span-2">
                          <input {...register(`parts.${index}.quantity` as const, { valueAsNumber: true })} type="number" placeholder="Qty" className="w-full bg-transparent border-b border-gray-100 px-2 py-1.5 text-gray-900 text-xs font-semibold focus:border-blue-500 outline-none transition-colors" />
                          {errors.parts?.[index]?.quantity && <p className="text-[10px] text-red-500 font-bold mt-1 px-2">{errors.parts[index]?.quantity?.message}</p>}
                        </div>
                        <div className="sm:col-span-2">
                          <input {...register(`parts.${index}.targetPrice` as const, { valueAsNumber: true })} type="number" step="0.01" placeholder="Price ($)" className="w-full bg-transparent border-b border-gray-100 px-2 py-1.5 text-gray-600 text-xs focus:border-blue-500 outline-none transition-colors" />
                        </div>
                      </div>
                      <button type="button" onClick={() => remove(index)} className="p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors mt-0.5 focus:outline-none" disabled={fields.length === 1}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="p-1 shrink-0 mt-2">
                  <button type="button" onClick={() => append({ mpn: '', manufacturer: '', quantity: 1, targetPrice: undefined })} className="w-full py-2.5 border border-dashed border-gray-300 hover:border-blue-400 bg-white hover:bg-blue-50 rounded-xl text-blue-600 text-xs font-bold flex items-center justify-center gap-1.5 transition-all focus:outline-none focus:ring-4 focus:ring-blue-500/20 shadow-sm active:scale-[0.99]">
                    <Plus className="w-3.5 h-3.5" /> Add Component
                  </button>
                </div>
              </div>

              <div className="shrink-0 mt-2">
                <button type="submit" className="w-full bg-gray-900 hover:bg-black text-white font-bold rounded-xl px-4 py-4 transition-all flex items-center justify-center gap-2 shadow-lg shadow-gray-900/20 focus:outline-none focus:ring-4 focus:ring-gray-900/30 active:scale-[0.98]">
                  <Activity className="w-4 h-4" /> Engage Neural Parser
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
});

QuoteWizard.displayName = 'QuoteWizard';