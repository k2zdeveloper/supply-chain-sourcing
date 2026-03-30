import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/useAuthStore';
import { 
  Loader2, Mail, ArrowRight, RefreshCcw, ArrowLeft, Eye, EyeOff, Database, CheckCircle2, Lock, ShieldAlert, XCircle 
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
  // If the user brought a BOM with them, we safely inject it into the DB here
  const commitStagedBomToDatabase = async (userId: string) => {
    if (!stagedBom) return;
    
    setIsProcessingPayload(true); 
    setIngestProgress(20);

    try {
      // 1. Create the Workspace/Project container
      const newWorkspace = await createWorkspace(userId, stagedBom.projectName);
      setIngestProgress(50);

      // 2. Attach the user_id and workspace_id to the clean items
      const payload = stagedBom.items.map(item => ({
        ...item,
        tenant_id: userId,
        workspace_id: newWorkspace.id
      }));

      // 3. Chunked upload to prevent DB timeouts
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

      // If they came from the Landing Page upload zone, process it now
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
    <div className="w-full max-w-lg mx-auto bg-white p-8 rounded-3xl border border-gray-100 shadow-xl relative overflow-hidden transition-all duration-500 font-sans ring-1 ring-gray-900/5">
      
      {isProcessingPayload && (
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gray-100 overflow-hidden z-50">
          <div className="h-full bg-blue-600 transition-all duration-300 ease-out" style={{ width: `${ingestProgress}%` }} />
        </div>
      )}

      {/* Header */}
      <div className="space-y-2 text-center mb-8">
        <h3 className="text-2xl font-extrabold tracking-tight text-gray-900">
          {step === 'intent' && 'Access Command Center'}
          {step === 'login' && 'Corporate Sign In'}
          {step === 'capture' && 'Establish Clearance'}
          {step === 'verify' && 'Verify Identity'}
        </h3>
        <p className="text-sm text-gray-500 font-medium">
          {step === 'intent' && 'Login or create a free enterprise account.'}
          {step === 'login' && 'Enter your credentials to access your data.'}
          {step === 'capture' && 'Corporate credentials required to process quote.'}
          {step === 'verify' && 'Check your corporate inbox for the clearance code.'}
        </p>
      </div>

      {apiError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200/50 rounded-xl flex items-start gap-3 animate-in slide-in-from-top-2">
          <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-red-900">System Notification</h4>
            <p className="text-xs text-red-700 font-medium mt-1">{apiError}</p>
          </div>
        </div>
      )}

      {/* STEP 0: Intent (Only shows if they didn't upload a BOM) */}
      {step === 'intent' && (
        <div className="grid gap-4 animate-in slide-in-from-bottom-4">
          <button onClick={() => setStep('capture')} className="w-full bg-gray-900 hover:bg-black text-white font-bold rounded-xl px-4 py-3.5 transition-all shadow-md focus:outline-none focus:ring-4 focus:ring-gray-900/20">
            Create Free Account
          </button>
          <div className="pt-4 text-center">
            <p className="text-sm text-gray-500 font-medium">
              Already have clearance?{' '}
              <button onClick={() => setStep('login')} className="text-blue-600 font-bold hover:text-blue-700 transition-colors focus:outline-none focus-visible:underline">
                Sign in here.
              </button>
            </p>
          </div>
        </div>
      )}

      {/* STEP 1: Login */}
      {step === 'login' && (
        <form onSubmit={loginForm.handleSubmit(onSubmitLogin)} className="space-y-5 animate-in slide-in-from-right-4">
          {!stagedBom && (
            <button type="button" onClick={() => setStep('intent')} className="text-xs font-bold text-gray-400 hover:text-gray-900 transition-colors flex items-center gap-1.5 mb-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded p-1 -ml-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
          )}

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Work Email</label>
            <input 
              {...loginForm.register('email')}
              type="email" autoComplete="email" 
              className={`w-full bg-white border ${loginForm.formState.errors.email ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'} rounded-xl px-4 py-3 text-gray-900 text-sm outline-none transition-all shadow-sm`} 
              placeholder="engineer@corp.com" 
            />
            {loginForm.formState.errors.email && <p className="text-[10px] text-red-500 font-bold">{loginForm.formState.errors.email.message}</p>}
          </div>

          <div className="space-y-1.5 relative">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Passphrase</label>
            <div className="relative">
              <input 
                {...loginForm.register('password')} 
                type={showPassword ? "text" : "password"} autoComplete="current-password" 
                className={`w-full bg-white border ${loginForm.formState.errors.password ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'} rounded-xl pl-4 pr-10 py-3 text-gray-900 text-sm outline-none transition-all shadow-sm`}
                placeholder="Enter passphrase"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label="Toggle password visibility" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {loginForm.formState.errors.password && <p className="text-[10px] text-red-500 font-bold">{loginForm.formState.errors.password.message}</p>}
          </div>

          <button 
            type="submit" 
            disabled={loginForm.formState.isSubmitting} 
            className="w-full bg-gray-900 hover:bg-black text-white shadow-md font-bold rounded-xl px-4 py-3.5 mt-2 transition-all flex items-center justify-center disabled:opacity-50 focus:outline-none focus:ring-4 focus:ring-gray-900/20"
          >
            {loginForm.formState.isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Lock className="w-4 h-4 mr-2" /> Authenticate</>}
          </button>
          
          {stagedBom && (
            <div className="pt-4 text-center">
              <p className="text-sm text-gray-500 font-medium">
                Need to create an account?{' '}
                <button type="button" onClick={() => setStep('capture')} className="text-blue-600 font-bold hover:text-blue-700 transition-colors focus:outline-none focus-visible:underline">
                  Sign up here.
                </button>
              </p>
            </div>
          )}
        </form>
      )}

      {/* STEP 3: Capture (Signup) */}
      {step === 'capture' && (
        <form onSubmit={captureForm.handleSubmit(onSubmitSignup)} className="space-y-5 animate-in slide-in-from-right-4 max-h-[65vh] overflow-y-auto pr-2 custom-scrollbar">
          
          {!stagedBom && (
            <button type="button" onClick={() => setStep('intent')} className="text-xs font-bold text-gray-400 hover:text-gray-900 transition-colors flex items-center gap-1.5 mb-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded p-1 -ml-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">First Name</label>
              <input {...captureForm.register('firstName')} autoComplete="given-name" className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-gray-900 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all shadow-sm" />
              {captureForm.formState.errors.firstName && <p className="text-[10px] text-red-500 font-bold">{captureForm.formState.errors.firstName.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Last Name</label>
              <input {...captureForm.register('lastName')} autoComplete="family-name" className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-gray-900 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all shadow-sm" />
              {captureForm.formState.errors.lastName && <p className="text-[10px] text-red-500 font-bold">{captureForm.formState.errors.lastName.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Company</label>
              <input {...captureForm.register('companyName')} autoComplete="organization" className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-gray-900 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all shadow-sm" />
              {captureForm.formState.errors.companyName && <p className="text-[10px] text-red-500 font-bold">{captureForm.formState.errors.companyName.message}</p>}
            </div>
            
            <div className="space-y-1.5 relative">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Phone</label>
              <div className="relative">
                <input 
                  {...captureForm.register('phone')} 
                  onChange={handlePhoneChange}
                  type="tel" autoComplete="tel" 
                  className={`w-full bg-white border ${captureForm.formState.errors.phone ? 'border-red-500 ring-1 ring-red-500' : phoneStatus === 'available' ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'} rounded-xl pl-4 pr-10 py-3 text-gray-900 text-sm outline-none transition-all shadow-sm`} 
                  placeholder="(555) 000-0000" 
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                  {phoneStatus === 'checking' && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
                  {phoneStatus === 'available' && !captureForm.formState.errors.phone && <CheckCircle2 className="w-4 h-4 text-emerald-500 animate-in zoom-in" />}
                  {phoneStatus === 'conflict' && <XCircle className="w-4 h-4 text-red-500 animate-in zoom-in" />}
                </div>
              </div>
              {captureForm.formState.errors.phone && <p className="text-[10px] text-red-500 font-bold">{captureForm.formState.errors.phone.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Work Email</label>
            <div className="relative">
              <input 
                {...captureForm.register('email')}
                onChange={(e) => {
                  captureForm.register('email').onChange(e); 
                  checkEmailDynamically(e.target.value);
                }}
                type="email" autoComplete="email" 
                className={`w-full bg-white border ${captureForm.formState.errors.email ? 'border-red-500 ring-1 ring-red-500' : emailStatus === 'available' ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'} rounded-xl pl-4 pr-10 py-3 text-gray-900 text-sm outline-none transition-all shadow-sm`} 
                placeholder="engineer@corp.com" 
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                {emailStatus === 'checking' && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
                {emailStatus === 'available' && !captureForm.formState.errors.email && <CheckCircle2 className="w-4 h-4 text-emerald-500 animate-in zoom-in" />}
                {emailStatus === 'conflict' && <XCircle className="w-4 h-4 text-red-500 animate-in zoom-in" />}
              </div>
            </div>
            {captureForm.formState.errors.email && <p className="text-[10px] text-red-500 font-bold">{captureForm.formState.errors.email.message}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5 relative">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Passphrase</label>
              <div className="relative">
                <input 
                  {...captureForm.register('password')} 
                  type={showPassword ? "text" : "password"} autoComplete="new-password" 
                  onCopy={preventPaste} onCut={preventPaste} onDragStart={preventPaste} onPaste={preventPaste}
                  className="w-full bg-white border border-gray-300 rounded-xl pl-4 pr-10 py-3 text-gray-900 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all shadow-sm" 
                  placeholder="Min 12 characters"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label="Toggle password visibility" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {captureForm.formState.errors.password && <p className="text-[10px] text-red-500 font-bold">{captureForm.formState.errors.password.message}</p>}
            </div>
            
            <div className="space-y-1.5 relative">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Confirm</label>
              <div className="relative">
                <input 
                  {...captureForm.register('confirmPassword')} 
                  type={showConfirmPassword ? "text" : "password"} autoComplete="new-password" 
                  onCopy={preventPaste} onCut={preventPaste} onDragStart={preventPaste} onPaste={preventPaste}
                  className="w-full bg-white border border-gray-300 rounded-xl pl-4 pr-10 py-3 text-gray-900 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all shadow-sm" 
                  placeholder="Confirm passphrase"
                />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} aria-label="Toggle password confirmation visibility" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none">
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {captureForm.formState.errors.confirmPassword && <p className="text-[10px] text-red-500 font-bold">{captureForm.formState.errors.confirmPassword.message}</p>}
            </div>
          </div>

          <button 
            type="submit" 
            disabled={
              captureForm.formState.isSubmitting || 
              Object.keys(captureForm.formState.errors).length > 0 ||
              emailStatus === 'checking' || 
              phoneStatus === 'checking'
            } 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 font-bold rounded-xl px-4 py-3.5 mt-2 transition-all flex items-center justify-center disabled:opacity-50 focus:outline-none focus:ring-4 focus:ring-blue-500/30"
          >
            {captureForm.formState.isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : stagedBom ? 'Create Account & Save Project' : 'Create Account'}
          </button>
          
          {stagedBom && (
            <div className="pt-2 text-center">
              <p className="text-sm text-gray-500 font-medium">
                Already have an account?{' '}
                <button type="button" onClick={() => setStep('login')} className="text-blue-600 font-bold hover:text-blue-700 transition-colors focus:outline-none focus-visible:underline">
                  Sign in here.
                </button>
              </p>
            </div>
          )}
        </form>
      )}

      {/* STEP 4: Verify OTP */}
      {step === 'verify' && (
        <div className="animate-in slide-in-from-right-4">
          <button onClick={() => setStep('capture')} disabled={isProcessingPayload} className="text-xs font-bold text-gray-400 hover:text-gray-900 transition-colors flex items-center gap-1.5 mb-6 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded p-1 -ml-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Change Email
          </button>

          <form onSubmit={verifyForm.handleSubmit(onSubmitVerify)} className="space-y-6">
            <div className="flex items-center justify-center p-5 bg-blue-50 border border-blue-100 rounded-full w-fit mx-auto relative shadow-inner">
               <Mail className="w-10 h-10 text-blue-600" />
               {isProcessingPayload && (
                 <div className="absolute -bottom-2 -right-2 bg-white border border-gray-200 rounded-full p-1.5 shadow-md">
                   <Database className="w-4 h-4 text-emerald-500 animate-pulse" />
                 </div>
               )}
            </div>
            
            <div className="space-y-2 text-center">
              <p className="text-sm text-gray-500 font-medium">We sent a 6-digit secure code to:</p>
              <p className="font-bold text-gray-900 bg-gray-50 py-1 px-3 rounded-md inline-block border border-gray-200 shadow-sm">{registeredEmail}</p>
            </div>

            <div className="space-y-2">
              <input 
                {...verifyForm.register('code')} 
                disabled={isProcessingPayload}
                type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code" maxLength={6}
                className="w-full bg-white border border-gray-300 rounded-2xl px-4 py-5 text-center text-gray-900 text-3xl tracking-[0.5em] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none font-mono transition-all disabled:opacity-50 shadow-sm" 
                placeholder="••••••" 
              />
              {verifyForm.formState.errors.code && <p className="text-xs text-red-500 text-center font-bold">{verifyForm.formState.errors.code.message}</p>}
            </div>

            <button 
              type="submit" 
              disabled={verifyForm.formState.isSubmitting || isProcessingPayload} 
              className="w-full bg-gray-900 hover:bg-black text-white font-bold rounded-xl px-4 py-4 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-md focus:outline-none focus:ring-4 focus:ring-gray-900/20"
            >
              {verifyForm.formState.isSubmitting || isProcessingPayload ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="text-base">{isProcessingPayload ? 'Saving Project...' : 'Verifying...'}</span>
                </>
              ) : (
                <span className="flex items-center gap-2 text-base">Verify & Enter Dashboard <ArrowRight className="w-5 h-5" /></span>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
             <button 
               type="button" 
               onClick={handleResendCode}
               disabled={resendTimer > 0 || isProcessingPayload} 
               className="text-xs font-bold text-gray-400 hover:text-blue-600 transition-colors flex items-center justify-center gap-1.5 w-full disabled:opacity-50 disabled:hover:text-gray-400 cursor-pointer disabled:cursor-not-allowed focus:outline-none"
             >
               <RefreshCcw className={`w-3.5 h-3.5 ${resendTimer > 0 ? '' : 'animate-spin'}`} /> 
               {resendTimer > 0 ? `Resend code available in ${resendTimer}s` : "Didn't receive the code? Resend"}
             </button>
          </div>
        </div>
      )}
    </div>
  );
});

AuthPortal.displayName = 'AuthPortal';