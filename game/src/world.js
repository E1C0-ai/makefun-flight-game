// The game's rules and state, with no drawing and no browser in it: the plane, the
// terrain heightfield, the ring course, spawning, collisions, score and time.
// step() advances one fixed step and returns what happened as bit flags, so the
// caller can react without the world knowing about screens or sound. Nothing here
// allocates after createWorld returns.

import { FIELD, FLIGHT, PLANE, RINGS, STEP, VIEW } from './config.js';

export const EVENT_RING = 1;
export const EVENT_CRASH = 2;
export const EVENT_OVER = 4;
export const EVENT_WARNING = 8;

const TWO_PI = Math.PI * 2;

/** Smooth terrain height at (x, z): rolling hills that rise with distance, with a
 *  flat corridor along the runway (z < runwayEnd) so take-off is safe. */
export function terrainHeight(x, z) {
  if (z < VIEW.runwayEnd && Math.abs(x) < 60) return 0;
  const rise = Math.min(1.6, Math.max(0, (z - 500) / 2400)); // hills grow, then level off
  const hills =
    Math.sin(x * 0.011 + z * 0.004) * 26 +
    Math.sin(x * 0.023 - z * 0.009 + 1.7) * 16 +
    Math.sin(z * 0.0021 + 0.6) * 22;
  const ridge = Math.max(0, Math.sin(x * 0.004 + 2.1)) * 34 * rise;
  const edge = Math.max(0, (Math.abs(x) - 240) / 140) * 46; // valley walls at the sides
  return Math.max(0, hills * (0.35 + rise) + ridge + edge);
}

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function createWorld(random) {
  const rings = [];
  for (let index = 0; index < RINGS.count; index += 1) {
    rings.push({ x: 0, y: 0, z: 0, passed: false, hit: false });
  }
  const clouds = [];
  for (let index = 0; index < 26; index += 1) {
    clouds.push({ x: 0, y: 0, z: 0, size: 0, speed: 0 });
  }
  const plane = {
    x: 0, y: 0, z: 0, heading: 0, bank: 0, pitch: 0,
    speed: PLANE.baseSpeed, throttle: 0,
  };
  const state = {
    plane, rings, clouds,
    score: 0, ringsHit: 0, ringsTotal: RINGS.count,
    timeLeft: FLIGHT.seconds, elapsed: 0,
    crashed: false, over: false, warning: '',
    nextRing: 0, distance: 0,
  };

  /** Lay out the ring course and the clouds from the world's seed. */
  function layOut() {
    let x = 0;
    let y = 120;
    for (let index = 0; index < rings.length; index += 1) {
      const ring = rings[index];
      x = clamp(x + (random() * 2 - 1) * RINGS.maxStepX, -220, 220);
      y = clamp(y + (random() * 2 - 1) * 70, RINGS.minY, RINGS.maxY);
      // Keep the ring clear of the ground: at least 45 units above the terrain.
      const ground = terrainHeight(x, RINGS.firstZ + index * RINGS.spacing);
      ring.x = x;
      ring.y = Math.max(y, ground + 48);
      ring.z = RINGS.firstZ + index * RINGS.spacing;
      ring.passed = false;
      ring.hit = false;
    }
    for (let index = 0; index < clouds.length; index += 1) {
      const cloud = clouds[index];
      cloud.x = (random() * 2 - 1) * 700;
      cloud.y = 190 + random() * 110;
      cloud.z = random() * 4200;
      cloud.size = 40 + random() * 90;
      cloud.speed = 2 + random() * 4;
    }
  }

  function reset() {
    plane.x = 0;
    plane.y = 0;
    plane.z = 0;
    plane.heading = 0;
    plane.bank = 0;
    plane.pitch = 0;
    plane.speed = PLANE.baseSpeed;
    plane.throttle = 0;
    state.score = 0;
    state.ringsHit = 0;
    state.timeLeft = FLIGHT.seconds;
    state.elapsed = 0;
    state.crashed = false;
    state.over = false;
    state.warning = '';
    state.nextRing = 0;
    state.distance = 0;
    layOut();
  }

  /**
   * One fixed step. steer: -1 (left) .. 1 (right). climb: -1 (down) .. 1 (up).
   * boost: true while the throttle key is held. demo: true while the title screen
   * idles — the plane sits on the runway with its engines warm, nothing moves.
   */
  function step(dt, steer, climb, boost, demo) {
    if (state.over) return 0;
    let events = 0;
    if (demo) {
      plane.throttle = 0.35 + 0.1 * Math.sin(state.elapsed * 2);
      plane.speed = 0; // parked on the runway, engines warm
      state.elapsed += dt;
      return 0;
    }
    state.elapsed += dt;
    state.timeLeft = Math.max(0, FLIGHT.seconds - state.elapsed);

    // Throttle eases toward its target; speed follows it.
    const targetThrottle = boost ? 1 : 0;
    plane.throttle += clamp(targetThrottle - plane.throttle, -dt * 1.5, dt * 1.5);
    const targetSpeed = PLANE.baseSpeed + (PLANE.boostSpeed - PLANE.baseSpeed) * plane.throttle;
    plane.speed += clamp(targetSpeed - plane.speed, -PLANE.accel * dt, PLANE.accel * dt);

    // Bank toward the stick, then turn and slide sideways with the heading.
    const targetBank = steer * PLANE.maxBank;
    plane.bank += clamp(targetBank - plane.bank, -PLANE.bankRate * dt, PLANE.bankRate * dt);
    plane.heading += plane.bank * PLANE.turnRate * dt;
    plane.pitch += clamp(climb - plane.pitch, -dt * 3, dt * 3);
    plane.z += plane.speed * dt;
    plane.x += Math.sin(plane.heading) * plane.speed * dt;
    plane.y += plane.pitch * PLANE.climbRate * dt - PLANE.sinkRate * dt;
    plane.y = clamp(plane.y, PLANE.minAlt, PLANE.maxAlt);
    state.distance = plane.z;

    // The valley walls push a stray plane back toward the course.
    if (Math.abs(plane.x) > PLANE.maxLateral) {
      plane.x = Math.sign(plane.x) * PLANE.maxLateral;
      plane.heading *= 0.9;
      state.warning = 'OFF COURSE — TURN BACK';
      events |= EVENT_WARNING;
    } else if (state.warning === 'OFF COURSE — TURN BACK') {
      state.warning = '';
    }

    // Rings: crossing a ring's plane scores when the plane is inside it.
    while (state.nextRing < rings.length && rings[state.nextRing].z < plane.z - RINGS.radius) {
      rings[state.nextRing].passed = true;
      state.nextRing += 1;
    }
    for (let index = state.nextRing; index < rings.length; index += 1) {
      const ring = rings[index];
      if (ring.z > plane.z + RINGS.radius) break;
      if (!ring.hit && Math.abs(ring.z - plane.z) <= RINGS.radius) {
        const dx = plane.x - ring.x;
        const dy = plane.y - ring.y;
        if (dx * dx + dy * dy <= RINGS.radius * RINGS.radius) {
          ring.hit = true;
          ring.passed = true;
          state.ringsHit += 1;
          state.score += FLIGHT.ringPoints;
          events |= EVENT_RING;
        }
      }
    }

    // Terrain: flying into a hillside ends the flight. On the runway strip the
    // plane is rolling on tarmac, so the ground cannot crash it there.
    const onRunway = plane.z < VIEW.runwayEnd && Math.abs(plane.x) < VIEW.runwayHalf + 6;
    const ground = onRunway ? -10 : terrainHeight(plane.x, plane.z);
    if (plane.y <= ground + 2) {
      state.crashed = true;
      state.over = true;
      events |= EVENT_CRASH | EVENT_OVER;
      return events;
    }
    // Low warning when the ground is close under the plane.
    if (!onRunway && plane.y - ground < 26) state.warning = 'PULL UP — TERRAIN';
    else if (state.warning === 'PULL UP — TERRAIN') state.warning = '';

    if (state.timeLeft <= 0) {
      state.over = true;
      state.score += Math.round(state.distance * FLIGHT.distancePointsPerUnit);
      events |= EVENT_OVER;
    }
    return events;
  }

  reset();
  return { state, reset, step, terrainHeight };
}
