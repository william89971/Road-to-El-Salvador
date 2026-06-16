# The Loop — a plain-English guide

This folder is **the machine** that does small coding tasks for you automatically,
using your cheap DeepSeek account to do the labor. You designed the work; it does it.

## What it actually does

It reads `TASKLIST.md`, takes the first unfinished task, and runs three steps:

1. **Maker** — a cheap DeepSeek model writes the change.
2. **Gate** — `gate.sh` runs the build, the tests, and the linter. This part
   can't be fooled: a robot can *claim* it's done, but it can't make a broken
   build pass.
3. **Checker** — a *different*, more skeptical DeepSeek model is told to **try to
   prove the work is fake or overblown**. If it finds a problem, the change is
   thrown away and the task is left for you. If it can't, the change is saved.

Only when both the gate and the checker pass does it save the work and tick the
box. It will **never** tick a box it didn't actually verify — that's the whole
point (it's the fix for the "PBR" commit that claimed things it never did).

## It's safe by default

- **Off until you give it your key.** No key = it just prints instructions and quits.
- **Won't run on your `main` branch** — it makes you use a separate workspace.
- **Does ONE task per run** unless you ask for more (`--max-tasks`).
- **Stops at a spending cap** (`--max-cost`, default $0.50).
- **Emergency stop:** create a file called `STOP` in this folder, or press `Ctrl-C`.

## Try it for free first (no spending)

This previews the next task and checks your code is healthy, without calling DeepSeek:

```
node loop/deepseek-loop.mjs --plan
```

## Turn it on

1. Put your DeepSeek key into this terminal once (use your real key):
   ```
   export DEEPSEEK_API_KEY="sk-your-key-here"
   ```
2. Make sure you're on a work branch, not main:
   ```
   git switch -c loop-work
   ```
3. Do **one** task and stop:
   ```
   node loop/deepseek-loop.mjs --max-tasks 1
   ```
4. Look at what it did (`git log`, `git show`). If you trust it, let it do more:
   ```
   node loop/deepseek-loop.mjs --max-tasks 5 --max-cost 1.00
   ```

## The knobs (all optional)

| Setting | Default | Meaning |
|---|---|---|
| `--max-tasks N` | 1 | How many tasks to finish before stopping |
| `--max-cost N` | 0.50 | Stop once estimated spend hits $N |
| `--max-retries N` | 1 | How many times the maker may retry a failed task |
| `--maker-model` | `deepseek-chat` | The cheap model that writes the change |
| `--checker-model` | `deepseek-reasoner` | The skeptical model that reviews it |
| `--plan` | — | Preview only — no spending, no changes |

## Where things are written

- Saved progress → normal git commits (one per finished task).
- A running diary → `loop/loop-log.md`.
- The to-do list and the boxes it ticks → `TASKLIST.md`.

## The one rule that matters

**You stay the reviewer.** Read what it commits. The machine moves the work;
it does not move the responsibility. That's the difference between using the loop
to go faster on things you understand and using it to avoid understanding them.
