import { useEffect, useState } from 'react';
import { topRuns } from '../game-engine/leaderboardStorage.js';

export default function LeaderboardScreen({ onClose }) {
  const [runs, setRuns] = useState(null); // null = loading

  useEffect(() => {
    let alive = true;
    topRuns(10).then((r) => { if (alive) setRuns(r); });
    return () => { alive = false; };
  }, []);

  const hasStorage = typeof window !== 'undefined' && !!window.storage;

  return (
    <div style={st.wrap} onClick={onClose}>
      <div style={st.panel} onClick={(e) => e.stopPropagation()}>
        <div style={st.header}>
          <div style={st.title}>🏆 TOP STACKS</div>
          <button style={st.close} onClick={onClose}>✕</button>
        </div>

        {runs === null ? (
          <div style={st.empty}>Loading…</div>
        ) : runs.length === 0 ? (
          <div style={st.empty}>
            No runs recorded yet.
            {!hasStorage && (
              <div style={st.note}>The shared leaderboard is available when the game runs as a Claude artifact.</div>
            )}
          </div>
        ) : (
          <ol style={st.list}>
            {runs.map((r, i) => (
              <li key={i} style={st.row}>
                <span style={st.rank}>{['🥇', '🥈', '🥉'][i] || `#${i + 1}`}</span>
                <span style={st.name}>{r.name}</span>
                <span style={st.val}>${(r.btcValue || 0).toLocaleString()}</span>
                <span style={st.meta}>{r.btc} BTC · {r.pp}% · D{r.days}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

const st = {
  wrap: { position: 'fixed', inset: 0, zIndex: 80, display: 'grid', placeItems: 'center', background: 'rgba(26,20,17,0.7)', backdropFilter: 'blur(3px)', padding: 16, animation: 'fadeIn 0.25s ease' },
  panel: { width: 'min(440px, 94vw)', maxHeight: '88vh', overflowY: 'auto', background: 'rgba(20,15,12,0.96)', border: '1px solid rgba(247,147,26,0.4)', borderRadius: 16, padding: 18, color: 'var(--paper)', fontFamily: 'var(--font-num)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontFamily: 'var(--font-title)', fontSize: 24, letterSpacing: '0.1em', color: 'var(--btc)' },
  close: { background: 'transparent', color: 'var(--paper)', fontSize: 18, padding: '2px 8px', border: '1px solid rgba(245,230,202,0.25)', borderRadius: 8 },
  empty: { textAlign: 'center', padding: '28px 12px', color: '#b6a98c', fontSize: 15 },
  note: { fontSize: 12, marginTop: 10, color: '#8c8068' },
  list: { listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 },
  row: { display: 'grid', gridTemplateColumns: '34px 1fr auto', gridTemplateRows: 'auto auto', columnGap: 8, alignItems: 'center', background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(245,230,202,0.12)', borderRadius: 9, padding: '8px 12px' },
  rank: { gridRow: '1 / 3', fontSize: 18, textAlign: 'center' },
  name: { fontFamily: 'var(--font-title)', fontSize: 18, letterSpacing: '0.03em' },
  val: { fontFamily: 'var(--font-num)', fontWeight: 700, color: 'var(--btc)', fontSize: 16, gridRow: '1 / 3', textAlign: 'right' },
  meta: { gridColumn: '2 / 3', fontSize: 11, color: '#9a8e74' },
};
