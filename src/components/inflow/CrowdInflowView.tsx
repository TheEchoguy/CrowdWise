import React, { useState } from 'react';
import {
  TrendingUp,
  Users,
  Clock,
  Layers,
  AlertTriangle,
  RotateCcw,
  Sliders,
  Check,
  Compass,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import { useSimulationStore } from '../../store/simulationStore';
import { ArrivalPatternType } from '../../types';

export const CrowdInflowView: React.FC = () => {
  const {
    currentVenue,
    inflowConfig,
    updateInflowConfig,
    metricsSummary,
    metricsHistory,
    setVenueProfile,
  } = useSimulationStore();

  const [previewTimelineMinutes, setPreviewTimelineMinutes] = useState(45);

  const isOverCapacity =
    inflowConfig.estimatedAttendance + inflowConfig.unexpectedCrowdAddition > currentVenue.planningCapacity;

  // Generate Projected Inflow Curve over 120 minutes for visualization
  const projectionData: {
    minute: string;
    newArrivals: number;
    cumulative: number;
    externalWaiting: number;
  }[] = [];

  let cumulativeCount = 0;
  const totalPeople = inflowConfig.estimatedAttendance + inflowConfig.unexpectedCrowdAddition;
  const duration = inflowConfig.arrivalDurationMinutes;

  for (let m = 0; m <= 120; m += 5) {
    let rate = 0;
    if (m <= duration) {
      if (inflowConfig.pattern === 'PEAK_SURGE') {
        const peak = inflowConfig.eventStartTimeMinutes * 0.75;
        const dist = Math.abs(m - peak);
        const factor = Math.max(0.2, Math.exp(-Math.pow(dist / 20, 2)) * inflowConfig.burstIntensity);
        rate = Math.round((totalPeople / duration) * factor * 5);
      } else if (inflowConfig.pattern === 'TRANSPORT_PULSE') {
        const pulse = m % inflowConfig.transportPulseIntervalMinutes === 0;
        rate = pulse ? Math.round((totalPeople / (duration / 2)) * 5) : Math.round((totalPeople / (duration * 3)) * 5);
      } else if (inflowConfig.pattern === 'BURST') {
        if (m >= 15 && m <= 35) {
          rate = Math.round((totalPeople / duration) * inflowConfig.burstIntensity * 2 * 5);
        } else {
          rate = Math.round((totalPeople / (duration * 2)) * 5);
        }
      } else {
        // GRADUAL
        rate = Math.round((totalPeople / duration) * 5);
      }
    }

    cumulativeCount += rate;
    const nominalProcessing = Math.min(cumulativeCount, m * 350);
    const waiting = Math.max(0, cumulativeCount - nominalProcessing);

    projectionData.push({
      minute: `T+${m}`,
      newArrivals: rate,
      cumulative: Math.min(totalPeople, cumulativeCount),
      externalWaiting: waiting,
    });
  }

  // Approach routes share calculation
  const routeDistributionData = currentVenue.approachRoutes.map((ar) => ({
    name: ar.name.split('(')[0],
    share: ar.sharePercentage,
    people: Math.round((totalPeople * ar.sharePercentage) / 100),
  }));

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-navy-700 pb-4">
        <div>
          <h2 className="text-xl font-black text-slate-100 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-cyan-400" />
            Crowd Inflow &amp; Arrival Demand Analysis
          </h2>
          <p className="text-xs text-slate-400">
            Model pre-event attendee arrival distributions, transit burst spikes, and un-ticketed external gatherings.
          </p>
        </div>

        {isOverCapacity && (
          <div className="p-2.5 rounded-xl bg-amber-950/70 border border-amber-600/70 flex items-center gap-2 text-xs text-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Capacity Warning:</strong> Total attendance ({totalPeople.toLocaleString()}) exceeds planning limit ({currentVenue.planningCapacity.toLocaleString()}).
            </span>
          </div>
        )}
      </div>

      {/* Main Grid: Controls on Left, Inflow Analytics on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Inflow Parameters Configuration */}
        <div className="bg-navy-850 border border-navy-700 rounded-2xl p-5 shadow-xl space-y-5">
          <div className="flex items-center gap-2 border-b border-navy-700 pb-3">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <h3 className="font-bold text-slate-200 text-sm">Arrival Configuration</h3>
          </div>

          {/* Attendance Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400 font-medium">Estimated Ticketed Attendance</span>
              <span className="font-mono font-bold text-cyan-400">
                {inflowConfig.estimatedAttendance.toLocaleString()}
              </span>
            </div>
            <input
              type="range"
              min="5000"
              max="50000"
              step="1000"
              value={inflowConfig.estimatedAttendance}
              onChange={(e) => updateInflowConfig({ estimatedAttendance: Number(e.target.value) })}
              className="w-full accent-cyan-500"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>5,000</span>
              <span>Planning Cap: {currentVenue.planningCapacity.toLocaleString()}</span>
              <span>50,000</span>
            </div>
          </div>

          {/* Un-ticketed External Gathering */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400 font-medium">Unexpected External Gathering</span>
              <span className="font-mono font-bold text-rose-400">
                +{inflowConfig.unexpectedCrowdAddition.toLocaleString()}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="25000"
              step="1000"
              value={inflowConfig.unexpectedCrowdAddition}
              onChange={(e) => updateInflowConfig({ unexpectedCrowdAddition: Number(e.target.value) })}
              className="w-full accent-rose-500"
            />
            <p className="text-[10px] text-slate-400">
              Un-ticketed crowds gathering at perimeter approaches without stadium entry permits.
            </p>
          </div>

          {/* Arrival Pattern Preset Selector */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300 block">Arrival Curve Pattern</label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { id: 'PEAK_SURGE', label: 'Peak Surge' },
                { id: 'TRANSPORT_PULSE', label: 'Transit Pulses' },
                { id: 'BURST', label: 'Sudden Burst' },
                { id: 'GRADUAL', label: 'Gradual Flow' },
              ].map((pat) => (
                <button
                  key={pat.id}
                  onClick={() => updateInflowConfig({ pattern: pat.id as ArrivalPatternType })}
                  className={`py-2 px-2.5 rounded-xl font-medium transition text-left border ${
                    inflowConfig.pattern === pat.id
                      ? 'bg-cyan-950 border-cyan-500 text-cyan-300'
                      : 'bg-navy-900 border-navy-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="font-bold">{pat.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Burst Intensity */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400 font-medium">Burst Multiplier</span>
              <span className="font-mono font-bold text-amber-400">
                {inflowConfig.burstIntensity}x
              </span>
            </div>
            <input
              type="range"
              min="1.0"
              max="4.0"
              step="0.2"
              value={inflowConfig.burstIntensity}
              onChange={(e) => updateInflowConfig({ burstIntensity: Number(e.target.value) })}
              className="w-full accent-amber-500"
            />
          </div>

          {/* Arrival Window Duration */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400 font-medium">Arrival Window Duration</span>
              <span className="font-mono font-bold text-slate-200">
                {inflowConfig.arrivalDurationMinutes} mins
              </span>
            </div>
            <input
              type="range"
              min="30"
              max="150"
              step="10"
              value={inflowConfig.arrivalDurationMinutes}
              onChange={(e) => updateInflowConfig({ arrivalDurationMinutes: Number(e.target.value) })}
              className="w-full accent-cyan-500"
            />
          </div>

          {/* Reset Defaults */}
          <button
            onClick={() =>
              updateInflowConfig({
                estimatedAttendance: currentVenue.planningCapacity,
                unexpectedCrowdAddition: 5000,
                pattern: 'PEAK_SURGE',
                burstIntensity: 2.0,
                arrivalDurationMinutes: 90,
              })
            }
            className="w-full py-2 rounded-xl bg-navy-800 hover:bg-navy-700 border border-navy-700 text-xs font-semibold text-slate-300 transition"
          >
            Reset to Baseline Demonstration
          </button>
        </div>

        {/* Charts & Analytical Breakdown (2 Columns) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Main Arrival Rate & Waiting Queue Projection Chart */}
          <div className="bg-navy-850 border border-navy-700 rounded-2xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-200 text-sm">
                  Projected Crowd Inflow &amp; External Queue Growth Curve
                </h3>
                <span className="text-xs text-slate-400">
                  Modelled 5-minute interval arrivals vs turnstile throughput
                </span>
              </div>
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-navy-950 text-cyan-400 border border-navy-700">
                Pattern: {inflowConfig.pattern}
              </span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={projectionData}>
                  <defs>
                    <linearGradient id="colorArrivals" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#06B6D4" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorWaiting" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                  <XAxis dataKey="minute" stroke="#64748B" fontSize={11} />
                  <YAxis stroke="#64748B" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderColor: '#334155',
                      fontSize: '12px',
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="newArrivals"
                    name="Arrivals (per 5 min)"
                    stroke="#06B6D4"
                    fill="url(#colorArrivals)"
                  />
                  <Area
                    type="monotone"
                    dataKey="externalWaiting"
                    name="Projected External Queue"
                    stroke="#EF4444"
                    fill="url(#colorWaiting)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Approach Route Distribution Bar Chart */}
          <div className="bg-navy-850 border border-navy-700 rounded-2xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-200 text-sm">
                  Approach Arterials &amp; Transit Gate Feeding
                </h3>
                <span className="text-xs text-slate-400">
                  Estimated crowd volume distribution by external arterial route
                </span>
              </div>
            </div>

            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={routeDistributionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                  <XAxis dataKey="name" stroke="#64748B" fontSize={11} />
                  <YAxis stroke="#64748B" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderColor: '#334155',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="people" name="Estimated Attendees" fill="#8B5CF6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-navy-800 text-xs">
              {currentVenue.approachRoutes.map((ar) => (
                <div key={ar.id} className="p-2 bg-navy-900 rounded-lg border border-navy-800">
                  <span className="text-[10px] text-slate-400 block truncate">{ar.name}</span>
                  <span className="font-bold text-cyan-300 font-mono text-xs">{ar.sharePercentage}% share</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {ar.entryGateIds.length} entry gates
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

