import React from 'react';
import { useSimulationStore } from '../../state/useSimulationStore';
import { X, Printer, ShieldCheck, AlertTriangle, CheckCircle, FileText, Download } from 'lucide-react';

export const DecisionModal: React.FC = () => {
  const isModalOpen = useSimulationStore((s) => s.isModalOpen);
  const toggleModal = useSimulationStore((s) => s.toggleModal);
  const telemetry = useSimulationStore((s) => s.telemetry);
  const scenario = useSimulationStore((s) => s.scenario);
  const bafflesActive = useSimulationStore((s) => s.bafflesActive);
  const auxGateActive = useSimulationStore((s) => s.auxGateActive);
  const inflowRate = useSimulationStore((s) => s.inflowRate);
  const gateLatency = useSimulationStore((s) => s.gateLatency);

  if (!isModalOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const isMitigated = bafflesActive && auxGateActive;

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
                Event Safety Decision Brief & Permit Assessment
              </h2>
              <p className="text-xs text-slate-400">
                Predictive Digital Twin Telemetry & Structural Mitigation Sign-Off
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
              title="Print or Save PDF"
            >
              <Printer className="w-4 h-4 text-cyan-400" />
              <span>Print Brief</span>
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
          {/* Executive Risk Banner */}
          <div
            className={`p-4 rounded-xl border flex items-start gap-3.5 ${
              telemetry.isCritical
                ? 'bg-rose-950/40 border-rose-600/80 text-rose-200'
                : isMitigated
                ? 'bg-emerald-950/40 border-emerald-600/80 text-emerald-200'
                : 'bg-amber-950/40 border-amber-600/80 text-amber-200'
            }`}
          >
            {telemetry.isCritical ? (
              <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
            ) : (
              <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="font-bold text-sm tracking-wide uppercase">
                {telemetry.isCritical
                  ? 'CRITICAL CRUSH RISK DETECTED — PERMIT ACTION REQUIRED'
                  : isMitigated
                  ? 'SAFETY PLAN APPROVED WITH CROWDWISE MITIGATIONS'
                  : 'CONDITIONAL APPROVAL: ELEVATED BOTTLENECK FRICTION'}
              </div>
              <p className="mt-1 text-xs opacity-90 leading-relaxed font-sans">
                {telemetry.isCritical
                  ? 'Simulated crowd forces indicate compressive shockwave formation exceeding 5.0 persons/m² at ingress constriction points. Physical intervention will fail under live conditions without structural buffering.'
                  : isMitigated
                  ? 'Deployment of upstream zigzag baffles and Auxiliary Gate B diversion channels successfully stabilizes pedestrian fluid dynamics, keeping peak density within the safe 3.1–3.4 persons/m² threshold.'
                  : 'Baseline operations maintain tolerable density under calm conditions, but are vulnerable to sudden scan slowdowns or influx surges above 240 persons/min.'}
              </p>
            </div>
          </div>

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
                <span className="text-[10px] text-slate-500 block">Rolling clearance</span>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block uppercase">Live Agents</span>
                <span className="text-xl font-bold text-indigo-400">
                  {telemetry.liveAgents}
                </span>
                <span className="text-[10px] text-slate-500 block">Concourse load</span>
              </div>
            </div>
          </div>

          {/* Stress-Testing Configuration */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-2">
              2. Synthetic Stress-Test Scenario Baseline
            </h3>
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Scenario Preset:</span>
                <span className="text-slate-200 uppercase font-bold">{scenario}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Synthetic Inflow Rate:</span>
                <span className="text-cyan-400">{inflowRate} pedestrians / minute</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Gate Turnstile Latency:</span>
                <span className="text-amber-400">{gateLatency.toFixed(1)} seconds / person</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">40m Upstream Baffles:</span>
                <span className={bafflesActive ? 'text-emerald-400' : 'text-slate-500'}>
                  {bafflesActive ? 'ACTIVE (CRASH-RAIL DEPLOYED)' : 'INACTIVE'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Auxiliary Gate B Bypass:</span>
                <span className={auxGateActive ? 'text-teal-400' : 'text-slate-500'}>
                  {auxGateActive ? 'ACTIVE (DIVERTS 45% LOAD)' : 'LOCKED'}
                </span>
              </div>
            </div>
          </div>

          {/* Actionable Recommendations */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-2">
              3. Mandatory Structural Safety Recommendations
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
                  <strong>Deploy Dynamic Gate B Rerouting:</strong> Whenever Gate A queue spillback reaches 18 meters, electronically open Auxiliary Gate B to redirect 45% of incoming patrons.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Turnstile Redundancy:</strong> Maintain scanner check latency under 2.5 seconds per person; if latency exceeds 4.0 seconds, dispatch roving handheld validators immediately.
                </span>
              </li>
            </ul>
          </div>

          {/* Regulatory Approval Block */}
          <div className="pt-3 border-t border-slate-800 grid grid-cols-2 gap-4 text-[11px] font-mono">
            <div className="border border-slate-800 p-2.5 rounded bg-slate-950">
              <span className="text-slate-500 block">SIMULATION AUTHORITY:</span>
              <span className="text-slate-200 font-bold block mt-1">CROWDWISE Safety Lab v1.0</span>
              <span className="text-slate-500 text-[10px]">Theme 03: Digital Twin & Synthetic Data</span>
            </div>

            <div className="border border-slate-800 p-2.5 rounded bg-slate-950">
              <span className="text-slate-500 block">PERMIT STATUS:</span>
              <span className="text-emerald-400 font-bold block mt-1">
                {telemetry.isCritical ? 'REVIEW REQUIRED' : 'SAFE FOR PRODUCTION'}
              </span>
              <span className="text-slate-500 text-[10px]">Deterministic Microscopic Physics Model</span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-950">
          <span className="text-[11px] font-mono text-slate-500">
            CONFIDENTIAL BRIEF — FOR VENUE OPERATORS & POLICE SAFETY COMMAND
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
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

