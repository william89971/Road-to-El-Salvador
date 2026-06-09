import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { createSUV } from '../game-engine/truckModel3D.js';
import { LOADOUTS } from '../game-engine/gameStateAndRules.js';
import { CashIcon, BtcIcon, FuelIcon } from './Icons.jsx';

const DIFFICULTIES = [
  { id: 'tourist', label: 'Tourist', sub: 'Extra cash. A gentle cruise.', emoji: '🏖️' },
  { id: 'road_warrior', label: 'Road Warrior', sub: 'The intended way to play.', emoji: '🛻' },
  { id: 'satoshi', label: 'Satoshi', sub: 'Half the cash. Stay humble.', emoji: '🔥' },
];

const SUV_COLORS = [
  { name: 'Olive', hex: '#7a8c6e' },
  { name: 'Desert Sand', hex: '#c4a882' },
  { name: 'Rust Red', hex: '#8b3a2a' },
  { name: 'Midnight Black', hex: '#1a1a1a' },
  { name: 'Arctic White', hex: '#e8e8e0' },
  { name: 'Narco Green', hex: '#2d5a27' },
];

const diffMult = (d) => (d === 'satoshi' ? 0.5 : d === 'tourist' ? 1.5 : 1);

// A tiny self-contained Three.js viewport showing the SUV in the chosen color.
function SuvPreview({ color }) {
  const canvasRef = useRef(null);
  const suvRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const w = canvas.clientWidth || 220, h = canvas.clientHeight || 150;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h, false);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 100);
    camera.position.set(4.6, 3.2, 6.2);
    camera.lookAt(0, 1.4, 0);

    scene.add(new THREE.HemisphereLight(0xbfd2e6, 0x40402f, 0.9));
    const dir = new THREE.DirectionalLight(0xfff2d6, 1.3);
    dir.position.set(4, 8, 6);
    scene.add(dir);

    const suv = createSUV(color);
    suvRef.current = suv;
    scene.add(suv.group);

    let raf, last = performance.now();
    const loop = (now) => {
      const dt = (now - last) / 1000; last = now;
      suv.group.rotation.y += dt * 0.6;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      });
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // build once; color changes handled by the effect below

  useEffect(() => { suvRef.current?.setColor(color); }, [color]);

  return <canvas ref={canvasRef} style={styles.previewCanvas} />;
}

function StatBar({ label, value, pct, color }) {
  return (
    <div style={styles.statRow}>
      <span style={styles.statLabel}>{label}</span>
      <div style={styles.statTrack}><div style={{ ...styles.statFill, width: `${pct}%`, background: color }} /></div>
      <span style={styles.statVal}>{value}</span>
    </div>
  );
}

