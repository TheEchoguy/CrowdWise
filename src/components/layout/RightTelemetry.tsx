import React from 'react';
import { useSimulationStore } from '../../state/useSimulationStore';
import { STADIUM_21_GATES } from '../../scenarios/data/stadium21GateConfig';
import {
  Activity,
  ArrowRightCircle,
  Gauge,
  AlertTriangle,
  ShieldCheck,
  Sparkles,
  ArrowUpDown,
  Layers,
  Flame,
  CheckCircle2,
  Lock,
  AlertCircle
} from 'lucide-react';

export const RightTelemetry: React.FC = () => {
  const telemetry = useSimulationStore((s) => s.telemetry);
  const bafflesActive = useSimulationStore((s) => s.bafflesActive);
  const auxGateActive = useSimulationStore((s) => s.auxGateActive);
  const opposingFlowPercent = useSimulationStore((s) => s.opposingFlowPercent);
  const runDisplacementAudit = useSimulationStore((s) => s.runDisplacementAudit);
  const selectedGateNumber = useSimulationStore((s) => s.selectedGateNumber);
  const selectedGateId = useSimulationStore((s) => s.selectedGateId);

  const activeGateDef =
    STADIUM_21_GATES.find(
      (g) => g.id === selectedGateId || g.gateNumber === selectedGateNumber
    ) || STADIUM_21_GATES[0];
  const focusedGateLive =
    telemetry.focusedGateState?.gateId === activeGateDef.id ||
    telemetry.focusedGateState?.gateNumber === activeGateDef.gateNumber
      ? telemetry.focusedGateState
      : undefined;

  const isMitigated = bafflesActive && auxGateActive;
  const zones = telemetry.threeZone;
  const counterflow = telemetry.counterflow;
  const recommendations = telemetry.safetyRecommendations;

  // System Peak Density Category
  let densityCategory = 'Safe Free Flow';
  let densityBarColor = 'bg-emerald-500';
  let densityTextColor = 'text-emerald-400';
  let densityBadgeBorder = 'border-emerald-500/30 bg-emerald-950/40';

  const peak = telemetry.peakDensity;
  if (peak >= 5.0) {
    densityCategory = 'CRITICAL CRUSH HAZARD';
    densityBarColor = 'bg-rose-500 animate-pulse';
    densityTextColor = 'text-rose-400';
    densityBadgeBorder = 'border-rose-500/80 bg-rose-950/70 animate-pulse';
  } else if (peak >= 4.5) {
    densityCategory = 'High Friction Surge';
    densityBarColor = 'bg-orange-500';
    densityTextColor = 'text-orange-400';
    densityBadgeBorder = 'border-orange-500/50 bg-orange-950/50';
  } else if (peak >= 2.5) {
    densityCategory = 'Turbulent Queue Friction';
    densityBarColor = 'bg-amber-500';
    densityTextColor = 'text-amber-400';
    densityBadgeBorder = 'border-amber-500/50 bg-amber-950/50';
  }

  const densityPercent = Math.min(100, Math.max(0, (peak / 8.0) * 100));

  return (
    <div className="flex flex-col gap-3.5 p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl backdrop-blur-md text-slate-200 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-1.5">
          <Activity className="w-4 h-4 text-cyan-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-100">
            Real-Time Telemetry
          </h2>
        </div>
        <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800">
          3-ZONE TELEMETRY
        </span>
      </div>

      {/* 1. System Maximum Local Density */}
      <div className={`p-3 rounded-lg border flex flex-col gap-2 transition ${densityBadgeBorder}`}>
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-300">
          <span>System Maximum Density</span>
          {telemetry.isCritical ? (
            <AlertTriangle className="w-4 h-4 text-rose-400 animate-bounce" />
          ) : (
            <Flame className="w-4 h-4 text-slate-400" />
          )}
        </div>

        <div className="flex items-baseline justify-between">
          <div>
            <span className={`text-3xl font-extrabold font-mono tracking-tight ${densityTextColor}`}>
              {peak.toFixed(1)}
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

        <div className="flex justify-between text-[9px] font-mono text-slate-500">
          <span>0 (Empty)</span>
          <span className="text-amber-500">2.5 (Queue)</span>
          <span className="text-rose-500 font-bold">&ge; 5.0 (Crush)</span>
        </div>
      </div>

      {/* 21-Gate Stadium Network Focused Gate Inspection */}
      <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/80 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
          <span className="flex items-center gap-1.5 font-bold text-cyan-400">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span>Gate {activeGateDef.gateNumber} Inspection</span>
          </span>
          <span
            className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${
              activeGateDef.approachGeometryStatus === 'verified'
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                : 'bg-amber-950 text-amber-300 border border-amber-800'
            }`}
          >
            {activeGateDef.approachGeometryStatus === 'verified'
              ? 'VERIFIED TWIN'
              : 'CAD BLUEPRINT PENDING'}
          </span>
        </div>

        <div className="text-[11px] font-mono leading-tight">
          <div className="font-bold text-slate-200">
            {activeGateDef.displayName}
          </div>
          <div className="text-[10px] text-slate-400 flex items-center justify-between mt-0.5">
            <span>{activeGateDef.entryRoadGroup}</span>
            <span
              className={`px-1 rounded text-[9px] font-semibold ${
                activeGateDef.publicEntryEligible
                  ? 'text-cyan-400 bg-cyan-950/50'
                  : 'text-amber-400 bg-amber-950/50'
              }`}
            >
              {activeGateDef.gateType.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Verification Status & Stands */}
        <div className="space-y-1 text-[9px] font-mono bg-slate-900/60 p-1.5 rounded border border-slate-800/60">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Mapping Status:</span>
            <span
              className={`font-semibold ${
                activeGateDef.mappingStatus === 'confirmed' ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {activeGateDef.mappingStatus === 'confirmed'
                ? `● E-REF: ${activeGateDef.externalReferenceId} (CONFIRMED)`
                : '▲ E-REF: UNRESOLVED (PENDING SURVEY)'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Stands:</span>
            <span className="text-slate-300 font-medium truncate max-w-[170px]" title={activeGateDef.connectedStandIds.join(', ')}>
              {activeGateDef.connectedStandIds.join(', ') || 'Reserved / None'}
            </span>
          </div>
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono pt-1 border-t border-slate-800/80">
          <div className="p-1.5 rounded bg-slate-900/90 border border-slate-800 flex flex-col">
            <span className="text-slate-500 text-[9px]">LIVE QUEUE</span>
            <span
              className={`text-sm font-bold ${
                (focusedGateLive?.currentQueue ?? 0) > 50 ? 'text-amber-400' : 'text-slate-200'
              }`}
            >
              {focusedGateLive?.currentQueue ?? 0}
            </span>
            <span className="text-slate-500 text-[8px]">
              Wait: {focusedGateLive ? (focusedGateLive.estimatedWaitTimeSec / 60).toFixed(1) : '0.0'}m
            </span>
          </div>

          <div className="p-1.5 rounded bg-slate-900/90 border border-slate-800 flex flex-col">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 text-[9px]">DENSITY</span>
              <span className="text-[8px] text-slate-500 font-sans">
                {activeGateDef.approachGeometryStatus === 'verified' ? 'Sensor Grid' : 'Macro Est.'}
              </span>
            </div>
            <span
              className={`text-sm font-bold ${
                focusedGateLive?.congestionState === 'critical'
                  ? 'text-rose-400'
                  : focusedGateLive?.congestionState === 'high'
                  ? 'text-orange-400'
                  : focusedGateLive?.congestionState === 'moderate'
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            >
              {(focusedGateLive?.localDensity ?? 0).toFixed(1)} p/m²
            </span>
            <span className="text-slate-500 text-[8px] uppercase">
              {focusedGateLive?.congestionState ?? 'normal'}
            </span>
          </div>
        </div>

        {/* Lanes & Admissions */}
        <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 bg-slate-900/60 px-2 py-1 rounded border border-slate-800/50">
          <span>
            Lanes: {focusedGateLive?.channels?.filter((c: any) => c.operational).length ?? activeGateDef.turnstileCount}/
            {activeGateDef.turnstileCount} ({activeGateDef.defaultLatencySec}s NFC)
          </span>
          <span className="text-emerald-400 font-bold">
            Admitted: {focusedGateLive?.totalAdmitted ?? 0}
          </span>
        </div>

        {/* Warning Callout for Unresolved Gates */}
        {activeGateDef.mappingStatus === 'unresolved_placeholder' && (
          <div className="flex items-start gap-1.5 p-1.5 rounded bg-amber-950/40 border border-amber-700/60 text-amber-300 text-[9px] font-mono">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
            <span>Pending Survey: E-ID mapping unconfirmed. Operating under calibrated macro estimate.</span>
          </div>
        )}

        {/* Info Callout for Reserved Gates */}
        {!activeGateDef.publicEntryEligible && (
          <div className="flex items-start gap-1.5 p-1.5 rounded bg-purple-950/40 border border-purple-700/60 text-purple-300 text-[9px] font-mono">
            <Lock className="w-3.5 h-3.5 text-purple-400 flex-shrink-0 mt-0.5" />
            <span>Reserved Gate: Public spectator demand is disabled ({activeGateDef.gateType.toUpperCase()} only).</span>
          </div>
        )}

        {telemetry.networkSummary && (
          <div className="text-[9px] font-mono text-slate-400 pt-1 border-t border-slate-800/60 flex items-center justify-between">
            <span>21-Gate Stadium Total:</span>
            <span className="text-cyan-400 font-semibold">
              {telemetry.networkSummary.totalAdmitted.toLocaleString()} / {telemetry.networkSummary.totalSpectators.toLocaleString()} admitted
            </span>
          </div>
        )}
      </div>

      {/* 2. Surprise Hurdle Feature A: Three-Zone Spatial Monitoring */}
      {zones && (
        <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/60 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>Three-Zone Micro Monitoring</span>
            </span>
            <span className="text-[9px] font-mono text-slate-500">NON-OVERLAPPING</span>
          </div>

          <div className="space-y-1.5 text-[11px] font-mono">
            {/* Zone 1: Gate Approach */}
            <div className="p-2 rounded bg-slate-900/80 border border-slate-800 flex items-center justify-between">
              <div>
                <div className="font-bold text-cyan-300">Zone 1: Gate Approach</div>
                <div className="text-[9px] text-slate-400">
                  Speed: {zones.gateApproach.averageSpeedMps} m/s • Queue: {zones.gateApproach.queueLengthMeters}m
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded font-bold text-xs ${
                zones.gateApproach.currentDensity >= 4.5 ? 'bg-rose-950 border border-rose-600 text-rose-300' : 'bg-slate-950 text-cyan-400'
              }`}>
                {zones.gateApproach.currentDensity} p/m²
              </span>
            </div>

            {/* Zone 2: Intermediate Holding */}
            <div className="p-2 rounded bg-slate-900/80 border border-slate-800 flex items-center justify-between">
              <div>
                <div className="font-bold text-amber-300">Zone 2: Holding Area</div>
                <div className="text-[9px] text-slate-400">
                  Waiting: {zones.intermediateHolding.waitingAgentsCount} • Delay: {zones.intermediateHolding.averageWaitingTimeSec}s
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded font-bold text-xs ${
                zones.intermediateHolding.currentDensity >= 4.5 ? 'bg-rose-950 border border-rose-600 text-rose-300' : 'bg-slate-950 text-amber-400'
              }`}>
                {zones.intermediateHolding.currentDensity} p/m²
              </span>
            </div>

            {/* Zone 3: Upstream Arrival */}
            <div className="p-2 rounded bg-slate-900/80 border border-slate-800 flex items-center justify-between">
              <div>
                <div className="font-bold text-emerald-300">Zone 3: Upstream Concourse</div>
                <div className="text-[9px] text-slate-400">
                  Spillback: {zones.upstreamArrival.spillbackMeters}m • Agents: {zones.upstreamArrival.agentCount}
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded font-bold text-xs ${
                zones.upstreamArrival.currentDensity >= 4.5 ? 'bg-rose-950 border border-rose-600 text-rose-300' : 'bg-slate-950 text-emerald-400'
              }`}>
                {zones.upstreamArrival.currentDensity} p/m²
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Surprise Hurdle Feature B: Directional Counterflow Telemetry */}
      {counterflow && opposingFlowPercent > 0 && (
        <div className="p-3 rounded-lg border border-purple-900/70 bg-purple-950/30 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-semibold text-purple-300 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-purple-400" />
              <span>Counterflow Throughput</span>
            </span>
            <span className="text-[10px] font-mono text-purple-400 font-bold">
              {counterflow.opposingFlowPercent}% OPPOSING
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
            <div className="p-1.5 rounded bg-slate-950/80 border border-purple-900/40">
              <div className="text-slate-400 font-semibold">INBOUND FLOW</div>
              <div className="text-cyan-400 text-sm font-bold">{counterflow.inboundThroughputPerMin} p/min</div>
              <div className="text-slate-500">{counterflow.averageInboundSpeedMps} m/s</div>
            </div>
            <div className="p-1.5 rounded bg-slate-950/80 border border-purple-900/40">
              <div className="text-slate-400 font-semibold">OUTBOUND FLOW</div>
              <div className="text-purple-400 text-sm font-bold">{counterflow.outboundThroughputPerMin} p/min</div>
              <div className="text-slate-500">{counterflow.averageOutboundSpeedMps} m/s</div>
            </div>
          </div>

          <div className="flex items-center justify-between p-1.5 rounded bg-slate-950/90 border border-purple-800/60 text-xs font-mono">
            <span className="text-slate-300">Effective Capacity Loss:</span>
            <span className={`font-bold ${counterflow.capacityReductionPercent >= 20 ? 'text-rose-400' : 'text-amber-400'}`}>
              -{counterflow.capacityReductionPercent}%
            </span>
          </div>

          <p className="text-[10px] text-purple-300 leading-tight">
            {counterflow.operationalRecommendation}
          </p>
        </div>
      )}

      {/* 4. Queue Spillback & Turnstile Throughput */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-950/60 flex flex-col gap-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
            <span>Spillback</span>
            <ArrowRightCircle className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-xl font-bold font-mono text-cyan-400">
            {telemetry.spillbackMeters.toFixed(1)}m
          </div>
          <div className="text-[9px] text-slate-500">Upstream concourse depth</div>
        </div>

        <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-950/60 flex flex-col gap-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
            <span>Turnstile Flow</span>
            <Gauge className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-400">
            {telemetry.throughputPerMin} p/m
          </div>
          <div className="text-[9px] text-slate-500">Observed 60s admissions</div>
        </div>
      </div>

      {/* 5. Explainable Safety Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/80 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-300 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span>Safety Recommendations</span>
            </span>
            <span className="text-[9px] font-mono text-indigo-400 bg-indigo-950 px-1.5 py-0.5 rounded border border-indigo-800">
              AI ADVISORY
            </span>
          </div>

          <div className="space-y-1.5">
            {recommendations.slice(0, 2).map((rec) => (
              <div
                key={rec.id}
                className={`p-2 rounded text-[10px] border leading-tight ${
                  rec.severity === 'critical'
                    ? 'bg-rose-950/60 border-rose-800 text-rose-200'
                    : rec.severity === 'warning'
                    ? 'bg-amber-950/60 border-amber-800 text-amber-200'
                    : rec.severity === 'optimal'
                    ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
                    : 'bg-slate-900 border-slate-800 text-slate-300'
                }`}
              >
                <div className="font-bold">{rec.title}</div>
                <div className="text-[9px] opacity-80 mt-0.5">{rec.actionText}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. Displacement Audit CTA */}
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

        <button
          onClick={runDisplacementAudit}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-slate-950 font-extrabold text-xs shadow-lg shadow-indigo-950/60 transition"
        >
          <CheckCircle2 className="w-4 h-4 text-slate-950" />
          <span>View Displacement Audit Report</span>
        </button>
      </div>
    </div>
  );
};
