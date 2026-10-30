import React, { useState } from 'react';
import {
  FlaskConical,
  Play,
  RotateCcw,
  Sparkles,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  ShieldCheck,
  Split,
  FileSpreadsheet,
  Info,
} from 'lucide-react';
import { useSimulationStore } from '../../store/simulationStore';
import { SCENARIOS } from '../../data/scenarios';
import { DEFAULT_INTERVENTIONS } from '../../data/interventions';

export const ScenarioLabView: React.FC = () => {
  const {
    activeScenarioId,
    setActiveScenarioId,
    triggerActiveScenario,
    startSimulation,
    isRunning,
    interventions,
    toggleIntervention,
    setInterventionParam,
    randomSeed,
    setRandomSeed,
    comparisons,
    runCounterfactualComparison,
    setActiveTab,
    layers,
    toggleLayer,
    setActiveComparisonId,
  } = useSimulationStore();

  const [zoneFilter, setZoneFilter] = useState<'ALL' | 'RELIEVED' | 'WORSENED_OR_HOTSPOT'>('ALL');

  const handleInspectOnMap = (compId: string) => {
    setActiveComparisonId(compId);
    if (!layers.spatialComparison) {
      toggleLayer('spatialComparison');
    }
    setActiveTab('digital-twin');
  };

  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isComparing, setIsComparing] = useState(false);

  const scenario = SCENARIOS.find((s) => s.id === activeScenarioId) || SCENARIOS[0];

  const categories = ['ALL', ...Array.from(new Set(SCENARIOS.map((s) => s.category)))];

  const filteredScenarios = SCENARIOS.filter(
    (s) => selectedCategory === 'ALL' || s.category === selectedCategory
  );

  const handleRunComparison = () => {
    setIsComparing(true);
    const activeInterventionIds = interventions.filter((i) => i.isActive).map((i) => i.id);
    runCounterfactualComparison(activeScenarioId, activeInterventionIds);
    setTimeout(() => setIsComparing(false), 500);
  };

  const latestComparison = comparisons.length > 0 ? comparisons[0] : null;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-navy-700 pb-4">
        <div>
          <h2 className="text-xl font-black text-slate-100 flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-cyan-400" />
            Scenario Lab &amp; Counterfactual Safety Lab
          </h2>
          <p className="text-xs text-slate-400">
            Stress-test venue operations with 10+ difficult incident scenarios, compare management interventions, and uncover unintended downstream consequences.
          </p>
        </div>

        {/* Deterministic Seed Controls */}
        <div className="flex items-center gap-2 bg-navy-850 px-3 py-1.5 rounded-xl border border-navy-700 text-xs">
          <span className="text-slate-400 font-mono font-medium">Seed:</span>
          <input
            type="number"
            value={randomSeed}
            onChange={(e) => setRandomSeed(Number(e.target.value))}
            className="w-18 bg-navy-950 border border-navy-600 rounded px-2 py-0.5 text-cyan-300 font-mono text-xs focus:outline-none"
          />
          <button
            onClick={() => setRandomSeed(Math.floor(Math.random() * 90000) + 1000)}
            className="text-[11px] text-slate-400 hover:text-cyan-300 font-semibold"
          >
            New Seed
          </button>
        </div>
      </div>

      {/* Main Grid: Scenario Selector & Details (Left), Interventions & Counterfactual Comparison (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 Cols): Scenario Catalog & Details */}
        <div className="lg:col-span-5 space-y-5">
          {/* Category Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs">
            {categories.slice(0, 5).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition ${
                  selectedCategory === cat
                    ? 'bg-cyan-600 text-white font-bold'
                    : 'bg-navy-850 text-slate-400 hover:text-slate-200 border border-navy-700'
                }`}
              >
                {cat === 'ALL' ? 'All Scenarios' : cat}
              </button>
            ))}
          </div>

          {/* Scenario Cards List */}
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {filteredScenarios.map((sc) => {
              const isSelected = sc.id === activeScenarioId;
              return (
                <button
                  key={sc.id}
                  onClick={() => setActiveScenarioId(sc.id)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-cyan-950/80 border-cyan-500/80 text-slate-100 shadow-md shadow-cyan-950/50'
                      : 'bg-navy-850 border-navy-700/80 text-slate-300 hover:bg-navy-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs">{sc.name}</span>
                    <span className="text-[9px] uppercase px-1.5 py-0.5 rounded font-mono bg-navy-900 border border-navy-700 text-slate-400">
                      {sc.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2">{sc.description}</p>
                </button>
              );
            })}
          </div>

          {/* Active Scenario Card Details */}
          <div className="bg-navy-850 border border-navy-700 rounded-2xl p-5 shadow-xl space-y-4 text-xs">
            <div className="flex items-start justify-between border-b border-navy-700 pb-3">
              <div>
                <h3 className="font-bold text-slate-100 text-sm">{scenario.name}</h3>
                <span className="text-[11px] text-cyan-400">Category: {scenario.category}</span>
              </div>

              <button
                onClick={() => {
                  if (!isRunning) startSimulation();
                  triggerActiveScenario();
                  setActiveTab('digital-twin');
                }}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 text-white font-bold transition shadow-md shadow-cyan-900/30 flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                Run in Twin
              </button>
            </div>

            {/* Factual Context Box for Chinnaswamy Scenario */}
            {scenario.factualBackground && (
              <div className="p-3 bg-navy-950 border border-navy-700 rounded-xl space-y-1 text-slate-300">
                <div className="flex items-center gap-1.5 text-cyan-400 font-semibold text-[11px]">
                  <Info className="w-3.5 h-3.5" />
                  <span>Public Reporting &amp; ICC Factual Reference</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  {scenario.factualBackground}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <div>
                <strong className="text-slate-300 block mb-0.5">Initial Conditions:</strong>
                <p className="text-slate-400">{scenario.initialConditions}</p>
              </div>

              <div>
                <strong className="text-amber-400 block mb-0.5">Anticipated Risks:</strong>
                <ul className="list-disc pl-4 space-y-0.5 text-slate-400">
                  {scenario.expectedRisks.map((risk, idx) => (
                    <li key={idx}>{risk}</li>
                  ))}
                </ul>
              </div>

              <div>
                <strong className="text-emerald-400 block mb-0.5">Completion Criteria:</strong>
                <p className="text-slate-400">{scenario.completionCriteria}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (7 Cols): Available Interventions & Counterfactual Comparison Lab */}
        <div className="lg:col-span-7 space-y-5">
          {/* Interventions Configuration Palette */}
          <div className="bg-navy-850 border border-navy-700 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-navy-700 pb-3">
              <div>
                <h3 className="font-bold text-slate-100 text-sm">
                  Management Interventions Palette
                </h3>
                <p className="text-xs text-slate-400">
                  Select interventions to test against this scenario in the Counterfactual Lab.
                </p>
              </div>
              <button
                onClick={handleRunComparison}
                disabled={isComparing}
                className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 font-bold text-xs text-white transition flex items-center gap-2 shadow-lg shadow-violet-900/30"
              >
                <Split className="w-4 h-4" />
                <span>{isComparing ? 'Simulating...' : 'Run Counterfactual Lab'}</span>
              </button>
            </div>

            {/* Interventions Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {interventions.map((item) => (
                <div
                  key={item.id}
                  onClick={() => toggleIntervention(item.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    item.isActive
                      ? 'bg-violet-950/60 border-violet-500/80 text-violet-200'
                      : 'bg-navy-900 border-navy-700 text-slate-300 hover:bg-navy-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs text-slate-100">{item.name}</span>
                    <input
                      type="checkbox"
                      checked={item.isActive}
                      onChange={() => {}}
                      className="rounded border-navy-600 text-violet-500 focus:ring-violet-500 bg-navy-950"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* COUNTERFACTUAL LAB RESULTS COMPARISON PANEL */}
          <div className="bg-navy-850 border border-navy-700 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-navy-700 pb-3">
              <div className="flex items-center gap-2">
                <Split className="w-5 h-5 text-violet-400" />
                <div>
                  <h3 className="font-bold text-slate-100 text-sm">
                    Counterfactual Safety Comparison (Baseline vs Interventions)
                  </h3>
                  <span className="text-xs text-slate-400">
                    Both runs simulated with deterministic Seed #{randomSeed}
                  </span>
                </div>
              </div>

              {latestComparison && (
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
                    latestComparison.tradeOffAnalysis.verdict === 'IMPROVED'
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                      : 'bg-amber-950 text-amber-300 border-amber-700'
                  }`}
                >
                  Verdict: {latestComparison.tradeOffAnalysis.verdict}
                </span>
              )}
            </div>

            {latestComparison ? (
              <div className="space-y-4 text-xs">
                {/* Metric Side-by-Side Comparison Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-navy-700 text-[11px] text-slate-400 font-semibold">
                        <th className="py-2">Metric Observed</th>
                        <th className="py-2">Baseline (No Plan)</th>
                        <th className="py-2">Intervention Plan</th>
                        <th className="py-2">Delta / Impact</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-navy-800 text-slate-300">
                      <tr>
                        <td className="py-2.5 font-medium">Peak Queue Length</td>
                        <td className="py-2.5 font-mono text-slate-200">
                          {latestComparison.baseline.peakQueueLength} ppl
                        </td>
                        <td className="py-2.5 font-mono text-cyan-300 font-bold">
                          {latestComparison.interventionPlan.peakQueueLength} ppl
                        </td>
                        <td className="py-2.5 font-mono font-bold text-emerald-400">
                          -
                          {Math.max(
                            0,
                            latestComparison.baseline.peakQueueLength -
                              latestComparison.interventionPlan.peakQueueLength
                          )}{' '}
                          ppl
                        </td>
                      </tr>

                      <tr>
                        <td className="py-2.5 font-medium">Max Concourse Density</td>
                        <td className="py-2.5 font-mono text-slate-200">
                          {latestComparison.baseline.maxZoneDensity.toFixed(1)} p/m²
                        </td>
                        <td className="py-2.5 font-mono text-cyan-300 font-bold">
                          {latestComparison.interventionPlan.maxZoneDensity.toFixed(1)} p/m²
                        </td>
                        <td className="py-2.5 font-mono font-bold text-emerald-400">
                          {(
                            latestComparison.interventionPlan.maxZoneDensity -
                            latestComparison.baseline.maxZoneDensity
                          ).toFixed(1)}{' '}
                          p/m²
                        </td>
                      </tr>

                      <tr>
                        <td className="py-2.5 font-medium">Avg Queue Wait Time</td>
                        <td className="py-2.5 font-mono text-slate-200">
                          ~{Math.round(latestComparison.baseline.avgWaitTimeSecs / 60)} mins
                        </td>
                        <td className="py-2.5 font-mono text-cyan-300 font-bold">
                          ~{Math.round(latestComparison.interventionPlan.avgWaitTimeSecs / 60)} mins
                        </td>
                        <td className="py-2.5 font-mono font-bold text-cyan-400">
                          {Math.round(
                            (latestComparison.interventionPlan.avgWaitTimeSecs -
                              latestComparison.baseline.avgWaitTimeSecs) /
                              60
                          )}{' '}
                          mins
                        </td>
                      </tr>

                      <tr>
                        <td className="py-2.5 font-medium">External Holding Occupancy</td>
                        <td className="py-2.5 font-mono text-slate-200">
                          {latestComparison.baseline.externalHoldingOccupancy} ppl
                        </td>
                        <td className="py-2.5 font-mono text-amber-300 font-bold">
                          {latestComparison.interventionPlan.externalHoldingOccupancy} ppl
                        </td>
                        <td className="py-2.5 font-mono font-bold text-amber-400">
                          +
                          {latestComparison.interventionPlan.externalHoldingOccupancy -
                            latestComparison.baseline.externalHoldingOccupancy}{' '}
                          ppl
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Trade-off Analysis & Downstream Consequences Card */}
                <div className="p-3.5 bg-navy-900 rounded-xl border border-navy-700 space-y-2">
                  <div className="flex items-center gap-2 text-cyan-400 font-bold">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Analytical Trade-Off Assessment</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="bg-navy-950 p-2.5 rounded-lg border border-navy-800">
                      <span className="text-emerald-400 font-bold block mb-1">Measured Improvement:</span>
                      <p className="text-slate-300">{latestComparison.tradeOffAnalysis.benefit}</p>
                    </div>

                    <div className="bg-navy-950 p-2.5 rounded-lg border border-navy-800">
                      <span className="text-amber-400 font-bold block mb-1">
                        Downstream Transfer &amp; Unresolved Risk:
                      </span>
                      <p className="text-slate-300">{latestComparison.tradeOffAnalysis.downstreamRisk}</p>
                    </div>
                  </div>
                </div>

                {/* Transferred Risk & New Hotspot Alert Banner */}
                {latestComparison.spatialSummary && (
                  <div
                    className={`p-4 rounded-xl border space-y-3 ${
                      latestComparison.spatialSummary.riskTransferred
                        ? 'bg-red-950/40 border-red-700/80 text-red-200'
                        : latestComparison.spatialSummary.spatialVerdict === 'IMPROVED'
                          ? 'bg-emerald-950/40 border-emerald-700/80 text-emerald-200'
                          : 'bg-navy-900 border-navy-700 text-slate-200'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                      <div className="flex items-center gap-2">
                        {latestComparison.spatialSummary.riskTransferred ? (
                          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                        ) : (
                          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                        )}
                        <div>
                          <h4 className="font-bold text-sm text-slate-100">
                            {latestComparison.spatialSummary.riskTransferred
                              ? 'Transferred Risk Alert: Secondary Hotspot Created'
                              : 'Spatial Congestion Assessment'}
                          </h4>
                          <span className="text-[11px] text-slate-300">
                            Spatial Verdict: <strong className="font-mono">{latestComparison.spatialSummary.spatialVerdict}</strong>
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleInspectOnMap(latestComparison.id)}
                        className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 font-bold text-white text-xs flex items-center gap-1.5 transition shrink-0 shadow"
                      >
                        <Split className="w-3.5 h-3.5" />
                        <span>Inspect on Spatial Diff Map</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">
                      {latestComparison.spatialSummary.plainLanguageSummary}
                    </p>

                    {/* Summary Metric Counters */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
                      <div className="bg-navy-950/80 p-2 rounded-lg border border-white/10">
                        <span className="text-[10px] text-slate-400 block">Relieved Zones</span>
                        <span className="font-mono text-base font-bold text-emerald-400">
                          {latestComparison.spatialSummary.relievedZonesCount}
                        </span>
                      </div>
                      <div className="bg-navy-950/80 p-2 rounded-lg border border-white/10">
                        <span className="text-[10px] text-slate-400 block">New Hotspots</span>
                        <span className="font-mono text-base font-bold text-red-400">
                          {latestComparison.spatialSummary.newHotspotCount}
                        </span>
                      </div>
                      <div className="bg-navy-950/80 p-2 rounded-lg border border-white/10">
                        <span className="text-[10px] text-slate-400 block">Worsened Sectors</span>
                        <span className="font-mono text-base font-bold text-amber-400">
                          {latestComparison.spatialSummary.worsenedZonesCount}
                        </span>
                      </div>
                      <div className="bg-navy-950/80 p-2 rounded-lg border border-white/10">
                        <span className="text-[10px] text-slate-400 block">Stable / Safe</span>
                        <span className="font-mono text-base font-bold text-slate-300">
                          {latestComparison.spatialSummary.unchangedZonesCount}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Zone-by-Zone Congestion Delta Table */}
                {latestComparison.zoneComparisons && latestComparison.zoneComparisons.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <h4 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
                        Zone-by-Zone Crowd Density &amp; Shift Breakdown
                      </h4>

                      {/* Filter Pills */}
                      <div className="flex items-center gap-1 text-[11px]">
                        {(['ALL', 'RELIEVED', 'WORSENED_OR_HOTSPOT'] as const).map((filter) => (
                          <button
                            key={filter}
                            onClick={() => setZoneFilter(filter)}
                            className={`px-2.5 py-1 rounded-md font-medium transition ${
                              zoneFilter === filter
                                ? 'bg-cyan-600 text-white font-bold'
                                : 'bg-navy-950 text-slate-400 hover:text-slate-200 border border-navy-700'
                            }`}
                          >
                            {filter === 'ALL'
                              ? 'All Zones'
                              : filter === 'RELIEVED'
                                ? 'Relieved (▼)'
                                : 'Hotspots / Worsened (▲/!)'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="overflow-x-auto max-h-80 overflow-y-auto border border-navy-700 rounded-xl bg-navy-950/70">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="sticky top-0 bg-navy-900 border-b border-navy-700 text-[10px] text-slate-400 uppercase font-semibold">
                          <tr>
                            <th className="py-2.5 px-3">Zone Sector</th>
                            <th className="py-2.5 px-2">Area</th>
                            <th className="py-2.5 px-2">Threshold</th>
                            <th className="py-2.5 px-2">Baseline</th>
                            <th className="py-2.5 px-2">Plan</th>
                            <th className="py-2.5 px-2">Delta (Δρ)</th>
                            <th className="py-2.5 px-2">Status</th>
                            <th className="py-2.5 px-3">Operational Assessment</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-navy-800 text-slate-300">
                          {latestComparison.zoneComparisons
                            .filter((z) => {
                              if (zoneFilter === 'RELIEVED') return z.status === 'RELIEVED';
                              if (zoneFilter === 'WORSENED_OR_HOTSPOT')
                                return z.status === 'NEW_HOTSPOT' || z.status === 'WORSENED';
                              return true;
                            })
                            .map((z) => (
                              <tr key={z.zoneId} className="hover:bg-navy-900/50 transition">
                                <td className="py-2 px-3">
                                  <div className="font-semibold text-slate-200">{z.zoneName}</div>
                                  <span className="text-[10px] text-slate-500 font-mono">{z.category}</span>
                                </td>
                                <td className="py-2 px-2 font-mono text-[11px] text-slate-400">{z.usableAreaSqM}m²</td>
                                <td className="py-2 px-2 font-mono text-[11px] text-slate-400">{z.maxRecommendedDensity} p/m²</td>
                                <td className="py-2 px-2 font-mono text-[11px]">
                                  {z.baselineDensity.toFixed(1)} <span className="text-[9px] text-slate-500">({z.baselineRisk})</span>
                                </td>
                                <td className="py-2 px-2 font-mono text-[11px] font-bold text-cyan-300">
                                  {z.interventionDensity.toFixed(1)} <span className="text-[9px] text-slate-500">({z.interventionRisk})</span>
                                </td>
                                <td className="py-2 px-2 font-mono text-[11px] font-bold">
                                  <span
                                    className={
                                      z.deltaDensity > 0
                                        ? 'text-amber-400'
                                        : z.deltaDensity < 0
                                          ? 'text-emerald-400'
                                          : 'text-slate-400'
                                    }
                                  >
                                    {z.deltaDensity > 0 ? '+' : ''}{z.deltaDensity.toFixed(2)} p/m²
                                  </span>
                                </td>
                                <td className="py-2 px-2">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold inline-block border ${
                                      z.status === 'NEW_HOTSPOT'
                                        ? 'bg-red-950 text-red-300 border-red-700'
                                        : z.status === 'WORSENED'
                                          ? 'bg-amber-950 text-amber-300 border-amber-700'
                                          : z.status === 'RELIEVED'
                                            ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                                            : 'bg-slate-800 text-slate-300 border-slate-700'
                                    }`}
                                  >
                                    {z.status === 'NEW_HOTSPOT' && '[!] NEW HOTSPOT'}
                                    {z.status === 'WORSENED' && '[▲] Worsened'}
                                    {z.status === 'RELIEVED' && '[▼] Relieved'}
                                    {z.status === 'UNCHANGED' && '[=] Stable'}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-[11px] text-slate-400 max-w-xs leading-relaxed">
                                  {z.description}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-navy-700 rounded-xl space-y-2">
                <p>No counterfactual test executed yet for this scenario.</p>
                <button
                  onClick={handleRunComparison}
                  className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 font-bold text-white transition inline-flex items-center gap-2"
                >
                  <Split className="w-3.5 h-3.5" />
                  Run First Counterfactual Analysis
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

