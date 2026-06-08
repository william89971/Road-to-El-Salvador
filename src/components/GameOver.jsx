import { gameState, CONFIG } from '../game/gameState.js';

export default function GameOver({ onRestart, onMenu }) {
  const g = gameState;
  const btcValue = Math.round(g.btc * g.btcPrice);
  const pct = Math.round((g.miles / CONFIG.TOTAL_MILES) * 100);

  return (
    <div style={st.wrap}>
      <div style={st.card}>
        <div style={st.skull}>💀</div>
        <h1 style={st.title}>ROAD'S END</h1>
        <p style={st.reason}>{g.gameoverReason}</p>

        <div style={st.stats}>
          <Stat label="Made it" value={`${pct}%`} sub={`${Math.round(g.miles)} mi`} />
          <Stat label="Last seen" value={g.currentCity} sub={g.currentCountry} />
          <Stat label="Days" value={g.days} />
          <Stat label="₿ stack" value={`$${btcValue.toLocaleString()}`} sub={`${g.btc} BTC`} />
          <Stat label="Events" value={g.eventsSurvived} />
          <Stat label="Enemies" value={g.enemiesDefeated} />
        </div>

        <div style={st.btns}>
          <button style={st.retry} onClick={onRestart}>↻ TRY AGAIN</button>
          <button style={st.menu} onClick={onMenu}>MAIN MENU</button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div style={st.stat}>
      <div style={st.statLabel}>{label}</div>
      <div style={st.statValue}>{value}</div>
      {sub && <div style={st.statSub}>{sub}</div>}
    </div>
  );
}

const st = {
  wrap: { position: 'fixed', inset: 0, zIndex: 60, display: 'grid', placeItems: 'center', background: 'radial-gradient(120% 100% at 50% 0%, rgba(192,57,43,0.25), rgba(26,20,17,0.96) 60%)', padding: 16, animation: 'fadeIn 0.5s ease' },
  card: { width: 'min(480px, 94vw)', textAlign: 'center', color: 'var(--paper)', fontFamily: 'var(--font-num)' },
  skull: { fontSize: 64, animation: 'pulse 2s ease-in-out infinite' },
  title: { fontFamily: 'var(--font-title)', fontSize: 'clamp(44px, 11vw, 72px)', color: 'var(--danger)', lineHeight: 1, margin: '4px 0 10px' },
  reason: { fontFamily: 'var(--font-news)', fontStyle: 'italic', fontSize: 17, color: '#d8c7a6', margin: '0 auto 22px', maxWidth: 380 },
  stats: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 24 },
  stat: { background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(245,230,202,0.15)', borderRadius: 10, padding: '12px 6px' },
  statLabel: { fontSize: 10.5, color: '#b6a98c', letterSpacing: '0.08em', textTransform: 'uppercase' },
  statValue: { fontFamily: 'var(--font-title)', fontSize: 22, marginTop: 3 },
  statSub: { fontSize: 11, color: '#9a8e74', marginTop: 1 },
  btns: { display: 'flex', gap: 10, justifyContent: 'center' },
  retry: { padding: '14px 24px', fontSize: 22, borderRadius: 12, background: 'var(--btc)', color: '#1a1411' },
  menu: { padding: '14px 24px', fontSize: 22, borderRadius: 12, background: 'transparent', color: 'var(--paper)', border: '1px solid rgba(245,230,202,0.3)' },
};
