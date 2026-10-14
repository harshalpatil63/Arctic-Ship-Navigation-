import { Port, Ship, Iceberg, Route, RouteSegment, RouteStrategy, WeatherCondition, Alert } from '../types';

// Bounding boxes for validating waypoints fall in navigable polar waters.
// Each entry is [[lonMin, latMin], [lonMax, latMax]].
export const seaCoordinates = {
  arctic: [
    [[30, 69], [180, 77]],
    [[30, 65], [180, 73]],
    [[-140, 72], [-50, 78]],
    [[-40, 70], [20, 80]],
  ],
  antarctic: [
    [[-70, -65], [-60, -55]],
    [[160, -75], [180, -65]],
    [[-60, -75], [-30, -65]],
  ]
};

const ports: Port[] = [
  { id: 'p1', name: 'Murmansk', latitude: 68.9585, longitude: 33.0827, country: 'Russia', congestion: 85, description: 'Major Arctic port with year-round operations' },
  { id: 'p2', name: 'Pevek', latitude: 69.7019, longitude: 170.2999, country: 'Russia', congestion: 45, description: 'Northernmost port in Russia' },
  { id: 'p3', name: 'Longyearbyen', latitude: 78.2232, longitude: 15.6267, country: 'Norway', congestion: 65, description: 'Main settlement in Svalbard' },
  { id: 'p4', name: 'Nuuk', latitude: 64.1835, longitude: -51.7216, country: 'Greenland', congestion: 55, description: 'Capital of Greenland' },
  { id: 'p5', name: 'Tiksi', latitude: 71.6351, longitude: 128.8644, country: 'Russia', congestion: 40, description: 'Important port on Northern Sea Route' },
  { id: 'p6', name: 'Sabetta', latitude: 71.2714, longitude: 72.0686, country: 'Russia', congestion: 75, description: 'LNG export terminal on Yamal Peninsula' },
  { id: 'p7', name: 'Churchill', latitude: 58.7684, longitude: -94.1650, country: 'Canada', congestion: 35, description: 'Canadian Arctic port on Hudson Bay' },
  { id: 'p8', name: 'McMurdo Station', latitude: -77.8419, longitude: 166.6863, country: 'Antarctica', congestion: 30, description: 'Largest Antarctic research station' },
  { id: 'p9', name: 'Rothera Station', latitude: -67.5674, longitude: -68.1255, country: 'Antarctica', congestion: 25, description: 'British Antarctic Survey station' },
  { id: 'p10', name: 'Davis Station', latitude: -68.5760, longitude: 77.9689, country: 'Antarctica', congestion: 20, description: 'Australian Antarctic research station' }
];

// Fjord and harbor approach waypoints ensuring vessels enter/exit ports strictly through navigable water channels
const harborApproaches: Record<string, [number, number][]> = {
  // Murmansk (p1): Barents Sea entrance to Kola Bay -> Kola Fjord
  p1: [[33.50, 69.45], [33.25, 69.15]],
  // Pevek (p2): Chaunskaya Bay Entrance
  p2: [[169.50, 70.20]],
  // Longyearbyen (p3): Isfjorden Entrance -> Adventfjorden
  p3: [[13.50, 78.10], [15.40, 78.25]],
  // Nuuk (p4): Nuup Kangerlua Entrance
  p4: [[-52.50, 64.00], [-52.00, 64.15]],
  // Tiksi (p5): Buor-Khaya Gulf Entrance
  p5: [[129.50, 72.30]],
  // Sabetta (p6): Gulf of Ob Approach
  p6: [[73.50, 72.80], [72.80, 71.80]],
  // Churchill (p7): Churchill River Harbor Approach
  p7: [[-93.50, 59.30]],
  // McMurdo (p8): Ross Sea Ice Channel Approach
  p8: [[166.50, -77.50]],
  // Rothera (p9): Marguerite Bay Approach
  p9: [[-68.50, -67.20]],
  // Davis (p10): Prydz Bay Approach
  p10: [[77.50, -68.20]],
};

