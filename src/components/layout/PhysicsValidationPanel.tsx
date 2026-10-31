/**
 * CROWDWISE — Physics Credibility & Safety Verification Panel
 * Stage F: Interactive Physics Credibility, Empirical Validation & Spatial Displacement Deck
 */

import React, { useState } from 'react';
import {
  PhysicsValidationEngine
} from '../../physics-validation/engine/PhysicsValidationEngine';
import {
  SpatialZoneId,
  PhysicsValidationMasterReport
} from '../../physics-validation/types/PhysicsValidationTypes';
import {
  Activity,
  AlertTriangle,
  Flame,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Compass,
  FileCheck2,
  Scale
} from 'lucide-react';

export const PhysicsValidationPanel: React.FC = () => {
  const [report, setReport] = useState<PhysicsValidationMasterReport>(() =>
    PhysicsValidationEngine.executeFullValidation(42)
  );
  const [selectedZone, setSelectedZone] = useState<SpatialZoneId>('ZONE_4_THROAT');
  const [isRunning, setIsRunning] = useState<boolean>(false);

  const handleRerun = () => {
    setIsRunning(true);
    setTimeout(() => {
      const newReport = PhysicsValidationEngine.executeFullValidation(Date.now() % 1000);
      setReport(newReport);
      setIsRunning(false);
    }, 150);
  };

  const status = report.overallStatus;
  const statusBadge =
    status === 'VALIDATED_AGAINST_REFERENCE'
      ? {
          text: 'VALIDATED AGAINST REFERENCE',
          bg: 'bg-emerald-950/80',
          border: 'border-emerald-600',
          textCol: 'text-emerald-300',
          icon: CheckCircle2
        }
      : status === 'PARTIALLY_VALIDATED'
      ? {
          text: 'PARTIALLY VALIDATED',
          bg: 'bg-amber-950/80',
          border: 'border-amber-600',
          textCol: 'text-amber-300',
          icon: AlertTriangle
        }
      : {
          text: 'NOT VALIDATED',
          bg: 'bg-rose-950/80',
          border: 'border-rose-600',
          textCol: 'text-rose-300',
          icon: XCircle
        };

  const StatusIcon = statusBadge.icon;
  const disp = report.spatialDisplacement;
  const fd = report.fundamentalDiagram;
  const cf = report.counterFlow;
  const qd = report.queueDischarge;

  const currentZoneMetric = disp.zoneComparisons[selectedZone];

  const zoneTabs: { id: SpatialZoneId; label: string }[] = [
    { id: 'ZONE_1_PUBLIC_ROAD', label: 'Z1: Road' },
    { id: 'ZONE_2_HOLDING_AREA', label: 'Z2: Holding' },
    { id: 'ZONE_3_QUEUE_CONCOURSE', label: 'Z3: Concourse' },
    { id: 'ZONE_4_THROAT', label: 'Z4: Throat' },
    { id: 'ZONE_5_DOWNSTREAM_STAND', label: 'Z5: Stand' }
  ];

  return (
    <div className="flex flex-col gap-3 p-3 bg-slate-900/90 border border-slate-800 rounded-xl backdrop-blur-md text-slate-200 h-full overflow-y-auto font-mono select-none">
      {/* 1. Header & Re-run Trigger */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-1.5">
          <Scale className="w-4 h-4 text-cyan-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-100">
            Physics Credibility Deck
          </h2>
        </div>
        <button
          onClick={handleRerun}
          disabled={isRunning}
          className="flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-700/80 hover:bg-cyan-900 text-cyan-300 text-[10px] font-bold transition"
          title="Re-run Controlled Physics Validation Suite"
        >
          <RefreshCw className={`w-3 h-3 ${isRunning ? 'animate-spin' : ''}`} />
          <span>Re-verify</span>
        </button>
      </div>

      {/* 2. Master Validation Status Banner */}
      <div
        className={`p-2.5 rounded-lg border ${statusBadge.border} ${statusBadge.bg} flex flex-col gap-1.5 transition-all`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <StatusIcon className={`w-4 h-4 ${statusBadge.textCol}`} />
            <span className={`text-[11px] font-bold tracking-wide uppercase ${statusBadge.textCol}`}>
              {statusBadge.text}
            </span>
          </div>
          <span className="text-[9px] text-slate-400 font-mono">
            {new Date(report.timestamp).toLocaleTimeString()}
          </span>
        </div>
        <p className="text-[10px] text-slate-300 leading-tight">
          Validated against Weidmann (1993) speed-density decay & Schadschneider & Seyfried (2011) bottleneck discharge.
        </p>
      </div>

      {/* 3. Final Safety Verdict & Permit Card */}
      <div
        className={`p-2.5 rounded-lg border ${
          disp.verdict === 'IMPROVED'
            ? 'border-emerald-600 bg-emerald-950/40 text-emerald-200'
            : disp.verdict === 'DISPLACED'
            ? 'border-amber-600 bg-amber-950/40 text-amber-200'
            : disp.verdict === 'DETERIORATED'
            ? 'border-rose-600 bg-rose-950/40 text-rose-200'
            : 'border-slate-700 bg-slate-950/60 text-slate-300'
        } flex flex-col gap-1.5`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <FileCheck2 className="w-3.5 h-3.5 text-indigo-400" />
            Safety Verdict
          </span>
          <span
            className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase ${
              disp.verdict === 'IMPROVED'
                ? 'bg-emerald-900 border-emerald-500 text-emerald-300'
                : disp.verdict === 'DISPLACED'
                ? 'bg-amber-900 border-amber-500 text-amber-300 animate-pulse'
                : disp.verdict === 'DETERIORATED'
                ? 'bg-rose-900 border-rose-500 text-rose-300'
                : 'bg-slate-800 border-slate-700 text-slate-300'
            }`}
          >
            {disp.verdict}
          </span>
        </div>
        <div className="text-[10px] text-slate-300 bg-slate-950/80 p-2 rounded border border-slate-800">
          <p className="font-bold text-slate-200 mb-0.5">{disp.permitOfficerRecommendation}</p>
          <p className="text-slate-400 text-[9px] leading-snug">{disp.rationale}</p>
        </div>
      </div>

      {/* 4. Spatial Risk Displacement (Before / After Paired Run) */}
      <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-950/60 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
            <Flame className="w-3 h-3 text-amber-400" />
            Spatial Risk Displacement
          </span>
          {disp.isDisplacementDetected ? (
            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-rose-950 border border-rose-700 text-rose-300 animate-pulse">
              DISPLACEMENT DETECTED
            </span>
          ) : (
            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-300">
              ZERO DISPLACEMENT
            </span>
          )}
        </div>

        {/* 5-Zone Navigation Tabs */}
        <div className="grid grid-cols-5 gap-1 p-0.5 rounded bg-slate-900 border border-slate-800">
          {zoneTabs.map((z) => (
            <button
              key={z.id}
              onClick={() => setSelectedZone(z.id)}
              className={`text-[9px] py-1 text-center font-bold rounded transition ${
                selectedZone === z.id
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {z.label}
            </button>
          ))}
        </div>

        {/* Selected Zone Deep Dive */}
        {currentZoneMetric && (
          <div className="p-2 rounded bg-slate-900/90 border border-slate-800 flex flex-col gap-1.5 text-[9px]">
            <div className="flex items-center justify-between font-bold text-slate-200 border-b border-slate-800 pb-1">
              <span>{currentZoneMetric.zoneName}</span>
              <span
                className={
                  currentZoneMetric.deltaDensity > 0
                    ? 'text-rose-400'
                    : currentZoneMetric.deltaDensity < 0
                    ? 'text-emerald-400'
                    : 'text-slate-400'
                }
              >
                Δρ: {currentZoneMetric.deltaDensity > 0 ? '+' : ''}
                {currentZoneMetric.deltaDensity} p/m²
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-slate-400">
              <div>
                <span>Baseline Density:</span>{' '}
                <strong className="text-slate-200">{currentZoneMetric.baselineDensity} p/m²</strong>
              </div>
              <div>
                <span>Mitigated Density:</span>{' '}
                <strong className="text-slate-200">{currentZoneMetric.interventionDensity} p/m²</strong>
              </div>
              <div>
                <span>Queue Delta:</span>{' '}
                <strong
                  className={
                    currentZoneMetric.deltaQueue > 0
                      ? 'text-rose-400'
                      : currentZoneMetric.deltaQueue < 0
                      ? 'text-emerald-400'
                      : 'text-slate-200'
                  }
                >
                  {currentZoneMetric.deltaQueue > 0 ? '+' : ''}
                  {currentZoneMetric.deltaQueue} agents
                </strong>
              </div>
              <div>
                <span>Hazard Time Delta:</span>{' '}
                <strong className="text-slate-200">{currentZoneMetric.deltaHazardDurationSec}s</strong>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. Fundamental Diagram Empirical Metrics */}
      <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-950/60 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
            <Activity className="w-3 h-3 text-cyan-400" />
            Fundamental Diagram: J(ρ) = ρ × v(ρ)
          </span>
          <span className="text-[8px] font-bold text-cyan-400">Weidmann (1993)</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[10px] bg-slate-900/80 p-2 rounded border border-slate-800">
          <div>
            <span className="text-slate-400 block text-[9px]">Mean Velocity Error:</span>
            <span className="font-bold text-slate-100">{fd.meanVelocityError} m/s</span>
            <span className="text-[8px] text-emerald-400 block">(&lt; 0.18 m/s threshold)</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[9px]">Flow Curve RMSE:</span>
            <span className="font-bold text-slate-100">{fd.densityFlowCurveDeviation} p/(m*s)</span>
            <span className="text-[8px] text-emerald-400 block">(&lt; 0.35 threshold)</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[9px]">Max Observed Flow:</span>
            <span className="font-bold text-slate-100">{fd.maxObservedFlow} p/(m*s)</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[9px]">Density at Max Flow:</span>
            <span className="font-bold text-slate-100">{fd.densityAtMaxFlow} p/m²</span>
          </div>
        </div>
      </div>

      {/* 6. Bidirectional Counter-Flow & Lane Formation */}
      <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-950/60 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
            <Compass className="w-3 h-3 text-purple-400" />
            Counter-Flow & Lane Formation
          </span>
          <span className="text-[8px] font-bold text-purple-400">Feliciani (2016)</span>
        </div>

        <div className="flex flex-col gap-1.5 text-[9px] bg-slate-900/80 p-2 rounded border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Forward Only (100%):</span>
            <strong className="text-slate-200">{cf.forwardOnly.netThroughputPerMin} p/min</strong>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">75% Forward / 25% Reverse:</span>
            <strong className="text-slate-200">
              {cf.seventyFiveTwentyFive.netThroughputPerMin} p/min (Phi: {cf.seventyFiveTwentyFive.laneFormationOrderParameter})
            </strong>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">50% Forward / 50% Reverse:</span>
            <strong className="text-rose-300">
              {cf.fiftyFifty.netThroughputPerMin} p/min (-{cf.fiftyFifty.capacityReductionPercent}% Emergent Loss)
            </strong>
          </div>
          <div className="flex items-center justify-between border-t border-slate-800 pt-1 text-[8px] text-slate-400">
            <span>Lane Formation Order:</span>
            <strong className="text-emerald-400">Natural segregation emerges</strong>
          </div>
        </div>
      </div>

      {/* 7. Bottleneck Discharge Capacity */}
      <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-950/60 flex flex-col gap-1 text-[9px]">
        <div className="flex items-center justify-between mb-1">
          <span className="font-bold uppercase text-slate-400">Bottleneck Discharge</span>
          <span className="text-[8px] text-slate-400">Schadschneider (2011)</span>
        </div>
        <div className="flex items-center justify-between text-slate-300">
          <span>Specific Discharge Capacity:</span>
          <strong className="text-slate-100">{qd.specificDischargeCapacity} p/(m*s)</strong>
        </div>
        <div className="flex items-center justify-between text-slate-300">
          <span>Discharge Flow Rate:</span>
          <strong className="text-slate-100">{qd.observedDischargeRate} p/s</strong>
        </div>
      </div>
    </div>
  );
};
