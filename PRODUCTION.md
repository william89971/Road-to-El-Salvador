# Production Readiness Notes

This document tracks the production-hardening work applied to Road to El Salvador.

## Definition of Done (all passing)

- [x] `npm run build` completes with zero errors and no new warnings.
- [x] `npm test` passes (97 tests across 12 files).
- [x] `npm run test:coverage` reports **89.67% line coverage** (target: ≥80%).
- [x] `npm run lint` exits 0.
- [x] The game runs via `npm run dev` with no API key (mock events work).
- [x] End-to-end playable: start → drive → city stops → events → ambush → arrival/victory or game over.
- [x] Mobile touch controls work (tap-to-shoot, on-screen FLEE button).
- [x] API key never ships to the browser.
- [x] No unguarded `localStorage`/`sessionStorage` usage.
- [x] Deployment path documented (Vercel + `/api/*` serverless function).

## Milestone 1 — Safety & Backend

- Moved AI event generation to `POST /api/event` in `server/index.js`.
- Removed `@anthropic-ai/sdk` from the client bundle.
- Added `helmet`, configured CORS, `express-rate-limit`, and sanitized request logging.
- Hardened `POST /api/runs` validation for all fields.
- Added `/api/metrics` endpoint.
- Replaced `localStorage` in `leaderboardStorage.js` with an in-memory fallback.
- Added React error boundary + WebGL fallback + global `window.onerror` handler.
- Added server tests for `/api/event`, `/api/metrics`, and extended `/api/runs` validation tests.

## Milestone 2 — State Architecture & Coverage

- Added `src/game-engine/gameActions.js` with explicit action functions for all state mutations.
- Refactored `GameController.jsx`, `CityStopShop.jsx`, and `shootingMinigame.js` to use actions.
- Extracted the rAF loop into `src/game-engine/gameLoop.js`.
- Installed `@vitest/coverage-v8` and added `npm run test:coverage`.
- Added unit tests for `gameActions.js` and `gameLoop.js`.
- Added server-path tests for `eventGenerator.js`.
- Reached 89.67% line coverage.

## Milestone 3 — UX & Deployment

- Added on-screen **FLEE** button to the ambush minigame for touch users.
- Added `touch-action: none` to shooter and global canvas.
- Added global `button:focus-visible` and `input:focus-visible` styles.
- Added `prefers-reduced-motion` media query.
- Made the hard-money HUD widget responsive (stacks columns below 420px).
- Added `public/manifest.json` for PWA support.
- Added Open Graph and Apple mobile-web-app meta tags in `index.html`.
- Created `api/index.js` as the Vercel serverless entrypoint.
- Updated `vercel.json` to route `/api/*` to the serverless function.
- Added `.github/workflows/ci.yml` for lint/test/build on PRs.
- Rewrote `README.md` with run, server, and deploy instructions.
- Updated `.env.example` to list only server-side variables.

## Known limitations / future work

- The bundle is still ~710 KB; chunk splitting could reduce initial load.
- No service worker or offline support yet.
- No analytics or share-image generation yet.
- The in-memory leaderboard fallback does not persist across page reloads.
