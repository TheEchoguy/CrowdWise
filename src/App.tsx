import React from 'react';
import { Header } from './components/layout/Header';
import { LeftControls } from './components/layout/LeftControls';
import { RightTelemetry } from './components/layout/RightTelemetry';
import { SimulationCanvas } from './components/canvas/SimulationCanvas';
import { DecisionModal } from './components/layout/DecisionModal';
import { useSimulationStore } from './state/useSimulationStore';

export const App: React.FC = () => {
  const scenario = useSimulationStore((s) => s.scenario);

  const scenarioTitles: Record<string, { title: string; subtitle: string }> = {
    stadium: {
      title: 'M. Chinnaswamy Stadium Ingress Digital Twin',
      subtitle: 'Gate A Choke Point, 40m Upstream Zigzag Baffles & Auxiliary Bypass Lab'
    },
    bridge: {
      title: 'Transit Footbridge Counter-Flow Simulator',
      subtitle: 'High-Density Bidirectional Skywalk & Central Anti-Deadlock Lane Divider'
    },
    reversal: {
      title: 'Sudden Shock Reversal & Egress Safety Lab',
      subtitle: 'Emergency Reverse Flow & Compressive Shockwave Wavefront Study'
    }
  };

  const currentInfo = scenarioTitles[scenario] || scenarioTitles.stadium;

  return (
    <div className="flex flex-col h-screen w-screen bg-[#080c14] text-slate-100 overflow-hidden font-sans select-none">
      {/* 1. Header with System Badges and Export Brief Trigger */}
      <Header />

      {/* 2. 3-Column Tactical Workspace Layout */}
      <main className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3.5 p-3.5 overflow-hidden">
        {/* Left Column: Simulation Control Station (3 Cols) */}
        <section className="lg:col-span-3 h-full min-h-0 overflow-hidden flex flex-col">
          <LeftControls />
        </section>

        {/* Center Column: Interactive Simulation Canvas (6 Cols) */}
        <section className="lg:col-span-6 h-full min-h-0 flex flex-col gap-2 overflow-hidden">
          {/* Scenario Info Bar */}
          <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 shrink-0">
            <div>
              <h2 className="text-xs font-bold text-slate-200 tracking-wide">
                {currentInfo.title}
              </h2>
              <p className="text-[10px] text-slate-400">
                {currentInfo.subtitle}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/70 border border-cyan-800/80 px-2 py-0.5 rounded-full">
                SCALE: 20px = 1m
              </span>
            </div>
          </div>

          {/* Canvas Wrapper */}
          <div className="flex-1 min-h-0 relative">
            <SimulationCanvas />
          </div>
        </section>

        {/* Right Column: Real-Time Telemetry & Safety Brief (3 Cols) */}
        <section className="lg:col-span-3 h-full min-h-0 overflow-hidden flex flex-col">
          <RightTelemetry />
        </section>
      </main>

      {/* 3. Event Safety Decision Modal */}
      <DecisionModal />
    </div>
  );
};

export default App;

