import { useState } from 'react';
import { FuelIcon, RigIcon, CrewIcon, CashIcon, BtcIcon } from './Icons.jsx';

// Jagged "torn paper" top edge as a clip-path polygon string.
function tornTop() {
  const pts = ['0% 100%', '0% 30%'];
  for (let x = 0; x <= 100; x += 5) {
    const y = (x / 5) % 2 === 0 ? 18 : 60; // alternate up/down
    pts.push(`${x}% ${y}%`);
  }
  pts.push('100% 30%', '100% 100%');
  return `polygon(${pts.join(',')})`;
}
const TORN = tornTop();

export default function NewspaperEventCard({ event, onChoose, onFight }) {
  const [chosen, setChosen] = useState(null);

  if (!event) return null;

  const pick = (choice) => {
    if (chosen) return;
    setChosen(choice);
    setTimeout(() => onChoose(choice.effects, event), 1150);
  };

  return (
    <div style={st.wrap}>
      <div style={st.card}>
        <div style={st.torn} />
        <div style={st.masthead}>THE DAILY LEDGER</div>
        <div style={st.rule} />

        <h2 style={st.headline}>{event.headline}</h2>
        <div style={st.dateline}>{event.dateline}</div>
        <p style={st.body}>{event.description}</p>

        {chosen ? (
          <div style={st.outcome}>
            <div style={st.outcomeLabel}>“{chosen.label}”</div>
            <div style={st.outcomeText}>{chosen.consequence}</div>
            {renderEffects(chosen.effects)}
          </div>
        ) : (
          <div style={st.choices}>
            {event.choices.map((c, i) => (
              <button key={i} style={st.choice} onClick={() => pick(c)}>
                {c.label}
              </button>
            ))}
            {event.canFight && (
              <button style={{ ...st.choice, ...st.fight }} onClick={onFight}>
                🔫 Stand your ground
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const EFFECT_ICONS = { gas: FuelIcon, suvHealth: RigIcon, vibes: CrewIcon, cash: CashIcon, btc: BtcIcon };

function renderEffects(effects) {
  if (!effects) return null;
  const items = Object.entries(effects).filter(([, v]) => v);
  if (!items.length) return null;
  return (
    <div style={st.effects}>
      {items.map(([k, v]) => {
        const Icon = EFFECT_ICONS[k];
        return (
          <span key={k} style={{ ...st.effect, color: v > 0 ? '#2f7d4f' : 'var(--danger)' }}>
            <span style={{ display: 'inline-flex', verticalAlign: '-2px' }}>{Icon ? <Icon size={15} /> : '📉'}</span>
            {' '}{v > 0 ? '+' : ''}{k === 'cash' ? `$${v}` : v}
          </span>
        );
      })}
    </div>
  );
}

const st = {
  wrap: { position: 'fixed', inset: 0, zIndex: 45, display: 'grid', placeItems: 'center', background: 'rgba(26,20,17,0.7)', backdropFilter: 'blur(3px)', padding: 16 },
  card: {
    '--rot': '-1.6deg',
    position: 'relative', width: 'min(440px, 92vw)', background: 'var(--paper)', color: 'var(--ink)',
    padding: '26px 26px 22px', borderRadius: 3, transform: 'rotate(-1.6deg)',
    boxShadow: '0 26px 70px rgba(0,0,0,0.6), inset 0 0 60px rgba(120,90,40,0.08)',
    animation: 'cardDrop 0.45s cubic-bezier(.2,.9,.3,1.2)',
  },
  torn: { position: 'absolute', top: -11, left: 0, right: 0, height: 14, background: 'var(--paper)', clipPath: TORN },
  masthead: { fontFamily: 'var(--font-news)', fontWeight: 900, textAlign: 'center', letterSpacing: '0.16em', fontSize: 13, textTransform: 'uppercase', color: '#3a3a3a' },
  rule: { height: 3, background: 'var(--ink)', margin: '6px 0 12px', borderTop: '1px solid #777', borderBottom: '1px solid #777' },
  headline: { fontFamily: 'var(--font-news)', fontWeight: 900, fontSize: 'clamp(22px, 5.5vw, 30px)', lineHeight: 1.08, textAlign: 'center', color: 'var(--ink)' },
  dateline: { fontFamily: 'var(--font-num)', fontSize: 11.5, letterSpacing: '0.08em', textAlign: 'center', color: '#6a5d45', margin: '8px 0 12px', textTransform: 'uppercase' },
  body: { fontFamily: 'var(--font-news)', fontStyle: 'italic', fontSize: 15.5, lineHeight: 1.5, textAlign: 'center', color: '#2b2b2b', borderTop: '1px solid #cbb78f', borderBottom: '1px solid #cbb78f', padding: '12px 4px' },
  choices: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 },
  choice: { padding: '12px 14px', fontSize: 17, borderRadius: 6, background: 'var(--ink)', color: 'var(--paper)', fontFamily: 'var(--font-title)', letterSpacing: '0.03em', transition: 'transform 0.1s ease' },
  fight: { background: 'var(--danger)' },
  outcome: { marginTop: 16, textAlign: 'center', animation: 'fadeIn 0.3s ease' },
  outcomeLabel: { fontFamily: 'var(--font-title)', fontSize: 20, color: 'var(--ink)' },
  outcomeText: { fontFamily: 'var(--font-news)', fontStyle: 'italic', fontSize: 15, color: '#3a3a3a', marginTop: 4 },
  effects: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 12 },
  effect: { fontFamily: 'var(--font-num)', fontWeight: 700, fontSize: 15 },
};
