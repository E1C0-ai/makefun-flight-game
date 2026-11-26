// Sky Rings — tuning numbers and colours in one place. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule below
// depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Flight model: arcade, not a simulator. Speed in world units per second. */
export const PLANE = {
  baseSpeed: 96,
  boostSpeed: 148,
  accel: 40,
  bankRate: 1.5, // how fast the bank angle moves toward its target, per second
  maxBank: 0.62, // radians of roll at full stick
  turnRate: 0.85, // heading change per second at full bank
  climbRate: 70, // altitude units per second at full pitch
  sinkRate: 4, // altitude lost per second with the stick centred
  minAlt: 0,
  maxAlt: 300,
  maxLateral: 380, // corridor half-width; past it the wind pushes you back
};

/** The flight lasts this long; rings are the score. */
export const FLIGHT = { seconds: 90, ringPoints: 100, distancePointsPerUnit: 0.02 };

export const RINGS = {
  firstZ: 420, // the first ring sits just past the end of the runway
  spacing: 300, // world units between rings along the course
  count: 40,
  radius: 30,
  minY: 55,
  maxY: 210,
  maxStepX: 120, // how far the course wanders sideways between rings
};

/** How far ahead the renderer draws: terrain rows, rings and clouds past this are skipped. */
export const VIEW = {
  far: 1500,
  focal: 620, // projection focal length, in logical pixels
  horizonY: 305, // horizon line on the 720-high field when level
  runwayHalf: 15, // half-width of the runway strip
  runwayEnd: 620, // the runway runs from z = -80 to here
};

export const PALETTE = {
  skyTop: '#1b2340',
  skyMid: '#4a4a72',
  skyHorizon: '#e8823f',
  sun: '#ffd9a0',
  sunGlow: 'rgba(255, 190, 110, 0.55)',
  mountainFar: '#5a5470',
  mountainNear: '#3d3a58',
  groundLow: '#3f6b3a',
  groundMid: '#5d7d3c',
  groundHigh: '#8a7a52',
  groundRock: '#6e6258',
  groundSnow: '#dfe6ee',
  runway: '#33363e',
  runwayLine: '#f5d76e',
  runwayLight: '#ffb347',
  ring: '#39d5ff',
  ringPassed: '#7dff8a',
  ringGlow: 'rgba(57, 213, 255, 0.35)',
  cloud: 'rgba(255, 244, 230, 0.85)',
  cloudShadow: 'rgba(255, 244, 230, 0.45)',
  jetBody: '#c8d2dc',
  jetDark: '#5a6672',
  jetAccent: '#e8574b',
  jetGlass: '#1d2f45',
  engineGlow: '#ff9a3c',
  panel: 'rgba(10, 16, 28, 0.72)',
  panelEdge: 'rgba(120, 200, 255, 0.35)',
  text: '#f2f6fa',
  muted: '#aab6c4',
  amber: '#ffc857',
  cyan: '#5fd4ff',
  danger: '#ff5d5d',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'sky-rings.best';
