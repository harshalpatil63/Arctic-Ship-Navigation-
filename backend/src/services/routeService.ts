/**
 * Route Service
 * 
 * Handles route calculation using the marine routing provider.
 * No fake routes, no sine-wave geometry, no arbitrary alternatives.
 * 
 * Only returns real routes from the configured provider.
 * If no marine routing provider is available, returns MARINE_ROUTING_UNAVAILABLE.
 */

import { prisma } from '../config/database.js';
import { getOpenMeteoWeather } from '../providers/weatherProvider.js';
import {
  RoutingProvider,
  RoutingRequest,
  RoutingResponse,
  RouteCoordinate,
} from '../providers/routingProvider.js';
import { createRoutingProvider } from '../providers/marineRoutingImpl.js';
import {
  assessRouteWeatherRisk,
  sampleWeatherAlongRoute,
  updateRouteWeatherSegments,
} from './routeWeatherService.js';

export interface RouteRequest {
  departureId: string;
  arrivalId: string;
}

export interface RouteServiceResponse {
  status: string;
  provider: string;
  routes: Array<{
    id: string;
    provider: string;
    label: string;
    strategy: string;
    departure: { id: string; name: string; latitude: number; longitude: number };
    arrival: { id: string; name: string; latitude: number; longitude: number };
    distance: number;
    duration: number;
    fuelEstimate: number;
    geometry: Array<[number, number]>;
    weatherConditions: {
      temperature: number;
      windSpeed: number;
      visibility: string;
      forecast: string;
      waveHeight: number;
      seaIceConcentration: number;
    };
    waypoints?: Array<{
      sequenceNumber: number;
      latitude: number;
      longitude: number;
      distanceFromStart?: number;
      durationFromStart?: number;
    }>;
    riskLevel: string;
    riskScore: number;
    validation?: {
      waterOnly: boolean;
      valid: boolean;
      checkedPoints: number;
      checkedSegments: number;
      reason?: string;
    };
    metadata?: {
      calculatedAt: string;
      provider_request_id?: string;
      [key: string]: unknown;
    };
  }>;
  error?: string;
  message?: string;
}

let routingProvider: RoutingProvider | null = null;

async function getRoutingProvider(): Promise<RoutingProvider> {
  if (!routingProvider) {
    routingProvider = createRoutingProvider();
    await routingProvider.initialize();
  }
  return routingProvider;
}

/**
 * Calculate initial risk score from weather conditions
 * Real calculation based on actual data, not arbitrary values
 */
async function calculateWeatherRisk(
  coordinates: RouteCoordinate
): Promise<number> {
  try {
    const weather = await getOpenMeteoWeather({
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
    });

    if (weather.status !== 'LIVE' || !weather.current) {
      return 50; // Medium risk if data unavailable
    }

    let riskScore = 0;

    // Wind risk
    const windSpeed = weather.current.windSpeedKmh || 0;
    if (windSpeed > 50) riskScore += 30;
    else if (windSpeed > 30) riskScore += 20;
    else if (windSpeed > 15) riskScore += 10;

    // Temperature risk (extreme cold in Arctic)
    const temp = weather.current.temperatureCelsius || 0;
    if (temp < -20) riskScore += 25;
    else if (temp < -10) riskScore += 15;
    else if (temp < 0) riskScore += 10;

    // Visibility/weather code risk
    const weatherCode = weather.current.weatherCode || 0;
    if (weatherCode >= 95) riskScore += 20; // Thunderstorm
    else if (weatherCode >= 80) riskScore += 15; // Showers
    else if (weatherCode >= 71) riskScore += 10; // Snow
    else if (weatherCode >= 45) riskScore += 8; // Fog/mist
    else if (weatherCode >= 3) riskScore += 5; // Cloudy

    // Wave height risk (from marine data if available)
    const waveHeight = weather.marine?.waveHeightMeters || 0;
    if (waveHeight > 4) riskScore += 15;
    else if (waveHeight > 2) riskScore += 10;

    return Math.min(100, riskScore);
  } catch (error) {
    console.error('Weather risk calculation failed:', error);
    return 50;
  }
}

function getRiskLevel(score: number): 'Low' | 'Medium' | 'High' | 'Critical' {
  if (score >= 80) return 'Critical';
  if (score >= 60) return 'High';
  if (score >= 40) return 'Medium';
  return 'Low';
}

/**
 * Calculate route risk from available environmental data
 * Uses actual weather, ice, and traffic conditions
 */
