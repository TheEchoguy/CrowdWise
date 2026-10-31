import React from 'react';
import { OuterGate, InnerGate } from '../types/stadium';

interface OuterGateMarkerProps {
  gate: OuterGate;
  isSelected: boolean;
  isLinkedToSelectedInner: boolean;
  onSelect: (gate: OuterGate) => void;
}

export const OuterGateMarker: React.FC<OuterGateMarkerProps> = ({
  gate,
  isSelected,
  isLinkedToSelectedInner,
  onSelect
}) => {
  // Compute arrow angle from approachVector
  const angleRad = Math.atan2(gate.approachVector.dy, gate.approachVector.dx);
  const angleDeg = (angleRad * 180) / Math.PI;

  const isRestricted = gate.accessPermission === 'RESTRICTED_VIP_MEDIA';
  const isUnverified = gate.verificationStatus === 'UNVERIFIED';

  let badgeFill = isRestricted ? '#991b1b' : '#dc2626'; // Red arrow badge
  if (isUnverified) badgeFill = '#d97706'; // Amber for unverified

  return (
    <g
      id={`gate-marker-${gate.id}`}
      className="cursor-pointer select-none transition-transform duration-200"
      onClick={(e) => {
        e.stopPropagation();
        onSelect(gate);
      }}
    >
      {/* Selection Glow Indicator */}
      {(isSelected || isLinkedToSelectedInner) && (
        <circle
          cx={gate.x}
          cy={gate.y}
          r={22}
          fill="none"
          stroke={isSelected ? '#38bdf8' : '#34d399'}
          strokeWidth={3}
          strokeDasharray="4,2"
          className="animate-spin"
          style={{ animationDuration: '6s', transformOrigin: `${gate.x}px ${gate.y}px` }}
        />
      )}

      {/* Directional Approach Arrow Base */}
      <g transform={`translate(${gate.x}, ${gate.y}) rotate(${angleDeg})`}>
        {/* Arrow Shaft & Head pointing in approach direction */}
        <path
          d="M -16 -8 L 0 -8 L 0 -14 L 16 0 L 0 14 L 0 8 L -16 8 Z"
          fill={isSelected ? '#0284c7' : badgeFill}
          stroke={isSelected ? '#ffffff' : '#f8fafc'}
          strokeWidth={1.5}
          className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] hover:scale-110 transition-transform"
        />
      </g>

      {/* Gate ID Circle Badge */}
      <circle
        cx={gate.x}
        cy={gate.y}
        r={12}
        fill={isSelected ? '#0369a1' : isRestricted ? '#7f1d1d' : '#991b1b'}
        stroke="#ffffff"
        strokeWidth={1.8}
        className="drop-shadow-md"
      />

      {/* Gate ID Label */}
      <text
        x={gate.x}
        y={gate.y + 0.5}
        textAnchor="middle"
        dominantBaseline="central"
        className="text-[9px] font-black fill-white tracking-tighter pointer-events-none"
      >
        {gate.id}
      </text>

      {/* Unverified Marker Badge */}
      {isUnverified && (
        <circle
          cx={gate.x + 9}
          cy={gate.y - 9}
          r={4}
          fill="#f59e0b"
          stroke="#ffffff"
          strokeWidth={1}
        />
      )}

      {/* Restricted ⛔ Icon Badge */}
      {isRestricted && (
        <circle
          cx={gate.x + 9}
          cy={gate.y - 9}
          r={4.5}
          fill="#e11d48"
          stroke="#ffffff"
          strokeWidth={1}
        />
      )}
    </g>
  );
};

interface InnerGateMarkerProps {
  gate: InnerGate;
  isSelected: boolean;
  isLinkedToSelectedOuter: boolean;
  onSelect: (gate: InnerGate) => void;
}

export const InnerGateMarker: React.FC<InnerGateMarkerProps> = ({
  gate,
  isSelected,
  isLinkedToSelectedOuter,
  onSelect
}) => {
  return (
    <g
      id={`inner-gate-marker-${gate.id}`}
      className="cursor-pointer select-none transition-transform duration-200"
      onClick={(e) => {
        e.stopPropagation();
        onSelect(gate);
      }}
    >
      {/* Selection Glow Indicator */}
      {(isSelected || isLinkedToSelectedOuter) && (
        <circle
          cx={gate.x}
          cy={gate.y}
          r={20}
          fill="none"
          stroke={isSelected ? '#38bdf8' : '#f59e0b'}
          strokeWidth={2.8}
          strokeDasharray="4,2"
          className="animate-spin"
          style={{ animationDuration: '8s', transformOrigin: `${gate.x}px ${gate.y}px` }}
        />
      )}

      {/* Turnstile Portal Hexagon / Rounded Base */}
      <rect
        x={gate.x - 13}
        y={gate.y - 13}
        width={26}
        height={26}
        rx={6}
        fill={isSelected ? '#0284c7' : isLinkedToSelectedOuter ? '#0f766e' : '#0f172a'}
        stroke={isSelected ? '#38bdf8' : isLinkedToSelectedOuter ? '#34d399' : '#38bdf8'}
        strokeWidth={1.8}
        className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)] hover:stroke-white transition"
      />

      {/* Inner Gate ID Label */}
      <text
        x={gate.x}
        y={gate.y + 0.5}
        textAnchor="middle"
        dominantBaseline="central"
        className="text-[10px] font-black fill-white tracking-tight pointer-events-none"
      >
        {gate.id}
      </text>

      {/* Turnstile Bank Count Pill */}
      <g transform={`translate(${gate.x}, ${gate.y + 17})`}>
        <rect
          x={-12}
          y={-5}
          width={24}
          height={10}
          rx={3}
          fill="#020617"
          stroke="#475569"
          strokeWidth={0.8}
        />
        <text
          x={0}
          y={0.5}
          textAnchor="middle"
          dominantBaseline="central"
          className="text-[7px] font-mono fill-cyan-400 font-bold pointer-events-none"
        >
          {gate.turnstileCount}T
        </text>
      </g>
    </g>
  );
};

