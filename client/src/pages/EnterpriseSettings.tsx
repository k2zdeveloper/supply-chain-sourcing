import { useState, memo } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { 
  ShieldCheck, Key, Users, Activity, Smartphone, Laptop, 
  Plus, Trash2, Copy, Eye, EyeOff, CheckCircle2, AlertTriangle, 
  Terminal, Ban,
  Download
} from 'lucide-react';

// ============================================================================
// STRICT 2026 TYPE CONTRACTS (No Interfaces)
// ============================================================================

type SettingsTab = 'security' | 'api_keys' | 'team_rbac' | 'audit_log';
type Environment = 'production' | 'staging';
type EventStatus = 'success' | 'blocked' | 'warning';
type DeviceType = 'desktop' | 'mobile';

type ApiKey = {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsed: string | null;
  environment: Environment;
};

type AuditEvent = {
  id: string;
  action: string;
  actor: string;
  timestamp: string;
  ipAddress: string;
  status: EventStatus;
};

type ActiveSession = {
  id: string;
  device: DeviceType;
  browser: string;
  location: string;
  ip: string;
  isCurrent: boolean;
  lastActive: string;
};

type TabButtonProps = {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
};

// ============================================================================
// ENTERPRISE MOCK DATA
// ============================================================================

const MOCK_API_KEYS: ApiKey[] = [
  { id: '1', name: 'Zoho ERP Prod Sync', prefix: 'scs_live_8f92', createdAt: '2026-01-15', lastUsed: '2 mins ago', environment: 'production' },
  { id: '2', name: 'GitHub CI/CD Action', prefix: 'scs_test_3a1b', createdAt: '2026-02-28', lastUsed: '14 days ago', environment: 'staging' },
];

const MOCK_AUDIT_LOG: AuditEvent[] = [
  { id: 'ev_1', action: 'API Key Generated', actor: 'admin@corp.com', timestamp: '2026-03-21T10:42:00Z', ipAddress: '192.168.1.42', status: 'success' },
  { id: 'ev_2', action: 'BOM Payload Ingested', actor: 'engineer@corp.com', timestamp: '2026-03-21T09:15:00Z', ipAddress: '10.0.0.15', status: 'success' },
  { id: 'ev_3', action: 'Failed Auth Attempt', actor: 'unknown', timestamp: '2026-03-20T23:59:12Z', ipAddress: '45.22.19.88', status: 'blocked' },
];

const MOCK_SESSIONS: ActiveSession[] = [
  { id: 'sess_1', device: 'desktop', browser: 'Chrome (Mac OS)', location: 'San Jose, CA', ip: '192.168.1.42', isCurrent: true, lastActive: 'Just now' },
  { id: 'sess_2', device: 'mobile', browser: 'Safari (iOS)', location: 'San Francisco, CA', ip: '172.56.21.4', isCurrent: false, lastActive: '2 hours ago' },
];

// ============================================================================
// MEMOIZED SUB-COMPONENTS
// ============================================================================