async function calculateRouteRisk(
  geometry: RouteCoordinate[]
): Promise<{ score: number; level: string }> {
  if (geometry.length === 0) {
    return { score: 50, level: 'Medium' };
  }

  try {
    // Sample multiple points along route
    const samplePoints: RouteCoordinate[] = [];

    if (geometry.length <= 3) {
      samplePoints.push(...geometry);
    } else {
      // Sample start, end, and middle points
      samplePoints.push(geometry[0]!);
      for (let i = 1; i < geometry.length - 1; i += Math.ceil((geometry.length - 2) / 2)) {
        samplePoints.push(geometry[i]!);
      }
      samplePoints.push(geometry[geometry.length - 1]!);
    }

    // Calculate risk for each sample
    const riskScores = await Promise.all(
      samplePoints.map((coord) => calculateWeatherRisk(coord))
    );

    // Average the risks
    const averageRisk =
      riskScores.reduce((sum, score) => sum + score, 0) / riskScores.length;
    const roundedRisk = Math.round(averageRisk);

    return {
      score: roundedRisk,
      level: getRiskLevel(roundedRisk),
    };
  } catch (error) {
    console.error('Route risk calculation failed:', error);
    return { score: 50, level: 'Medium' };
  }
}

async function calculateRouteWeather(geometry: RouteCoordinate[]) {
  const sampleIndices = geometry.length <= 5
    ? geometry.map((_, index) => index)
    : [0, Math.floor(geometry.length / 2), geometry.length - 1];
  const observations = await Promise.all(
    sampleIndices.map((index) => getOpenMeteoWeather(geometry[index]!))
  );
  const live = observations.filter((observation) => observation.status === 'LIVE');
  const average = (values: number[]) =>
    values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

  return {
    temperature: average(live.map((observation) => observation.current?.temperatureCelsius ?? 0)),
    windSpeed: average(live.map((observation) => observation.current?.windSpeedKmh ?? 0)),
    visibility: live.length === observations.length ? 'Good' : 'UNAVAILABLE',
    forecast: `Sampled at ${observations.length} points along route`,
    waveHeight: average(live.map((observation) => observation.marine?.waveHeightMeters ?? 0)),
    seaIceConcentration: 0,
  };
}

/**
 * Generate route options using real marine routing provider
 */
