import { useEffect, useState } from 'react';
import { gameState, CONFIG } from '../game-engine/gameStateAndRules.js';
import { spendCash, spendBtc, refuel, repairSUV, adjustVibes } from '../game-engine/gameActions.js';
import { gallonQuote } from '../game-engine/money.js';
import { ROUTE } from '../map-data/citiesAndRoute.js';
import { FuelIcon } from './Icons.jsx';
import { audio } from '../game-engine/soundEffects.js';

const BASES = { refuel: 40, repair: 80 };

export default function CityStopShop({ index, onContinue }) {
  const stop = ROUTE[index];
  const [, bump] = useState(0);
  const [ready, setReady] = useState(!stop.isBorder); // border stops show a wait bar first

  useEffect(() => {
    if (stop.isBorder) {
      const t = setTimeout(() => setReady(true), 1500);
      return () => clearTimeout(t);
    }
  }, [stop.isBorder]);

  const fuel = gallonQuote(gameState.purchasingPower, gameState.btcPrice, BASES.refuel);
  const repair = gallonQuote(gameState.purchasingPower, gameState.btcPrice, BASES.repair);
  const refuelCost = fuel.dollars;
  const repairCost = repair.dollars;

  const buy = (kind) => {
    const g = gameState;
    if (kind === 'refuel' && g.cash >= refuelCost && g.gas < 100) {
      spendCash(refuelCost);
      refuel();
      audio.refuel();
    } else if (kind === 'refuel-sats' && g.btc * 1e8 >= fuel.sats && g.gas < 100) {
      spendBtc(fuel.sats / 1e8);
      gameState.paidLastGallonInSats = true;
      refuel();
      audio.refuel();
    } else if (kind === 'repair' && g.cash >= repairCost && g.suvHealth < 100) {
      spendCash(repairCost);
      repairSUV();
    } else if (kind === 'rest' && g.vibes < 5) {
      adjustVibes(1);
    }
    bump((n) => n + 1);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (!ready) {
        if (e.key === 'Enter') setReady(true);
        return;
      }
      if (e.key === '1') buy('refuel');
      else if (e.key === '2') buy('repair');
      else if (e.key === '3') buy('rest');
      else if (e.key === 'Enter') onContinue();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const g = gameState;
  const next = ROUTE[index + 1];
  const gapMi = next ? next.mile - g.miles : 0;
  const rangeMi = g.gas / CONFIG.GAS_PER_MILE;
  const shortOnFuel = Boolean(next) && rangeMi + 1 < gapMi;
  const lastLeg = next?.name === 'San Salvador';
  const canPaySats = lastLeg && g.gas < 100 && g.cash < refuelCost && g.btc * 1e8 >= fuel.sats;

  return (
    <div style={st.wrap}>
      <style>{`@media (max-width: 520px) { .shop-services { grid-template-columns: 1fr !important; } }`}</style>
      <div style={st.card}>
        {stop.dangerous && <div style={st.dangerBanner}>⚠ DANGEROUS REGION</div>}
        <div style={st.head}>
          <span style={st.flag}>{stop.flag}</span>
          <div>
            <div style={st.city}>{stop.name}</div>
            <div style={st.country}>{stop.country}</div>
          </div>
        </div>

        <p style={st.flavor}>{stop.flavor}</p>
        {stop.lesson && <p style={st.lesson}>{stop.lesson}</p>}

        {stop.isBorder && !ready ? (
          <div style={st.borderBox} onClick={() => setReady(true)} role="button" tabIndex={0}>
            <div style={st.borderTitle}>🛂 Waiting at the border…</div>
            <div style={st.waitTrack}><div style={st.waitFill} /></div>
            <div style={st.borderHint}>Click or Enter to stamp through</div>
          </div>
        ) : (
          <>
            <div style={st.inflNote}>
              Local inflation <b>+{Math.round(100 / (g.purchasingPower / 100) - 100)}%</b> · Cash ${Math.round(g.cash)}
            </div>
            {next && (
              <div style={{ ...st.rangeNote, color: shortOnFuel ? 'var(--danger)' : '#d8c7a6' }}>
                {shortOnFuel ? 'You will not reach ' : 'Next stop: '}
                <b>{next.name}</b>
                {` · ${Math.round(gapMi)} mi · your range ${Math.round(rangeMi)} mi`}
              </div>
            )}

            <div style={st.services} className="shop-services">
              <Service
                icon={<FuelIcon size={26} />} label="Refuel" detail={g.gas >= 100 ? 'Tank full' : 'Fill to 100%'}
                price={refuelCost} sats={fuel.sats} disabled={g.gas >= 100 || g.cash < refuelCost}
                onClick={() => buy('refuel')}
              />
              <Service
                icon="🔧" label="Repair" detail={g.suvHealth >= 100 ? 'In good shape' : 'Fix the SUV'}
                price={repairCost} disabled={g.suvHealth >= 100 || g.cash < repairCost}
                onClick={() => buy('repair')}
              />
              <Service
                icon="😴" label="Rest" detail={g.vibes >= 5 ? 'Spirits high' : '+1 vibe'}
                price={0} disabled={g.vibes >= 5}
                onClick={() => buy('rest')}
              />
            </div>

            {canPaySats && (
              <button style={st.satsBtn} onClick={() => buy('refuel-sats')}>
                PAY THE LAST GALLON IN SATS · {fuel.sats.toLocaleString()}
              </button>
            )}
            {lastLeg && !canPaySats && g.gas < 100 && (
              <div style={st.lesson}>The last gallon can be paid in sats if the dollars will not cover it.</div>
            )}

            <button style={st.continue} onClick={onContinue}>
              {stop.dangerous ? 'PUSH THROUGH ▸' : 'BACK ON THE ROAD ▸'}
            </button>
            {stop.dangerous && <div style={st.dangerHint}>Trouble may be waiting on the way out.</div>}
          </>
        )}
      </div>
    </div>
  );
}

function Service({ icon, label, detail, price, sats, disabled, onClick }) {
  return (
    <button style={{ ...st.service, opacity: disabled ? 0.45 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
      onClick={disabled ? undefined : onClick} disabled={disabled}>
      <div style={{ fontSize: 26 }}>{icon}</div>
      <div style={st.svcLabel}>{label}</div>
      <div style={st.svcDetail}>{detail}</div>
      <div style={st.svcPrice}>{price > 0 ? `$${price}` : 'FREE'}</div>
      {sats > 0 && <div style={st.svcSats}>{sats.toLocaleString()} sats</div>}
    </button>
  );
}

const st = {
  wrap: { position: 'fixed', inset: 0, zIndex: 45, display: 'grid', placeItems: 'center', background: 'rgba(26,20,17,0.72)', backdropFilter: 'blur(3px)', padding: 16, animation: 'fadeIn 0.3s ease' },
  card: { width: 'min(460px, 94vw)', background: 'rgba(20,15,12,0.95)', border: '1px solid rgba(247,147,26,0.4)', borderRadius: 16, padding: '22px 22px 24px', boxShadow: '0 24px 70px rgba(0,0,0,0.6)', color: 'var(--paper)', fontFamily: 'var(--font-num)', position: 'relative', overflow: 'hidden' },
  dangerBanner: { position: 'absolute', top: 0, left: 0, right: 0, background: 'var(--danger)', color: '#fff', textAlign: 'center', fontFamily: 'var(--font-title)', letterSpacing: '0.14em', fontSize: 13, padding: '4px' },
  head: { display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 },
  flag: { fontSize: 40 },
  city: { fontFamily: 'var(--font-title)', fontSize: 32, lineHeight: 1 },
  country: { fontSize: 13, color: '#b6a98c', letterSpacing: '0.06em' },
  flavor: { fontSize: 14, lineHeight: 1.5, color: '#d8c7a6', margin: '14px 0 6px' },
  lesson: { fontFamily: 'var(--font-news)', fontStyle: 'italic', fontSize: 13.5, lineHeight: 1.4, color: 'var(--btc)', margin: '0 0 12px', textAlign: 'center' },
  inflNote: { fontSize: 12, color: '#b6a98c', marginBottom: 4, textAlign: 'center' },
  rangeNote: { fontSize: 12.5, marginBottom: 10, textAlign: 'center', lineHeight: 1.4 },
  services: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 },
  service: { background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(245,230,202,0.2)', borderRadius: 10, padding: '12px 6px', color: 'var(--paper)', fontFamily: 'var(--font-num)', textAlign: 'center', transition: 'all 0.15s ease' },
  svcLabel: { fontFamily: 'var(--font-title)', fontSize: 18, marginTop: 4 },
  svcDetail: { fontSize: 10.5, color: '#b6a98c', marginTop: 2, minHeight: 24 },
  svcPrice: { marginTop: 6, fontWeight: 700, color: 'var(--btc)', fontSize: 14 },
  svcSats: { fontSize: 10.5, color: '#f0c27a', marginTop: 2 },
  satsBtn: { width: '100%', marginTop: 12, padding: '12px 10px', fontSize: 16, borderRadius: 10, background: 'transparent', color: 'var(--btc)', border: '1px solid var(--btc)' },
  continue: { width: '100%', marginTop: 18, padding: '14px', fontSize: 22, borderRadius: 12, background: 'var(--btc)', color: '#1a1411' },
  dangerHint: { textAlign: 'center', fontSize: 11.5, color: '#e08a7a', marginTop: 8 },
  borderBox: { padding: '20px 0', cursor: 'pointer' },
  borderTitle: { textAlign: 'center', fontFamily: 'var(--font-title)', fontSize: 22, marginBottom: 12 },
  borderHint: { textAlign: 'center', fontSize: 12, color: '#b6a98c', marginTop: 10 },
  waitTrack: { height: 12, background: 'rgba(0,0,0,0.5)', borderRadius: 6, overflow: 'hidden' },
  waitFill: { height: '100%', background: 'linear-gradient(90deg, var(--cash), var(--btc))', animation: 'borderBar 1.5s linear forwards' },
};
