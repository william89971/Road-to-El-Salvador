# 🚀 Road to El Salvador - Production Upgrade & Polishing Backlog

This document serves as the single source of truth for the autonomous engineering agent loop to refactor the game from a prototype into a production-ready, high-performance release.

---

## 🏗️ 1. Core Architecture & Memory Optimization
*Goal: Ensure the game runs at a locked 60 FPS, passes automated rules testing, and consumes zero residual memory.*

- [ ] **Implement Strict Memory Disposal Lifecycle**
  - **Requirement:** Create an asset cleanup utility function. Every Three.js `Geometry`, `Material`, and `Texture` must be explicitly de-allocated from WebGL memory on game over or reset.
  - **Verification:** No memory footprint growth or tab-crashing after 5 consecutive "Game Over -> Restart" loops.
- [ ] **Monolith Refactoring (`gameStateAndRules.js`)**
  - **Requirement:** Decouple state management into single-responsibility ES6 modules:
    - `Engine.js`: Controls the core 60 FPS Three.js rendering loops and graphics optimization for older computers.
    - `State.js`: Manages standard parameters (current score, vehicle fuel, game status).
    - `Economy.js`: Dedicated mathematics module governing Bitcoin price fluctuations and inflation calculations.
- [ ] **Add Core Unit Tests**
  - **Requirement:** Implement a lightweight testing suite to validate the math inside `Economy.js` (ensuring inflation hooks and BTC price tracking calculate reliably under extreme values).

---

## 📱 2. Cross-Platform Responsiveness & Input Handling
*Goal: Flawless gameplay UI and rendering performance across mobile, tablet, and desktop viewports.*

- [ ] **Dynamic WebGL Canvas Resizing Hook**
  - **Requirement:** Listen to canvas wrapper dimension shifts. Update camera aspects and renderer sizing cleanly without stretching or artifact distortions on iPhone, iPad, and laptop screens.
- [ ] **Unified Multi-Device Overlay UI**
  - **Requirement:** Build a CSS Flexbox/Grid overlay for HUD items (Score, Fuel gauge, and BTC value markers). Ensure click/tap targets on mobile have a minimum interactive surface area of 44x44px.

---

## 🔊 3. Audio Engineering & UI/UX Polish
*Goal: Provide deep sensory feedback loops for critical player actions.*

- [ ] **Centralized Web Audio / Three.js Audio Manager**
  - **Requirement:** Build a manager that controls master volumes and handles overlapping audio threads cleanly.
  - **Asset Mapping Requirements:**
    - `engine_hum.mp3`: Positional or ambient looping track (faded down dynamically on pause).
    - `crash.wav` / `refuel.wav` / `btc_collect.wav`: Discrete trigger playbacks with basic gain nodes to prevent audio clipping.
- [ ] **Micro-Animations & Visual State Feedback**
  - **Requirement:** Add interactive UI feedback: hover effects, CSS transitions, and click feedback for all functional buttons. Add a micro-animation (e.g., green up-arrows or red down-arrows) to the UI overlay triggered instantly upon Bitcoin value changes.

---

## 💾 4. Leaderboard Data Persistence Layer
*Goal: Replace volatile internal browser storage with a secure, server-authoritative leaderboard backend.*

- [ ] **Network Abstract Module (`LeaderboardService.js`)**
  - **Requirement:** Completely strip out the legacy `window.storage` / `window.localStorage` dependencies so it works reliably across standard modern browsers.
- [ ] **Backend Score Synchronization**
  - **Requirement:** Implement asynchronous `fetch()` operations targeting a companion Node.js/Express backend server to permanently save and retrieve high scores online.
  - **Data Structure Requirement:**
    ```json
    {
      "playerName": "string",
      "score": "integer",
      "timestamp": "ISO-8601-string"
    }
    ```

---

## 🛑 5. Game State Overlays & Onboarding
*Goal: Increase player retention with clear instructions and tight system control.*

- [ ] **Asset Preloading Phase**
  - **Requirement:** Wrap all asset loading processes inside a `THREE.LoadingManager()`. Display a smooth percentage-based progress bar screen to block interactions until 3D assets reside safely in memory.
- [ ] **State-Driven System Menus**
  - **Requirement:** Introduce distinct, overlay-driven screens:
    - **Pause Menu:** Suspends game time matrices, cuts vehicle translation rules, lowers volume, and provides 'Resume/Restart' prompts.
    - **How To Play Menu:** Visual panel accessible from the main interface outlining movement, refueling mechanics, and methods to defend BTC.
