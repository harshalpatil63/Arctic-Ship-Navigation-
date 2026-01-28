import { Port, Ship, Iceberg, Route, WeatherCondition, Alert } from '../types';

// Arctic and Antarctic sea coordinates for route validation
const seaCoordinates = {
  arctic: [
    [[30, 69], [180, 77]],
    [[30, 65], [180, 73]],
    [[-140, 75], [-50, 75]],
    [[-40, 70], [20, 80]],
  ],
  antarctic: [
    [[-70, -55], [-60, -65]],
    [[160, -70], [180, -75]],
    [[-60, -75], [-30, -75]],
  ]
};

const ports: Port[] = [
  { id: 'p1', name: 'Murmansk', latitude: 68.9585, longitude: 33.0827, country: 'Russia', congestion: 85, description: 'Major Arctic port with year-round operations' },
  { id: 'p2', name: 'Pevek', latitude: 69.7019, longitude: 170.2999, country: 'Russia', congestion: 45, description: 'Northernmost port in Russia' },
  { id: 'p3', name: 'Longyearbyen', latitude: 78.2232, longitude: 15.6267, country: 'Norway', congestion: 65, description: 'Main settlement in Svalbard' },
  { id: 'p4', name: 'Nuuk', latitude: 64.1835, longitude: -51.7216, country: 'Greenland', congestion: 55, description: 'Capital of Greenland' },
  { id: 'p5', name: 'Tiksi', latitude: 71.6351, longitude: 128.8644, country: 'Russia', congestion: 40, description: 'Important port on Northern Sea Route' },
  { id: 'p6', name: 'Sabetta', latitude: 71.2714, longitude: 72.0686, country: 'Russia', congestion: 75, description: 'LNG export terminal' },
  { id: 'p7', name: 'Churchill', latitude: 58.7684, longitude: -94.1650, country: 'Canada', congestion: 35, description: 'Canadian Arctic port' },
  { id: 'p8', name: 'McMurdo Station', latitude: -77.8419, longitude: 166.6863, country: 'Antarctica', congestion: 30, description: 'Largest Antarctic research station' },
  { id: 'p9', name: 'Rothera Research Station', latitude: -67.5674, longitude: -68.1255, country: 'Antarctica', congestion: 25, description: 'British Antarctic Survey main station' },
  { id: 'p10', name: 'Davis Station', latitude: -68.5760, longitude: 77.9689, country: 'Antarctica', congestion: 20, description: 'Australian Antarctic station' }
];

const seaRouteWaypoints: Record<string, [number, number][]> = {
  'p1-p3': [[33.0827, 68.9585], [33.5000, 71.0000], [25.0000, 74.0000], [20.0000, 76.0000], [15.6267, 78.2232]],
  'p1-p2': [[33.0827, 68.9585], [40.0000, 70.0000], [60.0000, 73.0000], [100.0000, 75.0000], [140.0000, 74.0000], [170.2999, 69.7019]],
  'p4-p7': [[-51.7216, 64.1835], [-55.0000, 65.0000], [-70.0000, 65.0000], [-85.0000, 62.0000], [-94.1650, 58.7684]],
  'p8-p9': [[166.6863, -77.8419], [180.0000, -75.0000], [-150.0000, -72.0000], [-100.0000, -70.0000], [-68.1255, -67.5674]]
};

const isInWater = (lon: number, lat: number): boolean => {
  for (const region of [...seaCoordinates.arctic, ...seaCoordinates.antarctic]) {
    const [[x1, y1], [x2, y2]] = region;
    if (lon >= Math.min(x1, x2) - 3 && lon <= Math.max(x1, x2) + 3 &&
      lat >= Math.min(y1, y2) - 3 && lat <= Math.max(y1, y2) + 3) {
      return true;
    }
  }
  return false;
};

const generateSeaRouteWaypoints = (start: [number, number], end: [number, number]): [number, number][] => {
  const waypoints: [number, number][] = [start];
  const numPoints = 5;
  for (let i = 1; i < numPoints - 1; i++) {
    const t = i / (numPoints - 1);
    let point: [number, number], attempts = 0;
    const maxAttempts = 20;
    const baseLon = start[0] + (end[0] - start[0]) * t;
    const baseLat = start[1] + (end[1] - start[1]) * t;
    do {
      const deviation = (Math.random() - 0.5) * (attempts * 0.5 + 2);
      point = [baseLon + deviation, baseLat + deviation];
      attempts++;
    } while (!isInWater(point[0], point[1]) && attempts < maxAttempts);
    waypoints.push(point);
  }
  waypoints.push(end);
  return waypoints;
};

const generateIcebergs = (routeCoordinates: [number, number][]): Iceberg[] => {
  const icebergs: Iceberg[] = [];
  const numIcebergs = Math.floor(Math.random() * 5) + 1;
  for (let i = 0; i < numIcebergs; i++) {
    const routeIndex = Math.floor(Math.random() * (routeCoordinates.length - 1));
    const basePosition = routeCoordinates[routeIndex];
    let icebergLon: number, icebergLat: number, attempts = 0;
    do {
      const offset = (Math.random() - 0.5) * 4;
      icebergLon = basePosition[0] + offset;
      icebergLat = basePosition[1] + offset;
      attempts++;
    } while (!isInWater(icebergLon, icebergLat) && attempts < 15);
    icebergs.push({
      id: `iceberg-${i}-${Math.random()}`,
      name: `Titan-${String(i + 1).padStart(2, '0')}`,
      latitude: icebergLat,
      longitude: icebergLon,
      size: ['Small', 'Medium', 'Large'][Math.floor(Math.random() * 3)],
      driftSpeed: Math.random() * 2,
      riskProbability: Math.random() * 100,
      lastSeen: new Date().toISOString(),
      predictedPath: [],
      description: `Iceberg drift: ${(Math.random() * 2).toFixed(1)} kn`,
      estimatedMeltDate: new Date(Date.now() + 5000000000).toISOString()
    });
  }
  return icebergs;
};

