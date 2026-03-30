import { Suspense, lazy, useState, useEffect, memo } from 'react';
import { 
  ShieldCheck, Zap, Globe, Lock, Loader2, Cpu, CheckCircle2, 
  ArrowLeft, LogIn, UserPlus, BrainCircuit, ChevronDown, 
  Layers, Activity, Network, HardDrive, Server, FileSpreadsheet,
  XCircle, Clock, ArrowRight
} from 'lucide-react';

import { QuoteWizard, type ParsedBomPayload } from '@/features/onboarding/components/QuoteWizard';

const AuthPortal = lazy(() => 
  import('@/features/auth/components/AuthPortal').then((module) => ({ default: module.AuthPortal }))
);

type PortalMode = 'wizard' | 'auth-login' | 'auth-signup';

const PCB_BACKGROUND_URL = "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=2800&q=80";
// New Images for the Workflow Section
const OLD_WORKFLOW_IMG = "https://images.unsplash.com/photo-1580828343064-fde4cad202d5?auto=format&fit=crop&w=1200&q=80"; // Messy electronics/wires
const NEW_WORKFLOW_IMG = "https://images.unsplash.com/photo-1611078771457-195973b0a969?auto=format&fit=crop&w=1200&q=80"; // Sleek modern CPU/Chip

