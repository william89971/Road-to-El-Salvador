// Express backend for persistent leaderboard scores and AI-generated events.
// Stores runs in a JSON file so scores survive server restarts.
// Start with: node index.js (or npm start from the server/ directory)

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Data-file path, overridable via RUNS_FILE so tests can write to a temp file.
const dataFile = () => process.env.RUNS_FILE || join(__dirname, 'runs.json');
const PORT = process.env.PORT || 3001;

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const anthropic = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;

function loadRuns() {
  const f = dataFile();
  try {
    if (existsSync(f)) return JSON.parse(readFileSync(f, 'utf-8'));
  } catch { /* corrupt file — start fresh */ }
  return [];
}

function saveRuns(runs) {
  // keep at most 500 entries to prevent unbounded growth
  const trimmed = runs.slice(0, 500);
  writeFileSync(dataFile(), JSON.stringify(trimmed, null, 2), 'utf-8');
}

const app = express();

// Security headers
app.use(helmet());

// CORS: allow localhost in dev; restrict to configured origin in production
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : ['http://localhost:5173', 'http://localhost:3000'];
app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no origin (mobile apps, curl, same-origin)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS blocked origin: ${origin}`));
  },
}));

app.use(express.json({ limit: '64kb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Logging middleware (sanitized — never log API keys or bodies)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} - ${ms}ms`);
  });
  next();
});

// GET /api/health — standard health check for uptime monitoring
app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// GET /api/metrics — basic operational metrics
app.get('/api/metrics', (_req, res) => {
  const runs = loadRuns();
  res.json({ ok: true, runCount: runs.length });
});

// GET /api/runs — return top N runs sorted by btcValue desc
app.get('/api/runs', (_req, res) => {
  const runs = loadRuns();
  const n = Math.min(parseInt(_req.query.n) || 10, 100);
  const top = runs.sort((a, b) => b.btcValue - a.btcValue).slice(0, n);
  res.json(top);
});

// POST /api/runs — save a completed run
app.post('/api/runs', (req, res) => {
  const { name, btc, btcValue, pp, days } = req.body || {};

  if (btcValue == null) {
    return res.status(400).json({ error: 'btcValue is required' });
  }
  const value = Number(btcValue);
  if (!Number.isFinite(value) || value < 0) {
    return res.status(400).json({ error: 'btcValue must be a non-negative number' });
  }

  const btcNum = Number(btc);
  if (!Number.isFinite(btcNum) || btcNum < 0) {
    return res.status(400).json({ error: 'btc must be a non-negative number' });
  }

  const ppNum = Number(pp);
  if (!Number.isFinite(ppNum) || ppNum < 0 || ppNum > 100) {
    return res.status(400).json({ error: 'pp must be a number between 0 and 100' });
  }

  const daysNum = Number(days);
  if (!Number.isFinite(daysNum) || daysNum < 0) {
    return res.status(400).json({ error: 'days must be a non-negative number' });
  }

  const nameStr = String(name || 'Anon').trim();
  if (nameStr.length > 32) {
    return res.status(400).json({ error: 'name must be 32 characters or fewer' });
  }

  const runs = loadRuns();
  runs.push({
    name: nameStr,
    btc: btcNum,
    btcValue: Math.round(value),
    pp: Math.round(ppNum),
    days: Math.round(daysNum),
    ts: Date.now(),
  });
  saveRuns(runs);
  res.status(201).json({ ok: true });
});

