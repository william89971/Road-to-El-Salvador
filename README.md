# 🛻₿ Road to El Salvador — Bitcoin Road Trip

A single-page browser game: drive a beat-up SUV from **Los Angeles** to **San Salvador**.
Cash inflates, Bitcoin appreciates, Claude generates newspaper events, and a 2D wave-shooter
defends your stack at dangerous stops.

Built with **React 18**, **Three.js**, the **Web Audio API**, and the **Claude API** (optional).

![Drive](https://img.shields.io/badge/2800_miles-8_stops-f7931a)

## Run it

```bash
npm install
npm run dev
```

Then open the printed local URL (default http://localhost:5173). The game is **fully playable
with no API key** — `DEV_MODE = true` in `src/game/gameState.js` uses built-in mock events.

Other scripts:

```bash
npm run build     # production build to dist/ (zero errors)
npm run preview   # serve the production build locally
```

## Live AI events (optional)

To have **Claude** generate region-aware events instead of the mock pool:

1. Copy `.env.example` to `.env` and set `VITE_ANTHROPIC_API_KEY=sk-ant-...`
2. Set `DEV_MODE = false` in `src/game/gameState.js`

> The browser SDK call uses `dangerouslyAllowBrowser` for local dev. For production, move the
> call behind a serverless function (e.g. `/api/event` on Vercel) so the key is never shipped
> to the client.

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
  they reach the line. Ammo = vibes × 3. `Esc` to flee (−1 vibe).
- **Arrival:** reach San Salvador for the cinematic and your final scorecard.

## File guide — what each file does

Every file is named for what it contains, so you can find things by vibes.

```
index.html                          the web page shell; loads the app + Google Fonts
src/
  appEntryPoint.jsx                 boots React and mounts the game into the page
  GameController.jsx                THE BRAIN: runs the game loop, owns every screen,
                                    wires city stops / events / ambushes / win + lose
  globalStyles.css                  colors, fonts, and shared animations

  game-engine/                      the moving parts that make the game *work*
    gameStateAndRules.js            the single source of truth: all stats + the rules
                                    that change them every frame (fuel, inflation, BTC price)
    drivingScene3D.js               the 3D side-scrolling road (sky, mountains, dust,
                                    day/night) drawn with Three.js
    truckModel3D.js                 builds the beat-up SUV 3D model (body, wheels, headlights)
    shootingMinigame.js             the 2D click-to-shoot ambush minigame (enemies, waves, ammo)
    soundEffects.js                 every sound, made in code (engine hum, pings, gunshots…)
    leaderboardStorage.js           saves and loads high scores

  events/
    eventGenerator.js               makes the newspaper events — mock ones, or live from Claude

  map-data/
    citiesAndRoute.js               the 8 cities (LA → San Salvador) + each region's colors

  screens/                          everything you SEE (full screens + HUD overlays)
    StartScreen.jsx                 name + difficulty pick
    HeadsUpDisplay.jsx              the in-game HUD (fuel/health/vibes + hard-money widget)
    BitcoinPriceSparkline.jsx       the little BTC price chart inside the HUD
    CityStopShop.jsx                the refuel / repair / rest shop at each city
    NewspaperEventCard.jsx          the torn-paper newspaper event popup
    ShootingMinigameScreen.jsx      the wrapper that shows the ambush minigame
    RouteMapScreen.jsx              the map panel with your position dot
    ArrivalCinematic.jsx            the "DEPLOYED TO PRODUCTION" victory cutscene
    GameOverScreen.jsx              the you-lost screen
    VictoryScreen.jsx               the you-won scorecard
    LeaderboardScreen.jsx           the high-scores list
```

## Tech notes

- One Three.js/WebGL context (the parallax driving scene); the wave-shooter is a separate 2D canvas.
- No `localStorage`/`sessionStorage`. The shared leaderboard uses `window.storage` (only present
  when the game runs as a Claude artifact) and is fully guarded, so it simply shows empty elsewhere.
- See `BUILD_SPEC.md` for the full design contract.
