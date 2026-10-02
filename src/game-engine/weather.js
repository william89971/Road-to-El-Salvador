// Departure is May 1. The drive is about seventy days, so the player leaves
// in the dry north and arrives on the Salvadoran coast in early July.

const MONTHS = [
  { name: 'May', days: 31 },
  { name: 'Jun', days: 30 },
  { name: 'Jul', days: 31 },
];

export function calendarLabel(days) {
  let left = Math.max(0, Math.floor(days || 0));
  for (const month of MONTHS) {
    if (left < month.days) return `${month.name} ${left + 1}`;
    left -= month.days;
  }
  return `Jul ${left + 1}`;
}

function pack(id, label, fogNear, fogFar, fogColor, rain, dust, heat, wet) {
  return { id, label, fogNear, fogFar, fogColor, rain, dust, heat, wet };
}

function isNight(t) {
  return t >= 0.75 || t <= 0.10;
}

function isAfternoon(t) {
  return t >= 0.42 && t < 0.75;
}

// 0 through late May, 1 by mid-June. Highland and tropical rains follow it.
function rainySeason(days) {
  return Math.min(1, Math.max(0, ((days || 0) - 20) / 25));
}

export function weatherFor(biome, timeOfDay, days) {
  const t = ((Number(timeOfDay) % 1) + 1) % 1;
  const night = isNight(t);
  const afternoon = isAfternoon(t);
  const rains = rainySeason(days);

  if (biome === 'el_salvador') {
    return pack('golden', 'golden hour', 55, 170, '#e8a84a', 0, 0, 0, 0);
  }

  if (biome === 'guatemala' || biome === 'honduras') {
    const rain = (night ? 0.35 : afternoon ? 1 : 0.72) * Math.max(0.45, rains);
    return pack('storm', night ? 'night rain' : 'afternoon storm', night ? 40 : 18, night ? 130 : 90, '#6d7c88', rain, 0, 0, rain);
  }

  if (biome === 'central_mx' || biome === 's_mexico') {
    if (afternoon && rains > 0.15) {
      return pack('storm', 'afternoon storm', 20, 100, '#6d7c88', 0.85 * rains, 0, 0, 0.85 * rains);
    }
    return pack('clear', 'clear', 80, 200, '#9bb0bd', 0, 0, 0, 0);
  }

  if (biome === 'sonora') {
    if (!night && t >= 0.56 && t <= 0.64) {
      return pack('dust', 'dust', 16, 72, '#c4a574', 0, 1, 0.45, 0);
    }
    if (!night) return pack('heat', 'Sonora heat', 22, 95, '#e8b56a', 0, 0.15, 1, 0);
    return pack('clear', 'clear', 70, 180, '#c4b49a', 0, 0, 0, 0);
  }

  if (biome === 'baja') {
    return pack('clear', 'clear', 75, 190, '#d9c7a2', 0, 0, night ? 0 : 0.15, 0);
  }

  if (night || (t > 0.10 && t < 0.42)) {
    return pack('marine', 'marine layer', 26, 110, '#c5d4de', 0, 0, 0, 0.05);
  }
  return pack('clear', 'clear', 80, 200, '#7ec8e3', 0, 0, 0, 0);
}
