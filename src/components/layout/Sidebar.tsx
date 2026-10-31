import React from 'react';
import {
  LayoutDashboard,
  MapPin,
  TrendingUp,
  FlaskConical,
  DoorOpen,
  AlertTriangle,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Building2,
  Users,
  Box,
  DoorClosed,
  Scale,
  Split,
  Activity,
} from 'lucide-react';
import { useSimulationStore, NavigationTab } from '../../store/simulationStore';

interface NavItem {
  id: NavigationTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
}

export const Sidebar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    currentVenue,
    setVenueProfile,
    events,
    recommendations,
  } = useSimulationStore();

  const [collapsed, setCollapsed] = React.useState(false);

  const activeWarningsCount = events.filter((e) => e.type === 'CRITICAL' || e.type === 'WARNING').length;
  const pendingRecsCount = recommendations.filter((r) => !r.approved).length;

  const navItems: NavItem[] = [
    { id: 'command-centre', label: 'Command Centre', icon: LayoutDashboard },
    { id: 'digital-twin', label: 'Digital Twin', icon: MapPin },
    { id: 'gate-detail', label: '3D Gate Simulation', icon: Box },
    { id: 'crowd-inflow', label: 'Crowd Inflow', icon: TrendingUp },
    { id: 'scenario-lab', label: 'Scenario Lab', icon: FlaskConical },
    {
      id: 'gate-operations',
      label: 'Gate Operations',
      icon: DoorOpen,
      badge: pendingRecsCount > 0 ? pendingRecsCount : undefined,
    },
    {
      id: 'incident-response',
      label: 'Incident Response',
      icon: AlertTriangle,
      badge: activeWarningsCount > 0 ? activeWarningsCount : undefined,
    },
    {
      id: 'gate-closure',
      label: 'Gate Closure & Recovery',
      icon: DoorClosed,
    },
    {
      id: 'model-validation',
      label: 'Crowd Model Validation',
      icon: Scale,
    },
    {
      id: 'multi-directional',
      label: 'Multi-Directional Flow',
      icon: Split,
    },
    {
      id: 'spatial-risk',
      label: 'Spatial Risk & Counterfactual',
      icon: Activity,
    },
    { id: 'reports-history', label: 'Reports & History', icon: FileText },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside
      className={`bg-navy-850 border-r border-navy-600 transition-all duration-300 flex flex-col justify-between shrink-0 select-none z-10 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      <div>
        {/* Venue Profile Switcher Header */}
        <div className="p-3 border-b border-navy-700">
          {!collapsed ? (
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 flex items-center justify-between">
                <span>Active Venue Profile</span>
                <span className="text-cyan-400 text-[10px]">21 Gates</span>
              </label>
              <select
                value={currentVenue.id}
                onChange={(e) => setVenueProfile(e.target.value)}
                className="w-full text-xs font-semibold bg-navy-950 border border-navy-600 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="chinnaswamy-stadium">Chinnaswamy Stadium (Cricket)</option>
                <option value="open-festival">Parkland Open Festival</option>
                <option value="street-gathering">Civic Boulevard Procession</option>
              </select>
            </div>
          ) : (
            <div className="flex justify-center" title={currentVenue.name}>
              <Building2 className="w-5 h-5 text-cyan-400" />
            </div>
          )}
        </div>

        {/* Navigation Items List */}
        <nav className="p-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group relative ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-950/90 to-navy-800 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-950'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-navy-800/80 border border-transparent'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 transition ${
                    isActive ? 'text-cyan-400' : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                />

                {!collapsed && (
                  <span className="truncate flex-1 text-left">{item.label}</span>
                )}

                {item.badge !== undefined && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full shrink-0 ${
                      item.id === 'incident-response'
                        ? 'bg-red-500 text-white'
                        : 'bg-amber-500 text-navy-950'
                    } ${collapsed ? 'absolute top-1 right-1' : ''}`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Collapser & Safety Guardrail Banner */}
      <div className="p-3 border-t border-navy-700 bg-navy-900/60">
        {!collapsed && (
          <div className="mb-2 p-2 rounded-lg bg-navy-950/70 border border-navy-700/80 text-[10px] text-slate-400 flex items-start gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
            <span className="leading-tight">
              Pre-Event Simulation Twin. Planning decisions must undergo certified authority review.
            </span>
          </div>
        )}

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-navy-800 text-xs transition border border-navy-700"
          title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span>Collapse Sidebar</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
};
