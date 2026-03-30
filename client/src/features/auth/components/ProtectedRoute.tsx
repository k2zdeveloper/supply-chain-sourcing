import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { Loader2 } from 'lucide-react';

type AppRole = 'admin' | 'manager' | 'buyer' | 'viewer';

export function ProtectedRoute({ allowedRoles }: { allowedRoles?: AppRole[] }) {
  const { user, role, isInitialized } = useAuthStore();
  const location = useLocation();

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center text-zinc-500">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-4" />
        <span className="text-sm font-medium tracking-wide">Verifying clearance...</span>
      </div>
    );
  }

  if (!user) return <Navigate to="/" state={{ from: location }} replace />;
  if (allowedRoles && role && !allowedRoles.includes(role as AppRole)) return <Navigate to="/unauthorized" replace />;

  return <Outlet />;
}