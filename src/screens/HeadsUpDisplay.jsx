import { gameState, CONFIG } from '../game-engine/gameStateAndRules.js';
import BitcoinPriceSparkline from './BitcoinPriceSparkline.jsx';

function startCashFor(difficulty) {
  const mult = difficulty === 'satoshi' ? 0.5 : difficulty === 'tourist' ? 1.5 : 1;
  return Math.round(CONFIG.START_CASH * mult);
}

function Bar({ icon, value, max = 100, color, low }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const danger = low && value <= max * 0.2;
  return (
    <div style={s.barRow}>
      <span style={s.barIcon}>{icon}</span>
      <div style={s.barTrack}>
        <div
          style={{
            ...s.barFill,
            width: `${pct}%`,
            background: danger ? 'var(--danger)' : color,
            animation: danger ? 'blink 0.8s steps(1) infinite' : 'none',
          }}
        />
      </div>
      <span style={s.barNum}>{Math.round(value)}</span>
    </div>
  );
}

export default function HeadsUpDisplay({ onToggleMap, onTogglePause, onToggleMute, muted }) {
  const g = gameState;
  const start = startCashFor(g.difficulty);
  const now = Math.round(g.cash * (g.purchasingPower / 100)); // real purchasing power
  const ppPct = Math.round(g.purchasingPower);

  const btcValue = Math.round(g.btc * g.btcPrice);
  const btcStartValue = g.btc * CONFIG.START_BTC_PRICE;
  const btcPct = btcStartValue ? ((g.btc * g.btcPrice) / btcStartValue - 1) * 100 : 0;

  const progress = Math.min(100, (g.miles / CONFIG.TOTAL_MILES) * 100);

  return (
    <>
      {/* top-left: vehicle resources */}
      <div style={s.tl}>
        <Bar icon="⛽" value={g.gas} color="#e8b04a" low />
        <Bar icon="🛻" value={g.suvHealth} color="#7fa6c9" low />
        <div style={s.vibesRow}>
          <span style={s.barIcon}>😎</span>
          <div style={s.vibes}>
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} style={{ opacity: i < g.vibes ? 1 : 0.18, fontSize: 16 }}>😎</span>
            ))}
          </div>
        </div>
      </div>

      {/* top-right: HARD MONEY widget */}
      <div style={s.tr}>
        <div style={s.widgetTitle}>HARD&nbsp;MONEY</div>
        <div style={s.cols}>
          {/* fiat column */}
          <div style={s.col}>
            <div style={s.colHead}>💵 CASH</div>
            <div style={s.fiatLine}>
              <span style={s.dim}>${start}</span>
              <span style={s.arrow}>→</span>
              <span style={{ color: 'var(--danger)', fontWeight: 700 }}>${now}</span>
            </div>
            <div style={s.ppTrack}>
              <div style={{ ...s.ppFill, width: `${ppPct}%` }} />
            </div>
            <div style={s.sub}>purchasing power {ppPct}%</div>
          </div>

          {/* btc column */}
          <div style={s.col}>
            <div style={s.colHead}>₿ STACK</div>
            <div style={s.fiatLine}>
              <span style={s.dim}>{g.btc}</span>
              <span style={s.arrow}>→</span>
              <span style={{ color: 'var(--btc)', fontWeight: 700 }}>${btcValue.toLocaleString()}</span>
            </div>
            <div style={{ ...s.sub, color: btcPct >= 0 ? '#5ec27a' : 'var(--danger)' }}>
              {btcPct >= 0 ? '▲' : '▼'} {Math.abs(btcPct).toFixed(1)}% · ${g.btcPrice.toLocaleString()}
            </div>
          </div>
        </div>
        <div style={s.spark}>
          <BitcoinPriceSparkline data={g.btcPriceHistory} width={188} height={34} />
        </div>
      </div>

      {/* top-center controls */}
      <div style={s.controls}>
        <button style={s.ctrlBtn} onClick={onTogglePause} title="Pause">
          {g.paused ? '▶' : 'II'}
        </button>
        <button style={s.ctrlBtn} onClick={onToggleMute} title="Sound">
          {muted ? '🔇' : '🔊'}
        </button>
      </div>

      {/* bottom: progress */}
      <div style={s.bottom}>
        <button style={s.mapBtn} onClick={onToggleMap} title="Map">📍</button>
        <div style={s.progWrap}>
          <span style={s.progEnd}>LA</span>
          <div style={s.progTrack}>
            <div style={{ ...s.progFill, width: `${progress}%` }} />
            <div style={{ ...s.progDot, left: `calc(${progress}% - 6px)` }}>🛻</div>
          </div>
          <span style={s.progEnd}>🇸🇻</span>
        </div>
        <div style={s.progLabel}>
          {Math.round(g.miles)} / {CONFIG.TOTAL_MILES} mi · {g.currentCity} · Day {g.days}
        </div>
      </div>
    </>
  );
}