// Mock event pool used as fallback when AI is unavailable or misconfigured.
const MOCK_EVENTS = [
  {
    headline: 'Radiator Blows in the Desert',
    dateline: 'HERMOSILLO HERALD',
    description: 'Steam erupts from the hood at 108°F. A mechanic two miles back will help — for a price.',
    canFight: false,
    choices: [
      { label: 'Pay the mechanic', consequence: 'Fixed, but it cost you.', effects: { cash: -120, suvHealth: 30 } },
      { label: 'Patch it yourself', consequence: 'Holds for now. Barely.', effects: { suvHealth: 12, vibes: -1 } },
    ],
  },
  {
    headline: 'Bitcoin Hits New All-Time High',
    dateline: 'CRYPTO WIRE',
    description: 'Your phone buzzes nonstop. The stack you almost sold in Tijuana is now worth a lot more.',
    canFight: false,
    choices: [
      { label: 'HODL and keep driving', consequence: 'Diamond hands intact.', effects: { vibes: 1 } },
      { label: 'Celebrate with tacos', consequence: 'Morale up, wallet down.', effects: { cash: -30, vibes: 1 } },
    ],
  },
  {
    headline: 'Bandits Block the Road',
    dateline: 'ROADSIDE REPORT',
    description: 'Three figures step into the highway ahead, eyeing your plates. No way around them.',
    canFight: true,
    choices: [
      { label: 'Pay them off', consequence: 'They let you pass.', effects: { cash: -150 } },
      { label: 'Turn back and detour', consequence: 'Safe, but slow and thirsty.', effects: { gas: -20, vibes: -1 } },
    ],
  },
  {
    headline: 'The Fed Prints Again',
    dateline: 'FINANCIAL TIMES',
    description: 'Another multi-trillion stimulus. Every dollar in your pocket just quietly lost value.',
    canFight: false,
    choices: [
      { label: 'Shrug and drive on', consequence: 'Your cash buys less now.', effects: { purchasingPower: -4 } },
      { label: 'Stack more sats later', consequence: 'A plan, at least.', effects: { vibes: 1, purchasingPower: -2 } },
    ],
  },
];

function buildEventPrompt(s) {
  return `You are the narrator for "Bitcoin Road Trip", a road trip game from LA to El Salvador.
Game state:
- Location: ${s.currentCity}, ${s.currentCountry} | Miles: ${Math.round(s.miles)}/2800
- Gas ${Math.round(s.gas)}% | SUV ${Math.round(s.suvHealth)}% | Vibes ${s.vibes}/5
- Cash $${Math.round(s.cash)} (purchasing power ${Math.round(s.purchasingPower)}%) | BTC ${s.btc} at $${s.btcPrice}
- Recent events (don't repeat): ${Array.isArray(s.recentEventTitles) ? s.recentEventTitles.join(', ') : 'none'}

Return ONLY valid JSON:
{"headline":"<=8 words","dateline":"CITY DAILY — Day ${s.days}","description":"2-3 sentences, grounded in the real region, funny/tense/human","canFight":false,
"choices":[{"label":"<=8 words","consequence":"1 sentence","effects":{"gas":0,"cash":-60,"btc":0,"suvHealth":-10,"vibes":1,"purchasingPower":0}},
{"label":"<=8 words","consequence":"1 sentence","effects":{"gas":-15,"cash":0,"btc":0,"suvHealth":0,"vibes":-1,"purchasingPower":0}}]}
Rules: canFight:true only for physical threats (bandits/checkpoint/ambush) and adds a "Stand your ground" option client-side.
Tailor to region (Baja desert, Oaxaca culture, Guatemala volcanic). Some events reference hard money (rising prices, peso crash, vendors preferring BTC).
Cash effects $20-200, BTC 0.001-0.01, purchasingPower -5 to +3. Never drain >25% of a resource.`;
}

async function generateEvent(gameSnapshot) {
  if (!anthropic) {
    throw new Error('Anthropic client not configured');
  }
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{ role: 'user', content: buildEventPrompt(gameSnapshot) }],
  });
  const text = msg.content.map((b) => b.text || '').join('').replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(text);

  // Validate required shape
  if (!parsed.headline || !parsed.dateline || !parsed.description || !Array.isArray(parsed.choices)) {
    throw new Error('Invalid event shape from AI');
  }
  return parsed;
}

function pickMockEvent(snapshot) {
  const recent = Array.isArray(snapshot.recentEventTitles) ? snapshot.recentEventTitles : [];
  const pool = MOCK_EVENTS.filter((e) => !recent.includes(e.headline));
  const source = pool.length ? pool : MOCK_EVENTS;
  const e = source[Math.floor(Math.random() * source.length)];
  return {
    ...e,
    dateline: `${e.dateline} — Day ${snapshot.days ?? 0}`,
  };
}

// POST /api/event — generate a region-aware newspaper event
app.post('/api/event', async (req, res) => {
  const snapshot = req.body || {};
  try {
    const ev = await generateEvent(snapshot);
    res.json(ev);
  } catch (err) {
    console.error('Event generation failed, returning mock:', err.message);
    res.json(pickMockEvent(snapshot));
  }
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(PORT, () => {
    console.log(`🛻₿ Leaderboard server listening on http://localhost:${PORT}`);
  });
}

export { app };
