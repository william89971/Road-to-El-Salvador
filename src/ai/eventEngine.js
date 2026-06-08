import Anthropic from '@anthropic-ai/sdk';
import { DEV_MODE, gameState } from '../game/gameState.js';

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
      { label: 'HODL and keep driving', consequence: 'Diamond hands intact.', effects: { vibes: 1, purchasingPower: 0 } },
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

export async function getEvent() {
  if (DEV_MODE) {
    const pool = MOCK_EVENTS.filter(e => !gameState.recentEventTitles.includes(e.headline));
    const e = (pool.length ? pool : MOCK_EVENTS)[Math.floor(Math.random() * (pool.length || MOCK_EVENTS.length))];
    return { ...e, dateline: e.dateline.replace('Day X', `Day ${gameState.days}`) };
  }
  try {
    const client = new Anthropic({ apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY, dangerouslyAllowBrowser: true });
    // TODO production: move this call behind a Vercel serverless fn at /api/event to hide the key
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: buildPrompt() }],
    });
    const text = msg.content.map(b => b.text || '').join('').replace(/```json|```/g, '').trim();
    return JSON.parse(text);
  } catch (err) {
    console.error('Event API failed, using mock:', err);
    return MOCK_EVENTS[Math.floor(Math.random() * MOCK_EVENTS.length)];
  }
}

function buildPrompt() {
  const s = gameState;
  return `You are the narrator for "Bitcoin Road Trip", a road trip game from LA to El Salvador.
Game state:
- Location: ${s.currentCity}, ${s.currentCountry} | Miles: ${Math.round(s.miles)}/2800
- Gas ${Math.round(s.gas)}% | SUV ${Math.round(s.suvHealth)}% | Vibes ${s.vibes}/5
- Cash $${Math.round(s.cash)} (purchasing power ${Math.round(s.purchasingPower)}%) | BTC ${s.btc} at $${s.btcPrice}
- Recent events (don't repeat): ${s.recentEventTitles.join(', ') || 'none'}

Return ONLY valid JSON:
{"headline":"<=8 words","dateline":"CITY DAILY — Day ${s.days}","description":"2-3 sentences, grounded in the real region, funny/tense/human","canFight":false,
"choices":[{"label":"<=8 words","consequence":"1 sentence","effects":{"gas":0,"cash":-60,"btc":0,"suvHealth":-10,"vibes":1,"purchasingPower":0}},
{"label":"<=8 words","consequence":"1 sentence","effects":{"gas":-15,"cash":0,"btc":0,"suvHealth":0,"vibes":-1,"purchasingPower":0}}]}
Rules: canFight:true only for physical threats (bandits/checkpoint/ambush) and adds a "Stand your ground" option client-side.
Tailor to region (Baja desert, Oaxaca culture, Guatemala volcanic). Some events reference hard money (rising prices, peso crash, vendors preferring BTC).
Cash effects $20-200, BTC 0.001-0.01, purchasingPower -5 to +3. Never drain >25% of a resource.`;
}
