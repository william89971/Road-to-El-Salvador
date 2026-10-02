import { useEffect, useRef, useState } from 'react';
import { gameState, CONFIG } from '../game-engine/gameStateAndRules.js';
import { gallonQuote } from '../game-engine/money.js';
import { clearCheckpoint } from '../game-engine/runSave.js';

function drawShareCard(canvas, g) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = '#1a1411';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#f7931a';
  ctx.fillRect(0, 0, w, 14);

  ctx.fillStyle = '#f7931a';
  ctx.font = '28px Georgia, serif';
  ctx.fillText('ROAD TO EL SALVADOR', 64, 78);

  ctx.fillStyle = '#f5e6ca';
  ctx.font = 'bold 68px Georgia, serif';
  ctx.fillText(g.playerName || 'Anon', 64, 168);

  const btcValue = Math.round(g.btc * g.btcPrice);
  ctx.fillStyle = '#f7931a';
  ctx.font = 'bold 64px Georgia, serif';
  ctx.fillText(`$${btcValue.toLocaleString()}`, 64, 258);
  ctx.fillStyle = '#d8c7a6';
  ctx.font = '26px Georgia, serif';
  ctx.fillText('final stack', 64, 298);

  const start = gallonQuote(100, CONFIG.START_BTC_PRICE);
  const now = gallonQuote(g.purchasingPower, g.btcPrice);
  ctx.fillStyle = '#f5e6ca';
  ctx.font = '34px Georgia, serif';
  ctx.fillText(`${start.sats.toLocaleString()} sats  →  ${now.sats.toLocaleString()} sats`, 64, 390);
  ctx.fillStyle = '#b6a98c';
  ctx.font = '26px Georgia, serif';
  ctx.fillText(`a gallon was $${start.dollars} in Los Angeles · $${now.dollars.toLocaleString()} at the border`, 64, 440);
  ctx.fillText(`cash still buys ${Math.round(g.purchasingPower)}% of what it did`, 64, 488);
  if (g.paidLastGallonInSats) {
    ctx.fillStyle = '#5ec27a';
    ctx.fillText('The last gallon was paid in sats.', 64, 556);
  }
}

export default function VictoryScreen({ onRestart, onMenu, onShowLeaderboard }) {
  const g = gameState;
  const canvasRef = useRef(null);
  const [shared, setShared] = useState(false);

  const btcValue = Math.round(g.btc * g.btcPrice);
  const startValue = Math.round((g.startBtc ?? g.btc) * CONFIG.START_BTC_PRICE);
  const btcPct = startValue ? Math.round((btcValue / startValue - 1) * 100) : 0;
  const ppLeft = Math.round(g.purchasingPower);
  const startGallon = gallonQuote(100, CONFIG.START_BTC_PRICE);
  const nowGallon = gallonQuote(g.purchasingPower, g.btcPrice);

  useEffect(() => {
    clearCheckpoint();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = 1200;
    canvas.height = 630;
    drawShareCard(canvas, gameState);
  }, []);

  const shareText = `I drove from LA to El Salvador in Bitcoin Road Trip 🛻₿\n` +
    `${g.playerName}: ${g.btc} BTC ($${btcValue.toLocaleString()}) · ` +
    `gallon ${startGallon.sats.toLocaleString()} → ${nowGallon.sats.toLocaleString()} sats · ` +
    `cash purchasing power ${ppLeft}%`;

  const share = async () => {
    const canvas = canvasRef.current;
    try {
      const blob = canvas ? await new Promise((resolve) => canvas.toBlob(resolve, 'image/png')) : null;
      if (blob && typeof navigator.canShare === 'function') {
        const file = new File([blob], 'road-to-el-salvador.png', { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], text: shareText });
          return;
        }
      }
      if (blob && navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setShared(true);
        return;
      }
      if (navigator.share) await navigator.share({ text: shareText });
      else if (navigator.clipboard) { await navigator.clipboard.writeText(shareText); setShared(true); }
    } catch { /* user dismissed the share sheet */ }
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

        <canvas ref={canvasRef} style={st.shareCard} />

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
            <div style={st.hLabel}>GALLON IN SATS</div>
            <div style={st.hValue}>{nowGallon.sats.toLocaleString()}</div>
            <div style={st.hSub}>was {startGallon.sats.toLocaleString()} in Los Angeles</div>
          </div>
        </div>

        <div style={st.stats}>
          <Stat label="Driver" value={g.playerName || 'Anon'} />
          <Stat label="Days" value={g.days} />
          <Stat label="Cash left" value={`${ppLeft}%`} />
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
  tag: { fontFamily: 'var(--font-news)', fontStyle: 'italic', fontSize: 16, color: '#d8c7a6', margin: '0 auto 16px', maxWidth: 420, lineHeight: 1.5 },
  shareCard: { width: '100%', height: 'auto', borderRadius: 12, marginBottom: 16, border: '1px solid rgba(247,147,26,0.35)' },
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
