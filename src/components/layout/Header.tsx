import React, { useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  FastForward,
  StepForward,
  HelpCircle,
  Bell,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ShieldCheck,
  Layers,
  Sparkles,
} from 'lucide-react';
import { useSimulationStore } from '../../store/simulationStore';
import { GuidedTourModal } from '../modals/GuidedTourModal';

export const Header: React.FC = () => {
  const {
    currentVenue,
    activeScenarioId,
    isRunning,
    isPaused,
    simTimeSecs,
    speedMultiplier,
    simulationMode,
    setSimulationMode,
    startSimulation,
    pauseSimulation,
    resumeSimulation,
    resetSimulation,
    stepForward,
    setSpeedMultiplier,
    randomSeed,
    setRandomSeed,
    events,
  } = useSimulationStore();

  const [showTour, setShowTour] = useState(false);
  const [showEventsDropdown, setShowEventsDropdown] = useState(false);

  // Format Sim Time starting at 17:00:00
  const totalSecs = Math.floor(simTimeSecs);
  const hours = Math.floor(totalSecs / 3600) + 17;
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  const timeFormatted = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  const recentCriticalCount = events.filter((e) => e.type === 'CRITICAL' || e.type === 'WARNING').length;

  return (
    <>
      <header className="h-16 bg-navy-800 border-b border-navy-600 px-4 flex items-center justify-between select-none z-20 sticky top-0">
        {/* Brand & Product Identity */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 via-cyan-500 to-violet-600 p-[1.5px] shadow-lg shadow-cyan-900/30 flex items-center justify-center">
            <div className="w-full h-full bg-navy-900 rounded-[10px] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-cyan-400 animate-pulse-subtle" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-wider text-slate-100 flex items-center gap-1 font-mono">
                CROWD<span className="text-cyan-400">WISE</span>
              </span>
              <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-300">
                Digital Twin
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Predictive Crowd Twin &amp; Counterfactual Safety Lab
            </p>
          </div>
        </div>

        {/* Center Venue & Scenario Context */}
        <div className="hidden lg:flex items-center gap-4 bg-navy-900/80 border border-navy-600 rounded-lg px-3 py-1.5 text-xs">
          <div className="flex items-center gap-1.5 border-r border-navy-700 pr-3">
            <span className="text-slate-400 font-medium">Venue:</span>
            <span className="text-slate-200 font-semibold max-w-[190px] truncate" title={currentVenue.name}>
              {currentVenue.name.split('—')[0]}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Clock:</span>
            <span className="font-mono text-cyan-300 font-bold bg-navy-950 px-2 py-0.5 rounded border border-navy-700">
              {timeFormatted}
            </span>
          </div>

          {/* Mode Selector */}
          <div className="flex items-center bg-navy-950 rounded p-0.5 border border-navy-700">
            <button
              onClick={() => setSimulationMode('PLANNING')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                simulationMode === 'PLANNING'
                  ? 'bg-violet-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Planning
            </button>
            <button
              onClick={() => setSimulationMode('SIMULATION')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                simulationMode === 'SIMULATION'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Simulation
            </button>
            <button
              onClick={() => setSimulationMode('DEMO_LIVE')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                simulationMode === 'DEMO_LIVE'
                  ? 'bg-amber-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Hypothetical Live
            </button>
          </div>
        </div>

        {/* Simulation Controls & Notification Bar */}
        <div className="flex items-center gap-2">
          {/* Status Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-navy-900 border border-navy-700">
            <span
              className={`w-2 h-2 rounded-full ${
                isRunning
                  ? isPaused
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-emerald-400 animate-ping-slow'
                  : 'bg-slate-500'
              }`}
            />
            <span className="text-slate-300">
              {isRunning ? (isPaused ? 'PAUSED' : 'RUNNING') : 'IDLE'}
            </span>
          </div>

          {/* Playback Buttons */}
          <div className="flex items-center bg-navy-900 border border-navy-700 rounded-lg p-1 gap-1">
            {!isRunning || isPaused ? (
              <button
                onClick={isRunning ? resumeSimulation : startSimulation}
                title="Start / Resume Simulation"
                className="p-1.5 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white transition shadow-sm"
              >
                <Play className="w-4 h-4 fill-white" />
              </button>
            ) : (
              <button
                onClick={pauseSimulation}
                title="Pause Simulation"
                className="p-1.5 rounded-md bg-amber-600 hover:bg-amber-500 text-white transition shadow-sm"
              >
                <Pause className="w-4 h-4 fill-white" />
              </button>
            )}

            <button
              onClick={() => stepForward(0.5)}
              title="Step Forward (0.5s)"
              className="p-1.5 rounded-md bg-navy-800 hover:bg-navy-700 text-slate-300 hover:text-white transition"
            >
              <StepForward className="w-4 h-4" />
            </button>

            <button
              onClick={resetSimulation}
              title="Reset Simulation State"
              className="p-1.5 rounded-md bg-navy-800 hover:bg-navy-700 text-slate-300 hover:text-white transition"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Speed Selector */}
          <div className="hidden sm:flex items-center bg-navy-900 border border-navy-700 rounded-lg px-2 py-1 text-xs gap-1">
            <span className="text-slate-400 font-mono">Speed:</span>
            {[0.5, 1, 2, 5].map((spd) => (
              <button
                key={spd}
                onClick={() => setSpeedMultiplier(spd)}
                className={`px-1.5 py-0.5 rounded text-[11px] font-mono transition ${
                  speedMultiplier === spd
                    ? 'bg-cyan-500 text-navy-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>

          {/* Notifications / Events Pill */}
          <div className="relative">
            <button
              onClick={() => setShowEventsDropdown(!showEventsDropdown)}
              title="Simulation Events & Warnings"
              className="p-2 rounded-lg bg-navy-900 border border-navy-700 text-slate-300 hover:text-white relative transition hover:border-navy-500"
            >
              <Bell className="w-4 h-4" />
              {recentCriticalCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white font-bold text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                  {recentCriticalCount}
                </span>
              )}
            </button>

            {showEventsDropdown && (
              <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-navy-800 border border-navy-600 rounded-xl shadow-2xl p-3 z-50">
                <div className="flex items-center justify-between border-b border-navy-700 pb-2 mb-2">
                  <span className="text-xs font-bold text-slate-200">Simulation Event Stream</span>
                  <span className="text-[10px] text-slate-400">{events.length} total</span>
                </div>
                {events.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">No simulation events logged yet.</p>
                ) : (
                  <div className="space-y-2">
                    {events.slice(0, 10).map((evt) => (
                      <div
                        key={evt.id}
                        className={`text-xs p-2 rounded border ${
                          evt.type === 'CRITICAL'
                            ? 'bg-red-950/40 border-red-800 text-red-200'
                            : evt.type === 'WARNING'
                              ? 'bg-amber-950/40 border-amber-800 text-amber-200'
                              : evt.type === 'INCIDENT'
                                ? 'bg-purple-950/40 border-purple-800 text-purple-200'
                                : 'bg-navy-900 border-navy-700 text-slate-300'
                        }`}
                      >
                        <div className="flex justify-between items-center text-[10px] opacity-75 mb-0.5">
                          <span className="font-mono">{evt.timeFormatted}</span>
                          <span className="font-semibold uppercase">{evt.location}</span>
                        </div>
                        <p>{evt.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Guided Tour & Help */}
          <button
            onClick={() => setShowTour(true)}
            title="Open Interactive Tour & Operational Guide"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy-700 hover:bg-navy-600 text-cyan-300 hover:text-cyan-200 border border-cyan-800/50 text-xs font-medium transition"
          >
            <HelpCircle className="w-4 h-4" />
            <span className="hidden md:inline">Tour</span>
          </button>
        </div>
      </header>

      {/* Guided Tour Modal */}
      {showTour && <GuidedTourModal onClose={() => setShowTour(false)} />}
    </>
  );
};

