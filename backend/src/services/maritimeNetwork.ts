// Global maritime water navigation network for polar and inter-ocean routes (100% water only)

export interface MaritimeRouteResult {
  strategy: 'shortest' | 'safest' | 'fuel-efficient';
  label: string;
  distance: number; // km
  duration: number; // minutes
  geometry: Array<{ latitude: number; longitude: number }>;
}

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
    sum += haversineDist(points[i]!, points[i + 1]!);
  }
  return Math.round(sum);
};

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

  // Circumpolar Southern Ocean
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

  ['south_atlantic_mid', 'south_atlantic_east'],
  ['south_atlantic_east', 'cape_good_hope_south'],
  ['cape_good_hope_south', 'south_indian_ocean_w'],
  ['south_indian_ocean_w', 'south_indian_ocean_m'],
  ['south_indian_ocean_m', 'kerguelen_waters'],
  ['kerguelen_waters', 'prydz_bay_outer'],

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

const maritimeAdjacency: Record<string, Array<{ node: string; dist: number }>> = {};
for (const k in maritimeNodes) maritimeAdjacency[k] = [];
for (const [u, v] of maritimeEdges) {
  if (maritimeNodes[u] && maritimeNodes[v]) {
    const d = haversineDist(maritimeNodes[u], maritimeNodes[v]);
    maritimeAdjacency[u]?.push({ node: v, dist: d });
    maritimeAdjacency[v]?.push({ node: u, dist: d });
  }
}

const narrowStraits = new Set([
  'kara_strait', 'vilkitsky_strait', 'sannikov_strait',
  'long_strait', 'bering_strait', 'davis_strait',
  'denmark_strait', 'hudson_strait_e', 'hudson_strait_m',
  'hudson_strait_w', 'drake_passage_mid', 'bransfield_strait'
]);

function dijkstraPath(startId: string, endId: string, strategy: 'shortest' | 'safest' | 'fuel-efficient'): [number, number][] {
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
    if (idx === 0 || idx === pathKeys.length - 1 || nodeKey.startsWith('app_') || narrowStraits.has(nodeKey)) {
      return [raw[0], raw[1]];
    }

    let latOffset = 0;
    if (strategy === 'safest') latOffset = 1.2;
    else if (strategy === 'fuel-efficient') latOffset = -0.8;

    const finalLat = Math.max(-85, Math.min(85, raw[1] + latOffset));
    return [raw[0], finalLat];
  });
}

function interpolateWaypoints(points: [number, number][], steps = 6): [number, number][] {
  if (points.length < 2) return points;
  const result: [number, number][] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i]!;
    const p2 = points[i + 1]!;

    let dLon = p2[0] - p1[0];
    if (dLon > 180) dLon -= 360;
    if (dLon < -180) dLon += 360;
    const dLat = p2[1] - p1[1];

    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      let lon = p1[0] + dLon * t;
      if (lon > 180) lon -= 360;
      if (lon < -180) lon += 360;
      const lat = p1[1] + dLat * t;
      result.push([Math.round(lon * 1000) / 1000, Math.round(lat * 1000) / 1000]);
    }
  }
  result.push(points[points.length - 1]!);
  return result;
}

export function generateMaritimeRoutes(departureId: string, arrivalId: string): MaritimeRouteResult[] {
  const strategies: Array<{ strategy: 'shortest' | 'safest' | 'fuel-efficient'; label: string; speedKnots: number }> = [
    { strategy: 'shortest', label: 'Shortest Marine Route', speedKnots: 13 },
    { strategy: 'safest', label: 'Safest Polar Route', speedKnots: 11.5 },
    { strategy: 'fuel-efficient', label: 'Fuel-Efficient Route', speedKnots: 12 },
  ];

  const results: MaritimeRouteResult[] = [];

  for (const { strategy, label, speedKnots } of strategies) {
    const rawPath = dijkstraPath(departureId, arrivalId, strategy);
    if (!rawPath || rawPath.length < 2) continue;

    const interpolated = interpolateWaypoints(rawPath, 5);
    const distanceKm = calculatePolylineDistance(interpolated);
    const distanceNm = distanceKm * 0.539957;
    const durationHours = distanceNm / speedKnots;
    const durationMinutes = Math.round(durationHours * 60);

    const geometry = interpolated.map(([lon, lat]) => ({
      latitude: lat,
      longitude: lon,
    }));

    results.push({
      strategy,
      label,
      distance: distanceKm,
      duration: durationMinutes,
      geometry,
    });
  }

  return results;
}
