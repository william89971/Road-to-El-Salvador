// Simple Express backend for persistent leaderboard scores.
// Stores runs in a JSON file so scores survive server restarts.
// Start with:  node index.js   (or  npm start  from the server/ directory)

import express from 'express';
import cors from 'cors';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, 'runs.json');
const PORT = process.env.PORT || 3001;

function loadRuns() {
  try {
    if (existsSync(DATA_FILE)) return JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
  } catch { /* corrupt file — start fresh */ }
  return [];
}

function saveRuns(runs) {
  // keep at most 500 entries to prevent unbounded growth
  const trimmed = runs.slice(0, 500);
  writeFileSync(DATA_FILE, JSON.stringify(trimmed, null, 2), 'utf-8');
}

const app = express();
app.use(cors());
app.use(express.json());

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
  if (btcValue == null) return res.status(400).json({ error: 'btcValue is required' });

  const runs = loadRuns();
  runs.push({
    name: (name || 'Anon').slice(0, 32),
    btc: Number(btc) || 0,
    btcValue: Math.round(Number(btcValue)),
    pp: Math.round(Number(pp) || 0),
    days: Math.round(Number(days) || 0),
    ts: Date.now(),
  });
  saveRuns(runs);
  res.status(201).json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`🛻₿ Leaderboard server listening on http://localhost:${PORT}`);
});
