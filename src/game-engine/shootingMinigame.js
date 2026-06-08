import { gameState, clamp } from './gameStateAndRules.js';
import { BIOMES } from '../map-data/citiesAndRoute.js';
import { audio } from './soundEffects.js';

// Enemy archetypes. `breach` applies a loss to gameState when one reaches the
// bottom; `kill` applies a reward (only the Central Banker has one).
const TYPES = {
  bandit:    { color: '#c0392b', label: '🦹', hp: 1, w: 46, h: 58, breach: () => { gameState.cash = clamp(gameState.cash - rand(50, 150), 0, 99999); } },
  agent:     { color: '#8a8f99', label: '🕴️', hp: 1, w: 44, h: 60, breach: () => { gameState.btc = clamp(+(gameState.btc - randf(0.005, 0.01)).toFixed(4), 0, 99); } },
  hacker:    { color: '#26c6da', label: '💻', hp: 1, w: 44, h: 56, breach: () => { gameState.btc = clamp(+(gameState.btc - randf(0.003, 0.008)).toFixed(4), 0, 99); } },
  banker:    { color: '#3f6fd1', label: '🏦', hp: 5, w: 54, h: 66, breach: () => { gameState.purchasingPower = clamp(gameState.purchasingPower - 4, 1, 100); },
               kill: () => { gameState.purchasingPower = clamp(gameState.purchasingPower + 5, 1, 100); } },
};

