import { Suspense, lazy, useState, useEffect, memo, useRef } from 'react';
import { 
  Zap, Loader2, BrainCircuit, CheckCircle2, ArrowLeft, LogIn, 
  Menu, X, Home, Globe, Briefcase, Banknote, Code, Wrench, Network, 
  Terminal, Server, MapPin, TrendingUp, Cpu, Clock, GraduationCap,
  TerminalSquare, ChevronRight
} from 'lucide-react';

import { QuoteWizard, type ParsedBomPayload } from '@/features/onboarding/components/QuoteWizard';

// 1. Direct Vite Imports for src/assets 
import HERO_BG from '@/assets/BG00.png';
import LOGO from '@/assets/Logo.png';

const AuthPortal = lazy(() => 
  import('@/features/auth/components/AuthPortal').then((module) => ({ default: module.AuthPortal }))
);

type PortalMode = 'wizard' | 'auth-login' | 'auth-signup';

export default function LandingPage() {
  const [stagedBom, setStagedBom] = useState<ParsedBomPayload | null>(null);
  const [portalMode, setPortalMode] = useState<PortalMode>('wizard');
  const [isMounted, setIsMounted] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Terminal Form State
  const [formStatus, setFormStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

  // Hidden Console State
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setIsMounted(true));

    // Easter Egg: Listen for '~' or '`' to open the hidden console
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '`' || e.key === '~') {
        e.preventDefault();
        setIsConsoleOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setIsMobileMenuOpen(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormStatus('submitting');
    setTimeout(() => {
        setFormStatus('success');
    }, 2000);
  };

  return (
    <div className="relative min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-[#D4AF37] selection:text-black flex flex-col antialiased overflow-x-hidden">
      
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&display=swap');
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes popIn { 0% { opacity: 0; transform: scale(0.8); } 70% { transform: scale(1.05); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        
        .animate-on-load { opacity: 0; animation: fadeInUp 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
        .animate-pop-in { opacity: 0; animation: popIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
        .animate-marquee { animation: marquee 30s linear infinite; }
        
        .microchip-body {
            position: relative; background: linear-gradient(145deg, #0f172a 0%, #020617 100%);
            border: 1px solid #1e293b; border-radius: 4px;
            box-shadow: inset 0 0 20px rgba(0,0,0,0.8), 0 10px 30px rgba(0,0,0,0.5);
            transition: all 0.3s ease;
        }
      `}} />

      {/* =====================================================================
          HIDDEN DEVELOPER CONSOLE (EASTER EGG)
          ===================================================================== */}
      <div className={`fixed top-0 left-0 w-full bg-slate-950/95 backdrop-blur-xl border-b border-[#D4AF37] shadow-[0_10px_30px_rgba(212,175,55,0.2)] z-[200] transition-all duration-500 ease-in-out font-mono overflow-hidden ${isConsoleOpen ? 'h-[40vh] opacity-100' : 'h-0 opacity-0'}`}>
        <div className="p-4 flex items-center justify-between border-b border-slate-800 bg-black">
          <div className="flex items-center gap-2 text-[#D4AF37] text-xs font-bold tracking-widest">
            <TerminalSquare className="w-4 h-4" /> AI2_SYS_OVERRIDE
          </div>
          <button onClick={() => setIsConsoleOpen(false)} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <HiddenConsoleLogic scrollToSection={scrollToSection} />
      </div>

      {/* =====================================================================
          HEADER
          ===================================================================== */}
      <header className="fixed top-0 w-full z-[100] bg-slate-950/80 backdrop-blur-md border-b border-[#423005]/50 shadow-lg">
        <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-4 flex justify-between items-center">
            <div className="flex items-center gap-4 cursor-pointer" onClick={() => scrollToSection('Home')}>
                <div className="flex flex-col items-start text-left">
                    <h1 className="text-xl md:text-2xl font-black text-white tracking-wide flex items-center leading-none">
                        <img src={LOGO} alt="AI2 Logo" className="h-8 md:h-10 w-auto object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                        <span className="ml-2 font-light text-slate-300">ENGINEERING</span>
                    </h1>
                    <p className="text-[8px] md:text-[10px] uppercase text-[#FCD34D] tracking-widest font-bold mt-1 opacity-100">
                        Infrastructure for AI-assisted operations
                    </p>
                </div>
            </div>

            <nav className="hidden md:flex items-center gap-4 md:gap-8">
                <button onClick={() => scrollToSection('Home')} className="text-sm uppercase tracking-widest text-white hover:text-[#FCD34D] font-bold transition-colors">Home</button>
                <button onClick={() => scrollToSection('about')} className="text-sm uppercase tracking-widest text-white hover:text-[#FCD34D] font-bold transition-colors">About Us</button>
                <button onClick={() => scrollToSection('apply-terminal')} className="text-sm uppercase tracking-widest text-white hover:text-[#FCD34D] font-bold transition-colors">Contact Us</button>
                <div className="h-4 w-px bg-[#8C6819] mx-2"></div>
                <button 
                  onClick={() => { setPortalMode('auth-login'); scrollToSection('engine-portal'); }}
                  className="text-sm font-bold text-slate-300 hover:text-white transition-colors flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-800"
                >
                  <LogIn className="w-4 h-4" /> Sign In
                </button>
            </nav>

            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden text-[#D4AF37] p-2 focus:outline-none">
                <Menu className="w-8 h-8" />
            </button>
        </div>

        {/* =====================================================================
            LIVE SYSTEM TICKER (ENGAGEMENT FEATURE)
            ===================================================================== */}
        <div className="h-6 w-full bg-[#020617] border-t border-slate-900 flex items-center overflow-hidden">
            <div className="flex whitespace-nowrap animate-marquee w-[200%]">
                <SystemTickerContent />
                <SystemTickerContent />
            </div>
        </div>
      </header>

      {/* Mobile Menu */}
      <div className={`fixed inset-y-0 right-0 w-[280px] bg-slate-950/95 backdrop-blur-xl border-l border-[#D4AF37]/30 z-[101] shadow-2xl transform transition-transform duration-300 ease-in-out md:hidden flex flex-col p-8 ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <button onClick={() => setIsMobileMenuOpen(false)} className="self-end text-[#D4AF37] mb-8 hover:rotate-90 transition-transform duration-300">
              <X className="w-8 h-8" />
          </button>
          <nav className="flex flex-col gap-8">
              <button onClick={() => { scrollToSection('Home'); setIsMobileMenuOpen(false); }} className="text-left text-lg uppercase tracking-widest text-white font-bold hover:text-[#FCD34D] transition-colors">Home</button>
              <button onClick={() => { scrollToSection('about'); setIsMobileMenuOpen(false); }} className="text-left text-lg uppercase tracking-widest text-white font-bold hover:text-[#FCD34D] transition-colors">About Us</button>
              <button onClick={() => { scrollToSection('apply-terminal'); setIsMobileMenuOpen(false); }} className="text-left text-lg uppercase tracking-widest text-white font-bold hover:text-[#FCD34D] transition-colors">Contact Us</button>
              <div className="h-px bg-[#423005]/50 my-2"></div>
              <button 
                onClick={() => { setPortalMode('auth-login'); scrollToSection('engine-portal'); setIsMobileMenuOpen(false); }}
                className="text-left text-lg uppercase tracking-widest text-[#FCD34D] font-bold flex items-center gap-2"
              >
                <LogIn className="w-5 h-5" /> Sign In
              </button>
          </nav>
      </div>

      {/* =====================================================================
          HERO SECTION (Centered & Majestic)
          ===================================================================== */}
      <section id="Home" className="relative min-h-[90vh] flex items-center pt-24 pb-12 px-6 md:px-20 overflow-hidden bg-slate-950">
        <div className="fixed inset-0 z-0">
            <div className="w-full h-full bg-cover bg-center opacity-40 mix-blend-screen" style={{ backgroundImage: `url(${HERO_BG})` }} />
            <div className="absolute inset-0 bg-gradient-to-b md:bg-gradient-to-r from-slate-950 via-slate-950/60 to-transparent"></div>
        </div>

        <div className="relative z-10 w-full max-w-[1600px] mx-auto flex flex-col justify-between min-h-[70vh] gap-12 lg:gap-0 pt-10">
            
            <div className="max-w-4xl text-center md:text-left mt-10 md:mt-0">
                <div className="animate-on-load inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/80 border border-[#423005]/50 mb-6 cursor-help" title="Press '~' to open override console" style={{ animationDelay: '0.2s' }}>
                    <span className="w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse shadow-[0_0_8px_rgba(212,175,55,1)]"></span>
                    <span className="text-[8px] md:text-[10px] font-bold text-[#FCD34D] tracking-[0.2em] uppercase">System Online • Hiring Active</span>
                </div>

                <h2 className="animate-on-load font-black text-white tracking-tight mb-4 text-5xl md:text-6xl xl:text-7xl leading-[1.05]" style={{ animationDelay: '0.4s' }}>
                    INTELLIGENT<br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-br from-white via-[#FDE047] to-[#8C6819]">ENGINEERING FELLOWSHIP</span>
                </h2>
                
                <p className="animate-on-load text-sm md:text-xl text-white mb-10 max-w-2xl mx-auto md:mx-0 font-light leading-relaxed" style={{ animationDelay: '0.6s' }}>
                    Help build the future infrastructure layer for AI-assisted engineering.
                </p>

                <div className="animate-on-load flex flex-col sm:flex-row items-center gap-4 justify-center md:justify-start" style={{ animationDelay: '0.8s' }}>
                    <button onClick={() => scrollToSection('engine-portal')} className="w-full sm:w-auto text-center bg-white hover:bg-slate-200 text-slate-900 font-black py-4 px-10 rounded transition duration-300 shadow-[0_0_20px_rgba(255,255,255,0.1)] flex items-center justify-center gap-2">
                        <BrainCircuit className="w-5 h-5" /> TEST THE ENGINE
                    </button>
                    <button onClick={() => scrollToSection('apply-terminal')} className="w-full sm:w-auto text-center bg-[#D4AF37] hover:bg-[#B48A2D] text-black font-black py-4 px-10 rounded transition duration-300 shadow-xl">
                        APPLY NOW
                    </button>
                </div>
            </div>

            {/* The Floating Highlight Chips */}
            <div className="flex flex-wrap justify-center md:justify-end gap-3 sm:gap-6 mt-auto pb-10">
                <FloatingChip icon={Home} label="REMOTE SETUP" delay="1.0s" />
                <FloatingChip icon={Globe} label="GLOBAL OEMs" delay="1.1s" />
                <FloatingChip icon={Briefcase} label="REAL EXPOSURE" delay="1.2s" />
                
                <div className="hover:bg-[#D4AF37]/40 animate-pop-in flex flex-col items-center justify-center backdrop-blur-md bg-[#D4AF37]/10 border-2 border-[#D4AF37] rounded-full w-24 h-24 md:w-28 md:h-28 text-center shadow-[0_0_15px_rgba(212,175,55,0.3)] cursor-pointer" style={{ animationDelay: '1.3s' }}>
                    <Banknote className="w-5 h-5 md:w-8 md:h-8 text-[#D4AF37] mb-1" />
                    <p className="text-[8px] md:text-[10px] text-[#D4AF37] font-black uppercase">PAID</p>
                </div>
            </div>
        </div>
      </section>

      {/* =====================================================================
          THE ENGINE PORTAL (BOM SECTION - TERMINAL UI)
          ===================================================================== */}
      <section id="engine-portal" className="relative z-20 py-24 bg-[#020617] border-t border-slate-800/50">
        <div className="max-w-[1200px] w-full mx-auto px-6">
            
            <div className="text-center mb-12 animate-on-load">
                <h2 className="text-3xl font-black text-white tracking-[0.1em] mb-2 font-mono uppercase">
                    Let's build your BOM.
                </h2>
                <p className="text-[#B48A2D] text-sm font-mono tracking-widest uppercase">
                    &gt; Initialize Engine Below
                </p>
            </div>

            {/* Terminal Window Wrapper for the BOM Engine */}
            <div className="animate-on-load bg-[#020617] border border-slate-800 rounded shadow-[0_0_50px_rgba(0,0,0,0.8)] relative overflow-hidden" style={{ animationDelay: '0.2s' }}>
              
              {/* Terminal Header */}
              <div className="bg-slate-900 border-b border-[#423005]/50 p-3 flex items-center justify-between">
                  <div className="flex gap-2">
                      <div className="w-3 h-3 rounded-full bg-slate-700"></div>
                      <div className="w-3 h-3 rounded-full bg-slate-700"></div>
                      <div className="w-3 h-3 rounded-full bg-[#D4AF37] shadow-[0_0_8px_rgba(212,175,55,0.8)]"></div>
                  </div>
                  <div className="font-mono text-xs text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse"></span>
                      SCS_ENGINE_CORE.EXE
                  </div>
                  <div><Server className="w-4 h-4 text-slate-600" /></div>
              </div>

              {/* Glowing Separator */}
              <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent"></div>

              {/* Terminal Body */}
              <div className="p-4 md:p-8 relative min-h-[400px]">
                <svg className="absolute bottom-0 right-0 w-64 h-64 opacity-[0.03] pointer-events-none" fill="none" stroke="#D4AF37" strokeWidth="2">
                    <path d="M 100,200 L 150,200 L 200,150 L 250,150" />
                    <circle cx="250" cy="150" r="4" fill="#D4AF37" />
                    <path d="M 50,250 L 100,250 L 150,200" />
                </svg>
                
                <div className="relative z-10 w-full">
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
                      <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 w-full">
                      <button 
                          onClick={() => setPortalMode('wizard')} 
                          className="mb-4 text-xs font-bold text-slate-400 hover:text-[#FCD34D] transition-colors flex items-center gap-1.5 focus:outline-none rounded p-1 -ml-1 group font-mono"
                      >
                          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" /> &gt; Back to Engine
                      </button>
                      <Suspense fallback={<PortalLoader />}>
                          <AuthPortal key={portalMode} initialStep={portalMode === 'auth-login' ? 'login' : 'intent'} />
                      </Suspense>
                      </div>
                  )}
                </div>
              </div>
            </div>
        </div>
      </section>

      {/* =====================================================================
          ABOUT US & PILLARS
          ===================================================================== */}
      <section id="about" className="relative min-h-[60vh] flex items-center py-24 bg-[#020617] border-t border-slate-800/50 z-10 overflow-hidden">
        <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: `linear-gradient(to right, rgba(212, 175, 55, 0.5) 1px, transparent 1px), linear-gradient(to bottom, rgba(212, 175, 55, 0.5) 1px, transparent 1px)`, backgroundSize: '40px 40px' }} />

        <div className="max-w-[1600px] mx-auto px-6 relative z-10 w-full">
            <div className="text-center mb-10 md:mb-14 animate-on-load">
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-[#FCD34D] inline-block mb-2 tracking-tight uppercase">
                    About Us
                </h2>
                <div className="h-[1px] w-16 bg-[#D4AF37]/50 mx-auto shadow-[0_0_8px_rgba(212,175,55,0.8)]"></div>
            </div>

            <div className="max-w-5xl mx-auto mb-16">
                <p className="animate-on-load text-slate-300 text-lg md:text-xl text-center leading-relaxed font-light mb-12" style={{ animationDelay: '0.2s' }}>
                    Building a new generation of <span className="text-[#FCD34D] font-medium" style={{ textShadow: '0 0 10px rgba(212,175,55,0.3)' }}>AI-assisted engineering infrastructure</span> connecting global manufacturers, engineers, and future technical leaders.
                </p>
                
                <div className="animate-on-load grid sm:grid-cols-2 gap-x-8 md:gap-x-12 gap-y-8 text-sm md:text-base border-t border-slate-800/30 pt-10" style={{ animationDelay: '0.4s' }}>
                    <div className="space-y-4">
                        <p className="text-slate-400 leading-relaxed">
                            At <span className="text-white font-medium">AI² Engineering</span>, we architect the future manufacturing landscape by bridging the gap between high-level intelligent systems and foundational hardware.
                        </p>
                        <p className="text-slate-500 text-[10px] md:text-[11px] uppercase tracking-[0.2em] font-bold">CORE MISSION: RESILIENCE & EFFICIENCY</p>
                    </div>
                    <div className="space-y-4">
                        <p className="text-slate-400 leading-relaxed">
                            Supporting semiconductor and OEM giants, we provide the backend intelligence needed for rapid automation through the <span className="text-[#D4AF37] italic">synergy of human intuition and AI.</span>
                        </p>
                        <p className="text-slate-500 text-[10px] md:text-[11px] uppercase tracking-[0.2em] font-bold">STATUS: INNOVATION & PRECISION</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-4 gap-2 md:gap-4 lg:gap-6 max-w-5xl mx-auto">
                <PillarCard icon={Server} subtitle="Architecture" title="Remote Setup" delay="0.5s" />
                <PillarCard icon={Globe} subtitle="Network" title="Global OEMs" delay="0.6s" />
                <PillarCard icon={Cpu} subtitle="Processing" title="Real Exposure" delay="0.7s" />
                
                <div className="group microchip-container animate-pop-in" style={{ animationDelay: '0.8s' }}>
                    <div className="microchip-body p-2 sm:p-3 md:p-4 flex flex-col items-center text-center min-h-[90px] sm:min-h-[110px] md:min-h-[130px] justify-center border-[#D4AF37]/40 bg-slate-900/40 shadow-[0_0_15px_rgba(212,175,55,0.1)] backdrop-blur-md transition-all duration-300">
                        <Banknote className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-[#FCD34D] mb-1.5 md:mb-2 drop-shadow-[0_0_8px_rgba(212,175,55,0.6)]" />
                        <p className="text-[7px] sm:text-[8px] md:text-[9px] text-[#FCD34D] uppercase font-black tracking-wider mb-0.5">Compensation</p>
                        <h3 className="font-black text-[#FCD34D] text-[9px] sm:text-xs md:text-sm tracking-tight leading-tight">IT IS PAID</h3>
                    </div>
                </div>
            </div>
        </div>
      </section>

      {/* =====================================================================
          WHO WE ARE LOOKING FOR
          ===================================================================== */}
      <section className="max-w-[1200px] mx-auto px-4 sm:px-6 py-20 relative w-full">
        <div className="flex flex-col items-center text-center animate-on-load mb-12">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-[#FCD34D] inline-block mb-2 tracking-tight uppercase">
                Who are we looking for?
            </h2>
        </div>

        <div className="animate-on-load grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-0 bg-slate-900/30 p-6 lg:p-8 rounded-lg border border-slate-800 shadow-2xl backdrop-blur-sm relative overflow-hidden" style={{ animationDelay: '0.3s' }}>
            <div className="absolute top-0 left-0 w-2.5 h-2.5 border-r border-b border-[#B48A2D]"></div>
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-l border-t border-[#B48A2D]"></div>
            
            <div className="lg:pr-8 relative">
                <h3 className="text-[10px] sm:text-xs font-black text-[#D4AF37] mb-6 tracking-[0.2em] uppercase flex items-center gap-2">
                    <span className="w-3 h-[1px] bg-[#D4AF37] shrink-0"></span> What You'll Work On
                </h3>
                <ul className="space-y-5">
                    <WhoItem icon={Code} title="Full-Stack Dev" desc="Platform architecture & logic layers." />
                    <WhoItem icon={Wrench} title="Engineering & Technical Support" isSimple />
                    <WhoItem icon={Network} title="BOM & Supply Chain Intelligence" isSimple />
                    <WhoItem icon={BrainCircuit} title="AI-Assisted Engineering Operations" isSimple />
                </ul>
            </div>

            <div className="lg:px-8 border-t lg:border-t-0 lg:border-l border-slate-800 pt-8 lg:pt-0">
                <h3 className="text-[10px] sm:text-xs font-black text-[#D4AF37] mb-6 tracking-[0.2em] uppercase flex items-center gap-2">
                    <span className="w-3 h-[1px] bg-[#D4AF37] shrink-0"></span> Input Requirements
                </h3>
                <ul className="space-y-6">
                    <ReqItem icon={Cpu} title="Background" desc="Electronics Engineering, Mechanical Engineering, or Software Dev with hardware affinity." />
                    <ReqItem icon={Zap} title="Ideal Traits" desc="Curious & motivated, detail-oriented, and a strong communicator." />
                </ul>
            </div>

            <div className="lg:pl-8 border-t lg:border-t-0 lg:border-l border-slate-800 pt-8 lg:pt-0">
                <h3 className="text-[10px] sm:text-xs font-black text-[#D4AF37] mb-6 tracking-[0.2em] uppercase flex items-center gap-2">
                    <span className="w-3 h-[1px] bg-[#D4AF37] shrink-0"></span> What You'll Gain
                </h3>
                <ul className="space-y-4">
                    <UpgradeItem text="Real-world engineering exposure" />
                    <UpgradeItem text="Mentorship from industry professionals" />
                    <UpgradeItem text="Hands-on learning beyond university curriculum" />
                    <UpgradeItem text="Career growth & leadership pathways" />
                </ul>
            </div>
        </div>
      </section>

      {/* =====================================================================
          COMPENSATION & SETUP
          ===================================================================== */}
      <section className="max-w-[1200px] w-full mx-auto px-6 mb-24">
        <div className="bg-[#020617] border border-slate-800 rounded-lg p-8 relative overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)]">
            <div className="absolute top-0 right-0 w-64 h-64 border-t border-r border-[#D4AF37]/20 rounded-tr-3xl -mt-4 -mr-4 pointer-events-none"></div>
            
            <h2 className="text-xl md:text-2xl font-black text-white mb-8 flex items-center gap-3 uppercase font-mono tracking-wide">
                <Terminal className="w-6 h-6 text-[#D4AF37]" />
                Compensation & System Setup
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
                <div className="bg-slate-900 border border-[#D4AF37]/50 rounded p-5 flex flex-col items-start gap-4 shadow-[0_0_15px_rgba(212,175,55,0.1)] hover:-translate-y-1 transition-transform">
                    <div className="p-2 bg-[#D4AF37]/10 rounded border border-[#D4AF37]/30 text-[#FCD34D]">
                        <Banknote className="w-6 h-6" />
                    </div>
                    <div>
                        <span className="font-black text-[#FCD34D] tracking-widest text-sm uppercase block font-mono mb-1">IT IS PAID</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block font-mono">Guaranteed</span>
                    </div>
                </div>

                <CompCard icon={Clock} title="Flexible Schedules" desc="Work asynchronously" />
                <CompCard icon={MapPin} title="Remote-Friendly" desc="Global connectivity" />
                <CompCard icon={TrendingUp} title="Performance Growth" desc="Merit-based scaling" />
            </div>
        </div>
      </section>

      {/* =====================================================================
          APPLY TERMINAL FORM
          ===================================================================== */}
      <section id="apply-terminal" className="max-w-3xl mx-auto px-6 py-24 relative z-20 w-full -mt-20">
        <div className="animate-on-load bg-[#020617] border border-slate-800 rounded shadow-[0_0_50px_rgba(0,0,0,0.8)] relative overflow-hidden">
            
            <div className="bg-slate-900 border-b border-[#423005]/50 p-3 flex items-center justify-between">
                <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-slate-700"></div>
                    <div className="w-3 h-3 rounded-full bg-slate-700"></div>
                    <div className="w-3 h-3 rounded-full bg-[#D4AF37] shadow-[0_0_8px_rgba(212,175,55,0.8)]"></div>
                </div>
                <div className="font-mono text-xs text-slate-500 uppercase tracking-widest">
                    AI2 RECRUITMENT.EXE
                </div>
                <div><Terminal className="w-4 h-4 text-slate-600" /></div>
            </div>

            <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent"></div>

            <div className="p-8 md:p-12 relative">
                <svg className="absolute bottom-0 right-0 w-64 h-64 opacity-5 pointer-events-none" fill="none" stroke="#D4AF37" strokeWidth="2">
                    <path d="M 100,200 L 150,200 L 200,150 L 250,150" />
                    <circle cx="250" cy="150" r="4" fill="#D4AF37" />
                    <path d="M 50,250 L 100,250 L 150,200" />
                </svg>

                {formStatus === 'idle' && (
                    <>
                        <div className="mb-10 text-center animate-on-load" style={{ animationDelay: '0.2s' }}>
                            <h2 className="text-3xl font-black text-white tracking-[0.1em] mb-2 font-mono">INITIALIZE CONNECTION</h2>
                            <p className="text-[#B48A2D] text-sm font-mono tracking-widest uppercase">&gt; Awaiting Data Input...</p>
                        </div>

                        <form onSubmit={handleFormSubmit} className="space-y-6 relative z-10">
                            <div className="relative group animate-on-load" style={{ animationDelay: '0.3s' }}>
                                <label className="block text-xs font-mono text-slate-400 uppercase tracking-widest mb-2 group-focus-within:text-[#FCD34D] transition-colors">Name</label>
                                <input required type="text" className="w-full bg-slate-900/50 border border-slate-700 text-white font-mono text-sm p-4 rounded-sm focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all placeholder:text-slate-600" placeholder="Full Name" />
                            </div>

                            <div className="relative group animate-on-load" style={{ animationDelay: '0.4s' }}>
                                <label className="block text-xs font-mono text-slate-400 uppercase tracking-widest mb-2 group-focus-within:text-[#FCD34D] transition-colors">Email</label>
                                <input required type="email" className="w-full bg-slate-900/50 border border-slate-700 text-white font-mono text-sm p-4 rounded-sm focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all placeholder:text-slate-600" placeholder="Email Address" />
                            </div>

                            <div className="relative group animate-on-load" style={{ animationDelay: '0.5s' }}>
                                <label className="block text-xs font-mono text-slate-400 uppercase tracking-widest mb-2 group-focus-within:text-[#FCD34D] transition-colors">Application Letter</label>
                                <textarea required rows={4} className="w-full bg-slate-900/50 border border-slate-700 text-white font-mono text-sm p-4 rounded-sm focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all placeholder:text-slate-600 resize-none" placeholder="Drop your LinkedIn/Portfolio link or a brief message..."></textarea>
                            </div>

                            <div className="pt-6 flex justify-end border-t border-slate-800 animate-on-load" style={{ animationDelay: '0.6s' }}>
                                <button type="submit" className="group relative px-8 py-4 bg-[#D4AF37]/10 border border-[#D4AF37] text-[#FCD34D] font-bold uppercase tracking-widest overflow-hidden transition-all duration-500 hover:text-black w-full md:w-auto font-mono">
                                    <div className="absolute inset-0 bg-[#D4AF37] translate-y-[100%] group-hover:translate-y-0 transition-transform duration-300 ease-in-out -z-10"></div>
                                    <span className="flex items-center justify-center gap-2">
                                        SEND <ArrowLeft className="w-4 h-4 rotate-180 group-hover:translate-x-1 transition-transform" />
                                    </span>
                                </button>
                            </div>
                        </form>
                    </>
                )}

                {formStatus === 'submitting' && (
                    <div className="flex flex-col justify-center items-center py-12">
                        <Loader2 className="w-12 h-12 text-[#D4AF37] animate-spin mb-6" />
                        <h3 className="text-xl font-black text-white tracking-[0.1em] font-mono mb-2 animate-pulse">TRANSMITTING...</h3>
                        <p className="text-[#D4AF37] font-mono text-xs">&gt; Establishing secure connection to AI2 servers</p>
                    </div>
                )}

                {formStatus === 'success' && (
                    <div className="flex flex-col justify-center items-center py-12 text-center animate-in fade-in zoom-in duration-500">
                        <div className="text-[#D4AF37] mb-6 flex justify-center drop-shadow-[0_0_15px_rgba(212,175,55,0.8)]">
                            <CheckCircle2 className="w-16 h-16" />
                        </div>
                        <h3 className="text-2xl font-black text-white tracking-[0.1em] font-mono mb-2">SUCCESS</h3>
                        <p className="text-slate-400 font-mono text-sm mb-8">&gt; Data transmitted. We will contact you soon.</p>
                        <button onClick={() => setFormStatus('idle')} className="px-8 py-3 border border-[#D4AF37] text-[#D4AF37] font-mono text-sm hover:bg-[#D4AF37] hover:text-black transition-colors">
                            CLOSE LINK
                        </button>
                    </div>
                )}
            </div>
        </div>
      </section>

      {/* =====================================================================
          FOOTER
          ===================================================================== */}
      <footer className="bg-black relative overflow-hidden pt-20 pb-10 border-t border-slate-900 mt-auto">
        <div className="absolute inset-0 pointer-events-none mix-blend-screen opacity-10" style={{ backgroundImage: `linear-gradient(to right, rgba(212, 175, 55, 0.5) 1px, transparent 1px), linear-gradient(to bottom, rgba(212, 175, 55, 0.5) 1px, transparent 1px)`, backgroundSize: '20px 20px' }} />

        {/* The Exact Core Fellowship Motto */}
        <div className="relative z-10 max-w-4xl mx-auto text-center mb-20 border-b border-slate-900 pb-12">
            <h2 className="text-2xl md:text-3xl font-black text-white tracking-[0.2em] mb-4">
                BUILD. LEARN. IMPACT THE FUTURE.
            </h2>
            <div className="w-24 h-1 bg-[#D4AF37] mx-auto rounded my-4 shadow-[0_0_10px_rgba(212,175,55,0.5)]" />
            <p className="text-[#FCD34D] tracking-wider text-xs md:text-sm font-bold uppercase mt-6">
                EXPOSURE + LEARNING + REAL INDUSTRY EXPERIENCE = YOUR FUTURE STARTS HERE.
            </p>
        </div>

        <div className="max-w-[1600px] mx-auto px-6 relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
                <div className="md:col-span-1">
                    <h2 className="text-xl font-black text-white tracking-wide flex items-center mb-4">
                        AI<sup className="text-[#D4AF37] ml-0.5">2</sup>
                        <span className="ml-2 font-light text-slate-300">ENGINEERING</span>
                    </h2>
                    <p className="text-slate-500 text-sm leading-relaxed font-light mb-6">
                        Architecting the support layer connecting global manufacturers, engineers, and intelligent hardware systems.
                    </p>
                    <div className="flex gap-4 items-center">
                        <div className="w-2 h-2 rounded-full bg-[#D4AF37] shadow-[0_0_8px_rgba(212,175,55,0.8)]"></div>
                        <span className="text-[10px] text-[#D4AF37] font-mono tracking-widest uppercase">System Online</span>
                    </div>
                </div>

                <div>
                    <h3 className="text-white font-bold uppercase tracking-widest text-xs mb-6 flex items-center gap-2">
                        <span className="w-2 h-[2px] bg-[#D4AF37]"></span> Links
                    </h3>
                    <ul className="space-y-4">
                        <li><button onClick={() => scrollToSection('apply-terminal')} className="text-[#D4AF37] hover:text-[#FCD34D] transition-colors text-sm font-mono">&gt; Apply Now</button></li>
                        <li><button onClick={() => scrollToSection('engine-portal')} className="text-[#D4AF37] hover:text-[#FCD34D] transition-colors text-sm font-mono">&gt; Test Engine</button></li>
                    </ul>
                </div>

                <div>
                    <h3 className="text-white font-bold uppercase tracking-widest text-xs mb-6 flex items-center gap-2">
                        <span className="w-2 h-[2px] bg-[#D4AF37]"></span> Docs
                    </h3>
                    <ul className="space-y-4">
                        <li><a href="#" className="text-slate-400 hover:text-[#FCD34D] transition-colors text-sm font-mono">&gt; Privacy Policy</a></li>
                        <li><a href="#" className="text-slate-400 hover:text-[#FCD34D] transition-colors text-sm font-mono">&gt; Terms of Service</a></li>
                    </ul>
                </div>

                <div>
                    <h3 className="text-white font-bold uppercase tracking-widest text-xs mb-6 flex items-center gap-2">
                        <span className="w-2 h-[2px] bg-[#D4AF37]"></span> Comm Link
                    </h3>
                    <ul className="space-y-4">
                        <li>
                            <a href="mailto:careers@ai2engineering.com" className="text-slate-400 hover:text-[#FCD34D] transition-colors text-sm flex items-center gap-3">
                                <Terminal className="w-4 h-4" />
                                careers@ai2engineering.com
                            </a>
                        </li>
                    </ul>
                </div>
            </div>

            <hr className="border-slate-900 mb-8" />

            <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-mono text-slate-600">
                <p>&copy; {new Date().getFullYear()} AI² Engineering Hardware Division. All rights reserved.</p>
                <div className="flex items-center gap-4">
                    <span>DATE: {new Date().getFullYear()}</span>
                    <span>PHL</span>
                    <span>EOF</span>
                </div>
            </div>
        </div>
        <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-[#423005] via-[#D4AF37] to-[#423005] opacity-50"></div>
      </footer>

    </div>
  );
}

// ============================================================================
// MICRO-COMPONENTS
// ============================================================================

const FloatingChip = memo(({ icon: Icon, label, delay }: { icon: any, label: string, delay: string }) => (
    <div className="hover:bg-[#D4AF37]/40 transition duration-300 animate-pop-in flex flex-col items-center justify-center bg-slate-900/80 border border-slate-700/50 rounded-full w-24 h-24 md:w-28 md:h-28 text-center backdrop-blur-md cursor-pointer" style={{ animationDelay: delay }}>
        <Icon className="w-5 h-5 md:w-8 md:h-8 text-[#D4AF37] mb-1" />
        <p className="text-[8px] md:text-[10px] text-white font-bold leading-tight uppercase" dangerouslySetInnerHTML={{__html: label.replace(' ', '<br/>')}}></p>
    </div>
));
FloatingChip.displayName = 'FloatingChip';

const PillarCard = memo(({ icon: Icon, subtitle, title, delay }: { icon: any, subtitle: string, title: string, delay: string }) => (
    <div className="group microchip-container animate-pop-in" style={{ animationDelay: delay }}>
        <div className="microchip-body p-2 sm:p-3 md:p-4 flex flex-col items-center text-center min-h-[90px] sm:min-h-[110px] md:min-h-[130px] justify-center transition-all duration-300 hover:bg-[#D4AF37]/5 cursor-pointer">
            <Icon className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-[#D4AF37] mb-1.5 md:mb-2 opacity-80" />
            <p className="text-[7px] sm:text-[8px] md:text-[9px] text-[#B48A2D] uppercase font-bold tracking-wider mb-0.5">{subtitle}</p>
            <h3 className="font-bold text-white text-[9px] sm:text-xs md:text-sm tracking-wide leading-tight">{title}</h3>
        </div>
    </div>
));
PillarCard.displayName = 'PillarCard';

const WhoItem = ({ icon: Icon, title, desc, isSimple = false }: any) => (
    <li className="flex items-start gap-3">
        <div className={`mt-0.5 shrink-0 ${isSimple ? 'text-[#B48A2D]' : 'text-[#D4AF37]'}`}><Icon className="w-4 h-4 sm:w-5 sm:h-5" /></div>
        {isSimple ? (
             <span className="text-slate-300 mt-0.5 font-medium text-[11px] sm:text-xs">{title}</span>
        ) : (
            <div>
                <strong className="block text-white font-bold tracking-wide text-sm sm:text-base">{title}</strong>
                <span className="text-[11px] sm:text-xs text-slate-400 block mt-0.5">{desc}</span>
            </div>
        )}
    </li>
);

const ReqItem = ({ icon: Icon, title, desc }: any) => (
    <li className="flex items-start gap-3">
        <div className="p-1.5 sm:p-2 bg-slate-950 border border-slate-800 rounded text-[#D4AF37] shadow-[inset_0_0_8px_rgba(212,175,55,0.1)] shrink-0">
            <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </div>
        <div>
            <strong className="block text-white mb-0.5 tracking-wide text-[13px] sm:text-sm">{title}</strong>
            <span className="text-slate-400 leading-relaxed text-[11px] sm:text-xs">{desc}</span>
        </div>
    </li>
);

const UpgradeItem = ({ text }: { text: string }) => (
    <li className="flex items-center gap-2.5 sm:gap-3 group">
        <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-slate-700 group-hover:bg-[#FCD34D] group-hover:shadow-[0_0_8px_#D4AF37] transition-all shrink-0"></div>
        <span className="text-slate-300 group-hover:text-white transition-colors text-[11px] sm:text-xs">{text}</span>
    </li>
);

const CompCard = ({ icon: Icon, title, desc }: { icon: any, title: string, desc: string }) => (
    <div className="bg-slate-900/50 border border-slate-800 hover:border-slate-700 rounded p-5 flex flex-col items-start gap-4 hover:-translate-y-1 transition-transform">
        <div className="p-2 bg-slate-950 rounded border border-slate-800 text-slate-400">
            <Icon className="w-6 h-6" />
        </div>
        <div>
            <span className="font-bold text-white text-sm block mb-1">{title}</span>
            <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest block">{desc}</span>
        </div>
    </div>
);

const PortalLoader = () => (
  <div className="h-[350px] w-full rounded-[2rem] border border-slate-800 bg-slate-900 shadow-2xl flex flex-col items-center justify-center gap-4">
    <Loader2 className="w-8 h-8 text-[#D4AF37] animate-spin" />
    <span className="text-xs text-slate-400 font-bold uppercase tracking-widest font-mono">Securing Gateway...</span>
  </div>
);

const MagicTeaser = memo(({ payload, onReset }: { payload: ParsedBomPayload; onReset: () => void }) => {
  return (
    <div className="bg-[#020617] rounded-sm p-4 shadow-2xl border border-[#D4AF37]/50 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
      
      <div className="flex items-center gap-3 relative z-10">
         <div className="w-9 h-9 rounded bg-[#D4AF37]/10 flex items-center justify-center border border-[#D4AF37]/30 shrink-0 relative">
           <BrainCircuit className="w-5 h-5 text-[#FCD34D] animate-pulse" />
           <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-[#020617] rounded-full flex items-center justify-center">
             <div className="w-2 h-2 bg-[#D4AF37] rounded-full shadow-[0_0_5px_#D4AF37]"></div>
           </div>
         </div>
         <div>
           <p className="text-sm font-bold leading-tight text-white font-mono uppercase">{payload.projectName}</p>
           <p className="text-[11px] text-[#B48A2D] font-mono mt-0.5">&gt; Engine Staged {payload.items.length} Items</p>
         </div>
      </div>
      <button onClick={onReset} className="relative z-10 text-[11px] font-bold text-slate-400 hover:text-black hover:bg-[#D4AF37] transition-colors bg-slate-900 px-4 py-2 border border-slate-700 hover:border-[#D4AF37] focus:outline-none w-full sm:w-auto font-mono uppercase tracking-widest">
        Reset Engine
      </button>
    </div>
  );
});
MagicTeaser.displayName = 'MagicTeaser';

// ============================================================================
// NEW ENGAGEMENT COMPONENTS
// ============================================================================

const SystemTickerContent = memo(() => (
  <div className="flex items-center gap-8 px-4 w-full justify-around min-w-max">
    <span className="text-[10px] text-slate-500 font-mono tracking-widest uppercase flex items-center gap-2"><div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse"></div> SYS_LOAD: 12.4%</span>
    <span className="text-[10px] text-slate-500 font-mono tracking-widest uppercase flex items-center gap-2"><div className="w-1 h-1 bg-[#D4AF37] rounded-full"></div> ROUTING: DIGIKEY_EU</span>
    <span className="text-[10px] text-slate-500 font-mono tracking-widest uppercase flex items-center gap-2"><div className="w-1 h-1 bg-blue-500 rounded-full"></div> PARSER: ACTIVE</span>
    <span className="text-[10px] text-slate-500 font-mono tracking-widest uppercase flex items-center gap-2"><div className="w-1 h-1 bg-amber-500 rounded-full"></div> LATENCY: 42MS</span>
    <span className="text-[10px] text-slate-500 font-mono tracking-widest uppercase flex items-center gap-2"><div className="w-1 h-1 bg-purple-500 rounded-full animate-pulse"></div> INGEST: 14,202 ROWS (OEM_ALPHA)</span>
  </div>
));
SystemTickerContent.displayName = 'SystemTickerContent';

const HiddenConsoleLogic = ({ scrollToSection }: { scrollToSection: (id: string) => void }) => {
  const [history, setHistory] = useState<{ type: 'input' | 'output', text: string }[]>([
    { type: 'output', text: 'AI2 Core Infrastructure Terminal v1.0.4' },
    { type: 'output', text: 'Type "help" for a list of available commands.' }
  ]);
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const cmd = input.trim().toLowerCase();
    const newHistory = [...history, { type: 'input' as const, text: `> ${input}` }];

    switch (cmd) {
      case 'help':
        newHistory.push({ type: 'output', text: 'AVAILABLE COMMANDS: help, stack, status, clear, apply' });
        break;
      case 'stack':
        newHistory.push({ type: 'output', text: 'CORE: React 19, Vite, TypeScript, TailwindCSS v4.' });
        newHistory.push({ type: 'output', text: 'DATA: Supabase, Postgres, Zustand, TanStack Query.' });
        break;
      case 'status':
        newHistory.push({ type: 'output', text: 'SYSTEM: Online. ALL REGIONS GREEN.' });
        break;
      case 'clear':
        setHistory([]);
        setInput('');
        return;
      case 'apply':
        newHistory.push({ type: 'output', text: 'INITIALIZING APPLICATION SEQUENCE...' });
        scrollToSection('apply-terminal');
        break;
      default:
        newHistory.push({ type: 'output', text: `COMMAND NOT FOUND: ${cmd}` });
    }

    setHistory(newHistory);
    setInput('');
  };

  return (
    <div className="p-4 h-[calc(100%-50px)] overflow-y-auto bg-[#020617] flex flex-col font-mono text-sm" onClick={() => inputRef.current?.focus()}>
      <div className="flex-1 space-y-2">
        {history.map((line, i) => (
          <div key={i} className={`${line.type === 'input' ? 'text-[#D4AF37]' : 'text-slate-400'}`}>
            {line.text}
          </div>
        ))}
      </div>
      <form onSubmit={handleCommand} className="mt-4 flex items-center gap-2 text-[#D4AF37]">
        {/* ESCAPED CHARACTER HERE */}
        <span>&gt;</span>
        <input 
          ref={inputRef}
          type="text" 
          value={input} 
          onChange={e => setInput(e.target.value)} 
          className="flex-1 bg-transparent border-none outline-none text-[#FCD34D]"
          autoComplete="off"
          spellCheck="false"
        />
      </form>
    </div>
  );
};