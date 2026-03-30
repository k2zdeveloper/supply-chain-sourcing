import { useState, useMemo, useEffect, useCallback } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, FolderKanban, FileText, ShoppingCart, 
  ShieldAlert, TrendingDown, FileCheck, Settings, 
  LogOut, Menu, X, Command, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';

// ============================================================================
// STRICT TYPES
// ============================================================================
type NavItem = {
  name: string;
  path: string;
  icon: React.ElementType;
  badge?: string;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

// ============================================================================
// COMPONENT
// ============================================================================
export default function DashboardLayout() {
  const { user, signOut } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Responsive States
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = useCallback(() => {
    signOut();
    navigate('/', { replace: true });
  }, [signOut, navigate]);

  const navigationGroups = useMemo<NavGroup[]>(() => [
    {
      title: 'Engineering',
      items: [
        { name: 'Overview', path: '/dashboard', icon: LayoutDashboard },
        { name: 'Projects & BOMs', path: '/dashboard/projects', icon: FolderKanban },
      ]
    },
    {
      title: 'Procurement',
      items: [
        { name: 'Active Quotes', path: '/dashboard/quotes', icon: FileText, badge: '2' },
        { name: 'Order History', path: '/dashboard/orders', icon: ShoppingCart },
      ]
    },
    {
      title: 'Intelligence',
      items: [
        { name: 'Lifecycle Radar', path: '/dashboard/intelligence/lifecycle', icon: ShieldAlert },
        // STRICT FIX: Corrected path from 'arbitrage' to 'cost-analysis' to match App.tsx
        { name: 'Cost Analytics', path: '/dashboard/intelligence/cost-analysis', icon: TrendingDown },
        { name: 'Compliance', path: '/dashboard/intelligence/compliance', icon: FileCheck },
      ]
    }
  ], []);

  // Extracted NavTree so it can be reused for both Mobile (Expanded) and Desktop (Collapsible)
  const NavigationTree = ({ collapsed = false }: { collapsed?: boolean }) => (
    <nav className={`flex-1 overflow-y-auto custom-scrollbar py-5 space-y-6 ${collapsed ? 'px-2' : 'px-3'}`}>
      {navigationGroups.map((group) => (
        <div key={group.title} className="space-y-1.5">
          <h3 className={`${collapsed ? 'sr-only' : 'px-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-2'}`}>
            {group.title}
          </h3>
          <ul className="space-y-1">
            {group.items.map((item) => (
              <li key={item.name}>
                <NavLink
                  to={item.path}
                  end={item.path === '/dashboard'}
                  title={collapsed ? item.name : undefined} // Shows tooltip when collapsed
                  className={({ isActive }) =>
                    `group flex items-center ${collapsed ? 'justify-center p-3' : 'justify-between px-2.5 py-2'} rounded-xl text-xs font-bold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-slate-400/20 ${
                      isActive 
                        ? 'bg-slate-900 text-white shadow-sm' 
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className={`flex items-center ${collapsed ? 'justify-center w-full' : 'gap-2.5'}`}>
                        <item.icon 
                          className={`${collapsed ? 'w-5 h-5' : 'w-4 h-4'} transition-colors duration-200 ${
                            isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-700'
                          }`} 
                        />
                        {!collapsed && <span>{item.name}</span>}
                      </div>
                      {!collapsed && item.badge && (
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${
                          isActive 
                            ? 'bg-white/20 text-white' 
                            : 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="h-screen w-full bg-[#F8FAFC] flex overflow-hidden font-sans text-slate-900 antialiased">
      
      {/* =========================================================================
          DESKTOP COLLAPSIBLE SIDEBAR
      ========================================================================= */}
      <aside 
        className={`hidden lg:flex flex-col bg-white border-r border-slate-200/60 z-20 shrink-0 transition-all duration-300 ease-in-out ${
          isSidebarCollapsed ? 'w-[80px]' : 'w-[240px]'
        }`}
      >
        {/* Header / Logo Area */}
        <div className={`h-14 flex items-center border-b border-slate-100 shrink-0 transition-all duration-300 ${isSidebarCollapsed ? 'justify-center px-0' : 'justify-between px-4'}`}>
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-2.5 animate-in fade-in duration-300">
              <div className="w-6 h-6 bg-gradient-to-br from-slate-800 to-slate-900 rounded-md flex items-center justify-center shadow-sm shrink-0">
                <Command className="w-3 h-3 text-white" />
              </div>
              <span className="text-lg font-extrabold tracking-tight text-slate-900 truncate">SupplyOS</span>
            </div>
          )}
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
            className={`p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors focus:outline-none ${isSidebarCollapsed ? '' : '-mr-1'}`}
            title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isSidebarCollapsed ? <Menu className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>

        {/* Dynamic Navigation */}
        <NavigationTree collapsed={isSidebarCollapsed} />

        {/* User Profile Footer */}
        <div className="p-3 shrink-0 mt-auto border-t border-slate-100 bg-slate-50/50">
          {isSidebarCollapsed ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-sm font-bold shadow-sm" title={user?.email || 'User'}>
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <button 
                onClick={handleLogout} 
                title="Secure Logout"
                className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors focus:outline-none"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="bg-white border border-slate-200/60 rounded-xl p-1.5 flex flex-col gap-1 shadow-sm">
              <div className="flex items-center gap-2.5 px-2 py-1.5">
                <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow-sm shrink-0">
                  {user?.email?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">{user?.email || 'User Account'}</p>
                  <p className="text-[10px] font-medium text-slate-500 truncate">Pro Workspace</p>
                </div>
              </div>
              
              <div className="flex items-center gap-1 mt-1 pt-1 border-t border-slate-100">
                <NavLink 
                  to="/dashboard/settings" 
                  className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11px] font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors focus:outline-none"
                >
                  <Settings className="w-3.5 h-3.5" /> Settings
                </NavLink>
                <button 
                  onClick={handleLogout} 
                  title="Secure Logout"
                  className="flex items-center justify-center p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors focus:outline-none"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* =========================================================================
          MOBILE RESPONSIVE HEADER & DRAWER
      ========================================================================= */}
      <header className="lg:hidden absolute top-0 left-0 right-0 h-14 bg-white/80 backdrop-blur-md border-b border-slate-200/60 flex items-center justify-between px-4 z-40">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-slate-900 rounded-md flex items-center justify-center">
            <Command className="w-3 h-3 text-white" />
          </div>
          <span className="text-base font-extrabold tracking-tight text-slate-900">SupplyOS</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(true)} 
          className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors focus:outline-none"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-50 lg:hidden animate-in fade-in duration-300" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* Mobile Drawer */}
      <div className={`fixed inset-y-0 right-0 w-[85vw] max-w-[280px] bg-white shadow-2xl z-50 lg:hidden transform transition-transform duration-300 cubic-bezier(0.16, 1, 0.3, 1) flex flex-col ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="h-14 flex items-center justify-between px-5 border-b border-slate-100 shrink-0">
          <span className="text-sm font-bold text-slate-900 uppercase tracking-widest">Menu</span>
          <button onClick={() => setIsMobileMenuOpen(false)} className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-colors focus:outline-none">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Mobile always uses the full, uncollapsed nav tree */}
        <NavigationTree collapsed={false} />
        
        <div className="p-4 border-t border-slate-100 bg-slate-50 shrink-0">
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 hover:text-slate-900 rounded-xl transition-all shadow-sm focus:outline-none active:scale-[0.98]">
            <LogOut className="w-4 h-4" /> Secure Logout
          </button>
        </div>
      </div>

      {/* =========================================================================
          MAIN APPLICATION VIEWPORT
      ========================================================================= */}
      <main className="flex-1 flex flex-col min-w-0 h-[calc(100vh-3.5rem)] lg:h-screen pt-14 lg:pt-0 relative z-10 transition-all duration-300">
        <div className="flex-1 overflow-auto custom-scrollbar p-3 lg:p-6 lg:px-8">
          <div className="h-full mx-auto max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
            <Outlet />
          </div>
        </div>
      </main>

    </div>
  );
}