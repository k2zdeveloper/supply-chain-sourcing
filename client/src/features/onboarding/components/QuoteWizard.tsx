import { useState, useRef, useCallback, memo, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Papa, { type ParseResult } from 'papaparse';
import { 
  UploadCloud, FileSpreadsheet, Edit3, ShieldCheck, 
  ArrowLeft, Plus, Trash2, Cpu, BrainCircuit, Activity,
  Terminal
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
  "> INITIALIZING NEURAL PARSER...",
  "> EXTRACTING COMPONENT PARAMETERS...",
  "> VALIDATING MPN NOMENCLATURE...",
  "> MAPPING GLOBAL SUPPLIER CHAINS...",
  "> FINALIZING DATA PAYLOAD..."
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
    <div className={`w-full rounded-sm shadow-2xl relative overflow-hidden transition-all duration-700 ease-out flex flex-col min-h-[460px]
      ${step === 'processing' ? 'bg-[#020617] border border-[#D4AF37]/50' : 'bg-slate-950 border border-slate-800'}
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
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent z-20" />

      {/* =====================================================================
          SHOW-STOPPING PROCESSING STATE (TERMINAL THEME)
          ===================================================================== */}
      {step === 'processing' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center text-white animate-in fade-in zoom-in-95 duration-500 overflow-hidden">
          
          {/* Animated Tech Grid */}
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: `linear-gradient(to right, rgba(212, 175, 55, 0.5) 1px, transparent 1px), linear-gradient(to bottom, rgba(212, 175, 55, 0.5) 1px, transparent 1px)`, backgroundSize: '32px 32px' }} />
          
          {/* Laser Scanner Line */}
          <div className="absolute top-0 left-0 w-full h-[2px] bg-[#D4AF37] shadow-[0_0_20px_5px_rgba(212,175,55,0.6)] animate-[scan_2.5s_ease-in-out_infinite] z-0" />

          <div className="relative z-10 flex flex-col items-center">
            <div className="relative w-20 h-20 mb-8 flex items-center justify-center">
              <div className="absolute inset-0 bg-[#D4AF37]/10 rounded border border-[#D4AF37]/30 animate-ping" />
              <div className="absolute inset-2 bg-[#D4AF37]/20 rounded border border-[#D4AF37]/50 animate-pulse" />
              <BrainCircuit className="w-10 h-10 text-[#FCD34D]" />
            </div>
            
            <h3 className="text-2xl font-black text-white mb-3 tracking-widest uppercase font-mono">Processing Payload</h3>
            
            {/* Dynamic Console Text */}
            <div className="h-6 flex items-center justify-center overflow-hidden">
              <p key={logIndex} className="text-[#D4AF37] text-[11px] font-mono uppercase tracking-widest animate-in slide-in-from-bottom-2 fade-in duration-300">
                {PROCESSING_LOGS[logIndex]}
              </p>
            </div>

            {/* Glowing Progress Bar */}
            <div className="w-64 h-1.5 bg-slate-900 border border-slate-800 rounded-sm overflow-hidden mt-8 shadow-inner">
              <div 
                className="h-full bg-[#D4AF37] transition-all duration-[400ms] ease-out relative shadow-[0_0_10px_#D4AF37]" 
                style={{ width: `${progress}%` }} 
              >
                <div className="absolute top-0 right-0 bottom-0 w-10 bg-gradient-to-r from-transparent to-white/50 animate-pulse" />
              </div>
            </div>
            <p className="text-slate-500 text-[10px] mt-3 font-mono tracking-widest">{progress}% VERIFIED</p>
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
            <button onClick={() => setStep('select-method')} className="text-[11px] font-bold uppercase tracking-widest text-slate-500 hover:text-[#D4AF37] transition-all flex items-center gap-1.5 mb-5 outline-none font-mono group">
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" /> START OVER
            </button>
          )}
          <h3 className="text-2xl font-black tracking-widest text-white uppercase font-mono flex items-center gap-2">
            <Terminal className="w-6 h-6 text-[#D4AF37]" />
            {step === 'select-method' ? "Let's build your BOM." : step === 'upload' ? "Upload Payload." : "Manual Entry."}
          </h3>
          <p className="text-xs text-slate-400 font-mono mt-2 max-w-sm uppercase tracking-wider">
            {step === 'select-method' && <>&gt; Choose how you'd like to import your components to launch the AI engine.</>}
            {step === 'upload' && <>&gt; Drop your CSV file below for ingestion.</>}
            {step === 'manual' && <>&gt; Enter parts manually for a precision spot-buy.</>}
          </p>

          {error && (
            <div className="mt-4 p-4 bg-red-950/30 border border-red-900/50 rounded-sm text-red-400 text-xs font-mono flex items-start gap-3 animate-in slide-in-from-top-4 shadow-sm uppercase">
               <ShieldCheck className="w-4 h-4 text-red-500 shrink-0 mt-0.5" /> 
               <span className="leading-snug">{error}</span>
            </div>
          )}
        </div>

        {/* Sliding Content Container */}
        <div className="flex-1 px-8 pb-8 flex flex-col min-h-0 relative overflow-hidden">
          
          {/* STEP 1: Select Method */}
          {step === 'select-method' && (
            <div className="grid sm:grid-cols-2 gap-4 flex-1 animate-in zoom-in-[0.98] fade-in duration-500 ease-out">
              <button onClick={() => setStep('upload')} className="group relative flex flex-col justify-center items-start p-6 bg-slate-900/50 hover:bg-slate-900 border border-slate-800 hover:border-[#D4AF37]/50 rounded-sm transition-all text-left outline-none shadow-sm">
                <div className="w-12 h-12 bg-[#020617] rounded border border-slate-800 flex items-center justify-center shadow-inner mb-4 group-hover:border-[#D4AF37]/50 transition-all duration-300">
                  <FileSpreadsheet className="w-6 h-6 text-[#D4AF37]" />
                </div>
                <span className="font-bold text-white text-sm font-mono uppercase tracking-widest">Upload a CSV</span>
                <span className="text-[10px] text-slate-500 mt-2 font-mono uppercase leading-relaxed tracking-wider">&gt; Perfect for large projects. Drop your existing list right into our engine.</span>
              </button>

              <button onClick={() => setStep('manual')} className="group relative flex flex-col justify-center items-start p-6 bg-slate-900/50 hover:bg-slate-900 border border-slate-800 hover:border-[#D4AF37]/50 rounded-sm transition-all text-left outline-none shadow-sm">
                <div className="w-12 h-12 bg-[#020617] rounded border border-slate-800 flex items-center justify-center shadow-inner mb-4 group-hover:border-[#D4AF37]/50 transition-all duration-300">
                  <Edit3 className="w-6 h-6 text-[#D4AF37]" />
                </div>
                <span className="font-bold text-white text-sm font-mono uppercase tracking-widest">Enter Manually</span>
                <span className="text-[10px] text-slate-500 mt-2 font-mono uppercase leading-relaxed tracking-wider">&gt; Great for quick spot-buys or checking availability on a few specific parts.</span>
              </button>
            </div>
          )}

          {/* STEP 2A: Upload Zone (Tactical Dropzone) */}
          {step === 'upload' && (
            <div className="flex flex-col gap-6 flex-1 animate-in slide-in-from-right-12 fade-in duration-500 ease-out">
              <div 
                className={`flex-1 border-2 border-dashed rounded-sm p-10 flex flex-col items-center justify-center text-center transition-all duration-300 cursor-pointer group outline-none min-h-[220px] relative overflow-hidden
                  ${isDragging 
                    ? 'border-[#D4AF37] bg-[#D4AF37]/10 scale-[1.02] shadow-[inset_0_0_30px_rgba(212,175,55,0.15)]' 
                    : 'border-slate-700 hover:border-[#D4AF37]/50 bg-slate-900/30 hover:bg-slate-900'
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
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)`, backgroundSize: '16px 16px' }} />

                <div className={`w-16 h-16 bg-[#020617] rounded flex items-center justify-center mb-5 transition-all duration-500 border border-slate-800 relative z-10
                  ${isDragging ? 'scale-125 border-[#D4AF37] rotate-6 shadow-[0_0_15px_rgba(212,175,55,0.2)]' : 'group-hover:scale-110 group-hover:-rotate-3 group-hover:border-[#D4AF37]/50'}
                `}>
                  <UploadCloud className={`w-8 h-8 transition-colors ${isDragging ? 'text-[#FCD34D]' : 'text-slate-500 group-hover:text-[#D4AF37]'}`} />
                </div>
                <p className={`text-sm font-bold font-mono tracking-widest transition-colors relative z-10 uppercase ${isDragging ? 'text-[#FCD34D]' : 'text-white'}`}>
                  {isDragging ? 'RELEASE TO INITIALIZE' : <>&gt; CLICK OR DRAG CSV HERE</>}
                </p>
                <p className="text-[10px] text-slate-500 mt-2 font-mono tracking-widest uppercase relative z-10">Max payload: 5MB</p>
                <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileChange} tabIndex={-1} />
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-sm p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
                <div className="space-y-1">
                  <p className="text-[11px] font-bold text-slate-300 font-mono uppercase tracking-widest">&gt; Need a clean start?</p>
                  <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">Download strict formatting template.</p>
                </div>
                <button type="button" onClick={handleDownloadTemplate} className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 hover:border-[#D4AF37] text-[10px] font-bold rounded-sm transition-all shadow-sm focus:outline-none uppercase tracking-widest font-mono">
                  Get Template
                </button>
              </div>
            </div>
          )}

          {/* STEP 2B: Manual Form */}
          {step === 'manual' && (
            <form onSubmit={handleSubmit(onSubmitManual)} className="flex flex-col gap-6 flex-1 min-h-0 animate-in slide-in-from-right-12 fade-in duration-500 ease-out">
              <div className="space-y-2 shrink-0">
                <label className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-widest pl-1 font-mono">&gt; Project Name</label>
                <input 
                  {...register('projectName')} 
                  className="w-full bg-[#020617] border border-slate-700 rounded-sm px-4 py-3 text-white text-sm font-mono focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] outline-none transition-all shadow-sm placeholder:text-slate-600" 
                  placeholder="E.G., DRONE V4 MAINBOARD" 
                  autoFocus
                />
                {errors.projectName && <p className="text-[10px] text-red-400 font-bold pl-1 font-mono uppercase">{errors.projectName.message}</p>}
              </div>

              <div className="flex-1 flex flex-col bg-[#020617]/50 rounded-sm border border-slate-800 p-2 overflow-hidden min-h-0">
                <div className="flex items-center justify-between px-3 py-2 shrink-0">
                  <label className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-widest font-mono">&gt; Components</label>
                  <span className="text-[10px] text-[#FCD34D] font-mono font-bold bg-[#D4AF37]/10 border border-[#D4AF37]/30 px-2 py-0.5 rounded-sm">{fields.length} LINE{fields.length !== 1 ? 'S' : ''}</span>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar p-1 space-y-2">
                  {fields.map((field, index) => (
                    <div key={field.id} className="flex gap-2 items-start bg-slate-900 p-3 rounded-sm border border-slate-800 shadow-sm transition-all focus-within:border-[#D4AF37]/50">
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-2">
                        <div className="sm:col-span-5">
                          <input {...register(`parts.${index}.mpn` as const)} placeholder="MPN (REQ)" className="w-full bg-transparent border-b border-slate-700 px-2 py-1 text-white font-mono text-xs focus:border-[#D4AF37] outline-none transition-colors placeholder:text-slate-600 uppercase" />
                          {errors.parts?.[index]?.mpn && <p className="text-[9px] text-red-400 font-bold mt-1 px-2 font-mono uppercase">{errors.parts[index]?.mpn?.message}</p>}
                        </div>
                        <div className="sm:col-span-3">
                          <input {...register(`parts.${index}.manufacturer` as const)} placeholder="MFR (OPT)" className="w-full bg-transparent border-b border-slate-700 px-2 py-1 text-slate-300 font-mono text-xs focus:border-[#D4AF37] outline-none transition-colors placeholder:text-slate-600 uppercase" />
                        </div>
                        <div className="sm:col-span-2">
                          <input {...register(`parts.${index}.quantity` as const, { valueAsNumber: true })} type="number" placeholder="QTY" className="w-full bg-transparent border-b border-slate-700 px-2 py-1 text-white font-mono text-xs focus:border-[#D4AF37] outline-none transition-colors placeholder:text-slate-600" />
                          {errors.parts?.[index]?.quantity && <p className="text-[9px] text-red-400 font-bold mt-1 px-2 font-mono uppercase">{errors.parts[index]?.quantity?.message}</p>}
                        </div>
                        <div className="sm:col-span-2">
                          <input {...register(`parts.${index}.targetPrice` as const, { valueAsNumber: true })} type="number" step="0.01" placeholder="PRICE ($)" className="w-full bg-transparent border-b border-slate-700 px-2 py-1 text-slate-300 font-mono text-xs focus:border-[#D4AF37] outline-none transition-colors placeholder:text-slate-600" />
                        </div>
                      </div>
                      <button type="button" onClick={() => remove(index)} className="p-1.5 text-slate-500 hover:bg-red-950/30 hover:text-red-400 rounded-sm transition-colors mt-0.5 focus:outline-none" disabled={fields.length === 1}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="p-1 shrink-0 mt-2">
                  <button type="button" onClick={() => append({ mpn: '', manufacturer: '', quantity: 1, targetPrice: undefined })} className="w-full py-2.5 border border-dashed border-slate-700 hover:border-[#D4AF37]/50 bg-slate-900/50 hover:bg-slate-900 rounded-sm text-[#D4AF37] text-[10px] font-bold font-mono uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all focus:outline-none shadow-sm active:scale-[0.99]">
                    <Plus className="w-3.5 h-3.5" /> Add Row
                  </button>
                </div>
              </div>

              <div className="shrink-0 mt-2">
                <button type="submit" className="w-full bg-[#D4AF37] hover:bg-[#FCD34D] text-black font-black font-mono tracking-widest uppercase rounded-sm px-4 py-3 transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(212,175,55,0.2)] focus:outline-none active:scale-[0.98]">
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