# 🛻₿ Bitcoin Road Trip — BUILD SPEC (Claude Code, one-shot)

> **Kickoff prompt (paste this into Claude Code):**
> "Build the complete game described in this spec. Scaffold the Vite project, install the exact dependency versions listed, then build phase by phase in the order given. **Run `npm run build` after every phase and fix all errors before moving on.** Use the provided `gameState.js`, `route.js`, `eventEngine.js`, `AudioManager.js`, and storage helpers verbatim — they are the contracts the rest of the code depends on. Keep `DEV_MODE = true` so the game is fully playable without an API key. When done, run `npm run build`, confirm zero errors, and tell me the dev command to run it."

This is a single-page browser game: a beat-up SUV drives from Los Angeles to San Salvador. Cash inflates, BTC appreciates, Claude generates events shown as newspaper cards, and a 2D wave-shooter defends your stack at dangerous stops.

---

## 0. Setup (exact)

```bash
npm create vite@latest bitcoin-road-trip -- --template react
cd bitcoin-road-trip
npm install three@0.167.0 @anthropic-ai/sdk@0.27.0
npm install
```

**`package.json`** dependencies must be:
```json
"dependencies": {
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "three": "0.167.0",
  "@anthropic-ai/sdk": "0.27.0"
}
```

**`vercel.json`** (project root):
```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

**`.env.example`**:
```
VITE_ANTHROPIC_API_KEY=your_key_here
```

**`index.html`** `<head>`: add Google Fonts —
`Bebas Neue` (titles/HUD), `Inconsolata` (numbers), `Playfair Display` (newspaper headlines).

---

## 1. State contract — `src/game/gameState.js` (use verbatim)

Every module reads/writes this single mutable object. React syncs by polling it.

```js
export const DEV_MODE = true; // true = no API key needed, uses mock events

export const CONFIG = {
  TOTAL_MILES: 2800,
  MILES_PER_SECOND: 3.5,        // base travel speed
  START_CASH: 800,
  START_BTC: 0.05,
  START_BTC_PRICE: 64000,
  PP_DECAY_PER_TICK: 0.99985,   // purchasing-power multiplier each tick (~0.5%/day feel)
  EVENT_MIN_MS: 45000,
  EVENT_MAX_MS: 90000,
};

export const gameState = {
  screen: 'start',     // 'start' | 'playing' | 'gameover' | 'arrival' | 'victory'
  paused: false,
  playerName: '',
  difficulty: 'road_warrior', // 'tourist' | 'road_warrior' | 'satoshi'

  miles: 0,
  days: 0,
  currentCity: 'Los Angeles',
  currentCountry: 'USA',
  biome: 'california',
  timeOfDay: 0,        // 0..1, drives day/night

  gas: 100,
  suvHealth: 100,
  vibes: 5,
  cash: 800,
  btc: 0.05,

  btcPrice: 64000,
  btcPriceHistory: [64000], // last 60 values, for sparkline
  purchasingPower: 100,     // 100 -> shrinks toward 1

  recentEventTitles: [],
  lastStopIndex: -1,
  enemiesDefeated: 0,
  eventsSurvived: 0,
  gameoverReason: '',
};

export function resetGame(name, difficulty) {
  const mult = difficulty === 'satoshi' ? 0.5 : difficulty === 'tourist' ? 1.5 : 1;
  Object.assign(gameState, {
    screen: 'playing', paused: false, playerName: name, difficulty,
    miles: 0, days: 0, currentCity: 'Los Angeles', currentCountry: 'USA',
    biome: 'california', timeOfDay: 0,
    gas: 100, suvHealth: 100, vibes: 5,
    cash: Math.round(CONFIG.START_CASH * mult), btc: CONFIG.START_BTC,
    btcPrice: CONFIG.START_BTC_PRICE, btcPriceHistory: [CONFIG.START_BTC_PRICE],
    purchasingPower: 100, recentEventTitles: [], lastStopIndex: -1,
    enemiesDefeated: 0, eventsSurvived: 0, gameoverReason: '',
  });
}

