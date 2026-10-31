import React from 'react';
import { useSimulationStore } from '../../state/useSimulationStore';
import { ShieldAlert, FileText, WifiOff, Users, Activity, Cpu, Building2, FlaskConical, Scale } from 'lucide-react';

export const Header: React.FC = () => {
  const telemetry = useSimulationStore((s) => s.telemetry);
  const toggleModal = useSimulationStore((s) => s.toggleModal);
  const toggleBenchmark = useSimulationStore((s) => s.toggleBenchmark);
  const toggleScenarioLab = useSimulationStore((s) => s.toggleScenarioLab);
  const toggleSafetyIntelligence = useSimulationStore((s) => s.toggleSafetyIntelligence);
  const appMode = useSimulationStore((s) => s.appMode);
  const setAppMode = useSimulationStore((s) => s.setAppMode);
  const physicsDeckTab = useSimulationStore((s) => s.physicsDeckTab);
  const setPhysicsDeckTab = useSimulationStore((s) => s.setPhysicsDeckTab);

  return (
    <header className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md">
      {/* Brand & Theme Identity */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center font-black text-slate-950 text-base shadow-lg shadow-cyan-900/40">
          CW
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-extrabold tracking-wider text-slate-100">
              CROWDWISE <span className="text-cyan-400 font-mono text-xs">v1.0</span>
            </h1>
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/80">
              Theme 03: Digital Twin & Synthetic Data
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Predictive Crowd Safety Lab & Microscopic Vector Dynamics
          </p>
        </div>
      </div>

      {/* Live Telemetry Pills, Airplane Mode & Action Buttons */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Airplane Mode Badge */}
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-950/60 border border-emerald-700/60 text-emerald-400 text-xs font-mono font-medium">
          <WifiOff className="w-3.5 h-3.5" />
          <span>AIRPLANE MODE READY</span>
        </div>

        {/* Live FPS */}
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-950 border border-slate-800 text-slate-300 text-xs font-mono">
          <Activity className="w-3.5 h-3.5 text-purple-400" />
          <span>{telemetry.fps} FPS</span>
        </div>

        {/* Live Agent Count */}
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-950 border border-slate-800 text-slate-300 text-xs font-mono">
          <Users className="w-3.5 h-3.5 text-indigo-400" />
          <span>{telemetry.liveAgents} AGENTS</span>
        </div>

        {/* Critical Alert Warning if Active */}
        {telemetry.isCritical && (
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-950/80 border border-rose-500 text-rose-300 text-xs font-mono font-bold animate-pulse">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>CRITICAL CRUSH RISK</span>
          </div>
        )}

        {/* Stadium Blueprint Mode Toggle */}
        <button
          onClick={() => setAppMode(appMode === 'BLUEPRINT' ? 'SIMULATION' : 'BLUEPRINT')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cyan-500/80 bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 font-bold text-xs shadow-md transition"
          title="Switch to Authentic 2D Vector CAD Blueprint"
        >
          {appMode === 'BLUEPRINT' ? (
            <>
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span>Simulation Lab</span>
            </>
          ) : (
            <>
              <Building2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Stadium Blueprint</span>
            </>
          )}
        </button>

        {/* Scenario Lab Modal Trigger */}
        <button
          onClick={toggleScenarioLab}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-purple-500/80 bg-purple-950/80 hover:bg-purple-900 text-purple-300 font-bold text-xs shadow-md shadow-purple-950/50 transition"
          title="Open Predictive Crowd Safety & Scenario Experimentation Lab"
        >
          <FlaskConical className="w-3.5 h-3.5 text-purple-400" />
          <span>Scenario Lab</span>
        </button>

        {/* Safety Intelligence Dashboard Trigger */}
        <button
          onClick={toggleSafetyIntelligence}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-500/80 bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 font-bold text-xs shadow-md shadow-indigo-950/50 transition"
          title="Open Safety Intelligence, Predictive Analytics & Operational Decision Support"
        >
          <Activity className="w-3.5 h-3.5 text-indigo-400" />
          <span>Safety Intelligence</span>
        </button>

        {/* Physics Validation Deck Toggle */}
        <button
          onClick={() => {
            if (appMode === 'BLUEPRINT') setAppMode('SIMULATION');
            setPhysicsDeckTab(physicsDeckTab === 'PHYSICS_VALIDATION' ? 'TELEMETRY' : 'PHYSICS_VALIDATION');
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-bold text-xs shadow-md transition ${
            physicsDeckTab === 'PHYSICS_VALIDATION'
              ? 'border-emerald-500 bg-emerald-950 text-emerald-300'
              : 'border-emerald-700/80 bg-emerald-950/70 hover:bg-emerald-900/80 text-emerald-300'
          }`}
          title="Toggle Empirical Physics Credibility & Spatial Risk Displacement Deck"
        >
          <Scale className="w-3.5 h-3.5" />
          <span>Physics Audit</span>
        </button>

        {/* Physics Benchmark Modal Trigger */}
        <button
          onClick={toggleBenchmark}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cyan-700/80 bg-cyan-950/70 hover:bg-cyan-900/80 text-cyan-300 font-bold text-xs shadow-md transition"
          title="Run 1k, 5k, 10k Pure Social Force Engine Benchmark"
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>Benchmark</span>
        </button>

        {/* Export Safety Brief Modal Trigger */}
        <button
          onClick={toggleModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs shadow-md shadow-cyan-950/50 transition"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Export Brief</span>
        </button>
      </div>
    </header>
  );
};
