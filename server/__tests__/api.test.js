// Server API tests: health, runs, events, and metrics.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

// write to a throwaway file so the test never touches the real runs.json
const RUNS = join(tmpdir(), `runs-test-${process.pid}.json`);
process.env.RUNS_FILE = RUNS;

let server, base;

beforeAll(async () => {
  const { app } = await import('../index.js');
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => {
  server?.close();
  try { rmSync(RUNS, { force: true }); } catch { /* ignore */ }
});

function get(path) {
  return globalThis.fetch(`${base}${path}`);
}

function postRuns(body) {
  return globalThis.fetch(`${base}/api/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function postEvent(body) {
  return globalThis.fetch(`${base}/api/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('GET /api/health', () => {
  it('responds 200 with { ok: true }', async () => {
    const res = await get('/api/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });
});

describe('GET /api/metrics', () => {
  it('responds 200 with runCount', async () => {
    const res = await get('/api/metrics');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, runCount: expect.any(Number) });
  });
});

describe('POST /api/runs validation', () => {
  it('rejects a non-numeric btcValue with 400', async () => {
    const res = await postRuns({ name: 'X', btcValue: 'abc' });
    expect(res.status).toBe(400);
  });

  it('rejects a negative btcValue with 400', async () => {
    const res = await postRuns({ name: 'X', btcValue: -5 });
    expect(res.status).toBe(400);
  });

  it('rejects a negative btc with 400', async () => {
    const res = await postRuns({ name: 'X', btc: -1, btcValue: 100, pp: 80, days: 10 });
    expect(res.status).toBe(400);
  });

  it('rejects an out-of-range pp with 400', async () => {
    const res = await postRuns({ name: 'X', btc: 0.05, btcValue: 100, pp: 101, days: 10 });
    expect(res.status).toBe(400);
  });

  it('rejects a negative days with 400', async () => {
    const res = await postRuns({ name: 'X', btc: 0.05, btcValue: 100, pp: 80, days: -1 });
    expect(res.status).toBe(400);
  });

  it('rejects an oversized name with 400', async () => {
    const res = await postRuns({ name: 'x'.repeat(33), btc: 0.05, btcValue: 100, pp: 80, days: 10 });
    expect(res.status).toBe(400);
  });

  it('accepts a valid run with 201', async () => {
    const res = await postRuns({ name: 'X', btc: 0.05, btcValue: 1234, pp: 80, days: 10 });
    expect(res.status).toBe(201);
  });
});

describe('POST /api/event', () => {
  it('returns a valid event shape', async () => {
    const res = await postEvent({
      currentCity: 'Los Angeles',
      currentCountry: 'USA',
      biome: 'california',
      miles: 0,
      gas: 100,
      suvHealth: 100,
      vibes: 5,
      cash: 800,
      purchasingPower: 100,
      btc: 0.05,
      btcPrice: 64000,
      days: 0,
      recentEventTitles: [],
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      headline: expect.any(String),
      dateline: expect.any(String),
      description: expect.any(String),
      canFight: expect.any(Boolean),
      choices: expect.any(Array),
    });
    expect(body.choices.length).toBeGreaterThanOrEqual(2);
  });

  it('falls back to a mock event without an API key', async () => {
    process.env.ANTHROPIC_API_KEY = '';
    const res = await postEvent({ days: 1, recentEventTitles: [] });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.headline).toBeTruthy();
    expect(Array.isArray(body.choices)).toBe(true);
  });
});