export function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export function applyEffects(e) {
  if (!e) return;
  gameState.gas = clamp(gameState.gas + (e.gas||0), 0, 100);
  gameState.suvHealth = clamp(gameState.suvHealth + (e.suvHealth||0), 0, 100);
  gameState.vibes = clamp(gameState.vibes + (e.vibes||0), 0, 5);
  gameState.cash = clamp(gameState.cash + (e.cash||0), 0, 99999);
  gameState.btc = clamp(gameState.btc + (e.btc||0), 0, 99);
  gameState.purchasingPower = clamp(gameState.purchasingPower + (e.purchasingPower||0), 1, 100);
}

// call once per animation frame with delta seconds
export function tick(dt) {
  if (gameState.paused || gameState.screen !== 'playing') return;
  gameState.miles = clamp(gameState.miles + CONFIG.MILES_PER_SECOND * dt, 0, CONFIG.TOTAL_MILES);
  gameState.gas = clamp(gameState.gas - 1.2 * dt, 0, 100);
  gameState.timeOfDay = (gameState.timeOfDay + dt / 120) % 1; // 2-min day
  gameState.days = Math.floor(gameState.miles / 40);
  gameState.purchasingPower = clamp(gameState.purchasingPower * Math.pow(CONFIG.PP_DECAY_PER_TICK, dt*60), 1, 100);

  // BTC random walk, upward drift, ~once per simulated day
  if (Math.random() < dt * 0.5) {
    gameState.btcPrice = Math.max(1000, Math.round(gameState.btcPrice + (Math.random() - 0.46) * 1800));
    gameState.btcPriceHistory.push(gameState.btcPrice);
    if (gameState.btcPriceHistory.length > 60) gameState.btcPriceHistory.shift();
  }

  // loss conditions
  if (gameState.gas <= 0)        endGame('Ran out of gas in the middle of nowhere.');
  if (gameState.suvHealth <= 0)  endGame('The SUV finally died. No way forward.');
  if (gameState.vibes <= 0)      endGame('The crew lost faith and flew home.');
}

export function endGame(reason) {
  gameState.gameoverReason = reason;
  gameState.screen = 'gameover';
}
```

---

## 2. Route data — `src/data/route.js` (use verbatim, real geography)

`svgX/svgY` map to an SVG `viewBox="0 0 300 600"`. Coordinates derived from real lat/lng.

```js
export const ROUTE = [
  { name: 'Los Angeles',   country: 'USA',         flag: '🇺🇸', mile: 0,    svgX: 20,  svgY: 20,  biome: 'california', isBorder: false, dangerous: false,
    flavor: 'The journey begins. Tank full, BTC cold, El Salvador 2,800 miles south.' },
  { name: 'Tijuana',       country: 'Mexico',      flag: '🇲🇽', mile: 130,  svgX: 30,  svgY: 62,  biome: 'baja', isBorder: true,  dangerous: false,
    flavor: 'The border crossing took 3 hours. A man sold you a churro. Worth it.' },
  { name: 'Hermosillo',    country: 'Mexico',      flag: '🇲🇽', mile: 490,  svgX: 81,  svgY: 157, biome: 'sonora', isBorder: false, dangerous: false,
    flavor: "It's 108°F. The SUV is not happy. Neither are you." },
  { name: 'Mexico City',   country: 'Mexico',      flag: '🇲🇽', mile: 1270, svgX: 180, svgY: 421, biome: 'central_mx', isBorder: false, dangerous: false,
    flavor: '20 million people and the best tacos of your life. Also, a flat tire.' },
  { name: 'Oaxaca',        country: 'Mexico',      flag: '🇲🇽', mile: 1520, svgX: 200, svgY: 486, biome: 's_mexico', isBorder: false, dangerous: false,
    flavor: 'Mezcal, markets, murals. You consider never leaving.' },
  { name: 'Guatemala City',country: 'Guatemala',   flag: '🇬🇹', mile: 1870, svgX: 252, svgY: 553, biome: 'guatemala', isBorder: true,  dangerous: false,
    flavor: 'New passport stamp. The volcano on the horizon is technically active.' },
  { name: 'Tegucigalpa',   country: 'Honduras',    flag: '🇭🇳', mile: 2120, svgX: 280, svgY: 568, biome: 'honduras', isBorder: false, dangerous: true,
    flavor: 'The roughest leg. Keep your eyes open and your wallet hidden.' },
  { name: 'San Salvador',  country: 'El Salvador', flag: '🇸🇻', mile: 2800, svgX: 263, svgY: 579, biome: 'el_salvador', isBorder: false, dangerous: false,
    flavor: 'You made it. Bitcoin ATMs on every corner. The beach is 45 minutes away.' },
];

