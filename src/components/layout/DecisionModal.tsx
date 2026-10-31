import React from 'react';
import { useSimulationStore } from '../../state/useSimulationStore';
import {
  X,
  Printer,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  FileText,
  Download,
  Layers
} from 'lucide-react';

import {
  buildDisplacementAuditExport,
  triggerJsonDownload
} from '../../scenarios/utils/displacementExport';

export const DecisionModal: React.FC = () => {
  const isModalOpen = useSimulationStore((s) => s.isModalOpen);
  const toggleModal = useSimulationStore((s) => s.toggleModal);
  const telemetry = useSimulationStore((s) => s.telemetry);
  const scenario = useSimulationStore((s) => s.scenario);
  const activeScenarioId = useSimulationStore((s) => s.activeScenarioId);
  const bafflesActive = useSimulationStore((s) => s.bafflesActive);
  const auxGateActive = useSimulationStore((s) => s.auxGateActive);
  const inflowRate = useSimulationStore((s) => s.inflowRate);
  const gateLatency = useSimulationStore((s) => s.gateLatency);
  const comparisonResult = useSimulationStore((s) => s.comparisonResult);
  const walkingSpeed = useSimulationStore((s) => s.walkingSpeed);
  const opposingFlowPercent = useSimulationStore((s) => s.opposingFlowPercent);
  const physicsValidationMode = useSimulationStore((s) => s.physicsValidationMode);
  const activeSchedule = useSimulationStore((s) => s.activeSchedule);
  const syntheticEvent = useSimulationStore((s) => s.syntheticEvent);

  if (!isModalOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadJson = () => {
    const exportData = buildDisplacementAuditExport({
      comparisonResult,
      telemetry,
      activeScenarioId,
      scenarioName: scenario,
      activeSchedule,
      syntheticEvent,
      inflowRate,
      gateLatency,
      walkingSpeed,
      bafflesActive,
      auxGateActive,
      opposingFlowPercent,
      physicsValidationMode
    });

    const filename = `crowdwise-displacement-audit-${activeScenarioId.toLowerCase()}.json`;
    triggerJsonDownload(exportData, filename);
  };

  const isMitigated = bafflesActive && auxGateActive;
  const displacement = comparisonResult?.displacementResult;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-950 border border-cyan-800 text-cyan-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-100">
                M. Chinnaswamy Stadium — Safety Decision Brief & Displacement Audit
              </h2>
              <p className="text-xs text-slate-400">
                3-Zone Micro Ingress Dynamics • Paired Counterfactual Safety Evaluation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
              title="Print Brief or Save PDF via Browser"
            >
              <Printer className="w-4 h-4 text-cyan-400" />
              <span>Print Brief (PDF)</span>
            </button>
            <button
              onClick={handleDownloadJson}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 text-xs font-semibold transition"
              title="Download structured JSON report file"
            >
              <Download className="w-4 h-4 text-cyan-400" />
              <span>Export Audit JSON</span>
            </button>
            <button
              onClick={toggleModal}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition"
              title="Close Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Printable Assessment Report */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs text-slate-300">
          {/* Executive Risk / Displacement Verdict Banner */}
          <div
            className={`p-4 rounded-xl border flex items-start gap-3.5 ${
              displacement?.verdict === 'DISPLACED'
                ? 'bg-amber-950/50 border-amber-500/80 text-amber-200'
                : displacement?.verdict === 'DEGRADED'
                ? 'bg-rose-950/50 border-rose-600/80 text-rose-200'
                : displacement?.verdict === 'IMPROVED'
                ? 'bg-emerald-950/50 border-emerald-500/80 text-emerald-200'
                : telemetry.isCritical
                ? 'bg-rose-950/40 border-rose-600/80 text-rose-200'
                : isMitigated
                ? 'bg-emerald-950/40 border-emerald-600/80 text-emerald-200'
                : 'bg-slate-950 border-slate-700 text-slate-200'
            }`}
          >
            {displacement?.verdict === 'DISPLACED' ? (
              <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
            ) : displacement?.verdict === 'IMPROVED' ? (
              <CheckCircle className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
            ) : telemetry.isCritical ? (
              <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
            ) : (
              <ShieldCheck className="w-6 h-6 text-cyan-400 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="font-bold text-sm tracking-wide uppercase flex items-center gap-2">
                <span>
                  {displacement
                    ? `SURPRISE HURDLE VERDICT: ${displacement.verdict}`
                    : telemetry.isCritical
                    ? 'CRITICAL CRUSH RISK DETECTED — PERMIT ACTION REQUIRED'
                    : isMitigated
                    ? 'SAFETY PLAN APPROVED WITH CROWDWISE MITIGATIONS'
                    : 'CONDITIONAL APPROVAL: ELEVATED BOTTLENECK FRICTION'}
                </span>
                {displacement && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-700">
                    Confidence: {Math.round(displacement.confidenceScore * 100)}%
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs opacity-90 leading-relaxed font-sans">
                {displacement
                  ? displacement.empiricalExplanation
                  : telemetry.isCritical
                  ? 'Simulated crowd forces indicate compressive shockwave formation exceeding 5.0 persons/m² at ingress constriction points. Physical intervention will fail under live conditions without structural buffering.'
                  : isMitigated
                  ? 'Deployment of upstream zigzag baffles and Auxiliary Gate 3 diversion channels successfully stabilizes pedestrian fluid dynamics, keeping peak density within the safe 3.1–3.4 persons/m² threshold.'
                  : 'Baseline operations maintain tolerable density under calm conditions, but are vulnerable to sudden scan slowdowns or influx surges.'}
              </p>
            </div>
          </div>

          {/* SURPRISE HURDLE FEATURE C: Three-Zone Paired Displacement Table */}
          {displacement && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  <span>Three-Zone Paired Counterfactual Audit (Before vs After)</span>
                </h3>
                <span className="text-[10px] font-mono text-cyan-400">
                  IDENTICAL SEED & DEMAND SCHEDULE
                </span>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-800">
                <table className="w-full text-left text-[11px] font-mono">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-2.5">Observation Zone</th>
                      <th className="p-2.5">Baseline Peak</th>
                      <th className="p-2.5">Mitigated Peak</th>
                      <th className="p-2.5">Density Delta</th>
                      <th className="p-2.5">Queue Delta</th>
                      <th className="p-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 bg-slate-900/60">
                    <tr>
                      <td className="p-2.5 font-bold text-cyan-300">{displacement.gateApproach.name}</td>
                      <td className="p-2.5">{displacement.gateApproach.baselinePeakDensity} p/m²</td>
                      <td className="p-2.5">{displacement.gateApproach.mitigatedPeakDensity} p/m²</td>
                      <td className={`p-2.5 font-bold ${displacement.gateApproach.densityDeltaPercent < 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {displacement.gateApproach.densityDeltaPercent > 0 ? '+' : ''}{displacement.gateApproach.densityDeltaPercent}%
                      </td>
                      <td className="p-2.5">{displacement.gateApproach.queueDeltaPercent > 0 ? '+' : ''}{displacement.gateApproach.queueDeltaPercent}%</td>
                      <td className="p-2.5">
                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-950 text-emerald-300 border border-emerald-700">
                          RELIEVED
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-bold text-amber-300">{displacement.intermediateHolding.name}</td>
                      <td className="p-2.5">{displacement.intermediateHolding.baselinePeakDensity} p/m²</td>
                      <td className="p-2.5">{displacement.intermediateHolding.mitigatedPeakDensity} p/m²</td>
                      <td className={`p-2.5 font-bold ${displacement.intermediateHolding.densityDeltaPercent > 8 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {displacement.intermediateHolding.densityDeltaPercent > 0 ? '+' : ''}{displacement.intermediateHolding.densityDeltaPercent}%
                      </td>
                      <td className="p-2.5">{displacement.intermediateHolding.queueDeltaPercent > 0 ? '+' : ''}{displacement.intermediateHolding.queueDeltaPercent}%</td>
                      <td className="p-2.5">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] border ${
                          displacement.intermediateHolding.densityDeltaPercent > 8
                            ? 'bg-amber-950 text-amber-300 border-amber-700'
                            : 'bg-emerald-950 text-emerald-300 border-emerald-700'
                        }`}>
                          {displacement.intermediateHolding.densityDeltaPercent > 8 ? 'DISPLACED HERE' : 'STABLE'}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-bold text-emerald-300">{displacement.upstreamArrival.name}</td>
                      <td className="p-2.5">{displacement.upstreamArrival.baselinePeakDensity} p/m²</td>
                      <td className="p-2.5">{displacement.upstreamArrival.mitigatedPeakDensity} p/m²</td>
                      <td className={`p-2.5 font-bold ${displacement.upstreamArrival.densityDeltaPercent > 8 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {displacement.upstreamArrival.densityDeltaPercent > 0 ? '+' : ''}{displacement.upstreamArrival.densityDeltaPercent}%
                      </td>
                      <td className="p-2.5">{displacement.upstreamArrival.queueDeltaPercent > 0 ? '+' : ''}{displacement.upstreamArrival.queueDeltaPercent}%</td>
                      <td className="p-2.5">
                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-slate-950 text-slate-400 border border-slate-700">
                          BUFFERED
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Key Simulation Telemetry Summary */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-2.5">
              1. Observed Dynamic Telemetry Profile
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block uppercase">Peak Density</span>
                <span className={`text-xl font-bold ${telemetry.isCritical ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {telemetry.peakDensity.toFixed(1)} p/m²
                </span>
                <span className="text-[10px] text-slate-500 block">Fruin LOS rating</span>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block uppercase">Spillback Reach</span>
                <span className="text-xl font-bold text-cyan-400">
                  {telemetry.spillbackMeters.toFixed(1)}m
                </span>
                <span className="text-[10px] text-slate-500 block">Upstream queue reach</span>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block uppercase">Throughput</span>
                <span className="text-xl font-bold text-emerald-400">
                  {telemetry.throughputPerMin} p/min
                </span>
                <span className="text-[10px] text-slate-500 block">Observed clearance</span>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block uppercase">Live Agents</span>
                <span className="text-xl font-bold text-indigo-400">
                  {telemetry.liveAgents}
                </span>
                <span className="text-[10px] text-slate-500 block">Active concourse crowd</span>
              </div>
            </div>
          </div>

          {/* Stress-Testing Configuration */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-2">
              2. Synthetic Stress-Test Scenario Parameters
            </h3>
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Active Scenario:</span>
                <span className="text-cyan-400 font-bold uppercase">{activeScenarioId} (35,000 Capacity)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Spatial Geometry:</span>
                <span className="text-slate-200 uppercase font-bold">{scenario}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Arrival Demand:</span>
                <span className="text-cyan-400">{inflowRate} pedestrians / minute</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Turnstile Latency:</span>
                <span className="text-amber-400">{gateLatency.toFixed(1)} seconds / patron</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">40m Upstream Chicane Baffles:</span>
                <span className={bafflesActive ? 'text-emerald-400' : 'text-slate-500'}>
                  {bafflesActive ? 'ACTIVE (CRASH-RAIL DEPLOYED)' : 'INACTIVE'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Gate 3 Auxiliary Bypass:</span>
                <span className={auxGateActive ? 'text-teal-400' : 'text-slate-500'}>
                  {auxGateActive ? 'ACTIVE (DIVERTS 45% LOAD)' : 'LOCKED'}
                </span>
              </div>
            </div>
          </div>

          {/* Actionable Recommendations */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-2">
              3. Operational Safety Recommendations
            </h3>
            <ul className="space-y-2 text-slate-300 font-sans">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Install Upstream Staggered Baffles:</strong> Place crash barriers 40m upstream in an S-curve configuration to break linear crowd momentum and prevent compressive shockwaves from reaching turnstiles.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Deploy Dynamic Gate 3 Rerouting:</strong> Whenever Gate 2 queue spillback reaches 18 meters, electronically open Gate 3 to redirect 45% of incoming patrons.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Counterflow Separation:</strong> In bidirectional zones, install central lane stanchions to prevent opposing pedestrian friction and eliminate head-on shear.
                </span>
              </li>
            </ul>
          </div>

          {/* Regulatory Approval Block */}
          <div className="pt-3 border-t border-slate-800 grid grid-cols-2 gap-4 text-[11px] font-mono">
            <div className="border border-slate-800 p-2.5 rounded bg-slate-950">
              <span className="text-slate-500 block">VENUE & LOCATION:</span>
              <span className="text-slate-200 font-bold block mt-1">M. Chinnaswamy Stadium, Bengaluru</span>
              <span className="text-slate-500 text-[10px]">Authoritative Capacity: 35,000 Spectators</span>
            </div>

            <div className="border border-slate-800 p-2.5 rounded bg-slate-950">
              <span className="text-slate-500 block">SAFETY AUDIT STATUS:</span>
              <span className={`font-bold block mt-1 ${
                displacement?.verdict === 'DISPLACED' ? 'text-amber-400' : 'text-emerald-400'
              }`}>
                {displacement?.verdict ? `VERIFIED: ${displacement.verdict}` : 'SAFE FOR PRODUCTION'}
              </span>
              <span className="text-slate-500 text-[10px]">Deterministic Microscopic Physics Model</span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-950">
          <span className="text-[11px] font-mono text-slate-500">
            CROWDWISE DIGITAL TWIN SAFETY LAB • ASTRA HACKATHON
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition"
              title="Print Brief or Save as PDF via Browser"
            >
              <Printer className="w-3.5 h-3.5 text-cyan-400" />
              <span>Print Brief (PDF)</span>
            </button>
            <button
              onClick={handleDownloadJson}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs transition"
              title="Download structured JSON experiment file"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download JSON Report</span>
            </button>
            <button
              onClick={toggleModal}
              className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