const TabButton = memo(({ active, onClick, icon, label, disabled }: TabButtonProps) => (
  <button
    role="tab"
    aria-selected={active}
    disabled={disabled}
    onClick={onClick}
    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all text-left w-full focus:outline-none focus:ring-2 focus:ring-emerald-500/50 ${
      disabled 
        ? 'opacity-40 cursor-not-allowed text-zinc-500' 
        : active 
          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
          : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'
    }`}
  >
    {icon}
    {label}
  </button>
));
TabButton.displayName = 'TabButton';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function EnterpriseSettings() {
  const { role } = useAuthStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>('security');
  
  // Ephemeral state for revealing secrets (Never stored in localStorage)
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());

  const toggleKeyVisibility = (id: string) => {
    setRevealedKeys(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500 pb-12">
      
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
          Enterprise Settings
        </h1>
        <p className="text-zinc-400 text-sm mt-1">
          Manage corporate security, API integrations, and access control.
        </p>
      </header>

      {/* Modern Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-8 items-start flex-1">
        
        {/* Navigation Sidebar */}
        <nav className="flex flex-col gap-1 sticky top-0" role="tablist">
          <TabButton 
            active={activeTab === 'security'} 
            onClick={() => setActiveTab('security')} 
            icon={<ShieldCheck className="w-4 h-4 shrink-0" />} 
            label="Security & Sessions" 
          />
          <TabButton 
            active={activeTab === 'api_keys'} 
            onClick={() => setActiveTab('api_keys')} 
            icon={<Key className="w-4 h-4 shrink-0" />} 
            label="API & Webhooks" 
          />
          <TabButton 
            active={activeTab === 'team_rbac'} 
            onClick={() => setActiveTab('team_rbac')} 
            icon={<Users className="w-4 h-4 shrink-0" />} 
            label="Team & RBAC" 
            disabled={role !== 'admin'} // Strict Client-Side Route Fencing
          />
          <TabButton 
            active={activeTab === 'audit_log'} 
            onClick={() => setActiveTab('audit_log')} 
            icon={<Activity className="w-4 h-4 shrink-0" />} 
            label="Audit Logs" 
            disabled={role !== 'admin' && role !== 'manager'}
          />
        </nav>

        {/* Content Area */}
        <main className="min-w-0 bg-zinc-900/40 border border-white/5 rounded-2xl p-6 md:p-8 backdrop-blur-sm min-h-[600px]">
          
          {/* --- VIEW: SECURITY & SESSIONS --- */}
          {activeTab === 'security' && (
            <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
              <div>
                <h2 className="text-xl font-bold text-white mb-4">Active Sessions</h2>
                <p className="text-sm text-zinc-400 mb-6">Review devices currently logged into this corporate account. Revoke any unrecognized access immediately.</p>
                
                <div className="space-y-3">
                  {MOCK_SESSIONS.map(session => (
                    <div key={session.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-zinc-950/50 border border-white/5 rounded-xl">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center shrink-0">
                          {session.device === 'desktop' ? <Laptop className="w-5 h-5 text-emerald-400" /> : <Smartphone className="w-5 h-5 text-blue-400" />}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white flex items-center gap-2">
                            {session.browser} 
                            {session.isCurrent && <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full uppercase tracking-wider">This Device</span>}
                          </p>
                          <p className="text-xs text-zinc-500 mt-0.5">{session.location} • {session.ip} • Last active: {session.lastActive}</p>
                        </div>
                      </div>
                      {!session.isCurrent && (
                        <button className="text-xs font-medium text-red-400 hover:text-red-300 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-red-500/50">
                          Revoke Session
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-8 border-t border-white/5">
                <h2 className="text-xl font-bold text-white mb-4 text-red-400">Danger Zone</h2>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-red-500/5 border border-red-500/20 rounded-xl">
                  <div>
                    <h3 className="text-sm font-bold text-white">Terminate All Other Sessions</h3>
                    <p className="text-xs text-zinc-500 mt-1">Instantly invalidates all JWT tokens except the one currently in use.</p>
                  </div>
                  <button className="text-sm font-bold text-white bg-red-600 hover:bg-red-500 px-4 py-2 rounded-lg transition-colors shadow-lg shadow-red-500/20 focus:outline-none focus:ring-2 focus:ring-red-500/50">
                    Execute Kill Switch
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* --- VIEW: API KEYS --- */}
          {activeTab === 'api_keys' && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-bold text-white">API Credentials</h2>
                  <p className="text-sm text-zinc-400 mt-1">Generate programmatic access tokens for ERP integrations.</p>
                </div>
                <button className="bg-white text-zinc-950 px-4 py-2 rounded-lg text-sm font-bold hover:bg-zinc-200 transition-colors flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-zinc-500/50">
                  <Plus className="w-4 h-4" /> Generate New Token
                </button>
              </div>

              <div className="space-y-4">
                {MOCK_API_KEYS.map(key => (
                  <div key={key.id} className="p-5 bg-zinc-950/50 border border-white/5 rounded-xl group hover:border-white/10 transition-all">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-bold text-white">{key.name}</h3>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold ${
                            key.environment === 'production' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}>
                            {key.environment}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500">Created {key.createdAt} • Last used {key.lastUsed}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="p-2 text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-md transition-colors focus:outline-none">
                          <Copy className="w-4 h-4" />
                        </button>
                        <button className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-md transition-colors focus:outline-none">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-zinc-900 border border-white/5 rounded-lg p-3 font-mono text-sm text-zinc-300 tracking-wider flex items-center justify-between">
                        <span>{key.prefix}{revealedKeys.has(key.id) ? 'a7b9c1d3e4f5g6h7i8j9k0l' : '•••••••••••••••••••••••'}</span>
                        <button 
                          onClick={() => toggleKeyVisibility(key.id)} 
                          className="text-zinc-500 hover:text-white transition-colors focus:outline-none"
                        >
                          {revealedKeys.has(key.id) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* --- VIEW: TEAM RBAC --- */}
          {activeTab === 'team_rbac' && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-bold text-white">Team Access Control</h2>
                  <p className="text-sm text-zinc-400 mt-1">Manage enterprise users and Role-Based Access Control (RBAC).</p>
                </div>
                <button className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-500 transition-colors flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/50">
                  <Users className="w-4 h-4" /> Invite Member
                </button>
              </div>
              <div className="p-12 border-2 border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center text-center">
                <Users className="w-10 h-10 text-zinc-600 mb-3" />
                <h3 className="text-zinc-300 font-medium">User Management Module</h3>
                <p className="text-zinc-500 text-sm mt-1">Directory sync and SSO configuration loading...</p>
              </div>
            </div>
          )}

          {/* --- VIEW: AUDIT LOGS --- */}
          {activeTab === 'audit_log' && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-bold text-white">System Audit Trail</h2>
                  <p className="text-sm text-zinc-400 mt-1">Immutable cryptographic log of all tenant actions.</p>
                </div>
                <button className="text-sm font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors">
                  <Download className="w-4 h-4" /> Export CSV
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-white/5 bg-zinc-950/50 custom-scrollbar">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-zinc-900/80 text-zinc-400 text-xs uppercase tracking-wider border-b border-white/5">
                    <tr>
                      <th className="px-5 py-3 font-medium">Timestamp (UTC)</th>
                      <th className="px-5 py-3 font-medium">Event Action</th>
                      <th className="px-5 py-3 font-medium">Actor</th>
                      <th className="px-5 py-3 font-medium">IP Address</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-zinc-300 font-mono text-xs">
                    {MOCK_AUDIT_LOG.map(log => (
                      <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-4 text-zinc-500">{new Date(log.timestamp).toLocaleString()}</td>
                        <td className="px-5 py-4 text-white flex items-center gap-2">
                          <Terminal className="w-3 h-3 text-zinc-600 shrink-0" /> {log.action}
                        </td>
                        <td className="px-5 py-4">{log.actor}</td>
                        <td className="px-5 py-4 text-zinc-500">{log.ipAddress}</td>
                        <td className="px-5 py-4">
                          {log.status === 'success' && <span className="text-emerald-400 flex items-center gap-1 w-fit px-2 py-0.5 bg-emerald-500/10 rounded-full"><CheckCircle2 className="w-3 h-3" /> OK</span>}
                          {log.status === 'blocked' && <span className="text-red-400 flex items-center gap-1 w-fit px-2 py-0.5 bg-red-500/10 rounded-full"><Ban className="w-3 h-3" /> BLOCKED</span>}
                          {log.status === 'warning' && <span className="text-amber-400 flex items-center gap-1 w-fit px-2 py-0.5 bg-amber-500/10 rounded-full"><AlertTriangle className="w-3 h-3" /> WARN</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}