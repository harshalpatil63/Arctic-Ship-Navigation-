import { Port, Ship, Iceberg, Route, WeatherCondition, Alert } from '../types';

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

// Pre-defined waypoints for common routes along actual sea lanes
const seaRouteWaypoints: Record<string, [number, number][]> = {
  'p1-p3': [[33.08, 68.96], [33.50, 71.00], [25.00, 74.00], [20.00, 76.00], [15.63, 78.22]],
  'p1-p2': [[33.08, 68.96], [40.00, 70.00], [60.00, 73.00], [100.00, 75.00], [140.00, 74.00], [170.30, 69.70]],
  'p1-p6': [[33.08, 68.96], [40.00, 70.00], [50.00, 71.00], [62.00, 71.50], [72.07, 71.27]],
  'p1-p5': [[33.08, 68.96], [45.00, 70.50], [70.00, 72.00], [100.00, 73.00], [128.86, 71.64]],
  'p4-p7': [[-51.72, 64.18], [-55.00, 65.00], [-70.00, 65.00], [-85.00, 62.00], [-94.17, 58.77]],
  'p8-p9': [[166.69, -77.84], [180.00, -75.00], [-150.00, -72.00], [-100.00, -70.00], [-68.13, -67.57]],
};

const isInWater = (lon: number, lat: number): boolean => {
  for (const region of [...seaCoordinates.arctic, ...seaCoordinates.antarctic]) {
    const [[x1, y1], [x2, y2]] = region;
    if (lon >= Math.min(x1, x2) - 5 && lon <= Math.max(x1, x2) + 5 &&
      lat >= Math.min(y1, y2) - 5 && lat <= Math.max(y1, y2) + 5) {
      return true;
    }
  }
  return false;
};

const generateSeaRouteWaypoints = (start: [number, number], end: [number, number]): [number, number][] => {
  const waypoints: [number, number][] = [start];
  const numPoints = 6;
  for (let i = 1; i < numPoints - 1; i++) {
    const t = i / (numPoints - 1);
    let point: [number, number], attempts = 0;
    const baseLon = start[0] + (end[0] - start[0]) * t;
    const baseLat = start[1] + (end[1] - start[1]) * t;
    do {
      const lonDev = (Math.random() - 0.5) * (attempts * 0.3 + 1.5);
      const latDev = (Math.random() - 0.5) * (attempts * 0.2 + 1.0);
      point = [baseLon + lonDev, baseLat + latDev];
      attempts++;
    } while (!isInWater(point[0], point[1]) && attempts < 25);
    waypoints.push(point);
  }
  waypoints.push(end);
  return waypoints;
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

const calculateRiskLevel = (iceConcentration: number, icebergCount: number, windSpeed: number): 'Low' | 'Medium' | 'High' => {
  const score = (iceConcentration / 100) * 40 + (icebergCount / 5) * 30 + (windSpeed / 40) * 30;
  if (score > 55) return 'High';
  if (score > 30) return 'Medium';
  return 'Low';
};

// Fuel consumption rate: tons per nautical mile (typical icebreaker-class)
const FUEL_RATE_TONS_PER_NM = 0.12;
const KM_TO_NM = 0.539957;

export const generateRoute = (departureId: string, arrivalId: string): Route | null => {
  const departure = ports.find(p => p.id === departureId);
  const arrival = ports.find(p => p.id === arrivalId);
  if (!departure || !arrival) return null;

  const mainCoordinates = getRouteWaypoints(departure, arrival);
  const distance = calculateDistance(departure, arrival);
  const weather = generateWeatherCondition(departure.latitude, arrival.latitude);
  const icebergs = generateIcebergs(mainCoordinates);

  // Speed affected by ice concentration: 14 kn base, reduced by ice
  const baseSpeedKn = 14;
  const icePenalty = (weather.seaIceConcentration / 100) * 6; // up to 6kn slower
  const avgSpeedKn = Math.max(baseSpeedKn - icePenalty, 5);
  const distanceNm = distance * KM_TO_NM;
  const estimatedTimeHrs = Math.round(distanceNm / avgSpeedKn);
  const fuelTons = Math.round(distanceNm * FUEL_RATE_TONS_PER_NM);

  const riskLevel = calculateRiskLevel(weather.seaIceConcentration, icebergs.length, weather.windSpeed);

  const baseRoute: Route = {
    id: `${departure.id}-${arrival.id}`,
    departure,
    arrival,
    distance,
    estimatedTime: estimatedTimeHrs,
    riskLevel,
    weatherConditions: weather,
    trafficCongestion: 0,
    coordinates: mainCoordinates,
    alerts: [],
    alternativeRoutes: [],
    icebergs,
    ships: [],
    fuelEstimate: fuelTons,
    avgSpeed: Math.round(avgSpeedKn * 10) / 10,
  };

  baseRoute.ships = generateShips(baseRoute);
  baseRoute.trafficCongestion = Math.min((baseRoute.ships.length / 6) * 100, 100);
  baseRoute.alerts = generateAlerts(baseRoute, icebergs);

  // Generate 2 alternative routes with different characteristics
  for (let i = 0; i < 2; i++) {
    const altCoords = generateSeaRouteWaypoints(
      [departure.longitude, departure.latitude],
      [arrival.longitude, arrival.latitude]
    );
    const altDistance = Math.round(distance * (1.05 + Math.random() * 0.15));
    const altDistNm = altDistance * KM_TO_NM;
    const altIcePenalty = (Math.random() * 80 / 100) * 6;
    const altSpeed = Math.max(baseSpeedKn - altIcePenalty, 5);
    const altTime = Math.round(altDistNm / altSpeed);
    const altFuel = Math.round(altDistNm * FUEL_RATE_TONS_PER_NM);
    const altIceCount = Math.floor(Math.random() * 4);
    const altRisk = calculateRiskLevel(Math.random() * 80, altIceCount, 10 + Math.random() * 25);

    baseRoute.alternativeRoutes.push({
      coordinates: altCoords,
      distance: altDistance,
      estimatedTime: altTime,
      riskLevel: altRisk,
      fuelConsumption: altFuel,
    });
  }

  return baseRoute;
};

const getRouteWaypoints = (departure: Port, arrival: Port): [number, number][] => {
  const key1 = `${departure.id}-${arrival.id}`;
  const key2 = `${arrival.id}-${departure.id}`;
  if (seaRouteWaypoints[key1]) return seaRouteWaypoints[key1];
  if (seaRouteWaypoints[key2]) return [...seaRouteWaypoints[key2]].reverse();
  return generateSeaRouteWaypoints(
    [departure.longitude, departure.latitude],
    [arrival.longitude, arrival.latitude]
  );
};

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