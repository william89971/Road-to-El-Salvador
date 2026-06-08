import { useState } from 'react';

const DIFFICULTIES = [
  { id: 'tourist', label: 'Tourist', sub: 'Extra cash. A gentle cruise.', emoji: '🏖️' },
  { id: 'road_warrior', label: 'Road Warrior', sub: 'The intended way to play.', emoji: '🛻' },
  { id: 'satoshi', label: 'Satoshi', sub: 'Half the cash. Stay humble.', emoji: '🔥' },
];

export default function StartScreen({ onStart, onShowLeaderboard }) {
  const [name, setName] = useState('');
  const [difficulty, setDifficulty] = useState('road_warrior');

  const start = () => onStart((name || 'Anon').slice(0, 16), difficulty);

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
  title: { fontFamily: 'var(--font-title)', fontSize: 'clamp(40px, 9vw, 66px)', lineHeight: 1, margin: '8px 0 10px', color: 'var(--paper)' },
  tag: { fontFamily: 'var(--font-num)', fontSize: 15, lineHeight: 1.5, color: '#d8c7a6', margin: '0 auto 18px', maxWidth: 440 },
  label: { display: 'block', textAlign: 'left', fontFamily: 'var(--font-num)', fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#b6a98c', margin: '14px 0 6px' },
  input: {
    width: '100%', padding: '12px 14px', fontSize: 18, borderRadius: 10,
    background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(245,230,202,0.25)', color: 'var(--paper)', outline: 'none',
  },
  diffRow: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 },
  diff: { padding: '12px 6px', borderRadius: 10, border: '1px solid', color: 'var(--paper)', transition: 'all 0.15s ease', fontFamily: 'var(--font-num)' },
  diffLabel: { fontFamily: 'var(--font-title)', fontSize: 18, marginTop: 4, letterSpacing: '0.04em' },
  diffSub: { fontSize: 10.5, color: '#b6a98c', marginTop: 3, lineHeight: 1.3 },
  start: {
    width: '100%', marginTop: 22, padding: '15px', fontSize: 26, borderRadius: 12,
    background: 'var(--btc)', color: '#1a1411', boxShadow: '0 8px 24px rgba(247,147,26,0.35)',
  },
  lbBtn: {
    width: '100%', marginTop: 10, padding: '11px', fontSize: 18, borderRadius: 10,
    background: 'transparent', color: 'var(--paper)', border: '1px solid rgba(245,230,202,0.25)',
  },
  hint: { marginTop: 16, fontFamily: 'var(--font-num)', fontSize: 11.5, color: '#8c8068', letterSpacing: '0.05em' },
};
