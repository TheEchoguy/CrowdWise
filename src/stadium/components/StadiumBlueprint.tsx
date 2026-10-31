import React, { useState } from 'react';
import { StadiumGeometry } from './StadiumGeometry';
import { StadiumLayerControls } from './StadiumLayerControls';
import { GateInformationPanel } from './GateInformationPanel';
import {
  StadiumSection,
  LayerVisibilityState,
  OuterGate,
  InnerGate,
  StadiumStand
} from '../types/stadium';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCcw,
  LayoutGrid
} from 'lucide-react';

interface StadiumBlueprintProps {
  onSwitchToSimulation?: () => void;
}

export const StadiumBlueprint: React.FC<StadiumBlueprintProps> = ({
  onSwitchToSimulation
}) => {
  // Navigation & Filter states
  const [currentSection, setCurrentSection] = useState<StadiumSection>('ALL');
  const [gateFilter, setGateFilter] = useState<'ALL' | 'PERMITTED' | 'RESTRICTED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected entities
  const [selectedOuterGate, setSelectedOuterGate] = useState<OuterGate | null>(null);
  const [selectedInnerGate, setSelectedInnerGate] = useState<InnerGate | null>(null);
  const [selectedStand, setSelectedStand] = useState<StadiumStand | null>(null);

  // Zoom Action
  const [zoomAction, setZoomAction] = useState<'IN' | 'OUT' | 'RESET' | 'FIT' | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Layer Visibility
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibilityState>({
    outerGates: true,
    innerGates: true,
    pedestrianRoutes: true,
    roads: true,
    stands: true,
    medicalFacilities: true,
    ambulanceLocations: true,
    parkingAndLandmarks: true,
    holdingAreas: true,
    securityWatchtowers: true
  });

  const toggleLayer = (key: keyof LayerVisibilityState) => {
    setLayerVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#080c14] text-slate-100 overflow-hidden font-sans select-none">
      {/* ─── 1. TOP BAR ─────────────────────────────────────────────────── */}
      <header className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-2.5 bg-slate-900/95 border-b border-slate-800 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center font-black text-slate-950 text-base shadow-lg shadow-cyan-900/40">
            KSCA
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-extrabold tracking-wider text-slate-100">
                CROWDWISE <span className="text-cyan-400 font-mono text-xs">Stadium Blueprint</span>
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                Phase 1: Authentic Digital Twin
              </span>
            </div>
            <p className="text-xs text-slate-400">
              M. Chinnaswamy Stadium, Bengaluru • Official KSCA 2D Vector Geometry
            </p>
          </div>
        </div>

        {/* View Controls & Mode Switcher */}
        <div className="flex items-center gap-2">
          {/* Zoom Buttons */}
          <div className="flex items-center rounded-lg bg-slate-950 border border-slate-800 p-0.5">
            <button
              onClick={() => setZoomAction('IN')}
              className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded transition"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoomAction('OUT')}
              className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded transition"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoomAction('RESET')}
              className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded transition"
              title="Reset View"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded transition"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {/* Mode Switcher Button to Return to Simulation */}
          {onSwitchToSimulation && (
            <button
              onClick={onSwitchToSimulation}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Simulation Lab</span>
            </button>
          )}
        </div>
      </header>

      {/* ─── 2. 3-PANEL BLUEPRINT WORKSPACE ─────────────────────────────── */}
      <main className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3 p-3 overflow-hidden">
        {/* Left Sidebar (3 Columns) */}
        <aside className="lg:col-span-3 h-full min-h-0 overflow-hidden flex flex-col">
          <StadiumLayerControls
            currentSection={currentSection}
            onSelectSection={setCurrentSection}
            gateFilter={gateFilter}
            onChangeGateFilter={setGateFilter}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            layerVisibility={layerVisibility}
            onToggleLayer={toggleLayer}
          />
        </aside>

        {/* Central Viewport (6 Columns) */}
        <section className="lg:col-span-6 h-full min-h-0 flex flex-col gap-2 overflow-hidden">
          {/* Section Info Bar */}
          <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold text-slate-200">
                {currentSection === 'ALL' && 'Full Stadium 360° Architectural Blueprint'}
                {currentSection === 'NORTH_CUBBON' && 'Cubbon Road (North Perimeter) • Minsk Square to BRV'}
                {currentSection === 'EAST_LINK' && 'Link Road & St. Marks Road (East Perimeter)'}
                {currentSection === 'SOUTH_MG' && 'MG Road Plaza & KSCA Car Park (South Perimeter)'}
                {currentSection === 'WEST_QUEENS' && "Queens Road (West Perimeter) • Restricted Access"}
              </span>
            </div>
            <div className="text-[10px] font-mono text-cyan-400 bg-cyan-950/70 border border-cyan-800/80 px-2 py-0.5 rounded-full">
              VECTOR SVG 1:1 SCALE
            </div>
          </div>

          {/* SVG Map Canvas */}
          <div className="flex-1 min-h-0 relative">
            <StadiumGeometry
              section={currentSection}
              layerVisibility={layerVisibility}
              gateFilter={gateFilter}
              searchQuery={searchQuery}
              selectedOuterGate={selectedOuterGate}
              selectedInnerGate={selectedInnerGate}
              onSelectOuterGate={(g) => {
                setSelectedOuterGate(g);
                setSelectedStand(null);
              }}
              onSelectInnerGate={(g) => {
                setSelectedInnerGate(g);
                setSelectedStand(null);
              }}
              onSelectStand={setSelectedStand}
              zoomAction={zoomAction}
              onResetZoomAction={() => setZoomAction(null)}
            />
          </div>
        </section>

        {/* Right Inspector Panel (3 Columns) */}
        <aside className="lg:col-span-3 h-full min-h-0 overflow-hidden flex flex-col">
          <GateInformationPanel
            selectedOuterGate={selectedOuterGate}
            selectedInnerGate={selectedInnerGate}
            selectedStand={selectedStand}
            onSelectOuterGate={(g) => {
              setSelectedOuterGate(g);
              setSelectedStand(null);
            }}
            onSelectInnerGate={(g) => {
              setSelectedInnerGate(g);
              setSelectedStand(null);
            }}
          />
        </aside>
      </main>
    </div>
  );
};

export default StadiumBlueprint;
