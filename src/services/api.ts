import { LiveWeatherObservation, Port, Route } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export interface RouteMonitoringSample {
  latitude: number;
  longitude: number;
  sequenceNumber: number;
  weather: string;
  windSpeed: number | null;
  windDirection?: number;
  visibility: string;
  waveHeight: number | null;
  temperature: number | null;
  precipitationMm: number | null;
  weatherCode?: number;
  timestamp: string;
}

export interface RouteMonitoringResponse {
  routeId: string;
  status: 'LIVE' | 'STALE';
  lastUpdated: string;
  samples: RouteMonitoringSample[];
  risk: {
    overallRisk: number;
    riskLevel: string;
    dangerousSegments: number[];
    warnings: string[];
    factors: Record<string, string>;
  };
  providers: {
    weather: 'LIVE' | 'UNAVAILABLE';
    seaIce: 'LIVE' | 'UNAVAILABLE';
    traffic: 'LIVE' | 'UNAVAILABLE';
  };
}

/**
 * Backend route response structure (from GEBCO provider)
 * This differs from the frontend Route type and must be transformed
 */
interface BackendRoute {
  id: string;
  provider: string;
  label: string;
  strategy?: string;
  description?: string;
  departure: Port;
  arrival: Port;
  geometry: Array<[number, number]>; // [longitude, latitude] tuples
  waypoints?: Array<{
    sequenceNumber: number;
    latitude: number;
    longitude: number;
    distanceFromStart?: number;
    durationFromStart?: number;
  }>;
  distance: number;
  duration: number;
  fuelEstimate: number;
  weatherConditions?: {
    temperature: number;
    windSpeed: number;
    visibility: string;
    forecast: string;
    waveHeight: number;
    seaIceConcentration: number;
  };
  estimatedSpeedKnots?: number;
  riskLevel?: string;
  riskScore?: number;
  validation?: {
    waterOnly: boolean;
    valid: boolean;
    checkedPoints: number;
    checkedSegments: number;
    reason?: string;
  };
  metadata?: Record<string, unknown>;
}

interface BackendRouteResponse {
  status: string;
  provider: string;
  routes: BackendRoute[];
  error?: string;
  message?: string;
  timestamp?: string;
}

export interface RouteResponse {
  status: string;
  provider: string;
  routes: Route[];
  error?: string;
  message?: string;
}

/**
 * Transform backend route response to frontend Route type
 * Handles all field mappings and provides sensible defaults
 */
function transformBackendRoute(backendRoute: BackendRoute): Route {
  // Backend already provides geometry as [lon, lat] tuples
  // Validate and use directly
  const coordinates: [number, number][] = Array.isArray(backendRoute.geometry)
    ? backendRoute.geometry.filter(
        (coord): coord is [number, number] =>
          Array.isArray(coord) &&
          coord.length >= 2 &&
          typeof coord[0] === 'number' &&
          typeof coord[1] === 'number'
      )
    : [];

  // Transform to frontend Route type
  const route: Route = {
    id: backendRoute.id,
    label: backendRoute.label,
    departure: backendRoute.departure,
    arrival: backendRoute.arrival,
    distance: backendRoute.distance,
    estimatedTimeMinutes: backendRoute.duration, // Backend duration is minutes
    fuelEstimate: backendRoute.fuelEstimate,
    riskLevel: backendRoute.riskLevel === 'Low' || backendRoute.riskLevel === 'High' || backendRoute.riskLevel === 'Critical'
      ? backendRoute.riskLevel
      : 'Medium',
    strategy: backendRoute.strategy as Route['strategy'] || 'shortest',
    weatherConditions: {
      temperature: backendRoute.weatherConditions?.temperature ?? 0,
      windSpeed: backendRoute.weatherConditions?.windSpeed ?? 0,
      visibility: (backendRoute.weatherConditions?.visibility || 'Good') as 'Poor' | 'Moderate' | 'Good',
      forecast: backendRoute.weatherConditions?.forecast || 'Based on real GEBCO routing',
      waveHeight: backendRoute.weatherConditions?.waveHeight ?? 0,
      seaIceConcentration: backendRoute.weatherConditions?.seaIceConcentration ?? 0,
      predictions: [],
    },
    coordinates, // Critical: this is what the map needs
    alerts: [],
    alternativeRoutes: [],
    validation: backendRoute.validation,
    trafficCongestion: 0, // Default traffic congestion
    ships: [], // No live ship data from GEBCO provider
    icebergs: [], // No live iceberg data from GEBCO provider
  };

  return route;
}

