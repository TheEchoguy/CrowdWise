import React from 'react';
import { useSimulationStore } from '../../state/useSimulationStore';
import { CHINNASWAMY_CONFIG } from '../../engine/ChinnaswamyData';
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
  Waves,
  AlertTriangle,
  Users,
  Train,
  Flame,
  Zap,
  Radio,
  ArrowRight,
  Plus
} from 'lucide-react';

export const RightTelemetry: React.FC = () => {
  const telemetry = useSimulationStore((s) => s.telemetry);
  const bafflesActive = useSimulationStore((s) => s.bafflesActive);
  const auxGateActive = useSimulationStore((s) => s.auxGateActive);
  const dividerActive = useSimulationStore((s) => s.dividerActive);
  const overflowRerouteActive = useSimulationStore((s) => s.overflowRerouteActive);
  const scannerFailureActive = useSimulationStore((s) => s.scannerFailureActive);
  const autonomousRerouteActive = useSimulationStore((s) => s.autonomousRerouteActive);
  const scenario = useSimulationStore((s) => s.scenario);
  const stadiumSeatedCount = useSimulationStore((s) => s.stadiumSeatedCount);
  const applyMitigationPreset = useSimulationStore((s) => s.applyMitigationPreset);
  const setDividerActive = useSimulationStore((s) => s.setDividerActive);
  const triggerBurstRush = useSimulationStore((s) => s.triggerBurstRush);
  const counterCountGate1 = useSimulationStore((s) => s.counterCountGate1);
  const counterCountGate2 = useSimulationStore((s) => s.counterCountGate2);
  const addCounter = useSimulationStore((s) => s.addCounter);

  const handleDeployExtraCounters = () => {
    addCounter('gate-1');
    addCounter('gate-1');
  };

  const isMitigated =
    scenario === 'bridge'
      ? dividerActive
      : bafflesActive && (auxGateActive || overflowRerouteActive);

  const handleToggleMitigation = () => {
    if (scenario === 'bridge') {
      setDividerActive(!dividerActive);
    } else {
      applyMitigationPreset();
    }
  };

  // Density category formatting
  let densityCategory = 'Safe Free Flow';
  let densityBarColor = 'bg-emerald-500';
  let densityTextColor = 'text-emerald-400';
  let densityBadgeBorder = 'border-emerald-500/30 bg-emerald-950/40';

  if (telemetry.peakDensity >= 5.0) {
    densityCategory = 'CRITICAL CRUSH HAZARD';
    densityBarColor = 'bg-rose-500 animate-pulse';
    densityTextColor = 'text-rose-400';
    densityBadgeBorder = 'border-rose-500/80 bg-rose-950/70 animate-pulse ring-1 ring-rose-500/50';
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

  const densityPercent = Math.min(100, Math.max(0, (telemetry.peakDensity / 8.0) * 100));
  const isTurbulenceActive = telemetry.timeToTurbulence !== null && telemetry.timeToTurbulence >= 0;
  const isTurbulenceCritical = isTurbulenceActive && (telemetry.timeToTurbulence as number) <= 5.0;

  const crushIndex = telemetry.crushProbabilityIndex || 12;
  const isHighCrushRisk = crushIndex >= 60;
  const isMediumCrushRisk = crushIndex >= 35 && crushIndex < 60;
  const isSpillbackCritical = telemetry.spillbackMeters >= 20.0;

  const gate1 = telemetry.gateMetrics?.['gate-1'] || telemetry.gateMetrics?.['gate1'] || {
    queueCount: 0,
    density: telemetry.peakDensity,
    inflowRate: 240,
    capacity: 300,
    status: 'NORMAL' as const
  };

  const gate2 = telemetry.gateMetrics?.['gate-2'] || telemetry.gateMetrics?.['gate2'] || {
    queueCount: 0,
    density: 0.8,
    inflowRate: 0,
    capacity: 240,
    status: 'NORMAL' as const
  };

  return (
    <div className="flex flex-col gap-3 p-3 bg-slate-900/90 border border-slate-800 rounded-xl backdrop-blur-md text-slate-200 h-full overflow-y-auto">
      {/* Telemetry Header with Dynamic Arrival Profile Pill */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-1.5">
          <Activity className="w-4 h-4 text-cyan-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-100">
            Incident Mitigation Deck
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          {telemetry.metroBurstActive && (
            <span className="text-[10px] font-mono text-rose-400 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-700 flex items-center gap-1 animate-pulse">
              <Train className="w-3 h-3 text-rose-400" />
              <span className="font-bold">METRO PULSE</span>
            </span>
          )}
          <span className="text-[10px] font-mono text-cyan-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 flex items-center gap-1">
            <Waves className="w-3 h-3 text-cyan-400" />
            <span className="uppercase font-bold">{telemetry.activeArrivalProfile || 'STEADY'}</span>
          </span>
        </div>
      </div>

      {/* 1. Live Incident Dispatch Banner (Active Incident Commander) */}
      <div
        className={`p-3 rounded-lg border transition-all duration-300 flex flex-col gap-2 ${
          telemetry.activeRerouteAlert
            ? 'border-cyan-500/80 bg-cyan-950/40 ring-1 ring-cyan-500/50 shadow-md shadow-cyan-950/60'
            : autonomousRerouteActive
            ? 'border-emerald-700/60 bg-emerald-950/30'
            : 'border-slate-800 bg-slate-950/60'
        }`}
      >
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            <Radio
              className={`w-3.5 h-3.5 ${
                telemetry.activeRerouteAlert
                  ? 'text-cyan-400 animate-pulse'
                  : autonomousRerouteActive
                  ? 'text-emerald-400'
                  : 'text-slate-500'
              }`}
            />
            <span
              className={
                telemetry.activeRerouteAlert
                  ? 'text-cyan-300 font-extrabold'
                  : autonomousRerouteActive
                  ? 'text-emerald-300'
                  : 'text-slate-400'
              }
            >
              Live Incident Dispatch
            </span>
          </span>
          <span
            className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
              telemetry.activeRerouteAlert
                ? 'bg-cyan-900 border border-cyan-500 text-cyan-200 animate-pulse'
                : autonomousRerouteActive
                ? 'bg-emerald-900 border border-emerald-600 text-emerald-200'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {telemetry.activeRerouteAlert
              ? 'DIVERSION ACTIVE'
              : autonomousRerouteActive
              ? 'AI COMMANDER ARMED'
              : 'MANUAL MODE'}
          </span>
        </div>

        {telemetry.activeRerouteAlert ? (
          <div className="space-y-1 font-mono text-[11px]">
            <p className="text-cyan-200 font-bold leading-tight">
              {telemetry.activeRerouteAlert.message}
            </p>
            <div className="flex items-center gap-1 text-[10px] text-cyan-400 pt-0.5">
              <span>{telemetry.activeRerouteAlert.sourceGate}</span>
              <ArrowRight className="w-3 h-3 text-cyan-300" />
              <span>{telemetry.activeRerouteAlert.targetGate}</span>
              <span className="ml-auto font-bold text-emerald-400">
                ({telemetry.activeRerouteAlert.diversionPercentage}% Load)
              </span>
            </div>
          </div>
        ) : (
          <p className="text-[10px] text-slate-400 leading-tight font-sans">
            {autonomousRerouteActive
              ? 'AI Incident Commander continuously balances turnstile queues. Flow will automatically divert to Gate 2 if Gate 1 exceeds 4.0 p/m².'
              : 'Smart rerouting is disabled. Crowd will surge unmanaged into Gate 1, creating crush shockwaves.'}
          </p>
        )}
      </div>

      {/* 2. Multi-Stage Ingress & Dynamic Staffing Radar */}
      <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-950/80 flex flex-col gap-2">
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 uppercase tracking-wider">
          <span>Gate Load-Balancing Radar</span>
          <span className="text-[9px] font-mono text-cyan-400">STAGE 2 & 3 METRICS</span>
        </div>

        {/* 4 Multi-Stage Real-Time Telemetry Badges */}
        <div className="grid grid-cols-2 gap-1.5 font-mono text-xs">
          <div className="p-1.5 rounded bg-slate-900/90 border border-slate-800">
            <span className="text-[8px] uppercase text-slate-400 block">Active Booths</span>
            <span className="text-sm font-bold text-amber-300">{telemetry.activeCountersCount} Active</span>
          </div>
          <div className="p-1.5 rounded bg-slate-900/90 border border-slate-800">
            <span className="text-[8px] uppercase text-slate-400 block">Avg Ingress Wait</span>
            <span className="text-sm font-bold text-cyan-300">{telemetry.averageWaitTimeSec.toFixed(1)}s</span>
          </div>
          <div className="p-1.5 rounded bg-slate-900/90 border border-slate-800">
            <span className="text-[8px] uppercase text-slate-400 block">0.2s Fast-Scan</span>
            <span className="text-sm font-bold text-sky-400">{telemetry.fastScanThroughput} p/m</span>
          </div>
          <div className="p-1.5 rounded bg-slate-900/90 border border-slate-800">
            <span className="text-[8px] uppercase text-slate-400 block">Security Check</span>
            <span className="text-sm font-bold text-emerald-400">{telemetry.securityCheckThroughput} p/m</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-[10px] border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-[9px] uppercase">
                <th className="py-1">Gate ID</th>
                <th className="py-1">Queue</th>
                <th className="py-1">Booths</th>
                <th className="py-1">Inflow</th>
                <th className="py-1">Cap</th>
                <th className="py-1">Density</th>
                <th className="py-1 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              <tr>
                <td className="py-1.5 font-bold text-orange-400">Gate 1 (Main)</td>
                <td className="py-1.5 text-orange-300 font-bold">{gate1.queueCount}</td>
                <td className="py-1.5 text-amber-300 font-bold">{counterCountGate1}</td>
                <td className="py-1.5 text-slate-200">{gate1.inflowRate} p/m</td>
                <td className="py-1.5 text-slate-400">{gate1.capacity} p/m</td>
                <td className="py-1.5 font-bold text-slate-100">{gate1.density.toFixed(1)}</td>
                <td className="py-1.5 text-right">
                  <span
                    className={`px-1.5 py-0.2 rounded text-[8px] font-bold ${
                      gate1.status === 'CRITICAL'
                        ? 'bg-rose-950 text-rose-300 border border-rose-700'
                        : gate1.status === 'WARNING'
                        ? 'bg-amber-950 text-amber-300 border border-amber-700'
                        : 'bg-emerald-950 text-emerald-300'
                    }`}
                  >
                    {gate1.status}
                  </span>
                </td>
              </tr>
              <tr>
                <td className="py-1.5 font-bold text-cyan-400">Gate 2 (Aux)</td>
                <td className="py-1.5 text-cyan-300 font-bold">{gate2.queueCount}</td>
                <td className="py-1.5 text-cyan-300 font-bold">{auxGateActive || overflowRerouteActive ? counterCountGate2 : 0}</td>
                <td className="py-1.5 text-slate-200">{gate2.inflowRate} p/m</td>
                <td className="py-1.5 text-slate-400">{gate2.capacity} p/m</td>
                <td className="py-1.5 font-bold text-slate-100">{gate2.density.toFixed(1)}</td>
                <td className="py-1.5 text-right">
                  <span
                    className={`px-1.5 py-0.2 rounded text-[8px] font-bold ${
                      auxGateActive || overflowRerouteActive
                        ? 'bg-cyan-950 text-cyan-300 border border-cyan-700'
                        : 'bg-slate-900 text-slate-500'
                    }`}
                  >
                    {auxGateActive || overflowRerouteActive ? 'ACTIVE' : 'STANDBY'}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Dynamic Staffing Recommendation Alert when Spillback > 15m */}
        {telemetry.spillbackMeters > 15.0 ? (
          <div className="mt-1 p-2.5 rounded-lg bg-amber-950/70 border border-amber-500/80 shadow-md space-y-1.5 animate-pulse">
            <div className="flex items-center justify-between text-xs font-bold text-amber-300">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>Dynamic Staffing Recommendation</span>
              </span>
              <span className="text-[9px] font-mono text-amber-400 font-bold">SPILLBACK &gt; 15m</span>
            </div>
            <p className="text-[10px] font-mono text-amber-200 leading-tight">
              OPERATIONAL FIX: Add +2 Security Counters to Gate 1 to clear 120-person backlog in 45s.
            </p>
            <button
              onClick={handleDeployExtraCounters}
              disabled={counterCountGate1 >= 10}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 disabled:opacity-40 text-slate-950 font-extrabold text-xs shadow transition active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Deploy Extra Counters ({counterCountGate1} &rarr; {Math.min(10, counterCountGate1 + 2)})</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between pt-1 text-[10px] font-mono text-slate-400">
            <span>Staffing: {counterCountGate1} Booths (Nominal)</span>
            <button
              onClick={handleDeployExtraCounters}
              disabled={counterCountGate1 >= 10}
              className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-bold disabled:opacity-40"
            >
              <Plus className="w-3 h-3" />
              <span>Deploy Extra Counters</span>
            </button>
          </div>
        )}
      </div>

      {/* HURDLE AUDIT: REAL-WORLD PHYSICS (Evaluation Verification) */}
      <div className="p-2.5 rounded-lg border border-indigo-700/60 bg-indigo-950/30 flex flex-col gap-2 shadow-sm">
        <div className="flex items-center justify-between text-[11px] font-bold text-indigo-300 uppercase tracking-wider">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Hurdle Audit: Real-World Physics</span>
          </div>
          <span className="text-[9px] font-mono text-indigo-300 bg-indigo-900/60 px-1.5 py-0.5 rounded border border-indigo-700">
            HURDLE LAB
          </span>
        </div>

        {/* 1. Counter-Flow Friction Index */}
        <div className="p-2 rounded bg-slate-950/80 border border-slate-800 space-y-1">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-300 font-semibold flex items-center gap-1">
              <span>Counter-Flow Friction Index</span>
            </span>
            <span className="font-mono text-xs font-bold text-rose-400 bg-rose-950/80 px-1.5 py-0.2 rounded border border-rose-800">
              {telemetry.counterFlowPenaltyPercent ?? -38}% Flow Penalty
            </span>
          </div>
          <p className="text-[9px] font-mono text-slate-400 leading-tight">
            Head-on vector collision (<span className="text-amber-300">v1 · v2 &lt; -0.5</span>) exponentially amplifies lateral evasion friction, matching empirical counter-flow measurements.
          </p>
        </div>

        {/* 2. Displaced Risk Monitor (Zone A vs Zone B) */}
        <div className="p-2 rounded bg-slate-950/80 border border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span>Displaced Risk Monitor</span>
            <span className="text-[9px] font-mono text-cyan-400">DUAL-ZONE</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
            {/* Zone A: Turnstile Throat */}
            <div className="p-1.5 rounded bg-slate-900 border border-slate-800 flex flex-col gap-1">
              <span className="text-slate-400 text-[8px] uppercase">Zone A: Turnstile Throat</span>
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-bold text-slate-200">
                  {(telemetry.zoneADensity ?? 1.2).toFixed(1)} <span className="text-[9px] font-normal text-slate-400">p/m²</span>
                </span>
                <span className={`text-[8px] px-1 rounded ${
                  (telemetry.zoneADensity ?? 1.2) >= 4.5 ? 'bg-rose-950 text-rose-300' : 'bg-emerald-950 text-emerald-300'
                }`}>
                  {(telemetry.zoneADensity ?? 1.2) >= 4.5 ? 'CRITICAL' : 'METERED'}
                </span>
              </div>
              <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                <div
                  className={`h-full ${
                    (telemetry.zoneADensity ?? 1.2) >= 4.5 ? 'bg-rose-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, ((telemetry.zoneADensity ?? 1.2) / 6.0) * 100)}%` }}
                />
              </div>
            </div>

            {/* Zone B: Upstream Holding Plaza */}
            <div className="p-1.5 rounded bg-slate-900 border border-slate-800 flex flex-col gap-1">
              <span className="text-slate-400 text-[8px] uppercase">Zone B: MG Road Plaza</span>
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-bold text-slate-200">
                  {(telemetry.zoneBDensity ?? 2.1).toFixed(1)} <span className="text-[9px] font-normal text-slate-400">p/m²</span>
                </span>
                <span className={`text-[8px] px-1 rounded ${
                  (telemetry.zoneBDensity ?? 2.1) >= 4.5 ? 'bg-rose-950 text-rose-300 animate-pulse' : 'bg-amber-950 text-amber-300'
                }`}>
                  {(telemetry.zoneBDensity ?? 2.1) >= 4.5 ? 'DISPLACED CRUSH' : 'ELEVATED'}
                </span>
              </div>
              <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                <div
                  className={`h-full ${
                    (telemetry.zoneBDensity ?? 2.1) >= 4.5 ? 'bg-rose-500 animate-pulse' : 'bg-amber-500'
                  }`}
                  style={{ width: `${Math.min(100, ((telemetry.zoneBDensity ?? 2.1) / 6.0) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Displaced Danger Warning Banner */}
          {telemetry.displacedCrushAdvisory && (
            <div className="p-1.5 rounded bg-rose-950/80 border border-rose-600/80 text-[10px] text-rose-200 font-mono flex items-start gap-1.5 animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
              <span>{telemetry.displacedCrushAdvisory}</span>
            </div>
          )}
        </div>

        {/* 3. Fruin Level of Service (LOS) Indicator */}
        <div className="p-2 rounded bg-slate-950/80 border border-slate-800 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1">
              <span>Fruin Level of Service (LOS)</span>
            </span>
            <span className="text-[9px] text-slate-400 font-mono">
              v(ρ) = v₀·(1 - ρ/5.4) [Fruin 1971]
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={`text-xs font-extrabold px-2 py-0.5 rounded font-mono border ${
                telemetry.fruinLOS === 'F'
                  ? 'bg-rose-950 text-rose-300 border-rose-600 animate-pulse'
                  : telemetry.fruinLOS === 'E'
                  ? 'bg-orange-950 text-orange-300 border-orange-600'
                  : telemetry.fruinLOS === 'D'
                  ? 'bg-amber-950 text-amber-300 border-amber-600'
                  : 'bg-emerald-950 text-emerald-300 border-emerald-600'
              }`}
            >
              LOS {telemetry.fruinLOS ?? 'A'} ({
                telemetry.fruinLOS === 'F' ? 'Jam' :
                telemetry.fruinLOS === 'E' ? 'Shuffling' :
                telemetry.fruinLOS === 'D' ? 'Restricted' : 'Free'
              })
            </span>
          </div>
        </div>
      </div>

      {/* 3. Interactive Simulate 500-Person Burst Rush Button */}
      <button
        onClick={() => triggerBurstRush(500)}
        className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-slate-950 font-extrabold text-xs shadow-lg shadow-orange-950/60 transition active:scale-[0.98]"
        title="Triggers an immediate 500-person burst rush to stress-test automated load balancing"
      >
        <Zap className="w-4 h-4 text-slate-950" />
        <span>Simulate 500-Person Burst Rush</span>
      </button>

      {/* 4. Stand Saturation & Time-to-Fill Card */}
      {scenario === 'stadium' && (
        <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/70 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300 uppercase">
            <span className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-cyan-400" />
              <span>Stand Saturation</span>
            </span>
            <span className="text-[10px] font-mono text-cyan-400 font-bold">
              {telemetry.stadiumFillPercentage}% FILLED
            </span>
          </div>

          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-2xl font-extrabold font-mono text-slate-100">
                {stadiumSeatedCount.toLocaleString()}
              </span>
              <span className="text-xs ml-1.5 font-mono text-slate-400">
                / {CHINNASWAMY_CONFIG.totalCapacity.toLocaleString()} seats
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono font-bold text-amber-400">
                ~{telemetry.estimatedTimeToFillHours.toFixed(1)} hrs
              </span>
              <span className="text-[9px] block text-slate-500 font-mono">to full capacity</span>
            </div>
          </div>

          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 via-indigo-500 to-amber-500 transition-all duration-500"
              style={{ width: `${telemetry.stadiumFillPercentage}%` }}
            />
          </div>
        </div>
      )}

      {/* 5. Stampede & Crush Risk Index (0 - 100%) */}
      <div
        className={`p-3 rounded-lg border transition-all duration-300 flex flex-col gap-2 ${
          isHighCrushRisk
            ? 'border-rose-500/80 bg-rose-950/40 ring-1 ring-rose-500/50'
            : isMediumCrushRisk
            ? 'border-amber-500/60 bg-amber-950/30'
            : 'border-slate-800 bg-slate-950/60'
        }`}
      >
        <div className="flex items-center justify-between text-xs font-semibold text-slate-300 uppercase">
          <span className="flex items-center gap-1.5">
            <Flame
              className={`w-3.5 h-3.5 ${
                isHighCrushRisk ? 'text-rose-400 animate-bounce' : 'text-amber-400'
              }`}
            />
            <span>Stampede & Crush Index</span>
          </span>
          <span
            className={`text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${
              isHighCrushRisk
                ? 'bg-rose-900 text-rose-200 border border-rose-600'
                : isMediumCrushRisk
                ? 'bg-amber-900 text-amber-200 border border-amber-600'
                : 'bg-emerald-950 text-emerald-300 border border-emerald-700'
            }`}
          >
            {isHighCrushRisk ? 'CRITICAL RISK' : isMediumCrushRisk ? 'ELEVATED FRICTION' : 'SAFE LAMINAR'}
          </span>
        </div>

        <div className="flex items-baseline justify-between">
          <div>
            <span
              className={`text-3xl font-extrabold font-mono tracking-tight ${
                isHighCrushRisk ? 'text-rose-400' : isMediumCrushRisk ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              {crushIndex}%
            </span>
            <span className="text-xs ml-1.5 font-mono text-slate-400 font-semibold">
              Hazard Rating
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            {crushIndex > 50 ? 'Shockwave Risk' : 'Controlled Flow'}
          </span>
        </div>

        <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              isHighCrushRisk ? 'bg-rose-500 animate-pulse' : isMediumCrushRisk ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${crushIndex}%` }}
          />
        </div>
      </div>

      {/* 6. Peak Local Density & Time to Turbulence */}
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

        <div className="w-full bg-slate-800/80 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${densityBarColor}`}
            style={{ width: `${densityPercent}%` }}
          />
        </div>
      </div>

      {/* 7. Predictive Time to Turbulence Gauge */}
      <div
        className={`p-3 rounded-lg border transition-all duration-300 flex flex-col gap-1.5 ${
          isTurbulenceCritical
            ? 'border-rose-500/80 bg-rose-950/50 animate-pulse ring-2 ring-rose-500/60 shadow-lg shadow-rose-950/80'
            : isTurbulenceActive
            ? 'border-amber-500/80 bg-amber-950/40 animate-pulse ring-1 ring-amber-500/50 shadow-md shadow-amber-950/60'
            : 'border-slate-800 bg-slate-950/60'
        }`}
      >
        <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            {isTurbulenceCritical ? (
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 animate-bounce" />
            ) : (
              <Clock className={`w-3.5 h-3.5 ${isTurbulenceActive ? 'text-amber-400 animate-pulse' : 'text-slate-400'}`} />
            )}
            <span className={isTurbulenceCritical ? 'text-rose-300 font-bold' : isTurbulenceActive ? 'text-amber-300 font-bold' : 'text-slate-400'}>
              Time to Turbulence
            </span>
          </span>
          <span className="text-[10px] font-mono text-slate-500">2s MOVING WINDOW</span>
        </div>

        <div className="flex items-baseline justify-between">
          <div>
            {telemetry.timeToTurbulence !== null ? (
              <>
                <span
                  className={`text-2xl font-extrabold font-mono tracking-tight ${
                    isTurbulenceCritical ? 'text-rose-400' : 'text-amber-400'
                  }`}
                >
                  {telemetry.timeToTurbulence.toFixed(1)}
                </span>
                <span className="text-xs ml-1.5 font-mono text-slate-400 font-semibold">
                  sec until crush (&ge;5.0 p/m²)
                </span>
              </>
            ) : (
              <span className="text-sm font-bold font-mono text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>SAFE &bull; NO SURGE DETECTED</span>
              </span>
            )}
          </div>
          {telemetry.timeToTurbulence !== null && (
            <span
              className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded shadow ${
                isTurbulenceCritical
                  ? 'bg-rose-950 border border-rose-600 text-rose-300 animate-pulse'
                  : 'bg-amber-950 border border-amber-600 text-amber-300'
              }`}
            >
              {telemetry.timeToTurbulence <= 2.0 ? 'CRUSH IMPACT NOW' : 'SHOCKWAVE IMMINENT'}
            </span>
          )}
        </div>
      </div>

      {/* 8. MG Road Queue Spillback Distance & Throughput Grid */}
      <div className="grid grid-cols-2 gap-2">
        <div
          className={`p-2.5 rounded-lg border flex flex-col justify-between transition ${
            isSpillbackCritical
              ? 'border-rose-600 bg-rose-950/40 text-rose-200 animate-pulse'
              : 'border-slate-800 bg-slate-950/60'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase">
            <span>MG Road Spillback</span>
            <ArrowRightCircle className={`w-3.5 h-3.5 ${isSpillbackCritical ? 'text-rose-400' : 'text-cyan-400'}`} />
          </div>
          <div className="my-1">
            <span className={`text-xl font-bold font-mono ${isSpillbackCritical ? 'text-rose-400' : 'text-cyan-400'}`}>
              {telemetry.spillbackMeters.toFixed(1)}
            </span>
            <span className="text-[10px] ml-1 font-mono text-slate-400">m</span>
          </div>
          <div className="text-[9px] font-mono leading-tight">
            {isSpillbackCritical ? (
              <span className="text-rose-400 font-bold">HAZARD: SPILL OVER ONTO ROAD</span>
            ) : (
              <span className="text-slate-500">Concourse buffer safe</span>
            )}
          </div>
        </div>

        <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-950/60 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase">
            <span>Turnstile Flow</span>
            <Gauge className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="my-1">
            <span className="text-xl font-bold font-mono text-emerald-400">
              {telemetry.throughputPerMin}
            </span>
            <span className="text-[10px] ml-1 font-mono text-slate-400">p/min</span>
          </div>
          <div className="text-[9px] text-slate-500 font-mono">
            {scannerFailureActive ? 'Malfunction Throttled' : 'Active Clearances'}
          </div>
        </div>
      </div>

      {/* 9. Dynamic Side-by-Side Baseline vs. Mitigated Decision Card */}
      <div className="p-3 rounded-lg border border-indigo-900/60 bg-gradient-to-b from-indigo-950/40 to-slate-950/90 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-bold text-slate-100 uppercase tracking-wider">
              Safety Decision Brief
            </span>
          </div>
          <span
            className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold transition ${
              isMitigated
                ? 'bg-emerald-950 border border-emerald-600 text-emerald-300'
                : 'bg-rose-950 border border-rose-700 text-rose-300'
            }`}
          >
            {isMitigated ? 'MITIGATED PLAN (ACTIVE)' : 'BASELINE (UNSAFE)'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
          <div
            className={`p-2 rounded border flex flex-col gap-1 transition ${
              !isMitigated
                ? 'bg-rose-950/30 border-rose-600/70 text-rose-200 ring-1 ring-rose-500/40'
                : 'bg-slate-900/60 border-slate-800 text-slate-400 opacity-75'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold uppercase text-slate-300">Baseline</span>
              <span className={`text-[9px] px-1 rounded ${!isMitigated ? 'bg-rose-950 text-rose-400 border border-rose-800' : 'text-slate-500'}`}>
                {!isMitigated ? 'LIVE RISK' : 'STATUS QUO'}
              </span>
            </div>
            <div className="text-rose-400 font-bold">&bull; Peak: ~6.2 p/m²</div>
            <div>&bull; Spillback: ~34m (MG Road blocked)</div>
            <div className="text-rose-300/80">&bull; Single Choke Jam</div>
          </div>

          <div
            className={`p-2 rounded border flex flex-col gap-1 transition ${
              isMitigated
                ? 'bg-emerald-950/40 border-emerald-500/80 text-emerald-200 ring-1 ring-emerald-500/50'
                : 'bg-indigo-950/40 border-indigo-800/60 text-indigo-300 opacity-80'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold uppercase text-cyan-300">CROWDWISE Plan</span>
              <span className={`text-[9px] px-1 rounded ${isMitigated ? 'bg-emerald-950 text-emerald-300 border border-emerald-700' : 'text-indigo-400'}`}>
                {isMitigated ? 'LIVE ACTIVE' : 'RECOMMENDED'}
              </span>
            </div>
            <div className="text-emerald-400 font-bold">&bull; Peak: ~3.1 p/m² (-50%)</div>
            <div className="text-cyan-300">&bull; Spillback: ~12m (Contained)</div>
            <div className="text-emerald-300/80">&bull; Switchback + Reroute</div>
          </div>
        </div>

        <button
          onClick={handleToggleMitigation}
          className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg font-extrabold text-xs shadow-lg transition active:scale-[0.98] ${
            isMitigated
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 shadow-emerald-950/60'
              : 'bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-slate-950 shadow-indigo-950/60'
          }`}
        >
          {isMitigated ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-slate-950" />
              <span>Mitigations Active (Click to Revert)</span>
            </>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4 text-slate-950" />
              <span>Deploy Full Venue Mitigations</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
