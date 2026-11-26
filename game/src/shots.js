// The screenshot scenes behind ?shot=start|play|end. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple
// autopilot (aim at the next ring, lead the turn, hold altitude over the ridge),
// so the frame is what a short game really looks like and the same seed always
// gives the same frame.
import { RINGS, STEP } from './config.js';
import { EVENT_OVER, terrainHeight } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const END_LIMIT_SECONDS = 150;
const SAMPLE = 1 / 30;

/** Steer toward the next ring with a PD loop: aim the heading at the ring, then
 *  bank to hold that heading. Climb to the ring's height, but never below the
 *  ridge ahead — the ground 250–500 units out sets a floor. */
function autopilot(state, skill) {
  const plane = state.plane;
  const ring = state.rings[state.nextRing];
  if (!ring) return { steer: 0, climb: 0 };
  const wantX = ring.x + skill * 26; // the end-scene pilot aims sloppily
  const desiredHeading = Math.max(-0.45, Math.min(0.45, (wantX - plane.x) / 160));
  const steer = Math.max(-1, Math.min(1, (desiredHeading - plane.heading) * 2.4));
  const groundAhead = Math.max(
    terrainHeight(plane.x, plane.z + 250),
    terrainHeight(plane.x, plane.z + 500),
  );
  const wantY = Math.max(ring.y + skill * 34, groundAhead + 42);
  const climb = Math.max(-1, Math.min(1, (wantY - plane.y) / 45));
  return { steer, climb };
}

/**
 * Set `world` to the named scene (start, play or end; any other name is start) and return the
 * screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) world.step(STEP, 0, 0, false, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  const skill = name === 'end' ? 1 : 0;
  for (let index = 0; index < limit / STEP; index += 1) {
    let { steer, climb } = autopilot(world.state, skill);
    // The end-scene pilot gets tired: after 45 s it stops climbing and drifts
    // down into the ridge, as a hurried player does.
    if (name === 'end' && world.state.elapsed > 45) {
      steer = 0.25;
      climb = -0.7;
    }
    const events = world.step(STEP, steer, climb, true, false);
    if (events & EVENT_OVER) break;
  }
  const over = world.state.over;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: 0 };
}
