#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────────
 * deepseek-loop.mjs — an autonomous loop with a maker/checker split.
 *
 * One iteration:
 *   1. Read TASKLIST.md, pick the first unchecked "Ready" task.
 *   2. MAKER  (cheap DeepSeek) writes the smallest change that satisfies it.
 *   3. GATE   (loop/gate.sh) runs build + tests + lint. Unfoolable. Must pass.
 *   4. CHECKER (a different, skeptical DeepSeek) tries to REFUTE that the diff
 *      truly + honestly completes the task and that the commit message does not
 *      overclaim. PASS only if it cannot refute.
 *   5. If gate AND checker pass: mark [x], commit honestly. Otherwise: revert
 *      and flag the task [!] for the human. Never checks off unverified work.
 *
 * Safety: off until DEEPSEEK_API_KEY is set. Refuses to run on main. Does ONE
 * task by default (--max-tasks). Stops on a cost cap, or if loop/STOP exists.
 * See loop/README.md for the friendly version.
 * ──────────────────────────────────────────────────────────────────────────── */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync, statSync, rmSync } from 'node:fs';
import { join } from 'node:path';

// ── config ───────────────────────────────────────────────────────────────────
const ROOT = process.cwd();
const TASKS_FILE = join(ROOT, 'TASKLIST.md');
const LOG_FILE = join(ROOT, 'loop', 'loop-log.md');
const STOP_FILE = join(ROOT, 'loop', 'STOP');
const API_URL = 'https://api.deepseek.com/chat/completions';

// DeepSeek USD per 1M tokens (cache-miss input / cache-hit input / output).
// Estimates, for the cost cap only — update if DeepSeek changes pricing.
const PRICES = {
  'deepseek-chat':     { in: 0.27, cachedIn: 0.07, out: 1.10 },
  'deepseek-reasoner': { in: 0.55, cachedIn: 0.14, out: 2.19 },
};

const args = parseArgs(process.argv.slice(2));
const MAKER_MODEL   = args['maker-model']   || 'deepseek-chat';
const CHECKER_MODEL = args['checker-model'] || 'deepseek-reasoner';
const MAX_TASKS   = int(args['max-tasks'], 1);
const MAX_COST    = float(args['max-cost'], 0.50);
const MAX_RETRIES = int(args['max-retries'], 1);
const PLAN_ONLY   = 'plan' in args;          // no API, no writes — just show the next move + run the gate

let spentUSD = 0;

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  banner();
  ensureLoopDir();

  const branch = git('rev-parse', '--abbrev-ref', 'HEAD').trim();
  if (branch === 'main' || branch === 'master') {
    die(`Refusing to run on '${branch}'. Make a feature branch first:  git switch -c loop-work`);
  }
  say(`Branch: ${branch}`);

  if (!PLAN_ONLY && !process.env.DEEPSEEK_API_KEY) {
    console.log(`
This machine is OFF because DEEPSEEK_API_KEY is not set.

To switch it on, run this once in your terminal (paste your real key):
    export DEEPSEEK_API_KEY="sk-your-key-here"

Then run the loop again. To preview what it WOULD do without spending anything:
    node loop/deepseek-loop.mjs --plan
`);
    process.exit(0);
  }

  let done = 0;
  while (done < MAX_TASKS) {
    if (existsSync(STOP_FILE)) { say('STOP file found — halting.'); break; }
    if (spentUSD >= MAX_COST)  { say(`Cost cap $${MAX_COST} reached — halting.`); break; }

    const task = nextReadyTask();
    if (!task) { say('No unchecked Ready tasks left. 🎉'); break; }

    say(`\n━━━ Task ${task.id}: ${task.title} ━━━`);
    if (PLAN_ONLY) { planTask(task); break; }

    const outcome = await runTask(task);
    logResult(task, outcome);
    if (outcome.status === 'done') done++;
    else if (outcome.status === 'blocked') say(`Task ${task.id} left for you to look at. Moving on.`);
    say(`Spent so far: ~$${spentUSD.toFixed(4)}`);
  }

  say(`\nLoop finished. Completed ${done} task(s) this run. Total spend: ~$${spentUSD.toFixed(4)}`);
}

