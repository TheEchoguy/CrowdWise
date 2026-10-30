import { Venue, CrowdAgent, RenderLayers, RenderDetailLevel, Gate, Zone, Incident } from '../../types';

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

  public render(
    venue: Venue,
    agents: CrowdAgent[],
    layers: RenderLayers,
    detailLevel: RenderDetailLevel,
    selectedGateId?: string | null,
    selectedZoneId?: string | null,
    incidents: Incident[] = []
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

    ctx.restore();

    // 11. Overlay Scale Bar (Screen coordinates)
    this.drawScreenScaleBar(ctx, logicalW, logicalH);
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

      // Gate pin
      let statusColor = '#10B981';
      if (g.status === 'TEMPORARILY_CLOSED' || g.status === 'UNAVAILABLE') {
        statusColor = '#EF4444';
      } else if (g.status === 'SCANNER_FAILURE' || g.status === 'HIGH_CONGESTION') {
        statusColor = '#F59E0B';
      } else if (g.status === 'BUSY') {
        statusColor = '#3B82F6';
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

      if (g.currentQueue > 0) {
        ctx.fillStyle = '#EF4444';
        ctx.font = 'bold 2.4px monospace';
        ctx.fillText(`Q: ${g.currentQueue}`, g.position.x, g.position.y + 4.5);
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
}

