import React from 'react';
import { CHINNASWAMY_STANDS } from '../data/stands';
import { CHINNASWAMY_METADATA } from '../data/stadiumMetadata';
import { createAnnularSectorPath } from '../utils/coordinateTransform';
import { StadiumStand } from '../types/stadium';

interface StadiumStandLayerProps {
  selectedStandId: string | null;
  onSelectStand?: (stand: StadiumStand) => void;
}

export const StadiumStandLayer: React.FC<StadiumStandLayerProps> = ({
  selectedStandId,
  onSelectStand
}) => {
  const { center } = CHINNASWAMY_METADATA;

  return (
    <g id="layer-stadium-bowl" className="select-none pointer-events-auto">
      <defs>
        {/* Outfield Concentric Mowing Patterns */}
        <radialGradient id="outfieldGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#15803d" />
          <stop offset="60%" stopColor="#166534" />
          <stop offset="90%" stopColor="#14532d" />
          <stop offset="100%" stopColor="#052e16" />
        </radialGradient>

        {/* Pitch Clay Texture Gradient */}
        <linearGradient id="pitchGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" stopOpacity="0.8" />
          <stop offset="50%" stopColor="#eab308" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#ca8a04" stopOpacity="0.85" />
        </linearGradient>

        <filter id="standShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#000000" floodOpacity="0.6" />
        </filter>
      </defs>

      {/* ─── 1. CENTRAL CRICKET GROUND & OUTFIELD ───────────────────────── */}
      {/* Outer Concourse Ring Underlay */}
      <circle
        cx={center.x}
        cy={center.y}
        r={380}
        fill="#0f172a"
        stroke="#1e293b"
        strokeWidth={3}
      />

      {/* Outer Stadium Boundary Moat / Gutter */}
      <circle
        cx={center.x}
        cy={center.y}
        r={215}
        fill="#022c22"
        stroke="#065f46"
        strokeWidth={2}
      />

      {/* Cricket Outfield Oval */}
      <ellipse
        cx={center.x}
        cy={center.y}
        rx={205}
        ry={195}
        fill="url(#outfieldGrad)"
        stroke="#22c55e"
        strokeWidth={1.5}
      />

      {/* Outfield Mowing Stripes (Concentric Circular Bands) */}
      {[50, 90, 130, 170].map((radius, idx) => (
        <circle
          key={`mow-${idx}`}
          cx={center.x}
          cy={center.y}
          r={radius}
          fill="none"
          stroke="#4ade80"
          strokeWidth={0.6}
          strokeOpacity={0.25}
          strokeDasharray="4,4"
        />
      ))}

      {/* 30-Yard Fielding Restriction Circle */}
      <circle
        cx={center.x}
        cy={center.y}
        r={110}
        fill="#14532d"
        fillOpacity={0.2}
        stroke="#86efac"
        strokeWidth={1.2}
        strokeDasharray="6,4"
      />
      <text
        x={center.x}
        y={center.y - 114}
        textAnchor="middle"
        className="text-[9px] font-mono fill-emerald-300/70 font-semibold"
      >
        30-YARD FIELDING CIRCLE
      </text>

      {/* 22-Yard Central Cricket Pitch (North-South Oriented) */}
      <g id="cricket-pitch">
        {/* Pitch Turf Base */}
        <rect
          x={center.x - 12}
          y={center.y - 32}
          width={24}
          height={64}
          rx={2}
          fill="url(#pitchGrad)"
          stroke="#a16207"
          strokeWidth={1.2}
        />

        {/* Bowling & Batting Crease Lines */}
        {/* North Wickets (Cubbon End) */}
        <line
          x1={center.x - 10}
          y1={center.y - 25}
          x2={center.x + 10}
          y2={center.y - 25}
          stroke="#ffffff"
          strokeWidth={1.2}
        />
        {/* North Stumps (3 White Dots) */}
        {[-3, 0, 3].map((off) => (
          <circle
            key={`stump-n-${off}`}
            cx={center.x + off}
            cy={center.y - 25}
            r={1}
            fill="#ffffff"
          />
        ))}

        {/* South Wickets (Pavilion End) */}
        <line
          x1={center.x - 10}
          y1={center.y + 25}
          x2={center.x + 10}
          y2={center.y + 25}
          stroke="#ffffff"
          strokeWidth={1.2}
        />
        {/* South Stumps (3 White Dots) */}
        {[-3, 0, 3].map((off) => (
          <circle
            key={`stump-s-${off}`}
            cx={center.x + off}
            cy={center.y + 25}
            r={1}
            fill="#ffffff"
          />
        ))}

        {/* Pitch Center Dot & Directional Arrow */}
        <circle cx={center.x} cy={center.y} r={1.5} fill="#78350f" />
      </g>

      {/* Boundary Rope Marker with Spikes */}
      <ellipse
        cx={center.x}
        cy={center.y}
        rx={195}
        ry={185}
        fill="none"
        stroke="#f8fafc"
        strokeWidth={1.5}
        strokeDasharray="8,3"
      />

      {/* ─── 2. CURVED STADIUM STAND BLOCKS ──────────────────────────────── */}
      {CHINNASWAMY_STANDS.map((stand) => {
        const isSelected = selectedStandId === stand.id;
        const pathData = createAnnularSectorPath(
          stand.startAngleDeg,
          stand.endAngleDeg,
          stand.innerRadius,
          stand.outerRadius,
          center
        );

        return (
          <g
            key={stand.id}
            id={`stand-${stand.id}`}
            className="cursor-pointer transition-all duration-200"
            onClick={() => onSelectStand?.(stand)}
          >
            {/* Stand Outer / Inner Arc Fill */}
            <path
              d={pathData}
              fill={stand.fillColor}
              fillOpacity={isSelected ? 0.95 : 0.78}
              stroke={isSelected ? '#ffffff' : stand.strokeColor}
              strokeWidth={isSelected ? 3 : 1.5}
              filter="url(#standShadow)"
              className="hover:fill-opacity-95 transition"
            />

            {/* Stand Label */}
            <text
              x={stand.labelPosition.x}
              y={stand.labelPosition.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-[11px] font-bold fill-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] tracking-wider pointer-events-none"
            >
              {stand.name.toUpperCase()}
            </text>

            {/* Capacity Sub-label */}
            <text
              x={stand.labelPosition.x}
              y={stand.labelPosition.y + 13}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-[8.5px] font-mono fill-slate-200/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] pointer-events-none"
            >
              {stand.capacity.toLocaleString()} SEATS
            </text>
          </g>
        );
      })}

      {/* Radial Dividing Vomitory Lines between Stand Sectors */}
      {CHINNASWAMY_STANDS.map((stand, i) => {
        const rad = (stand.startAngleDeg * Math.PI) / 180;
        const x1 = center.x + 210 * Math.cos(rad);
        const y1 = center.y + 210 * Math.sin(rad);
        const x2 = center.x + 355 * Math.cos(rad);
        const y2 = center.y + 355 * Math.sin(rad);

        return (
          <line
            key={`div-${i}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#020617"
            strokeWidth={2}
          />
        );
      })}
    </g>
  );
};

