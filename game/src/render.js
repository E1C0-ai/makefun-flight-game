// Drawing only: the world's state and the current screen in, pixels out. The
// 1280x720 playfield is scaled to fit the window and centred, the margin filled
// with the backdrop colour. A pseudo-3D chase view: the camera sits just behind
// and above the plane, the terrain is a projected grid, rings and clouds are
// billboards, and the jet is drawn as a vector shape from behind.
import { FIELD, FONT, PALETTE, PLANE, RINGS, VIEW } from './config.js';
import { terrainHeight } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const CX = FIELD.width / 2;
const FOCAL = VIEW.focal;

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }
  resize();
  window.addEventListener('resize', resize);

  const fonts = new Map();
  function text(value, x, y, size, color, align = 'left', bold = false) {
    const key = size + (bold ? 'b' : '');
    if (!fonts.has(key)) fonts.set(key, `${bold ? '700 ' : ''}${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  /** Project a world point into screen space. Returns null when behind the camera. */
  function project(state, x, y, z) {
    const plane = state.plane;
    const camX = plane.x;
    const camY = plane.y + 9;
    const camZ = plane.z - 26;
    const h = plane.heading;
    const dx = x - camX;
    const dy = y - camY;
    const dz = z - camZ;
    const rx = dx * Math.cos(h) - dz * Math.sin(h);
    const rz = dx * Math.sin(h) + dz * Math.cos(h);
    if (rz < 8) return null;
    const horizon = VIEW.horizonY + plane.pitch * 130;
    return {
      x: CX + (rx * FOCAL) / rz,
      y: horizon - (dy * FOCAL) / rz,
      s: FOCAL / rz,
      rz,
    };
  }

  function groundColor(height) {
    if (height > 90) return PALETTE.groundSnow;
    if (height > 62) return PALETTE.groundRock;
    if (height > 34) return PALETTE.groundHigh;
    if (height > 14) return PALETTE.groundMid;
    return PALETTE.groundLow;
  }

  function drawSky(state) {
    const plane = state.plane;
    const horizon = VIEW.horizonY + plane.pitch * 130;
    const grad = context.createLinearGradient(0, 0, 0, horizon + 40);
    grad.addColorStop(0, PALETTE.skyTop);
    grad.addColorStop(0.55, PALETTE.skyMid);
    grad.addColorStop(1, PALETTE.skyHorizon);
    context.fillStyle = grad;
    context.fillRect(0, 0, FIELD.width, horizon + 40);
    // Stars high up, fading near the horizon.
    context.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 40; i += 1) {
      const sx = (i * 977) % FIELD.width;
      const sy = (i * 613) % Math.max(40, horizon - 120);
      context.globalAlpha = 0.25 + ((i * 37) % 10) / 22;
      context.fillRect(sx, sy, 2, 2);
    }
    context.globalAlpha = 1;
    // Low sun, drifting a little with the heading.
    const sunX = CX + 300 - plane.heading * 420;
    const sunY = horizon - 150 + plane.pitch * 60;
    const glow = context.createRadialGradient(sunX, sunY, 8, sunX, sunY, 130);
    glow.addColorStop(0, PALETTE.sunGlow);
    glow.addColorStop(1, 'rgba(255, 190, 110, 0)');
    context.fillStyle = glow;
    context.fillRect(sunX - 130, sunY - 130, 260, 260);
    context.fillStyle = PALETTE.sun;
    context.beginPath();
    context.arc(sunX, sunY, 34, 0, Math.PI * 2);
    context.fill();
  }

  function ridge(offset, color, base, amp, seed) {
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(0, FIELD.height);
    for (let x = -40; x <= FIELD.width + 40; x += 40) {
      const peak =
        base -
        (Math.sin((x + offset) * 0.008 + seed) * 0.5 + 0.5) * amp -
        (Math.sin((x + offset) * 0.021 + seed * 2) * 0.5 + 0.5) * amp * 0.45;
      context.lineTo(x, peak);
    }
    context.lineTo(FIELD.width + 40, FIELD.height);
    context.closePath();
    context.fill();
  }

  function drawMountains(state) {
    const plane = state.plane;
    const horizon = VIEW.horizonY + plane.pitch * 130;
    ridge(-plane.heading * 260, PALETTE.mountainFar, horizon + 6, 120, 1.3);
    ridge(-plane.heading * 520, PALETTE.mountainNear, horizon + 26, 84, 4.1);
  }

  function drawTerrain(state) {
    const plane = state.plane;
    const camZ = plane.z - 26;
    const rows = 22;
    const near = 26;
    const far = VIEW.far;
    const zs = [];
    for (let i = 0; i <= rows; i += 1) zs.push(camZ + near * Math.pow(far / near, i / rows));
    const cols = [];
    for (let x = -420; x <= 420; x += 48) cols.push(x);
    // Far rows first so near rows paint over them.
    for (let r = rows - 1; r >= 0; r -= 1) {
      const z0 = zs[r];
      const z1 = zs[r + 1];
      for (let c = 0; c < cols.length - 1; c += 1) {
        const x0 = cols[c];
        const x1 = cols[c + 1];
        const onRunway = z1 < VIEW.runwayEnd && Math.abs(x0) < VIEW.runwayHalf && Math.abs(x1) < VIEW.runwayHalf;
        const p00 = project(state, x0, terrainHeight(x0, z0), z0);
        const p10 = project(state, x1, terrainHeight(x1, z0), z0);
        const p11 = project(state, x1, terrainHeight(x1, z1), z1);
        const p01 = project(state, x0, terrainHeight(x0, z1), z1);
        if (!p00 || !p10 || !p11 || !p01) continue;
        if (onRunway) {
          context.fillStyle = PALETTE.runway;
        } else {
          const hMid = (terrainHeight(x0, z0) + terrainHeight(x1, z1)) / 2;
          context.fillStyle = groundColor(hMid);
        }
        context.beginPath();
        context.moveTo(p00.x, p00.y);
        context.lineTo(p10.x, p10.y);
        context.lineTo(p11.x, p11.y);
        context.lineTo(p01.x, p01.y);
        context.closePath();
        context.fill();
      }
      // Runway centre dashes and edge lights for this row.
      if (z1 < VIEW.runwayEnd) {
        const mid0 = project(state, 0, 0, z0);
        const mid1 = project(state, 0, 0, z1);
        const e0 = project(state, -VIEW.runwayHalf, 0, z0);
        const e1 = project(state, VIEW.runwayHalf, 0, z0);
        if (mid0 && mid1 && r % 2 === 0) {
          context.strokeStyle = PALETTE.runwayLine;
          context.lineWidth = Math.max(1, 0.6 * mid0.s);
          context.beginPath();
          context.moveTo(mid0.x, mid0.y);
          context.lineTo(mid1.x, mid1.y);
          context.stroke();
        }
        if (e0 && e1) {
          context.fillStyle = PALETTE.runwayLight;
          const dot = Math.max(1, 0.4 * e0.s);
          context.beginPath();
          context.arc(e0.x, e0.y, dot, 0, Math.PI * 2);
          context.arc(e1.x, e1.y, dot, 0, Math.PI * 2);
          context.fill();
        }
      }
    }
  }

  function drawClouds(state) {
    for (const cloud of state.clouds) {
      const p = project(state, cloud.x, cloud.y, cloud.z);
      if (!p) continue;
      const w = cloud.size * p.s * 2.2;
      const h = w * 0.36;
      if (w < 4 || w > 760) continue;
      context.fillStyle = PALETTE.cloudShadow;
      context.beginPath();
      context.ellipse(p.x, p.y + h * 0.12, w / 2, h / 2, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.cloud;
      context.beginPath();
      context.ellipse(p.x, p.y, w / 2, h / 2, 0, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawRings(state, showNextLabel) {
    const plane = state.plane;
    const visible = [];
    for (let i = 0; i < state.rings.length; i += 1) {
      const ring = state.rings[i];
      if (ring.z < plane.z - 40 || ring.z > plane.z + VIEW.far) continue;
      const p = project(state, ring.x, ring.y, ring.z);
      if (!p) continue;
      visible.push({ ring, p, index: i });
    }
    visible.sort((a, b) => b.p.rz - a.p.rz);
    for (const { ring, p, index } of visible) {
      const radius = RINGS.radius * p.s;
      if (radius < 2) continue;
      const isNext = index === state.nextRing;
      const color = ring.hit ? PALETTE.ringPassed : isNext ? PALETTE.amber : PALETTE.ring;
      context.save();
      context.globalAlpha = ring.passed && !ring.hit ? 0.25 : 0.95;
      context.strokeStyle = color;
      context.lineWidth = Math.max(2, radius * 0.16);
      context.shadowColor = color;
      context.shadowBlur = isNext ? 26 : 12;
      context.beginPath();
      context.ellipse(p.x, p.y, radius, radius * 0.94, 0, 0, Math.PI * 2);
      context.stroke();
      context.shadowBlur = 0;
      context.lineWidth = Math.max(1, radius * 0.05);
      context.globalAlpha *= 0.8;
      context.beginPath();
      context.ellipse(p.x, p.y, radius * 0.62, radius * 0.58, 0, 0, Math.PI * 2);
      context.stroke();
      context.restore();
      if (isNext && showNextLabel) {
        const dist = Math.max(0, Math.round((ring.z - plane.z) * 3));
        text(`${dist} m`, p.x, p.y - radius - 12, 20, PALETTE.amber, 'center', true);
      }
    }
  }

  function drawJet(state) {
    const plane = state.plane;
    const x = CX;
    const y = 548 + plane.pitch * 26;
    const boost = plane.throttle > 0.6;
    context.save();
    context.translate(x, y);
    context.rotate(-plane.bank * 0.9);
    // Engine glow.
    if (boost) {
      const flame = context.createRadialGradient(0, 26, 2, 0, 26, 46);
      flame.addColorStop(0, 'rgba(255, 200, 90, 0.9)');
      flame.addColorStop(1, 'rgba(255, 120, 40, 0)');
      context.fillStyle = flame;
      context.beginPath();
      context.ellipse(-16, 34, 12, 30, 0, 0, Math.PI * 2);
      context.ellipse(16, 34, 12, 30, 0, 0, Math.PI * 2);
      context.fill();
    }
    // Wings.
    context.fillStyle = PALETTE.jetDark;
    context.beginPath();
    context.moveTo(-14, 4);
    context.lineTo(-128, 34);
    context.lineTo(-118, 48);
    context.lineTo(-10, 22);
    context.closePath();
    context.moveTo(14, 4);
    context.lineTo(128, 34);
    context.lineTo(118, 48);
    context.lineTo(10, 22);
    context.closePath();
    context.fill();
    // Tail fins.
    context.fillStyle = PALETTE.jetAccent;
    context.beginPath();
    context.moveTo(-8, -26);
    context.lineTo(-26, -58);
    context.lineTo(-16, -58);
    context.lineTo(2, -30);
    context.closePath();
    context.moveTo(8, -26);
    context.lineTo(26, -58);
    context.lineTo(16, -58);
    context.lineTo(-2, -30);
    context.closePath();
    context.fill();
    // Fuselage.
    const body = context.createLinearGradient(-16, 0, 16, 0);
    body.addColorStop(0, PALETTE.jetDark);
    body.addColorStop(0.5, PALETTE.jetBody);
    body.addColorStop(1, PALETTE.jetDark);
    context.fillStyle = body;
    context.beginPath();
    context.moveTo(0, -72);
    context.quadraticCurveTo(15, -40, 14, 6);
    context.quadraticCurveTo(13, 30, 0, 34);
    context.quadraticCurveTo(-13, 30, -14, 6);
    context.quadraticCurveTo(-15, -40, 0, -72);
    context.fill();
    // Canopy.
    context.fillStyle = PALETTE.jetGlass;
    context.beginPath();
    context.ellipse(0, -42, 7, 18, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = 'rgba(255,255,255,0.5)';
    context.beginPath();
    context.ellipse(-2, -48, 2.5, 7, 0.2, 0, Math.PI * 2);
    context.fill();
    // Engine nozzles.
    context.fillStyle = PALETTE.engineGlow;
    context.beginPath();
    context.arc(-13, 30, 4.5, 0, Math.PI * 2);
    context.arc(13, 30, 4.5, 0, Math.PI * 2);
    context.fill();
    // Nav lights.
    const blink = Math.floor(performance.now() / 500) % 2 === 0;
    if (blink) {
      context.fillStyle = '#ff4d4d';
      context.beginPath();
      context.arc(-126, 38, 3, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#4dff88';
      context.beginPath();
      context.arc(126, 38, 3, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  function panel(x, y, w, h) {
    context.fillStyle = PALETTE.panel;
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 1;
    context.beginPath();
    context.roundRect(x, y, w, h, 8);
    context.fill();
    context.stroke();
  }

  function drawHUD(state, best) {
    const plane = state.plane;
    const altFt = Math.round(plane.y * 33);
    const speedKts = Math.round(plane.speed * 1.7);
    const headingDeg = ((Math.round((plane.heading * 180) / Math.PI) % 360) + 360) % 360;
    // Score, top left.
    panel(18, 16, 250, 92);
    text('SCORE', 34, 42, 15, PALETTE.muted, 'left', true);
    text(String(state.score), 34, 76, 34, PALETTE.text, 'left', true);
    text(`RINGS ${state.ringsHit}/${state.ringsTotal}`, 180, 42, 15, PALETTE.cyan, 'left', true);
    text(`TIME ${Math.ceil(state.timeLeft)}s`, 180, 70, 15, state.timeLeft <= 10 ? PALETTE.danger : PALETTE.text, 'left', true);
    // Compass tape, top centre.
    panel(CX - 190, 16, 380, 44);
    context.save();
    context.beginPath();
    context.rect(CX - 190, 16, 380, 44);
    context.clip();
    for (let d = -60; d <= 60; d += 15) {
      const deg = ((headingDeg + d) % 360 + 360) % 360;
      const px = CX + d * 2.6;
      context.strokeStyle = d === 0 ? PALETTE.amber : PALETTE.muted;
      context.lineWidth = d === 0 ? 2 : 1;
      context.beginPath();
      context.moveTo(px, 26);
      context.lineTo(px, d % 45 === 0 ? 44 : 36);
      context.stroke();
      if (d % 45 === 0) text(String(deg).padStart(3, '0'), px, 56, 13, PALETTE.text, 'center');
    }
    context.restore();
    // The current heading is the centred tick; the tape labels carry the numbers.
    // Best, top right.
    panel(FIELD.width - 168, 16, 150, 44);
    text('BEST', FIELD.width - 152, 34, 13, PALETTE.muted, 'left', true);
    text(String(best), FIELD.width - 152, 54, 20, PALETTE.text, 'left', true);
    // Altitude, bottom left.
    panel(18, FIELD.height - 96, 210, 80);
    text('ALT', 34, FIELD.height - 68, 14, PALETTE.muted, 'left', true);
    text(`${altFt.toLocaleString()} ft`, 34, FIELD.height - 34, 28, PALETTE.text, 'left', true);
    text(`V/S ${plane.pitch >= 0 ? '+' : ''}${Math.round(plane.pitch * PLANE.climbRate * 200)} fpm`, 150, FIELD.height - 40, 14, PALETTE.cyan, 'left');
    // Speed and throttle, bottom right.
    panel(FIELD.width - 228, FIELD.height - 96, 210, 80);
    text('SPD', FIELD.width - 212, FIELD.height - 68, 14, PALETTE.muted, 'left', true);
    text(`${speedKts} kts`, FIELD.width - 212, FIELD.height - 34, 28, PALETTE.text, 'left', true);
    const tw = 84;
    context.fillStyle = 'rgba(255,255,255,0.14)';
    context.fillRect(FIELD.width - 106, FIELD.height - 48, tw, 10);
    context.fillStyle = plane.throttle > 0.6 ? PALETTE.engineGlow : PALETTE.cyan;
    context.fillRect(FIELD.width - 106, FIELD.height - 48, tw * plane.throttle, 10);
    text('THR', FIELD.width - 106, FIELD.height - 56, 11, PALETTE.muted, 'left');
    // Warning, centre.
    if (state.warning) {
      const blink = Math.floor(performance.now() / 350) % 2 === 0;
      if (blink) text(state.warning, CX, 150, 30, PALETTE.danger, 'center', true);
    }
    // Boost speed lines.
    if (plane.throttle > 0.6) {
      context.strokeStyle = 'rgba(255,255,255,0.25)';
      context.lineWidth = 2;
      for (let i = 0; i < 8; i += 1) {
        const ly = 120 + ((i * 173) % 480);
        const lx = i % 2 === 0 ? 30 + (i * 11) % 60 : FIELD.width - 90 + (i * 13) % 60;
        context.beginPath();
        context.moveTo(lx, ly);
        context.lineTo(lx, ly + 46);
        context.stroke();
      }
    }
  }

  function drawTitle(state, best) {
    context.fillStyle = 'rgba(8, 12, 24, 0.42)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    panel(CX - 330, 120, 660, 330);
    text('SKY RINGS', CX, 200, 64, PALETTE.text, 'center', true);
    text('CANYON RING-RUN  ·  FLY THE COURSE, THREAD EVERY RING', CX, 236, 17, PALETTE.amber, 'center', true);
    text('← → / A D  steer      ↑ ↓ / W S  climb & descend', CX, 292, 19, PALETTE.text, 'center');
    text('SHIFT  boost      MOUSE  steer      P  pause', CX, 322, 19, PALETTE.text, 'center');
    text('Fly through the glowing rings. Mind the ridges.', CX, 356, 17, PALETTE.muted, 'center');
    const blink = Math.floor(performance.now() / 500) % 2 === 0;
    if (blink) text('PRESS SPACE OR CLICK TO FLY', CX, 408, 24, PALETTE.cyan, 'center', true);
    if (best > 0) text(`BEST  ${best}`, CX, 442, 16, PALETTE.muted, 'center');
  }

  function drawOver(state, best) {
    context.fillStyle = 'rgba(8, 12, 24, 0.55)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    panel(CX - 300, 150, 600, 330);
    text(state.crashed ? 'TERRAIN STRIKE' : 'FLIGHT COMPLETE', CX, 224, 46, state.crashed ? PALETTE.danger : PALETTE.text, 'center', true);
    text(state.crashed ? 'The ridge wins this time.' : 'Course flown. Nice flying.', CX, 258, 17, PALETTE.muted, 'center');
    text('SCORE', CX - 180, 316, 16, PALETTE.muted, 'center', true);
    text(String(state.score), CX - 180, 356, 40, PALETTE.text, 'center', true);
    text('RINGS', CX, 316, 16, PALETTE.muted, 'center', true);
    text(`${state.ringsHit}/${state.ringsTotal}`, CX, 356, 40, PALETTE.cyan, 'center', true);
    text('DISTANCE', CX + 180, 316, 16, PALETTE.muted, 'center', true);
    text(`${Math.round(state.distance * 3).toLocaleString()} m`, CX + 180, 356, 40, PALETTE.text, 'center', true);
    if (state.score >= best && best > 0) text('NEW BEST!', CX, 404, 20, PALETTE.amber, 'center', true);
    const blink = Math.floor(performance.now() / 500) % 2 === 0;
    if (blink) text('PRESS SPACE TO FLY AGAIN', CX, 448, 20, PALETTE.cyan, 'center', true);
  }

  function drawPaused() {
    context.fillStyle = 'rgba(8, 12, 24, 0.5)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    text('PAUSED', CX, 330, 52, PALETTE.text, 'center', true);
    text('Press P or Space to resume', CX, 372, 19, PALETTE.muted, 'center');
  }

  function draw(state, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#0a0e18';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    // Roll the whole world a touch with the bank.
    context.save();
    context.translate(CX, 380);
    context.rotate(-state.plane.bank * 0.12);
    context.translate(-CX, -380);
    drawSky(state);
    drawMountains(state);
    drawTerrain(state);
    drawClouds(state);
    drawRings(state, screen !== SCREEN_TITLE);
    context.restore();
    drawJet(state);
    drawHUD(state, best);
    if (screen === SCREEN_TITLE) drawTitle(state, best);
    else if (screen === SCREEN_OVER) drawOver(state, best);
    else if (screen === SCREEN_PAUSED) drawPaused();
  }

  return { draw };
}
