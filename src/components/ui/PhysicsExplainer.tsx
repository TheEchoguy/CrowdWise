import React, { useState } from 'react';
import { ChevronDown, ChevronUp, BookOpen, Layers, Compass } from 'lucide-react';

export const PhysicsExplainer: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden backdrop-blur-md">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 text-xs font-bold uppercase tracking-wider text-slate-300 hover:text-slate-100 transition"
      >
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-cyan-400" />
          <span>Microscopic Physics Engine & Helbing Social Force Specifications</span>
        </div>
        <div className="flex items-center gap-1 text-slate-500 font-mono text-[11px]">
          <span>{isOpen ? 'COLLAPSE SPECS' : 'EXPAND SPECS'}</span>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {isOpen && (
        <div className="p-4 pt-0 border-t border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-300 font-mono">
          {/* Equation 1 */}
          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-2">
            <div className="flex items-center gap-1.5 text-cyan-400 font-bold uppercase text-[11px]">
              <Compass className="w-3.5 h-3.5" />
              <span>1. Target Driving Force</span>
            </div>
            <div className="p-2 rounded bg-slate-900 text-cyan-300 text-center font-bold">
              F_target = (v_desired - v_actual) / τ
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
              Relaxation time parameter <span className="text-slate-200 font-mono font-bold">τ = 0.5s</span>. Directs individual pedestrian vectors towards open egress turnstiles while honoring physiological acceleration limits.
            </p>
          </div>

          {/* Equation 2 */}
          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-2">
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold uppercase text-[11px]">
              <Layers className="w-3.5 h-3.5" />
              <span>2. Spatial Hash O(N) Grid</span>
            </div>
            <div className="p-2 rounded bg-slate-900 text-emerald-300 text-center font-bold">
              Bin Size: 32px | O(N² → N)
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
              Continuous 2D hash grid buckets 2,000+ pedestrians into localized spatial cells, allowing sub-millisecond neighbor queries and pairwise contact checks at solid 60 FPS.
            </p>
          </div>

          {/* Equation 3 */}
          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-2">
            <div className="flex items-center gap-1.5 text-rose-400 font-bold uppercase text-[11px]">
              <BookOpen className="w-3.5 h-3.5" />
              <span>3. Viscosity Decay & Shear</span>
            </div>
            <div className="p-2 rounded bg-slate-900 text-rose-300 text-center font-bold">
              v *= 1 / (1 + 0.65 · (ρ - 4.0)^1.8)
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
              When local crowd density exceeds <span className="text-slate-200 font-mono font-bold">4.0 p/m²</span>, forward velocity decays non-linearly, modeling sudden fluid freeze, turbulence, and dangerous compressive shockwaves.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
