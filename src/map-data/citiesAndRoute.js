export const ROUTE = [
  { name: 'Los Angeles',   country: 'USA',         flag: '🇺🇸', mile: 0,    svgX: 20,  svgY: 20,  biome: 'california', isBorder: false, dangerous: false,
    flavor: 'The journey begins. Tank full, BTC cold, El Salvador 2,800 miles south.' },
  { name: 'Tijuana',       country: 'Mexico',      flag: '🇲🇽', mile: 130,  svgX: 30,  svgY: 62,  biome: 'baja', isBorder: true,  dangerous: false,
    flavor: 'The border crossing took 3 hours. A man sold you a churro. Worth it.' },
  { name: 'Hermosillo',    country: 'Mexico',      flag: '🇲🇽', mile: 490,  svgX: 81,  svgY: 157, biome: 'sonora', isBorder: false, dangerous: false,
    flavor: "It's 108°F. The SUV is not happy. Neither are you." },
  { name: 'Mexico City',   country: 'Mexico',      flag: '🇲🇽', mile: 1270, svgX: 180, svgY: 421, biome: 'central_mx', isBorder: false, dangerous: false,
    flavor: '20 million people and the best tacos of your life. Also, a flat tire.' },
  { name: 'Oaxaca',        country: 'Mexico',      flag: '🇲🇽', mile: 1520, svgX: 200, svgY: 486, biome: 's_mexico', isBorder: false, dangerous: false,
    flavor: 'Mezcal, markets, murals. You consider never leaving.' },
  { name: 'Guatemala City',country: 'Guatemala',   flag: '🇬🇹', mile: 1870, svgX: 252, svgY: 553, biome: 'guatemala', isBorder: true,  dangerous: false,
    flavor: 'New passport stamp. The volcano on the horizon is technically active.' },
  { name: 'Tegucigalpa',   country: 'Honduras',    flag: '🇭🇳', mile: 2120, svgX: 280, svgY: 568, biome: 'honduras', isBorder: false, dangerous: true,
    flavor: 'The roughest leg. Keep your eyes open and your wallet hidden.' },
  { name: 'San Salvador',  country: 'El Salvador', flag: '🇸🇻', mile: 2800, svgX: 263, svgY: 579, biome: 'el_salvador', isBorder: false, dangerous: false,
    flavor: 'You made it. Bitcoin ATMs on every corner. The beach is 45 minutes away.' },
];

export const BIOMES = {
  california:  { mid: '#c9a66b', sky: '#7ec8e3', prop: 'sign' },
  baja:        { mid: '#e0913f', sky: '#f2c14e', prop: 'cactus' },
  sonora:      { mid: '#c1572e', sky: '#e8a04a', prop: 'cactus' },
  central_mx:  { mid: '#7a9b6e', sky: '#9bb0bd', prop: 'building' },
  s_mexico:    { mid: '#2f7d4f', sky: '#a7c4a0', prop: 'tree' },
  guatemala:   { mid: '#2a5d3a', sky: '#8a9aa3', prop: 'volcano' },
  honduras:    { mid: '#327a4d', sky: '#88b9a0', prop: 'palm' },
  el_salvador: { mid: '#3a9b6a', sky: '#f2b65a', prop: 'palm' },
};
