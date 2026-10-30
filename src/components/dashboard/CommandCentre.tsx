import React from 'react';
import {
  Users,
  Flame,
  AlertTriangle,
  DoorOpen,
  TrendingUp,
  ShieldAlert,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Activity,
  Layers,
  Clock,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { useSimulationStore } from '../../store/simulationStore';
import { DigitalTwinView } from '../map/DigitalTwinView';
import { SCENARIOS } from '../../data/scenarios';

export const CommandCentre: React.FC = () => {
  const {
    currentVenue,
    isRunning,
    isPaused,
    startSimulation,
    pauseSimulation,
    resumeSimulation,
    resetSimulation,
    metricsSummary,
    metricsHistory,
    events,
    activeScenarioId,
    setActiveScenarioId,
    triggerActiveScenario,
    setActiveTab,
    setSelectedGateId,
    setSelectedZoneId,
    inflowConfig,
  } = useSimulationStore();

  const activeScenario = SCENARIOS.find((s) => s.id === activeScenarioId) || SCENARIOS[0];

  // Chart data formatted from metricsHistory
  const chartData = metricsHistory.map((m) => ({
    time: `${Math.floor(m.simTimeSecs / 60)}m`,
    outside: m.totalOutside,
    inside: m.totalInside,
    arrivalRate: m.arrivalRatePerMin,
    maxQueue: m.peakQueueLength,
  }));

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto select-none">
      {/* 1. TOP OPERATIONAL SUMMARY METRICS STRIP */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Attendance & Planning */}
        <div className="bg-navy-850 border border-navy-700 rounded-xl p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Attendance</span>
            <Users className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-xl font-black font-mono text-slate-100">
            {inflowConfig.estimatedAttendance.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
            <span>Planning Cap:</span>
            <span className="font-semibold text-slate-300">{currentVenue.planningCapacity.toLocaleString()}</span>
          </div>
        </div>

        {/* Outside Population */}
        <div className="bg-navy-850 border border-navy-700 rounded-xl p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Outside Plazas</span>
            <TrendingUp className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-xl font-black font-mono text-blue-400">
            {metricsSummary.totalOutside.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
            <span>Inflow Rate:</span>
            <span className="font-semibold text-blue-300">{metricsSummary.arrivalRatePerMin} /min</span>
          </div>
        </div>

        {/* Inside Venue Population */}
        <div className="bg-navy-850 border border-navy-700 rounded-xl p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Inside Concourse</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-black font-mono text-emerald-400">
            {metricsSummary.totalInside.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
            <span>Admitted:</span>
            <span className="font-semibold text-slate-300">{metricsSummary.destinationReachedCount}</span>
          </div>
        </div>

        {/* Max Queue */}
        <div className="bg-navy-850 border border-navy-700 rounded-xl p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Max Queue</span>
            <DoorOpen className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-black font-mono text-amber-400">
            {metricsSummary.peakQueueLength}{' '}
            <span className="text-xs font-normal text-slate-400">ppl</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
            <span>Avg Wait Time:</span>
            <span className="font-semibold text-amber-300">
              ~{Math.round(metricsSummary.avgWaitTimeSecs / 60)} mins
            </span>
          </div>
        </div>

        {/* Peak Zone Density */}
        <div className="bg-navy-850 border border-navy-700 rounded-xl p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Peak Density</span>
            <Flame className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-xl font-black font-mono text-rose-400">
            {metricsSummary.maxZoneDensity.toFixed(1)}{' '}
            <span className="text-xs font-normal text-slate-400">p/m²</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
            <span>Risk Threshold:</span>
            <span className="font-semibold text-slate-300">2.5 p/m²</span>
          </div>
        </div>

        {/* Active Warnings & Incidents */}
        <div className="bg-navy-850 border border-navy-700 rounded-xl p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Active Alerts</span>
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-xl font-black font-mono text-red-400">
            {metricsSummary.activeWarningsCount}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
            <span>Incidents:</span>
            <span className="font-semibold text-red-300">{metricsSummary.activeIncidentsCount} active</span>
          </div>
        </div>
      </div>

      {/* 2. MAIN CENTER SECTION: TWIN PREVIEW & CONTROLS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Large Digital Twin Preview (2 Columns) */}
        <div className="lg:col-span-2 bg-navy-850 border border-navy-700 rounded-2xl overflow-hidden shadow-xl flex flex-col">
          <div className="p-3.5 bg-navy-800 border-b border-navy-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <h3 className="font-bold text-slate-200 text-sm">
                Interactive Digital Twin Preview (21 Perimeter Gates)
              </h3>
            </div>
            <button
              onClick={() => setActiveTab('digital-twin')}
              className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition"
            >
              <span>Full Twin Lab</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-[420px] w-full relative">
            <DigitalTwinView />
          </div>
        </div>

        {/* Right Operational Panels: Quick Scenario & Inflow Graph */}
        <div className="space-y-6 flex flex-col">
          {/* Active Scenario Launcher Card */}
          <div className="bg-navy-850 border border-navy-700 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-400" />
                <h4 className="font-bold text-slate-200 text-sm">Scenario Lab Profile</h4>
              </div>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-violet-950 text-violet-300 border border-violet-800">
                {activeScenario.category}
              </span>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Select Stress-Test Scenario:</label>
              <select
                value={activeScenarioId}
                onChange={(e) => setActiveScenarioId(e.target.value)}
                className="w-full text-xs font-semibold bg-navy-950 border border-navy-600 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                {SCENARIOS.map((sc) => (
                  <option key={sc.id} value={sc.id}>
                    {sc.name}
                  </option>
                ))}
              </select>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
              {activeScenario.description}
            </p>

            <div className="pt-2 flex items-center gap-2">
              <button
                onClick={() => {
                  if (!isRunning) startSimulation();
                  triggerActiveScenario();
                }}
                className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white font-bold text-xs shadow-md shadow-violet-900/30 transition flex items-center justify-center gap-2"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Trigger Scenario Surge</span>
              </button>

              <button
                onClick={() => setActiveTab('scenario-lab')}
                className="p-2 rounded-xl bg-navy-800 border border-navy-600 text-slate-300 hover:text-white transition"
                title="Open Scenario Lab"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Real-time Inflow & Queue Chart */}
          <div className="bg-navy-850 border border-navy-700 rounded-2xl p-4 shadow-xl flex-1 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                Crowd Inflow &amp; Queue Growth
              </span>
              <span className="text-[10px] text-slate-400">Live Snapshot</span>
            </div>

            <div className="h-44 w-full">
              {chartData.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorOutside" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.6} />
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorInside" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.6} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                    <XAxis dataKey="time" stroke="#64748B" fontSize={10} />
                    <YAxis stroke="#64748B" fontSize={10} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F172A',
                        borderColor: '#334155',
                        fontSize: '11px',
                        color: '#F8FAFC',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="outside"
                      name="Outside Plazas"
                      stroke="#3B82F6"
                      fillOpacity={1}
                      fill="url(#colorOutside)"
                    />
                    <Area
                      type="monotone"
                      dataKey="inside"
                      name="Inside Concourse"
                      stroke="#10B981"
                      fillOpacity={1}
                      fill="url(#colorInside)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-500">
                  Simulation warming up... Inflow time-series will plot here.
                </div>
              )}
            </div>

            <div className="flex justify-between items-center text-[10px] text-slate-400 pt-2 border-t border-navy-800">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500" /> Outside
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Inside
              </span>
              <button
                onClick={() => setActiveTab('crowd-inflow')}
                className="text-cyan-400 hover:underline"
              >
                Configure Inflow &rarr;
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. GATE OPERATIONS MATRIX (21 GATES SNAPSHOT) */}
      <div className="bg-navy-850 border border-navy-700 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DoorOpen className="w-4 h-4 text-cyan-400" />
            <h4 className="font-bold text-slate-200 text-sm">
              Perimeter Access Gates Status (21 Gates)
            </h4>
          </div>
          <button
            onClick={() => setActiveTab('gate-operations')}
            className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
          >
            <span>All Gate Operations</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 lg:grid-cols-11 gap-2">
          {currentVenue.gates.map((g) => {
            const isCritical = g.warningLevel === 'CRITICAL';
            const isHigh = g.warningLevel === 'HIGH';

            return (
              <button
                key={g.id}
                onClick={() => {
                  setSelectedGateId(g.id);
                  setActiveTab('digital-twin');
                }}
                className={`p-2 rounded-xl text-left border transition group relative ${
                  isCritical
                    ? 'bg-red-950/40 border-red-700/80 hover:bg-red-900/50'
                    : isHigh
                      ? 'bg-amber-950/40 border-amber-700/80 hover:bg-amber-900/50'
                      : 'bg-navy-900/80 border-navy-700 hover:bg-navy-800'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-slate-200">{g.name}</span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      g.status === 'OPERATIONAL'
                        ? 'bg-emerald-400'
                        : isCritical
                          ? 'bg-red-400 animate-ping'
                          : 'bg-amber-400'
                    }`}
                  />
                </div>

                <div className="text-[10px] text-slate-400 flex justify-between">
                  <span>Queue:</span>
                  <span className="font-mono font-bold text-slate-200">{g.currentQueue}</span>
                </div>

                <div className="text-[10px] text-slate-400 flex justify-between">
                  <span>Wait:</span>
                  <span className="font-mono text-cyan-300">
                    {Math.round(g.queueWaitTimeSecs / 60)}m
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. ACTIVE ALERTS & RECENT SIMULATION EVENTS TIMELINE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Alerts Panel */}
        <div className="bg-navy-850 border border-navy-700 rounded-2xl p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400" />
              <h4 className="font-bold text-slate-200 text-sm">Active Alerts &amp; Critical Conditions</h4>
            </div>
            <span className="text-[10px] text-slate-400">Click alert to inspect</span>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {events.filter((e) => e.type === 'CRITICAL' || e.type === 'WARNING').length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-navy-700 rounded-xl">
                No active safety warnings currently triggered.
              </div>
            ) : (
              events
                .filter((e) => e.type === 'CRITICAL' || e.type === 'WARNING')
                .slice(0, 5)
                .map((alert) => (
                  <div
                    key={alert.id}
                    onClick={() => {
                      if (alert.gateId) setSelectedGateId(alert.gateId);
                      if (alert.zoneId) setSelectedZoneId(alert.zoneId);
                      setActiveTab('digital-twin');
                    }}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition hover:opacity-90 ${
                      alert.type === 'CRITICAL'
                        ? 'bg-red-950/40 border-red-800 text-red-200'
                        : 'bg-amber-950/40 border-amber-800 text-amber-200'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] opacity-80 mb-1">
                      <span className="font-mono">{alert.timeFormatted}</span>
                      <span className="font-bold uppercase tracking-wider">{alert.location}</span>
                    </div>
                    <p className="font-medium">{alert.description}</p>
                  </div>
                ))
            )}
          </div>
        </div>

        {/* Recent Events Log */}
        <div className="bg-navy-850 border border-navy-700 rounded-2xl p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <h4 className="font-bold text-slate-200 text-sm">Simulation Events Timeline</h4>
            </div>
            <span className="text-[10px] text-slate-400">{events.length} logged</span>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {events.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-navy-700 rounded-xl">
                Start the simulation to generate real-time operational events.
              </div>
            ) : (
              events.slice(0, 6).map((evt) => (
                <div
                  key={evt.id}
                  className="p-2.5 rounded-xl bg-navy-900/70 border border-navy-700 text-xs flex items-start gap-2.5"
                >
                  <span className="font-mono text-[10px] text-cyan-400 px-1.5 py-0.5 rounded bg-navy-950 border border-navy-800 shrink-0">
                    {evt.timeFormatted}
                  </span>
                  <div>
                    <span className="font-bold text-slate-200 block text-[11px]">{evt.location}</span>
                    <p className="text-slate-400 text-[11px] mt-0.5">{evt.description}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

