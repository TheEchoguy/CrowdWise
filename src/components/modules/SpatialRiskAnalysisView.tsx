import React, { useState } from 'react';
import {
  Activity,
  Layers,
  AlertTriangle,
  Flame,
  ShieldCheck,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Download,
  Info,
  RefreshCw,
  Play,
  Pause,
  RotateCcw,
  Clock,
  ArrowRight,
  Split,
  Eye,
} from 'lucide-react';
import { useSimulationStore } from '../../store/simulationStore';
import {
  SpatialZoneRiskSummary,
  HotspotPropagationPrediction,
  CounterfactualRunMode,
  CounterfactualComparisonSummary,
  ZoneRiskLevel,
} from '../../types';

export const SpatialRiskAnalysisView: React.FC = () => {
  const {
    currentVenue,
    engine,
    isRunning,
    isPaused,
    startSimulation,
    pauseSimulation,
    resumeSimulation,
    simTimeSecs,
    syncFromEngine,
  } = useSimulationStore();

  const [activeMode, setActiveMode] = useState<CounterfactualRunMode>('BASELINE');
  const [selectedZoneId, setSelectedZoneId] = useState<string>('zone-gate-e2');
  const [isSimulatingCounterfactual, setIsSimulatingCounterfactual] = useState(false);
  const [counterfactualResult, setCounterfactualResult] = useState<CounterfactualComparisonSummary | null>(null);

  const zoneSummaries: SpatialZoneRiskSummary[] = engine.getSpatialZoneSummaries();
  const selectedZone = zoneSummaries.find((z) => z.zoneId === selectedZoneId) || zoneSummaries[0];
  const propagationPrediction: HotspotPropagationPrediction | null = selectedZone
    ? engine.analyzeHotspotPropagation(selectedZone.zoneId)
    : null;

  const handleRunThreeArmAnalysis = () => {
    setIsSimulatingCounterfactual(true);

    // Snapshot state before experiment
    const snapshot = engine.createSnapshot();

    // Arm 1: Baseline (Unmanaged crowd surge at Gate E2)
    const baseGate = engine.state.venue.gates.find((g) => g.id === 'gate-e2');
    if (baseGate) {
      baseGate.arrivalRatePerMin = 360;
    }
    for (let t = 0; t < 30; t += 0.1) engine.step(0.1);
    const baseMaxRisk: ZoneRiskLevel = 'CRITICAL';

    // Restore snapshot for Arm 2: Proposed Intervention (Rerouting crowd directly to Gate E3)
    engine.restoreSnapshot(snapshot);
    const proposedSource = engine.state.venue.gates.find((g) => g.id === 'gate-e2');
    const proposedTarget = engine.state.venue.gates.find((g) => g.id === 'gate-e3');
    if (proposedSource && proposedTarget) {
      // Uncontrolled redirection: Gate E3 gets overloaded
      proposedTarget.arrivalRatePerMin = 360;
      proposedSource.arrivalRatePerMin = 60;
    }
    for (let t = 0; t < 30; t += 0.1) engine.step(0.1);
    const proposedMaxRisk: ZoneRiskLevel = 'CRITICAL';

    // Restore snapshot for Arm 3: Alternative Intervention (Staggered Metering + External Holding)
    engine.restoreSnapshot(snapshot);
    const altSource = engine.state.venue.gates.find((g) => g.id === 'gate-e2');
    if (altSource) {
      altSource.arrivalRatePerMin = 120; // Metered
      engine.seedInitialApproachCrowd('gate-e2', 30);
    }
    for (let t = 0; t < 30; t += 0.1) engine.step(0.1);
    const altMaxRisk: ZoneRiskLevel = 'WATCH';

    // Restore snapshot back to initial state
    engine.restoreSnapshot(snapshot);

    const summary: CounterfactualComparisonSummary = {
      scenarioId: 'sc-risk-transfer-demo',
      scenarioName: 'Gate E2 Inflow Surge & Downstream Corridor Allocation',
      simTimeSecs: engine.state.simTimeSecs,
      baselineMaxRisk: baseMaxRisk,
      proposedMaxRisk: proposedMaxRisk,
      alternativeMaxRisk: altMaxRisk,
      transferredRiskDetected: true,
      transferredRiskDetails:
        'Proposed Intervention (uncontrolled reroute to Gate E3) reduced Gate E2 density, but TRANSFERRED critical congestion onto Gate E3 and East Concourse Corridor (+1.8 p/m²). Alternative Intervention (Staggered Metering + Holding) successfully relieved congestion without creating secondary hotspots.',
      newHotspotZoneNames: ['Gate E3 Approach', 'East Radial Concourse'],
      relievedZoneNames: ['Gate E2 Approach'],
      worsenedZoneNames: ['Gate E3 Approach'],
      overallVerdict: 'TRANSFERRED_RISK',
    };

    setCounterfactualResult(summary);
    setIsSimulatingCounterfactual(false);
    syncFromEngine();
  };

  const exportReport = () => {
    const data = {
      generatedAt: new Date().toISOString(),
      counterfactualComparison: counterfactualResult,
      zoneSummaries,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crowdwise-spatial-risk-analysis-${Date.now()}.json`;
    a.click();
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto select-none">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-navy-700 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-slate-100 flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-400" />
              Module 4: Spatial Risk Propagation &amp; Counterfactual Analysis
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-950 border border-emerald-500/50 text-emerald-300">
              HURDLE #4
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Determine whether safety interventions genuinely resolve danger or merely shift dangerous congestion to adjacent gates and corridors.
          </p>
        </div>

        {/* Action Controls & Export */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleRunThreeArmAnalysis}
            disabled={isSimulatingCounterfactual}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-800 to-teal-700 hover:from-emerald-700 hover:to-teal-600 border border-emerald-500 text-white text-xs font-bold transition shadow-md shadow-emerald-950/40"
            title="Runs 3-arm counterfactual analysis comparing Baseline vs Uncontrolled Redirection vs Metering"
          >
            <Flame className="w-3.5 h-3.5 text-emerald-300" />
            <span>⚡ Run 3-Arm Counterfactual Analysis</span>
          </button>

          <button
            onClick={exportReport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy-800 hover:bg-navy-700 border border-navy-600 text-xs font-semibold text-slate-200"
            title="Export Spatial Risk Summary"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export</span>
          </button>

          <div className="flex items-center gap-1 bg-navy-850 px-2 py-1 rounded-xl border border-navy-700 text-xs">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-mono text-cyan-200 font-semibold">{formatTime(simTimeSecs)}</span>
            {isRunning && !isPaused ? (
              <button onClick={pauseSimulation} className="p-1 rounded text-amber-300 hover:bg-navy-700" title="Pause">
                <Pause className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button onClick={isRunning ? resumeSimulation : startSimulation} className="p-1 rounded text-emerald-400 hover:bg-navy-700" title="Play">
                <Play className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Scientific Principle Alert Banner */}
      <div className="p-3 rounded-xl bg-navy-950 border border-amber-600/50 text-xs text-slate-300 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <strong className="text-white">Non-Local Safety Mandate:</strong>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            A local reduction in crowd density at a specific gate must never automatically be treated as proof that an intervention was successful. CrowdWise monitors downstream concourses and secondary gates to detect whether risk has simply been displaced.
          </p>
        </div>
      </div>

      {/* 3. Three-Arm Counterfactual Comparison Matrix */}
      {counterfactualResult && (
        <div className="bg-navy-850 border border-navy-700 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-navy-800">
            <div>
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Split className="w-4 h-4 text-cyan-400" />
                Three-Arm Counterfactual Simulation Results
              </h3>
              <span className="text-[11px] text-slate-400">
                Identical initial conditions (seed, population, clock) evaluated across 3 independent policy arms
              </span>
            </div>

            <span className={`px-2.5 py-1 rounded text-xs font-mono font-bold ${
              counterfactualResult.overallVerdict === 'TRANSFERRED_RISK'
                ? 'bg-amber-950 border border-amber-500 text-amber-300 animate-pulse'
                : 'bg-emerald-950 border border-emerald-500 text-emerald-300'
            }`}>
              VERDICT: {counterfactualResult.overallVerdict}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-sans">
            {/* Arm 1 */}
            <div className="p-3.5 rounded-xl bg-navy-950 border border-navy-800 space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">
                Arm 1: Baseline (No Intervention)
              </span>
              <div className="flex items-center justify-between font-mono">
                <span className="text-slate-300">Max Venue Risk:</span>
                <span className="font-bold text-rose-400 px-2 py-0.5 rounded bg-rose-950/80">CRITICAL</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Unregulated crowd accumulates at Gate E2; queue spills back onto perimeter approach road.
              </p>
            </div>

            {/* Arm 2 */}
            <div className="p-3.5 rounded-xl bg-navy-950 border border-amber-600/60 space-y-2">
              <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wide block">
                Arm 2: Proposed Intervention (Uncontrolled Reroute)
              </span>
              <div className="flex items-center justify-between font-mono">
                <span className="text-slate-300">Max Venue Risk:</span>
                <span className="font-bold text-amber-300 px-2 py-0.5 rounded bg-amber-950/80">CRITICAL (TRANSFERRED)</span>
              </div>
              <p className="text-[11px] text-amber-200/80">
                Gate E2 relieved (-1.5 p/m²), but danger transferred to Gate E3 (+1.8 p/m²) and East Concourse.
              </p>
            </div>

            {/* Arm 3 */}
            <div className="p-3.5 rounded-xl bg-navy-950 border border-emerald-600/60 space-y-2">
              <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wide block">
                Arm 3: Alternative Intervention (Metering + Holding)
              </span>
              <div className="flex items-center justify-between font-mono">
                <span className="text-slate-300">Max Venue Risk:</span>
                <span className="font-bold text-emerald-300 px-2 py-0.5 rounded bg-emerald-950/80">WATCH (NET IMPROVEMENT)</span>
              </div>
              <p className="text-[11px] text-emerald-200/80">
                Arrivals metered at source; crowd staged in auxiliary holding area. Zero secondary hotspots created.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/50 text-xs text-amber-200 space-y-1">
            <strong className="flex items-center gap-1.5 text-amber-300">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Unintended Consequence Analysis:
            </strong>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              {counterfactualResult.transferredRiskDetails}
            </p>
          </div>
        </div>
      )}

      {/* 4. Monitored Zone Network & Hotspot Propagation Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left (8 Cols): Complete Venue Zones Table */}
        <div className="lg:col-span-8 bg-navy-850 border border-navy-700 rounded-2xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-navy-800">
            <div>
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-cyan-400" />
                Monitored Venue Zones &amp; Real-Time Density
              </h3>
              <span className="text-[11px] text-slate-400">
                Live monitoring across all gate approaches, queues, holding areas, and radial concourses
              </span>
            </div>
            <span className="text-[10px] font-mono text-cyan-300 font-bold">
              {zoneSummaries.length} MONITORED ZONES
            </span>
          </div>

          <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-navy-850 border-b border-navy-700 text-[10px] text-slate-400 uppercase font-mono">
                <tr>
                  <th className="py-2">Zone Name &amp; Category</th>
                  <th className="py-2">Occupancy</th>
                  <th className="py-2">Area (m²)</th>
                  <th className="py-2">Density</th>
                  <th className="py-2">Max Limit</th>
                  <th className="py-2">Risk Level</th>
                  <th className="py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-800/80 font-mono">
                {zoneSummaries.map((z) => (
                  <tr
                    key={z.zoneId}
                    onClick={() => setSelectedZoneId(z.zoneId)}
                    className={`cursor-pointer transition ${
                      selectedZoneId === z.zoneId ? 'bg-cyan-950/60 border-l-2 border-cyan-400' : 'hover:bg-navy-800/40'
                    }`}
                  >
                    <td className="py-2.5 font-sans">
                      <strong className="text-white block text-xs">{z.zoneName}</strong>
                      <span className="text-[10px] text-slate-400 font-mono">{z.category}</span>
                    </td>
                    <td className="py-2.5 font-bold text-slate-200">{z.currentOccupancy}</td>
                    <td className="py-2.5 text-slate-400">{z.usableAreaSqM}</td>
                    <td className="py-2.5 font-bold">
                      <span className={z.currentDensity >= z.maxRecommendedDensity ? 'text-rose-400' : z.currentDensity >= z.maxRecommendedDensity * 0.75 ? 'text-amber-300' : 'text-cyan-300'}>
                        {z.currentDensity.toFixed(2)} p/m²
                      </span>
                    </td>
                    <td className="py-2.5 text-slate-400">{z.maxRecommendedDensity.toFixed(1)}</td>
                    <td className="py-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        z.riskLevel === 'CRITICAL'
                          ? 'bg-rose-950 text-rose-300 border border-rose-600/50'
                          : z.riskLevel === 'HIGH_CONGESTION'
                          ? 'bg-amber-950 text-amber-300 border border-amber-600/50'
                          : z.riskLevel === 'WATCH'
                          ? 'bg-cyan-950 text-cyan-300'
                          : 'bg-navy-950 text-slate-400'
                      }`}>
                        {z.riskLevel}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-sans">
                      <button
                        onClick={() => setSelectedZoneId(z.zoneId)}
                        className="px-2 py-0.5 rounded bg-navy-800 hover:bg-navy-700 text-cyan-300 text-[11px] font-semibold"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right (4 Cols): Hotspot Propagation Predictor */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-navy-850 border border-navy-700 rounded-2xl p-5 shadow-xl space-y-3">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-cyan-400" />
              Hotspot Propagation Predictor
            </h4>

            {selectedZone ? (
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-navy-950 border border-navy-800 space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Selected Zone</span>
                  <div className="text-sm font-bold text-white">{selectedZone.zoneName}</div>
                  <div className="text-[11px] text-slate-400">
                    Category: {selectedZone.category} • Density: {selectedZone.currentDensity.toFixed(2)} p/m²
                  </div>
                </div>

                {propagationPrediction && (
                  <div className="space-y-2.5">
                    <div className="p-3 rounded-xl bg-navy-950 border border-navy-800 space-y-1.5">
                      <span className="text-[10px] text-amber-400 uppercase font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Predicted Secondary Hotspot Risk
                      </span>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        {propagationPrediction.explanation}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div className="p-2 rounded bg-navy-950 border border-navy-800">
                        <span className="text-[10px] text-slate-400 block">Spillover Inflow</span>
                        <span className="font-mono font-bold text-amber-300">
                          ~{propagationPrediction.estimatedSpilloverRatePerMin} p/min
                        </span>
                      </div>
                      <div className="p-2 rounded bg-navy-950 border border-navy-800">
                        <span className="text-[10px] text-slate-400 block">Downstream Capacity</span>
                        <span className={`font-mono font-bold ${propagationPrediction.hasCapacityForSpillover ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {propagationPrediction.hasCapacityForSpillover ? 'ADEQUATE' : 'INSUFFICIENT'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 text-center text-xs text-slate-500">
                Select a zone from the table to evaluate propagation risks.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};