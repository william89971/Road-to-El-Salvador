import { gameState, CONFIG } from '../game-engine/gameStateAndRules.js';
import { ROUTE } from '../map-data/citiesAndRoute.js';

// Interpolated SVG position of the SUV between the two route nodes it's between.
function suvPos(miles) {
  let a = ROUTE[0], b = ROUTE[ROUTE.length - 1];
  for (let i = 0; i < ROUTE.length - 1; i++) {
    if (miles >= ROUTE[i].mile && miles <= ROUTE[i + 1].mile) { a = ROUTE[i]; b = ROUTE[i + 1]; break; }
    if (miles > ROUTE[ROUTE.length - 1].mile) { a = b = ROUTE[ROUTE.length - 1]; }
  }
  const span = (b.mile - a.mile) || 1;
  const t = Math.max(0, Math.min(1, (miles - a.mile) / span));
  return { x: a.svgX + (b.svgX - a.svgX) * t, y: a.svgY + (b.svgY - a.svgY) * t };
}

export default function RouteMapScreen({ onClose }) {
  const g = gameState;
  const pos = suvPos(g.miles);
  const path = ROUTE.map((r, i) => `${i ? 'L' : 'M'} ${r.svgX} ${r.svgY}`).join(' ');
  const reachedTo = g.lastStopIndex;

  return (
    <div style={st.wrap} onClick={onClose}>
      <div style={st.panel} onClick={(e) => e.stopPropagation()}>
        <div style={st.header}>
          <div style={st.title}>THE ROUTE</div>
          <button style={st.close} onClick={onClose}>✕</button>
        </div>

        <svg viewBox="0 0 300 600" style={st.svg} preserveAspectRatio="xMidYMid meet">
          {/* full route (dim) */}
          <path d={path} fill="none" stroke="rgba(245,230,202,0.22)" strokeWidth="3" strokeDasharray="6 5" strokeLinecap="round" />
          {/* traveled portion */}
          <path d={path} fill="none" stroke="var(--btc)" strokeWidth="3.5" strokeLinecap="round"
            style={{ strokeDasharray: 2000, strokeDashoffset: 2000 * (1 - g.miles / CONFIG.TOTAL_MILES) }} />

          {ROUTE.map((r, i) => {
            const done = i <= reachedTo;
            return (
              <g key={r.name}>
                <circle cx={r.svgX} cy={r.svgY} r={i === ROUTE.length - 1 ? 7 : 5}
                  fill={done ? 'var(--btc)' : '#3a332b'} stroke={r.dangerous ? 'var(--danger)' : 'rgba(245,230,202,0.5)'} strokeWidth="1.6" />
                <text x={r.svgX + 11} y={r.svgY + 4} fontSize="11" fill={done ? 'var(--paper)' : '#8c8068'} fontFamily="var(--font-num)">
                  {r.flag} {r.name}
                </text>
              </g>
            );
          })}

          {/* pulsing current position */}
          <circle cx={pos.x} cy={pos.y} r="9" fill="none" stroke="var(--btc)" strokeWidth="2" style={{ transformOrigin: `${pos.x}px ${pos.y}px`, animation: 'pulse 1.4s ease-in-out infinite' }} />
          <circle cx={pos.x} cy={pos.y} r="4" fill="#fff" />
        </svg>

        <div style={st.footer}>
          📍 {g.currentCity} · {Math.round(g.miles)} / {CONFIG.TOTAL_MILES} mi · Day {g.days}
        </div>
      </div>
    </div>
  );
}

const st = {
  wrap: { position: 'fixed', inset: 0, zIndex: 35, display: 'grid', placeItems: 'center', background: 'rgba(26,20,17,0.6)', backdropFilter: 'blur(2px)', padding: 16, animation: 'fadeIn 0.25s ease' },
  panel: { width: 'min(360px, 92vw)', maxHeight: '90vh', background: 'rgba(20,15,12,0.95)', border: '1px solid rgba(247,147,26,0.4)', borderRadius: 16, padding: 16, color: 'var(--paper)', fontFamily: 'var(--font-num)', display: 'flex', flexDirection: 'column' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontFamily: 'var(--font-title)', fontSize: 22, letterSpacing: '0.12em', color: 'var(--btc)' },
  close: { background: 'transparent', color: 'var(--paper)', fontSize: 18, padding: '2px 8px', border: '1px solid rgba(245,230,202,0.25)', borderRadius: 8 },
  svg: { width: '100%', height: 'auto', maxHeight: '64vh', background: 'rgba(0,0,0,0.25)', borderRadius: 10 },
  footer: { marginTop: 10, fontSize: 12.5, color: '#b6a98c', textAlign: 'center' },
};
