import { Port, Ship, Iceberg, Route, RouteSegment, RouteStrategy, WeatherCondition, Alert } from '../types';

// Bounding boxes for validating waypoints fall in navigable polar waters.
// Each entry is [[lonMin, latMin], [lonMax, latMax]].
const seaCoordinates = {
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

const interpolateCoordinates = (points: [number, number][], stepsPerSegment = 6): [number, number][] => {
  if (points.length < 2) return points;
  const result: [number, number][] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    for (let s = 0; s < stepsPerSegment; s++) {
      const t = s / stepsPerSegment;
      const lon = p1[0] + (p2[0] - p1[0]) * t;
      const lat = p1[1] + (p2[1] - p1[1]) * t;
      result.push([Math.round(lon * 1000) / 1000, Math.round(lat * 1000) / 1000]);
    }
  }
  result.push(points[points.length - 1]);
  return result;
};

const buildSeaCorridorWaypoints = (start: Port, end: Port, strategy: RouteStrategy): [number, number][] => {
  const startApproach = harborApproaches[start.id] || [];
  const endApproach = (harborApproaches[end.id] || []).slice().reverse();

  const waypoints: [number, number][] = [
    [start.longitude, start.latitude],
    ...startApproach,
  ];
  
  // If moving along Northern Sea Route (e.g. Russia Arctic ports)
  const isArcticEast = start.longitude > 20 && end.longitude > 20 && start.latitude > 60 && end.latitude > 60;
  if (isArcticEast) {
    const minLon = Math.min(start.longitude, end.longitude);
    const maxLon = Math.max(start.longitude, end.longitude);
    const eastwards = end.longitude > start.longitude;
    
    // Add sea strait waypoints sequentially based on longitude range
    const straits: Array<{ lon: number; lat: number }> = [
      { lon: 38.5, lat: 71.0 },   // Barents Sea
      { lon: 58.5, lat: 70.4 },   // Kara Strait
      { lon: 75.0, lat: 73.5 },   // Kara Sea Center
      { lon: 103.0, lat: 77.8 },  // Vilkitsky Strait
      { lon: 125.0, lat: 75.5 },  // Laptev Sea Center
      { lon: 140.0, lat: 74.6 },  // Sannikov Strait
      { lon: 162.0, lat: 72.8 },  // East Siberian Sea
    ];

    const activeStraits = straits.filter(s => s.lon >= minLon - 5 && s.lon <= maxLon + 5);
    if (!eastwards) activeStraits.reverse();

    for (const strait of activeStraits) {
      const latOffset = strategy === 'safest' ? 1.5 : strategy === 'fuel-efficient' ? -0.5 : 0;
      waypoints.push([strait.lon, strait.lat + latOffset]);
    }
  } else {
    // General ocean midpoint with water perturbation
    const midLon = (start.longitude + end.longitude) / 2;
    const midLat = (start.latitude + end.latitude) / 2;
    const latOffset = strategy === 'safest' ? 2.5 : strategy === 'fuel-efficient' ? -1.5 : 1.0;
    waypoints.push([midLon, midLat + latOffset]);
  }

  waypoints.push(...endApproach);
  waypoints.push([end.longitude, end.latitude]);
  return waypoints;
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
    baseWaypoints = buildSeaCorridorWaypoints(departure, arrival, strategy);
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
    let lon: number, lat: number, attempts = 0;
    do {
      lon = basePosition[0] + (Math.random() - 0.5) * 3;
      lat = basePosition[1] + (Math.random() - 0.5) * 2;
      attempts++;
    } while (!isInWater(lon, lat) && attempts < 15);

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
  const straightLineDistance = calculateDistance(departure, arrival);
  const distance = Math.round(straightLineDistance * strategyFactors[strategy].distance);
  const weather = generateWeatherCondition(departure.latitude, arrival.latitude);
  const icebergs = generateIcebergs(mainCoordinates);

  // Speed affected by ice concentration: 14 kn base, reduced by ice
  const baseSpeedKn = 14;
  const icePenalty = (weather.seaIceConcentration / 100) * 6; // up to 6kn slower
  const avgSpeedKn = Math.max(baseSpeedKn - icePenalty, 5);
  const distanceNm = distance * KM_TO_NM;
  const estimatedTimeHrs = Math.round(distanceNm / avgSpeedKn);
  const fuelTons = Math.round(distanceNm * FUEL_RATE_TONS_PER_NM);

  const trafficCongestion = Math.min((Math.floor(Math.random() * 3) + 2) / 6 * 100 * strategyFactors[strategy].traffic, 100);
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
    estimatedTimeMinutes: estimatedTimeHrs * 60,
    riskLevel,
    weatherConditions: weather,
    trafficCongestion,
    coordinates: mainCoordinates,
    alerts: [],
    alternativeRoutes: [],
    icebergs,
    ships: [],
    fuelEstimate: fuelTons,
    avgSpeed: Math.round(avgSpeedKn * 10) / 10,
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
    const altSpeed = Math.max(baseSpeedKn - altIcePenalty, 5);
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

const calculateDistance = (p1: Port, p2: Port): number => {
  const R = 6371;
  const dLat = (p2.latitude - p1.latitude) * Math.PI / 180;
  const dLon = (p2.longitude - p1.longitude) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(p1.latitude * Math.PI / 180) * Math.cos(p2.latitude * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

export const getAllPorts = () => ports;