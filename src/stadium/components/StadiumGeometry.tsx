import React, { useRef, useState, useEffect, useCallback } from 'react';
import { SECTION_VIEWPORTS } from '../data/stadiumMetadata';
import { CHINNASWAMY_OUTER_GATES } from '../data/outerGates';
import { CHINNASWAMY_INNER_GATES } from '../data/innerGates';
import { StadiumStandLayer } from './StadiumStandLayer';
import { StadiumRoadLayer } from './StadiumRoadLayer';
import { PedestrianRouteLayer } from './PedestrianRouteLayer';
import { OuterGateMarker, InnerGateMarker } from './StadiumGateMarker';
import { StadiumInfrastructureLayer } from './StadiumInfrastructureLayer';
import {
  OuterGate,
  InnerGate,
  StadiumStand,
  StadiumSection,
  LayerVisibilityState
} from '../types/stadium';

interface StadiumGeometryProps {
  section: StadiumSection;
  layerVisibility: LayerVisibilityState;
  gateFilter: 'ALL' | 'PERMITTED' | 'RESTRICTED';
  searchQuery: string;
  selectedOuterGate: OuterGate | null;
  selectedInnerGate: InnerGate | null;
  onSelectOuterGate: (gate: OuterGate | null) => void;
  onSelectInnerGate: (gate: InnerGate | null) => void;
  onSelectStand: (stand: StadiumStand) => void;
  zoomAction?: 'IN' | 'OUT' | 'RESET' | 'FIT' | null;
  onResetZoomAction?: () => void;
}