// ── one task: maker → gate → checker ─────────────────────────────────────────
async function runTask(task) {
  // guard: the files we're about to touch must be clean, so revert is safe
  for (const f of task.files) {
    if (existsSync(join(ROOT, f)) && !gitClean(f)) {
      return { status: 'blocked', reason: `${f} has uncommitted changes; commit or discard them first.` };
    }
  }

  let priorError = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) say(`Retry ${attempt}/${MAX_RETRIES} (feeding the error back to the maker)…`);

    // 1) MAKER
    say('• Maker (DeepSeek) is writing the change…');
    const maker = await callModel(MAKER_MODEL, makerMessages(task, priorError));
    const parsed = parseMaker(maker.content);
    if (!parsed.files.length) { priorError = 'You returned no FILE blocks. Re-read the format.'; continue; }

    // apply, remembering how to undo
    const undo = applyFiles(parsed.files);

    // 2) GATE
    say('• Gate is running build + tests + lint…');
    const gate = runGate();
    if (!gate.ok) {
      say('  Gate FAILED — reverting this attempt.');
      revert(undo);
      priorError = `The deterministic gate failed:\n${gate.output.slice(-1500)}`;
      continue;
    }
    say('  Gate PASSED ✅');

    // 3) CHECKER (adversarial, different model)
    const diff = git('diff', '--', ...parsed.files.map(f => f.path));
    say(`• Checker (${CHECKER_MODEL}) is trying to refute it…`);
    const checkRaw = await callModel(CHECKER_MODEL, checkerMessages(task, diff, parsed.commit));
    const verdict = parseVerdict(checkRaw.content);
    if (verdict.pass !== true) {
      say(`  Checker REFUTED: ${verdict.reasons}`);
      say('  Reverting and flagging for you.');
      revert(undo);
      return { status: 'blocked', reason: `checker refused: ${verdict.reasons}` };
    }
    say('  Checker could not refute it — PASS ✅');

    // 4) commit honestly + check the box
    markTaskDone(task);
    const msg = `${parsed.commit}\n\nTask ${task.id}. Verified by gate (build+test+lint) and adversarial checker (${CHECKER_MODEL}).\n\nCo-Authored-By: DeepSeek loop <noreply@deepseek.local>`;
    git('add', '--', ...parsed.files.map(f => f.path), 'TASKLIST.md');
    git('commit', '-q', '-F', '-', { input: msg });
    say(`✓ Committed ${task.id}.`);
    return { status: 'done', commit: parsed.commit, files: parsed.files.map(f => f.path) };
  }

  return { status: 'blocked', reason: `gave up after ${MAX_RETRIES} retries; last error fed back to maker` };
}

// ── DeepSeek call + cost tracking ────────────────────────────────────────────
async function callModel(model, messages) {
  const body = { model, messages, temperature: float(args.temperature, 0.3), stream: false };
  for (let tryN = 0; tryN < 3; tryN++) {
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const json = await res.json();
      spentUSD += costOf(model, json.usage);
      return { content: json.choices?.[0]?.message?.content || '' };
    } catch (e) {
      if (tryN === 2) die(`DeepSeek API call failed: ${e.message}`);
      say(`  API hiccup (${e.message}); retrying…`);
      await sleep(1500 * (tryN + 1));
    }
  }
}

function costOf(model, usage) {
  if (!usage) return 0;
  const p = PRICES[model] || PRICES['deepseek-chat'];
  const miss = usage.prompt_cache_miss_tokens ?? usage.prompt_tokens ?? 0;
  const hit  = usage.prompt_cache_hit_tokens ?? 0;
  const out  = usage.completion_tokens ?? 0;
  return (miss / 1e6) * p.in + (hit / 1e6) * p.cachedIn + (out / 1e6) * p.out;
}

