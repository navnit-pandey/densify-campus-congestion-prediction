/**
 * AETHER CAMPUS DIGITAL TWIN - CANVAS MAP & HEATMAP ENGINE
 * Renders architectural campus blueprint, real-time radial density heatmaps,
 * and animated pedestrian foot-traffic particle systems.
 */

if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, radii) {
    if (w <= 0 || h <= 0) return this;
    const r = typeof radii === 'number' ? Math.min(radii, w / 2, h / 2) : 4;
    this.beginPath();
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
  };
}

class CampusMapEngine {
  constructor(canvasId, options = {}) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      console.warn(`CampusMapEngine: Canvas with id '${canvasId}' not found.`);
      return;
    }
    this.ctx = this.canvas.getContext('2d');
    this.options = Object.assign({
      showHeatmap: true,
      showParticles: true,
      showLabels: true,
      onZoneSelected: null
    }, options);

    this.selectedZoneId = 'LIB_01';
    this.hoveredZoneId = null;
    this.animationFrameId = null;
    this.timeTick = 0;
    this.zoneData = {}; // keyed by zone_id: { headcount, occupancy_pct, status, ... }

    // Building definitions with spatial coordinates (scaled to 1000x600 coordinate space)
    this.buildings = [
      {
        id: 'BLK_A',
        name: 'Academic Block A',
        subtitle: 'Engineering & Computing',
        x: 100, y: 70, w: 200, h: 120,
        door: { x: 200, y: 190 },
        color: '#3b82f6'
      },
      {
        id: 'CAN_01',
        name: 'North Food Court',
        subtitle: 'Main Canteen & Terrace',
        x: 360, y: 60, w: 170, h: 100,
        door: { x: 445, y: 160 },
        color: '#f59e0b'
      },
      {
        id: 'LIB_01',
        name: 'Central Library',
        subtitle: 'Research & Study Commons',
        x: 600, y: 80, w: 210, h: 140,
        door: { x: 670, y: 220 },
        color: '#00f2fe'
      },
      {
        id: 'BLK_B',
        name: 'Academic Block B',
        subtitle: 'Sciences & Management',
        x: 90, y: 260, w: 190, h: 130,
        door: { x: 200, y: 260 },
        color: '#8b5cf6'
      },
      {
        id: 'SAC_01',
        name: 'Student Activity Center',
        subtitle: 'Auditorium & Sports Arena',
        x: 250, y: 430, w: 240, h: 130,
        door: { x: 370, y: 430 },
        color: '#ec4899'
      },
      {
        id: 'CAN_02',
        name: 'South Cafe & Bistro',
        subtitle: 'Garden Deck & Coffee Bar',
        x: 550, y: 420, w: 160, h: 100,
        door: { x: 600, y: 420 },
        color: '#10b981'
      },
      {
        id: 'TRN_01',
        name: 'East Transit & Shuttle Hub',
        subtitle: 'Bays 1-4 & Metro Link',
        x: 770, y: 280, w: 190, h: 150,
        door: { x: 770, y: 350 },
        color: '#06b6d4'
      },
      {
        id: 'GATE_01',
        name: 'Main Campus Portal',
        subtitle: 'Security & Turnstiles',
        x: 60, y: 480, w: 130, h: 70,
        door: { x: 140, y: 480 },
        color: '#64748b',
        isStatic: true
      }
    ];

    // Pathway segments between doors/junctions
    this.pathways = [
      // Main Gate to Block B
      [{ x: 140, y: 480 }, { x: 140, y: 390 }],
      // Block B to Block A
      [{ x: 200, y: 260 }, { x: 200, y: 190 }],
      // Block A to North Canteen
      [{ x: 300, y: 130 }, { x: 360, y: 130 }],
      // North Canteen to Library
      [{ x: 530, y: 120 }, { x: 600, y: 120 }],
      // Central Quad Spine (North Canteen Door to Quad Center to SAC)
      [{ x: 445, y: 160 }, { x: 445, y: 290 }, { x: 370, y: 430 }],
      // Quad center cross-link to Block B
      [{ x: 445, y: 290 }, { x: 280, y: 290 }],
      // Library to East Transit Hub
      [{ x: 705, y: 220 }, { x: 705, y: 320 }, { x: 770, y: 320 }],
      // SAC to South Cafe
      [{ x: 490, y: 470 }, { x: 550, y: 470 }],
      // South Cafe to Transit Hub
      [{ x: 710, y: 460 }, { x: 820, y: 460 }, { x: 820, y: 430 }],
      // Central Quad to Library
      [{ x: 445, y: 290 }, { x: 600, y: 260 }]
    ];

    // Particle flow pool
    this.particles = [];
    this.initParticles(160);

    // Event listeners
    this.initEvents();
    this.resizeCanvas();
    this._onResize = () => this.resizeCanvas();
    window.addEventListener('resize', this._onResize);

    // Start rendering loop
    this.startLoop();
  }

  initParticles(count) {
    this.particles = [];
    for (let i = 0; i < count; i++) {
      const pathIdx = Math.floor(Math.random() * this.pathways.length);
      this.particles.push({
        pathIdx: pathIdx,
        t: Math.random(), // progress along path (0.0 to 1.0)
        speed: 0.002 + Math.random() * 0.004,
        direction: Math.random() > 0.5 ? 1 : -1,
        size: 1.5 + Math.random() * 2.0,
        hue: 185 + Math.random() * 40
      });
    }
  }

  resizeCanvas() {
    if (!this.canvas || !this.canvas.parentElement) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;

    // High DPI scaling
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    if (typeof this.ctx.setTransform === 'function') {
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    } else if (typeof this.ctx.resetTransform === 'function') {
      this.ctx.resetTransform();
      this.ctx.scale(dpr, dpr);
    }
  }

  initEvents() {
    this._onMouseMove = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = ((e.clientX - rect.left) / this.width) * 1000;
      const mouseY = ((e.clientY - rect.top) / this.height) * 600;

      let found = null;
      for (const b of this.buildings) {
        if (mouseX >= b.x && mouseX <= b.x + b.w && mouseY >= b.y && mouseY <= b.y + b.h) {
          found = b.id;
          break;
        }
      }
      if (this.hoveredZoneId !== found) {
        this.hoveredZoneId = found;
        this.canvas.style.cursor = found ? 'pointer' : 'default';
      }
    };

    this._onClick = (e) => {
      if (this.hoveredZoneId && this.hoveredZoneId !== 'GATE_01') {
        this.selectedZoneId = this.hoveredZoneId;
        if (typeof this.options.onZoneSelected === 'function') {
          this.options.onZoneSelected(this.selectedZoneId);
        }
      }
    };

    this._onMouseLeave = () => {
      this.hoveredZoneId = null;
    };

    this.canvas.addEventListener('mousemove', this._onMouseMove);
    this.canvas.addEventListener('click', this._onClick);
    this.canvas.addEventListener('mouseleave', this._onMouseLeave);
  }

  updateZoneTelemetry(telemetryMap) {
    this.zoneData = telemetryMap;
  }

  setSelectedZone(zoneId) {
    this.selectedZoneId = zoneId;
  }

  getColorForOccupancy(occPct) {
    if (occPct < 45) return { fill: 'rgba(16, 185, 129, 0.25)', border: '#10b981', glow: 'rgba(16, 185, 129, 0.4)' };
    if (occPct < 70) return { fill: 'rgba(245, 158, 11, 0.25)', border: '#f59e0b', glow: 'rgba(245, 158, 11, 0.45)' };
    if (occPct < 85) return { fill: 'rgba(249, 115, 22, 0.35)', border: '#f97316', glow: 'rgba(249, 115, 22, 0.6)' };
    return { fill: 'rgba(244, 63, 94, 0.45)', border: '#f43f5e', glow: 'rgba(244, 63, 94, 0.75)' };
  }

  render() {
    const ctx = this.ctx;
    const scaleX = this.width / 1000;
    const scaleY = this.height / 600;

    ctx.save();
    ctx.scale(scaleX, scaleY);

    // 1. Background Grid & Architecture Plan
    ctx.fillStyle = '#060a14';
    ctx.fillRect(0, 0, 1000, 600);

    // Blueprint grid lines
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= 1000; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 600);
      ctx.stroke();
    }
    for (let y = 0; y <= 600; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1000, y);
      ctx.stroke();
    }

    // Campus Grass/Landscape zones
    ctx.fillStyle = 'rgba(16, 185, 129, 0.035)';
    ctx.beginPath();
    ctx.roundRect(320, 200, 240, 180, 24);
    ctx.fill();
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.12)';
    ctx.stroke();

    // Central Quad water fountain / landmark
    ctx.fillStyle = 'rgba(0, 242, 254, 0.08)';
    ctx.beginPath();
    ctx.arc(445, 290, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Animated ripple on water fountain
    const rippleRad = 12 + ((this.timeTick * 0.4) % 24);
    const rippleAlpha = 1 - (rippleRad / 36);
    ctx.strokeStyle = `rgba(0, 242, 254, ${rippleAlpha * 0.6})`;
    ctx.beginPath();
    ctx.arc(445, 290, rippleRad, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(0, 242, 254, 0.6)';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText('CENTRAL QUAD PLAZA', 390, 294);

    // 2. Pedestrian Pathways
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const path of this.pathways) {
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x, path[i].y);
      }
      ctx.stroke();
    }

    // Inner dashed guide lines
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 6]);
    for (const path of this.pathways) {
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x, path[i].y);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // 3. Dynamic Heatmap Glows (Layer Behind Buildings)
    if (this.options.showHeatmap) {
      for (const b of this.buildings) {
        if (b.isStatic) continue;
        const telemetry = this.zoneData[b.id] || { occupancy_pct: 35 };
        const occPct = telemetry.occupancy_pct || 0;
        const colors = this.getColorForOccupancy(occPct);

        const centerX = b.x + b.w / 2;
        const centerY = b.y + b.h / 2;
        const maxRadius = Math.max(b.w, b.h) * (0.8 + (occPct / 100) * 0.6);

        const gradient = ctx.createRadialGradient(centerX, centerY, 20, centerX, centerY, maxRadius);
        gradient.addColorStop(0, colors.glow);
        gradient.addColorStop(0.5, colors.fill);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, maxRadius, 0, Math.PI * 2);
        ctx.fill();

        // Pulsing alert ring if Severe Bottleneck
        if (occPct >= 85) {
          const pulseR = (maxRadius * 0.7) + Math.sin(this.timeTick * 0.08) * 16;
          ctx.strokeStyle = 'rgba(244, 63, 94, 0.7)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(centerX, centerY, pulseR, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    // 4. Moving Pedestrian Flow Particles
    if (this.options.showParticles) {
      for (const p of this.particles) {
        const path = this.pathways[p.pathIdx];
        p.t += p.speed * p.direction;
        if (p.t > 1.0) { p.t = 1.0; p.direction = -1; }
        if (p.t < 0.0) { p.t = 0.0; p.direction = 1; }

        // Interpolate position along multi-point segment
        const pos = this.interpolatePolyline(path, p.t);

        ctx.fillStyle = `hsla(${p.hue}, 100%, 70%, 0.8)`;
        ctx.shadowColor = `hsla(${p.hue}, 100%, 60%, 1)`;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    // 5. Buildings Render Layer
    for (const b of this.buildings) {
      const isSelected = this.selectedZoneId === b.id;
      const isHovered = this.hoveredZoneId === b.id;
      const telemetry = this.zoneData[b.id] || { headcount: 0, occupancy_pct: 0, status: 'Normal' };
      const occPct = telemetry.occupancy_pct || 0;
      const colors = this.getColorForOccupancy(occPct);

      // Building Box with glass background
      ctx.fillStyle = isSelected ? 'rgba(22, 38, 72, 0.95)' : (isHovered ? 'rgba(18, 30, 56, 0.9)' : 'rgba(11, 19, 36, 0.85)');
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.w, b.h, 12);
      ctx.fill();

      // Building Border
      ctx.lineWidth = isSelected ? 2.5 : (isHovered ? 2 : 1.2);
      ctx.strokeStyle = isSelected ? '#00f2fe' : (isHovered ? colors.border : 'rgba(79, 134, 247, 0.3)');
      if (isSelected) {
        ctx.shadowColor = '#00f2fe';
        ctx.shadowBlur = 14;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Header Banner bar
      ctx.fillStyle = colors.border;
      ctx.beginPath();
      ctx.roundRect(b.x + 8, b.y + 8, 4, b.h - 16, 2);
      ctx.fill();

      // Building Labels & Telemetry
      if (this.options.showLabels) {
        // ID Tag
        ctx.font = '700 10px "JetBrains Mono", monospace';
        ctx.fillStyle = colors.border;
        ctx.fillText(b.id, b.x + 20, b.y + 24);

        // Building Name
        ctx.font = '600 13px "Outfit", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(b.name, b.x + 20, b.y + 42);

        // Subtitle
        ctx.font = '400 10px "Inter", sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(b.subtitle, b.x + 20, b.y + 57);

        if (!b.isStatic) {
          // Headcount & Occupancy badge
          const statY = b.y + b.h - 30;
          ctx.font = '700 14px "JetBrains Mono", monospace';
          ctx.fillStyle = colors.border;
          ctx.fillText(`${telemetry.headcount || 0}`, b.x + 20, statY);

          ctx.font = '400 10px "Inter", sans-serif';
          ctx.fillStyle = '#64748b';
          const maxCap = telemetry.capacity || (b.id === 'BLK_A' ? 2400 : (b.id === 'BLK_B' ? 1800 : (b.id === 'LIB_01' ? 1200 : (b.id === 'SAC_01' ? 850 : (b.id === 'CAN_01' ? 700 : (b.id === 'CAN_02' ? 400 : 650))))));
          ctx.fillText(`/${maxCap}`, b.x + 65, statY);

          // Mini progress gauge
          const barW = b.w - 40;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
          ctx.beginPath();
          ctx.roundRect(b.x + 20, b.y + b.h - 16, barW, 6, 3);
          ctx.fill();

          const fillW = Math.min(barW, Math.max(4, (occPct / 100) * barW));
          ctx.fillStyle = colors.border;
          ctx.beginPath();
          ctx.roundRect(b.x + 20, b.y + b.h - 16, fillW, 6, 3);
          ctx.fill();

          // Percentage pill on right
          ctx.font = '700 11px "JetBrains Mono", monospace';
          ctx.fillStyle = colors.border;
          ctx.fillText(`${occPct}%`, b.x + b.w - 45, statY);
        }
      }

      // Selection Beacon Pulse
      if (isSelected) {
        const beaconX = b.x + b.w - 18;
        const beaconY = b.y + 18;
        ctx.fillStyle = '#00f2fe';
        ctx.beginPath();
        ctx.arc(beaconX, beaconY, 4, 0, Math.PI * 2);
        ctx.fill();

        const pulse = 6 + (Math.sin(this.timeTick * 0.1) + 1) * 4;
        ctx.strokeStyle = 'rgba(0, 242, 254, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(beaconX, beaconY, pulse, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  interpolatePolyline(points, t) {
    if (points.length === 2) {
      return {
        x: points[0].x + (points[1].x - points[0].x) * t,
        y: points[0].y + (points[1].y - points[0].y) * t
      };
    }
    // Calculate total length
    let totalLen = 0;
    const lens = [];
    for (let i = 0; i < points.length - 1; i++) {
      const dx = points[i+1].x - points[i].x;
      const dy = points[i+1].y - points[i].y;
      const l = Math.sqrt(dx * dx + dy * dy);
      lens.push(l);
      totalLen += l;
    }
    const targetDist = t * totalLen;
    let accum = 0;
    for (let i = 0; i < points.length - 1; i++) {
      if (accum + lens[i] >= targetDist) {
        const segT = (targetDist - accum) / lens[i];
        return {
          x: points[i].x + (points[i+1].x - points[i].x) * segT,
          y: points[i].y + (points[i+1].y - points[i].y) * segT
        };
      }
      accum += lens[i];
    }
    return points[points.length - 1];
  }

  startLoop() {
    const loop = () => {
      // Only render if canvas is currently in the DOM and visible
      if (this.canvas && this.canvas.offsetParent !== null) {
        this.timeTick++;
        this.render();
      }
      this.animationFrameId = requestAnimationFrame(loop);
    };
    loop();
  }

  destroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this._onResize) {
      window.removeEventListener('resize', this._onResize);
    }
    if (this.canvas) {
      if (this._onMouseMove) this.canvas.removeEventListener('mousemove', this._onMouseMove);
      if (this._onClick) this.canvas.removeEventListener('click', this._onClick);
      if (this._onMouseLeave) this.canvas.removeEventListener('mouseleave', this._onMouseLeave);
    }
  }
}
