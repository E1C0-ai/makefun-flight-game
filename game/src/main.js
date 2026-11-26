// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The game
// moves between four screens: title, play, paused and game over. A tiny WebAudio synth plays a
// ring chime, a crash thud and a soft engine hum; it only starts after a gesture.
//
// ?seed=N fixes the course. ?shot=start|play|end (with &seed=N) stages that scene instead of
// running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_CRASH, EVENT_OVER, EVENT_RING } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

/** Small synth: chime on a ring, thud on a crash, hum while flying. */
function createAudio() {
  let context = null;
  let hum = null;
  let humGain = null;
  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      hum = context.createOscillator();
      hum.type = 'sawtooth';
      hum.frequency.value = 52;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 240;
      humGain = context.createGain();
      humGain.gain.value = 0;
      hum.connect(filter);
      filter.connect(humGain);
      humGain.connect(context.destination);
      hum.start();
      return true;
    } catch {
      return false;
    }
  }
  function tone(freq, when, dur, type, gain) {
    if (!context) return;
    const osc = context.createOscillator();
    const g = context.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, context.currentTime + when);
    g.gain.linearRampToValueAtTime(gain, context.currentTime + when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + when + dur);
    osc.connect(g);
    g.connect(context.destination);
    osc.start(context.currentTime + when);
    osc.stop(context.currentTime + when + dur + 0.05);
  }
  return {
    unlock() {
      if (ensure() && context.state === 'suspended') context.resume().catch(() => {});
    },
    setHum(on, boost) {
      if (!context || !humGain) return;
      humGain.gain.setTargetAtTime(on ? (boost ? 0.05 : 0.028) : 0, context.currentTime, 0.2);
      if (hum) hum.frequency.setTargetAtTime(boost ? 74 : 52, context.currentTime, 0.3);
    },
    ring() {
      tone(880, 0, 0.5, 'sine', 0.12);
      tone(1318, 0.07, 0.5, 'sine', 0.09);
    },
    crash() {
      tone(70, 0, 0.7, 'triangle', 0.22);
      tone(48, 0.05, 0.8, 'sine', 0.2);
    },
  };
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const audio = createAudio();
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes and each ring.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.setHum(true, false);
    announce('Flying. Thread the rings.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    audio.setHum(false, false);
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(
      world.state.crashed
        ? `Crashed. Score ${world.state.score}. Best ${best}.`
        : `Flight complete. Score ${world.state.score}. Best ${best}.`,
    );
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) startGame();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      audio.setHum(false, false);
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      audio.setHum(true, input.boost());
      announce('Flying.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, 0, 0, false, true);
      return;
    }
    const events = world.step(STEP, input.steer(), input.climb(), input.boost(), false);
    if (events & EVENT_RING) {
      audio.ring();
      announce(`Ring! ${world.state.ringsHit} of ${world.state.ringsTotal}. Score ${world.state.score}.`);
    }
    if (events & EVENT_CRASH) audio.crash();
    if (events & EVENT_OVER) endGame();
    else audio.setHum(true, input.boost());
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting the plane fly unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      audio.setHum(false, false);
      announce('Paused.');
    }
  });

  announce('Sky Rings. Press Space or click to fly.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
