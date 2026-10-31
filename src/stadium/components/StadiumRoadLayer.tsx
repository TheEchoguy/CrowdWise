import React from 'react';
import { CHINNASWAMY_ROADS } from '../data/roads';

export const StadiumRoadLayer: React.FC = () => {
  return (
    <g id="layer-roads" className="pointer-events-none select-none">
      <defs>
        {/* Queens Road Red-Stripe Hazard Pattern */}
        <pattern
          id="restrictedHatch"
          width="16"
          height="16"
          patternTransform="rotate(45 0 0)"
          patternUnits="userSpaceOnUse"
        >
          <line x1="0" y1="0" x2="0" y2="16" stroke="#ef4444" strokeWidth="4" strokeOpacity="0.4" />
        </pattern>
      </defs>

      {/* ─── 1. ROAD CARRIAGEWAYS & CURBS ───────────────────────────────── */}
      {CHINNASWAMY_ROADS.map((road) => {
        const pathData = road.points
          .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x},${p.y}`)
          .join(' ');

        return (
          <g key={road.id} id={`road-${road.id}`}>
            {/* Road Outer Curb / Sidewalk Base */}
            <path
              d={pathData}
              fill="none"
              stroke="#1e293b"
              strokeWidth={road.width + 12}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Asphalt Carriageway */}
            <path
              d={pathData}
              fill="none"
              stroke={road.isSpectatorPermitted ? '#0f172a' : '#1c1917'}
              strokeWidth={road.width}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Queens Road Restricted Hazard Overlay */}
            {!road.isSpectatorPermitted && (
              <path
                d={pathData}
                fill="none"
                stroke="url(#restrictedHatch)"
                strokeWidth={road.width - 4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Dashed Road Centerline */}
            <path
              d={pathData}
              fill="none"
              stroke={road.isSpectatorPermitted ? '#94a3b8' : '#ef4444'}
              strokeWidth={1.8}
              strokeDasharray="12,12"
              strokeOpacity={0.6}
            />

            {/* Road Label */}
            <text
              x={road.labelPosition.x}
              y={road.labelPosition.y}
              transform={
                road.labelPosition.rotation
                  ? `rotate(${road.labelPosition.rotation}, ${road.labelPosition.x}, ${road.labelPosition.y})`
                  : undefined
              }
              textAnchor="middle"
              dominantBaseline="middle"
              className={`text-[11px] font-extrabold tracking-widest ${
                road.isSpectatorPermitted
                  ? 'fill-slate-300 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]'
                  : 'fill-rose-400 drop-shadow-[0_1px_4px_rgba(225,29,72,0.8)]'
              }`}
            >
              {road.label}
            </text>
          </g>
        );
      })}

      {/* Pedestrian Zebra Crossings at Key Outer Gates */}
      {[
        { x: 440, y: 140, w: 20, h: 48 }, // E3 Cubbon
        { x: 625, y: 140, w: 22, h: 48 }, // E23 Cubbon
        { x: 895, y: 140, w: 22, h: 48 }, // E19 Cubbon
        { x: 1300, y: 640, w: 42, h: 24 }, // E13 Link
        { x: 1160, y: 1040, w: 30, h: 48 } // E11 MG Road
      ].map((cross, i) => (
        <g key={`crosswalk-${i}`} opacity={0.75}>
          {[-8, -4, 0, 4, 8].map((offset, j) => (
            <rect
              key={`stripe-${j}`}
              x={cross.w > cross.h ? cross.x : cross.x + offset * 2.2}
              y={cross.w > cross.h ? cross.y + offset * 2.2 : cross.y}
              width={cross.w > cross.h ? cross.w : 3}
              height={cross.w > cross.h ? 3 : cross.h}
              fill="#ffffff"
            />
          ))}
        </g>
      ))}

      {/* Queens Road Red Security Perimeter Boundary Line */}
      <path
        d="M 330,220 L 390,380 L 460,650 L 530,860 L 570,960"
        fill="none"
        stroke="#ef4444"
        strokeWidth={2.5}
        strokeDasharray="6,4"
        className="animate-pulse"
      />
    </g>
  );
};