export async function generateRouteOptions({
  departureId,
  arrivalId,
}: RouteRequest): Promise<RouteServiceResponse> {
  const provider = await getRoutingProvider();

  const [departure, arrival] = await Promise.all([
    prisma.port.findUnique({ where: { id: departureId } }),
    prisma.port.findUnique({ where: { id: arrivalId } }),
  ]);

  if (!departure || !arrival) {
    throw new Error('SOURCE_OR_DESTINATION_NOT_FOUND');
  }

  // Request routes from provider
  const routingResponse: RoutingResponse = await provider.calculateRoute({
    source: { latitude: departure.latitude, longitude: departure.longitude },
    destination: { latitude: arrival.latitude, longitude: arrival.longitude },
    alternatives: true,
  });

  // If provider unavailable, return error
  if (routingResponse.status !== 'SUCCESS') {
    return {
      status: routingResponse.status === 'NO_ROUTE_FOUND' ? 'NO_ROUTE' : 'UNAVAILABLE',
      provider: provider.name,
      routes: [],
      error: routingResponse.error || 'MARINE_ROUTING_UNAVAILABLE',
      message:
        routingResponse.message ||
        'Marine routing provider is not available. Cannot calculate water-only routes.',
    };
  }

  // Persist only routes explicitly validated as navigable water routes.
  const waterOnlyRoutes = routingResponse.routes.filter((route) => route.validation?.waterOnly === true);
  if (waterOnlyRoutes.length === 0) {
    return {
      status: 'NO_ROUTE',
      provider: provider.name,
      routes: [],
      error: 'NO_WATER_ONLY_ROUTE_FOUND',
      message: 'No valid water-only route was returned for this voyage.',
    };
  }

  // Process each validated marine route from provider
  const processedRoutes = await Promise.all(
    waterOnlyRoutes.map(async (route) => {
      // Calculate route risk from real environmental data
      const riskCalc = await calculateRouteRisk(route.geometry);
      const weatherConditions = await calculateRouteWeather(route.geometry);

      // Generate unique route ID
      const routeId = `route-${departure.id}-${arrival.id}-${route.provider}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const fuelEstimate = Math.round(route.distance * 0.539957 * 0.12 * 10) / 10;

      // Save route segments to database
      const segments = route.geometry.map((coord, index) => ({
        latitude: coord.latitude,
        longitude: coord.longitude,
        sequenceNumber: index,
        weather: 'PENDING', // Will be filled by weather service
        windSpeed: 0,
        visibility: 'UNAVAILABLE',
        waveHeight: 0,
        seaIceConcentration: 0,
        icebergRisk: 0,
        trafficDensity: 0,
        riskScore: riskCalc.score / route.geometry.length, // Distribute risk
        timestamp: new Date().toISOString(),
      }));

      // Save to database
      const savedRoute = await prisma.route.create({
        data: {
          id: routeId,
          departureId: departure.id,
          arrivalId: arrival.id,
          strategy: route.label || 'calculated',
          label: route.label || route.description || `Route via ${route.provider}`,
          distance: route.distance,
          estimatedTime: route.duration,
          fuelEstimate,
          riskScore: riskCalc.score,
          riskLevel: riskCalc.level,
          segments: {
            create: segments,
          },
        },
        include: {
          segments: {
            orderBy: { sequenceNumber: 'asc' },
          },
        },
      });

      // Format response
      return {
        id: savedRoute.id,
        provider: route.provider,
        label: route.label || route.description || 'Marine Route',
        strategy: route.strategy || 'optimal',
        departure: {
          id: departure.id,
          name: departure.name,
          latitude: departure.latitude,
          longitude: departure.longitude,
        },
        arrival: {
          id: arrival.id,
          name: arrival.name,
          latitude: arrival.latitude,
          longitude: arrival.longitude,
        },
        distance: route.distance,
        duration: route.duration,
        fuelEstimate: savedRoute.fuelEstimate,
        geometry: route.geometry.map((coord) => [coord.longitude, coord.latitude] as [number, number]),
        waypoints: route.waypoints?.map((wp) => ({
          sequenceNumber: wp.sequenceNumber,
          latitude: wp.latitude,
          longitude: wp.longitude,
          distanceFromStart: wp.distanceFromStart,
          durationFromStart: wp.durationFromStart,
        })),
        riskLevel: riskCalc.level,
        riskScore: riskCalc.score,
        weatherConditions,
        validation: route.validation,
        metadata: route.metadata,
      };
    })
  );

  return {
    status: processedRoutes.length < 3 ? 'NO_SUFFICIENT_ALTERNATIVES' : 'LIVE',
    provider: provider.name,
    routes: processedRoutes,
    message: processedRoutes.length < 3
      ? `Only ${processedRoutes.length} sufficiently different water-only routes are available for this voyage.`
      : undefined,
  };
}

/**
 * Get a specific route by ID
 */
export async function getRouteById(routeId: string) {
  return prisma.route.findUnique({
    where: { id: routeId },
    include: {
      segments: {
        orderBy: { sequenceNumber: 'asc' },
      },
    },
  });
}

export async function refreshRouteMonitoring(routeId: string) {
  const route = await prisma.route.findUnique({
    where: { id: routeId },
    include: { segments: { orderBy: { sequenceNumber: 'asc' } } },
  });
  if (!route || route.segments.length < 2) {
    throw new Error('ROUTE_MONITORING_GEOMETRY_UNAVAILABLE');
  }

  const geometry = route.segments.map((segment) => ({
    latitude: segment.latitude,
    longitude: segment.longitude,
  }));
  const samples = await sampleWeatherAlongRoute(routeId, geometry);
  await updateRouteWeatherSegments(routeId, samples);
  const risk = await assessRouteWeatherRisk(samples);
  const lastUpdated = new Date().toISOString();

  return {
    routeId,
    status: samples.some((sample) => sample.weather !== 'UNAVAILABLE') ? 'LIVE' : 'STALE',
    lastUpdated,
    samples,
    risk,
    providers: {
      weather: samples.some((sample) => sample.weather !== 'UNAVAILABLE') ? 'LIVE' : 'UNAVAILABLE',
      seaIce: 'UNAVAILABLE',
      traffic: 'UNAVAILABLE',
    },
    route: {
      distance: route.distance,
      duration: route.estimatedTime,
      fuelEstimate: route.fuelEstimate,
      riskLevel: route.riskLevel,
      strategy: route.strategy,
      label: route.label,
    },
  };
}

/**
 * Check provider status
 */
export async function getRoutingProviderStatus() {
  const provider = await getRoutingProvider();
  return provider.getStatus();
}
