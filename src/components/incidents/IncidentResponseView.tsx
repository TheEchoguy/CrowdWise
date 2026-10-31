import React, { useState } from 'react';
import {
  AlertTriangle,
  Radio,
  Megaphone,
  HeartPulse,
  DoorClosed,
  Sparkles,
  Send,
  CheckCircle2,
  Copy,
  Plus,
  Flame,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { useSimulationStore } from '../../store/simulationStore';
import { IncidentType, PublicAnnouncement } from '../../types';

export const IncidentResponseView: React.FC = () => {
  const {
    incidents,
    addHypotheticalIncident,
    recommendations,
    approveRecommendation,
    announcements,
    broadcastAnnouncement,
    addAnnouncement,
    currentVenue,
  } = useSimulationStore();

  const [newIncidentType, setNewIncidentType] = useState<IncidentType>('MEDICAL');
  const [newIncidentTitle, setNewIncidentTitle] = useState('Acute Dehydration / Heat Exhaustion');
  const [newIncidentSeverity, setNewIncidentSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('HIGH');

  const [customAnnouncementText, setCustomAnnouncementText] = useState('');
  const [announcementAudience, setAnnouncementAudience] = useState<PublicAnnouncement['audience']>('PUBLIC_LED');

  const handleCreateIncident = () => {
    let loc = { x: 130, y: 50 };
    let medId = 'med-north';

    if (newIncidentType === 'MEDICAL') {
      loc = { x: 130, y: 50 };
      medId = 'med-north';
    } else if (newIncidentType === 'BLOCKED_ROUTE') {
      loc = { x: 130, y: 25 };
    } else if (newIncidentType === 'SCANNER_FAILURE') {
      loc = { x: 159, y: 22 };
    } else if (newIncidentType === 'GATE_CLOSURE') {
      loc = { x: 130, y: 18 };
    }

    addHypotheticalIncident({
      title: newIncidentTitle,
      type: newIncidentType,
      position: loc,
      severity: newIncidentSeverity,
      description: `Hypothetical incident reported near ${currentVenue.name}. Testing responder path and crowd diversions.`,
      suggestedAction:
        newIncidentType === 'SCANNER_FAILURE' || newIncidentType === 'GATE_CLOSURE'
          ? 'Trigger intelligent automatic gate rerouting and dynamic steward diversion deployment.'
          : 'Dispatch ground marshals and calculate emergency vehicle corridor.',
      assignedMedicalPointId: newIncidentType === 'MEDICAL' ? medId : undefined,
    });
  };

  const handlePostAnnouncement = () => {
    if (!customAnnouncementText.trim()) return;
    addAnnouncement({
      title: 'Custom Operator Broadcast',
      audience: announcementAudience,
      category: 'NORMAL',
      text: customAnnouncementText,
      editable: true,
    });
    setCustomAnnouncementText('');
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-navy-700 pb-4">
        <div>
          <h2 className="text-xl font-black text-slate-100 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            Incident Response &amp; Operational Communications
          </h2>
          <p className="text-xs text-slate-400">
            Simulate medical contingencies, blocked access corridors, internal operator directives, and public LED wayfinding announcements.
          </p>
        </div>
      </div>

      {/* Grid: Incidents & Medical Responders (Left), Public Announcement Studio (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (6 Cols): Incidents & Responder Pathfinding */}
        <div className="lg:col-span-6 space-y-5">
          {/* Create Hypothetical Incident Form */}
          <div className="bg-navy-850 border border-navy-700 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center gap-2 border-b border-navy-700 pb-3">
              <Plus className="w-4 h-4 text-cyan-400" />
              <h3 className="font-bold text-slate-100 text-sm">Deploy Hypothetical Incident</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Incident Type</label>
                <select
                  value={newIncidentType}
                  onChange={(e) => {
                    const t = e.target.value as IncidentType;
                    setNewIncidentType(t);
                    if (t === 'MEDICAL') setNewIncidentTitle('Acute Heat Exhaustion / Collapse');
                    else if (t === 'SCANNER_FAILURE') setNewIncidentTitle('Optical Ticket Scanner Outage (Gate 2)');
                    else if (t === 'GATE_CLOSURE') setNewIncidentTitle('Complete Gate Portal Closure (Gate 2)');
                    else if (t === 'BLOCKED_ROUTE') setNewIncidentTitle('Obstruction on Emergency Access Road');
                    else if (t === 'STAGE_SURGE') setNewIncidentTitle('Presentation Podium Crowd Surge');
                    else setNewIncidentTitle('Operational Contingency');
                  }}
                  className="w-full bg-navy-950 border border-navy-600 rounded-lg p-2 text-slate-200 focus:outline-none"
                >
                  <option value="MEDICAL">Medical Emergency (First-Aid Route)</option>
                  <option value="SCANNER_FAILURE">Optical Scanner Failure (Turnstiles Offline)</option>
                  <option value="GATE_CLOSURE">Complete Gate Barrier Closure</option>
                  <option value="BLOCKED_ROUTE">Blocked Emergency Vehicle Route</option>
                  <option value="STAGE_SURGE">Main Stage / Presentation Surge</option>
                  <option value="CORRIDOR_BOTTLENECK">Concourse Corridor Bottleneck</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Severity Level</label>
                <select
                  value={newIncidentSeverity}
                  onChange={(e) =>
                    setNewIncidentSeverity(e.target.value as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL')
                  }
                  className="w-full bg-navy-950 border border-navy-600 rounded-lg p-2 text-slate-200 focus:outline-none"
                >
                  <option value="LOW">Low (Monitor)</option>
                  <option value="MEDIUM">Medium (Local Delay)</option>
                  <option value="HIGH">High (Active Intervention)</option>
                  <option value="CRITICAL">Critical (Immediate Action)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-slate-400 text-xs block mb-1">Title / Description</label>
              <input
                type="text"
                value={newIncidentTitle}
                onChange={(e) => setNewIncidentTitle(e.target.value)}
                className="w-full bg-navy-950 border border-navy-600 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none"
              />
            </div>

            <button
              onClick={handleCreateIncident}
              className="w-full py-2 rounded-xl bg-amber-600 hover:bg-amber-500 font-bold text-xs text-white transition flex items-center justify-center gap-1.5 shadow-md shadow-amber-900/30"
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Simulate Incident in Digital Twin</span>
            </button>
          </div>

          {/* Active Incidents Stream */}
          <div className="bg-navy-850 border border-navy-700 rounded-2xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-navy-700 pb-3">
              <h3 className="font-bold text-slate-100 text-sm">Active Simulated Incidents</h3>
              <span className="text-xs font-mono text-cyan-400 font-bold">
                {incidents.length} Logged
              </span>
            </div>

            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {incidents.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-navy-700 rounded-xl">
                  No simulated incidents active. Deploy one above or trigger a scenario in the Scenario Lab.
                </div>
              ) : (
                incidents.map((inc) => (
                  <div
                    key={inc.id}
                    className="p-3 bg-navy-900 rounded-xl border border-navy-700 text-xs space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {inc.type === 'MEDICAL' ? (
                          <HeartPulse className="w-4 h-4 text-red-400" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                        )}
                        <span className="font-bold text-slate-200">{inc.title}</span>
                      </div>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono ${
                          inc.severity === 'CRITICAL'
                            ? 'bg-red-950 text-red-300 border border-red-800'
                            : 'bg-amber-950 text-amber-300 border border-amber-800'
                        }`}
                      >
                        {inc.severity}
                      </span>
                    </div>

                    <p className="text-slate-400">{inc.description}</p>

                    <div className="p-2 bg-navy-950 rounded-lg border border-navy-800 text-[11px] text-cyan-300">
                      <strong>Response Protocol:</strong> {inc.suggestedAction}
                    </div>

                    {inc.responderPath && (
                      <div className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Medical team transit path calculated &amp; cleared on Digital Twin map</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column (6 Cols): Public Announcement Studio */}
        <div className="lg:col-span-6 space-y-5">
          {/* Announcement Studio Card */}
          <div className="bg-navy-850 border border-navy-700 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-navy-700 pb-3">
              <div className="flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-cyan-400" />
                <h3 className="font-bold text-slate-100 text-sm">
                  Public Wayfinding Announcement Studio
                </h3>
              </div>
              <span className="text-[10px] text-slate-400">Pre-event messaging templates</span>
            </div>

            {/* Custom Announcement Input */}
            <div className="space-y-2 text-xs">
              <div className="flex gap-2">
                <select
                  value={announcementAudience}
                  onChange={(e) =>
                    setAnnouncementAudience(e.target.value as PublicAnnouncement['audience'])
                  }
                  className="bg-navy-950 border border-navy-600 rounded-lg p-2 text-slate-200 text-xs focus:outline-none"
                >
                  <option value="PUBLIC_LED">Perimeter LED Screens</option>
                  <option value="STAFF_RADIO">Staff Radio Channel</option>
                  <option value="MEGAPHONE">Steward Megaphones</option>
                  <option value="APP_NOTIFICATION">Attendee Event App</option>
                </select>

                <input
                  type="text"
                  placeholder="Draft announcement message for public or stewards..."
                  value={customAnnouncementText}
                  onChange={(e) => setCustomAnnouncementText(e.target.value)}
                  className="flex-1 bg-navy-950 border border-navy-600 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none"
                />

                <button
                  onClick={handlePostAnnouncement}
                  className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 font-bold text-white transition flex items-center gap-1 shadow-sm shadow-cyan-900/40"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                </button>
              </div>
            </div>

            {/* Announcements List */}
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {announcements.map((ann) => (
                <div
                  key={ann.id}
                  className="p-3.5 bg-navy-900 rounded-xl border border-navy-700 text-xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-100">{ann.title}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-navy-950 text-cyan-400 border border-navy-800">
                      Channel: {ann.audience}
                    </span>
                  </div>

                  <p className="text-slate-300 text-xs leading-relaxed bg-navy-950 p-2.5 rounded-lg border border-navy-800">
                    "{ann.text}"
                  </p>

                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <button
                      onClick={() => navigator.clipboard?.writeText(ann.text)}
                      className="text-slate-400 hover:text-white flex items-center gap-1 transition"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copy Text</span>
                    </button>

                    {ann.broadcasted ? (
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Simulated Broadcast Active
                      </span>
                    ) : (
                      <button
                        onClick={() => broadcastAnnouncement(ann.id)}
                        className="px-2.5 py-1 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-700/60 text-cyan-300 font-bold transition"
                      >
                        Transmit Announcement
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

