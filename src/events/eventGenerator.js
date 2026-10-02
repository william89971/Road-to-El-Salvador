import { DEV_MODE, gameState } from '../game-engine/gameStateAndRules.js';

const MOCK_EVENTS = [
  { headline: 'Radiator Blows in the Desert', dateline: 'HERMOSILLO HERALD — Day X', biomes: ['baja', 'sonora'],
    description: 'Steam erupts from the hood at 108°F. A mechanic two miles back will help — for a price.',
    canFight: false,
    choices: [
      { label: 'Patch it yourself', consequence: 'Holds for now. The stack stays put.', effects: { suvHealth: 12, vibes: -1 } },
      { label: 'Pay the mechanic', consequence: 'Fixed in dollars. The coin did not move.', effects: { cash: -80, suvHealth: 30 } },
    ] },
  { headline: 'Bitcoin Hits New All-Time High', dateline: 'CRYPTO WIRE — Day X',
    description: 'Your phone buzzes nonstop. The stack you almost sold in Tijuana is now worth a lot more.',
    canFight: false,
    choices: [
      { label: 'HODL and keep driving', consequence: 'The stack stays. That was the whole point.', effects: { vibes: 1 } },
      { label: 'Celebrate with tacos', consequence: 'A few dollars. Not a single sat.', effects: { cash: -25, vibes: 1 } },
    ] },
  { headline: 'Bandits Block the Road', dateline: 'ROADSIDE REPORT — Day X', biomes: ['guatemala', 'honduras'],
    description: 'Three figures step into the highway ahead, eyeing your plates. They want the bag, not the keys.',
    canFight: true,
    choices: [
      { label: 'Turn back and detour', consequence: 'Slower, thirstier, stack untouched.', effects: { gas: -15, vibes: -1 } },
      { label: 'Pay them off', consequence: 'Dollars on the asphalt. The coin stays in the glovebox.', effects: { cash: -90 } },
    ] },
  { headline: 'The Fed Prints Again', dateline: 'FINANCIAL TIMES — Day X',
    description: 'Another multi-trillion stimulus. The cash in your pocket did not change. What it buys did.',
    canFight: false,
    choices: [
      { label: 'Keep the stack', consequence: 'The printing does not touch the coin.', effects: { vibes: 1, purchasingPower: -2 } },
      { label: 'Spend the cash while it works', consequence: 'A few dollars buy less than they did yesterday.', effects: { cash: -40, purchasingPower: -2 } },
    ] },
  { headline: 'Night Mechanic in a Pemex Lot', dateline: 'BAJA BULLETIN — Day X', biomes: ['baja', 'sonora'],
    description: 'A kid with a flashlight offers to top you off from a jerry can. He prices it in pesos.',
    canFight: false,
    choices: [
      { label: 'Nurse what you have', consequence: 'No sale. The worry stays, the stack stays.', effects: { vibes: -1 } },
      { label: 'Buy the gas', consequence: 'The needle climbs. You paid the cheap money.', effects: { gas: 30, cash: -35 } },
    ] },
  { headline: 'Checkpoint Wants a Look', dateline: 'FEDERAL HIGHWAY — Day X', biomes: ['guatemala'],
    description: 'Flashlights in the window. They can stamp a passport. They do not get a seed phrase.',
    canFight: false,
    choices: [
      { label: 'Show the papers', consequence: 'The stamp, not the keys. The engine idles.', effects: { gas: -8, vibes: -1 } },
      { label: 'Pay the courtesy', consequence: 'The gate lifts. A few dollars, nothing else.', effects: { cash: -40 } },
    ] },
  { headline: 'Hail Cracks the Windshield', dateline: 'SIERRA REPORT — Day X', biomes: ['s_mexico', 'guatemala'],
    description: 'A five-minute storm leaves a spiderweb across the glass. The wipers only make it worse.',
    canFight: false,
    choices: [
      { label: 'Tape and drive', consequence: 'Ugly, free, and the stack is still yours.', effects: { suvHealth: -8, vibes: -1 } },
      { label: 'Replace the glass', consequence: 'Clear view, local dollars. The coin did not pay for it.', effects: { cash: -70, suvHealth: 20 } },
    ] },
  { headline: 'Cousin With a Coin', dateline: 'FAMILY CHAT — Day X',
    description: 'A voice note from home: "Sell a little, the dip looks real." The chart on your phone disagrees.',
    canFight: false,
    choices: [
      { label: 'Leave it alone', consequence: 'The cousin is disappointed. The scorecard is not.', effects: { vibes: 1 } },
      { label: 'Sell a slice', consequence: 'Fiat in hand. Fewer sats forever. The card will show it.', effects: { btc: -0.005, cash: 80, vibes: -1 } },
    ] },
  { headline: 'Roadside Kitchen', dateline: 'COMEDOR MILE MARKER — Day X',
    description: 'Mole, tortillas, and a power outlet. The crew has not smiled since the last border.',
    canFight: false,
    choices: [
      { label: 'Keep rolling', consequence: 'Miles gained. The stack was never on the menu.', effects: { vibes: -1 } },
      { label: 'Sit down and eat', consequence: 'Dinner in dollars. Not a sat on the table.', effects: { cash: -20, vibes: 1 } },
    ] },
  { headline: 'Bridge Out Ahead', dateline: 'STATE POLICE — Day X', biomes: ['s_mexico', 'honduras'],
    description: 'A washed-out bridge. The detour is a dirt track that the SUV will feel in its bones.',
    canFight: false,
    choices: [
      { label: 'Pay a crew to open a lane', consequence: 'Dollars move the gravel. The stack stays in the glovebox.', effects: { cash: -45 } },
      { label: 'Take the dirt track', consequence: 'You make it. The suspension pays, not the stack.', effects: { suvHealth: -18, gas: -12 } },
    ] },
  { headline: 'Someone Follows You Out of Town', dateline: 'NIGHT DRIVE — Day X', biomes: ['honduras'],
    description: 'The same headlights have sat two car-lengths back since the last Pemex. They want what folds.',
    canFight: true,
    choices: [
      { label: 'Lose them in town', consequence: 'Side streets. The keys stay in your head.', effects: { gas: -10, vibes: -1 } },
      { label: 'Pull over and pay', consequence: 'Dollars in the glovebox. The seed was never there.', effects: { cash: -60 } },
    ] },
  { headline: 'Exchange Rate on a Napkin', dateline: 'CANTINA BLACKBOARD — Day X', biomes: ['central_mx', 's_mexico'],
    description: 'The owner will swap pesos for a sliver of bitcoin, priced like he has somewhere to be.',
    canFight: false,
    choices: [
      { label: 'Walk out', consequence: 'You keep the stack. Hunger is cheaper than regret.', effects: { vibes: -1 } },
      { label: 'Take the bad rate', consequence: 'Cash now. The scorecard loses the sats.', effects: { btc: -0.004, cash: 70 } },
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

function eventsForBiome(biome) {
  const local = MOCK_EVENTS.filter((e) => !e.biomes || e.biomes.includes(biome));
  return local.length ? local : MOCK_EVENTS;
}

function pickMockEvent() {
  const here = eventsForBiome(gameState.biome);
  const fresh = here.filter((e) => !gameState.recentEventTitles.includes(e.headline));
  const source = fresh.length ? fresh : here;
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
