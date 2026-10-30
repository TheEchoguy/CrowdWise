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
  Clock,
  ArrowRightCircle,
  Gauge,
  Users,
  Compass
} from 'lucide-react';

export const DecisionModal: React.FC = () => {
  const isModalOpen = useSimulationStore((s) => s.isModalOpen);
  const toggleModal = useSimulationStore((s) => s.toggleModal);
  const telemetry = useSimulationStore((s) => s.telemetry);
  const scenario = useSimulationStore((s) => s.scenario);
  const bafflesActive = useSimulationStore((s) => s.bafflesActive);
  const auxGateActive = useSimulationStore((s) => s.auxGateActive);
  const overflowRerouteActive = useSimulationStore((s) => s.overflowRerouteActive);
  const dividerActive = useSimulationStore((s) => s.dividerActive);
  const inflowRate = useSimulationStore((s) => s.inflowRate);
  const gateLatency = useSimulationStore((s) => s.gateLatency);
  const walkingSpeed = useSimulationStore((s) => s.walkingSpeed);

  if (!isModalOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const isMitigated = scenario === 'bridge'
    ? dividerActive
    : (bafflesActive && (auxGateActive || overflowRerouteActive));

  const scenarioNames: Record<string, string> = {
    stadium: 'M. Chinnaswamy Stadium — Gate 1 Main Ingress',
    bridge: 'Transit Footbridge — Bi-Directional Skywalk',
    reversal: 'Emergency Exit Corridor — Sudden Shock Reversal'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md decision-modal-backdrop">
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 decision-modal-container">
        {/* Printable Only Official Header */}
        <div className="hidden print:block p-4 border-b border-slate-300 print-avoid-break">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
                CROWDWISE &bull; EVENT SAFETY DECISION BRIEF & PERMIT ASSESSMENT
              </h1>
              <p className="text-xs text-slate-600 mt-0.5">
                Microscopic Vector Physics Digital Twin & Synthetic Stress-Testing Report | Theme 03
              </p>
            </div>
            <div className="text-right text-[10px] text-slate-500 font-mono">
              <div>REPORT ID: CW-DTR-2026-X1</div>
              <div>DATE: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</div>
            </div>
          </div>
        </div>

        {/* Interactive Screen Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950 no-print">
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
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs text-slate-300 decision-modal-body">
          {/* Executive Risk Banner */}
          <div
            className={`p-4 rounded-xl border flex items-start gap-3.5 print-avoid-break ${
              telemetry.isCritical
                ? 'bg-rose-950/40 border-rose-600/80 text-rose-200 print:bg-rose-50 print:border-rose-400 print:text-rose-900'
                : isMitigated
                ? 'bg-emerald-950/40 border-emerald-600/80 text-emerald-200 print:bg-emerald-50 print:border-emerald-400 print:text-emerald-900'
                : 'bg-amber-950/40 border-amber-600/80 text-amber-200 print:bg-amber-50 print:border-amber-400 print:text-amber-900'
            }`}
          >
            {telemetry.isCritical ? (
              <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5 print:text-rose-600" />
            ) : (
              <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5 print:text-emerald-600" />
            )}
            <div>
              <div className="font-bold text-sm tracking-wide uppercase">
                {telemetry.isCritical
                  ? 'CRITICAL CRUSH HAZARD DETECTED — PERMIT ACTION REQUIRED'
                  : isMitigated
                  ? 'SAFETY PLAN APPROVED WITH CROWDWISE MITIGATIONS'
                  : 'CONDITIONAL APPROVAL: ELEVATED BOTTLENECK FRICTION'}
              </div>
              <p className="mt-1 text-xs opacity-90 leading-relaxed font-sans">
                {telemetry.isCritical
                  ? 'Simulated crowd forces indicate compressive shockwave formation exceeding 5.0 persons/m² at constriction points. Interpersonal repulsion and viscous drag collapse pedestrian velocity to zero. Physical intervention will fail under live conditions without structural buffering.'
                  : isMitigated
                  ? scenario === 'bridge'
                    ? 'Deployment of the central anti-deadlock lane barrier successfully separates opposing pedestrian vectors into laminar channels, eliminating counter-flow collisions and keeping density under safe thresholds.'
                    : 'Deployment of upstream zigzag baffles and Auxiliary Gate 2 diversion channels successfully stabilizes pedestrian fluid dynamics, keeping peak density within the safe 3.1–3.4 persons/m² envelope.'
                  : 'Baseline operations maintain tolerable density under calm conditions, but remain vulnerable to synthetic influx surges and barcode scanner latency spikes.'}
              </p>
            </div>
          </div>

          {/* 1. Key Simulation Telemetry Summary */}
          <div className="print-avoid-break">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-2.5 print-text-dark">
              1. Observed Dynamic Telemetry Profile
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 print-card">
                <span className="text-[10px] text-slate-400 block uppercase print-text-muted">Peak Density</span>
                <span className={`text-xl font-bold ${telemetry.isCritical ? 'text-rose-400 print:text-rose-700' : 'text-emerald-400 print:text-emerald-700'}`}>
                  {telemetry.peakDensity.toFixed(1)} p/m²
                </span>
                <span className="text-[10px] text-slate-500 block print-text-muted">Fruin LOS F (&ge;5.0 critical)</span>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 print-card">
                <span className="text-[10px] text-slate-400 block uppercase print-text-muted flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-400 print:text-amber-600" />
                  <span>Time to Turbulence</span>
                </span>
                <span className={`text-xl font-bold ${telemetry.timeToTurbulence !== null && telemetry.timeToTurbulence <= 5.0 ? 'text-rose-400 print:text-rose-700' : 'text-emerald-400 print:text-emerald-700'}`}>
                  {telemetry.timeToTurbulence !== null ? `${telemetry.timeToTurbulence.toFixed(1)}s` : 'CLEAR / SAFE'}
                </span>
                <span className="text-[10px] text-slate-500 block print-text-muted">Onset forecast window</span>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 print-card">
                <span className="text-[10px] text-slate-400 block uppercase print-text-muted flex items-center gap-1">
                  <ArrowRightCircle className="w-3 h-3 text-cyan-400 print:text-cyan-700" />
                  <span>Queue Spillback</span>
                </span>
                <span className="text-xl font-bold text-cyan-400 print:text-cyan-800">
                  {telemetry.spillbackMeters.toFixed(1)}m
                </span>
                <span className="text-[10px] text-slate-500 block print-text-muted">Concourse reach</span>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 print-card">
                <span className="text-[10px] text-slate-400 block uppercase print-text-muted flex items-center gap-1">
                  <Gauge className="w-3 h-3 text-emerald-400 print:text-emerald-700" />
                  <span>Throughput</span>
                </span>
                <span className="text-xl font-bold text-emerald-400 print:text-emerald-700">
                  {telemetry.throughputPerMin} p/min
                </span>
                <span className="text-[10px] text-slate-500 block print-text-muted">Active clearance</span>
              </div>
            </div>

            {/* Secondary Telemetry Strip */}
            <div className="grid grid-cols-3 gap-2.5 mt-2.5 font-mono">
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 print-card flex items-center justify-between">
                <div>
                  <span className="text-[9px] text-slate-400 uppercase block print-text-muted">Live Concourse Load</span>
                  <span className="text-sm font-bold text-indigo-400 print:text-indigo-800">{telemetry.liveAgents} agents</span>
                </div>
                <Users className="w-4 h-4 text-indigo-400 print:text-indigo-700 shrink-0" />
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 print-card flex items-center justify-between">
                <div>
                  <span className="text-[9px] text-slate-400 uppercase block print-text-muted">Density Trend</span>
                  <span className={`text-sm font-bold uppercase ${telemetry.densityTrend === 'rising' ? 'text-rose-400 print:text-rose-700' : telemetry.densityTrend === 'clearing' ? 'text-emerald-400 print:text-emerald-700' : 'text-slate-300 print:text-slate-700'}`}>
                    {telemetry.densityTrend}
                  </span>
                </div>
                <Compass className="w-4 h-4 text-cyan-400 print:text-cyan-700 shrink-0" />
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 print-card flex items-center justify-between">
                <div>
                  <span className="text-[9px] text-slate-400 uppercase block print-text-muted">Engine Rate</span>
                  <span className="text-sm font-bold text-cyan-400 print:text-cyan-800">{telemetry.fps} FPS (Helbing Force)</span>
                </div>
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
            </div>
          </div>

          {/* 2. Stress-Testing Configuration & Counterfactual Table */}
          <div className="print-avoid-break">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-2 print-text-dark">
              2. Synthetic Stress-Test Scenario Baseline
            </h3>
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] space-y-1.5 print-card">
              <div className="flex justify-between">
                <span className="text-slate-400 print-text-muted">Active Preset:</span>
                <span className="text-slate-200 uppercase font-bold print-text-dark">{scenarioNames[scenario] || scenario}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 print-text-muted">Arrival Profile:</span>
                <span className="text-cyan-400 uppercase font-bold print:text-cyan-800">{telemetry.activeArrivalProfile || 'STEADY'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 print-text-muted">Synthetic Inflow Rate:</span>
                <span className="text-cyan-400 print:text-cyan-800">{inflowRate} pedestrians / minute</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 print-text-muted">Gate Turnstile Latency:</span>
                <span className="text-amber-400 print:text-amber-800">{gateLatency.toFixed(1)} seconds / person</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 print-text-muted">Mean Walking Speed:</span>
                <span className="text-slate-300 print-text-dark">{walkingSpeed.toFixed(1)} m/s (Fruin unimpeded)</span>
              </div>
              {scenario === 'bridge' ? (
                <div className="flex justify-between">
                  <span className="text-slate-400 print-text-muted">Central Anti-Deadlock Divider:</span>
                  <span className={dividerActive ? 'text-emerald-400 font-bold print:text-emerald-800' : 'text-slate-500 print-text-muted'}>
                    {dividerActive ? 'DEPLOYED (DUAL ONE-WAY LANES)' : 'INACTIVE (TURBULENT COUNTER-FLOW)'}
                  </span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-400 print-text-muted">40m Upstream Holding Baffles:</span>
                    <span className={bafflesActive ? 'text-emerald-400 font-bold print:text-emerald-800' : 'text-slate-500 print-text-muted'}>
                      {bafflesActive ? 'DEPLOYED (ZIGZAG CRASH-RAILS)' : 'INACTIVE'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 print-text-muted">Auxiliary Gate 2 Bypass:</span>
                    <span className={auxGateActive ? 'text-teal-400 font-bold print:text-teal-800' : 'text-slate-500 print-text-muted'}>
                      {auxGateActive ? 'ACTIVE (DIVERTS 45% LOAD)' : 'LOCKED'}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 3. Side-by-Side Counterfactual Comparison Brief */}
          <div className="print-avoid-break">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-2 print-text-dark">
              3. Counterfactual Risk Analysis (Baseline vs. CROWDWISE Plan)
            </h3>
            <div className="grid grid-cols-2 gap-3 text-[11px] font-mono">
              <div className="p-3 rounded-lg bg-slate-950 border border-rose-900/40 print-card">
                <div className="font-bold text-rose-400 print:text-rose-800 uppercase mb-1">
                  Baseline (Unmitigated)
                </div>
                <div className="text-slate-300 space-y-1 print-text-dark">
                  <div>&bull; Peak Density: <strong className="text-rose-400 print:text-rose-700">~6.2 p/m²</strong></div>
                  <div>&bull; Max Spillback: <strong>~34 meters</strong></div>
                  <div>&bull; Failure Mode: Shockwave crush at constriction</div>
                  <div>&bull; Permit Risk: <strong className="text-rose-400 print:text-rose-700">CRITICAL VIOLATION</strong></div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-emerald-900/40 print-card">
                <div className="font-bold text-emerald-400 print:text-emerald-800 uppercase mb-1">
                  CROWDWISE Mitigated Plan
                </div>
                <div className="text-slate-300 space-y-1 print-text-dark">
                  <div>&bull; Peak Density: <strong className="text-emerald-400 print:text-emerald-700">~3.1 p/m²</strong> (-50%)</div>
                  <div>&bull; Max Spillback: <strong>~12 meters</strong> (-65%)</div>
                  <div>&bull; Failure Mode: None (Laminar flow preserved)</div>
                  <div>&bull; Permit Risk: <strong className="text-emerald-400 print:text-emerald-700">APPROVED</strong></div>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Actionable Structural Recommendations */}
          <div className="print-avoid-break">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-2 print-text-dark">
              4. Mandatory Structural Safety Directives
            </h3>
            <ul className="space-y-2 text-slate-300 font-sans print-text-dark">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5 print:text-cyan-700" />
                <span>
                  <strong>Install Upstream Staggered Baffles:</strong> Place crash barriers 40m upstream in an S-curve configuration to break linear crowd momentum and prevent compressive shockwaves from reaching turnstiles.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5 print:text-cyan-700" />
                <span>
                  <strong>Deploy Dynamic Gate 2 Rerouting:</strong> Whenever Gate 1 queue spillback reaches 18 meters, electronically open Auxiliary Gate 2 to redirect 45% of incoming patrons.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5 print:text-cyan-700" />
                <span>
                  <strong>Turnstile Redundancy & Latency Control:</strong> Maintain scanner latency below 2.5 seconds per person; if latency exceeds 4.0 seconds, dispatch roving handheld validators immediately.
                </span>
              </li>
            </ul>
          </div>

          {/* 5. Regulatory Sign-Off Block */}
          <div className="pt-3 border-t border-slate-800 grid grid-cols-2 gap-4 text-[11px] font-mono print-border print-avoid-break">
            <div className="border border-slate-800 p-2.5 rounded bg-slate-950 print-card">
              <span className="text-slate-500 block print-text-muted">SIMULATION PLATFORM:</span>
              <span className="text-slate-200 font-bold block mt-1 print-text-dark">CROWDWISE Digital Twin v1.0</span>
              <span className="text-slate-500 text-[10px] print-text-muted">Theme 03: Digital Twin & Synthetic Data</span>
            </div>

            <div className="border border-slate-800 p-2.5 rounded bg-slate-950 print-card">
              <span className="text-slate-500 block print-text-muted">PERMIT STATUS:</span>
              <span className={`font-bold block mt-1 ${telemetry.isCritical ? 'text-rose-400 print:text-rose-700' : 'text-emerald-400 print:text-emerald-700'}`}>
                {telemetry.isCritical ? 'PERMIT ACTION REQUIRED' : 'COMPLIANT & APPROVED'}
              </span>
              <span className="text-slate-500 text-[10px] print-text-muted">Deterministic Helbing Social Force Model</span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-950 no-print">
          <span className="text-[11px] font-mono text-slate-500">
            CONFIDENTIAL BRIEF — FOR VENUE OPERATORS & POLICE SAFETY COMMAND
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs transition active:scale-[0.98]"
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
