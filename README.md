# Sky Rings — Canyon Ring-Run

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/E1C0-ai/makefun-flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/E1C0-ai/makefun-flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

A chase-view flight game built for the [make.fun](https://make.fun/bounty/best-flight-game-20261126-0057) "Make the best flight game" bounty.

Make the best flight game. **$500 USDC, 50 places paid** (1st $100, 2nd $55, 3rd $30 … 50th $3).
Escrow locked on Solana since 2026-11-26 01:05 UTC.
Deadline: **Sat 2026-11-28 00:57 UTC = 北京时间 2026-11-28 08:57** (48-hour window).
First blind-round cutoff: **2026-11-26 12:57 UTC = 北京时间 20:57** — submit before then to be judged in round 1.
Entries so far: ~333 (2026-11-26 morning).

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>

## The game

**Sky Rings — Canyon Ring-Run.** A chase-view flight game in a desktop browser, static
files, no network. Take off from the runway at sunset, thread the glowing rings
through a canyon valley, mind the ridges.

- Pseudo-3D world: projected terrain grid (valleys, ridges, snowcaps), runway with
  centre dashes and edge lights, layered mountain silhouettes, drifting clouds, low sun.
- The jet is drawn from behind as a vector shape: banking wings, tail fins, canopy,
  afterburner glow, blinking nav lights.
- HUD: score, rings hit, time left, compass tape, altitude + vertical speed,
  speed + throttle bar, best score, terrain warnings.
- Controls: ← → / A D steer, ↑ ↓ / W S climb & descend, SHIFT boost, mouse steers, P pause.
- Rules: 90-second flight, 40 rings, +100 per ring, distance bonus at the end;
  flying into terrain ends the flight. Best score kept in localStorage.
- Sound: tiny WebAudio synth — ring chime, crash thud, engine hum (starts after a gesture).

## How it is built

- `game/` — plain static files, no framework, no network request. `main.ts` at the
  repo root copies `game/` and `screenshots/` to `/output` and writes `dossier.json`
  with the kit's `vendor/makefun-game.ts` (unchanged).
- `game/src/` — `config.js` (tuning), `random.js` (seeded RNG), `world.js` (flight
  model, terrain heightfield, ring course), `render.js` (pseudo-3D renderer + HUD),
  `input.js`, `shots.js` (deterministic screenshot scenes), `main.js` (loop + audio).
- `screenshots/` — 3 real renders of the game's own code (1280×720 JPEGs):
  `1-start.jpg` (on the runway, title), `2-play.jpg` (mid-flight, 8 rings, 800 pts),
  `3-end.jpg` (terrain strike, 3 rings). Taken with `shoot.py` (Playwright + local
  Chromium, `node serve.ts` on :8080, `?shot=…&seed=1`, waits for `window.__shotReady`).
- `shoot.py` also verifies: zero console/page errors, zero non-local requests,
  every screenshot under the 256 KiB cap.

## Checks run

- `python3 shoot.py` — 3 screenshots, no errors, only localhost requests, all < 256 KiB.
- Interactive playtest (Playwright, real keys: Space, ArrowUp, Shift, ArrowLeft) — no errors.
- `MAKEFUN_OUTPUT_DIR=out node main.ts` — dossier.json builds, game + screenshots copied.

## Status

- **GitHub**: public repo `E1C0-ai/makefun-flight-game` (created after the competition opened, 2026-11-26), MIT license included.
- **make.fun**: signed in as @e1c0-ai (GitHub E1C0-ai), wallet `5ffaKbhY…V2tb` linked; entry submitted with the repo URL + commit SHA + transcript bundle.
- **Claim**: if it places, claim USDC to his Solana wallet before the claim window closes; only if his yearly make.fun winnings reach $2,000 does it ask for name/country/tax form (W-8BEN for non-US) — $500 alone does not trigger it.

## Files

- `game/`, `screenshots/`, `main.ts`, `serve.ts`, `shots.json`, `vendor/`, `LICENSE`
- `kit/` — the downloaded bounty kit (kit.tar.gz + unpacked)
- `kit.tar.gz`, `requirements.json`, `shoot.py`, `README.md` (this file)