export const BIOMES = {
  california:  { mid: '#c9a66b', sky: '#7ec8e3', prop: 'sign' },
  baja:        { mid: '#e0913f', sky: '#f2c14e', prop: 'cactus' },
  sonora:      { mid: '#c1572e', sky: '#e8a04a', prop: 'cactus' },
  central_mx:  { mid: '#7a9b6e', sky: '#9bb0bd', prop: 'building' },
  s_mexico:    { mid: '#2f7d4f', sky: '#a7c4a0', prop: 'tree' },
  guatemala:   { mid: '#2a5d3a', sky: '#8a9aa3', prop: 'volcano' },
  honduras:    { mid: '#327a4d', sky: '#88b9a0', prop: 'palm' },
  el_salvador: { mid: '#3a9b6a', sky: '#f2b65a', prop: 'palm' },
};
```

---

## 3. AI events — `src/ai/eventEngine.js` (contract + mock)

`getEvent()` returns the same JSON shape whether from the API or the mock. Mock keeps the game fully playable with no key.

```js
import Anthropic from '@anthropic-ai/sdk';
import { DEV_MODE, gameState } from '../game/gameState.js';

const MOCK_EVENTS = [
  { headline: 'Radiator Blows in the Desert', dateline: 'HERMOSILLO HERALD — Day X',
    description: 'Steam erupts from the hood at 108°F. A mechanic two miles back will help — for a price.',
    canFight: false,
    choices: [
      { label: 'Pay the mechanic', consequence: 'Fixed, but it cost you.', effects: { cash: -120, suvHealth: 30 } },
      { label: 'Patch it yourself', consequence: 'Holds for now. Barely.', effects: { suvHealth: 12, vibes: -1 } },
    ] },
  { headline: 'Bitcoin Hits New All-Time High', dateline: 'CRYPTO WIRE — Day X',
    description: 'Your phone buzzes nonstop. The stack you almost sold in Tijuana is now worth a lot more.',
    canFight: false,
    choices: [
      { label: 'HODL and keep driving', consequence: 'Diamond hands intact.', effects: { vibes: 1, purchasingPower: 0 } },
      { label: 'Celebrate with tacos', consequence: 'Morale up, wallet down.', effects: { cash: -30, vibes: 1 } },
    ] },
  { headline: 'Bandits Block the Road', dateline: 'ROADSIDE REPORT — Day X',
    description: 'Three figures step into the highway ahead, eyeing your plates. No way around them.',
    canFight: true,
    choices: [
      { label: 'Pay them off', consequence: 'They let you pass.', effects: { cash: -150 } },
      { label: 'Turn back and detour', consequence: 'Safe, but slow and thirsty.', effects: { gas: -20, vibes: -1 } },
    ] },
  { headline: 'The Fed Prints Again', dateline: 'FINANCIAL TIMES — Day X',
    description: 'Another multi-trillion stimulus. Every dollar in your pocket just quietly lost value.',
    canFight: false,
    choices: [
      { label: 'Shrug and drive on', consequence: 'Your cash buys less now.', effects: { purchasingPower: -4 } },
      { label: 'Stack more sats later', consequence: 'A plan, at least.', effects: { vibes: 1, purchasingPower: -2 } },
    ] },
];

export async function getEvent() {
  if (DEV_MODE) {
    const pool = MOCK_EVENTS.filter(e => !gameState.recentEventTitles.includes(e.headline));
    const e = (pool.length ? pool : MOCK_EVENTS)[Math.floor(Math.random() * (pool.length || MOCK_EVENTS.length))];
    return { ...e, dateline: e.dateline.replace('Day X', `Day ${gameState.days}`) };
  }
  try {
    const client = new Anthropic({ apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY, dangerouslyAllowBrowser: true });
    // TODO production: move this call behind a Vercel serverless fn at /api/event to hide the key
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: buildPrompt() }],
    });
    const text = msg.content.map(b => b.text || '').join('').replace(/```json|```/g, '').trim();
    return JSON.parse(text);
  } catch (err) {
    console.error('Event API failed, using mock:', err);
    return MOCK_EVENTS[Math.floor(Math.random() * MOCK_EVENTS.length)];
  }
}

