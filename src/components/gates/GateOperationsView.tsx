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
  Power,
  Users,
  Activity,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react';
import { useSimulationStore } from '../../store/simulationStore';
import { Gate, StadiumSide } from '../../types';

export const GateOperationsView: React.FC = () => {
  const {
    currentVenue,
    updateGate,
    toggleCounter,
    setCounterServiceRate,
    setGateOperationalControlState,
    recommendations,
    approveRecommendation,
    setSelectedGateId,
    setActiveTab,
  } = useSimulationStore();

  const [filter, setFilter] = useState<'ALL' | 'NORTH' | 'EAST' | 'SOUTH' | 'WEST' | 'CONGESTED' | 'FAILED'>('ALL');

  const filteredGates = currentVenue.gates.filter((g) => {
    if (filter === 'NORTH') return g.stadiumSide === 'NORTH';
    if (filter === 'EAST') return g.stadiumSide === 'EAST';
    if (filter === 'SOUTH') return g.stadiumSide === 'SOUTH';
    if (filter === 'WEST') return g.stadiumSide === 'WEST';
    if (filter === 'CONGESTED') {
      return (
        g.warningLevel === 'HIGH' ||
        g.warningLevel === 'CRITICAL' ||
        g.operationalControlState === 'CONGESTED'
      );
    }
    if (filter === 'FAILED') {
      return (
        g.status === 'SCANNER_FAILURE' ||
        g.status === 'TEMPORARILY_CLOSED' ||
        g.operationalControlState === 'ADMISSION_PAUSED' ||
        (g.counters && g.counters.some((c) => c.status === 'FAILED'))
      );
    }
    return true;
  });

  const totalAssigned = currentVenue.gates.reduce((sum, g) => sum + (g.assignedSpectatorCount || 4000), 0);
  const totalAdmitted = currentVenue.gates.reduce((sum, g) => sum + (g.admittedCount || g.totalProcessedCount || 0), 0);
  const totalHolding = currentVenue.gates.reduce((sum, g) => sum + (g.inHoldingCount || 0), 0);
  const totalQueue = currentVenue.gates.reduce((sum, g) => sum + g.currentQueue, 0);
  const totalCountersCount = currentVenue.gates.reduce(
    (sum, g) => sum + (g.counters ? g.counters.length : g.scannerCount),
    0
  );
  const operationalCountersCount = currentVenue.gates.reduce(
    (sum, g) =>
      sum + (g.counters ? g.counters.filter((c) => c.status === 'OPERATIONAL').length : g.operationalScanners),
    0
  );
  const totalProcessingRate = currentVenue.gates.reduce(
    (sum, g) => sum + (g.effectiveCapacityPerMin || (g.operationalScanners * 60)),
    0
  );

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-navy-700 pb-4">
        <div>
          <h2 className="text-xl font-black text-slate-100 flex items-center gap-2">
            <DoorOpen className="w-5 h-5 text-cyan-400" />
            12-Gate Ticket Operations &amp; Scanner Control
          </h2>
          <p className="text-xs text-slate-400">
            Strict ticket-restricted crowd management: 12 gates (3 per side), 3 independently modelled scanners per entrance, and dedicated holding areas.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 bg-navy-850 p-1 rounded-xl border border-navy-700 text-xs">
          {(
            [
              { id: 'ALL', label: `All (12)` },
              { id: 'NORTH', label: 'North (3)' },
              { id: 'EAST', label: 'East (3)' },
              { id: 'SOUTH', label: 'South (3)' },
              { id: 'WEST', label: 'West (3)' },
              { id: 'CONGESTED', label: 'Congested' },
              { id: 'FAILED', label: 'Scanner Fault' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              onClick={() => setFilter(item.id)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                filter === item.id
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* OVERALL VENUE POPULATION & THROUGHPUT TELEMETRY BANNER */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 bg-navy-850 p-4 rounded-2xl border border-navy-700 shadow-md text-xs">
        <div className="bg-navy-900/80 p-3 rounded-xl border border-blue-500/40">
          <span className="text-[10px] text-blue-400 font-bold block uppercase tracking-wider">Total Ticket Quota</span>
          <span className="font-mono text-xl font-extrabold text-white">
            {totalAssigned.toLocaleString()}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">40,000 reg + 500 VIP</span>
        </div>

        <div className="bg-navy-900/80 p-3 rounded-xl border border-emerald-500/40">
          <span className="text-[10px] text-emerald-400 font-bold block uppercase tracking-wider">Total Admitted</span>
          <span className="font-mono text-xl font-extrabold text-white">
            {totalAdmitted.toLocaleString()}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">successfully entered</span>
        </div>

        <div className="bg-navy-900/80 p-3 rounded-xl border border-amber-500/40">
          <span className="text-[10px] text-amber-400 font-bold block uppercase tracking-wider">In Holding Pens</span>
          <span className="font-mono text-xl font-extrabold text-amber-300">
            {totalHolding.toLocaleString()}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">staged outside gates</span>
        </div>

        <div className="bg-navy-900/80 p-3 rounded-xl border border-rose-500/40">
          <span className="text-[10px] text-rose-400 font-bold block uppercase tracking-wider">Turnstile Queues</span>
          <span className="font-mono text-xl font-extrabold text-white">
            {totalQueue.toLocaleString()}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">waiting in line</span>
        </div>

        <div className="bg-navy-900/80 p-3 rounded-xl border border-cyan-500/40">
          <span className="text-[10px] text-cyan-400 font-bold block uppercase tracking-wider">Active Scanners</span>
          <span className="font-mono text-xl font-extrabold text-slate-100">
            {operationalCountersCount} / {totalCountersCount}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">turnstile counters</span>
        </div>

        <div className="bg-navy-900/80 p-3 rounded-xl border border-navy-750">
          <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Venue Capacity</span>
          <span className="font-mono text-xl font-extrabold text-emerald-400">
            {totalProcessingRate.toLocaleString()}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">people / minute</span>
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
                  Active Operator Recommendations (Downstream &amp; Ticket Aware)
                </h3>
                <p className="text-xs text-slate-400">
                  Ensures ticket compliance while managing downstream concourse bottlenecks.
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
                      Approve Action
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 12 GATES COMPREHENSIVE STATUS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredGates.map((g) => {
          const isCritical = g.warningLevel === 'CRITICAL';
          const isHigh = g.warningLevel === 'HIGH';

          const sideColor =
            g.stadiumSide === 'NORTH'
              ? 'bg-blue-950 text-blue-300 border-blue-800'
              : g.stadiumSide === 'EAST'
                ? 'bg-amber-950 text-amber-300 border-amber-800'
                : g.stadiumSide === 'SOUTH'
                  ? 'bg-purple-950 text-purple-300 border-purple-800'
                  : 'bg-indigo-950 text-indigo-300 border-indigo-800';

          const stateColor =
            g.operationalControlState === 'ADMISSION_PAUSED' || g.direction === 'CLOSED'
              ? 'bg-rose-950 text-rose-300 border-rose-700'
              : g.operationalControlState === 'CONGESTED'
                ? 'bg-red-950 text-red-300 border-red-700'
                : g.operationalControlState === 'ADMISSION_METERING'
                  ? 'bg-cyan-950 text-cyan-300 border-cyan-700'
                  : g.operationalControlState === 'QUEUE_BUILDING'
                    ? 'bg-amber-950 text-amber-300 border-amber-700'
                    : 'bg-emerald-950 text-emerald-300 border-emerald-700';

          const assigned = g.assignedSpectatorCount || (g.gateType === 'VIP' ? 500 : (g.gateType === 'EXIT_ONLY' ? 0 : 4000));
          const arrived = g.totalArrivalsCount || 0;
          const remaining = Math.max(0, assigned - arrived);
          const admitted = g.admittedCount || g.totalProcessedCount || 0;
          const holding = g.inHoldingCount || 0;

          return (
            <div
              key={g.id}
              className={`bg-navy-850 rounded-2xl p-4 border transition-all shadow-md space-y-3.5 ${
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
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${sideColor}`}>
                      {g.stadiumSide}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-navy-900 text-slate-300 border border-navy-700">
                      {g.gateType || 'REGULAR'}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Quota: {assigned.toLocaleString()} spectators | Width: {g.width}m
                  </span>
                </div>

                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${stateColor}`}>
                  {g.operationalControlState || 'NORMAL'}
                </span>
              </div>

              {/* 3 INDEPENDENT SCANNER COUNTERS SECTION */}
              <div className="space-y-2 bg-navy-900/60 p-2.5 rounded-xl border border-navy-800">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-300 font-bold flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                    Turnstile Scanners ({g.operationalScanners} / {g.scannerCount} Active)
                  </span>
                  <span className="font-mono text-cyan-300 font-bold text-[10px]">
                    {g.effectiveCapacityPerMin || (g.operationalScanners * 60)} ppl/min
                  </span>
                </div>

                {g.counters && g.counters.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                    {g.counters.map((c, idx) => {
                      const isOp = c.status === 'OPERATIONAL';
                      return (
                        <div
                          key={c.id}
                          className={`p-2 rounded-lg border text-[11px] flex flex-col justify-between transition ${
                            isOp
                              ? 'bg-navy-950/80 border-emerald-700/50'
                              : 'bg-red-950/40 border-red-800/60'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-200 text-[10px]">{c.name}</span>
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isOp ? 'bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-red-400 shadow-sm shadow-red-400'
                              }`}
                            />
                          </div>

                          <div className="my-1 text-[10px] font-mono text-slate-400">
                            <div>{isOp ? `${c.serviceRatePerSec.toFixed(1)}/s (${Math.round(c.serviceRatePerSec * 60)}/m)` : 'OFFLINE'}</div>
                            <div className="text-emerald-400 font-semibold">{c.totalProcessedCount || 0} in</div>
                          </div>

                          <button
                            onClick={() => toggleCounter(g.id, c.id)}
                            className={`w-full py-1 rounded text-[10px] font-bold transition flex items-center justify-center gap-1 ${
                              isOp
                                ? 'bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-300'
                                : 'bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800 text-emerald-300'
                            }`}
                          >
                            <Power className="w-2.5 h-2.5" />
                            {isOp ? 'Fail' : 'Restore'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400 italic">No entry scanners assigned (Exit-only portal).</div>
                )}
              </div>

              {/* EXACT POPULATION ACCOUNTING TALLY */}
              <div className="space-y-1 text-xs bg-navy-900/50 p-2.5 rounded-xl border border-navy-800">
                <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider mb-1">
                  Ticket-Restricted Population Balance
                </span>

                <div className="grid grid-cols-3 gap-1.5 text-[11px] font-mono">
                  <div className="bg-navy-950 p-1.5 rounded border border-navy-800">
                    <span className="text-[9px] text-slate-400 block">Remaining</span>
                    <span className="font-bold text-slate-200">{remaining.toLocaleString()}</span>
                  </div>
                  <div className="bg-navy-950 p-1.5 rounded border border-navy-800">
                    <span className="text-[9px] text-amber-400 block">In Holding</span>
                    <span className="font-bold text-amber-300">{holding} / {g.holdingAreaCapacity || 500}</span>
                  </div>
                  <div className="bg-navy-950 p-1.5 rounded border border-navy-800">
                    <span className="text-[9px] text-rose-400 block">In Queue</span>
                    <span className="font-bold text-slate-100">{g.currentQueue} ppl</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 text-[11px]">
                  <span className="text-slate-400">Total Admitted:</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {admitted.toLocaleString()} spectators
                  </span>
                </div>
              </div>

              {/* TACTICAL ACTION BUTTONS */}
              <div className="grid grid-cols-3 gap-1.5 pt-1 text-[11px]">
                <button
                  onClick={() => {
                    const isPaused = g.operationalControlState === 'ADMISSION_PAUSED';
                    setGateOperationalControlState(g.id, isPaused ? 'NORMAL' : 'ADMISSION_PAUSED');
                  }}
                  className={`py-1.5 px-2 rounded-lg font-bold transition flex items-center justify-center gap-1 border ${
                    g.operationalControlState === 'ADMISSION_PAUSED'
                      ? 'bg-emerald-950/80 hover:bg-emerald-900 border-emerald-700 text-emerald-300'
                      : 'bg-navy-800 hover:bg-navy-700 border-navy-700 text-rose-300'
                  }`}
                >
                  {g.operationalControlState === 'ADMISSION_PAUSED' ? (
                    <>
                      <Play className="w-3 h-3" />
                      Resume
                    </>
                  ) : (
                    <>
                      <Pause className="w-3 h-3" />
                      Pause
                    </>
                  )}
                </button>

                <button
                  onClick={() => {
                    if (g.counters) {
                      const updated = g.counters.map((c) => ({ ...c, status: 'OPERATIONAL' as const }));
                      updateGate(g.id, {
                        counters: updated,
                        operationalScanners: updated.length,
                        status: 'OPERATIONAL',
                        operationalControlState: 'NORMAL',
                        warningLevel: 'NORMAL',
                        direction: 'ENTRY',
                      });
                    }
                  }}
                  className="py-1.5 px-2 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-700/60 font-bold text-emerald-300 transition text-center"
                >
                  Restore 3
                </button>

                <button
                  onClick={() => {
                    setSelectedGateId(g.id);
                    setActiveTab('digital-twin');
                  }}
                  className="py-1.5 px-2 rounded-lg bg-navy-800 hover:bg-navy-700 border border-navy-600 font-bold text-slate-300 transition text-center"
                >
                  2D Map
                </button>

                <button
                  onClick={() => {
                    setSelectedGateId(g.id);
                    setActiveTab('gate-detail');
                  }}
                  className="py-1.5 px-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 font-bold text-white transition text-center shadow-sm"
                >
                  3D Sim →
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
