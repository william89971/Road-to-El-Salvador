export async function saveRun() {
  try {
    const { gameState } = await import('./gameState.js');
    await window.storage.set(`run:${Date.now()}`, JSON.stringify({
      name: gameState.playerName || 'Anon',
      btc: gameState.btc,
      btcValue: Math.round(gameState.btc * gameState.btcPrice),
      pp: Math.round(gameState.purchasingPower),
      days: gameState.days,
    }), true); // shared = visible to all players
  } catch (e) { console.warn('leaderboard save failed', e); }
}
export async function topRuns(n = 10) {
  try {
    const list = await window.storage.list('run:', true);
    const runs = [];
    for (const k of (list?.keys || [])) {
      try { const r = await window.storage.get(k, true); if (r) runs.push(JSON.parse(r.value)); } catch {}
    }
    return runs.sort((a,b)=>b.btcValue-a.btcValue).slice(0, n);
  } catch (e) { console.warn('leaderboard read failed', e); return []; }
}
