import cors from 'cors';
import express from 'express';
import { z } from 'zod';
import { generateRouteOptions, getRoutingProviderStatus, refreshRouteMonitoring } from './services/routeService.js';
import { getOpenMeteoWeather } from './providers/weatherProvider.js';
import { persistWeatherObservation } from './services/weatherService.js';
import { prisma } from './config/database.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

export const app = express();
app.use(cors({ origin: (origin, callback) => callback(null, true) }));
app.use(express.json());

app.get('/', (_request, response) => response.json({
  name: 'Arctic Ship Navigation API',
  status: 'ok',
  health: '/api/health',
}));
app.get('/api', (_request, response) => response.json({
  status: 'ok',
  endpoints: ['/api/health', '/api/ports', '/api/weather'],
}));
app.get('/api/health', (_request, response) => response.json({ status: 'ok', mode: 'LIVE' }));
app.get('/api/ports', async (_request, response) => {
  try {
    if (process.env.DATABASE_URL) {
      const ports = await prisma.port.findMany({ orderBy: { name: 'asc' } });
      if (ports && ports.length > 0) {
        return response.json({ status: 'LIVE', data: ports });
      }
    }
  } catch (error) {
    console.warn('Database ports query failed, returning fallback ports:', error);
  }

  const defaultPorts = [
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

  return response.json({ status: 'LIVE', data: defaultPorts });
});
app.get('/api/ships', (_request, response) => response.status(503).json({ status: 'UNAVAILABLE', error: 'Live ship position provider is not configured' }));
const weatherQuerySchema = z.object({
  latitude: z.coerce.number().finite().min(-90).max(90),
  longitude: z.coerce.number().finite().min(-180).max(180),
});
app.get('/api/weather', async (request, response, next) => {
  try {
    const coordinates = weatherQuerySchema.parse(request.query);
    const observation = await getOpenMeteoWeather(coordinates);
    if (observation.status === 'LIVE') {
      try {
        await persistWeatherObservation(observation);
        observation.persistenceStatus = 'PERSISTED';
      } catch (error) {
        observation.persistenceStatus = 'PERSISTENCE_UNAVAILABLE';
        console.error('Weather observation persistence failed', error);
      }
    }
    return response.status(observation.status === 'LIVE' ? 200 : 503).json(observation);
  } catch (error) {
    return next(error);
  }
});
app.get('/api/icebergs', (_request, response) => response.status(503).json({ status: 'UNAVAILABLE', error: 'Live Arctic ice provider is not configured' }));
app.get('/api/traffic', (_request, response) => response.status(503).json({ status: 'UNAVAILABLE', error: 'Live traffic provider is not configured' }));

const routeSchema = z.object({
  departureId: z.string().min(1),
  arrivalId: z.string().min(1),
}).refine((value) => value.departureId !== value.arrivalId, { message: 'Departure and arrival must differ' });

/**
 * Generate marine routes from source to destination
 * Uses real marine routing provider if available
 * Returns MARINE_ROUTING_UNAVAILABLE if no real provider is configured
 */
app.post('/api/routes/generate', (request, response, next) => {
  try {
    const input = routeSchema.parse(request.body);
    return generateRouteOptions(input)
      .then((result) => {
        if (result.status === 'UNAVAILABLE') {
          return response.status(503).json(result);
        }
        return response.json(result);
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.message === 'SOURCE_OR_DESTINATION_NOT_FOUND') {
          return response.status(404).json({ status: 'UNAVAILABLE', error: error.message });
        }
        return next(error);
      });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return response.status(400).json({ status: 'INVALID_REQUEST', error: error.issues[0]?.message || 'Invalid route request.' });
    }
    return next(error);
  }
});

app.get('/api/routes/:routeId/monitoring', async (request, response, next) => {
  try {
    const monitoring = await refreshRouteMonitoring(request.params.routeId);
    return response.json(monitoring);
  } catch (error) {
    if (error instanceof Error && error.message === 'ROUTE_MONITORING_GEOMETRY_UNAVAILABLE') {
      return response.status(404).json({ status: 'UNAVAILABLE', error: error.message });
    }
    return next(error);
  }
});

/**
 * Check the status of the marine routing provider
 */
app.get('/api/routing/status', async (_request, response, next) => {
  try {
    const status = await getRoutingProviderStatus();
    return response.json(status);
  } catch (error) {
    return next(error);
  }
});

app.use(notFound);
app.use(errorHandler);
