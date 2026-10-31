import React from 'react';
import { CHINNASWAMY_PEDESTRIAN_ROUTES } from '../data/pedestrianRoutes';
import { PedestrianRoute } from '../types/stadium';

interface PedestrianRouteLayerProps {
  selectedGateId: string | null;
  onSelectRoute?: (route: PedestrianRoute) => void;
}

export const PedestrianRouteLayer: React.FC<PedestrianRouteLayerProps> = ({
  selectedGateId,
  onSelectRoute
}) => {
  return (
    <g id="layer-pedestrian-routes">
      <defs>
        {/* Glow Filter for Active Ingress Corridors */}
        <filter id="routeGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Inbound Chevrons Marker */}
        <marker
          id="chevron-verified"
          viewBox="0 0 10 10"
          refX="5"
          refY="5"
          markerWidth="4"
          markerHeight="4"
          orient="auto-start-reverse"
        >
          <path d="M 1 1 L 7 5 L 1 9" fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" />
        </marker>

        <marker
          id="chevron-active"
          viewBox="0 0 10 10"
          refX="5"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 1 1 L 8 5 L 1 9" fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />
        </marker>
      </defs>

      {CHINNASWAMY_PEDESTRIAN_ROUTES.map((route) => {
        const isConnectedToSelected =
          selectedGateId &&
          (route.outerGateId === selectedGateId || route.innerGateId === selectedGateId);

        const isAnyGateSelected = Boolean(selectedGateId);

        // Path data
        const pathData = route.points
          .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x},${p.y}`)
          .join(' ');

        // Stroke color and styling based on verification status
        let strokeColor = '#ef4444'; // Red dotted line matching official map
        let strokeDash = '4,4';
        let strokeWidth = 2.2;
        let opacity = 0.85;

        if (route.verificationStatus === 'UNVERIFIED') {
          strokeColor = '#f59e0b'; // Amber dashed for unverified
          strokeDash = '6,5';
          strokeWidth = 2;
        } else if (route.verificationStatus === 'RESTRICTED') {
          strokeColor = '#f43f5e'; // Rose for restricted VIP
          strokeDash = '5,4';
          strokeWidth = 2;
        }

        if (isAnyGateSelected) {
          if (isConnectedToSelected) {
            strokeColor = '#06b6d4'; // Glowing cyan for active selected route
            strokeWidth = 3.8;
            strokeDash = '6,4';
            opacity = 1;
          } else {
            opacity = 0.22; // Dim unselected routes
          }
        }

        return (
          <g
            key={route.id}
            id={`route-${route.id}`}
            className="cursor-pointer transition-all duration-200"
            onClick={() => onSelectRoute?.(route)}
          >
            {/* Background Thick Glow on Hover / Selection */}
            {isConnectedToSelected && (
              <path
                d={pathData}
                fill="none"
                stroke="#0891b2"
                strokeWidth={8}
                strokeOpacity={0.4}
                filter="url(#routeGlow)"
              />
            )}

            {/* Dotted Pedestrian Flow Line */}
            <path
              d={pathData}
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDash}
              strokeOpacity={opacity}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={isConnectedToSelected ? 'animate-pulse' : undefined}
            />

            {/* Intermediate Waypoint Dots */}
            {route.points.slice(1, -1).map((pt, pIdx) => (
              <circle
                key={`pt-${pIdx}`}
                cx={pt.x}
                cy={pt.y}
                r={isConnectedToSelected ? 3 : 2}
                fill={isConnectedToSelected ? '#38bdf8' : strokeColor}
                opacity={opacity}
              />
            ))}
          </g>
        );
      })}
    </g>
  );
};