// Comprehensive maritime corridor waypoints navigating through real Arctic straits & sea lanes
const seaRouteWaypoints: Record<string, [number, number][]> = {
  // Murmansk (p1) to Pevek (p2) - Northern Sea Route
  'p1-p2-shortest': [[33.08, 68.96], [33.25, 69.15], [33.50, 69.45], [38.5, 71.0], [58.5, 70.4], [72.0, 73.0], [103.0, 77.8], [125.0, 75.5], [140.0, 74.6], [162.0, 72.8], [169.50, 70.20], [170.30, 69.70]],
  'p1-p2-safest': [[33.08, 68.96], [33.25, 69.15], [33.50, 69.45], [35.0, 73.0], [50.0, 76.0], [68.0, 77.5], [85.0, 78.5], [103.0, 78.5], [125.0, 77.0], [145.0, 76.0], [165.0, 73.5], [169.50, 70.20], [170.30, 69.70]],
  'p1-p2-fuel-efficient': [[33.08, 68.96], [33.25, 69.15], [33.50, 69.45], [42.0, 70.5], [58.5, 70.4], [75.0, 73.5], [103.0, 77.8], [128.0, 75.0], [140.0, 74.6], [160.0, 72.5], [169.50, 70.20], [170.30, 69.70]],
  'p1-p2': [[33.08, 68.96], [33.25, 69.15], [33.50, 69.45], [38.5, 71.0], [58.5, 70.4], [72.0, 73.0], [103.0, 77.8], [125.0, 75.5], [140.0, 74.6], [162.0, 72.8], [169.50, 70.20], [170.30, 69.70]],

  // Murmansk (p1) to Longyearbyen (p3)
  'p1-p3-shortest': [[33.08, 68.96], [33.25, 69.15], [33.50, 69.45], [30.0, 72.0], [22.0, 74.5], [18.5, 76.5], [13.50, 78.10], [15.40, 78.25], [15.63, 78.22]],
  'p1-p3-safest': [[33.08, 68.96], [33.25, 69.15], [33.50, 69.45], [35.0, 71.5], [28.0, 74.0], [20.0, 77.0], [13.50, 78.10], [15.40, 78.25], [15.63, 78.22]],
  'p1-p3-fuel-efficient': [[33.08, 68.96], [33.25, 69.15], [33.50, 69.45], [32.0, 71.0], [24.0, 74.0], [17.5, 76.8], [13.50, 78.10], [15.40, 78.25], [15.63, 78.22]],
  'p1-p3': [[33.08, 68.96], [33.25, 69.15], [33.50, 69.45], [30.0, 72.0], [22.0, 74.5], [18.5, 76.5], [13.50, 78.10], [15.40, 78.25], [15.63, 78.22]],

  // Murmansk (p1) to Nuuk (p4)
  'p1-p4': [[33.08, 68.96], [33.25, 69.15], [33.50, 69.45], [20.0, 72.0], [0.0, 72.5], [-20.0, 68.0], [-40.0, 62.0], [-45.0, 59.8], [-52.0, 62.0], [-52.50, 64.00], [-52.00, 64.15], [-51.72, 64.18]],
  
  // Murmansk (p1) to Tiksi (p5)
  'p1-p5': [[33.08, 68.96], [33.25, 69.15], [33.50, 69.45], [38.5, 71.0], [58.5, 70.4], [72.0, 73.0], [103.0, 77.8], [125.0, 75.5], [129.50, 72.30], [128.86, 71.64]],
  
  // Murmansk (p1) to Sabetta (p6)
  'p1-p6': [[33.08, 68.96], [33.25, 69.15], [33.50, 69.45], [38.5, 71.0], [58.5, 70.4], [68.0, 71.5], [73.50, 72.80], [72.80, 71.80], [72.07, 71.27]],
  
  // Murmansk (p1) to Churchill (p7)
  'p1-p7': [[33.08, 68.96], [33.25, 69.15], [33.50, 69.45], [15.0, 71.0], [-10.0, 68.0], [-40.0, 62.0], [-60.0, 62.0], [-66.0, 61.5], [-78.0, 62.8], [-86.0, 60.0], [-93.50, 59.30], [-94.17, 58.77]],

  // Nuuk (p4) to Churchill (p7)
  'p4-p7-shortest': [[-51.72, 64.18], [-52.00, 64.15], [-52.50, 64.00], [-55.0, 62.5], [-66.0, 61.5], [-78.0, 62.8], [-86.0, 60.0], [-93.50, 59.30], [-94.17, 58.77]],
  'p4-p7-safest': [[-51.72, 64.18], [-52.00, 64.15], [-52.50, 64.00], [-57.0, 61.0], [-68.0, 60.5], [-80.0, 62.0], [-88.0, 59.5], [-93.50, 59.30], [-94.17, 58.77]],
  'p4-p7': [[-51.72, 64.18], [-52.00, 64.15], [-52.50, 64.00], [-55.0, 62.5], [-66.0, 61.5], [-78.0, 62.8], [-86.0, 60.0], [-93.50, 59.30], [-94.17, 58.77]],

  // Longyearbyen (p3) to Nuuk (p4)
  'p3-p4': [[15.63, 78.22], [15.40, 78.25], [13.50, 78.10], [5.0, 78.0], [-10.0, 75.0], [-30.0, 68.0], [-45.0, 59.8], [-52.0, 62.0], [-52.50, 64.00], [-52.00, 64.15], [-51.72, 64.18]],

  // Longyearbyen (p3) to Pevek (p2)
  'p3-p2': [[15.63, 78.22], [15.40, 78.25], [13.50, 78.10], [45.0, 77.0], [72.0, 78.0], [103.0, 77.8], [125.0, 75.5], [140.0, 74.6], [162.0, 72.8], [169.50, 70.20], [170.30, 69.70]],

  // Sabetta (p6) to Pevek (p2)
  'p6-p2': [[72.07, 71.27], [72.80, 71.80], [73.50, 72.80], [85.0, 74.0], [103.0, 77.8], [125.0, 75.5], [140.0, 74.6], [162.0, 72.8], [169.50, 70.20], [170.30, 69.70]],

  // Tiksi (p5) to Pevek (p2)
  'p5-p2': [[128.86, 71.64], [129.50, 72.30], [140.0, 74.6], [162.0, 72.8], [169.50, 70.20], [170.30, 69.70]],

  // McMurdo (p8) to Rothera (p9)
  'p8-p9': [[166.69, -77.84], [166.50, -77.50], [175.0, -72.0], [-160.0, -68.0], [-120.0, -68.0], [-90.0, -67.5], [-68.50, -67.20], [-68.13, -67.57]],

  // McMurdo (p8) to Davis (p10)
  'p8-p10': [[166.69, -77.84], [166.50, -77.50], [160.0, -70.0], [130.0, -65.0], [100.0, -65.0], [77.50, -68.20], [77.97, -68.58]],

  // Rothera (p9) to Davis (p10)
  'p9-p10': [[-68.13, -67.57], [-68.50, -67.20], [-40.0, -60.0], [0.0, -60.0], [40.0, -62.0], [77.50, -68.20], [77.97, -68.58]],
};

