import React from 'react';
import { Header } from './components/ui/Header';
import { TelemetryBar } from './components/ui/TelemetryBar';
import { ControlPanel } from './components/ui/ControlPanel';
import { SimulationCanvas } from './components/canvas/SimulationCanvas';
import { PhysicsExplainer } from './components/ui/PhysicsExplainer';
import { useSimulationStore } from './state/useSimulationStore';
import { SCENARIO_PRESETS } from './engine/Geometry';

export const App: React.FC = () => {
  const scenario = useSimulationStore((s) => s.scenario);
  const preset = SCENARIO_PRESETS[scenario] || SCENARIO_PRESETS.stadium;

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* 1. Top Navigation Bar */}
      <Header />

      {/* 2. Main Content Grid */}
      <main className="flex-1 min-h-0 flex flex-col p-4 gap-3 overflow-y-auto">
        {/* Telemetry Strip */}
        <TelemetryBar />

        {/* Central Workspace: Canvas + Controls */}
        <div className="flex-1 min-h-[460px] grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Main Simulation Viewport (3 Columns) */}
          <div className="lg:col-span-3 flex flex-col gap-2">
            <div className="flex items-center justify-between px-2">
              <div>
                <h2 className="text-sm font-bold text-slate-200 tracking-wide">
                  {preset.name}
                </h2>
                <p className="text-xs text-slate-400">
                  {preset.tagline}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/70 border border-cyan-800/80 px-2.5 py-0.5 rounded-full">
                  1m = {preset.pixelsPerMeter}px
                </span>
              </div>
            </div>

            {/* Simulation Canvas Container */}
            <div className="flex-1 min-h-[420px] relative">
              <SimulationCanvas />
            </div>
          </div>

          {/* Operational Control Panel (1 Column) */}
          <div className="lg:col-span-1">
            <ControlPanel />
          </div>
        </div>

        {/* Technical & Physics Documentation Drawer */}
        <PhysicsExplainer />
      </main>
    </div>
  );
};

export default App;
