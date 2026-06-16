import { DEV_MODE, gameState } from '../game-engine/gameStateAndRules.js';

const MOCK_EVENTS = [
  { headline: 'Radiator Blows in the Desert', dateline: 'HERMOSILLO HERALD — Day X',
    description: 'Steam erupts from the hood at 108°F. A mechanic two miles back will help — for a price.',
    canFight: false,
    choices: [
      { label: 'Pay the mechanic', consequence: 'Fixed, but it cost you.', effects: { cash: -120, suvHealth: 30 } },
      { label: 'Patch it yourself', consequence: 'Holds for now. Barely.', effects: { suvHealth: 12, vibes: -1 } },
    ] },
  { headline: 'Bitcoin Hits New All-Time High', dateline: 'CRYPTO WIRE — Day X',
    description: 'Your phone buzzes nonstop. The stack you almost sold in Tijuana is now worth a lot more.',
    canFight: false,
    choices: [
      { label: 'HODL and keep driving', consequence: 'Diamond hands intact.', effects: { vibes: 1 } },
      { label: 'Celebrate with tacos', consequence: 'Morale up, wallet down.', effects: { cash: -30, vibes: 1 } },
    ] },
  { headline: 'Bandits Block the Road', dateline: 'ROADSIDE REPORT — Day X',
    description: 'Three figures step into the highway ahead, eyeing your plates. No way around them.',
    canFight: true,
    choices: [
      { label: 'Pay them off', consequence: 'They let you pass.', effects: { cash: -150 } },
      { label: 'Turn back and detour', consequence: 'Safe, but slow and thirsty.', effects: { gas: -20, vibes: -1 } },
    ] },
  { headline: 'The Fed Prints Again', dateline: 'FINANCIAL TIMES — Day X',
    description: 'Another multi-trillion stimulus. Every dollar in your pocket just quietly lost value.',
    canFight: false,
    choices: [
      { label: 'Shrug and drive on', consequence: 'Your cash buys less now.', effects: { purchasingPower: -4 } },
      { label: 'Stack more sats later', consequence: 'A plan, at least.', effects: { vibes: 1, purchasingPower: -2 } },
    ] },
];

function buildSnapshot() {
  const s = gameState;
  return {
    currentCity: s.currentCity,
    currentCountry: s.currentCountry,
    biome: s.biome,
    miles: s.miles,
    gas: s.gas,
    suvHealth: s.suvHealth,
    vibes: s.vibes,
    cash: s.cash,
    purchasingPower: s.purchasingPower,
    btc: s.btc,
    btcPrice: s.btcPrice,
    days: s.days,
    recentEventTitles: s.recentEventTitles,
  };
}

function pickMockEvent() {
  const pool = MOCK_EVENTS.filter((e) => !gameState.recentEventTitles.includes(e.headline));
  const source = pool.length ? pool : MOCK_EVENTS;
  const e = source[Math.floor(Math.random() * source.length)];
  return { ...e, dateline: e.dateline.replace('Day X', `Day ${gameState.days}`) };
}

export async function getEvent() {
  if (DEV_MODE) {
    return pickMockEvent();
  }

  try {
    const res = await fetch('/api/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildSnapshot()),
    });
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const ev = await res.json();
    // Basic shape validation
    if (!ev || !ev.headline || !Array.isArray(ev.choices)) {
      throw new Error('Invalid event shape from server');
    }
    return ev;
  } catch (err) {
    console.error('Event API failed, using mock:', err);
    return pickMockEvent();
  }
}
