import React from 'react';
import { CHINNASWAMY_LANDMARKS, CHINNASWAMY_HOLDING_AREAS } from '../data/landmarks';
import { CHINNASWAMY_EMERGENCY_FACILITIES } from '../data/emergencyFacilities';

interface StadiumInfrastructureLayerProps {
  showLandmarks: boolean;
  showEmergency: boolean;
  showAmbulances: boolean;
  showHoldingAreas: boolean;
  showWatchtowers: boolean;
}

export const StadiumInfrastructureLayer: React.FC<StadiumInfrastructureLayerProps> = ({
  showLandmarks,
  showEmergency,
  showAmbulances,
  showHoldingAreas,
  showWatchtowers
}) => {
  return (
    <g id="layer-infrastructure" className="select-none pointer-events-none">
      {/* ─── 1. GEOGRAPHIC LANDMARKS & GREEN SPACES ─────────────────────── */}
      {showLandmarks && (
        <g id="sublayer-landmarks">
          {CHINNASWAMY_LANDMARKS.map((landmark) => (
            <g key={landmark.id} id={`landmark-${landmark.id}`}>
              {/* Landmark Area Polygon or Rect */}
              {landmark.bounds.path ? (
                <path
                  d={landmark.bounds.path}
                  fill={landmark.color}
                  fillOpacity={0.35}
                  stroke={landmark.color}
                  strokeWidth={1.5}
                />
              ) : (
                <rect
                  x={landmark.bounds.x}
                  y={landmark.bounds.y}
                  width={landmark.bounds.width || 100}
                  height={landmark.bounds.height || 60}
                  rx={8}
                  fill={landmark.color}
                  fillOpacity={0.35}
                  stroke={landmark.color}
                  strokeWidth={1.5}
                />
              )}

              {/* Landmark Label */}
              <text
                x={landmark.labelPosition.x}
                y={landmark.labelPosition.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-[10px] font-extrabold fill-slate-200 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] tracking-wider"
              >
                {landmark.name.toUpperCase()}
              </text>
            </g>
          ))}
        </g>
      )}

      {/* ─── 2. GREEN HOLDING AREAS (MATCHING OFFICIAL MAP) ─────────────── */}
      {showHoldingAreas && (
        <g id="sublayer-holding-areas">
          {CHINNASWAMY_HOLDING_AREAS.map((holding) => (
            <g key={holding.id} id={`holding-${holding.id}`}>
              <rect
                x={holding.x}
                y={holding.y}
                width={holding.width}
                height={holding.height}
                rx={16} // Rounded capsule pill
                fill="#15803d"
                fillOpacity={0.85}
                stroke="#4ade80"
                strokeWidth={1.2}
                className="drop-shadow-md"
              />
              <text
                x={holding.x + holding.width / 2}
                y={holding.y + holding.height / 2 + 0.5}
                textAnchor="middle"
                dominantBaseline="central"
                className="text-[7.5px] font-black fill-white tracking-tighter"
              >
                {holding.label}
              </text>
            </g>
          ))}
        </g>
      )}

      {/* ─── 3. EMERGENCY AMBULANCES (OFFICIAL LOCATIONS) ───────────────── */}
      {showAmbulances && (
        <g id="sublayer-ambulances">
          {CHINNASWAMY_EMERGENCY_FACILITIES.filter((f) => f.type === 'AMBULANCE').map((amb) => (
            <g
              key={amb.id}
              id={`amb-${amb.id}`}
              transform={`translate(${amb.x}, ${amb.y}) rotate(${amb.rotation || 0})`}
              className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
            >
              {/* Ambulance Van Body */}
              <rect x={-14} y={-8} width={28} height={16} rx={3} fill="#ffffff" stroke="#dc2626" strokeWidth={1.2} />
              {/* Front Windshield */}
              <rect x={7} y={-6} width={5} height={12} rx={1} fill="#0284c7" />
              {/* Red Cross on Roof */}
              <rect x={-4} y={-6} width={6} height={2} fill="#dc2626" />
              <rect x={-2} y={-8} width={2} height={6} fill="#dc2626" />
              {/* Flashing Emergency Beacon */}
              <circle cx={-1} cy={-5} r={2} fill="#ef4444" className="animate-ping" />
              {/* Text label */}
              <text x={0} y={15} textAnchor="middle" className="text-[7px] font-bold fill-rose-300">
                AMBULANCE
              </text>
            </g>
          ))}
        </g>
      )}

      {/* ─── 4. MEDICAL CROSS POSTS (+) ─────────────────────────────────── */}
      {showEmergency && (
        <g id="sublayer-medical">
          {CHINNASWAMY_EMERGENCY_FACILITIES.filter((f) => f.type === 'MEDICAL_POST').map((med) => (
            <g key={med.id} id={`med-${med.id}`} transform={`translate(${med.x}, ${med.y})`}>
              <rect x={-9} y={-9} width={18} height={18} rx={4} fill="#16a34a" stroke="#ffffff" strokeWidth={1.2} />
              {/* White Cross */}
              <rect x={-6} y={-2} width={12} height={4} fill="#ffffff" />
              <rect x={-2} y={-6} width={4} height={12} fill="#ffffff" />
            </g>
          ))}
        </g>
      )}

      {/* ─── 5. SECURITY WATCHTOWERS ─────────────────────────────────────── */}
      {showWatchtowers && (
        <g id="sublayer-watchtowers">
          {CHINNASWAMY_EMERGENCY_FACILITIES.filter((f) => f.type === 'WATCHTOWER').map((tow) => (
            <g key={tow.id} id={`tow-${tow.id}`} transform={`translate(${tow.x}, ${tow.y})`}>
              {/* Tower base */}
              <polygon points="-7,8 7,8 5,-4 -5,-4" fill="#334155" stroke="#94a3b8" strokeWidth={1} />
              {/* Observation platform */}
              <rect x={-8} y={-9} width={16} height={6} rx={1} fill="#475569" stroke="#cbd5e1" strokeWidth={0.8} />
              {/* Searchlight beacon */}
              <circle cx={0} cy={-11} r={2} fill="#38bdf8" />
            </g>
          ))}
        </g>
      )}
    </g>
  );
};

