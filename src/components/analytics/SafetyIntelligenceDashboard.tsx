import React, { useState, useEffect, useMemo } from 'react';
import { useSimulationStore } from '../../state/useSimulationStore';
import { GATE_CONNECTIVITY_CATALOG, INNER_GATE_STAND_CATALOG, getConnectedInnerGates } from '../../stadium/network/gateConnectivity';
import { PredictiveCongestionEngine, PredictiveGateStateInput, PredictionHorizonSec } from '../../engine/PredictiveCongestionEngine';
import { SafetyRecommendationEngine } from '../../engine/SafetyRecommendationEngine';
import { MultiGateRiskCorrelation, CascadingFailureSimulationResult } from '../../engine/MultiGateRiskCorrelation';
import { EventReplayEngine } from '../../engine/EventReplayEngine';
import { SafetyBriefGenerator } from '../../engine/SafetyBriefGenerator';
import {
  ShieldAlert,
  Activity,
  Clock,
  Play,
  Pause,
  RotateCcw,
  Download,
  Printer,
  TrendingUp,
  CheckCircle2,
  Sliders,
  Network,
  FileText,
  Gauge,
  X,
  Cpu
} from 'lucide-react';

export const SafetyIntelligenceDashboard: React.FC = () => {
  const isSafetyIntelligenceOpen = useSimulationStore((s) => s.isSafetyIntelligenceOpen);
  const toggleSafetyIntelligence = useSimulationStore((s) => s.toggleSafetyIntelligence);
  const activeTab = useSimulationStore((s) => s.activeIntelligenceTab);
  const setActiveTab = useSimulationStore((s) => s.setActiveIntelligenceTab);

  const inspectedGateId = useSimulationStore((s) => s.inspectedGateId || 'E22');
  const setInspectedGateId = useSimulationStore((s) => s.setInspectedGateId);
  const predictionHorizon = useSimulationStore((s) => s.predictionHorizonSec);
  const setPredictionHorizon = useSimulationStore((s) => s.setPredictionHorizonSec);

  const recommendations = useSimulationStore((s) => s.recommendations);
  const setRecommendations = useSimulationStore((s) => s.setRecommendations);
  const approveRecommendation = useSimulationStore((s) => s.approveRecommendation);
  const dismissRecommendation = useSimulationStore((s) => s.dismissRecommendation);

  const experimentHistory = useSimulationStore((s) => s.experimentHistory);
  const activeExperimentRecord = useSimulationStore((s) => s.activeExperimentRecord);
  const telemetry = useSimulationStore((s) => s.telemetry);
  const microGateMetrics = useSimulationStore((s) => s.microGateMetrics);
  const inflowRate = useSimulationStore((s) => s.inflowRate);
  const scannerFailureActive = useSimulationStore((s) => s.scannerFailureActive);
  const counterFlowActive = useSimulationStore((s) => s.counterFlowActive);

  // Replay State
  const activeReplayRecord = useSimulationStore((s) => s.activeReplayRecord) || activeExperimentRecord || (experimentHistory.length > 0 ? experimentHistory[0] : null);
  const replayTime = useSimulationStore((s) => s.replayPlaybackTime);
  const setReplayTime = useSimulationStore((s) => s.setReplayPlaybackTime);
  const isReplayPlaying = useSimulationStore((s) => s.isReplayPlaying);
  const toggleReplayPlay = useSimulationStore((s) => s.toggleReplayPlay);
  const replaySpeed = useSimulationStore((s) => s.replaySpeed);
  const setReplaySpeed = useSimulationStore((s) => s.setReplaySpeed);

  // Benchmarking State
  const benchmarkResults = useSimulationStore((s) => s.benchmarkSuiteResults);
  const runBatchBenchmarkSuite = useSimulationStore((s) => s.runBatchBenchmarkSuite);
  const [isBenchmarkingRunning, setIsBenchmarkingRunning] = useState(false);

  // Cascading failure inspection state
  const [cascadingTargetGate, setCascadingTargetGate] = useState<string>('E22');

  if (!isSafetyIntelligenceOpen) return null;

  // 1. Synthesize Gate Telemetry Inputs for Predictive Engine
  const allGateInputs: PredictiveGateStateInput[] = useMemo(() => {
    return Object.keys(GATE_CONNECTIVITY_CATALOG).map((ogId) => {
      const isInspected = ogId === inspectedGateId;
      const connectedInners = getConnectedInnerGates(ogId);
      const isFailed = scannerFailureActive && (ogId === 'E22' || ogId === 'E1');

      const gateCap = connectedInners.reduce((sum, igId) => {
        return sum + (INNER_GATE_STAND_CATALOG[igId]?.nominalThroughputPerMin || 240);
      }, 0);

      const effectiveCap = isFailed ? Math.round(gateCap * 0.25) : gateCap;
      const currentArrival = isInspected
        ? inflowRate
        : Math.round(inflowRate * (ogId === 'E11' || ogId === 'E18' ? 1.2 : 0.8));

      const queue = isInspected && microGateMetrics
        ? microGateMetrics.waitingInQueues
        : Math.round(Math.max(0, (currentArrival - effectiveCap) * 0.3));

      const throatDensity = isInspected && microGateMetrics
        ? microGateMetrics.zone3ThroatDensity
        : Math.round(Math.min(5.5, (queue / 80) + 0.4) * 10) / 10;

      const approachDensity = isInspected && microGateMetrics
        ? microGateMetrics.zone1ApproachDensity
        : Math.round(Math.min(4.8, (queue / 120) + 0.2) * 10) / 10;

      const holdingCapacity = GATE_CONNECTIVITY_CATALOG[ogId]?.holdingCapacity || 450;
      const spillback = queue > holdingCapacity ? Math.round((queue - holdingCapacity) * 0.08 * 10) / 10 : 0;

      return {
        gateId: ogId,
        currentQueue: queue,
        arrivalRatePerMin: currentArrival,
        effectiveCapacityPerMin: effectiveCap,
        currentThroatDensity: throatDensity,
        currentApproachDensity: approachDensity,
        currentSpillbackMeters: spillback,
        holdingAreaCapacity: holdingCapacity,
        throatAreaM2: 80,
        holdingAreaM2: 250,
        approachAreaM2: 120,
        counterFlowActive: isInspected ? counterFlowActive : false
      };
    });
  }, [inspectedGateId, inflowRate, scannerFailureActive, counterFlowActive, microGateMetrics]);

  // 2. Compute Stadium-Wide & Gate-Specific Forecasts
  const stadiumForecast = useMemo(() => {
    return PredictiveCongestionEngine.forecastStadium(allGateInputs, predictionHorizon);
  }, [allGateInputs, predictionHorizon]);

  // 3. Compute Recommendations
  useEffect(() => {
    const recs = SafetyRecommendationEngine.generateRecommendations(allGateInputs, stadiumForecast.gateForecasts);
    if (recommendations.length === 0) {
      setRecommendations(recs);
    }
  }, [allGateInputs, stadiumForecast]);

  // 4. Replay Timeline Data
  const replayTimeline = useMemo(() => {
    if (!activeReplayRecord) return [];
    return EventReplayEngine.generateTimeline(activeReplayRecord, 1.0);
  }, [activeReplayRecord]);

  // 5. Replay Playback Timer
  useEffect(() => {
    let interval: any = null;
    if (isReplayPlaying && activeReplayRecord) {
      const maxTime = activeReplayRecord.simulationDurationSeconds || 60;
      interval = setInterval(() => {
        setReplayTime((prev) => {
          if (prev >= maxTime) {
            toggleReplayPlay();
            return 0;
          }
          return Math.min(maxTime, Math.round((prev + 1.0 * replaySpeed) * 10) / 10);
        });
      }, 1000 / replaySpeed);
    }
    return () => clearInterval(interval);
  }, [isReplayPlaying, replaySpeed, activeReplayRecord]);

  // 6. Current Timeline Replay Point
  const currentReplayPoint = useMemo(() => {
    if (replayTimeline.length === 0) return null;
    const idx = Math.min(replayTimeline.length - 1, Math.floor(replayTime));
    return replayTimeline[idx] || replayTimeline[0];
  }, [replayTimeline, replayTime]);

  // 7. Cascading Risk Result
  const cascadingResult: CascadingFailureSimulationResult = useMemo(() => {
    return MultiGateRiskCorrelation.simulateCascadingRisk(cascadingTargetGate);
  }, [cascadingTargetGate]);

  // 8. Stadium Dependency Graph
  const dependencyGraph = useMemo(() => {
    return MultiGateRiskCorrelation.buildDependencyGraph(
      {},
      scannerFailureActive ? ['E22', 'G7'] : []
    );
  }, [scannerFailureActive]);

  // 9. Safety Brief Data for 10-Section Report
  const currentBrief = useMemo(() => {
    const rec = activeExperimentRecord || (experimentHistory.length > 0 ? experimentHistory[0] : null);
    if (!rec) return null;
    return SafetyBriefGenerator.generateBriefData(rec);
  }, [activeExperimentRecord, experimentHistory]);

  const handleRunBenchmarking = async () => {
    setIsBenchmarkingRunning(true);
    await new Promise((r) => setTimeout(r, 80));
    runBatchBenchmarkSuite();
    setIsBenchmarkingRunning(false);
  };

  const getWarningBadge = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return 'bg-rose-950/80 border-rose-500 text-rose-300 animate-pulse font-bold';
      case 'CONGESTED':
        return 'bg-orange-950/80 border-orange-500 text-orange-300 font-bold';
      case 'WATCH':
        return 'bg-amber-950/80 border-amber-500 text-amber-300';
      default:
        return 'bg-emerald-950/80 border-emerald-500 text-emerald-300';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-md select-none animate-fade-in">
      <div className="relative w-full max-w-7xl max-h-[96vh] flex flex-col bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
        
        {/* 1. Header & Navigation Command Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-6 py-3.5 bg-slate-950 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-950/60 font-black text-slate-950">
              <Activity className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-extrabold text-slate-100 tracking-wide">
                  SAFETY INTELLIGENCE & OPERATIONAL DECISION SUPPORT
                </h2>
                <span className={`px-2 py-0.5 text-[10px] font-mono rounded-full border ${getWarningBadge(stadiumForecast.overallWarningLevel)}`}>
                  {stadiumForecast.overallWarningLevel} STATUS
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Phase 4: Predictive Forecasting, Explainable Recommendations & Human-in-the-Loop Permitting
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Prediction Horizon Selector */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[11px] text-slate-400">Horizon:</span>
              {[30, 60, 120, 300].map((h) => (
                <button
                  key={h}
                  onClick={() => setPredictionHorizon(h as PredictionHorizonSec)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition ${
                    predictionHorizon === h
                      ? 'bg-cyan-600 text-slate-950'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {h}s
                </button>
              ))}
            </div>

            <button
              onClick={toggleSafetyIntelligence}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 transition"
              title="Close Dashboard"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. Operational Navigation Tabs */}
        <div className="flex items-center gap-1 px-6 py-2 bg-slate-950/90 border-b border-slate-800/80 overflow-x-auto text-xs shrink-0 font-medium">
          <button
            onClick={() => setActiveTab('OVERVIEW')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              activeTab === 'OVERVIEW'
                ? 'bg-cyan-950 text-cyan-300 border border-cyan-700 font-bold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Gauge className="w-3.5 h-3.5" />
            <span>Safety Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('PREDICTION')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              activeTab === 'PREDICTION'
                ? 'bg-cyan-950 text-cyan-300 border border-cyan-700 font-bold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Predictive Congestion</span>
          </button>

          <button
            onClick={() => setActiveTab('RECOMMENDATIONS')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              activeTab === 'RECOMMENDATIONS'
                ? 'bg-cyan-950 text-cyan-300 border border-cyan-700 font-bold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
            <span>Actionable Recommendations</span>
            {recommendations.filter((r) => r.status === 'PENDING').length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-purple-600 text-white font-mono">
                {recommendations.filter((r) => r.status === 'PENDING').length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('DEPENDENCIES')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              activeTab === 'DEPENDENCIES'
                ? 'bg-cyan-950 text-cyan-300 border border-cyan-700 font-bold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span>Multi-Gate Dependency Graph</span>
          </button>

          <button
            onClick={() => setActiveTab('COMPARISONS')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              activeTab === 'COMPARISONS'
                ? 'bg-cyan-950 text-cyan-300 border border-cyan-700 font-bold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Intervention Comparison</span>
          </button>

          <button
            onClick={() => setActiveTab('REPLAY')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              activeTab === 'REPLAY'
                ? 'bg-cyan-950 text-cyan-300 border border-cyan-700 font-bold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Play className="w-3.5 h-3.5 text-emerald-400" />
            <span>Historical Replay</span>
          </button>

          <button
            onClick={() => setActiveTab('BENCHMARK')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              activeTab === 'BENCHMARK'
                ? 'bg-cyan-950 text-cyan-300 border border-cyan-700 font-bold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-indigo-400" />
            <span>Benchmarking Lab</span>
          </button>

          <button
            onClick={() => setActiveTab('BRIEF')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              activeTab === 'BRIEF'
                ? 'bg-cyan-950 text-cyan-300 border border-cyan-700 font-bold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-amber-400" />
            <span>10-Section Brief & Export</span>
          </button>
        </div>

        {/* 3. Main Operational Work Area */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">
          
          {/* TAB 1: SAFETY OVERVIEW */}
          {activeTab === 'OVERVIEW' && (
            <div className="space-y-5">
              {/* Stadium-Wide Safety Status Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 font-mono">
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Venue Capacity</div>
                  <div className="text-base font-bold text-slate-100 mt-1">35,000 Seats</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Seated: {telemetry.liveAgents + 14200}</div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Waiting In Queues</div>
                  <div className="text-base font-bold text-amber-400 mt-1">{stadiumForecast.totalWaitingCurrent} persons</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Predicted ({predictionHorizon}s): {stadiumForecast.totalWaitingPredicted}</div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Active Outer Gates</div>
                  <div className="text-base font-bold text-cyan-400 mt-1">23 Gates (E1–E23)</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">17 General · 6 VIP/Media</div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Inner Turnstiles</div>
                  <div className="text-base font-bold text-emerald-400 mt-1">15 Banks (G1–G15)</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Capacity: 3,900 p/min</div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 col-span-2 sm:col-span-1">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Net Inflow Growth</div>
                  <div className={`text-base font-bold mt-1 ${stadiumForecast.netQueueGrowthRatePerMin > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {stadiumForecast.netQueueGrowthRatePerMin > 0 ? '+' : ''}{stadiumForecast.netQueueGrowthRatePerMin} p/min
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Across all sectors</div>
                </div>
              </div>

              {/* Gate Inspector & Sector Grid */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Gate-Level Operational Safety Overview
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Click any gate to inspect real-time arrival rate, throat density, queue population, and failure status.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-mono">Inspecting:</span>
                    <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-700 text-cyan-300 font-bold font-mono text-xs">
                      {inspectedGateId}
                    </span>
                  </div>
                </div>

                {/* Gate Selector Pills */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {allGateInputs.map((g) => {
                    const isSelected = g.gateId === inspectedGateId;
                    const fcast = stadiumForecast.gateForecasts[g.gateId];
                    return (
                      <button
                        key={g.gateId}
                        onClick={() => setInspectedGateId(g.gateId)}
                        className={`px-2.5 py-1 rounded-lg border font-mono text-xs transition flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-cyan-600 text-slate-950 font-bold border-cyan-400 shadow-md'
                            : fcast?.warningLevel === 'CRITICAL'
                            ? 'bg-rose-950/70 border-rose-600 text-rose-300'
                            : fcast?.warningLevel === 'CONGESTED'
                            ? 'bg-orange-950/70 border-orange-600 text-orange-300'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <span>{g.gateId}</span>
                        <span className="text-[9px] opacity-75">{g.currentQueue}p</span>
                      </button>
                    );
                  })}
                </div>

                {/* Inspected Gate Details Card */}
                {(() => {
                  const insGate = allGateInputs.find((g) => g.gateId === inspectedGateId) || allGateInputs[0];
                  const insForecast = stadiumForecast.gateForecasts[insGate.gateId];
                  const insSpec = GATE_CONNECTIVITY_CATALOG[insGate.gateId];
                  const connectedInners = getConnectedInnerGates(insGate.gateId);

                  return (
                    <div className="mt-4 p-4 rounded-xl bg-slate-900/90 border border-slate-700 grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-mono">
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase">Sector & Connectivity</div>
                        <div className="text-sm font-bold text-slate-100 mt-1">{insGate.gateId} — {insSpec?.road.replace('_', ' ')}</div>
                        <div className="text-slate-400 text-[11px] mt-1">
                          Connected Inner Banks: <strong className="text-cyan-300">{connectedInners.join(', ') || 'Direct'}</strong>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1">
                          Permission: <span className="text-slate-300">{insSpec?.accessPermission}</span>
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] text-slate-400 uppercase">Flow Demand vs Capacity</div>
                        <div className="flex items-baseline gap-2 mt-1">
                          <span className="text-sm font-bold text-slate-100">{insGate.arrivalRatePerMin} p/min</span>
                          <span className="text-[10px] text-slate-400">/ {insGate.effectiveCapacityPerMin} cap</span>
                        </div>
                        <div className="text-slate-400 text-[11px] mt-1">
                          Utilization: <strong className={insForecast?.turnstileUtilizationPercent >= 100 ? 'text-rose-400' : 'text-emerald-400'}>
                            {insForecast?.turnstileUtilizationPercent}%
                          </strong>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1">
                          Holding Buffer: {insGate.holdingAreaCapacity} persons max
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] text-slate-400 uppercase">Density & Queue Status</div>
                        <div className="flex items-baseline gap-2 mt-1">
                          <span className="text-sm font-bold text-slate-100">{insGate.currentThroatDensity} p/m²</span>
                          <span className="text-[10px] text-slate-400">(Throat)</span>
                        </div>
                        <div className="text-slate-400 text-[11px] mt-1">
                          Queue: <strong>{insGate.currentQueue} persons</strong>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1">
                          Road Spillback: {insGate.currentSpillbackMeters}m
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] text-slate-400 uppercase">Forecast ({predictionHorizon}s)</div>
                        <div className="text-sm font-bold text-purple-300 mt-1">
                          {insForecast?.predictedQueue} persons (±{insForecast?.uncertaintyMargin})
                        </div>
                        <div className="text-slate-400 text-[11px] mt-1">
                          Projected Throat: <strong>{insForecast?.predictedThroatDensity} p/m²</strong>
                        </div>
                        <div className={`text-[10px] font-bold mt-1 ${insForecast?.warningLevel === 'CRITICAL' ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {insForecast?.summaryText}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* TAB 2: PREDICTIVE CONGESTION */}
          {activeTab === 'PREDICTION' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Near-Future Predictive Congestion Analysis (Horizon: {predictionHorizon}s)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Calculated using conservative conservation formula: Q(t+Δt) = max(0, Q(t) + (λ - μ) × Δt) with Poisson uncertainty bounds.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-slate-400">Forecast Status:</span>
                  <span className={`px-2 py-0.5 rounded border text-[11px] ${getWarningBadge(stadiumForecast.overallWarningLevel)}`}>
                    {stadiumForecast.overallWarningLevel}
                  </span>
                </div>
              </div>

              {/* Predictive Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-3">Gate</th>
                      <th className="p-3">Sector</th>
                      <th className="p-3">Current Q</th>
                      <th className="p-3">Arrival Rate</th>
                      <th className="p-3">Processing Cap</th>
                      <th className="p-3">Predicted Q ({predictionHorizon}s)</th>
                      <th className="p-3">Predicted Density</th>
                      <th className="p-3">Spillback</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
                    {allGateInputs.slice(0, 10).map((g) => {
                      const fcast = stadiumForecast.gateForecasts[g.gateId];
                      const spec = GATE_CONNECTIVITY_CATALOG[g.gateId];
                      return (
                        <tr key={g.gateId} className="hover:bg-slate-800/40">
                          <td className="p-3 font-bold text-slate-200">{g.gateId}</td>
                          <td className="p-3 text-slate-400">{spec?.road.replace('_', ' ')}</td>
                          <td className="p-3 text-slate-300">{g.currentQueue}p</td>
                          <td className="p-3 text-cyan-300">{g.arrivalRatePerMin} p/m</td>
                          <td className="p-3 text-slate-300">{g.effectiveCapacityPerMin} p/m</td>
                          <td className="p-3 font-bold text-purple-300">
                            {fcast?.predictedQueue}p <span className="text-[10px] text-slate-500">(±{fcast?.uncertaintyMargin})</span>
                          </td>
                          <td className="p-3 font-bold text-slate-200">
                            {fcast?.predictedThroatDensity} p/m²
                          </td>
                          <td className="p-3 text-slate-400">
                            {fcast?.predictedRoadSpillbackMeters > 0 ? `${fcast.predictedRoadSpillbackMeters}m` : '0m'}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] border ${getWarningBadge(fcast?.warningLevel || 'NORMAL')}`}>
                              {fcast?.warningLevel}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Forecasting Assumptions Box */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Model Assumptions & Verification Safeguards
                </span>
                <ul className="space-y-1 text-xs text-slate-400">
                  {stadiumForecast.forecastAssumptions.map((a, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-cyan-400 font-bold">›</span>
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* TAB 3: ACTIONABLE RECOMMENDATIONS & HUMAN APPROVAL */}
          {activeTab === 'RECOMMENDATIONS' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Explainable Operational Safety Recommendations
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Human-in-the-Loop Decision Support: Operational interventions require explicit human authorization before execution.
                  </p>
                </div>
                <span className="text-xs font-mono text-purple-300">
                  {recommendations.filter((r) => r.status === 'PENDING').length} Pending Actions
                </span>
              </div>

              {recommendations.length === 0 ? (
                <div className="p-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
                  Zero active safety recommendations. All stadium sectors are operating within laminar safety envelopes.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3.5">
                  {recommendations.map((rec) => (
                    <div
                      key={rec.id}
                      className={`p-4 rounded-xl border transition ${
                        rec.status === 'APPROVED'
                          ? 'bg-emerald-950/30 border-emerald-700/80 opacity-75'
                          : rec.status === 'DISMISSED'
                          ? 'bg-slate-950/40 border-slate-800 opacity-50'
                          : 'bg-slate-950/80 border-purple-500/80 shadow-lg shadow-purple-950/30'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="p-1.5 rounded-lg bg-purple-950 border border-purple-700 text-purple-300">
                            <ShieldAlert className="w-4 h-4" />
                          </span>
                          <div>
                            <h4 className="font-bold text-sm text-slate-100">{rec.title}</h4>
                            <span className="text-[10px] font-mono text-purple-400">
                              CATEGORY: {rec.category} · TARGET: {rec.targetGate}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 font-mono text-xs">
                          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 text-[10px]">
                            {rec.confidenceLevel}% CONFIDENCE
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            rec.status === 'APPROVED' ? 'bg-emerald-950 text-emerald-300 border border-emerald-600' :
                            rec.status === 'DISMISSED' ? 'bg-slate-900 text-slate-400 border border-slate-700' :
                            'bg-purple-950 text-purple-300 border border-purple-600'
                          }`}>
                            {rec.status}
                          </span>
                        </div>
                      </div>

                      {/* Problem & Supporting Measurements */}
                      <div className="mt-3 space-y-2 text-xs">
                        <p className="text-slate-300 leading-relaxed">
                          <strong>Problem Detected:</strong> {rec.problemDetected}
                        </p>

                        <div className="flex flex-wrap gap-2 pt-1 font-mono">
                          {rec.supportingMeasurements.map((m, i) => (
                            <div key={i} className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-[11px]">
                              <span className="text-slate-400">{m.label}: </span>
                              <strong className="text-cyan-300">{m.value}</strong>
                              <span className="text-slate-500 text-[9px] block">({m.threshold})</span>
                            </div>
                          ))}
                        </div>

                        <div className="pt-2 text-slate-300">
                          <strong>Recommended Intervention:</strong> {rec.recommendedIntervention}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
                          <div className="p-2 rounded bg-emerald-950/40 border border-emerald-800/60 text-emerald-300">
                            <strong>Expected Benefit:</strong> {rec.expectedBenefit}
                          </div>
                          <div className="p-2 rounded bg-amber-950/40 border border-amber-800/60 text-amber-300">
                            <strong>Possible Side Effects:</strong> {rec.possibleSideEffects}
                          </div>
                        </div>
                      </div>

                      {/* Action Approval Controls */}
                      {rec.status === 'PENDING' && (
                        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                          <span className="text-[10px] text-slate-500 font-mono">
                            Human operator confirmation required prior to physical deployment.
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => dismissRecommendation(rec.id)}
                              className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-400 text-xs font-semibold transition"
                            >
                              Dismiss
                            </button>
                            <button
                              onClick={() => approveRecommendation(rec.id)}
                              className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-950 transition flex items-center gap-1.5"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Approve & Execute</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: MULTI-GATE DEPENDENCIES & CASCADING SIMULATOR */}
          {activeTab === 'DEPENDENCIES' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Stadium-Wide Multi-Gate Topological Dependencies
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Simulates multi-gate risk propagation: failure at one gate redistributes pressure across shared inner banks and destination stands.
                </p>
              </div>

              {/* Cascading Simulator Selector */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-bold uppercase">Simulate Failure at Outer Gate</span>
                  <select
                    value={cascadingTargetGate}
                    onChange={(e) => setCascadingTargetGate(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200"
                  >
                    <option value="E22">E22 — Cubbon Road (G7/G8 C-Stand)</option>
                    <option value="E18">E18 — Cubbon Road East (G9/G10)</option>
                    <option value="E11">E11 — Link Road / MG Metro (G15)</option>
                    <option value="E12">E12 — Link Road (G14/G15)</option>
                  </select>
                </div>

                {/* Cascading Result Card */}
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-700 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-200">
                      Cascading Risk Score: <strong className={cascadingResult.cascadingRiskScore >= 60 ? 'text-rose-400' : 'text-amber-400'}>{cascadingResult.cascadingRiskScore}/100</strong>
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Primary Sector: {cascadingResult.primaryImpactSector}
                    </span>
                  </div>

                  <p className="text-slate-300 text-xs">
                    {cascadingResult.cascadingWarning}
                  </p>

                  <div className="pt-2 border-t border-slate-800 space-y-2">
                    <div className="text-[11px] text-slate-400 uppercase font-semibold">Shared Turnstile Bank Load Impact:</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {cascadingResult.sharedTurnstileLoad.map((bank) => (
                        <div key={bank.innerGateId} className={`p-2.5 rounded-lg border ${bank.willChoke ? 'bg-rose-950/40 border-rose-600/80 text-rose-200' : 'bg-slate-950 border-slate-800 text-slate-300'}`}>
                          <div className="font-bold text-xs">{bank.innerGateId} ({bank.standName})</div>
                          <div className="text-[11px] mt-1">
                            Combined Reroute Load: <strong>{bank.combinedDemandIfReroutedPerMin} p/min</strong> / {bank.availableCapacityPerMin} cap
                          </div>
                          {bank.willChoke && (
                            <div className="text-[10px] text-rose-400 font-bold mt-0.5">
                              ⚠️ WILL CHOKE: Exceeds maximum turnstile throughput!
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-purple-950/50 border border-purple-700/60 text-purple-200 text-xs mt-2">
                    <strong>Recommended Network Adjustment:</strong> {cascadingResult.recommendedNetworkAdjustment}
                  </div>
                </div>
              </div>

              {/* Sector Load Balancing & Network Bottlenecks */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-bold uppercase">Sector Load Balancing & Network Bottlenecks</span>
                  <span className="text-[10px] text-slate-500">
                    Critical Bottlenecks: <strong className="text-rose-400">{dependencyGraph.criticalNetworkBottlenecks.join(', ') || 'None'}</strong>
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  {Object.entries(dependencyGraph.sectorLoadBalancing).map(([sec, data]) => (
                    <div key={sec} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">{sec.replace('_', ' ')}</div>
                      <div className="text-xs font-bold text-slate-200 mt-1">{data.totalSectorInflow} p/m / {data.totalSectorCapacity} cap</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Utilization: <strong className={data.sectorUtilization >= 95 ? 'text-rose-400' : 'text-emerald-400'}>{data.sectorUtilization}%</strong></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: INTERVENTION COMPARISON & PERFORMANCE ANALYTICS */}
          {activeTab === 'COMPARISONS' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Controlled Intervention Performance Analytics
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Calculates Percentage Safety Improvement = ((Baseline - Intervention) / Baseline) × 100 under matched seed S.
                </p>
              </div>

              {experimentHistory.length === 0 ? (
                <div className="p-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
                  No completed experiment trials recorded yet. Run a matched experiment in the Scenario Lab to view comparative analytics.
                </div>
              ) : (
                <div className="space-y-3">
                  {experimentHistory.map((rec) => {
                    const brief = SafetyBriefGenerator.generateBriefData(rec);
                    return (
                      <div key={rec.experimentId} className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3 font-mono text-xs">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
                          <div>
                            <span className="font-bold text-sm text-slate-200">{rec.scenarioName}</span>
                            <span className="text-[10px] text-slate-500 ml-2">Seed: S = {rec.seed}</span>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-purple-300 font-bold text-xs">
                            {rec.safetyVerdict.verdict}
                          </span>
                        </div>

                        {/* Comparative KPI Bar */}
                        <div className="grid grid-cols-3 gap-3">
                          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                            <span className="text-[10px] text-slate-400 block uppercase">Density Improvement</span>
                            <span className={`text-base font-bold ${brief.section6_ComparativeResults.densityImprovementPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {brief.section6_ComparativeResults.densityImprovementPercent}%
                            </span>
                          </div>

                          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                            <span className="text-[10px] text-slate-400 block uppercase">Wait Time Improvement</span>
                            <span className={`text-base font-bold ${brief.section6_ComparativeResults.waitTimeImprovementPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {brief.section6_ComparativeResults.waitTimeImprovementPercent}%
                            </span>
                          </div>

                          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                            <span className="text-[10px] text-slate-400 block uppercase">Displacement Status</span>
                            <span className="text-base font-bold text-slate-200">
                              {brief.section7_DisplacementAnalysis.isDisplacementDetected ? 'DISPLACED' : 'CONTAINED'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 6: HISTORICAL REPLAY */}
          {activeTab === 'REPLAY' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-mono">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Deterministic Simulation Replay Player
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Replays stored experiment data with time scrubbing without regenerating synthetic state.
                  </p>
                </div>
                {activeReplayRecord && (
                  <span className="text-xs text-purple-300 font-bold">
                    {activeReplayRecord.scenarioName} (Seed: {activeReplayRecord.seed})
                  </span>
                )}
              </div>

              {/* Player Controls Bar */}
              <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-3 font-mono">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={toggleReplayPlay}
                      className="p-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold transition"
                    >
                      {isReplayPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                    </button>
                    <button
                      onClick={() => setReplayTime(0)}
                      className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <span className="text-slate-200 font-bold ml-2">
                      {replayTime.toFixed(1)}s / {(activeReplayRecord?.simulationDurationSeconds || 60)}s
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-[11px]">
                    <span className="text-slate-400 mr-1">Speed:</span>
                    {[0.5, 1, 2, 4].map((s) => (
                      <button
                        key={s}
                        onClick={() => setReplaySpeed(s)}
                        className={`px-2 py-0.5 rounded ${
                          replaySpeed === s ? 'bg-purple-600 text-white font-bold' : 'bg-slate-900 text-slate-400 hover:text-white'
                        }`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Timeline Scrubber Slider */}
                <input
                  type="range"
                  min="0"
                  max={activeReplayRecord?.simulationDurationSeconds || 60}
                  step="0.5"
                  value={replayTime}
                  onChange={(e) => setReplayTime(Number(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
                />

                {/* Side-by-Side Timeline Metrics at currentReplayPoint */}
                {currentReplayPoint && (
                  <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                    {/* Baseline Snapshot */}
                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Run A: Baseline (No Intervention)</span>
                      <div className="flex justify-between text-slate-300">
                        <span>Admitted: <strong>{currentReplayPoint.baseline.admitted}</strong></span>
                        <span>Queue: <strong>{currentReplayPoint.baseline.queue}p</strong></span>
                        <span>Throat: <strong className="text-amber-400">{currentReplayPoint.baseline.throatDensity} p/m²</strong></span>
                      </div>
                    </div>

                    {/* Intervention Snapshot */}
                    <div className="p-3 rounded-lg bg-purple-950/40 border border-purple-800/80 space-y-1">
                      <span className="text-[10px] text-purple-300 uppercase font-semibold">Run B: Intervention (Applied Safety)</span>
                      <div className="flex justify-between text-purple-200">
                        <span>Admitted: <strong>{currentReplayPoint.intervention.admitted}</strong></span>
                        <span>Queue: <strong>{currentReplayPoint.intervention.queue}p</strong></span>
                        <span>Throat: <strong className="text-emerald-400">{currentReplayPoint.intervention.throatDensity} p/m²</strong></span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 7: BENCHMARKING LAB */}
          {activeTab === 'BENCHMARK' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-mono">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Parametric Benchmarking Lab (Batch Sweeps)
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Sweeps across arrival rates (240 to 720 p/min), turnstile failures, and counter-flow stress with seed-locked reproducibility.
                  </p>
                </div>
                <button
                  onClick={handleRunBenchmarking}
                  disabled={isBenchmarkingRunning}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-md transition disabled:opacity-50 flex items-center gap-2"
                >
                  <Cpu className="w-4 h-4" />
                  <span>{isBenchmarkingRunning ? 'Executing Sweep...' : 'Run Standard Parametric Suite'}</span>
                </button>
              </div>

              {benchmarkResults.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-slate-800 font-mono text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="p-3">Trial Suite</th>
                        <th className="p-3">Inflow</th>
                        <th className="p-3">Turnstiles</th>
                        <th className="p-3">Interventions</th>
                        <th className="p-3">Peak Density</th>
                        <th className="p-3">Wait Time</th>
                        <th className="p-3">Safety Imp.</th>
                        <th className="p-3">Verdict</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
                      {benchmarkResults.map((res) => (
                        <tr key={res.config.trialId} className="hover:bg-slate-800/40">
                          <td className="p-3 font-bold text-slate-200">{res.config.name}</td>
                          <td className="p-3 text-cyan-300">{res.config.arrivalRate} p/m</td>
                          <td className="p-3 text-slate-300">{res.config.turnstileCount} counters</td>
                          <td className="p-3 text-purple-300">{res.config.interventions.join(', ')}</td>
                          <td className="p-3 font-bold text-slate-200">{res.peakThroatDensity} p/m²</td>
                          <td className="p-3 text-slate-300">{res.averageWaitTimeSec.toFixed(1)}s</td>
                          <td className="p-3 font-bold text-emerald-400">+{res.percentageSafetyImprovement}%</td>
                          <td className="p-3 font-bold text-slate-200">{res.verdict}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 8: 10-SECTION BRIEF & EXPORT */}
          {activeTab === 'BRIEF' && currentBrief && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-mono">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Official 10-Section Event Safety Brief
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Formal documentation for venue safety permitting, disaster management authorities, and police compliance audits.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => SafetyBriefGenerator.downloadCSV(activeExperimentRecord || experimentHistory[0])}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold transition"
                  >
                    <Download className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Export CSV</span>
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 text-xs font-bold transition shadow"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print PDF Brief</span>
                  </button>
                </div>
              </div>

              {/* Formatted 10 Sections */}
              <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-6 text-xs text-slate-300 font-sans">
                {/* Section 1 */}
                <div className="border-b border-slate-800 pb-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-2 font-mono">
                    Section 1 — Executive Summary
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
                    <div>Venue: <strong className="text-white block">{currentBrief.section1_ExecutiveSummary.venue}</strong></div>
                    <div>Experiment ID: <strong className="text-white block">{currentBrief.section1_ExecutiveSummary.experimentId}</strong></div>
                    <div>Verdict: <strong className="text-purple-300 block">{currentBrief.section1_ExecutiveSummary.safetyVerdict}</strong></div>
                    <div>Permit Officer: <strong className="text-emerald-400 block">{currentBrief.section1_ExecutiveSummary.permitOfficerAction}</strong></div>
                  </div>
                </div>

                {/* Section 2 */}
                <div className="border-b border-slate-800 pb-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-2 font-mono">
                    Section 2 — Stadium Configuration & Topology
                  </h4>
                  <p className="text-slate-400">
                    Venue Capacity: 35,000 spectators across 4 arterial roads. Active perimeter ingress gates: {currentBrief.section2_StadiumConfiguration.activeOuterGates.join(', ')}. Connected inner turnstiles: {currentBrief.section2_StadiumConfiguration.innerGateTopology.join(', ')} ({currentBrief.section2_StadiumConfiguration.turnstileCount} total operational counters).
                  </p>
                </div>

                {/* Section 3 */}
                <div className="border-b border-slate-800 pb-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-2 font-mono">
                    Section 3 — Scenario Description & Failure Conditions
                  </h4>
                  <p className="text-slate-400">
                    Scenario: {currentBrief.section1_ExecutiveSummary.scenarioName}. Ingress demand profile: {currentBrief.section3_ScenarioDescription.initialDemandRatePerMin} p/min. Stress conditions: {currentBrief.section3_ScenarioDescription.failureConditions}. Duration: {currentBrief.section3_ScenarioDescription.durationSeconds}s.
                  </p>
                </div>

                {/* Section 4 */}
                <div className="border-b border-slate-800 pb-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-2 font-mono">
                    Section 4 — Baseline Ingress Analysis (Run A)
                  </h4>
                  <p className="text-slate-400">
                    Under unmitigated baseline conditions, turnstile throat density peaked at {currentBrief.section4_BaselineAnalysis.peakThroatDensity} p/m² with an average waiting time of {currentBrief.section4_BaselineAnalysis.avgWaitTimeSec.toFixed(1)}s and {currentBrief.section4_BaselineAnalysis.admittedTotal} spectators cleared.
                  </p>
                </div>

                {/* Section 5 */}
                <div className="border-b border-slate-800 pb-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-2 font-mono">
                    Section 5 — Applied Safety Interventions (Run B)
                  </h4>
                  <ul className="space-y-1 text-slate-400">
                    {currentBrief.section5_InterventionAnalysis.operationalChanges.map((c, i) => (
                      <li key={i}>• {c}</li>
                    ))}
                  </ul>
                </div>

                {/* Section 6 */}
                <div className="border-b border-slate-800 pb-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-2 font-mono">
                    Section 6 — Matched Comparative Results
                  </h4>
                  <div className="grid grid-cols-3 gap-3 font-mono">
                    <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                      Throughput Change: <strong className="text-cyan-300 block">{currentBrief.section6_ComparativeResults.throughputImprovementPercent}%</strong>
                    </div>
                    <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                      Wait Time Reduction: <strong className="text-emerald-400 block">{currentBrief.section6_ComparativeResults.waitTimeImprovementPercent}%</strong>
                    </div>
                    <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                      Density Compression Relief: <strong className="text-purple-300 block">{currentBrief.section6_ComparativeResults.densityImprovementPercent}%</strong>
                    </div>
                  </div>
                </div>

                {/* Section 7 */}
                <div className="border-b border-slate-800 pb-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-2 font-mono">
                    Section 7 — Upstream & Lateral Displacement Analysis
                  </h4>
                  <p className="text-slate-300">
                    {currentBrief.section7_DisplacementAnalysis.displacementSummary}
                  </p>
                </div>

                {/* Section 8 */}
                <div className="border-b border-slate-800 pb-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-2 font-mono">
                    Section 8 — Final Evidence-Based Safety Verdict
                  </h4>
                  <div className="font-bold text-sm text-purple-300">{currentBrief.section8_FinalVerdict.verdictTitle}</div>
                  <ul className="space-y-1 text-slate-400 mt-2">
                    {currentBrief.section8_FinalVerdict.supportingFindings.map((f, i) => (
                      <li key={i}>› {f}</li>
                    ))}
                  </ul>
                </div>

                {/* Section 9 */}
                <div className="border-b border-slate-800 pb-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-2 font-mono">
                    Section 9 — Prioritized Operational Recommendations
                  </h4>
                  <div className="space-y-2">
                    {currentBrief.section9_RecommendedActions.map((act, i) => (
                      <div key={i} className="p-2 rounded bg-slate-900 border border-slate-800">
                        <strong className="text-slate-200">[{act.priority}] {act.action}</strong>
                        <span className="text-slate-400 block mt-0.5">{act.rationale}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section 10 */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-2 font-mono">
                    Section 10 — Technical Appendix & Verification Limitations
                  </h4>
                  <p className="text-slate-500 font-mono text-[11px]">
                    Random Seed S = {currentBrief.section10_TechnicalAppendix.randomSeed} | Engine: {currentBrief.section10_TechnicalAppendix.simulationEngine} | Disclaimer: {currentBrief.section10_TechnicalAppendix.disclaimer}
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* 4. Footer Status Bar */}
        <div className="px-6 py-2.5 bg-slate-950 border-t border-slate-800 shrink-0 flex items-center justify-between text-xs text-slate-400 font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            <span>Safety Intelligence Layer Active</span>
            <span className="text-slate-600">·</span>
            <span>M. Chinnaswamy Stadium, Bengaluru</span>
          </div>

          <button
            onClick={toggleSafetyIntelligence}
            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition"
          >
            Close Dashboard
          </button>
        </div>

      </div>
    </div>
  );
};