function buildPrompt() {
  const s = gameState;
  return `You are the narrator for "Bitcoin Road Trip", a road trip game from LA to El Salvador.
Game state:
- Location: ${s.currentCity}, ${s.currentCountry} | Miles: ${Math.round(s.miles)}/2800
- Gas ${Math.round(s.gas)}% | SUV ${Math.round(s.suvHealth)}% | Vibes ${s.vibes}/5
- Cash $${Math.round(s.cash)} (purchasing power ${Math.round(s.purchasingPower)}%) | BTC ${s.btc} at $${s.btcPrice}
- Recent events (don't repeat): ${s.recentEventTitles.join(', ') || 'none'}

Return ONLY valid JSON:
{"headline":"<=8 words","dateline":"CITY DAILY — Day ${s.days}","description":"2-3 sentences, grounded in the real region, funny/tense/human","canFight":false,
"choices":[{"label":"<=8 words","consequence":"1 sentence","effects":{"gas":0,"cash":-60,"btc":0,"suvHealth":-10,"vibes":1,"purchasingPower":0}},
{"label":"<=8 words","consequence":"1 sentence","effects":{"gas":-15,"cash":0,"btc":0,"suvHealth":0,"vibes":-1,"purchasingPower":0}}]}
Rules: canFight:true only for physical threats (bandits/checkpoint/ambush) and adds a "Stand your ground" option client-side.
Tailor to region (Baja desert, Oaxaca culture, Guatemala volcanic). Some events reference hard money (rising prices, peso crash, vendors preferring BTC).
Cash effects $20-200, BTC 0.001-0.01, purchasingPower -5 to +3. Never drain >25% of a resource.`;
}
```

---

## 4. Sound — `src/game/AudioManager.js` (skeleton, no files)

```js
export class AudioManager {
  constructor() { this.ctx = null; this.engine = null; this.on = true; }
  init() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } // call on first user click
  startEngine() {
    if (!this.ctx || this.engine) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = 60; g.gain.value = 0.04;
    o.connect(g).connect(this.ctx.destination); o.start(); this.engine = { o, g };
  }
  stopEngine() { if (this.engine) { this.engine.o.stop(); this.engine = null; } }
  ping(freq = 880) { this._blip(freq, 'sine', 0.12, 0.12); }      // BTC up
  alarm() { this._blip(180, 'square', 0.25, 0.3); }                // resource low
  gunshot() { this._noise(0.08); }                                 // shooter
  cheer() { this._sweep(300, 900, 0.4); }                          // wave cleared
  fanfare() { [523,659,784,1047].forEach((f,i)=>setTimeout(()=>this.ping(f),i*160)); } // arrival
  _blip(freq, type, dur, vol) {
    if (!this.ctx || !this.on) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq; g.gain.value = vol;
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g).connect(this.ctx.destination); o.start(); o.stop(this.ctx.currentTime + dur);
  }
  _noise(dur) {
    if (!this.ctx || !this.on) return;
    const n = this.ctx.sampleRate * dur, buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = buf.getChannelData(0);
    for (let i=0;i<n;i++) d[i] = (Math.random()*2-1) * (1 - i/n);
    const src = this.ctx.createBufferSource(); src.buffer = buf; src.connect(this.ctx.destination); src.start();
  }
  _sweep(f0, f1, dur) {
    if (!this.ctx || !this.on) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.frequency.setValueAtTime(f0, this.ctx.currentTime);
    o.frequency.linearRampToValueAtTime(f1, this.ctx.currentTime + dur);
    g.gain.value = 0.1; g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g).connect(this.ctx.destination); o.start(); o.stop(this.ctx.currentTime + dur);
  }
}
export const audio = new AudioManager();
```

Call `audio.init()` on the Start Screen's first click (browsers require a user gesture).

---

## 5. Leaderboard — `src/game/leaderboard.js` (artifact storage helpers)

```js
export async function saveRun() {
  try {
    const { gameState } = await import('./gameState.js');
    await window.storage.set(`run:${Date.now()}`, JSON.stringify({
      name: gameState.playerName || 'Anon',
      btc: gameState.btc,
      btcValue: Math.round(gameState.btc * gameState.btcPrice),
      pp: Math.round(gameState.purchasingPower),
      days: gameState.days,
    }), true); // shared = visible to all players
  } catch (e) { console.warn('leaderboard save failed', e); }
}
export async function topRuns(n = 10) {
  try {
    const list = await window.storage.list('run:', true);
    const runs = [];
    for (const k of (list?.keys || [])) {
      try { const r = await window.storage.get(k, true); if (r) runs.push(JSON.parse(r.value)); } catch {}
    }
    return runs.sort((a,b)=>b.btcValue-a.btcValue).slice(0, n);
  } catch (e) { console.warn('leaderboard read failed', e); return []; }
}
```
> Note: `window.storage` exists only when the app runs as a Claude artifact. Guard every call in try/catch (done above) so the game still runs on Vercel, where the leaderboard simply shows empty.

---

## 6. Visuals & feel (concrete values)

**Driving scene (`ParallaxScene.js`, Three.js):** orthographic-ish side feel using 3 planes:
- background plane (sky gradient + low mountains) scrolls at 0.2×
- mid plane (terrain, color = `BIOMES[biome].mid`) at 0.6×, scatter biome props
- foreground road plane (dark grey + dashed yellow centerline) at 1.0×; SUV sits here, centered, x slightly left
- camera fixed; scroll offset = `gameState.miles`. Lerp `mid`/`sky` colors over ~3s when `biome` changes.
- day/night: tint scene + fade in stars when `timeOfDay` in 0.75–1.0 / 0–0.1; SUV headlights (two PointLights) on at night.

**SUV (`SUV.js`):** tall boxy `BoxGeometry` body in faded olive/beige with rust-patch vertex tint, roof rack box + 2 luggage lumps, 4 fat `CylinderGeometry` wheels (spin with miles), dented front bumper (offset+rotated), semi-opaque cracked-windshield plane, rear exhaust cylinder.

**Color tokens (CSS vars):** `--bg:#1a1411; --paper:#f5e6ca; --btc:#f7931a; --cash:#4a7c59; --danger:#c0392b; --ink:#2b2b2b`.