export const StadiumGeometry: React.FC<StadiumGeometryProps> = ({
  section,
  layerVisibility,
  gateFilter,
  searchQuery,
  selectedOuterGate,
  selectedInnerGate,
  onSelectOuterGate,
  onSelectInnerGate,
  onSelectStand,
  zoomAction,
  onResetZoomAction
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  // ViewBox pan/zoom state
  const defaultView = SECTION_VIEWPORTS.ALL;
  const [viewBox, setViewBox] = useState({
    x: defaultView.x,
    y: defaultView.y,
    width: defaultView.width,
    height: defaultView.height
  });

  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Update view when section changes
  useEffect(() => {
    const target = SECTION_VIEWPORTS[section] || SECTION_VIEWPORTS.ALL;
    setViewBox({
      x: target.x,
      y: target.y,
      width: target.width,
      height: target.height
    });
  }, [section]);

  // Handle external zoom controls
  useEffect(() => {
    if (!zoomAction) return;

    if (zoomAction === 'RESET' || zoomAction === 'FIT') {
      const target = SECTION_VIEWPORTS[section] || SECTION_VIEWPORTS.ALL;
      setViewBox({
        x: target.x,
        y: target.y,
        width: target.width,
        height: target.height
      });
    } else if (zoomAction === 'IN') {
      setViewBox((prev) => {
        const factor = 0.8;
        const newW = prev.width * factor;
        const newH = prev.height * factor;
        return {
          x: prev.x + (prev.width - newW) / 2,
          y: prev.y + (prev.height - newH) / 2,
          width: newW,
          height: newH
        };
      });
    } else if (zoomAction === 'OUT') {
      setViewBox((prev) => {
        const factor = 1.25;
        const newW = Math.min(2200, prev.width * factor);
        const newH = Math.min(1650, prev.height * factor);
        return {
          x: prev.x + (prev.width - newW) / 2,
          y: prev.y + (prev.height - newH) / 2,
          width: newW,
          height: newH
        };
      });
    }
    onResetZoomAction?.();
  }, [zoomAction, section, onResetZoomAction]);

  // Wheel zoom around cursor
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (!svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const cursorRatioX = (e.clientX - rect.left) / rect.width;
    const cursorRatioY = (e.clientY - rect.top) / rect.height;

    const zoomFactor = e.deltaY < 0 ? 0.88 : 1.14;

    setViewBox((prev) => {
      const newWidth = Math.max(350, Math.min(2200, prev.width * zoomFactor));
      const newHeight = Math.max(260, Math.min(1650, prev.height * zoomFactor));
      const deltaX = prev.width - newWidth;
      const deltaY = prev.height - newHeight;

      return {
        x: prev.x + deltaX * cursorRatioX,
        y: prev.y + deltaY * cursorRatioY,
        width: newWidth,
        height: newHeight
      };
    });
  }, []);

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = viewBox.width / rect.width;
    const scaleY = viewBox.height / rect.height;

    const dx = (e.clientX - dragStart.x) * scaleX;
    const dy = (e.clientY - dragStart.y) * scaleY;

    setViewBox((prev) => ({
      ...prev,
      x: prev.x - dx,
      y: prev.y - dy
    }));

    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Filter outer gates based on search & category
  const filteredOuterGates = CHINNASWAMY_OUTER_GATES.filter((gate) => {
    if (gateFilter === 'PERMITTED' && gate.accessPermission !== 'SPECTATOR_PERMITTED') return false;
    if (gateFilter === 'RESTRICTED' && gate.accessPermission !== 'RESTRICTED_VIP_MEDIA') return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchId = gate.id.toLowerCase().includes(q);
      const matchRoad = gate.road.toLowerCase().includes(q);
      const matchNote = gate.notes.toLowerCase().includes(q);
      return matchId || matchRoad || matchNote;
    }
    return true;
  });

  // Filter inner gates based on search
  const filteredInnerGates = CHINNASWAMY_INNER_GATES.filter((gate) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchId = gate.id.toLowerCase().includes(q);
      const matchStand = gate.standName.toLowerCase().includes(q);
      return matchId || matchStand;
    }
    return true;
  });

  return (
    <div className="w-full h-full relative overflow-hidden bg-[#070b12] rounded-xl border border-slate-800 shadow-2xl">
      <svg
        ref={svgRef}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        className="w-full h-full cursor-grab active:cursor-grabbing select-none"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={() => {
          onSelectOuterGate(null);
          onSelectInnerGate(null);
        }}
      >
        {/* Subtle CAD Background Grid Lines */}
        <defs>
          <pattern id="cadGrid" width="80" height="80" patternUnits="userSpaceOnUse">
            <path d="M 80 0 L 0 0 0 80" fill="none" stroke="#1e293b" strokeWidth="0.5" strokeOpacity="0.4" />
          </pattern>
        </defs>
        <rect x="-1000" y="-1000" width="3600" height="3200" fill="url(#cadGrid)" />

        {/* ─── LAYER 6: SURROUNDING ROADS ─────────────────────────────── */}
        {layerVisibility.roads && <StadiumRoadLayer />}

        {/* ─── LAYER 6: LANDMARKS & INFRASTRUCTURE ─────────────────────── */}
        <StadiumInfrastructureLayer
          showLandmarks={layerVisibility.parkingAndLandmarks}
          showEmergency={layerVisibility.medicalFacilities}
          showAmbulances={layerVisibility.ambulanceLocations}
          showHoldingAreas={layerVisibility.holdingAreas}
          showWatchtowers={layerVisibility.securityWatchtowers}
        />

        {/* ─── LAYER 1 & 2: STADIUM BOWL & STAND ARCHITECTURE ─────────── */}
        {layerVisibility.stands && (
          <StadiumStandLayer
            selectedStandId={selectedInnerGate?.standId || null}
            onSelectStand={onSelectStand}
          />
        )}

        {/* ─── LAYER 5: PEDESTRIAN PATHWAYS ───────────────────────────── */}
        {layerVisibility.pedestrianRoutes && (
          <PedestrianRouteLayer
            selectedGateId={selectedOuterGate?.id || selectedInnerGate?.id || null}
          />
        )}

        {/* ─── LAYER 3: INNER GATES (G-SERIES) ────────────────────────── */}
        {layerVisibility.innerGates && (
          <g id="layer-inner-gates">
            {filteredInnerGates.map((gate) => {
              const isSelected = selectedInnerGate?.id === gate.id;
              const isLinked = selectedOuterGate?.connectedInnerGates.includes(gate.id) || false;

              return (
                <InnerGateMarker
                  key={gate.id}
                  gate={gate}
                  isSelected={isSelected}
                  isLinkedToSelectedOuter={isLinked}
                  onSelect={(g) => {
                    onSelectInnerGate(g);
                    onSelectOuterGate(null);
                  }}
                />
              );
            })}
          </g>
        )}

        {/* ─── LAYER 4: OUTER GATES (E-SERIES) ────────────────────────── */}
        {layerVisibility.outerGates && (
          <g id="layer-outer-gates">
            {filteredOuterGates.map((gate) => {
              const isSelected = selectedOuterGate?.id === gate.id;
              const isLinked = selectedInnerGate?.connectedOuterGates.includes(gate.id) || false;

              return (
                <OuterGateMarker
                  key={gate.id}
                  gate={gate}
                  isSelected={isSelected}
                  isLinkedToSelectedInner={isLinked}
                  onSelect={(g) => {
                    onSelectOuterGate(g);
                    onSelectInnerGate(null);
                  }}
                />
              );
            })}
          </g>
        )}
      </svg>
    </div>
  );
};
