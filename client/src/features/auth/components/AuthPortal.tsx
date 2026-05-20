import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/useAuthStore';
import { 
  Loader2, Mail, ArrowRight, RefreshCcw, ArrowLeft, Eye, EyeOff, Database, CheckCircle2, Lock, ShieldAlert, XCircle, Terminal 
} from 'lucide-react';
import { 
  enterpriseSignupSchema, 
  verificationSchema,
  loginSchema, 
  type EnterpriseSignupData, 
  type VerificationData,
  type LoginData
} from '@/features/onboarding/schema';

// Database API interactions
import { createWorkspace, addBomRows } from '@/features/bom/api';
// The strict payload type passed down from the Landing Page
import type { ParsedBomPayload } from '@/features/onboarding/components/QuoteWizard';

type PipelineStep = 'intent' | 'login' | 'capture' | 'verify';
type AsyncValidationState = 'idle' | 'checking' | 'available' | 'conflict';

type AuthPortalProps = {
  stagedBom?: ParsedBomPayload | null;
};

export const AuthPortal = memo(({ stagedBom }: AuthPortalProps) => {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);

  // If we have a staged BOM from the landing page, skip the intent screen and go straight to capture
  const [step, setStep] = useState<PipelineStep>(stagedBom ? 'capture' : 'intent');
  
  const [registeredEmail, setRegisteredEmail] = useState<string>('');
  const [apiError, setApiError] = useState<string | null>(null);
  
  // UI State
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  
  // Async Processing State
  const [emailStatus, setEmailStatus] = useState<AsyncValidationState>('idle');
  const [phoneStatus, setPhoneStatus] = useState<AsyncValidationState>('idle');
  const [isProcessingPayload, setIsProcessingPayload] = useState(false);
  const [ingestProgress, setIngestProgress] = useState(0);

  const emailTimerRef = useRef<NodeJS.Timeout | null>(null);
  const phoneTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isMounted = useRef<boolean>(true);

  const captureForm = useForm<EnterpriseSignupData>({ resolver: zodResolver(enterpriseSignupSchema), mode: 'onChange' });
  const verifyForm = useForm<VerificationData>({ resolver: zodResolver(verificationSchema) });
  const loginForm = useForm<LoginData>({ resolver: zodResolver(loginSchema) });

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (emailTimerRef.current) clearTimeout(emailTimerRef.current);
      if (phoneTimerRef.current) clearTimeout(phoneTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => {
        if (isMounted.current) setResendTimer(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  // --- Real-time Identity Checks ---
  const checkEmailDynamically = useCallback((email: string) => {
    if (emailTimerRef.current) clearTimeout(emailTimerRef.current);
    setEmailStatus('idle');
    if (captureForm.formState.errors.email?.type === 'manual') captureForm.clearErrors('email');
    
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailStatus('checking');
      emailTimerRef.current = setTimeout(async () => {
        if (!isMounted.current) return;
        try {
          const { data, error } = await supabase.rpc('check_email_exists', { lookup_email: email });
          if (error) throw error;
          
          if (data && isMounted.current) {
            captureForm.setError('email', { type: 'manual', message: 'Corporate email already registered.' });
            setEmailStatus('conflict');
          } else if (isMounted.current) {
            setEmailStatus('available');
          }
        } catch (err) {
          if (isMounted.current) setEmailStatus('idle');
        }
      }, 600);
    }
  }, [captureForm]);

  const checkPhoneDynamically = useCallback((phone: string) => {
    if (phoneTimerRef.current) clearTimeout(phoneTimerRef.current);
    setPhoneStatus('idle');
    if (captureForm.formState.errors.phone?.type === 'manual') captureForm.clearErrors('phone');
    
    const digits = phone.replace(/\D/g, '');
    
    if (digits.length === 10) { 
      setPhoneStatus('checking');
      phoneTimerRef.current = setTimeout(async () => {
        if (!isMounted.current) return;
        try {
          const { data, error } = await supabase.rpc('check_phone_exists', { lookup_phone: phone });
          if (error) throw error;
          
          if (data && isMounted.current) {
            captureForm.setError('phone', { type: 'manual', message: 'Phone number already active.' });
            setPhoneStatus('conflict');
          } else if (isMounted.current) {
            setPhoneStatus('available');
          }
        } catch (err) {
          if (isMounted.current) setPhoneStatus('idle');
        }
      }, 600);
    }
  }, [captureForm]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, '');
    if (raw.startsWith('1')) raw = raw.substring(1);
    raw = raw.substring(0, 10);

    let formatted = raw;
    if (raw.length > 6) formatted = `(${raw.substring(0, 3)}) ${raw.substring(3, 6)}-${raw.substring(6, 10)}`;
    else if (raw.length > 3) formatted = `(${raw.substring(0, 3)}) ${raw.substring(3, 6)}`;
    else if (raw.length > 0) formatted = `(${raw}`;

    e.target.value = formatted;
    captureForm.setValue('phone', formatted, { shouldValidate: true });
    checkPhoneDynamically(formatted);
  };

  const preventPaste = (e: React.SyntheticEvent) => {
    e.preventDefault();
    setApiError("Security Protocol: Copy/Paste operations are prohibited.");
    setTimeout(() => { if (isMounted.current) setApiError(null) }, 3000);
  };

  // --- Submissions ---
  const onSubmitLogin = async (data: LoginData) => {
    setApiError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: data.email, password: data.password });
      if (error) throw error;
      await setSession();
      navigate('/dashboard');
    } catch (err) {
      setApiError('Invalid corporate credentials or account deactivated.');
    }
  };

  const onSubmitSignup = async (data: EnterpriseSignupData) => {
    setApiError(null);
    if (emailStatus === 'checking' || phoneStatus === 'checking') {
      setApiError('Awaiting database clearance verification. Please wait.');
      return;
    }

    try {
      const { error } = await supabase.auth.signUp({
        email: data.email, password: data.password,
        options: { data: { first_name: data.firstName, last_name: data.lastName, company: data.companyName, phone: data.phone } }
      });
      if (error) throw error;
      
      setRegisteredEmail(data.email); 
      setResendTimer(60); 
      setStep('verify');
    } catch (err: unknown) { 
      const msg = err instanceof Error ? err.message : 'Registration failed.';
      setApiError(msg); 
    }
  };

  // --- The Database Handoff ---
  const commitStagedBomToDatabase = async (userId: string) => {
    if (!stagedBom) return;
    
    setIsProcessingPayload(true); 
    setIngestProgress(20);

    try {
      const newWorkspace = await createWorkspace(userId, stagedBom.projectName);
      setIngestProgress(50);

      const payload = stagedBom.items.map(item => ({
        ...item,
        tenant_id: userId,
        workspace_id: newWorkspace.id
      }));

      const CHUNK_SIZE = 500;
      for (let i = 0; i < payload.length; i += CHUNK_SIZE) {
        if (!isMounted.current) throw new Error("Upload aborted by client."); 
        const chunk = payload.slice(i, i + CHUNK_SIZE);
        await addBomRows(chunk);
        setIngestProgress(50 + Math.floor(((i + chunk.length) / payload.length) * 50));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Database insertion failed.';
      throw new Error(`Failed to initialize workspace: ${msg}`);
    }
  };

  const onSubmitVerify = async (data: VerificationData) => {
    setApiError(null);
    try {
      const { data: verifyData, error } = await supabase.auth.verifyOtp({ 
        email: registeredEmail, token: data.code, type: 'signup' 
      });
      
      if (error) throw error;
      await setSession();

      if (stagedBom && verifyData.user) { 
        try { 
          await commitStagedBomToDatabase(verifyData.user.id); 
        } catch (bomError: unknown) { 
          const msg = bomError instanceof Error ? bomError.message : 'Unknown error';
          console.error("BOM Upload Failed:", msg); 
          setApiError(`Account created, but BOM rejected: ${msg}`);
          setIsProcessingPayload(false);
          return; 
        } 
      }
      
      if (isMounted.current) navigate('/dashboard');
    } catch (err) {
      if (isMounted.current) {
        setApiError('Invalid or expired clearance code.'); 
        setIsProcessingPayload(false);
      }
    }
  };

  const handleResendCode = async () => {
    if (resendTimer > 0) return;
    setApiError(null);
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: registeredEmail });
      if (error) throw error;
      setResendTimer(60);
    } catch (err) { 
      setApiError('Failed to resend code. Please wait and try again.'); 
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto bg-[#020617] p-8 rounded-sm border border-slate-800 shadow-[0_0_50px_rgba(0,0,0,0.8)] relative overflow-hidden transition-all duration-500 font-mono">
      
      {/* Decorative Grid */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: `linear-gradient(to right, #D4AF37 1px, transparent 1px), linear-gradient(to bottom, #D4AF37 1px, transparent 1px)`, backgroundSize: '16px 16px' }} />

      {isProcessingPayload && (
        <div className="absolute top-0 left-0 w-full h-1 bg-slate-900 overflow-hidden z-50">
          <div className="h-full bg-[#D4AF37] shadow-[0_0_10px_#D4AF37] transition-all duration-300 ease-out" style={{ width: `${ingestProgress}%` }} />
        </div>
      )}

      {/* Header */}
      <div className="space-y-2 text-center mb-8 relative z-10">
        <h3 className="text-xl font-black tracking-[0.1em] text-white uppercase flex items-center justify-center gap-2">
          
          {step === 'intent' && 'Access Gateway'}
          {step === 'login' && 'System Authorization'}
          {step === 'capture' && 'Establish Clearance'}
          {step === 'verify' && 'Verify Identity'}
        </h3>
        <p className="text-xs text-[#B48A2D] uppercase tracking-widest">
          {step === 'intent' && ' SIGN UP OR LOG IN TO CONTINUE.'}
          {step === 'login' && ' Enter credentials to access data.'}
          {step === 'capture' && 'Clearance required to process payload.'}
          {step === 'verify' && '> Secure token sent to corporate comms.'}
        </p>
      </div>

      {apiError && (
        <div className="mb-6 p-4 bg-red-950/30 border border-red-900/50 rounded-sm flex items-start gap-3 animate-in slide-in-from-top-2 relative z-10">
          <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold text-red-400 uppercase tracking-widest">System Alert</h4>
            <p className="text-xs text-red-300/80 mt-1">{apiError}</p>
          </div>
        </div>
      )}

      {/* STEP 0: Intent */}
      {step === 'intent' && (
        <div className="grid gap-4 animate-in slide-in-from-bottom-4 relative z-10">
          <button onClick={() => setStep('capture')} className="w-full bg-[#D4AF37] hover:bg-[#FCD34D] text-black font-black uppercase tracking-widest rounded-sm px-4 py-3.5 transition-all focus:outline-none shadow-[0_0_15px_rgba(212,175,55,0.2)]">
            CREATE ACCOUNT
          </button>
          <div className="pt-4 text-center">
            <p className="text-xs text-slate-500 uppercase tracking-widest">
              Already have an Account?{' '}
              <button onClick={() => setStep('login')} className="text-[#D4AF37] hover:text-white font-bold transition-colors focus:outline-none focus-visible:underline">
                LOGIN HERE
              </button>
            </p>
          </div>
        </div>
      )}

      {/* STEP 1: Login */}
      {step === 'login' && (
        <form onSubmit={loginForm.handleSubmit(onSubmitLogin)} className="space-y-5 animate-in slide-in-from-right-4 relative z-10">
          {!stagedBom && (
            <button type="button" onClick={() => setStep('intent')} className="text-[10px] font-bold text-slate-500 hover:text-[#D4AF37] uppercase tracking-widest transition-colors flex items-center gap-1.5 mb-4 outline-none group">
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" /> Back
            </button>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Work Email</label>
            <input 
              {...loginForm.register('email')}
              type="email" autoComplete="email" 
              className={`w-full bg-slate-900/50 border ${loginForm.formState.errors.email ? 'border-red-500' : 'border-slate-700 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]'} rounded-sm px-4 py-3 text-white text-sm outline-none transition-all placeholder:text-slate-600`} 
              placeholder="engineer@corp.com" 
            />
            {loginForm.formState.errors.email && <p className="text-[9px] text-red-400 uppercase pl-1">{loginForm.formState.errors.email.message}</p>}
          </div>

          <div className="space-y-1.5 relative">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Passphrase</label>
            <div className="relative">
              <input 
                {...loginForm.register('password')} 
                type={showPassword ? "text" : "password"} autoComplete="current-password" 
                className={`w-full bg-slate-900/50 border ${loginForm.formState.errors.password ? 'border-red-500' : 'border-slate-700 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]'} rounded-sm pl-4 pr-10 py-3 text-white text-sm outline-none transition-all placeholder:text-slate-600`}
                placeholder="••••••••••••"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-[#D4AF37] transition-colors outline-none">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {loginForm.formState.errors.password && <p className="text-[9px] text-red-400 uppercase pl-1">{loginForm.formState.errors.password.message}</p>}
          </div>

          <button 
            type="submit" 
            disabled={loginForm.formState.isSubmitting} 
            className="w-full bg-[#D4AF37] hover:bg-[#FCD34D] text-black font-black uppercase tracking-widest rounded-sm px-4 py-3.5 mt-2 transition-all flex items-center justify-center disabled:opacity-50 focus:outline-none shadow-[0_0_15px_rgba(212,175,55,0.2)]"
          >
            {loginForm.formState.isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Lock className="w-4 h-4 mr-2" /> Connect</>}
          </button>
          
          {stagedBom && (
            <div className="pt-4 text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest">
                Need to create a profile?{' '}
                <button type="button" onClick={() => setStep('capture')} className="text-[#D4AF37] hover:text-white font-bold transition-colors outline-none hover:underline">
                  Sign up here.
                </button>
              </p>
            </div>
          )}
        </form>
      )}

      {/* STEP 3: Capture (Signup) */}
      {step === 'capture' && (
        <form onSubmit={captureForm.handleSubmit(onSubmitSignup)} className="space-y-5 animate-in slide-in-from-right-4 max-h-[65vh] overflow-y-auto pr-2 custom-scrollbar relative z-10">
          
          {!stagedBom && (
            <button type="button" onClick={() => setStep('intent')} className="text-[10px] font-bold text-slate-500 hover:text-[#D4AF37] uppercase tracking-widest transition-colors flex items-center gap-1.5 mb-2 outline-none group">
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" /> Back
            </button>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Given Name</label>
              <input {...captureForm.register('firstName')} className="w-full bg-slate-900/50 border border-slate-700 rounded-sm px-4 py-3 text-white text-sm focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] outline-none transition-all placeholder:text-slate-600" placeholder="John" />
              {captureForm.formState.errors.firstName && <p className="text-[9px] text-red-400 uppercase pl-1">{captureForm.formState.errors.firstName.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Family Name</label>
              <input {...captureForm.register('lastName')} className="w-full bg-slate-900/50 border border-slate-700 rounded-sm px-4 py-3 text-white text-sm focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] outline-none transition-all placeholder:text-slate-600" placeholder="Doe" />
              {captureForm.formState.errors.lastName && <p className="text-[9px] text-red-400 uppercase pl-1">{captureForm.formState.errors.lastName.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Organization</label>
              <input {...captureForm.register('companyName')} className="w-full bg-slate-900/50 border border-slate-700 rounded-sm px-4 py-3 text-white text-sm focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] outline-none transition-all placeholder:text-slate-600" placeholder="Tech Corp" />
              {captureForm.formState.errors.companyName && <p className="text-[9px] text-red-400 uppercase pl-1">{captureForm.formState.errors.companyName.message}</p>}
            </div>
            
            <div className="space-y-1.5 relative">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Comms Link (Phone)</label>
              <div className="relative">
                <input 
                  {...captureForm.register('phone')} 
                  onChange={handlePhoneChange}
                  className={`w-full bg-slate-900/50 border ${captureForm.formState.errors.phone ? 'border-red-500' : phoneStatus === 'available' ? 'border-[#D4AF37]' : 'border-slate-700 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]'} rounded-sm pl-4 pr-10 py-3 text-white text-sm outline-none transition-all placeholder:text-slate-600`} 
                  placeholder="(555) 000-0000" 
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                  {phoneStatus === 'checking' && <Loader2 className="w-4 h-4 text-[#D4AF37] animate-spin" />}
                  {phoneStatus === 'available' && !captureForm.formState.errors.phone && <CheckCircle2 className="w-4 h-4 text-[#D4AF37] animate-in zoom-in" />}
                  {phoneStatus === 'conflict' && <XCircle className="w-4 h-4 text-red-500 animate-in zoom-in" />}
                </div>
              </div>
              {captureForm.formState.errors.phone && <p className="text-[9px] text-red-400 uppercase pl-1">{captureForm.formState.errors.phone.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Primary Email</label>
            <div className="relative">
              <input 
                {...captureForm.register('email')}
                onChange={(e) => { captureForm.register('email').onChange(e); checkEmailDynamically(e.target.value); }}
                className={`w-full bg-slate-900/50 border ${captureForm.formState.errors.email ? 'border-red-500' : emailStatus === 'available' ? 'border-[#D4AF37]' : 'border-slate-700 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]'} rounded-sm pl-4 pr-10 py-3 text-white text-sm outline-none transition-all placeholder:text-slate-600`} 
                placeholder="engineer@corp.com" 
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                {emailStatus === 'checking' && <Loader2 className="w-4 h-4 text-[#D4AF37] animate-spin" />}
                {emailStatus === 'available' && !captureForm.formState.errors.email && <CheckCircle2 className="w-4 h-4 text-[#D4AF37] animate-in zoom-in" />}
                {emailStatus === 'conflict' && <XCircle className="w-4 h-4 text-red-500 animate-in zoom-in" />}
              </div>
            </div>
            {captureForm.formState.errors.email && <p className="text-[9px] text-red-400 uppercase pl-1">{captureForm.formState.errors.email.message}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5 relative">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Passphrase</label>
              <div className="relative">
                <input 
                  {...captureForm.register('password')} 
                  type={showPassword ? "text" : "password"} 
                  onCopy={preventPaste} onCut={preventPaste} onDragStart={preventPaste} onPaste={preventPaste}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-sm pl-4 pr-10 py-3 text-white text-sm focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] outline-none transition-all placeholder:text-slate-600" 
                  placeholder="Min 12 chars"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-[#D4AF37] transition-colors outline-none">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {captureForm.formState.errors.password && <p className="text-[9px] text-red-400 uppercase pl-1">{captureForm.formState.errors.password.message}</p>}
            </div>
            
            <div className="space-y-1.5 relative">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Re-Enter Passphrase</label>
              <div className="relative">
                <input 
                  {...captureForm.register('confirmPassword')} 
                  type={showConfirmPassword ? "text" : "password"} 
                  onCopy={preventPaste} onCut={preventPaste} onDragStart={preventPaste} onPaste={preventPaste}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-sm pl-4 pr-10 py-3 text-white text-sm focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] outline-none transition-all placeholder:text-slate-600" 
                  placeholder="Verify pass"
                />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-[#D4AF37] transition-colors outline-none">
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {captureForm.formState.errors.confirmPassword && <p className="text-[9px] text-red-400 uppercase pl-1">{captureForm.formState.errors.confirmPassword.message}</p>}
            </div>
          </div>

          <button 
            type="submit" 
            disabled={captureForm.formState.isSubmitting || Object.keys(captureForm.formState.errors).length > 0 || emailStatus === 'checking' || phoneStatus === 'checking'} 
            className="w-full bg-[#D4AF37] hover:bg-[#FCD34D] text-black font-black uppercase tracking-widest rounded-sm px-4 py-3.5 mt-2 transition-all flex items-center justify-center disabled:opacity-50 focus:outline-none shadow-[0_0_15px_rgba(212,175,55,0.2)]"
          >
            {captureForm.formState.isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : stagedBom ? 'Create Profile & Inject Payload' : 'Create Profile'}
          </button>
          
          {stagedBom && (
            <div className="pt-2 text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest">
                Already have clearance?{' '}
                <button type="button" onClick={() => setStep('login')} className="text-[#D4AF37] hover:text-white font-bold transition-colors outline-none hover:underline">
                  Authenticate here.
                </button>
              </p>
            </div>
          )}
        </form>
      )}

      {/* STEP 4: Verify OTP */}
      {step === 'verify' && (
        <div className="animate-in slide-in-from-right-4 relative z-10">
          <button onClick={() => setStep('capture')} disabled={isProcessingPayload} className="text-[10px] font-bold text-slate-500 hover:text-[#D4AF37] uppercase tracking-widest transition-colors flex items-center gap-1.5 mb-6 disabled:opacity-50 outline-none group">
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" /> Override Address
          </button>

          <form onSubmit={verifyForm.handleSubmit(onSubmitVerify)} className="space-y-6">
            <div className="flex items-center justify-center p-5 bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-full w-fit mx-auto relative shadow-inner">
               <Mail className="w-10 h-10 text-[#D4AF37]" />
               {isProcessingPayload && (
                 <div className="absolute -bottom-2 -right-2 bg-[#020617] border border-[#D4AF37]/50 rounded-full p-1.5 shadow-md">
                   <Database className="w-4 h-4 text-[#FCD34D] animate-pulse" />
                 </div>
               )}
            </div>
            
            <div className="space-y-2 text-center">
              {/* ESCAPED CHARACTER HERE */}
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">&gt; Transmission sent to:</p>
              <p className="font-bold text-[#D4AF37] bg-slate-900 py-1.5 px-3 rounded-sm inline-block border border-slate-700 shadow-sm">{registeredEmail}</p>
            </div>

            <div className="space-y-2">
              <input 
                {...verifyForm.register('code')} 
                disabled={isProcessingPayload}
                type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code" maxLength={6}
                className="w-full bg-[#020617] border border-slate-700 rounded-sm px-4 py-5 text-center text-[#D4AF37] text-3xl tracking-[0.5em] focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] outline-none transition-all disabled:opacity-50 shadow-inner placeholder:text-slate-800" 
                placeholder="000000" 
              />
              {verifyForm.formState.errors.code && <p className="text-[10px] text-red-400 uppercase text-center">{verifyForm.formState.errors.code.message}</p>}
            </div>

            <button 
              type="submit" 
              disabled={verifyForm.formState.isSubmitting || isProcessingPayload} 
              className="w-full bg-[#D4AF37] hover:bg-[#FCD34D] text-black font-black uppercase tracking-widest rounded-sm px-4 py-4 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-[0_0_15px_rgba(212,175,55,0.2)] outline-none"
            >
              {verifyForm.formState.isSubmitting || isProcessingPayload ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="text-sm">{isProcessingPayload ? 'INJECTING PAYLOAD...' : 'VERIFYING...'}</span>
                </>
              ) : (
                <span className="flex items-center gap-2 text-sm">INITIALIZE LINK <ArrowRight className="w-4 h-4" /></span>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
             <button 
               type="button" 
               onClick={handleResendCode}
               disabled={resendTimer > 0 || isProcessingPayload} 
               className="text-[10px] font-bold text-slate-500 hover:text-[#D4AF37] transition-colors flex items-center justify-center gap-1.5 w-full disabled:opacity-50 uppercase tracking-widest outline-none"
             >
               <RefreshCcw className={`w-3.5 h-3.5 ${resendTimer > 0 ? '' : 'animate-spin'}`} /> 
               {resendTimer > 0 ? `RE-TRANSMIT IN ${resendTimer}s` : "FAILED TO RECEIVE? RE-TRANSMIT"}
             </button>
          </div>
        </div>
      )}
    </div>
  );
});

AuthPortal.displayName = 'AuthPortal';