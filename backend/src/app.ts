import cors from 'cors';
import express from 'express';
import { z } from 'zod';
import { generateRouteOptions, getRoutingProviderStatus, refreshRouteMonitoring } from './services/routeService.js';
import { getOpenMeteoWeather } from './providers/weatherProvider.js';
import { persistWeatherObservation } from './services/weatherService.js';
import { prisma } from './config/database.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

import { defaultPorts } from './config/ports.js';

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
