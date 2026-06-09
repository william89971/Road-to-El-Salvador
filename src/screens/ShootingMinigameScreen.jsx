import { useEffect, useRef, useState } from 'react';
import { WaveShooter } from '../game-engine/shootingMinigame.js';
import { gameState } from '../game-engine/gameStateAndRules.js';

const OUTCOMES = {
  cleared:  { title: 'AMBUSH CLEARED', color: '#5ec27a', sub: 'You held the line. Stack intact.' },
  survived: { title: 'YOU SURVIVED', color: '#5ec27a', sub: 'You outlasted them. Back on the road.' },
  fled:     { title: 'YOU FLED', color: '#e8b04a', sub: 'Discretion over valor. (−1 vibe)' },
};

export default function ShootingMinigameScreen({ biome, onDone }) {
  const canvasRef = useRef(null);
  const [phase, setPhase] = useState('intro'); // 'intro' | 'fight' | 'result'
  const [result, setResult] = useState(null);
  const engineRef = useRef(null);

  // start the fight after the intro
  useEffect(() => {
    if (phase !== 'fight') return;
    const engine = new WaveShooter(canvasRef.current, {
      biome,
      onComplete: (res) => { setResult(res); setPhase('result'); },
    });
    engineRef.current = engine;
    if (import.meta.env.DEV) window.__shooter = engine;
    engine.start();
    return () => engine.finish?.('fled');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // auto-dismiss the intro
  useEffect(() => {
    if (phase !== 'intro') return;
    const t = setTimeout(() => setPhase('fight'), 1400);
    return () => clearTimeout(t);
  }, [phase]);

  return (
    <div style={st.wrap}>
      <canvas ref={canvasRef} style={st.canvas} />

      {phase === 'intro' && (
        <div style={st.intro}>
          <div style={{ fontSize: 64 }}>⚠️</div>
          <div style={st.introTitle}>AMBUSH!</div>
          <div style={st.introSub}>Tap the threats before they reach your stack. Ammo = vibes × 3.</div>
          <div style={st.introSub}>You have {Math.max(3, gameState.vibes * 3)} shots · ESC to flee</div>
        </div>
      )}

      {phase === 'result' && result && (
        <div style={st.result}>
          <div style={{ ...st.resultTitle, color: OUTCOMES[result.outcome].color }}>
            {OUTCOMES[result.outcome].title}
          </div>
          <div style={st.resultSub}>{OUTCOMES[result.outcome].sub}</div>
          <div style={st.resultStat}>Threats neutralized: <b>{result.defeated}</b></div>
          <button style={st.btn} onClick={() => onDone(result.outcome)}>BACK ON THE ROAD ▸</button>
        </div>
      )}
    </div>
  );
}

const st = {
  wrap: { position: 'fixed', inset: 0, zIndex: 1000, cursor: 'crosshair', background: '#0d0b09' },
  canvas: { position: 'absolute', inset: 0, display: 'block' },
  intro: { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', alignContent: 'center', gap: 6, textAlign: 'center', color: 'var(--paper)', background: 'rgba(13,11,9,0.85)', animation: 'fadeIn 0.3s ease', pointerEvents: 'none' },
  introTitle: { fontFamily: 'var(--font-title)', fontSize: 'clamp(48px,12vw,84px)', color: 'var(--danger)', lineHeight: 1 },
  introSub: { fontFamily: 'var(--font-num)', fontSize: 15, color: '#d8c7a6' },
  result: { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', alignContent: 'center', gap: 10, textAlign: 'center', color: 'var(--paper)', background: 'rgba(13,11,9,0.8)', cursor: 'default', animation: 'fadeIn 0.4s ease' },
  resultTitle: { fontFamily: 'var(--font-title)', fontSize: 'clamp(40px,10vw,72px)', lineHeight: 1 },
  resultSub: { fontFamily: 'var(--font-news)', fontStyle: 'italic', fontSize: 17, color: '#d8c7a6' },
  resultStat: { fontFamily: 'var(--font-num)', fontSize: 15, color: '#b6a98c' },
  btn: { marginTop: 12, padding: '14px 26px', fontSize: 22, borderRadius: 12, background: 'var(--btc)', color: '#1a1411' },
};
