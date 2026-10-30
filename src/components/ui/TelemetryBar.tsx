import React from 'react';
import { useSimulationStore } from '../../state/useSimulationStore';
import { Activity, AlertTriangle, Users, Gauge, ArrowRightCircle, Cpu } from 'lucide-react';

export const TelemetryBar: React.FC = () => {
  const telemetry = useSimulationStore((s) => s.telemetry);

  // Density category formatting
  let densityCategory = 'LOS A/B: Free Flow';
  let densityBadgeColor = 'text-emerald-400 border-emerald-500/40 bg-emerald-950/40';

  if (telemetry.peakDensity >= 5.0) {
    densityCategory = 'LOS F: CRITICAL CRUSH DANGER';
    densityBadgeColor = 'text-rose-400 border-rose-500/60 bg-rose-950/60 animate-pulse';
  } else if (telemetry.peakDensity >= 4.5) {
    densityCategory = 'LOS E: High Friction Surge';
    densityBadgeColor = 'text-orange-400 border-orange-500/50 bg-orange-950/50';
  } else if (telemetry.peakDensity >= 2.5) {
    densityCategory = 'LOS C/D: Turbulent Queue';
    densityBadgeColor = 'text-amber-400 border-amber-500/50 bg-amber-950/50';
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-3 bg-slate-900/90 border border-slate-800 rounded-xl backdrop-blur-md">
      {/* 1. Peak Density Telemetry */}
      <div className={`p-3 rounded-lg border flex flex-col justify-between ${densityBadgeColor}`}>
        <div className="flex items-center justify-between text-xs font-semibold tracking-wider uppercase opacity-85">
          <span>Peak Density</span>
          {telemetry.isCritical ? (
            <AlertTriangle className="w-4 h-4 text-rose-400 animate-bounce" />
          ) : (
            <Activity className="w-4 h-4" />
          )}
        </div>
        <div className="my-1">
          <span className="text-2xl font-bold font-mono tracking-tight">
            {telemetry.peakDensity.toFixed(1)}
          </span>
          <span className="text-xs ml-1 font-mono">p/m²</span>
        </div>
        <div className="text-[10px] font-mono font-medium truncate">
          {densityCategory}
        </div>
      </div>

      {/* 2. Max Queue Spillback */}
      <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/60 flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs font-semibold tracking-wider uppercase text-slate-400">
          <span>Queue Spillback</span>
          <ArrowRightCircle className="w-4 h-4 text-cyan-400" />
        </div>
        <div className="my-1">
          <span className="text-2xl font-bold font-mono text-cyan-400">
            {telemetry.spillbackMeters.toFixed(1)}
          </span>
          <span className="text-xs ml-1 text-slate-400 font-mono">meters</span>
        </div>
        <div className="text-[10px] text-slate-400 font-mono">
          Upstream queue reach
        </div>
      </div>

      {/* 3. Ingress Throughput */}
      <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/60 flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs font-semibold tracking-wider uppercase text-slate-400">
          <span>Throughput</span>
          <Gauge className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="my-1">
          <span className="text-2xl font-bold font-mono text-emerald-400">
            {telemetry.throughputPerMin}
          </span>
          <span className="text-xs ml-1 text-slate-400 font-mono">p/min</span>
        </div>
        <div className="text-[10px] text-slate-400 font-mono">
          Turnstile egress rate
        </div>
      </div>

      {/* 4. Active Live Agents */}
      <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/60 flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs font-semibold tracking-wider uppercase text-slate-400">
          <span>Live Agents</span>
          <Users className="w-4 h-4 text-indigo-400" />
        </div>
        <div className="my-1">
          <span className="text-2xl font-bold font-mono text-indigo-400">
            {telemetry.liveAgents}
          </span>
          <span className="text-xs ml-1 text-slate-400 font-mono">in concourse</span>
        </div>
        <div className="text-[10px] text-slate-400 font-mono">
          Active vector bodies
        </div>
      </div>

      {/* 5. Spatial Hash FPS & Engine Health */}
      <div className="col-span-2 md:col-span-1 p-3 rounded-lg border border-slate-800 bg-slate-950/60 flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs font-semibold tracking-wider uppercase text-slate-400">
          <span>Physics Loop</span>
          <Cpu className="w-4 h-4 text-purple-400" />
        </div>
        <div className="my-1 flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-purple-400">
            {telemetry.fps}
          </span>
          <span className="text-xs text-slate-400 font-mono">FPS</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-950/80 text-purple-300 font-mono">
            O(N) GRID
          </span>
        </div>
        <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-ping"></span>
          <span>Deterministic 60 FPS</span>
        </div>
      </div>
    </div>
  );
};