export default function LandingPage() {
  const [stagedBom, setStagedBom] = useState<ParsedBomPayload | null>(null);
  const [portalMode, setPortalMode] = useState<PortalMode>('wizard');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setIsMounted(true));
  }, []);

  const getTransition = (delayMs: number) => `
    transform transition-all duration-[1000ms] ease-out
    ${isMounted ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-8 opacity-0 scale-95'}
  `;

  // Helper to scroll back to the top portal
  const scrollToPortal = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="relative min-h-screen bg-gray-950 text-white font-sans selection:bg-blue-500/30 flex flex-col">
      
      {/* =====================================================================
          UNIFIED FIXED BACKGROUND (PARALLAX BASE)
          ===================================================================== */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <img 
          src={PCB_BACKGROUND_URL} 
          alt="Circuit Board Background" 
          className={`w-full h-full object-cover opacity-[0.12] mix-blend-screen transition-transform duration-[30s] ease-out ${isMounted ? 'scale-100' : 'scale-110'}`}
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-blue-950/40 via-gray-950/80 to-gray-950" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_60%)] animate-pulse duration-[8000ms]" />
      </div>

      {/* =====================================================================
          STICKY HEADER
          ===================================================================== */}
      <div className={`sticky top-0 z-50 w-full bg-gray-950/80 backdrop-blur-xl border-b border-white/5 transition-all duration-700 ease-out shadow-2xl ${isMounted ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}`}>
        <header className="flex items-center justify-between px-6 lg:px-12 py-4 max-w-[1600px] w-full mx-auto">
          <div className="flex items-center gap-8">
            <button onClick={scrollToPortal} className="flex items-center gap-3 focus:outline-none group">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(37,99,235,0.4)] ring-1 ring-blue-400/50 group-hover:scale-105 transition-transform">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="font-extrabold text-xl tracking-tight text-white hidden sm:block group-hover:text-blue-400 transition-colors">
                SCS<span className="text-gray-400 font-light group-hover:text-white transition-colors">ENGINE</span>
              </span>
            </button>
            
            <nav aria-label="Main Navigation" className="hidden md:flex gap-8 text-sm text-gray-400 font-semibold tracking-wide">
              <a href="#workflow" className="hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-2 py-1 outline-none">Why Us</a>
              <a href="#methodology" className="hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-2 py-1 outline-none">How We Work</a>
              <a href="#expertise" className="hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-2 py-1 outline-none">Hardware</a>
            </nav>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <button 
              onClick={() => { setPortalMode('auth-login'); scrollToPortal(); }}
              className="text-sm font-bold text-gray-300 hover:text-white transition-colors flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-800 focus:outline-none focus:ring-4 focus:ring-gray-800"
            >
              <span className="hidden sm:inline">Sign In</span>
              <LogIn className="w-4 h-4 sm:hidden" />
            </button>
            <button 
              onClick={() => { setPortalMode('auth-signup'); scrollToPortal(); }}
              className="bg-white hover:bg-gray-100 text-gray-900 px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.1)] focus:outline-none focus:ring-4 focus:ring-white/20 active:scale-95"
            >
              <span className="hidden sm:inline">Create Free Account</span>
              <UserPlus className="w-4 h-4 sm:hidden" />
            </button>
          </div>
        </header>
      </div>

      {/* =====================================================================
          HERO SECTION (ABOVE THE FOLD)
          ===================================================================== */}
      <section className="relative z-10 flex flex-col justify-center min-h-[calc(100vh-80px)] max-w-[1600px] w-full mx-auto px-6 lg:px-12 py-10 lg:py-0">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center w-full">
          
          {/* Left Side: Marketing & Value Prop */}
          <div className="flex flex-col justify-center space-y-10 lg:pr-8">
            <div className="space-y-6 max-w-xl pt-4 lg:pt-0">
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-400/20 text-[11px] font-bold text-blue-300 tracking-widest uppercase backdrop-blur-sm shadow-sm ${getTransition(100)}`} style={{ transitionDelay: '100ms' }}>
                <BrainCircuit className="w-3.5 h-3.5 text-blue-400" />
                AI Sourcing Engine Active
              </div>
              
              <h1 className={`text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold tracking-tighter leading-[1.05] text-white ${getTransition(200)}`} style={{ transitionDelay: '200ms' }}>
                Procure with <br className="hidden sm:block" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 drop-shadow-sm">
                  Machine Precision.
                </span>
              </h1>
              
              <p className={`text-gray-400 text-base lg:text-lg leading-relaxed font-medium mt-6 max-w-lg ${getTransition(300)}`} style={{ transitionDelay: '300ms' }}>
                The world's first AI-native component sourcing platform. Upload your raw BOM, and let our neural engine map MPNs, predict availability, and fetch sub-100ms inventory data.
              </p>
            </div>

            {/* Quick Stats */}
            <div className={`flex items-center gap-8 border-t border-gray-800/50 pt-8 ${getTransition(400)}`} style={{ transitionDelay: '400ms' }}>
              <div>
                <p className="text-3xl font-light text-white tracking-tight">40<span className="text-blue-500">+</span></p>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Global APIs</p>
              </div>
              <div>
                <p className="text-3xl font-light text-white tracking-tight">&lt;100<span className="text-blue-500">ms</span></p>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Query Latency</p>
              </div>
              <div>
                <p className="text-3xl font-light text-white tracking-tight">99.9<span className="text-blue-500">%</span></p>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Parse Accuracy</p>
              </div>
            </div>
          </div>

          {/* Right Side: The Floating Portal */}
          <div className={`flex items-center justify-center lg:justify-end w-full transition-all duration-1000 ease-out delay-500 ${isMounted ? 'translate-x-0 opacity-100' : 'translate-x-12 opacity-0'}`}>
            <div className="w-full max-w-115 flex flex-col gap-5 relative z-10">
              
              {portalMode === 'wizard' && (
                !stagedBom ? (
                  <QuoteWizard onSuccess={(payload) => setStagedBom(payload)} />
                ) : (
                  <div className="animate-in slide-in-from-bottom-8 duration-700 fade-in flex flex-col gap-5">
                    <MagicTeaser payload={stagedBom} onReset={() => setStagedBom(null)} />
                    <Suspense fallback={<PortalLoader />}>
                      <AuthPortal stagedBom={stagedBom} initialStep="capture" />
                    </Suspense>
                  </div>
                )
              )}

              {portalMode !== 'wizard' && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300 w-full">
                  <button 
                    onClick={() => setPortalMode('wizard')} 
                    className="mb-4 text-xs font-bold text-gray-400 hover:text-white transition-colors flex items-center gap-1.5 focus:outline-none rounded p-1 -ml-1 group"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" /> Back to AI Engine
                  </button>

                  <Suspense fallback={<PortalLoader />}>
                    <AuthPortal key={portalMode} initialStep={portalMode === 'auth-login' ? 'login' : 'intent'} />
                  </Suspense>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-50 animate-bounce hidden lg:flex">
          <span className="text-[10px] font-bold tracking-widest uppercase text-gray-400">Discover</span>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </div>
      </section>

      {/* =====================================================================
          SECTION 2: WORKFLOW COMPARISON (NEW)
          ===================================================================== */}
      <section id="workflow" className="relative z-10 py-24 bg-gray-900/40 border-y border-white/5">
        <div className="max-w-[1600px] w-full mx-auto px-6 lg:px-12">
          
          <div className="text-center max-w-3xl mx-auto mb-20 space-y-4">
            <h2 className="text-3xl lg:text-5xl font-extrabold tracking-tight text-white">The SCS Advantage.</h2>
            <p className="text-gray-400 text-lg leading-relaxed">
              Stop losing weeks to manual BOM quoting. See how our AI-native workflow obliterates traditional procurement bottlenecks.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
            
            {/* The Legacy Workflow Card */}
            <div className="bg-gray-950/80 border border-red-900/30 rounded-[2rem] overflow-hidden flex flex-col group relative">
               <div className="h-56 w-full relative overflow-hidden bg-gray-900">
                 <img src={OLD_WORKFLOW_IMG} alt="Cluttered Legacy Components" className="w-full h-full object-cover opacity-40 mix-blend-luminosity group-hover:scale-105 transition-transform duration-700" />
                 <div className="absolute inset-0 bg-gradient-to-t from-gray-950 to-transparent" />
                 <div className="absolute bottom-6 left-8 flex items-center gap-3">
                   <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 backdrop-blur-sm">
                      <Clock className="w-5 h-5" />
                   </div>
                   <h3 className="text-2xl font-bold text-gray-300">The Legacy Way</h3>
                 </div>
               </div>
               
               <div className="p-8 space-y-6 flex-1 border-t border-gray-800/50">
                  <ul className="space-y-5 text-gray-400">
                    <ComparisonItem icon={<XCircle className="w-5 h-5 text-red-400/80 shrink-0" />} text="Manual BOM scrubbing and broken Excel formatting" />
                    <ComparisonItem icon={<XCircle className="w-5 h-5 text-red-400/80 shrink-0" />} text="Waiting 3-5 business days for distributor email quotes" />
                    <ComparisonItem icon={<XCircle className="w-5 h-5 text-red-400/80 shrink-0" />} text="Dangerous blind spots on component lifecycle & EOL risks" />
                    <ComparisonItem icon={<XCircle className="w-5 h-5 text-red-400/80 shrink-0" />} text="Juggling dozens of disjointed vendor communication threads" />
                  </ul>
               </div>
            </div>

            {/* The SCS Engine Workflow Card */}
            <div className="bg-gradient-to-br from-blue-900/20 to-gray-900/80 border border-blue-500/30 rounded-[2rem] overflow-hidden flex flex-col group relative shadow-[0_0_50px_rgba(37,99,235,0.1)]">
               <div className="h-56 w-full relative overflow-hidden bg-gray-900">
                 <img src={NEW_WORKFLOW_IMG} alt="Pristine Modern Microchip" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                 <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/40 to-transparent" />
                 <div className="absolute bottom-6 left-8 flex items-center gap-3">
                   <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/50 flex items-center justify-center text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.5)] backdrop-blur-sm">
                      <Zap className="w-5 h-5" />
                   </div>
                   <h3 className="text-2xl font-bold text-white">The SCS Engine</h3>
                 </div>
               </div>
               
               <div className="p-8 space-y-6 flex-1 border-t border-blue-500/20">
                  <ul className="space-y-5 text-gray-300">
                    <ComparisonItem icon={<CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />} text="Instant ingestion and sanitization of any raw BOM format" />
                    <ComparisonItem icon={<CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />} text="Real-time API pricing & stock aggregation from 40+ suppliers" />
                    <ComparisonItem icon={<CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />} text="Predictive AI alerts for NRND parts with instant alternatives" />
                    <ComparisonItem icon={<CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />} text="One-click, unified purchasing and tracking dashboard" />
                  </ul>
                  
                  <div className="pt-4 border-t border-white/5">
                    <div className="inline-flex items-center gap-2 text-sm font-bold text-blue-400">
                       Time Saved: 90% <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
               </div>
            </div>

          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 3: METHODOLOGY
          ===================================================================== */}
      <section id="methodology" className="relative z-10 py-24 lg:py-32">
        <div className="max-w-[1600px] w-full mx-auto px-6 lg:px-12 grid lg:grid-cols-2 gap-16 items-center">
          
          <div className="space-y-8">
            <h2 className="text-3xl lg:text-5xl font-extrabold tracking-tight text-white leading-[1.1]">
              The Neural <br/> Sourcing Pipeline.
            </h2>
            <p className="text-gray-400 text-lg leading-relaxed">
              Traditional procurement relies on humans manually searching Digikey, Mouser, and Arrow. We replaced the human with a localized Neural Network that executes 10,000 queries per second.
            </p>
            
            <div className="space-y-6 pt-4">
              <MethodStep number="01" title="Ingestion & Normalization" desc="Upload your messy CSV. Our AI cleans the data, corrects typos in MPNs, and maps proprietary internal part numbers to global standards." />
              <MethodStep number="02" title="Algorithmic Sourcing" desc="We parallel-query 40+ global suppliers simultaneously, negotiating bulk breaks and evaluating lifecycle risks (NRND, EOL)." />
              <MethodStep number="03" title="Secure Execution" desc="Review your standardized quote in our Command Center, approve alternates, and execute payment with a single click." />
            </div>
          </div>

          {/* Visual Representation of Pipeline */}
          <div className="relative rounded-[2rem] border border-gray-800 bg-gray-900/50 backdrop-blur-md p-8 shadow-2xl overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <div className="relative z-10 flex flex-col gap-6">
              
              <div className="flex items-center justify-between p-4 rounded-xl bg-gray-950 border border-gray-800 shadow-inner">
                 <div className="flex items-center gap-3">
                   <FileSpreadsheet className="w-6 h-6 text-gray-500" />
                   <span className="font-mono text-sm text-gray-400">Raw_Customer_BOM.csv</span>
                 </div>
                 <span className="text-[10px] font-bold uppercase text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded">Detected</span>
              </div>

              <div className="flex justify-center -my-2">
                <div className="w-[2px] h-8 bg-gradient-to-b from-gray-800 to-blue-500/50 relative">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-blue-400 rounded-full animate-ping" />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl bg-blue-900/20 border border-blue-500/30 shadow-[0_0_30px_rgba(59,130,246,0.1)]">
                 <div className="flex items-center gap-3">
                   <BrainCircuit className="w-6 h-6 text-blue-400 animate-pulse" />
                   <span className="font-mono text-sm text-blue-300">SCS_Neural_Engine</span>
                 </div>
                 <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
              </div>

              <div className="flex justify-center -my-2">
                <div className="w-[2px] h-8 bg-gradient-to-b from-blue-500/50 to-gray-800" />
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl bg-gray-950 border border-gray-800 shadow-inner">
                 <div className="flex items-center gap-3">
                   <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                   <span className="font-mono text-sm text-gray-300">Procurement_Ready.json</span>
                 </div>
                 <span className="font-mono text-xs text-gray-500">142 Lines Verified</span>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* =====================================================================
          SECTION 4: HARDWARE EXPERTISE
          ===================================================================== */}
      <section id="expertise" className="relative z-10 bg-gray-950/60 backdrop-blur-2xl border-t border-white/5 py-24 lg:py-32">
        <div className="max-w-[1600px] w-full mx-auto px-6 lg:px-12">
          
          <div className="text-center max-w-3xl mx-auto mb-20 space-y-4">
            <h2 className="text-3xl lg:text-5xl font-extrabold tracking-tight text-white">Mastery Across Every Category.</h2>
            <p className="text-gray-400 text-lg leading-relaxed">
              We don't just parse text; our engine understands the physics and supply chain dynamics of critical hardware infrastructure.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ExpertiseCard 
              icon={<Cpu className="w-8 h-8 text-blue-400" />}
              title="Microprocessors & CPUs"
              desc="From advanced ARM Cortex MCUs to high-frequency FPGAs. We track wafer yields, fab lead times, and trace silicon allocation globally."
            />
            <ExpertiseCard 
              icon={<Layers className="w-8 h-8 text-emerald-400" />}
              title="Custom PCB Assemblies"
              desc="We parse raw Gerber files and coordinate with Tier-1 fabrication houses to guarantee precise impedance, layer stacking, and automated SMD placement."
            />
            <ExpertiseCard 
              icon={<HardDrive className="w-8 h-8 text-indigo-400" />}
              title="Memory & Storage (NAND)"
              desc="Navigate the volatile NAND/DRAM markets. Our predictive algorithms lock in pricing before market shifts affect your mass-production runs."
            />
            <ExpertiseCard 
              icon={<Activity className="w-8 h-8 text-amber-400" />}
              title="Passive Components"
              desc="MLCCs, resistors, and diodes. We cross-reference millions of generic alternatives instantly to ensure your assembly lines never halt for a $0.01 part."
            />
            <ExpertiseCard 
              icon={<Server className="w-8 h-8 text-rose-400" />}
              title="Electromechanical & Relays"
              desc="Industrial-grade switches, connectors, and heavy-duty relays sourced strictly from franchised distributors to guarantee authenticity."
            />
            <ExpertiseCard 
              icon={<Network className="w-8 h-8 text-cyan-400" />}
              title="RF & Connectivity"
              desc="High-precision antennas, transceivers, and BLE modules tracked across specific ITAR-compliant channels for defense and aerospace."
            />
          </div>
        </div>
      </section>

      {/* =====================================================================
          CTA & FOOTER
          ===================================================================== */}
      <footer className="relative z-10 border-t border-gray-800 bg-gray-950/90 backdrop-blur-xl mt-auto">
        <div className="max-w-[1600px] w-full mx-auto px-6 lg:px-12 py-16 flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <h3 className="text-2xl font-bold text-white mb-2">Ready to transform your supply chain?</h3>
            <p className="text-gray-500 text-sm">Drop your BOM into the engine at the top of the page to start for free.</p>
          </div>
          <button 
            onClick={scrollToPortal}
            className="bg-white hover:bg-gray-200 text-gray-900 px-8 py-4 rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-[0_0_30px_rgba(255,255,255,0.1)] focus:outline-none hover:scale-105 active:scale-95"
          >
            Launch Engine <ArrowLeft className="w-4 h-4 rotate-90" />
          </button>
        </div>
        <div className="border-t border-gray-800/50 px-6 lg:px-12 py-6 flex justify-between items-center text-gray-600 text-[10px] font-bold uppercase tracking-widest">
          <span>Enterprise Grade Architecture</span>
          <span>© 2026 K2Z Digital</span>
        </div>
      </footer>

    </div>
  );
}

// ============================================================================
// MICRO-COMPONENTS
// ============================================================================

const PortalLoader = () => (
  <div className="h-[350px] w-full rounded-[2rem] border border-gray-100 bg-white shadow-2xl flex flex-col items-center justify-center gap-4">
    <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
    <span className="text-xs text-gray-500 font-bold uppercase tracking-widest">Securing Gateway...</span>
  </div>
);

type ComparisonItemProps = { icon: React.ReactNode; text: string; };

const ComparisonItem = memo(({ icon, text }: ComparisonItemProps) => (
  <li className="flex items-start gap-3">
    <div className="mt-0.5">{icon}</div>
    <span className="font-medium leading-relaxed">{text}</span>
  </li>
));
ComparisonItem.displayName = 'ComparisonItem';

type ExpertiseCardProps = { icon: React.ReactNode; title: string; desc: string; };

const ExpertiseCard = memo(({ icon, title, desc }: ExpertiseCardProps) => (
  <div className="bg-gray-900/50 border border-gray-800 hover:border-gray-700 p-6 rounded-2xl transition-all hover:bg-gray-900/80 group">
    <div className="w-14 h-14 bg-gray-950 border border-gray-800 rounded-xl flex items-center justify-center mb-5 shadow-inner group-hover:scale-110 transition-transform duration-300">
      {icon}
    </div>
    <h3 className="text-lg font-bold text-white mb-2 tracking-tight">{title}</h3>
    <p className="text-sm text-gray-400 leading-relaxed font-medium">{desc}</p>
  </div>
));
ExpertiseCard.displayName = 'ExpertiseCard';

type MethodStepProps = { number: string; title: string; desc: string; };

const MethodStep = memo(({ number, title, desc }: MethodStepProps) => (
  <div className="flex gap-6 group cursor-default">
    <div className="text-3xl font-extrabold text-gray-800 group-hover:text-blue-500/50 transition-colors font-mono">
      {number}
    </div>
    <div>
      <h4 className="text-lg font-bold text-white mb-1 tracking-tight group-hover:text-blue-400 transition-colors">{title}</h4>
      <p className="text-sm text-gray-500 leading-relaxed font-medium">{desc}</p>
    </div>
  </div>
));
MethodStep.displayName = 'MethodStep';

type MagicTeaserProps = { payload: ParsedBomPayload; onReset: () => void; };

const MagicTeaser = memo(({ payload, onReset }: MagicTeaserProps) => {
  return (
    <div className="bg-gray-900/80 backdrop-blur-xl rounded-2xl p-4 shadow-2xl border border-gray-700 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
      
      <div className="flex items-center gap-3 relative z-10">
         <div className="w-9 h-9 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/30 shrink-0 relative">
           <BrainCircuit className="w-5 h-5 text-blue-400 animate-pulse" />
           <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-gray-900 flex items-center justify-center">
             <CheckCircle2 className="w-2 h-2 text-white" />
           </div>
         </div>
         <div>
           <p className="text-sm font-bold leading-tight">{payload.projectName}</p>
           <p className="text-[11px] text-blue-300 font-medium mt-0.5">AI Engine Staged {payload.items.length} Items</p>
         </div>
      </div>
      <button onClick={onReset} className="relative z-10 text-[11px] font-bold text-gray-400 hover:text-white transition-colors bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 w-full sm:w-auto active:scale-95">
        Reset Form
      </button>
    </div>
  );
});
MagicTeaser.displayName = 'MagicTeaser';