import { useEffect, useRef, useState } from 'react';
import { gameState } from '../game-engine/gameStateAndRules.js';
import { audio } from '../game-engine/soundEffects.js';

const FULL_TEXT = 'DEPLOYED TO PRODUCTION';

export default function ArrivalCinematic({ onDone }) {
  const canvasRef = useRef(null);
  const [typed, setTyped] = useState(0);
  const [showLogo, setShowLogo] = useState(false);

  // confetti
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = (canvas.width = window.innerWidth * dpr);
    let H = (canvas.height = window.innerHeight * dpr);
    ctx.scale(dpr, dpr);
    const w = window.innerWidth, h = window.innerHeight;

    const colors = ['#f7931a', '#ffd700', '#ffaf40', '#f5e6ca'];
    const bits = Array.from({ length: 160 }, () => ({
      x: Math.random() * w, y: -20 - Math.random() * h,
      vy: 60 + Math.random() * 160, vx: (Math.random() - 0.5) * 50,
      s: 4 + Math.random() * 6, rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));

    let raf, last = performance.now(), running = true;
    const loop = (t) => {
      if (!running) return;
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      ctx.clearRect(0, 0, w, h);
      for (const b of bits) {
        b.y += b.vy * dt; b.x += b.vx * dt; b.rot += b.vr * dt;
        if (b.y > h + 20) { b.y = -20; b.x = Math.random() * w; }
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot);
        ctx.fillStyle = b.color; ctx.fillRect(-b.s / 2, -b.s / 2, b.s, b.s * 0.6);
        ctx.restore();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onResize = () => { W = canvas.width = window.innerWidth * dpr; H = canvas.height = window.innerHeight * dpr; ctx.scale(dpr, dpr); };
    window.addEventListener('resize', onResize);
    return () => { running = false; cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); };
  }, []);

  // choreography
  useEffect(() => {
    audio.fanfare();
    const tLogo = setTimeout(() => setShowLogo(true), 350);
    let i = 0;
    const tType = setInterval(() => {
      i++; setTyped(i);
      if (i >= FULL_TEXT.length) clearInterval(tType);
    }, 900 / FULL_TEXT.length + 30);
    const tDone = setTimeout(onDone, 4200);
    return () => { clearTimeout(tLogo); clearInterval(tType); clearTimeout(tDone); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={st.wrap}>
      <canvas ref={canvasRef} style={st.canvas} />
      <div style={st.center}>
        <div style={{ ...st.logo, opacity: showLogo ? 1 : 0, transform: showLogo ? 'translateY(0) scale(1)' : 'translateY(40px) scale(0.6)' }}>₿</div>
        <div style={st.title}>
          {FULL_TEXT.slice(0, typed)}
          <span style={st.caret}>{typed < FULL_TEXT.length ? '▋' : ''}</span>
        </div>
        <div style={{ ...st.sub, opacity: typed >= FULL_TEXT.length ? 1 : 0 }}>
          El Salvador — Day {gameState.days}
        </div>
      </div>
    </div>
  );
}

const st = {
  wrap: { position: 'fixed', inset: 0, zIndex: 70, background: '#0a0807', overflow: 'hidden', animation: 'fadeIn 0.6s ease' },
  canvas: { position: 'absolute', inset: 0 },
  center: { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', alignContent: 'center', gap: 14, textAlign: 'center' },
  logo: { fontSize: 'clamp(90px, 20vw, 160px)', color: 'var(--btc)', lineHeight: 1, transition: 'all 0.9s cubic-bezier(.2,.9,.3,1.2)', textShadow: '0 0 40px rgba(247,147,26,0.8), 0 0 120px rgba(247,147,26,0.5)', fontFamily: 'var(--font-title)' },
  title: { fontFamily: 'var(--font-title)', fontSize: 'clamp(28px, 7vw, 52px)', letterSpacing: '0.14em', color: 'var(--paper)', minHeight: '1.2em' },
  caret: { color: 'var(--btc)', animation: 'blink 0.6s steps(1) infinite' },
  sub: { fontFamily: 'var(--font-num)', fontSize: 18, color: '#d8c7a6', letterSpacing: '0.1em', transition: 'opacity 0.6s ease' },
};
