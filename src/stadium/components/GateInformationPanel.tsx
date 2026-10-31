import React from 'react';
import { OuterGate, InnerGate, StadiumStand } from '../types/stadium';
import { CHINNASWAMY_STANDS } from '../data/stands';
import { CHINNASWAMY_INNER_GATES } from '../data/innerGates';
import { CHINNASWAMY_OUTER_GATES } from '../data/outerGates';
import {
  ShieldCheck,
  ShieldAlert,
  Info,
  Navigation,
  Crosshair,
  Building2,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertTriangle
} from 'lucide-react';

interface GateInformationPanelProps {
  selectedOuterGate: OuterGate | null;
  selectedInnerGate: InnerGate | null;
  selectedStand: StadiumStand | null;
  onSelectOuterGate: (gate: OuterGate | null) => void;
  onSelectInnerGate: (gate: InnerGate | null) => void;
}

export const GateInformationPanel: React.FC<GateInformationPanelProps> = ({
  selectedOuterGate,
  selectedInnerGate,
  selectedStand,
  onSelectOuterGate,
  onSelectInnerGate
}) => {
  // If Outer Gate is selected
  if (selectedOuterGate) {
    const isRestricted = selectedOuterGate.accessPermission === 'RESTRICTED_VIP_MEDIA';
    const isVerified = selectedOuterGate.verificationStatus === 'VERIFIED';
    const isUnverified = selectedOuterGate.verificationStatus === 'UNVERIFIED';

    // Find connected inner gate objects
    const connectedInners = CHINNASWAMY_INNER_GATES.filter((ig) =>
      selectedOuterGate.connectedInnerGates.includes(ig.id)
    );

    // Find destination stands (only show if verified or clearly restricted)
    const destinationStands = isVerified
      ? CHINNASWAMY_STANDS.filter((s) =>
          connectedInners.some((ig) => s.associatedInnerGates.includes(ig.id))
        )
      : [];

    return (
      <div className="flex flex-col h-full gap-3 overflow-y-auto pr-1 select-none text-slate-200">
        {/* Header Card */}
        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center font-black text-white text-xs shadow-md">
                {selectedOuterGate.id}
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-white">
                  {selectedOuterGate.label}
                </h3>
                <span className="text-[10px] font-mono text-slate-400">
                  Outer Perimeter Entrance
                </span>
              </div>
            </div>

            {/* Status Pill */}
            {isVerified && (
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                <CheckCircle2 className="w-3 h-3" /> VERIFIED
              </span>
            )}
            {isUnverified && (
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950 text-amber-400 border border-amber-800">
                <AlertTriangle className="w-3 h-3" /> UNVERIFIED
              </span>
            )}
            {isRestricted && (
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-950 text-rose-400 border border-rose-800">
                <XCircle className="w-3 h-3" /> RESTRICTED
              </span>
            )}
          </div>

          {/* Access Permission Callout */}
          <div
            className={`p-2 rounded-lg border text-xs font-semibold flex items-start gap-2 mb-2 ${
              isRestricted
                ? 'bg-rose-950/60 border-rose-800 text-rose-300'
                : 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
            }`}
          >
            {isRestricted ? (
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            ) : (
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
            )}
            <div className="text-[11px] leading-tight">
              {isRestricted
                ? 'RESTRICTED VENUE ACCESS: Media, VIP Dignitaries & Police Personnel Only. No General Public Spectator Entry.'
                : 'PUBLIC SPECTATOR INGRESS: Authorized general admission route via arterial pedestrian sidewalks.'}
            </div>
          </div>

          {/* Location & Sector */}
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-[9px] text-slate-400 block font-mono">ARTERIAL ROAD</span>
              <span className="font-bold text-slate-200">{selectedOuterGate.road.replace('_', ' ')}</span>
            </div>
            <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-[9px] text-slate-400 block font-mono">SECTOR</span>
              <span className="font-bold text-slate-200">{selectedOuterGate.section}</span>
            </div>
          </div>
        </div>

        {/* Connected Inner Gates Card */}
        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-md">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
            <Crosshair className="w-4 h-4 text-cyan-400" />
            <span>Connected Inner Turnstiles</span>
          </div>

          {connectedInners.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {connectedInners.map((ig) => (
                <button
                  key={ig.id}
                  onClick={() => {
                    onSelectInnerGate(ig);
                    onSelectOuterGate(null);
                  }}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800 transition text-left group"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 flex items-center justify-center font-black text-xs font-mono">
                      {ig.id}
                    </span>
                    <div>
                      <div className="text-xs font-bold text-slate-200 group-hover:text-cyan-300">
                        {ig.standName}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {ig.turnstileCount} Turnstiles • {ig.baseCapacityPerMin} p/min
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-transform group-hover:translate-x-1" />
                </button>
              ))}
            </div>
          ) : (
            <div className="text-xs text-amber-400 italic">No inner gate connections verified yet.</div>
          )}
        </div>

        {/* Destination Stands Card (Only shown when verified) */}
        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-md">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
            <Building2 className="w-4 h-4 text-emerald-400" />
            <span>Destination Stands</span>
          </div>

          {destinationStands.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {destinationStands.map((stand) => (
                <div
                  key={stand.id}
                  className="p-2 rounded-lg bg-slate-950/70 border border-slate-800 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3.5 h-3.5 rounded-full shrink-0"
                      style={{ backgroundColor: stand.fillColor }}
                    />
                    <div>
                      <div className="text-xs font-bold text-white">{stand.name}</div>
                      <div className="text-[10px] text-slate-400">{stand.tierLabel}</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-emerald-400">
                    {stand.capacity.toLocaleString()} seats
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-amber-400 italic">
              {isUnverified
                ? 'Stand assignment unverified: awaiting official KSCA seating sector confirmation.'
                : 'No spectator stands assigned to this restricted service gate.'}
            </div>
          )}
        </div>

        {/* Blueprint Field Notes */}
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
          <div className="flex items-center gap-1.5 text-slate-300 font-bold mb-1">
            <Info className="w-3.5 h-3.5 text-cyan-400" />
            <span>Official Blueprint Note</span>
          </div>
          <p>{selectedOuterGate.notes}</p>
        </div>
      </div>
    );
  }

  // If Inner Gate is selected
  if (selectedInnerGate) {
    const parentStand = CHINNASWAMY_STANDS.find((s) => s.id === selectedInnerGate.standId);
    const feedingOuters = CHINNASWAMY_OUTER_GATES.filter((og) =>
      selectedInnerGate.connectedOuterGates.includes(og.id)
    );

    return (
      <div className="flex flex-col h-full gap-3 overflow-y-auto pr-1 select-none text-slate-200">
        {/* Header Card */}
        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-cyan-600 flex items-center justify-center font-black text-white text-xs shadow-md">
                {selectedInnerGate.id}
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-white">
                  {selectedInnerGate.label}
                </h3>
                <span className="text-[10px] font-mono text-cyan-400">
                  Inner Concourse Turnstile Bank
                </span>
              </div>
            </div>

            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
              <CheckCircle2 className="w-3 h-3" /> VERIFIED
            </span>
          </div>

          {/* Turnstile Capacity Metrics */}
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800 text-center">
              <span className="text-[9px] text-slate-400 font-mono block">ACTIVE TURNSTILES</span>
              <span className="text-sm font-extrabold text-cyan-400 font-mono">
                {selectedInnerGate.turnstileCount} Units
              </span>
            </div>
            <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800 text-center">
              <span className="text-[9px] text-slate-400 font-mono block">BASE THROUGHPUT</span>
              <span className="text-sm font-extrabold text-emerald-400 font-mono">
                {selectedInnerGate.baseCapacityPerMin} p/min
              </span>
            </div>
          </div>
        </div>

        {/* Associated Stand Card */}
        {parentStand && (
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-md">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              <Building2 className="w-4 h-4 text-emerald-400" />
              <span>Assigned Seating Stand</span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: parentStand.fillColor }}
                />
                <div>
                  <div className="text-xs font-bold text-white">{parentStand.name}</div>
                  <div className="text-[10px] text-slate-400">{parentStand.tierLabel}</div>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-400">
                {parentStand.capacity.toLocaleString()} seats
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
              {parentStand.description}
            </p>
          </div>
        )}

        {/* Feeding Outer Perimeter Gates */}
        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-md">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
            <Navigation className="w-4 h-4 text-rose-400" />
            <span>Feeding Outer Gates</span>
          </div>

          <div className="flex flex-col gap-1.5">
            {feedingOuters.map((og) => (
              <button
                key={og.id}
                onClick={() => {
                  onSelectOuterGate(og);
                  onSelectInnerGate(null);
                }}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800 transition text-left group"
              >
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded bg-rose-950 text-rose-400 border border-rose-800 flex items-center justify-center font-black text-xs font-mono">
                    {og.id}
                  </span>
                  <div>
                    <div className="text-xs font-bold text-slate-200 group-hover:text-rose-300">
                      {og.label}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {og.road.replace('_', ' ')}
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-rose-400 transition-transform group-hover:translate-x-1" />
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
          <div className="flex items-center gap-1.5 text-slate-300 font-bold mb-1">
            <Info className="w-3.5 h-3.5 text-cyan-400" />
            <span>Operational Detail</span>
          </div>
          <p>{selectedInnerGate.notes}</p>
        </div>
      </div>
    );
  }

  // If Stand is selected
  if (selectedStand) {
    return (
      <div className="flex flex-col h-full gap-3 overflow-y-auto pr-1 select-none text-slate-200">
        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-5 h-5 rounded-full"
              style={{ backgroundColor: selectedStand.fillColor }}
            />
            <h3 className="text-sm font-extrabold text-white">{selectedStand.name}</h3>
          </div>
          <span className="text-[11px] text-slate-400 block mb-2">{selectedStand.tierLabel}</span>
          <div className="p-2 rounded bg-slate-950/70 border border-slate-800 text-center">
            <span className="text-[9px] font-mono text-slate-400 block">SEATING CAPACITY</span>
            <span className="text-base font-extrabold text-emerald-400 font-mono">
              {selectedStand.capacity.toLocaleString()} Seats
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-3 leading-relaxed">
            {selectedStand.description}
          </p>
        </div>
      </div>
    );
  }

  // Default Overview State
  return (
    <div className="flex flex-col h-full gap-3 overflow-y-auto pr-1 select-none text-slate-200">
      <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-lg text-center">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center font-black text-white text-base mx-auto mb-2.5 shadow-lg shadow-cyan-950">
          KSCA
        </div>
        <h3 className="text-sm font-extrabold text-white">M. Chinnaswamy Stadium</h3>
        <p className="text-[11px] text-slate-400 mb-3">
          Official Geospatial Digital Blueprint
        </p>

        <div className="grid grid-cols-2 gap-2 text-left text-xs mb-3">
          <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800">
            <span className="text-[9px] font-mono text-slate-400 block">CAPACITY</span>
            <span className="font-extrabold text-white">35,000 Seats</span>
          </div>
          <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800">
            <span className="text-[9px] font-mono text-slate-400 block">PITCH</span>
            <span className="font-extrabold text-white">North-South</span>
          </div>
          <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800">
            <span className="text-[9px] font-mono text-slate-400 block">OUTER GATES</span>
            <span className="font-extrabold text-rose-400">23 (E1–E23)</span>
          </div>
          <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800">
            <span className="text-[9px] font-mono text-slate-400 block">INNER BANKS</span>
            <span className="font-extrabold text-cyan-400">15 (G1–G15)</span>
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-cyan-950/40 border border-cyan-800/60 text-left text-[11px] text-cyan-300 flex items-start gap-2">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-cyan-400" />
          <span>
            Click any <strong>Outer Gate (E-series)</strong> or <strong>Inner Gate (G-series)</strong> to inspect its verified approach vectors, destination stands, and holding enclosures.
          </span>
        </div>
      </div>
    </div>
  );
};
