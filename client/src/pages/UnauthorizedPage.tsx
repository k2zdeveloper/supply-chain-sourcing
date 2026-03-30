import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';

export default function UnauthorizedPage() {
  const navigate = useNavigate();

  const handleSafeReturn = () => {
    // If they have history within the app, go back. Otherwise, force them to the dashboard index.
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate('/dashboard', { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-white selection:bg-emerald-500/30 relative overflow-hidden">
      
      {/* Enterprise Ambient Threat Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-red-500/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative z-10 max-w-md w-full text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        <div className="w-24 h-24 bg-red-500/10 border border-red-500/20 rounded-3xl flex items-center justify-center mx-auto shadow-2xl shadow-red-500/20">
          <ShieldAlert className="w-12 h-12 text-red-500" />
        </div>
        
        <div className="space-y-3">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Clearance Denied</h1>
          <p className="text-zinc-400 text-sm sm:text-base leading-relaxed">
            Your current Role-Based Access Control (RBAC) privileges do not permit viewing this sector. This event has been logged.
          </p>
        </div>

        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button 
            onClick={handleSafeReturn}
            className="w-full sm:w-auto bg-zinc-900 border border-white/10 hover:bg-zinc-800 text-white px-6 py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-zinc-500/50"
          >
            <ArrowLeft className="w-4 h-4" /> Return to Previous
          </button>
          
          <button 
            onClick={() => navigate('/dashboard', { replace: true })}
            className="w-full sm:w-auto bg-white text-zinc-950 hover:bg-zinc-200 px-6 py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2 shadow-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          >
            <Home className="w-4 h-4" /> Command Center
          </button>
        </div>
      </div>
    </div>
  );
}