export default function StartScreen({ onStart, onShowLeaderboard }) {
  const [name, setName] = useState('');
  const [difficulty, setDifficulty] = useState('road_warrior');
  const [suvColor, setSuvColor] = useState('#7a8c6e');
  const [loadoutId, setLoadoutId] = useState('road_warrior');

  const start = () => onStart((name || 'Anon').slice(0, 16), difficulty, LOADOUTS[loadoutId], suvColor);
  const mult = diffMult(difficulty);

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <div style={styles.kicker}>A CROSS-CONTINENTAL HARD-MONEY ROAD TRIP</div>
        <h1 style={styles.title}>🛻₿ Bitcoin Road Trip</h1>
        <p style={styles.tag}>
          Drive a beat-up SUV from <b>Los Angeles</b> to <b>San&nbsp;Salvador</b>. Cash inflates.
          Bitcoin appreciates. Defend your stack.
        </p>

        <label style={styles.label}>Driver name</label>
        <input
          style={styles.input}
          value={name}
          maxLength={16}
          placeholder="Anon"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && start()}
        />

        <label style={styles.label}>Difficulty</label>
        <div style={styles.diffRow}>
          {DIFFICULTIES.map((d) => {
            const sel = difficulty === d.id;
            return (
              <button
                key={d.id}
                onClick={() => setDifficulty(d.id)}
                style={{
                  ...styles.diff,
                  borderColor: sel ? 'var(--btc)' : 'rgba(245,230,202,0.25)',
                  background: sel ? 'rgba(247,147,26,0.16)' : 'rgba(0,0,0,0.25)',
                  transform: sel ? 'translateY(-2px)' : 'none',
                }}
              >
                <div style={{ fontSize: 26 }}>{d.emoji}</div>
                <div style={styles.diffLabel}>{d.label}</div>
                <div style={styles.diffSub}>{d.sub}</div>
              </button>
            );
          })}
        </div>

        {/* SUV color + live preview */}
        <label style={styles.label}>Your rig</label>
        <div style={styles.rigRow}>
          <SuvPreview color={suvColor} />
          <div style={styles.swatchWrap}>
            {SUV_COLORS.map((c) => {
              const sel = suvColor === c.hex;
              return (
                <button
                  key={c.hex}
                  title={c.name}
                  onClick={() => setSuvColor(c.hex)}
                  style={{
                    ...styles.swatch,
                    background: c.hex,
                    outline: sel ? '2px solid var(--btc)' : '2px solid transparent',
                    boxShadow: sel ? '0 0 0 2px rgba(0,0,0,0.5) inset' : 'none',
                    transform: sel ? 'scale(1.08)' : 'none',
                  }}
                />
              );
            })}
            <div style={styles.swatchName}>{SUV_COLORS.find((c) => c.hex === suvColor)?.name}</div>
          </div>
        </div>

        {/* starting loadout */}
        <label style={styles.label}>Starting loadout</label>
        <div style={styles.loadRow}>
          {Object.values(LOADOUTS).map((lo) => {
            const sel = loadoutId === lo.id;
            const cash = Math.round(lo.cash * mult);
            return (
              <button
                key={lo.id}
                onClick={() => setLoadoutId(lo.id)}
                style={{
                  ...styles.loadCard,
                  borderColor: sel ? 'var(--btc)' : 'rgba(245,230,202,0.2)',
                  background: sel ? 'rgba(247,147,26,0.14)' : 'rgba(0,0,0,0.28)',
                  transform: sel ? 'translateY(-2px)' : 'none',
                }}
              >
                <div style={styles.loadLabel}>{lo.label}</div>
                <div style={styles.loadBlurb}>{lo.blurb}</div>
                <div style={styles.loadStats}>
                  <StatBar
                    label={<CashIcon size={13} />} value={`$${cash}`}
                    pct={Math.min(100, (cash / 2100) * 100)} color="var(--cash)"
                  />
                  <StatBar
                    label={<BtcIcon size={13} />} value={`${lo.btc}`}
                    pct={Math.min(100, (lo.btc / 0.08) * 100)} color="var(--btc)"
                  />
                  <StatBar
                    label={<FuelIcon size={13} />} value={`${lo.gas}%`}
                    pct={lo.gas} color="#e8b04a"
                  />
                </div>
              </button>
            );
          })}
        </div>

        <button style={styles.start} onClick={start}>START THE ENGINE ▸</button>

        {onShowLeaderboard && (
          <button style={styles.lbBtn} onClick={onShowLeaderboard}>🏆 Leaderboard</button>
        )}

        <div style={styles.hint}>
          2,800 miles · 8 stops · newspaper events · wave-shooter ambushes
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    position: 'fixed', inset: 0, display: 'grid', placeItems: 'center',
    background: 'radial-gradient(120% 100% at 50% 0%, rgba(247,147,26,0.18), rgba(26,20,17,0.92) 60%)',
    backdropFilter: 'blur(2px)', padding: 16, zIndex: 50, animation: 'fadeIn 0.5s ease',
  },
  card: {
    width: 'min(560px, 94vw)', maxHeight: '94vh', overflowY: 'auto',
    background: 'rgba(20,15,12,0.86)', border: '1px solid rgba(247,147,26,0.35)',
    borderRadius: 16, padding: '28px 26px', textAlign: 'center',
    boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
  },
  kicker: { fontFamily: 'var(--font-num)', letterSpacing: '0.22em', fontSize: 11, color: 'var(--btc)', opacity: 0.9 },
  title: { fontFamily: 'var(--font-title)', fontSize: 'clamp(38px, 8vw, 60px)', lineHeight: 1, margin: '8px 0 10px', color: 'var(--paper)' },
  tag: { fontFamily: 'var(--font-num)', fontSize: 14.5, lineHeight: 1.5, color: '#d8c7a6', margin: '0 auto 16px', maxWidth: 440 },
  label: { display: 'block', textAlign: 'left', fontFamily: 'var(--font-num)', fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#b6a98c', margin: '14px 0 6px' },
  input: {
    width: '100%', padding: '12px 14px', fontSize: 18, borderRadius: 10,
    background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(245,230,202,0.25)', color: 'var(--paper)', outline: 'none',
  },
  diffRow: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 },
  diff: { padding: '10px 6px', borderRadius: 10, border: '1px solid', color: 'var(--paper)', transition: 'all 0.15s ease', fontFamily: 'var(--font-num)' },
  diffLabel: { fontFamily: 'var(--font-title)', fontSize: 17, marginTop: 4, letterSpacing: '0.04em' },
  diffSub: { fontSize: 10, color: '#b6a98c', marginTop: 3, lineHeight: 1.3 },

  rigRow: { display: 'flex', gap: 12, alignItems: 'center' },
  previewCanvas: { width: 220, height: 150, borderRadius: 10, background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(245,230,202,0.15)', flexShrink: 0 },
  swatchWrap: { display: 'flex', flexWrap: 'wrap', gap: 8, alignContent: 'center', flex: 1 },
  swatch: { width: 34, height: 34, borderRadius: 8, border: '1px solid rgba(0,0,0,0.4)', cursor: 'pointer', transition: 'transform 0.12s ease' },
  swatchName: { width: '100%', fontFamily: 'var(--font-num)', fontSize: 12, color: '#b6a98c', marginTop: 2 },

  loadRow: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 },
  loadCard: { padding: '10px 8px', borderRadius: 10, border: '1px solid', color: 'var(--paper)', textAlign: 'left', transition: 'all 0.15s ease', fontFamily: 'var(--font-num)', cursor: 'pointer' },
  loadLabel: { fontFamily: 'var(--font-title)', fontSize: 16, letterSpacing: '0.03em' },
  loadBlurb: { fontSize: 9.5, color: '#b6a98c', margin: '2px 0 7px', lineHeight: 1.25, minHeight: 24 },
  loadStats: { display: 'flex', flexDirection: 'column', gap: 4 },
  statRow: { display: 'flex', alignItems: 'center', gap: 5 },
  statLabel: { width: 15, display: 'flex', justifyContent: 'center', color: 'rgba(255,255,255,0.7)' },
  statTrack: { flex: 1, height: 5, background: 'rgba(0,0,0,0.5)', borderRadius: 3, overflow: 'hidden' },
  statFill: { height: '100%', borderRadius: 3 },
  statVal: { fontSize: 10, color: '#d8c7a6', minWidth: 34, textAlign: 'right' },

  start: {
    width: '100%', marginTop: 20, padding: '15px', fontSize: 26, borderRadius: 12,
    background: 'var(--btc)', color: '#1a1411', boxShadow: '0 8px 24px rgba(247,147,26,0.35)',
  },
  lbBtn: {
    width: '100%', marginTop: 10, padding: '11px', fontSize: 18, borderRadius: 10,
    background: 'transparent', color: 'var(--paper)', border: '1px solid rgba(245,230,202,0.25)',
  },
  hint: { marginTop: 16, fontFamily: 'var(--font-num)', fontSize: 11.5, color: '#8c8068', letterSpacing: '0.05em' },
};