**Fonts:** Bebas Neue (HUD/titles), Inconsolata (numbers/data), Playfair Display (newspaper headlines).

**HUD:**
- top-left: ⛽ gas bar, 🛻 SUV bar, 😎 vibes icons (×5)
- top-right HARD-MONEY WIDGET (the centerpiece): two columns — `💵 $START → $NOW` with shrinking red bar (NOW = `cash × pp/100`) vs `₿ btc → $value` with green ▲% since start; plus an 80px `<canvas>` sparkline of `btcPriceHistory`
- bottom: progress bar `LA ████░░ miles/2800 — currentCity`, 📍 map toggle

**EventCard (`EventCard.jsx`):** torn-top paper card (SVG clip-path), slight rotation, drop shadow, Playfair headline + Inconsolata dateline + body, choice buttons. If event `isBorder`, show 🛂 corner banner + a 1.5s "Waiting at the border…" bar before revealing choices. If `canFight`, append a third red "Stand your ground" button that opens the WaveShooter instead of applying effects.

**WaveShooter (`WaveShooter.js`, 2D `<canvas>` overlay, z-index 1000):**
- biome-colored backdrop drawn once; enemies walk from top toward bottom; click/tap = shoot (bbox hit)
- enemy types: Bandit (red, drops $50–150 cash on breach), Gov Agent (grey, 0.005–0.01 BTC), Hacker (cyan, 0.003–0.008 BTC), Central Banker (blue, 5 hits, +5 pp when killed)
- ammo = `vibes × 3`; waves of 3–5, each faster; win = clear all or survive 60s; breach = lose that type's amount; Esc = flee (−1 vibe)
- hit: flash white + knockback; death: shrink to 0 over 300ms + particle burst; crosshair cursor; top strip shows ammo/wave/timer; on win `audio.cheer()`, each shot `audio.gunshot()`.

**ArrivalSequence:** 3s, fade to black → ₿ logo rises glowing → orange/gold confetti (canvas particles) → "DEPLOYED TO PRODUCTION" letter-by-letter → subtitle "El Salvador — Day X" → `audio.fanfare()` → Victory.