const generateShips = (route: Route): Ship[] => {
  const ships: Ship[] = [];
  const numShips = Math.floor(Math.random() * 4) + 2; // Generate 2-5 ships
  for (let i = 0; i < numShips; i++) {
    const progress = Math.random();
    const routeIndex = Math.floor(progress * (route.coordinates.length - 1));
    const position = route.coordinates[routeIndex];
    ships.push({
      id: `ship-${route.id}-${i}`,
      name: `Arctic Voyager ${i + 1}`,
      latitude: position[1],
      longitude: position[0],
      speed: 12 + Math.random() * 8,
      destination: route.arrival.name,
      riskScore: Math.random() * 100,
      cargoType: ['Container', 'LNG', 'Research', 'Tanker'][Math.floor(Math.random() * 4)],
      eta: new Date(Date.now() + 86400000).toISOString(),
      heading: Math.random() * 360,
      status: 'En Route'
    });
  }
  return ships;
};

const generateWeatherCondition = (lat: number): WeatherCondition => {
  const isSummer = new Date().getMonth() >= 4 && new Date().getMonth() <= 8;
  const baseTemp = lat > 0 ? (isSummer ? -5 : -25) : (isSummer ? 0 : -15);
  const temp = baseTemp + (Math.random() - 0.5) * 10;
  const iceConcentration = Math.random() * 100;
  return {
    temperature: temp,
    windSpeed: 15 + Math.random() * 25,
    visibility: 'Moderate',
    forecast: 'Snow',
    waveHeight: 2 + Math.random() * 3,
    seaIceConcentration: iceConcentration,
    predictions: []
  };
};

const generateAlerts = (route: Route, icebergs: Iceberg[]): Alert[] => {
  const alerts: Alert[] = [];
  if (route.weatherConditions.seaIceConcentration > 75) {
    alerts.push({ type: 'Weather', severity: 'High', message: 'Critical Sea Ice Levels', timeToImpact: 2 });
  }
  icebergs.forEach(ice => {
    if (ice.riskProbability > 80) {
      alerts.push({ type: 'Collision', severity: 'High', message: `Collision Risk: ${ice.name}`, timeToImpact: 1, location: { latitude: ice.latitude, longitude: ice.longitude } });
    }
  });
  return alerts;
};

const calculateRiskLevel = (iceConcentration: number, icebergCount: number): 'Low' | 'Medium' | 'High' => {
  if (iceConcentration > 70 || icebergCount >= 4) return 'High';
  if (iceConcentration > 30 || icebergCount >= 2) return 'Medium';
  return 'Low';
};

export const generateRoute = (departureId: string, arrivalId: string): Route | null => {
  const departure = ports.find(p => p.id === departureId);
  const arrival = ports.find(p => p.id === arrivalId);
  if (!departure || !arrival) return null;

  const mainCoordinates = getRouteWaypoints(departure, arrival);
  const weather = generateWeatherCondition(departure.latitude);
  const icebergs = generateIcebergs(mainCoordinates);

  // DYNAMIC RISK CALCULATION
  const riskLevel = calculateRiskLevel(weather.seaIceConcentration, icebergs.length);

  const baseRoute: Route = {
    id: `${departure.id}-${arrival.id}`,
    departure,
    arrival,
    distance: calculateDistance(departure, arrival),
    estimatedTime: Math.floor(Math.random() * 40) + 40,
    riskLevel: riskLevel,
    weatherConditions: weather,
    trafficCongestion: 0, // Will calculate below
    coordinates: mainCoordinates,
    alerts: [],
    alternativeRoutes: [],
    icebergs: icebergs,
    ships: []
  };

  // Populate dynamic ships and alerts
  baseRoute.ships = generateShips(baseRoute);
  baseRoute.trafficCongestion = (baseRoute.ships.length / 10) * 100; // Congestion based on ship count
  baseRoute.alerts = generateAlerts(baseRoute, icebergs);

  // Generate 2 alternative routes
  for (let i = 0; i < 2; i++) {
    const altCoords = generateSeaRouteWaypoints([departure.longitude, departure.latitude], [arrival.longitude, arrival.latitude]);
    baseRoute.alternativeRoutes.push({
      coordinates: altCoords,
      distance: baseRoute.distance * (1 + (Math.random() * 0.15)),
      estimatedTime: baseRoute.estimatedTime + Math.floor(Math.random() * 10),
      riskLevel: calculateRiskLevel(Math.random() * 100, Math.floor(Math.random() * 4))
    });
  }

  return baseRoute;
};

const getRouteWaypoints = (departure: Port, arrival: Port): [number, number][] => {
  const routeKey = `${departure.id}-${arrival.id}`;
  if (seaRouteWaypoints[routeKey]) return seaRouteWaypoints[routeKey];
  return generateSeaRouteWaypoints([departure.longitude, departure.latitude], [arrival.longitude, arrival.latitude]);
};

const calculateDistance = (p1: Port, p2: Port): number => {
  const R = 6371;
  const dLat = (p2.latitude - p1.latitude) * Math.PI / 180;
  const dLon = (p2.longitude - p1.longitude) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(p1.latitude * Math.PI / 180) * Math.cos(p2.latitude * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

export const getAllPorts = () => ports;