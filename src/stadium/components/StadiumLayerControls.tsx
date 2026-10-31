import React from 'react';
import { StadiumSection, LayerVisibilityState } from '../types/stadium';
import {
  Compass,
  Layers,
  Search,
  ShieldCheck,
  ShieldAlert,
  Eye,
  EyeOff,
  Navigation,
  Crosshair,
  Truck,
  HeartPulse,
  Building2,
  Route,
  Car
} from 'lucide-react';

interface StadiumLayerControlsProps {
  currentSection: StadiumSection;
  onSelectSection: (section: StadiumSection) => void;
  gateFilter: 'ALL' | 'PERMITTED' | 'RESTRICTED';
  onChangeGateFilter: (filter: 'ALL' | 'PERMITTED' | 'RESTRICTED') => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  layerVisibility: LayerVisibilityState;
  onToggleLayer: (layer: keyof LayerVisibilityState) => void;
}

export const StadiumLayerControls: React.FC<StadiumLayerControlsProps> = ({
  currentSection,
  onSelectSection,
  gateFilter,
  onChangeGateFilter,
  searchQuery,
  onSearchChange,
  layerVisibility,
  onToggleLayer
}) => {
  const sections: { id: StadiumSection; label: string; sub: string; badge?: string }[] = [
    { id: 'ALL', label: 'All Stadium Overview', sub: '360° Macro Blueprint' },
    { id: 'NORTH_CUBBON', label: 'Cubbon Road', sub: 'North Sector • Gates E18-E23, E1-E4' },
    { id: 'EAST_LINK', label: 'Link Road & St. Marks', sub: 'East Sector • Gates E12-E17' },
    { id: 'SOUTH_MG', label: 'MG Road Plaza', sub: 'South Sector • Gate E11 & Car Park' },
    {
      id: 'WEST_QUEENS',
      label: "Queens Road (Restricted)",
      sub: 'West Sector • VIP / Media Only',
      badge: 'RESTRICTED'
    }
  ];

  const layerItems: { key: keyof LayerVisibilityState; label: string; icon: React.ReactNode }[] = [
    { key: 'outerGates', label: 'Outer Gates (E-Series)', icon: <Navigation className="w-3.5 h-3.5 text-rose-400" /> },
    { key: 'innerGates', label: 'Inner Gates (G-Series)', icon: <Crosshair className="w-3.5 h-3.5 text-cyan-400" /> },
    { key: 'pedestrianRoutes', label: 'Pedestrian Pathways', icon: <Route className="w-3.5 h-3.5 text-amber-400" /> },
    { key: 'roads', label: 'Arterial Road Network', icon: <Compass className="w-3.5 h-3.5 text-slate-300" /> },
    { key: 'stands', label: 'Stand Architecture & Bowl', icon: <Building2 className="w-3.5 h-3.5 text-emerald-400" /> },
    { key: 'holdingAreas', label: 'Ingress Holding Corrals', icon: <Layers className="w-3.5 h-3.5 text-green-400" /> },
    { key: 'ambulanceLocations', label: 'Ambulance Units', icon: <Truck className="w-3.5 h-3.5 text-red-400" /> },
    { key: 'medicalFacilities', label: 'First-Aid Medical Posts', icon: <HeartPulse className="w-3.5 h-3.5 text-emerald-400" /> },
    { key: 'parkingAndLandmarks', label: 'Parks & Parking Enclosures', icon: <Car className="w-3.5 h-3.5 text-indigo-400" /> },
    { key: 'securityWatchtowers', label: 'Perimeter Watchtowers', icon: <ShieldAlert className="w-3.5 h-3.5 text-blue-400" /> }
  ];

  return (
    <div className="flex flex-col h-full gap-3 overflow-y-auto pr-1 select-none text-slate-200">
      {/* ─── 1. SECTIONAL GEOGRAPHIC NAVIGATION ─────────────────────────── */}
      <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 shadow-md">
        <div className="flex items-center gap-2 mb-2.5">
          <Compass className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
            Section Navigation
          </h3>
        </div>

        <div className="flex flex-col gap-1.5">
          {sections.map((sec) => {
            const isActive = currentSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => onSelectSection(sec.id)}
                className={`flex items-start justify-between p-2 rounded-lg text-left transition border ${
                  isActive
                    ? 'bg-cyan-950/80 border-cyan-500/80 text-cyan-200 shadow-sm shadow-cyan-950'
                    : 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <div>
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <span>{sec.label}</span>
                    {sec.badge && (
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-rose-950 text-rose-400 border border-rose-800">
                        {sec.badge}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400">{sec.sub}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── 2. GATE SEARCH & CATEGORY FILTERS ─────────────────────────── */}
      <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 shadow-md">
        <div className="flex items-center gap-2 mb-2">
          <Search className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
            Gate Search & Filters
          </h3>
        </div>

        {/* Search Input */}
        <div className="relative mb-2.5">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search Gate (e.g. E11, G8, C Stand)..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
        </div>

        {/* Category Pills */}
        <div className="grid grid-cols-3 gap-1">
          <button
            onClick={() => onChangeGateFilter('ALL')}
            className={`py-1 text-[10px] font-bold rounded text-center border transition ${
              gateFilter === 'ALL'
                ? 'bg-cyan-950 border-cyan-500 text-cyan-300'
                : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            All Gates
          </button>
          <button
            onClick={() => onChangeGateFilter('PERMITTED')}
            className={`py-1 text-[10px] font-bold rounded text-center border transition ${
              gateFilter === 'PERMITTED'
                ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Spectator
          </button>
          <button
            onClick={() => onChangeGateFilter('RESTRICTED')}
            className={`py-1 text-[10px] font-bold rounded text-center border transition ${
              gateFilter === 'RESTRICTED'
                ? 'bg-rose-950 border-rose-500 text-rose-300'
                : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Restricted
          </button>
        </div>
      </div>

      {/* ─── 3. INDEPENDENT LAYER VISIBILITY TOGGLES ────────────────────── */}
      <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 shadow-md">
        <div className="flex items-center gap-2 mb-2.5">
          <Layers className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
            Blueprint Layers
          </h3>
        </div>

        <div className="flex flex-col gap-1">
          {layerItems.map((item) => {
            const isVisible = layerVisibility[item.key];
            return (
              <button
                key={item.key}
                onClick={() => onToggleLayer(item.key)}
                className="flex items-center justify-between p-1.5 rounded-lg bg-slate-950/50 hover:bg-slate-800/50 transition border border-slate-800/60"
              >
                <div className="flex items-center gap-2 text-xs">
                  {item.icon}
                  <span className={isVisible ? 'text-slate-200 font-medium' : 'text-slate-500'}>
                    {item.label}
                  </span>
                </div>
                {isVisible ? (
                  <Eye className="w-3.5 h-3.5 text-cyan-400" />
                ) : (
                  <EyeOff className="w-3.5 h-3.5 text-slate-600" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── 4. BLUEPRINT VERIFICATION STATUS CARD ──────────────────────── */}
      <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 text-[11px] leading-relaxed">
        <div className="flex items-center gap-1.5 text-emerald-400 font-bold mb-1">
          <ShieldCheck className="w-4 h-4" />
          <span>Verified KSCA Digital Twin</span>
        </div>
        <p className="text-slate-400 text-[10px]">
          23 Outer Gates (E1–E23) & 15 Inner Banks (G1–G15) faithfully mapped to official Bengaluru KSCA police ingress regulations.
        </p>
      </div>
    </div>
  );
};

