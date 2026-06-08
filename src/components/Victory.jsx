import { useState } from 'react';
import { gameState, CONFIG } from '../game/gameState.js';

export default function Victory({ onRestart, onMenu, onShowLeaderboard }) {
  const g = gameState;
  const [shared, setShared] = useState(false);

  const btcValue = Math.round(g.btc * g.btcPrice);
  const btcPct = Math.round((g.btcPrice / CONFIG.START_BTC_PRICE - 1) * 100);
  const ppLeft = Math.round(g.purchasingPower);

  const share = async () => {
    const text = `I drove from LA to El Salvador in Bitcoin Road Trip 🛻₿\n` +
      `${g.playerName}: ${g.btc} BTC ($${btcValue.toLocaleString()}) · Day ${g.days} · cash purchasing power ${ppLeft}%`;
    try {
      if (navigator.share) await navigator.share({ text });
      else if (navigator.clipboard) { await navigator.clipboard.writeText(text); setShared(true); }
    } catch { /* user dismissed */ }
  };

  return (
    <div style={st.wrap}>
      <div style={st.card}>
        <div style={st.flag}>🇸🇻</div>
        <div style={st.kicker}>EL SALVADOR · DAY {g.days}</div>
        <h1 style={st.title}>YOU MADE IT</h1>
        <p style={st.tag}>
          2,800 miles. Bitcoin ATMs on every corner. The beach is 45 minutes away —
          and your stack outran the printing press.
        </p>

        <div style={st.headline}>
          <div style={st.hStack}>
            <div style={st.hLabel}>FINAL STACK</div>
            <div style={st.hValue}>${btcValue.toLocaleString()}</div>
            <div style={{ ...st.hSub, color: btcPct >= 0 ? '#5ec27a' : 'var(--danger)' }}>
              {btcPct >= 0 ? '▲' : '▼'} {Math.abs(btcPct)}% · {g.btc} BTC
            </div>
          </div>
          <div style={st.vs}>vs</div>
          <div style={st.hStack}>
            <div style={st.hLabel}>CASH POWER</div>
            <div style={{ ...st.hValue, color: 'var(--danger)' }}>{ppLeft}%</div>
            <div style={st.hSub}>of what you started with</div>
          </div>
        </div>

        <div style={st.stats}>
          <Stat label="Driver" value={g.playerName || 'Anon'} />
          <Stat label="Days" value={g.days} />
          <Stat label="Vibes" value={`${g.vibes}/5`} />
          <Stat label="Events" value={g.eventsSurvived} />
          <Stat label="Enemies" value={g.enemiesDefeated} />
          <Stat label="Difficulty" value={pretty(g.difficulty)} />
        </div>

        <div style={st.btns}>
          <button style={st.share} onClick={share}>{shared ? '✓ Copied!' : '🔗 Share'}</button>
          {onShowLeaderboard && <button style={st.menu} onClick={onShowLeaderboard}>🏆 Board</button>}
          <button style={st.play} onClick={onRestart}>↻ Again</button>
          <button style={st.menu} onClick={onMenu}>Menu</button>
        </div>
      </div>
    </div>
  );
}

function pretty(d) {
  return d === 'satoshi' ? 'Satoshi' : d === 'tourist' ? 'Tourist' : 'Road Warrior';
}

function Stat({ label, value }) {
  return (
    <div style={st.stat}>
      <div style={st.statLabel}>{label}</div>
      <div style={st.statValue}>{value}</div>
    </div>
  );
}

const st = {
  wrap: { position: 'fixed', inset: 0, zIndex: 60, display: 'grid', placeItems: 'center', overflowY: 'auto', background: 'radial-gradient(120% 100% at 50% 0%, rgba(247,147,26,0.25), rgba(26,20,17,0.96) 60%)', padding: 16, animation: 'fadeIn 0.6s ease' },
  card: { width: 'min(520px, 95vw)', textAlign: 'center', color: 'var(--paper)', fontFamily: 'var(--font-num)' },
  flag: { fontSize: 56 },
  kicker: { fontSize: 12, letterSpacing: '0.22em', color: 'var(--btc)', marginTop: 4 },
  title: { fontFamily: 'var(--font-title)', fontSize: 'clamp(48px, 12vw, 80px)', lineHeight: 1, margin: '4px 0 10px', color: 'var(--paper)' },
  tag: { fontFamily: 'var(--font-news)', fontStyle: 'italic', fontSize: 16, color: '#d8c7a6', margin: '0 auto 20px', maxWidth: 420, lineHeight: 1.5 },
  headline: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(247,147,26,0.3)', borderRadius: 14, padding: '16px 12px', marginBottom: 16 },
  hStack: { flex: 1 },
  hLabel: { fontSize: 10.5, letterSpacing: '0.1em', color: '#b6a98c' },
  hValue: { fontFamily: 'var(--font-title)', fontSize: 30, color: 'var(--btc)', lineHeight: 1.1 },
  hSub: { fontSize: 11.5, marginTop: 2, color: '#b6a98c' },
  vs: { fontFamily: 'var(--font-news)', fontStyle: 'italic', fontSize: 14, color: '#9a8e74' },
  stats: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 18 },
  stat: { background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(245,230,202,0.13)', borderRadius: 9, padding: '9px 4px' },
  statLabel: { fontSize: 10, color: '#b6a98c', letterSpacing: '0.06em', textTransform: 'uppercase' },
  statValue: { fontFamily: 'var(--font-title)', fontSize: 18, marginTop: 2 },
  btns: { display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  share: { padding: '12px 18px', fontSize: 18, borderRadius: 10, background: 'var(--cash)', color: '#fff' },
  play: { padding: '12px 18px', fontSize: 18, borderRadius: 10, background: 'var(--btc)', color: '#1a1411' },
  menu: { padding: '12px 18px', fontSize: 18, borderRadius: 10, background: 'transparent', color: 'var(--paper)', border: '1px solid rgba(245,230,202,0.3)' },
};
