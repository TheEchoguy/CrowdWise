import React from 'react';
import {
  Settings,
  ShieldCheck,
  Eye,
  Sliders,
  Cpu,
  RotateCcw,
  Sparkles,
  Info,
  Check,
} from 'lucide-react';
import { useSimulationStore } from '../../store/simulationStore';

export const SettingsView: React.FC = () => {
  const {
    speedMultiplier,
    setSpeedMultiplier,
    detailLevel,
    setDetailLevel,
    randomSeed,
    setRandomSeed,
    currentVenue,
    setVenueProfile,
  } = useSimulationStore();

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1200px] mx-auto select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-navy-700 pb-4">
        <div>
          <h2 className="text-xl font-black text-slate-100 flex items-center gap-2">
            <Settings className="w-5 h-5 text-cyan-400" />
            Simulation Parameters &amp; Safety Assumptions
          </h2>
          <p className="text-xs text-slate-400">
            Configure crowd movement physics, density risk thresholds, hardware processing rates, and transparency parameters.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Crowd Simulation Physics & Thresholds */}
        <div className="bg-navy-850 border border-navy-700 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center gap-2 border-b border-navy-700 pb-3">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <h3 className="font-bold text-slate-100 text-sm">Density &amp; Risk Thresholds</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-400">Watch Level Threshold</span>
                <span className="font-mono text-cyan-300 font-bold">1.5 people/m²</span>
              </div>
              <input
                type="range"
                min="1.0"
                max="2.0"
                step="0.1"
                defaultValue="1.5"
                className="w-full accent-cyan-500"
              />
              <span className="text-[10px] text-slate-500">Noticeable crowd slowing occurs above this value.</span>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-400">High Congestion Threshold</span>
                <span className="font-mono text-amber-300 font-bold">2.2 people/m²</span>
              </div>
              <input
                type="range"
                min="1.8"
                max="3.0"
                step="0.1"
                defaultValue="2.2"
                className="w-full accent-amber-500"
              />
              <span className="text-[10px] text-slate-500">Flow stagnation and corridor queuing begin to form.</span>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-400">Critical Review Required Limit</span>
                <span className="font-mono text-red-400 font-bold">3.0 people/m²</span>
              </div>
              <input
                type="range"
                min="2.5"
                max="4.5"
                step="0.1"
                defaultValue="3.0"
                className="w-full accent-red-500"
              />
              <span className="text-[10px] text-slate-500">Severe crush hazard condition; triggers mandatory red alert.</span>
            </div>
          </div>
        </div>

        {/* 2. Visual Rendering & Detail */}
        <div className="bg-navy-850 border border-navy-700 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center gap-2 border-b border-navy-700 pb-3">
            <Eye className="w-4 h-4 text-cyan-400" />
            <h3 className="font-bold text-slate-100 text-sm">Visual Fidelity &amp; Detail</h3>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="text-slate-400 block mb-1.5">Pedestrian Visual Representation</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'DETAILED', label: 'Detailed Sprites', desc: 'Limbs & Facing' },
                  { id: 'SIMPLIFIED', label: 'Simplified Dots', desc: 'High FPS' },
                  { id: 'DENSITY_ONLY', label: 'Density Only', desc: 'Thermal Map' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setDetailLevel(item.id as any)}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      detailLevel === item.id
                        ? 'bg-cyan-950 border-cyan-500 text-cyan-300'
                        : 'bg-navy-900 border-navy-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="font-bold text-xs">{item.label}</div>
                    <div className="text-[10px] text-slate-500">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-400">Simulation Speed Multiplier</span>
                <span className="font-mono text-cyan-300 font-bold">{speedMultiplier}x</span>
              </div>
              <div className="flex gap-2">
                {[0.5, 1, 2, 5].map((spd) => (
                  <button
                    key={spd}
                    onClick={() => setSpeedMultiplier(spd)}
                    className={`flex-1 py-1.5 rounded-lg border font-mono font-bold text-xs transition ${
                      speedMultiplier === spd
                        ? 'bg-cyan-600 border-cyan-500 text-white'
                        : 'bg-navy-900 border-navy-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-400">Deterministic Random Seed</span>
                <span className="font-mono text-cyan-300 font-bold">#{randomSeed}</span>
              </div>
              <input
                type="number"
                value={randomSeed}
                onChange={(e) => setRandomSeed(Number(e.target.value))}
                className="w-full bg-navy-950 border border-navy-600 rounded-lg p-2 text-slate-200 font-mono text-xs focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Methodological Transparency & Non-Predictive Boundary Statement */}
      <div className="bg-navy-850 border border-navy-700 rounded-2xl p-6 shadow-xl space-y-3">
        <div className="flex items-center gap-2 text-cyan-400">
          <ShieldCheck className="w-5 h-5" />
          <h3 className="font-bold text-slate-100 text-sm">
            Methodological Transparency &amp; Boundary Disclosures
          </h3>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          CROWDWISE implements agent-based movement dynamics derived from Weidmann's fundamental crowd velocity-density relations and Helbing social-force collision models. All figures presented (such as scanner throughput rates, gate widths, and approach shares) are configurable scenario assumptions.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-2">
          <div className="p-3 bg-navy-900 rounded-xl border border-navy-750">
            <span className="text-cyan-400 font-bold block mb-1">1. Illustrative Models</span>
            <p className="text-slate-400 text-[11px]">
              Stadium maps are simplified illustrative digital twins for operational testing, not certified architectural construction prints.
            </p>
          </div>

          <div className="p-3 bg-navy-900 rounded-xl border border-navy-750">
            <span className="text-cyan-400 font-bold block mb-1">2. Decision Support Only</span>
            <p className="text-slate-400 text-[11px]">
              Outputs are pre-event planning estimates that help organizers identify potential bottlenecks before they manifest in reality.
            </p>
          </div>

          <div className="p-3 bg-navy-900 rounded-xl border border-navy-750">
            <span className="text-cyan-400 font-bold block mb-1">3. Human Review Required</span>
            <p className="text-slate-400 text-[11px]">
              All gate diversions, queue corrals, and crowd holding decisions must be verified and approved by qualified crowd safety managers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