export async function generateRoutesFromApi(
  departureId: string,
  arrivalId: string
): Promise<RouteResponse> {
  const response = await fetch(`${API_URL}/routes/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ departureId, arrivalId }),
  });

  const payload = (await response.json()) as BackendRouteResponse;

  // Handle all possible response statuses from GEBCO provider
  if (payload.status === 'UNAVAILABLE') {
    throw new Error(
      payload.message ||
        'Marine routing provider is currently unavailable. Please try again later.'
    );
  }

  if (payload.status === 'NO_ROUTE_FOUND' || payload.status === 'NO_ROUTE') {
    throw new Error(
      payload.message ||
        'No navigable water route found between these ports. Water depth may be insufficient.'
    );
  }

  if (payload.status === 'ERROR') {
    throw new Error(
      payload.message ||
        `Route calculation failed: ${payload.error || 'Unknown error'}`
    );
  }

  if (payload.status !== 'SUCCESS' && payload.status !== 'LIVE' && payload.status !== 'NO_SUFFICIENT_ALTERNATIVES') {
    throw new Error(`Unexpected routing status: ${payload.status}`);
  }

  // Transform backend routes to frontend Route type
  const transformedRoutes: Route[] = payload.routes.map((backendRoute) =>
    transformBackendRoute(backendRoute)
  );

  return {
    status: payload.status,
    provider: payload.provider,
    routes: transformedRoutes,
    message: payload.message,
  };
}

export async function getWeatherFromApi(
  latitude: number,
  longitude: number
): Promise<LiveWeatherObservation> {
  try {
    const response = await fetch(
      `${API_URL}/weather?latitude=${encodeURIComponent(
        latitude
      )}&longitude=${encodeURIComponent(longitude)}`
    );

    if (response.ok) {
      const observation = (await response.json()) as LiveWeatherObservation;
      if (observation.status === 'LIVE') return observation;
    }
  } catch (error) {
    console.warn('Backend weather endpoint unavailable, trying direct Open-Meteo query', error);
  }

  // Fallback to direct Open-Meteo API query if backend is unavailable
  try {
    const openMeteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,wind_speed_10m,wind_direction_10m,surface_pressure,precipitation,weather_code`;
    const res = await fetch(openMeteoUrl);
    if (res.ok) {
      const data = (await res.json()) as Record<string, any>;
      const current = data.current || {};
      return {
        status: 'LIVE',
        provider: 'open-meteo-direct',
        receivedAt: new Date().toISOString(),
        coordinates: { latitude, longitude },
        current: {
          temperatureCelsius: current.temperature_2m ?? -5,
          windSpeedKmh: current.wind_speed_10m ?? 20,
          windDirectionDegrees: current.wind_direction_10m ?? 180,
          precipitationMm: current.precipitation ?? 0,
          pressureHpa: current.surface_pressure ?? 1013,
          weatherCode: current.weather_code ?? 0,
        },
      };
    }
  } catch (err) {
    console.warn('Direct Open-Meteo query failed:', err);
  }

  return {
    status: 'UNAVAILABLE',
    provider: 'open-meteo',
    receivedAt: new Date().toISOString(),
    coordinates: { latitude, longitude },
    error: 'Weather service unavailable',
  };
}

interface PortsResponse {
  status: string;
  data: Port[];
}

export async function getPortsFromApi(): Promise<PortsResponse> {
  const response = await fetch(`${API_URL}/ports`);
  const payload = await response.json() as PortsResponse & { error?: string };
  if (!response.ok) throw new Error(payload.error || `Ports API returned ${response.status}`);
  return payload;
}

/**
 * Get marine routing provider status
 */
export async function getRoutingProviderStatus() {
  const response = await fetch(`${API_URL}/routing/status`);
  return response.json() as Promise<{
    available: boolean;
    lastChecked: string;
    error?: string;
  }>;
}

export async function getRouteMonitoring(routeId: string): Promise<RouteMonitoringResponse> {
  const response = await fetch(`${API_URL}/routes/${encodeURIComponent(routeId)}/monitoring`);
  const payload = await response.json() as RouteMonitoringResponse & { error?: string };
  if (!response.ok) throw new Error(payload.error || `Route monitoring returned ${response.status}`);
  return payload;
}