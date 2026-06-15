// B4 — GET /api/runs returns runs sorted by btcValue descending, limited by n.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

// own temp data file so this test can't collide with other server tests
const RUNS = join(tmpdir(), `runs-getruns-${process.pid}.json`);
process.env.RUNS_FILE = RUNS;

let server, base;

beforeAll(async () => {
  const { app } = await import('../index.js');
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  for (const btcValue of [100, 300, 200]) {
    await globalThis.fetch(`${base}/api/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'X', btc: 0.05, btcValue, pp: 50, days: 5 }),
    });
  }
});

afterAll(() => {
  server?.close();
  try { rmSync(RUNS, { force: true }); } catch { /* ignore */ }
});

describe('GET /api/runs', () => {
  it('returns runs sorted by btcValue descending, limited by n', async () => {
    const res = await globalThis.fetch(`${base}/api/runs?n=2`);
    expect(res.status).toBe(200);
    const runs = await res.json();
    expect(runs.map((r) => r.btcValue)).toEqual([300, 200]);
  });
});
