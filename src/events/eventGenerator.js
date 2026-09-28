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
  { headline: 'Night Mechanic in a Pemex Lot', dateline: 'BAJA BULLETIN — Day X',
    description: 'A kid with a flashlight offers to top you off from a jerry can. He wants dollars, not a story.',
    canFight: false,
    choices: [
      { label: 'Buy the gas', consequence: 'The needle climbs. So does his price.', effects: { gas: 30, cash: -45 } },
      { label: 'Nurse what you have', consequence: 'You keep the cash and the worry.', effects: { vibes: -1 } },
    ] },
  { headline: 'Checkpoint Wants a Look', dateline: 'FEDERAL HIGHWAY — Day X',
    description: 'Flashlights in the window. They are curious about the laptop and the foreign plates.',
    canFight: false,
    choices: [
      { label: 'Pay the courtesy', consequence: 'The gate lifts. Your wallet does not.', effects: { cash: -60 } },
      { label: 'Show the papers', consequence: 'An hour of questions. The engine idles hard.', effects: { gas: -8, vibes: -1 } },
    ] },
  { headline: 'Hail Cracks the Windshield', dateline: 'SIERRA REPORT — Day X',
    description: 'A five-minute storm leaves a spiderweb across the glass. The wipers only make it worse.',
    canFight: false,
    choices: [
      { label: 'Tape and drive', consequence: 'Ugly, but the road is still there.', effects: { suvHealth: -8, vibes: -1 } },
      { label: 'Replace the glass', consequence: 'Clear view. Local prices.', effects: { cash: -90, suvHealth: 20 } },
    ] },
  { headline: 'Cousin With a Coin', dateline: 'FAMILY CHAT — Day X',
    description: 'A voice note from home: "Sell a little, the dip looks real." The chart on your phone disagrees.',
    canFight: false,
    choices: [
      { label: 'Sell a slice', consequence: 'Fiat in hand. Fewer sats forever.', effects: { btc: -0.005, cash: 80, vibes: -1 } },
      { label: 'Leave it alone', consequence: 'The cousin is disappointed. The stack is not.', effects: { vibes: 1 } },
    ] },
  { headline: 'Roadside Kitchen', dateline: 'COMEDOR MILE MARKER — Day X',
    description: 'Mole, tortillas, and a power outlet. The crew has not smiled since the last border.',
    canFight: false,
    choices: [
      { label: 'Sit down and eat', consequence: 'An hour well spent.', effects: { cash: -25, vibes: 1 } },
      { label: 'Keep rolling', consequence: 'Miles gained. Mood not.', effects: { vibes: -1 } },
    ] },
  { headline: 'Bridge Out Ahead', dateline: 'STATE POLICE — Day X',
    description: 'A washed-out bridge. The detour is a dirt track that the SUV will feel in its bones.',
    canFight: false,
    choices: [
      { label: 'Take the dirt track', consequence: 'You make it. The suspension remembers.', effects: { suvHealth: -18, gas: -12 } },
      { label: 'Wait for the crew', consequence: 'They clear a lane by evening.', effects: { vibes: -1, gas: -6 } },
    ] },
  { headline: 'Someone Follows You Out of Town', dateline: 'NIGHT DRIVE — Day X',
    description: 'The same headlights have sat two car-lengths back since the last Pemex. They match your speed.',
    canFight: true,
    choices: [
      { label: 'Lose them in town', consequence: 'Side streets and a racing pulse.', effects: { gas: -10, vibes: -1 } },
      { label: 'Pull over and pay', consequence: 'They wanted the glovebox, not a fight.', effects: { cash: -80 } },
    ] },
  { headline: 'Exchange Rate on a Napkin', dateline: 'CANTINA BLACKBOARD — Day X',
    description: 'The owner will swap pesos for a sliver of bitcoin, priced like he has somewhere to be.',
    canFight: false,
    choices: [
      { label: 'Take the bad rate', consequence: 'Cash now. Sats gone.', effects: { btc: -0.004, cash: 70 } },
      { label: 'Walk out', consequence: 'You keep the stack and the hunger.', effects: { vibes: -1 } },
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
