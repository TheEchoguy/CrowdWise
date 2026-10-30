import React, { useState } from 'react';
import { X, ChevronRight, ChevronLeft, Check, Sparkles, AlertTriangle, ShieldCheck, MapPin, TrendingUp, Sliders } from 'lucide-react';

interface GuidedTourModalProps {
  onClose: () => void;
}

const STEPS = [
  {
    title: 'Welcome to CROWDWISE',
    subtitle: 'Predictive Crowd Digital Twin & Counterfactual Safety Lab',
    icon: Sparkles,
    content: (
      <div className="space-y-3 text-sm text-slate-300">
        <p>
          CROWDWISE is an advanced pre-event planning and counterfactual simulation platform designed for event organisers, venue operators, and safety planners.
        </p>
        <div className="p-3 bg-cyan-950/40 border border-cyan-700/50 rounded-lg text-cyan-200 text-xs">
          <strong>Key Capability:</strong> Simulate crowd bottlenecks, gate scanner failures, and surges <em>before</em> an event takes place, test operational interventions, and observe unintended downstream consequences.
        </div>
        <p className="text-xs text-slate-400 italic">
          *Important note: All outputs represent simulation-based estimates and planning decision support. They do not replace trained crowd managers or professional safety certifications.
        </p>
      </div>
    ),
  },
  {
    title: '1. Inspect Venue & Access Gates',
    subtitle: 'M. Chinnaswamy Stadium Demonstration Profile',
    icon: MapPin,
    content: (
      <div className="space-y-3 text-sm text-slate-300">
        <p>
          The default profile features an illustrative digital twin of M. Chinnaswamy Stadium with <strong>21 perimeter gates</strong>, internal concourses, and external approach arterials (Cubbon Rd, Queen's Rd, MG Rd, Kasturba Rd).
        </p>
        <ul className="list-disc pl-5 space-y-1 text-xs text-slate-300">
          <li><strong>Pan &amp; Zoom:</strong> Drag to pan, scroll wheel or buttons to zoom.</li>
          <li><strong>Layer Toggles:</strong> Enable Heatmap, Virtual Pedestrians, Emergency Corridors, Queues, and Risk Zones.</li>
          <li><strong>Interactive Inspection:</strong> Click on any gate or zone to view live throughput, queue length, and density.</li>
        </ul>
      </div>
    ),
  },
  {
    title: '2. Inflow Curves & Arrival Bursts',
    subtitle: 'Configuring Realistic Arrival Demand',
    icon: TrendingUp,
    content: (
      <div className="space-y-3 text-sm text-slate-300">
        <p>
          Real crowds rarely arrive evenly. In the <strong>Crowd Inflow</strong> tab, configure:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-xs text-slate-300">
          <li><strong>Estimated Attendance:</strong> e.g., 35,000 planning capacity + un-ticketed external gatherings.</li>
          <li><strong>Arrival Patterns:</strong> Peak Surges, Sudden 15-Minute Waves, or Train-Arrival Pulses.</li>
          <li><strong>Arterial Route Splits:</strong> Asymmetric arrival shares across North, West, South, and East axes.</li>
        </ul>
      </div>
    ),
  },
  {
    title: '3. Scenario Lab & Stress-Testing',
    subtitle: 'Test 10+ Complex Incident Scenarios',
    icon: AlertTriangle,
    content: (
      <div className="space-y-3 text-sm text-slate-300">
        <p>
          Trigger realistic operational failures in the <strong>Scenario Lab</strong>:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-xs text-slate-300">
          <li><strong>Scanner Hardware Outages:</strong> Offline scanners causing instant queue spikes.</li>
          <li><strong>Gate Closures:</strong> Complete entrance obstruction requiring route recalculations.</li>
          <li><strong>Systemic Perimeter Saturation:</strong> Every gate overwhelmed, external roads jammed.</li>
          <li><strong>Stage Surges &amp; Medical Incidents:</strong> Internal concourse movement spikes and responder pathfinding.</li>
        </ul>
      </div>
    ),
  },
  {
    title: '4. Counterfactual Analysis',
    subtitle: 'Compare Interventions Against Baseline with Same Random Seed',
    icon: Sliders,
    content: (
      <div className="space-y-3 text-sm text-slate-300">
        <p>
          Test management interventions under identical initial conditions:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-xs text-slate-300">
          <li><strong>Flow Metering:</strong> Batch admissions to prevent concourse overcrowding.</li>
          <li><strong>Auxiliary Holding Zones:</strong> Activate Cubbon Park staging area to relieve road pressure.</li>
          <li><strong>Upstream Transit Coordination:</strong> Flatten arrival spikes before they reach turnstiles.</li>
        </ul>
        <div className="p-2.5 bg-amber-950/40 border border-amber-700/50 rounded-lg text-amber-200 text-xs">
          <strong>Trade-off Detection:</strong> CROWDWISE highlights when an intervention improves one gate but transfers the bottleneck downstream!
        </div>
      </div>
    ),
  },
];

export const GuidedTourModal: React.FC<GuidedTourModalProps> = ({ onClose }) => {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const Icon = current.icon;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-navy-850 border border-navy-600 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-navy-700 flex items-center justify-between bg-navy-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-950 border border-cyan-500/30 text-cyan-400">
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-base">{current.title}</h3>
              <p className="text-xs text-cyan-300">{current.subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-navy-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">{current.content}</div>

        {/* Footer Navigation */}
        <div className="px-6 py-4 border-t border-navy-700 bg-navy-900 flex items-center justify-between">
          {/* Step dots */}
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setStep(idx)}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === step ? 'w-6 bg-cyan-400' : 'bg-slate-600 hover:bg-slate-400'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="px-3 py-1.5 rounded-lg border border-navy-600 text-xs font-medium text-slate-300 hover:bg-navy-800 transition flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
            )}

            {step < STEPS.length - 1 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-semibold text-white transition flex items-center gap-1 shadow-md shadow-cyan-900/30"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={onClose}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition flex items-center gap-1 shadow-md shadow-emerald-900/30"
              >
                <Check className="w-4 h-4" />
                Start Planning
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

