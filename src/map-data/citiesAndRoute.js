export const ROUTE = [
  { name: 'Los Angeles',   country: 'USA',         flag: '🇺🇸', mile: 0,    svgX: 20,  svgY: 20,  biome: 'california', isBorder: false, dangerous: false,
    flavor: 'The journey begins. Tank full, BTC cold, El Salvador 2,800 miles south.',
    lesson: 'Count the gallon in dollars and in sats. Only one of those numbers gets worse.' },
  { name: 'Tijuana',       country: 'Mexico',      flag: '🇲🇽', mile: 130,  svgX: 30,  svgY: 62,  biome: 'baja', isBorder: true,  dangerous: false,
    flavor: 'The border crossing took 3 hours. A man sold you a churro. Worth it.',
    lesson: 'Dollars still work here.' },
  { name: 'Hermosillo',    country: 'Mexico',      flag: '🇲🇽', mile: 490,  svgX: 81,  svgY: 157, biome: 'sonora', isBorder: false, dangerous: false,
    flavor: "It's 108°F. The SUV is not happy. Neither are you.",
    lesson: 'The desert charges the truck, not the coin.' },
  { name: 'Mexico City',   country: 'Mexico',      flag: '🇲🇽', mile: 1270, svgX: 180, svgY: 421, biome: 'central_mx', isBorder: false, dangerous: false,
    flavor: '20 million people and the best tacos of your life. Also, a flat tire.',
    lesson: 'The cash number can hold still while the gallon gets worse.' },
  { name: 'Oaxaca',        country: 'Mexico',      flag: '🇲🇽', mile: 1520, svgX: 200, svgY: 486, biome: 's_mexico', isBorder: false, dangerous: false,
    flavor: 'Mezcal, markets, murals. You consider never leaving.',
    lesson: 'Selling sats for a repair is allowed. The scorecard will remember.' },
  { name: 'Guatemala City',country: 'Guatemala',   flag: '🇬🇹', mile: 1870, svgX: 252, svgY: 553, biome: 'guatemala', isBorder: true,  dangerous: false,
    flavor: 'New passport stamp. The volcano on the horizon is technically active.',
    lesson: 'The checkpoint wants papers, not a seed phrase.' },
  { name: 'Tegucigalpa',   country: 'Honduras',    flag: '🇭🇳', mile: 2120, svgX: 280, svgY: 568, biome: 'honduras', isBorder: false, dangerous: true,
    flavor: 'The roughest leg. Keep your eyes open and your wallet hidden.',
    lesson: 'Standing your ground is a custody decision. The last gallon can be paid in sats if the dollars will not cover it.' },
  { name: 'San Salvador',  country: 'El Salvador', flag: '🇸🇻', mile: 2800, svgX: 263, svgY: 579, biome: 'el_salvador', isBorder: false, dangerous: false,
    flavor: 'You made it. Bitcoin ATMs on every corner. The beach is 45 minutes away.',
    lesson: 'Legal tender. The gallon is priced in the money that held.' },
];

// earth paints the ground, plant the foliage, accent only that city's landmark
// and a few matching props. mid stays equal to earth for older readers.
export const BIOMES = {
  california:  { earth: '#c4a56a', plant: '#6d7a52', accent: '#f4f1ea', sky: '#7ec8e3', mid: '#c4a56a', prop: 'sign' },
  baja:        { earth: '#c4b49a', plant: '#3e6b4a', accent: '#e2b13c', sky: '#d9c7a2', mid: '#c4b49a', prop: 'cactus' },
  sonora:      { earth: '#c1572e', plant: '#8a9a4a', accent: '#f0e2b0', sky: '#f3e6cf', mid: '#c1572e', prop: 'cactus' },
  central_mx:  { earth: '#8d8a84', plant: '#6e8a62', accent: '#7b4b9a', sky: '#9bb0bd', mid: '#8d8a84', prop: 'building' },
  s_mexico:    { earth: '#3d6b45', plant: '#1f6b3a', accent: '#c45b8a', sky: '#a7c4a0', mid: '#3d6b45', prop: 'tree' },
  guatemala:   { earth: '#2a241c', plant: '#1e4a30', accent: '#7eb6d6', sky: '#8a9aa3', mid: '#2a241c', prop: 'volcano' },
  honduras:    { earth: '#6a6248', plant: '#2f5a3a', accent: '#f4f1ea', sky: '#7ea0c4', mid: '#6a6248', prop: 'pine' },
  el_salvador: { earth: '#3a342e', plant: '#3a7a48', accent: '#1f6f93', sky: '#f2b65a', mid: '#3a342e', prop: 'palm' },
};
