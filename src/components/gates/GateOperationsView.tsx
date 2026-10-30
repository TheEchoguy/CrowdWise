import React, { useState } from 'react';
import {
  DoorOpen,
  ShieldCheck,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Wrench,
  Sliders,
  ArrowRight,
  TrendingDown,
  Layers,
  Sparkles,
  Check,
} from 'lucide-react';
import { useSimulationStore } from '../../store/simulationStore';
import { Gate } from '../../types';

export const GateOperationsView: React.FC = () => {
  const {
    currentVenue,
    updateGate,
    recommendations,
    approveRecommendation,
    setSelectedGateId,
    setActiveTab,
  } = useSimulationStore();

  const [filter, setFilter] = useState<'ALL' | 'CONGESTED' | 'OPERATIONAL' | 'FAILED'>('ALL');

  const filteredGates = currentVenue.gates.filter((g) => {
    if (filter === 'CONGESTED') return g.warningLevel === 'HIGH' || g.warningLevel === 'CRITICAL';
    if (filter === 'OPERATIONAL') return g.status === 'OPERATIONAL';
    if (filter === 'FAILED') return g.status === 'SCANNER_FAILURE' || g.status === 'TEMPORARILY_CLOSED';
    return true;
  });

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-navy-700 pb-4">
        <div>
          <h2 className="text-xl font-black text-slate-100 flex items-center gap-2">
            <DoorOpen className="w-5 h-5 text-cyan-400" />
            Gate Operations &amp; Turnstile Throughput Control
          </h2>
          <p className="text-xs text-slate-400">
            Monitor real-time entrance queues, scanner lane status, downstream corridor capacities, and route-aware recommendations.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-navy-850 p-1 rounded-xl border border-navy-700 text-xs">
          {(['ALL', 'CONGESTED', 'OPERATIONAL', 'FAILED'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                filter === f
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {f === 'ALL'
                ? `All (${currentVenue.gates.length})`
                : f === 'CONGESTED'
                  ? 'Congested'
                  : f === 'OPERATIONAL'
                    ? 'Operational'
                    : 'Fault / Closed'}
            </button>
          ))}
        </div>
      </div>

      {/* DYNAMIC ROUTE-AWARE RECOMMENDATION ENGINE PANEL */}
      {recommendations.length > 0 && (
        <div className="bg-gradient-to-r from-navy-850 via-cyan-950/40 to-navy-850 border border-cyan-500/40 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-navy-700 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-cyan-400 animate-pulse" />
              <div>
                <h3 className="font-bold text-slate-100 text-sm">
                  Active Operator Recommendations (Route &amp; Corridor Aware)
                </h3>
                <p className="text-xs text-slate-400">
                  Evaluated downstream concourse capacities to ensure problem is not transferred elsewhere.
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-cyan-950 text-cyan-300 border border-cyan-800">
              {recommendations.filter((r) => !r.approved).length} Pending Action
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recommendations.slice(0, 4).map((rec) => (
              <div
                key={rec.id}
                className="bg-navy-900/90 border border-navy-700 rounded-xl p-4 text-xs space-y-2.5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-100 text-sm">{rec.title}</span>
                    <span className="font-mono text-[10px] text-cyan-400 px-2 py-0.5 rounded bg-navy-950 border border-navy-800">
                      Loc: {rec.location}
                    </span>
                  </div>

                  <div className="space-y-1 text-slate-300 mt-2">
                    <p>
                      <strong className="text-red-400">Issue:</strong> {rec.problem}
                    </p>
                    <p>
                      <strong className="text-cyan-400">Proposed Action:</strong> {rec.proposedAction}
                    </p>
                    <p className="text-amber-300/90 text-[11px] bg-amber-950/30 p-2 rounded border border-amber-900/50 mt-1">
                      <strong>Side-effect Check:</strong> {rec.possibleSideEffects}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-navy-800 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">Requires human operator sign-off</span>

                  {rec.approved ? (
                    <span className="flex items-center gap-1 text-emerald-400 font-bold">
                      <Check className="w-4 h-4" />
                      Approved &amp; Deployed
                    </span>
                  ) : (
                    <button
                      onClick={() => approveRecommendation(rec.id)}
                      className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 font-bold text-white transition flex items-center gap-1.5 shadow-md shadow-cyan-900/40"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Approve &amp; Divert Crowd
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 21 GATES COMPREHENSIVE STATUS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredGates.map((g) => {
          const isCritical = g.warningLevel === 'CRITICAL';
          const isHigh = g.warningLevel === 'HIGH';
          const maxCapacity = g.scannerCount * g.scannerProcessingRatePerMin;
          const currentThroughput = g.operationalScanners * g.scannerProcessingRatePerMin;

          return (
            <div
              key={g.id}
              className={`bg-navy-850 rounded-2xl p-4 border transition-all shadow-md space-y-3 ${
                isCritical
                  ? 'border-red-600/80 shadow-red-950/20'
                  : isHigh
                    ? 'border-amber-600/70 shadow-amber-950/20'
                    : 'border-navy-700'
              }`}
            >
              {/* Gate Header */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-100 text-base">{g.name}</h3>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-navy-900 text-slate-400 border border-navy-700">
                      {g.width}m width
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">Direction: {g.direction}</span>
                </div>

                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    g.status === 'OPERATIONAL'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                      : isCritical
                        ? 'bg-red-950 text-red-300 border border-red-700 animate-pulse'
                        : 'bg-amber-950 text-amber-300 border border-amber-700'
                  }`}
                >
                  {g.status}
                </span>
              </div>

              {/* Real-time Metrics Card */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-navy-900/80 p-2 rounded-xl border border-navy-750">
                  <span className="text-[10px] text-slate-400 block">Queue Length</span>
                  <span className="font-mono text-base font-bold text-slate-100">
                    {g.currentQueue}{' '}
                    <span className="text-[11px] font-normal text-slate-400">ppl</span>
                  </span>
                </div>

                <div className="bg-navy-900/80 p-2 rounded-xl border border-navy-750">
                  <span className="text-[10px] text-slate-400 block">Queue Wait Time</span>
                  <span
                    className={`font-mono text-base font-bold ${
                      g.queueWaitTimeSecs > 600 ? 'text-amber-400' : 'text-cyan-400'
                    }`}
                  >
                    ~{Math.round(g.queueWaitTimeSecs / 60)}{' '}
                    <span className="text-[11px] font-normal text-slate-400">mins</span>
                  </span>
                </div>
              </div>

              {/* Hardware Throughput & Scanners */}
              <div className="space-y-1.5 text-xs bg-navy-900/50 p-2.5 rounded-xl border border-navy-800">
                <div className="flex justify-between">
                  <span className="text-slate-400">Active Scanners:</span>
                  <span className="font-mono font-bold text-slate-200">
                    {g.operationalScanners} / {g.scannerCount} lanes
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-400">Effective Throughput:</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {currentThroughput} <span className="font-normal text-[10px]">p/min</span>
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-400">Downstream Corridor:</span>
                  <span className="text-[11px] font-semibold text-cyan-300">Clear &amp; Accessible</span>
                </div>
              </div>

              {/* Interactive Tactical Controls */}
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <button
                  onClick={() =>
                    updateGate(g.id, {
                      operationalScanners: g.operationalScanners > 1 ? 1 : g.scannerCount,
                      status: g.operationalScanners > 1 ? 'SCANNER_FAILURE' : 'OPERATIONAL',
                      warningLevel: g.operationalScanners > 1 ? 'HIGH' : 'NORMAL',
                    })
                  }
                  className="py-1.5 px-2 rounded-lg bg-navy-800 hover:bg-navy-700 border border-navy-700 text-[11px] font-semibold text-slate-300 transition text-center"
                >
                  {g.status === 'SCANNER_FAILURE' ? 'Fix Scanners' : 'Simulate Fault'}
                </button>

                <button
                  onClick={() => {
                    setSelectedGateId(g.id);
                    setActiveTab('digital-twin');
                  }}
                  className="py-1.5 px-2 rounded-lg bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-700/50 text-[11px] font-semibold text-cyan-300 transition text-center"
                >
                  View on Map
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