// ── prompts ──────────────────────────────────────────────────────────────────
function makerMessages(task, priorError) {
  const rules = readIf('.codewhale/instructions.md');
  const dod = section(readIf('TASKLIST.md'), 'Definition of Done');
  const fileBlobs = task.files.map(f => {
    const abs = join(ROOT, f);
    return existsSync(abs)
      ? `--- ${f} ---\n${readFileSync(abs, 'utf8')}`
      : `--- ${f} (does not exist yet; create it) ---`;
  }).join('\n\n');
  const tree = git('ls-files', 'src', 'server', 'index.html', 'eslint.config.js').trim();

  const sys = `You are a careful senior engineer making ONE small change in an existing repo.
Rules:
- Make the SMALLEST change that satisfies the task's "Done when" check. Touch nothing unrelated.
- Only edit/create the files the task lists.
- Honesty over ambition: your commit message must describe ONLY what your diff actually does. Claiming more than the diff shows is the worst possible outcome.
- Output format, exactly:
===COMMIT: <imperative one-line summary of what the diff really does>===
===FILE: <relative/path>===
<the FULL new contents of that file>
===END===
(repeat FILE/END for each changed or created file; output nothing else)`;

  const usr = `PROJECT RULES:\n${rules}\n\nDEFINITION OF DONE:\n${dod}\n\nREPO FILES:\n${tree}\n\nTASK ${task.id}: ${task.title}\n${task.body}\n\nFILES IN SCOPE:\n${fileBlobs}` +
    (priorError ? `\n\nYOUR PREVIOUS ATTEMPT FAILED. Fix it. Details:\n${priorError}` : '');

  return [{ role: 'system', content: sys }, { role: 'user', content: usr }];
}

function checkerMessages(task, diff, commitMsg) {
  const sys = `You are an adversarial code reviewer. Your job is to REFUTE the claim that this change correctly and honestly completes the task. Default to REFUTE if you are not sure.
Refute if ANY of these hold:
- The diff does not actually satisfy the task's "Done when" check.
- The commit message claims something the diff does not show (overclaiming / slop).
- The change touches unrelated things or looks fake/placeholder.
Reply with ONLY a JSON object: {"verdict":"PASS"|"REFUTE","reasons":"<one or two sentences>"}
PASS only if you genuinely cannot refute it.`;
  const usr = `TASK ${task.id}: ${task.title}\n${task.body}\n\nPROPOSED COMMIT MESSAGE:\n${commitMsg}\n\nACTUAL DIFF (this is all that changed):\n${diff || '(empty diff)'}\n\n(The deterministic gate — build, tests, lint — already passed. Judge correctness and honesty.)`;
  return [{ role: 'system', content: sys }, { role: 'user', content: usr }];
}

// ── parsing ──────────────────────────────────────────────────────────────────
function parseMaker(text) {
  const commit = (text.match(/===COMMIT:\s*([\s\S]*?)===/) || [])[1]?.trim() || 'Apply task change';
  const files = [];
  const re = /===FILE:\s*(.+?)===\r?\n([\s\S]*?)\r?\n===END===/g;
  let m;
  while ((m = re.exec(text))) files.push({ path: m[1].trim(), content: m[2] });
  return { commit, files };
}

function parseVerdict(text) {
  try {
    const j = JSON.parse((text.match(/\{[\s\S]*\}/) || ['{}'])[0]);
    return { pass: String(j.verdict).toUpperCase() === 'PASS', reasons: j.reasons || '' };
  } catch {
    // if the checker didn't return clean JSON, fail closed
    return { pass: /\bPASS\b/.test(text) && !/\bREFUTE\b/.test(text), reasons: text.slice(0, 200) };
  }
}