const panel = {
  background: 'rgba(20,15,12,0.62)',
  border: '1px solid rgba(247,147,26,0.28)',
  borderRadius: 12,
  backdropFilter: 'blur(4px)',
  fontFamily: 'var(--font-num)',
  color: 'var(--paper)',
};

const s = {
  tl: { ...panel, position: 'fixed', top: 12, left: 12, zIndex: 10, padding: '10px 12px', width: 190, display: 'flex', flexDirection: 'column', gap: 7 },
  barRow: { display: 'flex', alignItems: 'center', gap: 7 },
  barIcon: { width: 18, textAlign: 'center', fontSize: 14 },
  barTrack: { flex: 1, height: 9, background: 'rgba(0,0,0,0.5)', borderRadius: 5, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 5, transition: 'width 0.2s linear' },
  barNum: { width: 26, textAlign: 'right', fontSize: 12, fontWeight: 700 },
  vibesRow: { display: 'flex', alignItems: 'center', gap: 7 },
  vibes: { display: 'flex', gap: 1, flex: 1 },

  tr: { ...panel, position: 'fixed', top: 12, right: 12, zIndex: 10, padding: '10px 12px', width: 234 },
  widgetTitle: { fontFamily: 'var(--font-title)', fontSize: 15, letterSpacing: '0.14em', color: 'var(--btc)', textAlign: 'center', marginBottom: 6 },
  cols: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  col: { display: 'flex', flexDirection: 'column', gap: 3 },
  colHead: { fontSize: 11, letterSpacing: '0.08em', color: '#b6a98c' },
  fiatLine: { display: 'flex', alignItems: 'baseline', gap: 4, fontSize: 13 },
  dim: { color: '#9a8e74' },
  arrow: { color: '#9a8e74', fontSize: 11 },
  ppTrack: { height: 6, background: 'rgba(0,0,0,0.5)', borderRadius: 4, overflow: 'hidden', marginTop: 2 },
  ppFill: { height: '100%', background: 'var(--danger)', transition: 'width 0.3s linear' },
  sub: { fontSize: 10.5, color: '#b6a98c' },
  spark: { marginTop: 7, borderTop: '1px solid rgba(245,230,202,0.12)', paddingTop: 5 },

  controls: { position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 10, display: 'flex', gap: 8 },
  ctrlBtn: { ...panel, padding: '6px 12px', fontFamily: 'var(--font-num)', fontWeight: 700, fontSize: 13, cursor: 'pointer' },

  bottom: { ...panel, position: 'fixed', bottom: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 10, padding: '8px 12px', width: 'min(640px, 92vw)', display: 'flex', alignItems: 'center', gap: 10 },
  mapBtn: { background: 'transparent', border: '1px solid rgba(245,230,202,0.25)', borderRadius: 8, padding: '6px 8px', fontSize: 16, cursor: 'pointer' },
  progWrap: { flex: 1, display: 'flex', alignItems: 'center', gap: 8 },
  progEnd: { fontSize: 13, opacity: 0.8 },
  progTrack: { position: 'relative', flex: 1, height: 10, background: 'rgba(0,0,0,0.5)', borderRadius: 6 },
  progFill: { height: '100%', background: 'linear-gradient(90deg, var(--cash), var(--btc))', borderRadius: 6, transition: 'width 0.2s linear' },
  progDot: { position: 'absolute', top: -7, fontSize: 14, transition: 'left 0.2s linear' },
  progLabel: { fontSize: 11, color: '#b6a98c', whiteSpace: 'nowrap' },
};