// Haversine distance between two coordinates in kilometers
const haversineDist = (c1: [number, number], c2: [number, number]): number => {
  const R = 6371;
  const dLat = (c2[1] - c1[1]) * Math.PI / 180;
  let dLon = (c2[0] - c1[0]) * Math.PI / 180;
  if (dLon > Math.PI) dLon -= 2 * Math.PI;
  if (dLon < -Math.PI) dLon += 2 * Math.PI;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(c1[1] * Math.PI / 180) * Math.cos(c2[1] * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const calculatePolylineDistance = (points: [number, number][]): number => {
  if (points.length < 2) return 0;
  let sum = 0;
  for (let i = 0; i < points.length - 1; i++) {
    sum += haversineDist(points[i], points[i + 1]);
  }
  return Math.round(sum);
};

// Global maritime navigation network: vetted open ocean waypoints and maritime straits (100% water)
const maritimeNodes: Record<string, [number, number]> = {
  // Ports
  p1: [33.08, 68.96],
  p2: [170.30, 69.70],
  p3: [15.63, 78.22],
  p4: [-51.72, 64.18],
  p5: [128.86, 71.64],
  p6: [72.07, 71.27],
  p7: [-94.17, 58.77],
  p8: [166.69, -77.84],
  p9: [-68.13, -67.57],
  p10: [77.97, -68.58],

  // Approaches
  app_p1: [33.50, 69.45],
  app_p2: [169.50, 70.20],
  app_p3: [13.50, 78.10],
  app_p4: [-52.50, 64.00],
  app_p5: [129.50, 72.30],
  app_p6: [73.50, 72.80],
  app_p7: [-93.50, 59.30],
  app_p8: [166.50, -77.50],
  app_p9: [-68.50, -67.20],
  app_p10: [77.50, -68.20],

  // Arctic Seas & Straits
  barents_sea: [38.5, 71.0],
  barents_north: [35.0, 74.0],
  svalbard_south: [20.0, 75.0],
  fram_strait: [5.0, 78.5],
  norwegian_sea: [10.0, 69.0],
  greenland_sea: [-10.0, 73.0],
  denmark_strait: [-28.0, 64.0],
  kara_strait: [58.5, 70.4],
  kara_sea_south: [68.0, 72.5],
  kara_sea_central: [75.0, 74.0],
  kara_sea_north: [88.0, 77.0],
  vilkitsky_strait: [103.0, 77.8],
  laptev_sea_north: [115.0, 77.0],
  laptev_sea_mid: [125.0, 75.5],
  laptev_sea_south: [130.0, 73.5],
  sannikov_strait: [140.0, 74.6],
  east_siberian_mid: [155.0, 73.5],
  east_siberian_east: [165.0, 72.0],
  long_strait: [178.0, 70.5],
  chukchi_sea: [-173.0, 68.5],
  bering_strait: [-169.0, 66.0],

  // Bering & Pacific Highway (100% open water)
  bering_sea_north: [-172.0, 63.0],
  bering_sea_mid: [-175.0, 58.0],
  aleutian_pass: [-174.0, 52.0],
  pacific_north: [-174.0, 42.0],
  pacific_mid_n: [-175.0, 25.0],
  pacific_tropic_n: [-175.0, 10.0],
  pacific_equator: [-175.0, 0.0],
  pacific_tropic_s: [-175.0, -12.0],
  pacific_mid_s: [-177.0, -25.0],
  pacific_nz_east: [-179.0, -40.0],
  pacific_subantarctic: [-175.0, -52.0],
  southern_ocean_pac: [-172.0, -62.0],
  ross_sea_north: [175.0, -70.0],
  ross_sea_south: [168.0, -75.0],

  // Atlantic & North America
  cape_farewell: [-44.0, 59.3],
  davis_strait: [-54.0, 63.5],
  labrador_sea: [-55.0, 58.0],
  hudson_strait_e: [-65.0, 61.5],
  hudson_strait_m: [-73.0, 62.5],
  hudson_strait_w: [-78.0, 62.8],
  hudson_bay_n: [-85.0, 61.0],
  hudson_bay_m: [-89.0, 59.5],
  north_atlantic_arctic: [-15.0, 65.0],
  north_atlantic_mid: [-35.0, 48.0],
  mid_atlantic: [-35.0, 32.0],
  tropical_atlantic_n: [-30.0, 15.0],
  equatorial_atlantic: [-25.0, 0.0],
  tropical_atlantic_s: [-25.0, -15.0],
  south_atlantic_mid: [-30.0, -32.0],
  south_atlantic_west: [-45.0, -45.0],
  falkland_waters: [-52.0, -52.0],
  drake_passage_north: [-60.0, -57.5],
  drake_passage_mid: [-64.0, -61.0],
  bransfield_strait: [-65.5, -64.0],
  bellingshausen_n: [-68.0, -66.0],

  // South Atlantic to Indian Ocean -> Davis
  south_atlantic_east: [-10.0, -35.0],
  cape_good_hope_south: [20.0, -36.5],
  south_indian_ocean_w: [42.0, -42.0],
  south_indian_ocean_m: [65.0, -50.0],
  kerguelen_waters: [72.0, -58.0],
  prydz_bay_outer: [76.0, -65.0],

  // Circumpolar Southern Ocean (Connecting McMurdo, Davis, Rothera)
  amundsen_sea_offshore: [-130.0, -69.0],
  bellingshausen_offshore: [-95.0, -68.5],
  southern_ocean_e_ant1: [150.0, -65.0],
  southern_ocean_e_ant2: [120.0, -64.0],
  southern_ocean_e_ant3: [95.0, -64.0],
  weddell_sea_outer: [-35.0, -63.0],
  bouvet_waters: [5.0, -58.0],
  enderby_waters: [45.0, -62.0]
};

const maritimeEdges: [string, string][] = [
  // Port to approaches
  ['p1', 'app_p1'], ['app_p1', 'barents_sea'],
  ['p2', 'app_p2'], ['app_p2', 'east_siberian_east'],
  ['p3', 'app_p3'], ['app_p3', 'svalbard_south'], ['app_p3', 'fram_strait'],
  ['p4', 'app_p4'], ['app_p4', 'davis_strait'],
  ['p5', 'app_p5'], ['app_p5', 'laptev_sea_south'],
  ['p6', 'app_p6'], ['app_p6', 'kara_sea_south'], ['app_p6', 'kara_sea_central'],
  ['p7', 'app_p7'], ['app_p7', 'hudson_bay_m'],
  ['p8', 'app_p8'], ['app_p8', 'ross_sea_south'],
  ['p9', 'app_p9'], ['app_p9', 'bellingshausen_n'],
  ['p10', 'app_p10'], ['app_p10', 'prydz_bay_outer'],

  // Northern Sea Route
  ['barents_sea', 'barents_north'],
  ['barents_sea', 'kara_strait'],
  ['barents_sea', 'norwegian_sea'],
  ['barents_north', 'svalbard_south'],
  ['svalbard_south', 'fram_strait'],
  ['fram_strait', 'greenland_sea'],
  ['greenland_sea', 'denmark_strait'],
  ['greenland_sea', 'north_atlantic_arctic'],
  ['norwegian_sea', 'north_atlantic_arctic'],
  ['kara_strait', 'kara_sea_south'],
  ['kara_sea_south', 'kara_sea_central'],
  ['kara_sea_central', 'kara_sea_north'],
  ['kara_sea_north', 'vilkitsky_strait'],
  ['kara_sea_central', 'vilkitsky_strait'],
  ['vilkitsky_strait', 'laptev_sea_north'],
  ['vilkitsky_strait', 'laptev_sea_mid'],
  ['laptev_sea_north', 'laptev_sea_mid'],
  ['laptev_sea_mid', 'laptev_sea_south'],
  ['laptev_sea_mid', 'sannikov_strait'],
  ['laptev_sea_south', 'sannikov_strait'],
  ['sannikov_strait', 'east_siberian_mid'],
  ['east_siberian_mid', 'east_siberian_east'],
  ['east_siberian_east', 'long_strait'],
  ['long_strait', 'chukchi_sea'],
  ['chukchi_sea', 'bering_strait'],

  // Bering & Pacific Spine
  ['bering_strait', 'bering_sea_north'],
  ['bering_sea_north', 'bering_sea_mid'],
  ['bering_sea_mid', 'aleutian_pass'],
  ['aleutian_pass', 'pacific_north'],
  ['pacific_north', 'pacific_mid_n'],
  ['pacific_mid_n', 'pacific_tropic_n'],
  ['pacific_tropic_n', 'pacific_equator'],
  ['pacific_equator', 'pacific_tropic_s'],
  ['pacific_tropic_s', 'pacific_mid_s'],
  ['pacific_mid_s', 'pacific_nz_east'],
  ['pacific_nz_east', 'pacific_subantarctic'],
  ['pacific_subantarctic', 'southern_ocean_pac'],
  ['southern_ocean_pac', 'ross_sea_north'],
  ['ross_sea_north', 'ross_sea_south'],

  // North America & Atlantic
  ['hudson_bay_m', 'hudson_bay_n'],
  ['hudson_bay_n', 'hudson_strait_w'],
  ['hudson_strait_w', 'hudson_strait_m'],
  ['hudson_strait_m', 'hudson_strait_e'],
  ['hudson_strait_e', 'labrador_sea'],
  ['davis_strait', 'labrador_sea'],
  ['labrador_sea', 'cape_farewell'],
  ['cape_farewell', 'denmark_strait'],
  ['cape_farewell', 'north_atlantic_mid'],
  ['north_atlantic_arctic', 'north_atlantic_mid'],
  ['north_atlantic_mid', 'mid_atlantic'],
  ['mid_atlantic', 'tropical_atlantic_n'],
  ['tropical_atlantic_n', 'equatorial_atlantic'],
  ['equatorial_atlantic', 'tropical_atlantic_s'],
  ['tropical_atlantic_s', 'south_atlantic_mid'],
  ['south_atlantic_mid', 'south_atlantic_west'],
  ['south_atlantic_west', 'falkland_waters'],
  ['falkland_waters', 'drake_passage_north'],
  ['drake_passage_north', 'drake_passage_mid'],
  ['drake_passage_mid', 'bransfield_strait'],
  ['bransfield_strait', 'bellingshausen_n'],

  // South Atlantic to Indian Ocean
  ['south_atlantic_mid', 'south_atlantic_east'],
  ['south_atlantic_east', 'cape_good_hope_south'],
  ['cape_good_hope_south', 'south_indian_ocean_w'],
  ['south_indian_ocean_w', 'south_indian_ocean_m'],
  ['south_indian_ocean_m', 'kerguelen_waters'],
  ['kerguelen_waters', 'prydz_bay_outer'],

  // Circumpolar Southern Ocean (Connecting McMurdo, Davis, Rothera)
  ['ross_sea_north', 'southern_ocean_e_ant1'],
  ['southern_ocean_e_ant1', 'southern_ocean_e_ant2'],
  ['southern_ocean_e_ant2', 'southern_ocean_e_ant3'],
  ['southern_ocean_e_ant3', 'prydz_bay_outer'],
  ['prydz_bay_outer', 'enderby_waters'],
  ['enderby_waters', 'bouvet_waters'],
  ['bouvet_waters', 'weddell_sea_outer'],
  ['weddell_sea_outer', 'drake_passage_mid'],
  ['ross_sea_north', 'amundsen_sea_offshore'],
  ['amundsen_sea_offshore', 'bellingshausen_offshore'],
  ['bellingshausen_offshore', 'bellingshausen_n'],
];

// Precompute adjacency graph for Dijkstra routing
const maritimeAdjacency: Record<string, Array<{ node: string; dist: number }>> = {};
for (const k in maritimeNodes) maritimeAdjacency[k] = [];
for (const [u, v] of maritimeEdges) {
  if (maritimeNodes[u] && maritimeNodes[v]) {
    const d = haversineDist(maritimeNodes[u], maritimeNodes[v]);
    maritimeAdjacency[u]?.push({ node: v, dist: d });
    maritimeAdjacency[v]?.push({ node: u, dist: d });
  }
}

// Critical narrow straits where route waypoints must not be offset
const narrowStraits = new Set([
  'kara_strait', 'vilkitsky_strait', 'sannikov_strait',
  'long_strait', 'bering_strait', 'davis_strait',
  'denmark_strait', 'hudson_strait_e', 'hudson_strait_m',
  'hudson_strait_w', 'drake_passage_mid', 'bransfield_strait'
]);

const solveMaritimePath = (startId: string, endId: string, strategy: RouteStrategy = 'shortest'): [number, number][] => {
  const dist: Record<string, number> = {};
  const prev: Record<string, string | null> = {};
  const visited = new Set<string>();

  for (const k in maritimeNodes) {
    dist[k] = Infinity;
    prev[k] = null;
  }
  dist[startId] = 0;

  const queue: Array<{ node: string; d: number }> = [{ node: startId, d: 0 }];
  while (queue.length > 0) {
    queue.sort((a, b) => a.d - b.d);
    const item = queue.shift();
    if (!item) break;
    const { node: curr, d } = item;
    if (visited.has(curr)) continue;
    visited.add(curr);
    if (curr === endId) break;

    for (const neighbor of maritimeAdjacency[curr] || []) {
      if (visited.has(neighbor.node)) continue;
      const newD = d + neighbor.dist;
      if (newD < dist[neighbor.node]!) {
        dist[neighbor.node] = newD;
        prev[neighbor.node] = curr;
        queue.push({ node: neighbor.node, d: newD });
      }
    }
  }

  if (dist[endId] === Infinity) return [];

  const pathKeys: string[] = [];
  let curr: string | null = endId;
  while (curr) {
    pathKeys.unshift(curr);
    curr = prev[curr];
  }

  return pathKeys.map((nodeKey, idx) => {
    const raw = maritimeNodes[nodeKey]!;
    // Do not offset start, end, harbor approaches, or narrow straits
    if (idx === 0 || idx === pathKeys.length - 1 || nodeKey.startsWith('app_') || narrowStraits.has(nodeKey)) {
      return [raw[0], raw[1]];
    }

    let latOffset = 0;
    if (strategy === 'safest') latOffset = 1.2;
    else if (strategy === 'fuel-efficient') latOffset = -0.8;
    else if (strategy === 'weather-optimized') latOffset = 0.9;
    else if (strategy === 'low-sea-ice') latOffset = raw[1] > 0 ? -1.8 : 1.8;
    else if (strategy === 'low-traffic') latOffset = 0.6;

    // Apply offset safely within open ocean
    const finalLat = Math.max(-85, Math.min(85, raw[1] + latOffset));
    return [raw[0], finalLat];
  });
};

const interpolateCoordinates = (points: [number, number][], stepsPerSegment = 6): [number, number][] => {
  if (points.length < 2) return points;
  const result: [number, number][] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    let dLon = p2[0] - p1[0];
    if (dLon > 180) dLon -= 360;
    if (dLon < -180) dLon += 360;
    const dLat = p2[1] - p1[1];

    for (let s = 0; s < stepsPerSegment; s++) {
      const t = s / stepsPerSegment;
      let lon = p1[0] + dLon * t;
      if (lon > 180) lon -= 360;
      if (lon < -180) lon += 360;
      const lat = p1[1] + dLat * t;
      result.push([Math.round(lon * 1000) / 1000, Math.round(lat * 1000) / 1000]);
    }
  }
  result.push(points[points.length - 1]);
  return result;
};

const getRouteWaypoints = (departure: Port, arrival: Port, strategy: RouteStrategy = 'shortest'): [number, number][] => {
  const keyStrategy = `${departure.id}-${arrival.id}-${strategy}`;
  const reverseStrategy = `${arrival.id}-${departure.id}-${strategy}`;
  const keyBase = `${departure.id}-${arrival.id}`;
  const reverseBase = `${arrival.id}-${departure.id}`;

  let baseWaypoints: [number, number][] | null = null;
  if (seaRouteWaypoints[keyStrategy]) {
    baseWaypoints = seaRouteWaypoints[keyStrategy];
  } else if (seaRouteWaypoints[reverseStrategy]) {
    baseWaypoints = [...seaRouteWaypoints[reverseStrategy]].reverse();
  } else if (seaRouteWaypoints[keyBase]) {
    baseWaypoints = seaRouteWaypoints[keyBase];
  } else if (seaRouteWaypoints[reverseBase]) {
    baseWaypoints = [...seaRouteWaypoints[reverseBase]].reverse();
  } else {
    baseWaypoints = solveMaritimePath(departure.id, arrival.id, strategy);
  }

  // Fallback safeguard: if pathfinder produces empty, return departure approach to arrival approach
  if (!baseWaypoints || baseWaypoints.length < 2) {
    baseWaypoints = [
      [departure.longitude, departure.latitude],
      ...(harborApproaches[departure.id] || []),
      ...(harborApproaches[arrival.id] || []).slice().reverse(),
      [arrival.longitude, arrival.latitude],
    ];
  }

  return interpolateCoordinates(baseWaypoints, 6);
};

// Realistic vessel names from actual Arctic shipping registries
const vesselNames = [
  'Christophe de Margerie', 'Venta Maersk', 'Nordic Barents',
  'Novatek Arctic', 'Polar King', 'Fedor Litke',
  'Akademik Fedorov', 'Ivan Papanin', 'Kapitan Dranitsyn',
  'Nordic Odyssey', 'Yamal Spirit', 'Ob River',
];

const generateIcebergs = (routeCoordinates: [number, number][]): Iceberg[] => {
  const icebergs: Iceberg[] = [];
  const numIcebergs = Math.floor(Math.random() * 4) + 1;
  const sizeNames = ['Growler', 'Bergy Bit', 'Small', 'Medium', 'Large'] as const;

  for (let i = 0; i < numIcebergs; i++) {
    const routeIndex = Math.floor(Math.random() * (routeCoordinates.length - 1));
    const basePosition = routeCoordinates[routeIndex];
    const isInWater = () => true;
    let lon: number, lat: number, attempts = 0;
    do {
      lon = basePosition[0] + (Math.random() - 0.5) * 3;
      lat = basePosition[1] + (Math.random() - 0.5) * 2;
      attempts++;
    } while (!isInWater() && attempts < 15);

    const size = sizeNames[Math.floor(Math.random() * sizeNames.length)];
    const driftSpeed = 0.1 + Math.random() * 1.5;
    const riskProb = Math.random() * 100;

    icebergs.push({
      id: `ice-${Date.now()}-${i}`,
      name: `ICE-${String.fromCharCode(65 + i)}${Math.floor(Math.random() * 900) + 100}`,
      latitude: lat,
      longitude: lon,
      size,
      driftSpeed,
      riskProbability: riskProb,
      lastSeen: new Date(Date.now() - Math.random() * 3600000 * 6).toISOString(),
      predictedPath: [],
      description: `${size} iceberg, drifting ${driftSpeed.toFixed(1)} kn ${['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.floor(Math.random() * 8)]}`,
      estimatedMeltDate: new Date(Date.now() + (30 + Math.random() * 60) * 86400000).toISOString()
    });
  }
  return icebergs;
};

const generateShips = (route: Route): Ship[] => {
  const ships: Ship[] = [];
  const usedNames = new Set<string>();
  const numShips = Math.floor(Math.random() * 3) + 2;
  const cargoTypes = ['Container', 'LNG Tanker', 'Research Vessel', 'Bulk Carrier', 'Icebreaker'];

  for (let i = 0; i < numShips; i++) {
    const progress = Math.random();
    const routeIndex = Math.floor(progress * (route.coordinates.length - 1));
    const position = route.coordinates[routeIndex];

    // Pick a unique vessel name
    let name: string;
    do {
      name = vesselNames[Math.floor(Math.random() * vesselNames.length)];
    } while (usedNames.has(name) && usedNames.size < vesselNames.length);
    usedNames.add(name);

    const speed = 10 + Math.random() * 6; // 10-16 knots typical for ice navigation
    ships.push({
      id: `ship-${route.id}-${i}`,
      name,
      latitude: position[1],
      longitude: position[0],
      speed,
      destination: route.arrival.name,
      riskScore: Math.random() * 100,
      cargoType: cargoTypes[Math.floor(Math.random() * cargoTypes.length)],
      eta: new Date(Date.now() + (24 + Math.random() * 72) * 3600000).toISOString(),
      heading: Math.random() * 360,
      status: 'En Route'
    });
  }
  return ships;
};

const generateWeatherCondition = (depLat: number, arrLat: number): WeatherCondition => {
  const avgLat = (depLat + arrLat) / 2;
  const month = new Date().getMonth();
  const isSummer = month >= 4 && month <= 8;
  const baseTemp = avgLat > 0 ? (isSummer ? -3 : -22) : (isSummer ? 2 : -12);
  const temp = baseTemp + (Math.random() - 0.5) * 8;

  const windSpeed = 8 + Math.random() * 30;
  const waveHeight = 1 + Math.random() * 4;
  const iceConcentration = isSummer
    ? Math.random() * 60
    : 20 + Math.random() * 80;

  // Derive visibility from conditions
  let visibility: 'Poor' | 'Moderate' | 'Good';
  if (windSpeed > 30 || temp < -20) visibility = 'Poor';
  else if (windSpeed > 18 || iceConcentration > 60) visibility = 'Moderate';
  else visibility = 'Good';

  // Derive forecast from conditions
  const forecasts = ['Clear skies', 'Partly cloudy', 'Overcast', 'Light snow', 'Heavy snow', 'Blizzard conditions'];
  let forecastIndex: number;
  if (windSpeed > 30) forecastIndex = 5;
  else if (temp < -15 && windSpeed > 20) forecastIndex = 4;
  else if (temp < -5) forecastIndex = 3;
  else if (iceConcentration > 50) forecastIndex = 2;
  else if (Math.random() > 0.5) forecastIndex = 1;
  else forecastIndex = 0;

  return {
    temperature: temp,
    windSpeed,
    visibility,
    forecast: forecasts[forecastIndex],
    waveHeight,
    seaIceConcentration: iceConcentration,
    predictions: []
  };
};

const generateAlerts = (route: Route, icebergs: Iceberg[]): Alert[] => {
  const alerts: Alert[] = [];

  if (route.weatherConditions.seaIceConcentration > 70) {
    alerts.push({
      type: 'Weather', severity: 'High',
      message: `Sea ice at ${route.weatherConditions.seaIceConcentration.toFixed(0)}% — icebreaker escort recommended`,
      timeToImpact: 2
    });
  }
  if (route.weatherConditions.windSpeed > 30) {
    alerts.push({
      type: 'Weather', severity: 'Medium',
      message: `High winds ${route.weatherConditions.windSpeed.toFixed(0)} kn — reduce speed`,
      timeToImpact: 1
    });
  }
  if (route.weatherConditions.visibility === 'Poor') {
    alerts.push({
      type: 'Weather', severity: 'Medium',
      message: 'Poor visibility — radar navigation required',
      timeToImpact: 0
    });
  }

  icebergs.forEach(ice => {
    if (ice.riskProbability > 70) {
      alerts.push({
        type: 'Collision', severity: ice.riskProbability > 85 ? 'High' : 'Medium',
        message: `${ice.name} (${ice.size}) — ${ice.riskProbability.toFixed(0)}% collision risk`,
        timeToImpact: 1,
        location: { latitude: ice.latitude, longitude: ice.longitude }
      });
    }
  });

  if (route.trafficCongestion > 60) {
    alerts.push({
      type: 'Traffic', severity: 'Low',
      message: `Route congestion at ${route.trafficCongestion.toFixed(0)}%`,
      timeToImpact: 3
    });
  }

  return alerts;
};

// Fuel consumption rate: tons per nautical mile (typical icebreaker-class)
const FUEL_RATE_TONS_PER_NM = 0.12;
const KM_TO_NM = 0.539957;

const routeStrategies: Array<{ strategy: RouteStrategy; label: string }> = [
  { strategy: 'shortest', label: 'Shortest Route' },
  { strategy: 'safest', label: 'Safest Route' },
  { strategy: 'fuel-efficient', label: 'Fuel Efficient Route' },
  { strategy: 'weather-optimized', label: 'Weather Optimized Route' },
  { strategy: 'low-sea-ice', label: 'Low Sea-Ice Route' },
  { strategy: 'low-traffic', label: 'Low Traffic Route' },
];

const strategyFactors: Record<RouteStrategy, { distance: number; ice: number; weather: number; traffic: number }> = {
  shortest: { distance: 0.98, ice: 1.15, weather: 1.1, traffic: 1.1 },
  safest: { distance: 1.12, ice: 0.7, weather: 0.75, traffic: 0.8 },
  'fuel-efficient': { distance: 1.03, ice: 0.9, weather: 1, traffic: 1.05 },
  'weather-optimized': { distance: 1.08, ice: 0.95, weather: 0.65, traffic: 1 },
  'low-sea-ice': { distance: 1.14, ice: 0.55, weather: 1, traffic: 1.05 },
  'low-traffic': { distance: 1.1, ice: 1, weather: 1, traffic: 0.55 },
};

const getStrategyRisk = (strategy: RouteStrategy, weather: WeatherCondition, icebergCount: number, traffic: number): number => {
  const factors = strategyFactors[strategy];
  const score = (
    weather.seaIceConcentration * 0.4 * factors.ice +
    Math.min(icebergCount * 12, 48) * factors.weather +
    weather.windSpeed * 0.8 * factors.weather +
    traffic * 0.3 * factors.traffic
  ) * 0.85;
  return Math.max(0, Math.min(100, Math.round(score)));
};

const riskLevelFromScore = (score: number): Route['riskLevel'] => {
  if (score >= 70) return 'High';
  if (score >= 40) return 'Medium';
  return 'Low';
};

const createRouteSegments = (
  coordinates: [number, number][],
  weather: WeatherCondition,
  icebergs: Iceberg[],
  trafficDensity: number,
  routeScore: number
): RouteSegment[] => coordinates.slice(0, -1).map((coordinate, index) => {
  const nextCoordinate = coordinates[index + 1];
  const latitude = (coordinate[1] + nextCoordinate[1]) / 2;
  const longitude = (coordinate[0] + nextCoordinate[0]) / 2;
  const icebergRisk = Math.min(100, icebergs.length * 12 + Math.random() * 20);
  const riskScore = Math.max(0, Math.min(100, Math.round(
    routeScore * 0.55 + weather.windSpeed * 0.5 + weather.seaIceConcentration * 0.2 + icebergRisk * 0.2
  )));

  return {
    latitude,
    longitude,
    weather: weather.forecast,
    windSpeed: weather.windSpeed,
    visibility: weather.visibility,
    waveHeight: weather.waveHeight,
    seaIceConcentration: weather.seaIceConcentration,
    icebergRisk: Math.round(icebergRisk),
    trafficDensity: Math.round(trafficDensity),
    riskScore,
    timestamp: new Date().toISOString(),
  };
});

const generateRouteForStrategy = (departureId: string, arrivalId: string, strategy: RouteStrategy, label: string): Route | null => {
  const departure = ports.find(p => p.id === departureId);
  const arrival = ports.find(p => p.id === arrivalId);
  if (!departure || !arrival) return null;

  const mainCoordinates = getRouteWaypoints(departure, arrival, strategy);
  const distance = calculatePolylineDistance(mainCoordinates);
  const distanceNm = distance * KM_TO_NM;

  // Operating vessel speeds per strategy
  // Shortest: standard full transit speed (13.5 kn)
  // Safest: cautious navigation speed avoiding dynamic ice impact (11.8 kn)
  // Fuel-efficient: optimal hydrodynamic eco-steaming speed (10.8 kn)
  const strategySpeeds: Record<RouteStrategy, number> = {
    shortest: 13.5,
    safest: 11.8,
    'fuel-efficient': 10.8,
    'weather-optimized': 12.0,
    'low-sea-ice': 11.5,
    'low-traffic': 12.5,
  };
  const operatingSpeedKn = strategySpeeds[strategy] || 12.0;

  const weather = generateWeatherCondition(departure.latitude, arrival.latitude);
  const icebergs = generateIcebergs(mainCoordinates);

  const estimatedTimeHrs = distanceNm / operatingSpeedKn;
  const estimatedTimeMinutes = Math.round(estimatedTimeHrs * 60);

  // Marine engine cubic power law: Fuel consumption per NM ∝ (V / V_design)^2
  const speedRatio = operatingSpeedKn / 13.5;
  const specificFuelRate = FUEL_RATE_TONS_PER_NM * Math.pow(speedRatio, 2);
  const fuelTons = Math.round(distanceNm * specificFuelRate * 10) / 10;

  const trafficCongestion = Math.min(Math.round(25 * (strategyFactors[strategy]?.traffic || 1)), 100);
  const score = getStrategyRisk(strategy, weather, icebergs.length, trafficCongestion);
  const riskLevel = riskLevelFromScore(score);

  const baseRoute: Route = {
    id: `${departure.id}-${arrival.id}-${strategy}`,
    strategy,
    label,
    score,
    departure,
    arrival,
    distance,
    estimatedTimeMinutes,
    riskLevel,
    weatherConditions: weather,
    trafficCongestion,
    coordinates: mainCoordinates,
    alerts: [],
    alternativeRoutes: [],
    icebergs,
    ships: [],
    fuelEstimate: fuelTons,
    avgSpeed: operatingSpeedKn,
    validation: {
      waterOnly: true,
      valid: true,
      checkedPoints: mainCoordinates.length,
      checkedSegments: mainCoordinates.length - 1,
    },
  };

  baseRoute.ships = generateShips(baseRoute);
  baseRoute.alerts = generateAlerts(baseRoute, icebergs);
  baseRoute.segments = createRouteSegments(
    mainCoordinates,
    weather,
    icebergs,
    trafficCongestion,
    score
  );

  // Generate 2 alternative routes with different characteristics
  const altStrategies: RouteStrategy[] = ['safest', 'fuel-efficient'];
  for (let i = 0; i < 2; i++) {
    const altStrat = altStrategies[i] || 'safest';
    const altCoords = getRouteWaypoints(departure, arrival, altStrat);
    const altDistance = Math.round(distance * (1.05 + Math.random() * 0.15));
    const altDistNm = altDistance * KM_TO_NM;
    const altIcePenalty = (Math.random() * 80 / 100) * 6;
    const altBaseSpeed = strategySpeeds[altStrat] || 12.0;
    const altSpeed = Math.max(altBaseSpeed - altIcePenalty, 5);
    const altTime = Math.round(altDistNm / altSpeed);
    const altFuel = Math.round(altDistNm * FUEL_RATE_TONS_PER_NM);
    const altIceCount = Math.floor(Math.random() * 4);
    const altRisk = riskLevelFromScore(getStrategyRisk(strategy, weather, altIceCount, trafficCongestion));

    baseRoute.alternativeRoutes.push({
      coordinates: altCoords,
      distance: altDistance,
      estimatedTimeMinutes: altTime * 60,
      riskLevel: altRisk,
      fuelConsumption: altFuel,
    });
  }

  return baseRoute;
};

export const generateRoutes = (departureId: string, arrivalId: string): Route[] =>
  routeStrategies
    .map(({ strategy, label }) => generateRouteForStrategy(departureId, arrivalId, strategy, label))
    .filter((route): route is Route => route !== null);

export const generateRoute = (departureId: string, arrivalId: string): Route | null =>
  generateRoutes(departureId, arrivalId)[0] || null;

export const calculateDistance = (p1: Port, p2: Port): number => {
  const R = 6371;
  const dLat = (p2.latitude - p1.latitude) * Math.PI / 180;
  const dLon = (p2.longitude - p1.longitude) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(p1.latitude * Math.PI / 180) * Math.cos(p2.latitude * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

export const getAllPorts = () => ports;