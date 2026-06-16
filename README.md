# 🛻₿ Road to El Salvador — Bitcoin Road Trip

A single-page browser game: drive a beat-up SUV from **Los Angeles** to **San Salvador**.
Cash inflates, Bitcoin appreciates, Claude generates newspaper events, and a 2D wave-shooter
defends your stack at dangerous stops.

Built with **React 18**, **Three.js**, the **Web Audio API**, and the **Claude API** (optional).

![Drive](https://img.shields.io/badge/2800_miles-8_stops-f7931a)

## Run it locally

```bash
npm install
cd server && npm install && cd ..
npm run dev:full
```

This starts the Vite dev server on http://localhost:5173 and the Express API server on
http://localhost:3001. The game is **fully playable with no API key** — `DEV_MODE = true` in
`src/game-engine/gameConfig.js` uses built-in mock events.

You can also run just the frontend:

```bash
npm run dev
```

Other scripts:

```bash
npm run build        # production build to dist/ (zero errors)
npm run preview      # serve the production build locally
npm run server       # start the Express leaderboard/event server
npm test             # run unit + integration tests
npm run test:coverage # run tests with coverage report
npm run lint         # run ESLint
```

## Live AI events (optional)

To have **Claude** generate region-aware events instead of the mock pool:

1. Copy `.env.example` to `.env` in the project root and set `ANTHROPIC_API_KEY=sk-ant-...`
2. Start the server with `npm run server` (or `npm run dev:full`)
3. Set `DEV_MODE = false` in `src/game-engine/gameConfig.js`

The API key lives **only on the server**. The client calls `/api/event`; the server talks to Claude.

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import it in [Vercel](https://vercel.com) as a Vite project.
3. Add the environment variables from `.env.example` in the Vercel dashboard:
   - `ANTHROPIC_API_KEY` (optional, for live events)
   - `CORS_ORIGIN` (your production domain)
4. Deploy. `vercel.json` routes `/api/*` to the serverless function in `api/index.js` and all
   other paths to the SPA.

## How to play

- **Start:** pick a driver name and difficulty (Tourist / Road Warrior / Satoshi).
- **Drive:** the SUV travels automatically. Watch gas, SUV health, and crew vibes — hit zero on
  any and the run ends.
- **Hard money:** the top-right widget is the heart of the game. Your **cash** loses purchasing
  power over time (the red bar shrinks); your **BTC stack** rides a rising random walk. Reaching
  El Salvador with a bigger real stack than you started with is the goal.
- **City stops:** refuel, repair, or rest — but local prices inflate as your purchasing power
  falls. Border crossings (Tijuana, Guatemala City) make you wait.
- **Newspaper events:** choose how to respond. Some physical threats let you **Stand your ground**,
  opening the wave-shooter.
- **Ambushes:** at Tegucigalpa (and on `canFight` events) defend your stack — tap threats before
  they reach the line. Ammo = vibes × 3. `Esc` or the **FLEE** button to flee (−1 vibe).
- **Arrival:** reach San Salvador for the cinematic and your final scorecard.

## File guide — what each file does

Every file is named for what it contains, so you can find things by vibes.

```
index.html                          the web page shell; loads the app + Google Fonts
public/manifest.json                PWA manifest
api/index.js                        Vercel serverless entrypoint for /api/*
server/index.js                     Express server: leaderboard + /api/event
.github/workflows/ci.yml            GitHub Actions: lint, test, build
src/
  appEntryPoint.jsx                 boots React, error boundary, mounts the game
  GameController.jsx                THE BRAIN: wires screens, loop, events, ambushes
  globalStyles.css                  colors, fonts, shared animations, a11y

  game-engine/                      the moving parts that make the game *work*
    gameConfig.js                   constants (DEV_MODE, miles, prices, loadouts)
    gameState.js                    the single source of truth + reset/end helpers
    gameRules.js                    tick + applyEffects
    gameActions.js                  explicit action functions for state mutations
    gameLoop.js                     requestAnimationFrame loop (tick, stops, arrival)
    drivingScene3D.js               the 3D side-scrolling road drawn with Three.js
    truckModel3D.js                 builds the beat-up SUV 3D model
    shootingMinigame.js             the 2D click-to-shoot ambush minigame
    soundEffects.js                 every sound, made in code
    leaderboardStorage.js           saves and loads high scores (backend-first)

  events/
    eventGenerator.js               mock events, or fetch from /api/event

  map-data/
    citiesAndRoute.js               the 8 cities (LA → San Salvador) + biomes

  screens/                          everything you SEE (full screens + HUD overlays)
    StartScreen.jsx                 name + difficulty pick
    ErrorBoundary.jsx               crash fallback
    HeadsUpDisplay.jsx              the in-game HUD
    BitcoinPriceSparkline.jsx       the little BTC price chart
    CityStopShop.jsx                refuel / repair / rest shop
    NewspaperEventCard.jsx          torn-paper event popup
    ShootingMinigameScreen.jsx      ambush minigame wrapper
    RouteMapScreen.jsx              map panel with your position dot
    ArrivalCinematic.jsx            victory cutscene
    GameOverScreen.jsx              you-lost screen
    VictoryScreen.jsx               you-won scorecard
    LeaderboardScreen.jsx           high-scores list
```

## Tech notes

- One Three.js/WebGL context (the parallax driving scene); the wave-shooter is a separate 2D canvas.
- The leaderboard is backend-first (`/api/runs`); it falls back to an in-memory buffer if the server
  is unreachable. No `localStorage`/`sessionStorage` is used.
- The Anthropic API key never ships to the browser.
- CI runs `npm run lint`, `npm test`, and `npm run build` on every PR.
- See `BUILD_SPEC.md` for the original design contract and `TASKLIST.md` for the verifiable backlog.
