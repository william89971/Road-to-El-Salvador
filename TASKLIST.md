# 🛻₿ Road to El Salvador — Verifiable Backlog

> **This file is the loop's memory and contract.** It is read at the start of every iteration.
> Every "Ready" task is sized for **one** iteration and carries an explicit, machine-checkable
> **Done when** check. A task may be marked `[x]` **only** when its Done-when check passes *and*
> the Definition of Done below holds. If you cannot make the check pass, mark it `[!]` with a
> one-line reason and move on — **never** check off a task you did not actually verify, and
> **never** write a commit message that claims more than the diff does. (See the PBR incident:
> a commit claimed "all assets have normal/roughness/metalness maps" while changing 8 lines and
> adding zero maps. That is the exact failure this format exists to prevent.)

## Definition of Done — applies to EVERY task
1. `npm run build` completes with **no new** warnings (baseline below).
2. `npm test` passes; any test the task adds also passes.
3. `npm run lint` exits **0** with no errors or warnings. *(Check the real exit code, not a piped one.)*
4. The commit message describes **only** what the diff actually does. No claim the diff doesn't substantiate.
5. The task's own **Done when** check passes.

**Known build baseline (do not blame these on your task):**
- `(!) Some chunks are larger than 500 kB` — pre-existing; only B3 may touch it.

---

## Ready — loop-able, one iteration each

- [x] **A1 · Make `npm run lint` pass cleanly.** ✅ Verified: `npm run lint` exits 0, no errors/warnings; 50/50 tests pass; no new build warnings.
  The gate itself was red: `process is not defined` in `server/index.js`, plus two unused-`before` warnings in the test file. Fixed by giving `server/` Node globals in the eslint config and deleting the two dead variables.
  - Files: `eslint.config.js`, `src/game-engine/__tests__/gameRules.test.js`
  - Done when: `npm run lint` exits `0` with zero errors and zero warnings.

- [x] **A2 · Restore the trailing newline in `drivingScene3D.js`.** ✅ Fixed by hand.
  The PBR commit stripped the final newline (`\ No newline at end of file`).
  *Lesson: invisible-whitespace / EOF tasks are a poor fit for an LLM loop (it must reproduce the whole region exactly for a one-byte change). These belong to a formatter (e.g. Prettier) or a human — don't feed them to the loop.*
  - Files: `src/game-engine/drivingScene3D.js`
  - Done when: `tail -c1 src/game-engine/drivingScene3D.js | od -An -c` shows `\n`; build still passes.

- [x] **A3 · Remove the mixed static/dynamic import of `gameStateAndRules.js`.**
  `leaderboardStorage.js` does `await import('./gameStateAndRules.js')` while every other file imports it statically, which triggers a Vite warning and prevents clean chunking. Import `gameState` statically from `./gameState.js` instead.
  - Files: `src/game-engine/leaderboardStorage.js`
  - Done when: `npm run build` output contains no `dynamically imported ... but also statically imported` warning.

- [x] **A4 · Re-enable pinch-zoom (accessibility).**
  The viewport meta sets `maximum-scale=1.0, user-scalable=no`, which blocks zoom — a WCAG failure.
  - Files: `index.html`
  - Done when: `grep -c 'user-scalable=no\|maximum-scale' index.html` returns `0`; build passes.

- [ ] **A5 · Unit-test `resetGame` difficulty multipliers.**
  Starting cash should scale: tourist ×1.5, road_warrior ×1, satoshi ×0.5.
  - Files: new test under `src/game-engine/__tests__/`
  - Done when: a test asserts all three multipliers off the loadout's base cash; `npm test` passes with a higher test count than before.

- [ ] **A6 · Unit-test the leaderboard localStorage fallback.**
  `topRuns(n)` should return entries sorted by `btcValue` descending and respect the `n` limit when the backend is unreachable.
  - Files: new test under `src/game-engine/__tests__/` (stub `localStorage` and `fetch`)
  - Done when: a test seeds 3 fake runs, asserts descending order and that `topRuns(2)` returns 2; `npm test` passes.

- [ ] **A7 · Unit-test event de-duplication in DEV_MODE.**
  `getEvent()` must not return a headline already in `gameState.recentEventTitles` when an unused alternative exists.
  - Files: new test under `src/game-engine/__tests__/`
  - Done when: a test fills `recentEventTitles` with all-but-one headline and asserts the remaining one is returned; `npm test` passes.

- [x] **A8 · Make the Express server testable: export `app`, listen only when run directly.**
  `server/index.js` calls `app.listen` on import, so it can't be unit-tested. Guard the listen behind the run-as-main check and `export { app }`.
  - Files: `server/index.js`
  - Done when: importing the module does not bind a port; `export { app }` exists; `npm run lint` and `npm test` still pass.

- [ ] **A9 · Validate `btcValue` in `POST /api/runs` (depends on A8).**
  Currently `Number("abc")` → `NaN` is written to `runs.json`. Reject non-finite or negative `btcValue` with HTTP 400.
  - Files: `server/index.js`, new server test
  - Done when: a test asserts `POST {btcValue:"abc"}` → 400 and a valid payload → 201; `npm test` passes.

- [x] **A10 · Encode the anti-slop rule into the agent's project instructions.**
  So the maker reads the contract every run, not just this file.
  - Files: `.codewhale/instructions.md`
  - Done when: the file states "commit messages must not claim more than the diff does" and "only check off a task when its Done-when check passes"; `grep -q 'Done-when' .codewhale/instructions.md` succeeds.

---

## Parking lot — NOT loop-ready (reclassified from the old backlog)

These need a **human** to confirm they're wanted for *this* small procedural game and to slice each
into atomic, checkable tasks before any loop touches them. Some carried false premises (flagged).

- **Post-processing (SSAO / Bloom / DoF), HDRI lighting, GPU particles, custom GLSL shaders** — large, and "looks better" is not machine-verifiable. Need a concrete, measurable target per effect (e.g. "bloom enabled on emissive tail-lights, frame time < 16 ms on the test scene").
- **KTX2 / Basis texture compression** — ⚠️ false premise: there are **zero** texture asset files; the game is procedural geometry + canvas textures. Nothing to compress yet.
- **LOD manager, InstancedMesh, Web Worker offloading** — real perf ideas, but need a profiled bottleneck first. Don't optimize blind.
- **3D spatial audio, dynamic soundtrack crossfade, audio ducking** — scope each to one sound path with an asserted gain/pan value.
- **Dynamic economy backend, state-machine AI, IndexedDB saves, server-side anti-cheat** — multi-file features; A8/A9 are the first verifiable slices of the anti-cheat one.
- **Cinematic onboarding, fluid UI animations, gamepad + accessibility** — ⚠️ false premise: the old note said "use Framer Motion **since you are using Next.js**." This project is **Vite + React**, not Next.js. A4 is the first real, checkable accessibility slice.
- **Move event generation server-side** — `eventGenerator.js` ships `@anthropic-ai/sdk` to the browser with `dangerouslyAllowBrowser: true`, exposing the key (there's already a `TODO`). Ready to slice into: (1) add `/api/event` to the Express server, (2) point the client at it, (3) drop the SDK from the client bundle.
