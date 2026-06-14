// A9 — validation tests for POST /api/runs.
// A bad btcValue must be rejected with 400; a valid run is accepted with 201.
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

function post(body) {
  return globalThis.fetch(`${base}/api/runs`, {
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

describe('POST /api/runs validation', () => {
  it('rejects a non-numeric btcValue with 400', async () => {
    const res = await post({ name: 'X', btcValue: 'abc' });
    expect(res.status).toBe(400);
  });

  it('rejects a negative btcValue with 400', async () => {
    const res = await post({ name: 'X', btcValue: -5 });
    expect(res.status).toBe(400);
  });

  it('accepts a valid run with 201', async () => {
    const res = await post({ name: 'X', btc: 0.05, btcValue: 1234, pp: 80, days: 10 });
    expect(res.status).toBe(201);
  });
});
