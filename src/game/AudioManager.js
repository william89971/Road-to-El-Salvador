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
