import React from 'react';
import {
  FileText,
  Download,
  Printer,
  Sparkles,
  ShieldCheck,
  Calendar,
  Layers,
  Flame,
  CheckCircle2,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { useSimulationStore } from '../../store/simulationStore';
import { SCENARIOS } from '../../data/scenarios';

export const ReportsHistoryView: React.FC = () => {
  const {
    currentVenue,
    activeScenarioId,
    randomSeed,
    inflowConfig,
    metricsSummary,
    metricsHistory,
    comparisons,
    events,
    interventions,
  } = useSimulationStore();

  const scenario = SCENARIOS.find((s) => s.id === activeScenarioId) || SCENARIOS[0];
  const activeInterventions = interventions.filter((i) => i.isActive);

  // JSON Export Handler
  const handleExportJSON = () => {
    const reportData = {
      product: 'CROWDWISE — Predictive Crowd Digital Twin',
      exportTimestamp: new Date().toISOString(),
      venue: {
        id: currentVenue.id,
        name: currentVenue.name,
        seatingCapacity: currentVenue.seatingCapacity,
        planningCapacity: currentVenue.planningCapacity,
        gatesCount: currentVenue.gates.length,
      },
      scenario: {
        id: scenario.id,
        name: scenario.name,
        category: scenario.category,
      },
      assumptions: {
        randomSeed,
        inflowConfig,
        activeInterventions: activeInterventions.map((i) => i.name),
      },
      summaryMetrics: metricsSummary,
      counterfactualComparisons: comparisons,
      eventsTimeline: events,
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `crowdwise-report-${scenario.id}-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // CSV Export Handler (Time series metrics)
  const handleExportCSV = () => {
    if (metricsHistory.length === 0) {
      alert('No simulation metrics history recorded yet. Please run a simulation first.');
      return;
    }

    const headers = [
      'SimTimeSecs',
      'TotalArrived',
      'TotalInside',
      'TotalOutside',
      'PeakQueueLength',
      'MaxZoneDensity',
      'AvgWaitTimeSecs',
      'ExternalHoldingOccupancy',
      'ArrivalRatePerMin',
      'GateThroughputPerMin',
    ];

    const rows = metricsHistory.map((m) => [
      m.simTimeSecs,
      m.totalArrived,
      m.totalInside,
      m.totalOutside,
      m.peakQueueLength,
      m.maxZoneDensity,
      m.avgWaitTimeSecs,
      m.externalHoldingOccupancy,
      m.arrivalRatePerMin,
      m.gateThroughputPerMin,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `crowdwise-metrics-${scenario.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV Export Handler for Zone-by-Zone Spatial Comparison
  const handleExportZoneCSV = () => {
    if (comparisons.length === 0 || !comparisons[0].zoneComparisons) {
      alert('No counterfactual zone comparison data available. Please run a counterfactual test in Scenario Lab first.');
      return;
    }

    const latest = comparisons[0];
    const headers = [
      'ZoneId',
      'ZoneName',
      'Category',
      'AreaSqM',
      'MaxRecommendedDensity',
      'BaselineDensity',
      'BaselineRisk',
      'PlanDensity',
      'PlanRisk',
      'DeltaDensity',
      'DeltaPopulation',
      'Status',
      'Description',
    ];

    const rows = latest.zoneComparisons.map((z) => [
      z.zoneId,
      `"${z.zoneName.replace(/"/g, '""')}"`,
      z.category,
      z.usableAreaSqM,
      z.maxRecommendedDensity,
      z.baselineDensity,
      z.baselineRisk,
      z.interventionDensity,
      z.interventionRisk,
      z.deltaDensity,
      z.deltaPopulation,
      z.status,
      `"${z.description.replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `crowdwise-zone-deltas-${latest.scenarioId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto select-none print:p-0 print:m-0 print:max-w-none">
      {/* Header & Export Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-navy-700 pb-4 print:hidden">
        <div>
          <h2 className="text-xl font-black text-slate-100 flex items-center gap-2">
            <FileText className="w-5 h-5 text-cyan-400" />
            Simulation Report &amp; Safety Planning Audit
          </h2>
          <p className="text-xs text-slate-400">
            Generate printable executive briefing documents, download raw simulation time-series, and preserve counterfactual lab findings.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="px-3 py-2 rounded-xl bg-navy-800 hover:bg-navy-700 border border-navy-600 text-xs font-semibold text-slate-200 transition flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4" />
            <span>Print Report</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3 py-2 rounded-xl bg-navy-800 hover:bg-navy-700 border border-navy-600 text-xs font-semibold text-cyan-300 transition flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            <span>Export Time-Series CSV</span>
          </button>

          <button
            onClick={handleExportZoneCSV}
            className="px-3 py-2 rounded-xl bg-navy-800 hover:bg-navy-700 border border-navy-600 text-xs font-semibold text-violet-300 transition flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            <span>Export Zone Deltas CSV</span>
          </button>

          <button
            onClick={handleExportJSON}
            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 font-bold text-xs text-white transition flex items-center gap-1.5 shadow-md shadow-cyan-900/30"
          >
            <Download className="w-4 h-4" />
            <span>Export JSON Package</span>
          </button>
        </div>
      </div>

      {/* PRINTABLE REPORT DOCUMENT CONTAINER */}
      <div className="bg-navy-850 border border-navy-700 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 text-slate-200 print:bg-white print:text-black print:border-none print:shadow-none">
        {/* Document Header */}
        <div className="border-b border-navy-700 print:border-slate-300 pb-5 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xl tracking-wider font-mono text-cyan-400 print:text-black">
                CROWDWISE
              </span>
              <span className="text-xs uppercase px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-700/60 text-cyan-300 print:border-black print:text-black">
                Pre-Event Audit Brief
              </span>
            </div>
            <h1 className="text-lg font-bold text-slate-100 print:text-black mt-1">
              Counterfactual Crowd Safety Simulation Briefing
            </h1>
            <p className="text-xs text-slate-400 print:text-slate-600">
              Generated: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()} | Deterministic Seed #{randomSeed}
            </p>
          </div>

          <div className="text-right text-xs">
            <span className="font-bold text-slate-300 print:text-black block">{currentVenue.name.split('—')[0]}</span>
            <span className="text-slate-400 print:text-slate-600">Planning Cap: {currentVenue.planningCapacity.toLocaleString()}</span>
          </div>
        </div>

        {/* 1. Executive Summary */}
        <div className="space-y-2 text-xs">
          <h3 className="font-bold text-sm text-cyan-400 print:text-black uppercase tracking-wider">
            1. Executive Planning Summary
          </h3>
          <p className="leading-relaxed text-slate-300 print:text-slate-800">
            This pre-event simulation tests crowd inflow, turnstile processing throughput, and perimeter queue spillback under scenario: <strong>"{scenario.name}"</strong>. With an attendance assumption of {inflowConfig.estimatedAttendance.toLocaleString()} ticketed attendees and +{inflowConfig.unexpectedCrowdAddition.toLocaleString()} unexpected external gathering, the digital twin observed a peak queue buildup of <strong>{metricsSummary.peakQueueLength} persons</strong> and peak zone density of <strong>{metricsSummary.maxZoneDensity.toFixed(1)} people/m²</strong>.
          </p>
        </div>

        {/* 2. Key Metrics Table */}
        <div className="space-y-2 text-xs">
          <h3 className="font-bold text-sm text-cyan-400 print:text-black uppercase tracking-wider">
            2. Core Simulation Metrics
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-navy-900 print:bg-slate-100 rounded-xl border border-navy-750 print:border-slate-300">
              <span className="text-slate-400 print:text-slate-600 text-[10px] block">Peak Perimeter Queue</span>
              <span className="font-mono text-base font-bold text-amber-400 print:text-black">
                {metricsSummary.peakQueueLength} ppl
              </span>
            </div>
            <div className="p-3 bg-navy-900 print:bg-slate-100 rounded-xl border border-navy-750 print:border-slate-300">
              <span className="text-slate-400 print:text-slate-600 text-[10px] block">Max Concourse Density</span>
              <span className="font-mono text-base font-bold text-cyan-400 print:text-black">
                {metricsSummary.maxZoneDensity.toFixed(1)} p/m²
              </span>
            </div>
            <div className="p-3 bg-navy-900 print:bg-slate-100 rounded-xl border border-navy-750 print:border-slate-300">
              <span className="text-slate-400 print:text-slate-600 text-[10px] block">Avg Queue Waiting Time</span>
              <span className="font-mono text-base font-bold text-slate-200 print:text-black">
                ~{Math.round(metricsSummary.avgWaitTimeSecs / 60)} mins
              </span>
            </div>
            <div className="p-3 bg-navy-900 print:bg-slate-100 rounded-xl border border-navy-750 print:border-slate-300">
              <span className="text-slate-400 print:text-slate-600 text-[10px] block">Holding Area Occupancy</span>
              <span className="font-mono text-base font-bold text-slate-200 print:text-black">
                {metricsSummary.externalHoldingOccupancy} ppl
              </span>
            </div>
          </div>
        </div>

        {/* 3. Counterfactual Interventions Evaluated */}
        <div className="space-y-2 text-xs">
          <h3 className="font-bold text-sm text-cyan-400 print:text-black uppercase tracking-wider">
            3. Counterfactual Intervention Analysis &amp; Trade-Offs
          </h3>
          {comparisons.length > 0 ? (
            <div className="space-y-3">
              {comparisons.map((comp) => (
                <div
                  key={comp.id}
                  className="p-4 bg-navy-900 print:bg-slate-100 rounded-xl border border-navy-750 print:border-slate-300 space-y-2"
                >
                  <div className="flex justify-between items-center font-bold text-slate-200 print:text-black">
                    <span>{comp.name}</span>
                    <span className="text-[10px] text-emerald-400 print:text-black">
                      Verdict: {comp.tradeOffAnalysis.verdict}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <p>
                      <strong className="text-emerald-400 print:text-black">Observed Benefit:</strong>{' '}
                      {comp.tradeOffAnalysis.benefit}
                    </p>
                    <p>
                      <strong className="text-amber-400 print:text-black">Downstream Risk:</strong>{' '}
                      {comp.tradeOffAnalysis.downstreamRisk}
                    </p>
                  </div>

                  {/* Plain Language Spatial Summary */}
                  {comp.spatialSummary && (
                    <div className="p-2.5 rounded-lg bg-navy-950 print:bg-white border border-navy-800 print:border-slate-300 text-xs space-y-1.5">
                      <div className="flex justify-between items-center">
                        <strong className="text-slate-200 print:text-black">Spatial Transferred Risk Finding:</strong>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-navy-800 print:bg-slate-200 text-slate-300 print:text-black">
                          Verdict: {comp.spatialSummary.spatialVerdict}
                        </span>
                      </div>
                      <p className="text-slate-300 print:text-slate-800 leading-relaxed text-[11px]">
                        {comp.spatialSummary.plainLanguageSummary}
                      </p>
                    </div>
                  )}

                  {/* Printable Zone-by-Zone Breakdown Table */}
                  {comp.zoneComparisons && comp.zoneComparisons.length > 0 && (
                    <div className="pt-2">
                      <span className="font-bold text-[11px] text-slate-300 print:text-black block mb-1.5">
                        Walkable Zone Density Delta (Baseline vs Plan):
                      </span>
                      <div className="overflow-x-auto border border-navy-800 print:border-slate-300 rounded-lg">
                        <table className="w-full text-left text-[11px] border-collapse">
                          <thead className="bg-navy-950 print:bg-slate-200 text-slate-400 print:text-slate-800">
                            <tr>
                              <th className="py-1.5 px-2">Zone Name</th>
                              <th className="py-1.5 px-1">Safe Limit</th>
                              <th className="py-1.5 px-1">Baseline</th>
                              <th className="py-1.5 px-1">Plan</th>
                              <th className="py-1.5 px-1">Delta (Δρ)</th>
                              <th className="py-1.5 px-1">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-navy-800 print:divide-slate-200 text-slate-300 print:text-slate-800">
                            {comp.zoneComparisons.map((z) => (
                              <tr key={z.zoneId}>
                                <td className="py-1.5 px-2 font-medium">{z.zoneName}</td>
                                <td className="py-1.5 px-1 font-mono">{z.maxRecommendedDensity} p/m²</td>
                                <td className="py-1.5 px-1 font-mono">{z.baselineDensity.toFixed(1)}</td>
                                <td className="py-1.5 px-1 font-mono font-bold">{z.interventionDensity.toFixed(1)}</td>
                                <td className="py-1.5 px-1 font-mono font-bold">
                                  {z.deltaDensity > 0 ? '+' : ''}{z.deltaDensity.toFixed(2)} p/m²
                                </td>
                                <td className="py-1.5 px-1 font-bold text-[10px]">
                                  {z.status}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 print:text-slate-600 italic">
              No comparison logged yet. Run a counterfactual test in the Scenario Lab to benchmark interventions.
            </p>
          )}
        </div>

        {/* 4. Statutory Disclaimer & Attribution */}
        <div className="pt-4 border-t border-navy-700 print:border-slate-300 text-[10px] text-slate-400 print:text-slate-600 space-y-1">
          <p className="font-semibold text-slate-300 print:text-black">
            SAFETY &amp; METHODOLOGICAL DISCLAIMER:
          </p>
          <p className="leading-relaxed">
            All outputs generated by CROWDWISE are simulation-based estimates designed strictly for pre-event planning support and sensitivity analysis. They do not constitute a safety guarantee, physical crowd certification, or replacement for trained crowd managers, police authorities, or on-site security professionals.
          </p>
        </div>
      </div>
    </div>
  );
};

