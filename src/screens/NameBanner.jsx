import { useEffect, useState } from 'react';

// Cinematic full-width city name reveal shown on arrival, before the shop opens.
// Fades in, holds, fades out over ~3s (GameController unmounts it after).
export default function NameBanner({ stop }) {
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const t0 = setTimeout(() => setVis(true), 30);
    const t1 = setTimeout(() => setVis(false), 2600);
    return () => { clearTimeout(t0); clearTimeout(t1); };
  }, [stop]);

  if (!stop) return null;
  return (
    <div style={{ ...st.wrap, opacity: vis ? 1 : 0 }}>
      <div style={st.inner}>
        <div style={st.flag}>{stop.flag}</div>
        <div style={st.name}>{stop.name}</div>
        <div style={st.country}>{stop.country}</div>
        <div style={st.rule} />
        <div style={st.flavor}>{stop.flavor}</div>
      </div>
    </div>
  );
}

const st = {
  wrap: {
    position: 'fixed', inset: 0, zIndex: 46, display: 'grid', placeItems: 'center',
    pointerEvents: 'none', transition: 'opacity 0.6s ease',
    background: 'radial-gradient(120% 60% at 50% 50%, rgba(26,20,17,0.55), rgba(26,20,17,0) 70%)',
  },
  inner: { textAlign: 'center', color: 'var(--paper)' },
  flag: { fontSize: 48, marginBottom: 4 },
  name: { fontFamily: 'var(--font-title)', fontSize: 'clamp(48px, 11vw, 96px)', lineHeight: 1, letterSpacing: '0.04em', textShadow: '0 6px 30px rgba(0,0,0,0.7)' },
  country: { fontFamily: 'var(--font-num)', letterSpacing: '0.3em', fontSize: 13, color: 'var(--btc)', textTransform: 'uppercase', marginTop: 4 },
  rule: { width: 120, height: 2, background: 'var(--btc)', margin: '12px auto' },
  flavor: { fontFamily: 'var(--font-news)', fontStyle: 'italic', fontSize: 'clamp(15px, 2.4vw, 19px)', color: '#e8dcc4', maxWidth: 560, margin: '0 auto', padding: '0 20px', lineHeight: 1.4 },
};