// ── TASKLIST parsing ─────────────────────────────────────────────────────────
function nextReadyTask() {
  const md = readFileSync(TASKS_FILE, 'utf8');
  const ready = section(md, 'Ready');
  // split into top-level checkbox items
  const items = ready.split(/\n(?=- \[[ x!]\] )/).filter(s => /^- \[[ x!]\]/.test(s.trim()));
  for (const block of items) {
    if (!/^- \[ \]/.test(block.trim())) continue;          // only unchecked
    const id = (block.match(/\*\*(A\d+)/) || [])[1] || '?';
    const head = (block.match(/\*\*(.+?)\*\*/) || [])[1] || id;
    const title = head.replace(/^A\d+\s*[·.\-:]?\s*/, '').trim();
    // Only treat a backtick token as an in-scope file if it's a real path
    // (contains a slash) or actually exists at the repo root (e.g. index.html).
    const files = [...block.matchAll(/`([^`]+\.(?:js|jsx|mjs|ts|html|json|sh|md))`/g)]
      .map(m => m[1])
      .filter(p => p.includes('/') || existsSync(join(ROOT, p)));
    const uniqFiles = [...new Set(files)];
    return { id, title, body: block.trim(), files: uniqFiles };
  }
  return null;
}

function markTaskDone(task) {
  const md = readFileSync(TASKS_FILE, 'utf8');
  const out = md.replace(new RegExp(`- \\[ \\] (\\*\\*${task.id}\\b)`), `- [x] $1`);
  writeFileSync(TASKS_FILE, out);
}

// ── file apply / revert ──────────────────────────────────────────────────────
function applyFiles(files) {
  const undo = [];
  for (const f of files) {
    const abs = join(ROOT, f.path);
    const existed = existsSync(abs);
    mkdirSync(join(abs, '..'), { recursive: true });
    writeFileSync(abs, f.content);
    undo.push({ path: f.path, abs, existed });
    say(`  wrote ${f.path} (${existed ? 'modified' : 'new'})`);
  }
  return undo;
}

function revert(undo) {
  for (const u of undo) {
    if (u.existed) git('checkout', '--', u.path);     // restore committed version
    else rmSync(u.abs, { force: true });              // remove file we created
  }
}

// ── git + shell helpers ──────────────────────────────────────────────────────
function git(...a) {
  let opts = {};
  if (a.length && typeof a[a.length - 1] === 'object') opts = a.pop();
  const r = spawnSync('git', a, { cwd: ROOT, encoding: 'utf8', input: opts.input });
  if (r.status !== 0 && !opts.allowFail) die(`git ${a.join(' ')} failed:\n${r.stderr || r.stdout}`);
  return r.stdout || '';
}
function gitClean(path) {
  return spawnSync('git', ['diff', '--quiet', '--', path], { cwd: ROOT }).status === 0;
}
function runGate() {
  const r = spawnSync('bash', [join('loop', 'gate.sh')], { cwd: ROOT, encoding: 'utf8' });
  process.stdout.write(indent(r.stdout || ''));
  return { ok: r.status === 0, output: (r.stdout || '') + (r.stderr || '') };
}

// ── plan mode (free preview) ─────────────────────────────────────────────────
function planTask(task) {
  say('PLAN MODE — no API calls, no writes, no commits.\n');
  say(`Next task : ${task.id} — ${task.title}`);
  say(`Files     : ${task.files.length ? task.files.join(', ') : '(none parsed; maker would choose)'}`);
  let ctx = 0;
  for (const f of task.files) { const abs = join(ROOT, f); if (existsSync(abs)) ctx += statSync(abs).size; }
  say(`Context   : ~${ctx} bytes of file content would be sent to the maker`);
  say('\nRunning the gate now to confirm the current code is healthy:');
  const g = runGate();
  say(g.ok ? '\nGate is green — a real run could proceed.' : '\nGate is RED — fix that before looping.');
}

// ── small utils ──────────────────────────────────────────────────────────────
function parseArgs(a) { const o = {}; for (let i = 0; i < a.length; i++) { if (a[i].startsWith('--')) { const k = a[i].slice(2); const v = (a[i + 1] && !a[i + 1].startsWith('--')) ? a[++i] : true; o[k] = v; } } return o; }
function int(v, d) { const n = parseInt(v); return Number.isFinite(n) ? n : d; }
function float(v, d) { const n = parseFloat(v); return Number.isFinite(n) ? n : d; }
function readIf(rel) { const p = join(ROOT, rel); return existsSync(p) ? readFileSync(p, 'utf8') : ''; }
function section(md, heading) { const re = new RegExp(`##+\\s*${heading}[^\\n]*\\n([\\s\\S]*?)(?=\\n##\\s|\\n---|$)`); return (md.match(re) || [])[1] || ''; }
function ensureLoopDir() { mkdirSync(join(ROOT, 'loop'), { recursive: true }); }
function indent(s) { return s.split('\n').map(l => '  ' + l).join('\n'); }
function say(s) { console.log(s); appendFileSync(LOG_FILE, s + '\n'); }
function logResult(task, o) { appendFileSync(LOG_FILE, `\n[${new Date().toISOString()}] ${task.id}: ${o.status}${o.reason ? ' — ' + o.reason : ''}\n`); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function die(m) { console.error(`\n✗ ${m}`); process.exit(1); }
function banner() { console.log('🛻₿  DeepSeek loop — maker → gate → checker'); }

main().catch(e => die(e.stack || e.message));
