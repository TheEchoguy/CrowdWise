import React from 'react';
import { useSimulationStore } from '../../state/useSimulationStore';
import {
  Activity,
  ArrowRightCircle,
  Gauge,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  Waves
} from 'lucide-react';

export const RightTelemetry: React.FC = () => {
  const telemetry = useSimulationStore((s) => s.telemetry);
  const bafflesActive = useSimulationStore((s) => s.bafflesActive);
  const auxGateActive = useSimulationStore((s) => s.auxGateActive);
  const applyMitigationPreset = useSimulationStore((s) => s.applyMitigationPreset);

  const isMitigated = bafflesActive && auxGateActive;

  // Density category formatting
  let densityCategory = 'Safe Free Flow';
  let densityBarColor = 'bg-emerald-500';
  let densityTextColor = 'text-emerald-400';
  let densityBadgeBorder = 'border-emerald-500/30 bg-emerald-950/40';

  if (telemetry.peakDensity >= 5.0) {
    densityCategory = 'CRITICAL CRUSH HAZARD';
    densityBarColor = 'bg-rose-500 animate-pulse';
    densityTextColor = 'text-rose-400';
    densityBadgeBorder = 'border-rose-500/80 bg-rose-950/70 animate-pulse';
  } else if (telemetry.peakDensity >= 4.5) {
    densityCategory = 'High Friction Surge';
    densityBarColor = 'bg-orange-500';
    densityTextColor = 'text-orange-400';
    densityBadgeBorder = 'border-orange-500/50 bg-orange-950/50';
  } else if (telemetry.peakDensity >= 2.5) {
    densityCategory = 'Turbulent Friction Queue';
    densityBarColor = 'bg-amber-500';
    densityTextColor = 'text-amber-400';
    densityBadgeBorder = 'border-amber-500/50 bg-amber-950/50';
  }

  // Normalized density progress (0 to 8 p/m²)
  const densityPercent = Math.min(100, Math.max(0, (telemetry.peakDensity / 8.0) * 100));

  return (
    <div className="flex flex-col gap-3.5 p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl backdrop-blur-md text-slate-200 h-full overflow-y-auto">
      {/* Telemetry Header with Dynamic Arrival Profile Pill */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-1.5">
          <Activity className="w-4 h-4 text-cyan-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-100">
            Real-Time Telemetry
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-cyan-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 flex items-center gap-1">
            <Waves className="w-3 h-3 text-cyan-400" />
            <span className="uppercase font-bold">{telemetry.activeArrivalProfile || 'STEADY'}</span>
          </span>
        </div>
      </div>

      {/* 1. Peak Local Density Gauge with Trend */}
      <div className={`p-3 rounded-lg border flex flex-col gap-2 transition ${densityBadgeBorder}`}>
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-300">
          <span>Peak Local Density</span>
          <div className="flex items-center gap-1 font-mono text-[10px]">
            {telemetry.densityTrend === 'rising' ? (
              <span className="text-rose-400 flex items-center gap-0.5">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>RISING</span>
              </span>
            ) : telemetry.densityTrend === 'clearing' ? (
              <span className="text-emerald-400 flex items-center gap-0.5">
                <TrendingDown className="w-3.5 h-3.5" />
                <span>CLEARING</span>
              </span>
            ) : (
              <span className="text-slate-400 flex items-center gap-0.5">
                <Minus className="w-3.5 h-3.5" />
                <span>STABLE</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-baseline justify-between">
          <div>
            <span className={`text-3xl font-extrabold font-mono tracking-tight ${densityTextColor}`}>
              {telemetry.peakDensity.toFixed(1)}
            </span>
            <span className="text-xs ml-1.5 font-mono text-slate-400 font-semibold">people/m²</span>
          </div>
          <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded ${densityBadgeBorder}`}>
            {densityCategory}
          </span>
        </div>

        {/* Dynamic Color Progress Bar */}
        <div className="w-full bg-slate-800/80 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${densityBarColor}`}
            style={{ width: `${densityPercent}%` }}
          />
        </div>

        <div className="flex justify-between text-[9px] font-mono text-slate-500">
          <span>0 (Empty)</span>
          <span className="text-amber-500">2.5 (Queue)</span>
          <span className="text-rose-500 font-bold">&ge; 5.0 (Crush Shockwave)</span>
        </div>
      </div>

      {/* 2. Phase 2: Predictive Time to Turbulence Gauge */}
      <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/60 flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Time to Turbulence</span>
          </span>
          <span className="text-[10px] font-mono text-slate-500">2s MOVING WINDOW</span>
        </div>

        <div className="flex items-baseline justify-between">
          <div>
            {telemetry.timeToTurbulence !== null ? (
              <>
                <span className={`text-2xl font-extrabold font-mono ${telemetry.timeToTurbulence <= 5.0 ? 'text-rose-400 animate-pulse' : 'text-amber-400'}`}>
                  {telemetry.timeToTurbulence.toFixed(1)}
                </span>
                <span className="text-xs ml-1.5 font-mono text-slate-400">sec to &ge; 5.0 p/m²</span>
              </>
            ) : (
              <span className="text-sm font-bold font-mono text-emerald-400">
                SAFE &bull; NO SURGE DETECTED
              </span>
            )}
          </div>
          {telemetry.timeToTurbulence !== null && (
            <span className={`text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${
              telemetry.timeToTurbulence <= 3.0 ? 'bg-rose-950 border border-rose-700 text-rose-300' : 'bg-amber-950 border border-amber-700 text-amber-300'
            }`}>
              {telemetry.timeToTurbulence <= 0 ? 'CRUSH IMPACT NOW' : 'CRUSH IMMINENT'}
            </span>
          )}
        </div>
        <p className="text-[10px] text-slate-500 leading-tight">
          Calculates second derivatives dDensity/dt to forecast compressive shockwave onset.
        </p>
      </div>

      {/* 3. Queue Spillback Distance & Throughput Grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-950/60 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase">
            <span>Spillback</span>
            <ArrowRightCircle className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="my-1">
            <span className="text-xl font-bold font-mono text-cyan-400">
              {telemetry.spillbackMeters.toFixed(1)}
            </span>
            <span className="text-[10px] ml-1 font-mono text-slate-400">m</span>
          </div>
          <div className="text-[9px] text-slate-500 font-mono">Concourse queue</div>
        </div>

        <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-950/60 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase">
            <span>Throughput</span>
            <Gauge className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="my-1">
            <span className="text-xl font-bold font-mono text-emerald-400">
              {telemetry.throughputPerMin}
            </span>
            <span className="text-[10px] ml-1 font-mono text-slate-400">p/min</span>
          </div>
          <div className="text-[9px] text-slate-500 font-mono">Turnstile flow</div>
        </div>
      </div>

      {/* 4. Side-by-Side Baseline vs. Mitigated Decision Card */}
      <div className="p-3 rounded-lg border border-indigo-900/60 bg-gradient-to-b from-indigo-950/40 to-slate-950/90 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-bold text-slate-100 uppercase tracking-wider">
              Safety Decision Brief
            </span>
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
            isMitigated ? 'bg-emerald-950 border border-emerald-700 text-emerald-300' : 'bg-rose-950 border border-rose-700 text-rose-300'
          }`}>
            {isMitigated ? 'MITIGATED PLAN' : 'BASELINE (UNSAFE)'}
          </span>
        </div>

        {/* Side-by-side comparative table */}
        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
          <div className="p-2 rounded bg-slate-900/80 border border-slate-800 flex flex-col gap-1">
            <div className="text-slate-400 font-semibold uppercase">Baseline (Status Quo)</div>
            <div className="text-rose-400 font-bold">&bull; Peak: ~6.2 p/m²</div>
            <div className="text-slate-400">&bull; Spillback: ~34m</div>
            <div className="text-slate-400">&bull; Choke: Gate A Funnel</div>
          </div>

          <div className="p-2 rounded bg-indigo-950/60 border border-indigo-800/60 flex flex-col gap-1">
            <div className="text-indigo-300 font-semibold uppercase">CROWDWISE Plan</div>
            <div className="text-emerald-400 font-bold">&bull; Peak: ~3.1 p/m²</div>
            <div className="text-cyan-400">&bull; Spillback: ~12m</div>
            <div className="text-emerald-400">&bull; Safe Laminar Egress</div>
          </div>
        </div>

        {/* Run Live What-If Demo CTA */}
        <button
          onClick={applyMitigationPreset}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-slate-950 font-extrabold text-xs shadow-lg shadow-indigo-950/60 transition"
        >
          {isMitigated ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-slate-950" />
              <span>Mitigations Active (Revert)</span>
            </>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4 text-slate-950" />
              <span>Run Live What-If Demo</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