---

## 7. Game flow & wiring

- `App.jsx`: mounts the Three.js `<canvas>`; runs one `requestAnimationFrame` loop calling `tick(dt)` and `parallax.update()`; a `setInterval(()=>forceRender(), 100)` syncs React from `gameState`. Renders the screen for `gameState.screen`.
- City stops: in the loop, when `miles` crosses the next `ROUTE[i].mile` and `i > lastStopIndex`, set `lastStopIndex=i`, update `currentCity/country/biome`, `paused=true`, open `CityStop`. Dangerous stop (Tegucigalpa) opens WaveShooter on continue.
- Random events: timer between `EVENT_MIN_MS`–`EVENT_MAX_MS`; on fire, `paused=true`, `getEvent()`, show `EventCard`; on choice `applyEffects`, push headline to `recentEventTitles` (cap 10), `eventsSurvived++`, `paused=false`.
- Border stops (Tijuana, Guatemala City) are `isBorder` city stops with the 🛂 wait UI.
- Victory: when `miles >= 2800` → `screen='arrival'` → after sequence `screen='victory'` + `saveRun()`.
- City-stop prices inflate: `price = Math.round(base / (purchasingPower/100))`. Bases: refuel $40, repair $80, rest free (−time, +1 vibe).

---

## 8. Build phases — run `npm run build` after EACH, fix errors before continuing

**Phase A — Playable core (must reach this):**
1. Scaffold + deps + `index.html` fonts + CSS vars + `vercel.json`
2. `gameState.js`, `route.js` (verbatim)
3. `ParallaxScene.js` + `SUV.js`; SUV drives, biomes change, day/night works
4. `App.jsx` loop + React sync; `StartScreen` (name + difficulty) → `resetGame` → playing
5. `HUD` with hard-money widget + sparkline + progress bar
6. `CityStop` modal at all 7 stops with inflated prices
7. `eventEngine.js` (verbatim, DEV_MODE) + `EventCard` (newspaper) wired to the event timer
8. `GameOver` + `Victory` screens
✅ At end of Phase A the game is fully winnable/losable with zero API key.

**Phase B — Signature features:**
9. `WaveShooter.js` + modal; `canFight` events + Tegucigalpa trigger
10. `RouteMap` SVG panel with pulsing position dot
11. `ArrivalSequence` cinematic before Victory

**Phase C — Polish (only if build is clean & time remains):**
12. `AudioManager` wired (engine hum, ping on BTC up, alarm <20%, gunshot, cheer, fanfare)
13. `leaderboard.js` + `Leaderboard` component on Start & Victory
14. Biome color lerp, dust/mist particles, share button on Victory

---

## 9. Definition of done (acceptance criteria)

- `npm run build` completes with **zero errors**
- `npm run dev` launches a playable game with **no API key set** (DEV_MODE mock events)
- You can start a run, watch cash purchasing power shrink while BTC value grows, hit city stops, get newspaper events, fight at least one wave-shooter encounter, and reach either Game Over or the El Salvador arrival + Victory
- No use of `localStorage`/`sessionStorage` anywhere; leaderboard uses `window.storage` guarded in try/catch
- Only one Three.js WebGL context (the driving scene); the shooter is a separate 2D canvas
- Final message to the user: the exact `npm run dev` command and a one-line note that setting `VITE_ANTHROPIC_API_KEY` + flipping `DEV_MODE=false` enables live AI events

---

## 10. Pitfalls to avoid (these break one-shot builds)

- **Don't** create a second Three.js/WebGL scene for the shooter — use a 2D `<canvas>`.
- **Don't** use `localStorage`/`sessionStorage` — artifacts block them; use `window.storage` (guarded) or in-memory React state.
- **Don't** block gameplay on the API — `DEV_MODE` must yield instant mock events; live calls fall back to mock on error.
- **Don't** call `new AudioContext()` before a user gesture — init audio on first Start-screen click.
- **Don't** put player data in URLs; no forms posting anywhere external.
- **Keep** the `gameState` shape exactly as given so all modules agree on field names (`suvHealth`, `purchasingPower`, etc.).
- If running low on budget, **stop at the end of Phase A**, ensure it builds and plays, and report what's left — a clean playable core beats a broken full build.
