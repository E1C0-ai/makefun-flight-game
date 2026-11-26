// Keyboard and pointer input. Held keys give steering, climb and boost; one-shot
// presses (start or restart, pause) are queued as bit flags and taken once by the
// loop, so a press between two frames is never lost and never counted twice.
// Moving the mouse steers as well: left/right banks, up/down pitches.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const BOOST = new Set(['ShiftLeft', 'ShiftRight']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);

export function createInput(target) {
  let left = false;
  let right = false;
  let up = false;
  let down = false;
  let boost = false;
  let mouseSteer = 0;
  let mouseClimb = 0;
  let actions = 0;

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (UP.has(event.code)) up = true;
    else if (DOWN.has(event.code)) down = true;
    else if (BOOST.has(event.code)) boost = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
    else if (UP.has(event.code)) up = false;
    else if (DOWN.has(event.code)) down = false;
    else if (BOOST.has(event.code)) boost = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    left = false;
    right = false;
    up = false;
    down = false;
    boost = false;
    mouseSteer = 0;
    mouseClimb = 0;
  });
  target.addEventListener('pointerdown', () => {
    actions |= ACTION_CONFIRM;
  });
  target.addEventListener('pointermove', (event) => {
    const rect = target.getBoundingClientRect();
    const nx = (event.clientX - rect.left) / rect.width - 0.5;
    const ny = (event.clientY - rect.top) / rect.height - 0.5;
    mouseSteer = Math.max(-1, Math.min(1, nx * 2.4));
    mouseClimb = Math.max(-1, Math.min(1, -ny * 2.4));
  });

  return {
    /** -1 for left, 1 for right, 0 for neither or both. */
    steer() {
      const keys = (right ? 1 : 0) - (left ? 1 : 0);
      if (keys !== 0) return keys;
      return Math.abs(mouseSteer) > 0.12 ? mouseSteer : 0;
    },
    /** -1 for down, 1 for up, 0 for neither or both. */
    climb() {
      const keys = (up ? 1 : 0) - (down ? 1 : 0);
      if (keys !== 0) return keys;
      return Math.abs(mouseClimb) > 0.12 ? mouseClimb : 0;
    },
    boost() {
      return boost;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
