import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { ShieldAlert, RefreshCcw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // In production, log this to Sentry, Datadog, or your analytics platform
    console.error('Uncaught React Error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-white selection:bg-red-500/30 relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-red-500/10 blur-[100px] rounded-full pointer-events-none" />
          
          <div className="relative z-10 max-w-md w-full text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto shadow-2xl shadow-red-500/20">
              <ShieldAlert className="w-10 h-10 text-red-500" />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-extrabold tracking-tight">UI Telemetry Failure</h1>
              <p className="text-zinc-400 text-sm leading-relaxed">
                A fatal rendering error occurred in this module. Our engineering team has been notified via the telemetry stream.
              </p>
            </div>

            <div className="bg-zinc-900/50 border border-white/5 p-4 rounded-xl text-left overflow-x-auto">
              <p className="text-xs font-mono text-red-400 whitespace-nowrap">
                {this.state.error?.message || 'Unknown Runtime Error'}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button 
                onClick={() => window.location.reload()}
                className="w-full sm:w-auto bg-white text-zinc-950 hover:bg-zinc-200 px-5 py-2.5 rounded-lg font-bold transition-all flex items-center justify-center gap-2 shadow-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              >
                <RefreshCcw className="w-4 h-4" /> Restart Module
              </button>
              <button 
                onClick={() => window.location.href = '/dashboard'}
                className="w-full sm:w-auto bg-zinc-900 border border-white/10 hover:bg-zinc-800 text-white px-5 py-2.5 rounded-lg font-bold transition-all flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-zinc-500/50"
              >
                <Home className="w-4 h-4" /> Command Center
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}