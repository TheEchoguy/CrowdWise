import { Venue, CrowdAgent, RenderLayers, RenderDetailLevel, Gate, Zone, Incident, ZoneComparisonResult } from '../../types';

export interface ViewportTransform {
  x: number;
  y: number;
  scale: number;
}

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  public transform: ViewportTransform;
  private isDragging: boolean = false;
  private dragStartX: number = 0;
  private dragStartY: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not get 2D canvas context');
    this.ctx = context;

    this.transform = {
      x: 40,
      y: 30,
      scale: 3.2,
    };
  }

  public resize(width: number, height: number): void {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.ctx.scale(dpr, dpr);
  }

  public screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: (screenX - this.transform.x) / this.transform.scale,
      y: (screenY - this.transform.y) / this.transform.scale,
    };
  }

  public fitToView(venue: Venue, viewWidth: number, viewHeight: number): void {
    const pad = 40;
    const availW = viewWidth - pad * 2;
    const availH = viewHeight - pad * 2;

    const scaleX = availW / venue.dimensions.width;
    const scaleY = availH / venue.dimensions.height;
    const scale = Math.min(scaleX, scaleY);

    this.transform = {
      scale,
      x: (viewWidth - venue.dimensions.width * scale) / 2,
      y: (viewHeight - venue.dimensions.height * scale) / 2,
    };
  }

  public fitToGateArea(
    gateIds: string[],
    venue: Venue,
    viewWidth: number,
    viewHeight: number
  ): void {
    const selectedGates = venue.gates.filter((g) => gateIds.includes(g.id));
    if (selectedGates.length === 0) {
      this.fitToView(venue, viewWidth, viewHeight);
      return;
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const g of selectedGates) {
      minX = Math.min(minX, g.position.x);
      maxX = Math.max(maxX, g.position.x);
      minY = Math.min(minY, g.position.y);
      maxY = Math.max(maxY, g.position.y);

      // Include downstream corridor end
      const corr = venue.corridors.find((c) => c.id === g.downstreamCorridorId);
      if (corr) {
        minX = Math.min(minX, corr.end.x);
        maxX = Math.max(maxX, corr.end.x);
        minY = Math.min(minY, corr.end.y);
        maxY = Math.max(maxY, corr.end.y);
      }
    }

    // Add margin for approach road and queue pen (30 meters)
    const margin = 28;
    minX -= margin;
    maxX += margin;
    minY -= margin;
    maxY += margin;

    const boxW = Math.max(30, maxX - minX);
    const boxH = Math.max(30, maxY - minY);

    const pad = 60;
    const availW = Math.max(100, viewWidth - pad * 2);
    const availH = Math.max(100, viewHeight - pad * 2);

    const scaleX = availW / boxW;
    const scaleY = availH / boxH;
    const scale = Math.max(2.5, Math.min(8.5, Math.min(scaleX, scaleY)));

    this.transform = {
      scale,
      x: (viewWidth - (minX + maxX) * scale) / 2,
      y: (viewHeight - (minY + maxY) * scale) / 2,
    };
  }

  public render(
    venue: Venue,
    agents: CrowdAgent[],
    layers: RenderLayers,
    detailLevel: RenderDetailLevel,
    selectedGateId?: string | null,
    selectedZoneId?: string | null,
    incidents: Incident[] = [],
    spatialComparisons?: ZoneComparisonResult[] | null,
    focusedGateIds?: string[]
  ): void {
    const ctx = this.ctx;
    const { width, height } = this.canvas;
    const dpr = window.devicePixelRatio || 1;
    const logicalW = width / dpr;
    const logicalH = height / dpr;

    // Clear background (Command Center deep navy #0B1020)
    ctx.save();
    ctx.fillStyle = '#0B1020';
    ctx.fillRect(0, 0, logicalW, logicalH);

    // Apply Viewport Pan & Zoom
    ctx.translate(this.transform.x, this.transform.y);
    ctx.scale(this.transform.scale, this.transform.scale);

    // 1. Grid & Scale Reference
    if (layers.gridReference) {
      this.drawGrid(venue, ctx);
    }

    // 2. Venue Base Layout
    if (layers.venueLayout) {
      this.drawVenueLayout(venue, ctx);
    }

    // 2b. Focused Gate-Side Detail Layer
    if (focusedGateIds && focusedGateIds.length > 0) {
      this.drawFocusedGateSideView(venue, ctx, focusedGateIds, agents);
    }

    // 3. Risk Zones Overlay
    if (layers.riskZones) {
      this.drawRiskZones(venue, ctx, selectedZoneId);
    }

    // 4. Corridors & Emergency Routes
    this.drawCorridors(venue, ctx, layers.emergencyRoutes);

    // 5. Queues Visuals
    if (layers.queueVisuals) {
      this.drawQueues(venue, ctx);
    }

    // 6. Density Heatmap Layer
    if (layers.densityHeatmap || detailLevel === 'DENSITY_ONLY') {
      this.drawDensityHeatmap(venue, agents, ctx);
    }

    // 7. Animated Virtual Crowd
    if (layers.animatedCrowd && detailLevel !== 'DENSITY_ONLY') {
      this.drawCrowdAgents(agents, ctx, detailLevel);
    }

    // 8. Movement Flow Direction Arrows
    if (layers.flowArrows) {
      this.drawFlowArrows(agents, ctx);
    }

    // 9. Gate Markers & Status Badges
    if (layers.gateStatus) {
      this.drawGateBadges(venue, ctx, selectedGateId);
    }

    // 10. Incidents and Medical Routes
    if (layers.incidentMarkers) {
      this.drawIncidents(incidents, ctx);
    }

    // 10b. Spatial Comparison Overlay (Intervention vs Baseline Delta)
    if (layers.spatialComparison && spatialComparisons && spatialComparisons.length > 0) {
      this.drawSpatialComparisonOverlay(venue, ctx, spatialComparisons, selectedZoneId);
    }

    ctx.restore();

    // 11. Overlay Scale Bar (Screen coordinates)
    this.drawScreenScaleBar(ctx, logicalW, logicalH);

    // 12. Spatial Comparison Legend (Screen coordinates)
    if (layers.spatialComparison && spatialComparisons && spatialComparisons.length > 0) {
      this.drawSpatialComparisonLegend(ctx, logicalW, logicalH);
    }
  }

  private drawGrid(venue: Venue, ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.strokeStyle = 'rgba(35, 50, 77, 0.4)';
    ctx.lineWidth = 0.5;

    const step = 20; // 20m grid
    for (let x = 0; x <= venue.dimensions.width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, venue.dimensions.height);
      ctx.stroke();
    }
    for (let y = 0; y <= venue.dimensions.height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(venue.dimensions.width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawVenueLayout(venue: Venue, ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // 1. External Roads and Approach Arterials
    venue.approachRoutes.forEach((ar) => {
      ctx.fillStyle = 'rgba(21, 32, 51, 0.7)';
      ctx.strokeStyle = 'rgba(52, 71, 104, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(ar.startPoint.x, ar.startPoint.y, ar.width, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    // 2. Outer Stadium Perimeter Wall (Elliptical / Stadium shape)
    const cx = venue.dimensions.width / 2;
    const cy = venue.dimensions.height / 2;

    if (venue.id === 'chinnaswamy-stadium') {
      // Outer concourse ring
      ctx.fillStyle = '#121A2B';
      ctx.strokeStyle = '#23324D';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 105, 92, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Tiered Seating Ring
      ctx.fillStyle = '#192438';
      ctx.strokeStyle = '#344768';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 85, 75, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Seating radial tier section dividers
      ctx.strokeStyle = 'rgba(52, 71, 104, 0.35)';
      ctx.lineWidth = 0.8;
      for (let i = 0; i < 16; i++) {
        const ang = (i / 16) * Math.PI * 2;
        const x1 = cx + Math.cos(ang) * 55;
        const y1 = cy + Math.sin(ang) * 45;
        const x2 = cx + Math.cos(ang) * 85;
        const y2 = cy + Math.sin(ang) * 75;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      // Playing Field (Cricket Oval grass)
      ctx.fillStyle = '#064E3B'; // Deep grass emerald
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 55, 45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Center 22-yard Cricket Pitch
      ctx.fillStyle = '#D97706'; // Pitch clay/turf
      ctx.fillRect(cx - 10, cy - 2.5, 20, 5);

      // Inner 30-yard fielding circle
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.ellipse(cx, cy, 32, 26, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      // General venue drawing
      ctx.fillStyle = '#121A2B';
      ctx.strokeStyle = '#23324D';
      ctx.lineWidth = 2;
      ctx.strokeRect(10, 10, venue.dimensions.width - 20, venue.dimensions.height - 20);
    }

    // Draw Attractions (e.g. Stage)
    venue.attractions.forEach((a) => {
      ctx.fillStyle = '#8B5CF6';
      ctx.strokeStyle = '#A78BFA';
      ctx.lineWidth = 1.5;
      ctx.fillRect(a.position.x - 7, a.position.y - 5, 14, 10);
      ctx.strokeRect(a.position.x - 7, a.position.y - 5, 14, 10);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '3.5px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(a.name.substring(0, 16), a.position.x, a.position.y + 9);
    });

    // Draw Medical Points
    venue.medicalPoints.forEach((m) => {
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(m.position.x, m.position.y, 4, 0, Math.PI * 2);
      ctx.fill();

      // White cross
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(m.position.x - 2.2, m.position.y - 0.7, 4.4, 1.4);
      ctx.fillRect(m.position.x - 0.7, m.position.y - 2.2, 1.4, 4.4);
    });

    ctx.restore();
  }

  private drawRiskZones(venue: Venue, ctx: CanvasRenderingContext2D, selectedZoneId?: string | null): void {
    ctx.save();
    for (const z of venue.zones) {
      if (z.polygon.length < 3) continue;

      ctx.beginPath();
      ctx.moveTo(z.polygon[0].x, z.polygon[0].y);
      for (let i = 1; i < z.polygon.length; i++) {
        ctx.lineTo(z.polygon[i].x, z.polygon[i].y);
      }
      ctx.closePath();

      // Color coding according to risk level
      if (z.riskLevel === 'CRITICAL') {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 2.0;
      } else if (z.riskLevel === 'HIGH_CONGESTION') {
        ctx.fillStyle = 'rgba(245, 158, 11, 0.25)';
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 1.5;
      } else if (z.riskLevel === 'WATCH') {
        ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
        ctx.strokeStyle = '#3B82F6';
        ctx.lineWidth = 1.0;
      } else {
        ctx.fillStyle = 'rgba(16, 185, 129, 0.04)';
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.2)';
        ctx.lineWidth = 0.5;
      }

      if (selectedZoneId === z.id) {
        ctx.strokeStyle = '#22D3EE';
        ctx.lineWidth = 2.5;
      }

      ctx.fill();
      ctx.stroke();

      // Label density
      let cx = 0,
        cy = 0;
      z.polygon.forEach((p) => {
        cx += p.x;
        cy += p.y;
      });
      cx /= z.polygon.length;
      cy /= z.polygon.length;

      ctx.fillStyle = z.riskLevel === 'CRITICAL' ? '#EF4444' : '#94A3B8';
      ctx.font = 'bold 3.2px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${z.currentDensity.toFixed(1)} p/m²`, cx, cy);
    }
    ctx.restore();
  }

  private drawCorridors(venue: Venue, ctx: CanvasRenderingContext2D, showEmergency: boolean): void {
    ctx.save();
    for (const c of venue.corridors) {
      if (c.isEmergencyRoute) {
        if (!showEmergency) continue;
        ctx.strokeStyle = c.isBlocked ? 'rgba(239, 68, 68, 0.85)' : 'rgba(16, 185, 129, 0.85)';
        ctx.lineWidth = c.width * 0.7;
        ctx.setLineDash([4, 2]);
      } else {
        ctx.strokeStyle = c.isBlocked ? 'rgba(239, 68, 68, 0.6)' : 'rgba(52, 71, 104, 0.4)';
        ctx.lineWidth = c.width * 0.5;
        ctx.setLineDash([]);
      }

      ctx.beginPath();
      ctx.moveTo(c.start.x, c.start.y);
      ctx.lineTo(c.end.x, c.end.y);
      ctx.stroke();

      if (c.isBlocked) {
        // Red barrier X marker
        const midX = (c.start.x + c.end.x) / 2;
        const midY = (c.start.y + c.end.y) / 2;
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(midX, midY, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private drawQueues(venue: Venue, ctx: CanvasRenderingContext2D): void {
    ctx.save();
    for (const g of venue.gates) {
      if (g.currentQueue <= 0) continue;

      // Draw queue line extending radially outward from gate
      const cx = venue.dimensions.width / 2;
      const cy = venue.dimensions.height / 2;
      const dirX = g.position.x - cx;
      const dirY = g.position.y - cy;
      const len = Math.sqrt(dirX * dirX + dirY * dirY);
      if (len === 0) continue;

      const normX = dirX / len;
      const normY = dirY / len;

      // Queue length representation (0.1m per person in queue)
      const qLength = Math.min(35, g.currentQueue * 0.12);

      ctx.strokeStyle =
        g.warningLevel === 'CRITICAL'
          ? '#EF4444'
          : g.warningLevel === 'HIGH'
            ? '#F59E0B'
            : '#06B6D4';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([1.5, 1.5]);

      ctx.beginPath();
      ctx.moveTo(g.position.x, g.position.y);
      ctx.lineTo(g.position.x + normX * qLength, g.position.y + normY * qLength);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawDensityHeatmap(venue: Venue, agents: CrowdAgent[], ctx: CanvasRenderingContext2D): void {
    ctx.save();
    // Render density gradient stamps for agents
    for (let i = 0; i < agents.length; i += 2) {
      const a = agents[i];
      if (a.state === 'ADMITTED' || a.state === 'INSIDE') continue;
      const rad = 4.5;
      const grad = ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, rad);
      grad.addColorStop(0, 'rgba(239, 68, 68, 0.28)');
      grad.addColorStop(0.5, 'rgba(245, 158, 11, 0.15)');
      grad.addColorStop(1, 'rgba(6, 182, 212, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(a.x, a.y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawCrowdAgents(
    agents: CrowdAgent[],
    ctx: CanvasRenderingContext2D,
    detailLevel: RenderDetailLevel
  ): void {
    ctx.save();

    for (let i = 0; i < agents.length; i++) {
      const a = agents[i];
      if (a.state === 'ADMITTED' || a.state === 'INSIDE') continue;

      // Draw subtle halo for redirected pedestrians
      if (a.isRerouted) {
        ctx.save();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
        ctx.lineWidth = 0.16;
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.radius + 0.16, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      if (detailLevel === 'SIMPLIFIED' || this.transform.scale < 2.0) {
        // Simplified top-down pedestrian dot
        ctx.fillStyle = a.shirtColor;
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.radius, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // DETAILED VIRTUAL PERSON FIGURE
        // Head, Shoulders, Facing Angle & Animated Walking Limbs
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(a.facingAngle);

        const stride = Math.sin(a.stridePhase) * 0.18;

        // Feet / Shoes swinging with stride
        ctx.fillStyle = '#1E293B';
        ctx.beginPath();
        ctx.ellipse(stride, -0.22, 0.14, 0.08, 0, 0, Math.PI * 2); // Left foot
        ctx.ellipse(-stride, 0.22, 0.14, 0.08, 0, 0, Math.PI * 2); // Right foot
        ctx.fill();

        // Torso / Shoulders (Wearing diverse clothing)
        ctx.fillStyle = a.shirtColor;
        ctx.beginPath();
        // Rounded shoulder shape
        ctx.ellipse(0, 0, 0.22, 0.32, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 0.05;
        ctx.stroke();

        // Head (Skin tone + hair)
        ctx.fillStyle = a.skinColor;
        ctx.beginPath();
        ctx.arc(0.04, 0, 0.16, 0, Math.PI * 2);
        ctx.fill();

        // Hair / Cap
        ctx.fillStyle = '#1C1917';
        ctx.beginPath();
        ctx.arc(-0.02, 0, 0.14, -Math.PI / 2, Math.PI / 2, true);
        ctx.fill();

        // Directional nose / visor indicator
        ctx.fillStyle = a.skinColor;
        ctx.beginPath();
        ctx.arc(0.18, 0, 0.05, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }
    }

    ctx.restore();
  }

  private drawFlowArrows(agents: CrowdAgent[], ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.6)';
    ctx.fillStyle = 'rgba(34, 211, 238, 0.6)';
    ctx.lineWidth = 0.5;

    // Subsample agents for arrows
    for (let i = 0; i < agents.length; i += 8) {
      const a = agents[i];
      if (a.state === 'ADMITTED' || a.state === 'INSIDE') continue;
      const speed = Math.sqrt(a.vx * a.vx + a.vy * a.vy);
      if (speed < 0.2) continue;

      const len = 1.8;
      const endX = a.x + (a.vx / speed) * len;
      const endY = a.y + (a.vy / speed) * len;

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawGateBadges(
    venue: Venue,
    ctx: CanvasRenderingContext2D,
    selectedGateId?: string | null
  ): void {
    ctx.save();
    for (const g of venue.gates) {
      const isSelected = selectedGateId === g.id;
      const isClosedOrOffline =
        g.direction === 'CLOSED' ||
        g.status === 'TEMPORARILY_CLOSED' ||
        g.status === 'UNAVAILABLE' ||
        g.operationalScanners === 0;

      // Gate pin
      let statusColor = '#10B981';
      if (isClosedOrOffline) {
        statusColor = '#EF4444';
      } else if (g.status === 'SCANNER_FAILURE' || g.warningLevel === 'HIGH' || g.operationalScanners < g.scannerCount) {
        statusColor = '#F59E0B';
      } else if (g.status === 'BUSY') {
        statusColor = '#3B82F6';
      }

      // If closed/offline, draw warning dashed perimeter circle
      if (isClosedOrOffline) {
        ctx.save();
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
        ctx.lineWidth = 0.8;
        ctx.setLineDash([1.5, 1.5]);
        ctx.beginPath();
        ctx.arc(g.position.x, g.position.y, 4.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      ctx.fillStyle = statusColor;
      ctx.beginPath();
      ctx.arc(g.position.x, g.position.y, isSelected ? 3.0 : 2.0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 0.6;
      ctx.stroke();

      // Gate label badge
      ctx.fillStyle = isSelected ? '#22D3EE' : '#FFFFFF';
      ctx.font = 'bold 3.0px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(g.name, g.position.x, g.position.y - 3.2);

      // Independent Gate Spawn Origin Indicator
      if (g.spawnPosition && g.direction !== 'EXIT' && g.gateType !== 'EXIT_ONLY') {
        const sp = g.spawnPosition;
        ctx.save();
        ctx.strokeStyle = isSelected ? 'rgba(34, 211, 238, 0.7)' : 'rgba(56, 189, 248, 0.45)';
        ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
        ctx.lineWidth = 0.6;
        ctx.setLineDash([1.0, 1.0]);
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isSelected ? '#22D3EE' : '#38BDF8';
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 0.7, 0, Math.PI * 2);
        ctx.fill();

        // Directional trajectory line to gate
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(sp.x, sp.y);
        ctx.lineTo(g.position.x, g.position.y);
        ctx.stroke();

        ctx.fillStyle = '#7DD3FC';
        ctx.font = '1.5px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`Arrival: ${g.name}`, sp.x, sp.y - 2.8);
        ctx.restore();
      }

      // Dedicated Holding Pen Box
      if (g.holdingAreaPosition) {
        const hp = g.holdingAreaPosition;
        const hw = 10;
        const hh = 7;
        ctx.save();
        ctx.strokeStyle =
          g.operationalControlState === 'CONGESTED' || g.operationalControlState === 'ADMISSION_PAUSED'
            ? 'rgba(239, 68, 68, 0.6)'
            : (g.inHoldingCount && g.inHoldingCount > 0)
              ? 'rgba(245, 158, 11, 0.5)'
              : 'rgba(56, 189, 248, 0.25)';
        ctx.lineWidth = 0.5;
        ctx.setLineDash([1.0, 1.0]);
        ctx.strokeRect(hp.x - hw / 2, hp.y - hh / 2, hw, hh);

        ctx.fillStyle = (g.inHoldingCount && g.inHoldingCount > 0) ? '#F59E0B' : 'rgba(148, 163, 184, 0.6)';
        ctx.font = '1.7px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`Hold: ${g.inHoldingCount || 0}/${g.holdingAreaCapacity || 500}`, hp.x, hp.y + hh / 2 + 2.0);
        ctx.restore();
      }

      // Draw Scanner Counter Indicator Lights (3 lights)
      if (g.counters && g.counters.length > 0) {
        const totalCounters = g.counters.length;
        const dotSpacing = 1.6;
        const startX = g.position.x - ((totalCounters - 1) * dotSpacing) / 2;
        const dotY = g.position.y + 3.0;

        for (let cIdx = 0; cIdx < totalCounters; cIdx++) {
          const counter = g.counters[cIdx];
          const cX = startX + cIdx * dotSpacing;
          ctx.fillStyle = counter.status === 'OPERATIONAL' ? '#10B981' : '#EF4444';
          ctx.beginPath();
          ctx.arc(cX, dotY, 0.65, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#0F172A';
          ctx.lineWidth = 0.2;
          ctx.stroke();
        }
      }

      let subY = g.position.y + 5.2;

      // Operational state pill
      if (g.operationalControlState && g.operationalControlState !== 'NORMAL') {
        ctx.fillStyle =
          g.operationalControlState === 'CONGESTED' || g.operationalControlState === 'ADMISSION_PAUSED'
            ? '#EF4444'
            : g.operationalControlState === 'ADMISSION_METERING'
              ? '#38BDF8'
              : '#F59E0B';
        ctx.font = 'bold 1.8px monospace';
        ctx.fillText(`[${g.operationalControlState}]`, g.position.x, subY);
        subY += 2.4;
      }

      // If closed or offline, display CLOSED / REROUTING warning tag
      if (isClosedOrOffline) {
        ctx.fillStyle = '#EF4444';
        ctx.font = 'bold 2.1px monospace';
        ctx.fillText('CLOSED - REROUTING', g.position.x, subY);
        subY += 2.6;

        if (g.deflectedCount && g.deflectedCount > 0) {
          ctx.fillStyle = '#F87171';
          ctx.font = 'bold 1.9px monospace';
          ctx.fillText(`⮡ ${g.deflectedCount} diverted`, g.position.x, subY);
          subY += 2.4;
        }
      } else {
        const admitted = g.admittedCount || g.totalProcessedCount || 0;
        if (admitted > 0) {
          ctx.fillStyle = '#10B981';
          ctx.font = 'bold 2.0px monospace';
          ctx.fillText(`✓ ${admitted.toLocaleString()} in`, g.position.x, subY);
          subY += 2.6;
        }

        if (g.redirectedCount && g.redirectedCount > 0) {
          ctx.fillStyle = '#38BDF8';
          ctx.font = 'bold 1.9px monospace';
          ctx.fillText(`+${g.redirectedCount} rerouted`, g.position.x, subY);
          subY += 2.4;
        }

        if (g.currentQueue > 0) {
          ctx.fillStyle = '#EF4444';
          ctx.font = 'bold 2.2px monospace';
          ctx.fillText(`Q: ${g.currentQueue}`, g.position.x, subY);
        }
      }
    }
    ctx.restore();
  }

  private drawIncidents(incidents: Incident[], ctx: CanvasRenderingContext2D): void {
    ctx.save();
    for (const inc of incidents) {
      if (inc.status === 'RESOLVED') continue;

      // Draw Responder Path if calculated
      if (inc.responderPath && inc.responderPath.length > 1) {
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([2, 1]);
        ctx.beginPath();
        ctx.moveTo(inc.responderPath[0].x, inc.responderPath[0].y);
        for (let i = 1; i < inc.responderPath.length; i++) {
          ctx.lineTo(inc.responderPath[i].x, inc.responderPath[i].y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Incident Marker Pin
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(inc.position.x, inc.position.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 3.0px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', inc.position.x, inc.position.y + 1);

      ctx.fillStyle = '#FCA5A5';
      ctx.font = 'bold 2.6px Inter, sans-serif';
      ctx.fillText(inc.title.substring(0, 18), inc.position.x, inc.position.y - 4.5);
    }
    ctx.restore();
  }

  private drawScreenScaleBar(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    // 50 meters representation
    const meters = 50;
    const barPixelWidth = meters * this.transform.scale;

    const x = width - barPixelWidth - 24;
    const y = height - 20;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + barPixelWidth, y);
    ctx.moveTo(x, y - 4);
    ctx.lineTo(x, y + 4);
    ctx.moveTo(x + barPixelWidth, y - 4);
    ctx.lineTo(x + barPixelWidth, y + 4);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${meters}m scale`, x + barPixelWidth / 2, y - 6);

    ctx.restore();
  }
  private drawSpatialComparisonOverlay(
    venue: Venue,
    ctx: CanvasRenderingContext2D,
    spatialComparisons: ZoneComparisonResult[],
    selectedZoneId?: string | null
  ): void {
    ctx.save();

    for (const z of venue.zones) {
      if (z.polygon.length < 3) continue;
      const comp = spatialComparisons.find((c) => c.zoneId === z.id);
      if (!comp) continue;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(z.polygon[0].x, z.polygon[0].y);
      for (let i = 1; i < z.polygon.length; i++) {
        ctx.lineTo(z.polygon[i].x, z.polygon[i].y);
      }
      ctx.closePath();

      // Bounding box and centroid
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      let cx = 0, cy = 0;
      for (const p of z.polygon) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
        cx += p.x;
        cy += p.y;
      }
      cx /= z.polygon.length;
      cy /= z.polygon.length;

      if (comp.status === 'NEW_HOTSPOT') {
        // High-visibility red wash
        ctx.fillStyle = 'rgba(239, 68, 68, 0.40)';
        ctx.fill();

        // Diagonal striping pattern for non-color differentiation
        ctx.save();
        ctx.clip();
        ctx.strokeStyle = 'rgba(254, 202, 202, 0.7)';
        ctx.lineWidth = 1.0;
        const span = maxY - minY;
        for (let d = minX - span; d <= maxX; d += 4.5) {
          ctx.beginPath();
          ctx.moveTo(d, maxY);
          ctx.lineTo(d + span, minY);
          ctx.stroke();
        }
        ctx.restore();

        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 2.4;
        ctx.stroke();

        this.drawZoneDiffBadge(ctx, cx, cy, '[!] NEW HOTSPOT', `+${comp.deltaDensity.toFixed(2)} p/m²`, '#EF4444', '#FEE2E2');
      } else if (comp.status === 'WORSENED') {
        // Amber wash
        ctx.fillStyle = 'rgba(245, 158, 11, 0.35)';
        ctx.fill();

        // Horizontal line pattern for non-color differentiation
        ctx.save();
        ctx.clip();
        ctx.strokeStyle = 'rgba(253, 230, 138, 0.5)';
        ctx.lineWidth = 0.8;
        for (let y = minY; y <= maxY; y += 3.5) {
          ctx.beginPath();
          ctx.moveTo(minX, y);
          ctx.lineTo(maxX, y);
          ctx.stroke();
        }
        ctx.restore();

        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 1.8;
        ctx.stroke();

        this.drawZoneDiffBadge(ctx, cx, cy, '[▲] Worsened', `+${comp.deltaDensity.toFixed(2)} p/m²`, '#F59E0B', '#FEF3C7');
      } else if (comp.status === 'RELIEVED') {
        // Emerald green wash
        ctx.fillStyle = 'rgba(16, 185, 129, 0.28)';
        ctx.fill();

        ctx.strokeStyle = '#10B981';
        ctx.lineWidth = 1.6;
        ctx.setLineDash([3, 2]);
        ctx.stroke();
        ctx.setLineDash([]);

        this.drawZoneDiffBadge(ctx, cx, cy, '[▼] Relieved', `${comp.deltaDensity.toFixed(2)} p/m²`, '#10B981', '#D1FAE5');
      } else {
        // UNCHANGED
        if (comp.interventionRisk === 'CRITICAL') {
          ctx.fillStyle = 'rgba(239, 68, 68, 0.20)';
          ctx.fill();
          ctx.strokeStyle = '#EF4444';
          ctx.lineWidth = 2.2;
          ctx.stroke();
          this.drawZoneDiffBadge(ctx, cx, cy, '[!!] Stays Critical', `${comp.interventionDensity.toFixed(1)} p/m²`, '#EF4444', '#FEE2E2');
        } else {
          ctx.fillStyle = 'rgba(148, 163, 184, 0.08)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
          ctx.lineWidth = 0.8;
          ctx.stroke();
          this.drawZoneDiffBadge(ctx, cx, cy, '[=] Stable', `${comp.interventionDensity.toFixed(1)} p/m²`, '#64748B', '#E2E8F0');
        }
      }

      if (selectedZoneId === z.id) {
        ctx.strokeStyle = '#22D3EE';
        ctx.lineWidth = 3.0;
        ctx.stroke();
      }

      ctx.restore();
    }

    ctx.restore();
  }

  private drawZoneDiffBadge(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    tag: string,
    delta: string,
    borderColor: string,
    textColor: string
  ): void {
    ctx.save();
    const padX = 3;
    const padY = 2;
    const label = `${tag} (${delta})`;
    ctx.font = 'bold 3.2px Inter, sans-serif';
    const textWidth = ctx.measureText(label).width;

    ctx.fillStyle = 'rgba(11, 16, 32, 0.88)';
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.roundRect(x - textWidth / 2 - padX, y - 2.5 - padY, textWidth + padX * 2, 5 + padY * 2, 1.5);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y);
    ctx.restore();
  }

  private drawSpatialComparisonLegend(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    ctx.save();
    const boxW = 280;
    const boxH = 145;
    const x = 16;
    const y = 60;

    // Background card
    ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, boxW, boxH, 8);
    ctx.fill();
    ctx.stroke();

    // Title
    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('SPATIAL COMPARISON OVERLAY', x + 12, y + 20);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '10px Inter, sans-serif';
    ctx.fillText('Baseline vs Intervention Plan (Multi-symbolic encoding)', x + 12, y + 34);

    const items = [
      { sym: '[!] ///', label: 'New Hotspot (exceeded safety limit)', color: '#EF4444' },
      { sym: '[▲] ---', label: 'Worsened Congestion (+Δ density)', color: '#F59E0B' },
      { sym: '[▼] - -', label: 'Congestion Relieved (-Δ density)', color: '#10B981' },
      { sym: '[!!] ==', label: 'Persistent Critical Bottleneck', color: '#DC2626' },
      { sym: '[=] ··', label: 'Stable / Unchanged within limits', color: '#64748B' },
    ];

    let itemY = y + 52;
    for (const item of items) {
      // Symbol pill
      ctx.fillStyle = 'rgba(30, 41, 59, 0.8)';
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x + 12, itemY - 9, 44, 15, 3);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = item.color;
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(item.sym, x + 34, itemY + 2);

      // Label
      ctx.fillStyle = '#E2E8F0';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(item.label, x + 64, itemY + 2);

      itemY += 17;
    }

    ctx.restore();
  }

  private drawDirectionalArrow(
    ctx: CanvasRenderingContext2D,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    color: string,
    width = 1.0,
    headSize = 1.6
  ): void {
    const dx = toX - fromX;
    const dy = toY - fromY;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.1) return;
    const angle = Math.atan2(dy, dx);

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;

    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headSize * Math.cos(angle - Math.PI / 6), toY - headSize * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(toX - headSize * Math.cos(angle + Math.PI / 6), toY - headSize * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawFocusedGateSideView(
    venue: Venue,
    ctx: CanvasRenderingContext2D,
    focusedGateIds: string[],
    agents: CrowdAgent[]
  ): void {
    ctx.save();
    const cx = venue.dimensions.width / 2;
    const cy = venue.dimensions.height / 2;

    for (const gid of focusedGateIds) {
      const g = venue.gates.find((gate) => gate.id === gid);
      if (!g) continue;

      const dirX = g.position.x - cx;
      const dirY = g.position.y - cy;
      const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
      const nx = dirX / len;
      const ny = dirY / len;
      const tx = -ny;
      const ty = nx;

      const penWidth = g.width + 5;
      const totalLanes = Math.max(1, g.counters?.length || g.scannerCount || 3);

      // ========================================================
      // 1. EXTERNAL PEDESTRIAN ARRIVAL AREA (+26m to +38m)
      // ========================================================
      ctx.save();
      const arrW = penWidth + 8;
      const arrStart = 26;
      const arrEnd = 38;
      const a1 = { x: g.position.x - tx * (arrW / 2) + nx * arrStart, y: g.position.y - ty * (arrW / 2) + ny * arrStart };
      const a2 = { x: g.position.x + tx * (arrW / 2) + nx * arrStart, y: g.position.y + ty * (arrW / 2) + ny * arrStart };
      const a3 = { x: a2.x + nx * (arrEnd - arrStart), y: a2.y + ny * (arrEnd - arrStart) };
      const a4 = { x: a1.x + nx * (arrEnd - arrStart), y: a1.y + ny * (arrEnd - arrStart) };

      ctx.fillStyle = 'rgba(14, 165, 233, 0.04)';
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
      ctx.lineWidth = 1.0;
      ctx.setLineDash([3, 2]);
      ctx.beginPath();
      ctx.moveTo(a1.x, a1.y);
      ctx.lineTo(a2.x, a2.y);
      ctx.lineTo(a3.x, a3.y);
      ctx.lineTo(a4.x, a4.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#38BDF8';
      ctx.font = 'bold 2.0px Inter, sans-serif';
      ctx.textAlign = 'center';
      const arrLabelPos = { x: g.position.x + nx * (arrEnd + 1.8), y: g.position.y + ny * (arrEnd + 1.8) };
      ctx.fillText(`1. External Arrival Plaza (${g.arrivalRatePerMin ?? 120} ppl/min inflow)`, arrLabelPos.x, arrLabelPos.y);

      // Inflow directional arrow from plaza toward gate
      this.drawDirectionalArrow(
        ctx,
        g.position.x + nx * 34,
        g.position.y + ny * 34,
        g.position.x + nx * 27,
        g.position.y + ny * 27,
        'rgba(56, 189, 248, 0.7)',
        1.2,
        1.8
      );
      ctx.restore();

      // ========================================================
      // 2. GATE APPROACH PATH (+19m to +26m)
      // ========================================================
      ctx.save();
      const appW = penWidth + 2;
      const app1 = { x: g.position.x - tx * (appW / 2) + nx * 19, y: g.position.y - ty * (appW / 2) + ny * 19 };
      const app2 = { x: g.position.x + tx * (appW / 2) + nx * 19, y: g.position.y + ty * (appW / 2) + ny * 19 };
      const app3 = { x: g.position.x + tx * (appW / 2) + nx * 26, y: g.position.y + ty * (appW / 2) + ny * 26 };
      const app4 = { x: g.position.x - tx * (appW / 2) + nx * 26, y: g.position.y - ty * (appW / 2) + ny * 26 };

      ctx.fillStyle = 'rgba(30, 41, 59, 0.35)';
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.4)';
      ctx.lineWidth = 0.8;
      ctx.setLineDash([1, 1]);
      ctx.beginPath();
      ctx.moveTo(app1.x, app1.y);
      ctx.lineTo(app2.x, app2.y);
      ctx.lineTo(app3.x, app3.y);
      ctx.lineTo(app4.x, app4.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#94A3B8';
      ctx.font = '1.6px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('2. Gate Approach Corridor', g.position.x + nx * 22.5 + tx * (appW / 2 + 3.2), g.position.y + ny * 22.5 + ty * (appW / 2 + 3.2));
      ctx.restore();

      // ========================================================
      // 3. CROWD WAITING & HOLDING AREA (+14m to +22m lateral offset)
      // ========================================================
      if (g.holdingAreaPosition) {
        ctx.save();
        const hp = g.holdingAreaPosition;
        ctx.strokeStyle = g.inHoldingCount && g.inHoldingCount > 0 ? '#C084FC' : 'rgba(192, 132, 252, 0.4)';
        ctx.fillStyle = g.inHoldingCount && g.inHoldingCount > 0 ? 'rgba(192, 132, 252, 0.12)' : 'rgba(192, 132, 252, 0.04)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.arc(hp.x, hp.y, 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#E9D5FF';
        ctx.font = 'bold 1.7px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`3. Holding Area (${g.inHoldingCount || 0}/${g.holdingAreaCapacity || 500} ppl)`, hp.x, hp.y - 7.2);
        ctx.restore();
      }

      // ========================================================
      // 4. MAIN QUEUE CORRAL (+11m to +19m)
      // ========================================================
      ctx.save();
      const qW = penWidth;
      const q1 = { x: g.position.x - tx * (qW / 2) + nx * 11, y: g.position.y - ty * (qW / 2) + ny * 11 };
      const q2 = { x: g.position.x + tx * (qW / 2) + nx * 11, y: g.position.y + ty * (qW / 2) + ny * 11 };
      const q3 = { x: g.position.x + tx * (qW / 2) + nx * 19, y: g.position.y + ty * (qW / 2) + ny * 19 };
      const q4 = { x: g.position.x - tx * (qW / 2) + nx * 19, y: g.position.y - ty * (qW / 2) + ny * 19 };

      ctx.fillStyle = 'rgba(6, 182, 212, 0.05)';
      ctx.strokeStyle = g.warningLevel === 'CRITICAL' ? '#EF4444' : g.warningLevel === 'HIGH' ? '#F59E0B' : '#06B6D4';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(q1.x, q1.y);
      ctx.lineTo(q2.x, q2.y);
      ctx.lineTo(q3.x, q3.y);
      ctx.lineTo(q4.x, q4.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#67E8F9';
      ctx.font = 'bold 1.9px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`4. Main Queue Corral (${g.waitingInQueueCount || g.currentQueue || 0} waiting)`, g.position.x + nx * 15, g.position.y + ny * 15 - 3.5);
      ctx.restore();

      // Spillback hazard area if queue over capacity
      if (g.spillbackCount && g.spillbackCount > 0) {
        ctx.save();
        const spillLen = Math.min(25, g.spillbackCount * 0.35);
        const s3 = { x: q3.x + nx * spillLen, y: q3.y + ny * spillLen };
        const s4 = { x: q4.x + nx * spillLen, y: q4.y + ny * spillLen };
        ctx.fillStyle = 'rgba(239, 68, 68, 0.22)';
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(q4.x, q4.y);
        ctx.lineTo(q3.x, q3.y);
        ctx.lineTo(s3.x, s3.y);
        ctx.lineTo(s4.x, s4.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#FCA5A5';
        ctx.font = 'bold 2.0px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`⚠ SPILLBACK OVERFLOW (+${g.spillbackCount} PPL)`, g.position.x + nx * (19 + spillLen / 2), g.position.y + ny * (19 + spillLen / 2));
        ctx.restore();
      }

      // ========================================================
      // 5. QUEUE DISTRIBUTION AREA / DECISION POINT (+7.5m to +11m)
      // ========================================================
      ctx.save();
      const distW = penWidth;
      const d1 = { x: g.position.x - tx * (distW / 2) + nx * 7.5, y: g.position.y - ty * (distW / 2) + ny * 7.5 };
      const d2 = { x: g.position.x + tx * (distW / 2) + nx * 7.5, y: g.position.y + ty * (distW / 2) + ny * 7.5 };
      const d3 = { x: g.position.x + tx * (distW / 2) + nx * 11, y: g.position.y + ty * (distW / 2) + ny * 11 };
      const d4 = { x: g.position.x - tx * (distW / 2) + nx * 11, y: g.position.y - ty * (distW / 2) + ny * 11 };

      ctx.fillStyle = 'rgba(245, 158, 11, 0.08)';
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 1.0;
      ctx.setLineDash([2, 1]);
      ctx.beginPath();
      ctx.moveTo(d1.x, d1.y);
      ctx.lineTo(d2.x, d2.y);
      ctx.lineTo(d3.x, d3.y);
      ctx.lineTo(d4.x, d4.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Floor Chevron Stripes in Distribution Area
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.3)';
      ctx.lineWidth = 0.8;
      ctx.setLineDash([]);
      for (let chevronDist = 8.5; chevronDist <= 10.5; chevronDist += 1.0) {
        const cMidX = g.position.x + nx * chevronDist;
        const cMidY = g.position.y + ny * chevronDist;
        ctx.beginPath();
        ctx.moveTo(cMidX - tx * 2.5 + nx * 0.6, cMidY - ty * 2.5 + ny * 0.6);
        ctx.lineTo(cMidX, cMidY - 0.2);
        ctx.lineTo(cMidX + tx * 2.5 + nx * 0.6, cMidY + ty * 2.5 + ny * 0.6);
        ctx.stroke();
      }

      ctx.fillStyle = '#FDE68A';
      ctx.font = 'bold 1.7px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('5. Decision Point — Intelligent Lane Balancing', g.position.x + nx * 9.2, g.position.y + ny * 9.2 + 2.8);
      ctx.restore();

      // ========================================================
      // 6. THREE PARALLEL SCANNER LANES (+1.8m to +7.5m)
      // 7, 8, 9. COUNTER DESKS 1, 2, 3 (+0.8m to +1.6m)
      // 10. TICKET VERIFICATION AREA (+0.6m to +2.0m)
      // ========================================================
      for (let l = 0; l < totalLanes; l++) {
        const offsetT = ((l - (totalLanes - 1) / 2) / totalLanes) * (g.width * 0.75);
        const laneX = g.position.x + tx * offsetT;
        const laneY = g.position.y + ty * offsetT;

        const counter = g.counters?.[l];
        const isCounterActive = counter
          ? counter.status === 'OPERATIONAL'
          : (l < g.operationalScanners && g.direction !== 'CLOSED' && g.status !== 'TEMPORARILY_CLOSED');
        const isProcessing = counter?.isProcessing;

        // Lane Stanchion Ropes (Left and Right lane borders)
        const laneWidth = (g.width * 0.75) / totalLanes;
        const stanchionL = { x: laneX - tx * (laneWidth / 2), y: laneY - ty * (laneWidth / 2) };
        const stanchionR = { x: laneX + tx * (laneWidth / 2), y: laneY + ty * (laneWidth / 2) };

        ctx.save();
        ctx.strokeStyle = isCounterActive ? 'rgba(56, 189, 248, 0.45)' : 'rgba(239, 68, 68, 0.35)';
        ctx.lineWidth = 0.7;
        ctx.setLineDash([1.5, 1.5]);

        // Draw stanchion lane divider ropes
        ctx.beginPath();
        ctx.moveTo(stanchionL.x + nx * 1.8, stanchionL.y + ny * 1.8);
        ctx.lineTo(stanchionL.x + nx * 7.5, stanchionL.y + ny * 7.5);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(stanchionR.x + nx * 1.8, stanchionR.y + ny * 1.8);
        ctx.lineTo(stanchionR.x + nx * 7.5, stanchionR.y + ny * 7.5);
        ctx.stroke();

        // Stanchion posts (small circles along rope)
        for (let postDist = 2.0; postDist <= 7.5; postDist += 1.8) {
          ctx.fillStyle = '#CBD5E1';
          ctx.beginPath();
          ctx.arc(stanchionL.x + nx * postDist, stanchionL.y + ny * postDist, 0.22, 0, Math.PI * 2);
          ctx.arc(stanchionR.x + nx * postDist, stanchionR.y + ny * postDist, 0.22, 0, Math.PI * 2);
          ctx.fill();
        }

        // Lane floor shading
        ctx.fillStyle = isCounterActive
          ? (isProcessing ? 'rgba(14, 165, 233, 0.08)' : 'rgba(30, 41, 59, 0.2)')
          : 'rgba(239, 68, 68, 0.08)';
        ctx.beginPath();
        ctx.moveTo(stanchionL.x + nx * 1.8, stanchionL.y + ny * 1.8);
        ctx.lineTo(stanchionR.x + nx * 1.8, stanchionR.y + ny * 1.8);
        ctx.lineTo(stanchionR.x + nx * 7.5, stanchionR.y + ny * 7.5);
        ctx.lineTo(stanchionL.x + nx * 7.5, stanchionL.y + ny * 7.5);
        ctx.closePath();
        ctx.fill();

        // Lane Label: e.g. "Lane 1 — Counter 1"
        ctx.fillStyle = isCounterActive ? '#E0F2FE' : '#FCA5A5';
        ctx.font = 'bold 1.5px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`Lane ${l + 1} — Counter ${l + 1}`, laneX + nx * 6.8, laneY + ny * 6.8);

        // Directional arrow inside each active lane pointing towards the counter
        if (isCounterActive) {
          this.drawDirectionalArrow(
            ctx,
            laneX + nx * 5.2,
            laneY + ny * 5.2,
            laneX + nx * 3.0,
            laneY + ny * 3.0,
            'rgba(56, 189, 248, 0.6)',
            0.9,
            1.2
          );
        }

        // 10. TICKET VERIFICATION AREA (+0.6m to +2.0m)
        const v1 = { x: stanchionL.x + nx * 0.6, y: stanchionL.y + ny * 0.6 };
        const v2 = { x: stanchionR.x + nx * 0.6, y: stanchionR.y + ny * 0.6 };
        const v3 = { x: stanchionR.x + nx * 2.0, y: stanchionR.y + ny * 2.0 };
        const v4 = { x: stanchionL.x + nx * 2.0, y: stanchionL.y + ny * 2.0 };
        ctx.fillStyle = isProcessing ? 'rgba(56, 189, 248, 0.18)' : 'rgba(16, 185, 129, 0.08)';
        ctx.beginPath();
        ctx.moveTo(v1.x, v1.y);
        ctx.lineTo(v2.x, v2.y);
        ctx.lineTo(v3.x, v3.y);
        ctx.lineTo(v4.x, v4.y);
        ctx.closePath();
        ctx.fill();

        // 7, 8, 9. COUNTER DESKS
        const deskX = laneX + nx * 1.1;
        const deskY = laneY + ny * 1.1;

        // Active processing aura glow
        if (isProcessing) {
          ctx.save();
          ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
          ctx.beginPath();
          ctx.arc(deskX, deskY, 2.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // Physical Desk Pad (Rounded Box)
        ctx.fillStyle = isCounterActive ? (isProcessing ? '#0C4A6E' : '#1E293B') : '#450A0A';
        ctx.strokeStyle = isCounterActive ? (isProcessing ? '#38BDF8' : '#0EA5E9') : '#EF4444';
        ctx.lineWidth = isProcessing ? 1.6 : 1.0;
        ctx.beginPath();
        ctx.roundRect(deskX - 1.1, deskY - 0.7, 2.2, 1.4, 0.3);
        ctx.fill();
        ctx.stroke();

        // Optical Scanner Pad (embedded glass sensor)
        ctx.fillStyle = isCounterActive ? (isProcessing ? '#38BDF8' : '#0369A1') : '#7F1D1D';
        ctx.fillRect(deskX - 0.5, deskY - 0.35, 1.0, 0.7);

        // LED Indicator Light
        ctx.fillStyle = isCounterActive ? (isProcessing ? '#38BDF8' : '#10B981') : '#EF4444';
        ctx.beginPath();
        ctx.arc(deskX + 0.75, deskY - 0.35, 0.22, 0, Math.PI * 2);
        ctx.fill();

        // Lane Metrics & Workload Tag
        const laneQueueCount = agents.filter(
          (a) => (a.state === 'QUEUING' || a.state === 'PROCESSING') && a.targetGateId === g.id && (a.assignedLane ?? 0) === l
        ).length;

        ctx.fillStyle = isProcessing ? '#38BDF8' : isCounterActive ? '#94A3B8' : '#EF4444';
        ctx.font = '1.2px monospace';
        ctx.textAlign = 'center';
        const statusText = !isCounterActive
          ? 'OFFLINE'
          : isProcessing
            ? `PROCESSING (${laneQueueCount})`
            : `WAITING (${laneQueueCount})`;
        ctx.fillText(statusText, deskX - nx * 1.5, deskY - ny * 1.5);

        ctx.restore();
      }

      // Draw Dynamic Lane Balancing Trajectory for switching spectators
      for (const ag of agents) {
        if (ag.targetGateId === g.id && ag.isSwitchingLane && ag.switchSourceLane !== undefined) {
          const srcOffset = ((ag.switchSourceLane - (totalLanes - 1) / 2) / totalLanes) * (g.width * 0.75);
          const tgtOffset = (((ag.assignedLane ?? 0) - (totalLanes - 1) / 2) / totalLanes) * (g.width * 0.75);
          const srcX = g.position.x + tx * srcOffset + nx * 5.0;
          const srcY = g.position.y + ty * srcOffset + ny * 5.0;
          const tgtX = g.position.x + tx * tgtOffset + nx * 4.5;
          const tgtY = g.position.y + ty * tgtOffset + ny * 4.5;

          this.drawDirectionalArrow(ctx, srcX, srcY, tgtX, tgtY, '#F59E0B', 1.0, 1.2);
        }
      }

      // ========================================================
      // 11. GATE ENTRY BOUNDARY (Turnstile threshold at 0m)
      // ========================================================
      ctx.save();
      const bLeft = { x: g.position.x - tx * (g.width / 2), y: g.position.y - ty * (g.width / 2) };
      const bRight = { x: g.position.x + tx * (g.width / 2), y: g.position.y + ty * (g.width / 2) };

      ctx.strokeStyle = g.direction === 'CLOSED' || g.status === 'TEMPORARILY_CLOSED' ? '#EF4444' : '#10B981';
      ctx.lineWidth = 2.4;
      ctx.setLineDash([1.5, 1.0]);
      ctx.beginPath();
      ctx.moveTo(bLeft.x, bLeft.y);
      ctx.lineTo(bRight.x, bRight.y);
      ctx.stroke();

      ctx.fillStyle = g.direction === 'CLOSED' ? '#EF4444' : '#34D399';
      ctx.font = 'bold 1.7px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('11. Gate Entry Boundary / Turnstiles', g.position.x, g.position.y - 1.2);
      ctx.restore();

      // ========================================================
      // 12. STADIUM-SIDE EXIT CONCOURSE (0m to -6m into stadium)
      // ========================================================
      ctx.save();
      const exW = g.width * 0.85;
      const ex1 = { x: g.position.x - tx * (exW / 2), y: g.position.y - ty * (exW / 2) };
      const ex2 = { x: g.position.x + tx * (exW / 2), y: g.position.y + ty * (exW / 2) };
      const ex3 = { x: ex2.x - nx * 6.0, y: ex2.y - ny * 6.0 };
      const ex4 = { x: ex1.x - nx * 6.0, y: ex1.y - ny * 6.0 };

      ctx.fillStyle = 'rgba(16, 185, 129, 0.05)';
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.35)';
      ctx.lineWidth = 1.0;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(ex1.x, ex1.y);
      ctx.lineTo(ex2.x, ex2.y);
      ctx.lineTo(ex3.x, ex3.y);
      ctx.lineTo(ex4.x, ex4.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#6EE7B7';
      ctx.font = 'bold 1.7px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`12. Concourse Exit (${g.admittedCount || g.totalProcessedCount || 0} admitted)`, g.position.x - nx * 3.5, g.position.y - ny * 3.5);

      this.drawDirectionalArrow(
        ctx,
        g.position.x - nx * 1.0,
        g.position.y - ny * 1.0,
        g.position.x - nx * 5.0,
        g.position.y - ny * 5.0,
        'rgba(52, 211, 153, 0.7)',
        1.1,
        1.5
      );
      ctx.restore();

      // ========================================================
      // 13. DOWNSTREAM PASSAGE / CORRIDOR CONNECTION
      // ========================================================
      const corr = venue.corridors.find((c) => c.id === g.downstreamCorridorId);
      if (corr) {
        ctx.save();
        ctx.strokeStyle = corr.isBlocked ? 'rgba(239, 68, 68, 0.7)' : 'rgba(16, 185, 129, 0.7)';
        ctx.lineWidth = corr.width * 0.6;
        ctx.setLineDash([2, 1]);
        ctx.beginPath();
        ctx.moveTo(g.position.x, g.position.y);
        ctx.lineTo(corr.end.x, corr.end.y);
        ctx.stroke();

        ctx.fillStyle = corr.isBlocked ? '#FCA5A5' : '#86EFAC';
        ctx.font = 'bold 1.8px Inter, sans-serif';
        ctx.textAlign = 'center';
        const midCorrX = (g.position.x + corr.end.x) / 2;
        const midCorrY = (g.position.y + corr.end.y) / 2;
        ctx.fillText(corr.isBlocked ? '13. BLOCKED CORRIDOR' : '13. Downstream Passage to Concourse', midCorrX, midCorrY);
        ctx.restore();
      }
    }
    ctx.restore();
  }

}