function rand(a, b) { return Math.round(a + Math.random() * (b - a)); }
function randf(a, b) { return a + Math.random() * (b - a); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export class WaveShooter {
  constructor(canvas, { biome = 'california', onComplete } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.biome = biome;
    this.onComplete = onComplete || (() => {});

    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.resize();

    this.enemies = [];
    this.particles = [];
    this.ammo = Math.max(6, gameState.vibes * 3);
    this.wave = 0;
    this.totalWaves = 3;
    this.defeated = 0;
    this.elapsed = 0;
    this.timeLimit = 60;
    this.done = false;
    this.spawning = false;

    this._onPointer = this._onPointer.bind(this);
    this._onKey = this._onKey.bind(this);
    this._onResize = () => this.resize();
    canvas.addEventListener('pointerdown', this._onPointer);
    window.addEventListener('keydown', this._onKey);
    window.addEventListener('resize', this._onResize);
  }

  resize() {
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.canvas.width = this.W * this.dpr;
    this.canvas.height = this.H * this.dpr;
    this.canvas.style.width = this.W + 'px';
    this.canvas.style.height = this.H + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.breachY = this.H - 84;
  }

  start() {
    this.spawnWave();
    this.last = performance.now();
    this._raf = requestAnimationFrame((t) => this.loop(t));
  }

  spawnWave() {
    this.wave++;
    const count = rand(3, 5);
    const speed = 32 + this.wave * 16; // each wave faster
    const kinds = ['bandit', 'agent', 'hacker'];
    for (let i = 0; i < count; i++) {
      // ~1 banker possible from wave 2 onward
      const kind = (this.wave >= 2 && i === 0 && Math.random() < 0.5) ? 'banker' : pick(kinds);
      const t = TYPES[kind];
      this.enemies.push({
        kind, ...t, hp: t.hp,
        x: 40 + Math.random() * (this.W - 80),
        y: -60 - i * 70 - Math.random() * 60,
        vy: speed * (0.85 + Math.random() * 0.4),
        flash: 0, scale: 1, dying: false, dieT: 0,
      });
    }
  }

  _onKey(e) {
    if (e.key === 'Escape') this.finish('fled');
  }

  _onPointer(e) {
    if (this.done) return;
    const r = this.canvas.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    if (this.ammo <= 0) { audio.gunshot(); return; }
    this.ammo--;
    audio.gunshot();
    this.muzzle = { x: px, y: py, t: 0.12 };

    // hit the frontmost enemy whose box contains the point
    let hitIdx = -1, bestY = -Infinity;
    for (let i = 0; i < this.enemies.length; i++) {
      const en = this.enemies[i];
      if (en.dying) continue;
      const hw = en.w / 2, hh = en.h / 2;
      if (px >= en.x - hw && px <= en.x + hw && py >= en.y - hh && py <= en.y + hh && en.y > bestY) {
        hitIdx = i; bestY = en.y;
      }
    }
    if (hitIdx >= 0) {
      const en = this.enemies[hitIdx];
      en.hp--; en.flash = 0.18; en.y -= 26; // flash + knockback
      this.burst(en.x, en.y, en.color, 6);
      if (en.hp <= 0) this.kill(en);
    }
  }

  kill(en) {
    en.dying = true; en.dieT = 0;
    this.defeated++;
    gameState.enemiesDefeated++;
    this.burst(en.x, en.y, en.color, 18);
    if (en.kill) en.kill();
  }

  burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 160;
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5 + Math.random() * 0.3, age: 0, color });
    }
  }

  loop(t) {
    if (this.done) return;
    const dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    this.elapsed += dt;

    // update enemies
    for (const en of this.enemies) {
      if (en.dying) { en.dieT += dt; en.scale = Math.max(0, 1 - en.dieT / 0.3); continue; }
      if (en.flash > 0) en.flash -= dt;
      en.y += en.vy * dt;
      if (en.y >= this.breachY) { en.breach(); en.breached = true; en.dying = true; en.dieT = 0; }
    }
    this.enemies = this.enemies.filter((en) => !(en.dying && en.dieT >= 0.3));

    // update particles
    for (const p of this.particles) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 220 * dt; }
    this.particles = this.particles.filter((p) => p.age < p.life);

    if (this.muzzle) { this.muzzle.t -= dt; if (this.muzzle.t <= 0) this.muzzle = null; }

    // wave progression
    const aliveOrFalling = this.enemies.length > 0;
    if (!aliveOrFalling && !this.done) {
      if (this.wave < this.totalWaves) this.spawnWave();
      else return this.finish('cleared');
    }
    if (this.elapsed >= this.timeLimit) return this.finish('survived');

    this.draw();
    this._raf = requestAnimationFrame((tt) => this.loop(tt));
  }

  draw() {
    const c = this.ctx, W = this.W, H = this.H;
    // biome backdrop
    const mid = (BIOMES[this.biome] || BIOMES.california).mid;
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0d0b09');
    g.addColorStop(1, shade(mid, -0.5));
    c.fillStyle = g; c.fillRect(0, 0, W, H);

    // breach line
    c.strokeStyle = 'rgba(192,57,43,0.6)'; c.lineWidth = 2; c.setLineDash([10, 8]);
    c.beginPath(); c.moveTo(0, this.breachY); c.lineTo(W, this.breachY); c.stroke();
    c.setLineDash([]);
    c.fillStyle = 'rgba(192,57,43,0.45)';
    c.font = "14px 'Inconsolata', monospace";
    c.fillText('DEFEND THE STACK', 16, this.breachY - 8);

    // enemies
    for (const en of this.enemies) {
      c.save();
      c.translate(en.x, en.y);
      c.scale(en.scale, en.scale);
      const hw = en.w / 2, hh = en.h / 2;
      c.fillStyle = en.flash > 0 ? '#ffffff' : en.color;
      roundRect(c, -hw, -hh, en.w, en.h, 8); c.fill();
      // head
      c.beginPath(); c.arc(0, -hh - 8, 12, 0, Math.PI * 2); c.fillStyle = en.flash > 0 ? '#fff' : shade(en.color, 0.25); c.fill();
      // icon
      c.font = '22px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(en.label, 0, 2);
      // hp pips for banker
      if (en.hp > 1 || en.kind === 'banker') {
        c.fillStyle = '#ffd700'; c.font = "11px 'Inconsolata', monospace";
        c.fillText('♥'.repeat(Math.max(0, en.hp)), 0, -hh - 22);
      }
      c.restore();
    }

    // particles
    for (const p of this.particles) {
      c.globalAlpha = Math.max(0, 1 - p.age / p.life);
      c.fillStyle = p.color;
      c.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    c.globalAlpha = 1;

    // muzzle flash
    if (this.muzzle) {
      c.fillStyle = 'rgba(255,230,150,0.8)';
      c.beginPath(); c.arc(this.muzzle.x, this.muzzle.y, 16, 0, Math.PI * 2); c.fill();
    }

    // top strip HUD
    c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(0, 0, W, 44);
    c.fillStyle = '#f5e6ca'; c.textAlign = 'left'; c.textBaseline = 'middle';
    c.font = "18px 'Inconsolata', monospace";
    c.fillText(`🔫 AMMO ${this.ammo}`, 16, 22);
    c.textAlign = 'center';
    c.fillText(`WAVE ${this.wave}/${this.totalWaves}`, W / 2, 22);
    c.textAlign = 'right';
    c.fillText(`⏱ ${Math.max(0, Math.ceil(this.timeLimit - this.elapsed))}s   ESC to flee`, W - 16, 22);
  }

  finish(outcome) {
    if (this.done) return;
    this.done = true;
    cancelAnimationFrame(this._raf);
    if (outcome === 'fled') gameState.vibes = clamp(gameState.vibes - 1, 0, 5);
    if (outcome === 'cleared' || outcome === 'survived') audio.cheer();
    this.dispose();
    this.onComplete({ outcome, defeated: this.defeated });
  }

  dispose() {
    this.canvas.removeEventListener('pointerdown', this._onPointer);
    window.removeEventListener('keydown', this._onKey);
    window.removeEventListener('resize', this._onResize);
  }
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

// lighten (amt>0) / darken (amt<0) a hex color
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = amt < 0 ? 0 : 255, p = Math.abs(amt);
  r = Math.round(r + (f - r) * p); g = Math.round(g + (f - g) * p); b = Math.round(b + (f - b) * p);
  return `rgb(${r},${g},${b})`;
}
