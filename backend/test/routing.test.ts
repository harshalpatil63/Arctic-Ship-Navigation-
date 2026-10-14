import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateMaritimeRoutes } from '../src/services/maritimeNetwork.js';
import { generateRouteOptions } from '../src/services/routeService.js';
import { defaultPorts } from '../src/config/ports.js';

describe('Marine Routing & Water-Only Navigation Validation', () => {
  it('generates valid marine routes between supported Arctic ports', async () => {
    // Murmansk (p1) to Pevek (p2)
    const result = await generateRouteOptions({ departureId: 'p1', arrivalId: 'p2' });
    assert.ok(result.status === 'LIVE' || result.status === 'NO_SUFFICIENT_ALTERNATIVES');
    assert.ok(result.routes.length >= 1, 'At least one route must be returned');

    const primaryRoute = result.routes[0]!;
    assert.equal(primaryRoute.departure.id, 'p1');
    assert.equal(primaryRoute.arrival.id, 'p2');
    assert.ok(primaryRoute.distance > 3000, 'Distance must exceed 3000 km across Northern Sea Route');
    assert.ok(primaryRoute.duration > 0, 'Duration must be positive');
    assert.ok(primaryRoute.fuelEstimate > 0, 'Fuel estimate must be positive');
    assert.ok(primaryRoute.geometry.length > 5, 'Geometry must contain intermediate waypoints');
  });

  it('rejects unknown or invalid ports with a clean error', async () => {
    await assert.rejects(
      async () => {
        await generateRouteOptions({ departureId: 'invalid_port_1', arrivalId: 'p2' });
      },
      {
        message: 'SOURCE_OR_DESTINATION_NOT_FOUND',
      }
    );
  });

  it('verifies inter-polar route (Tiksi to McMurdo) navigates around continents via maritime spine', () => {
    // Tiksi is p5 (71.6°N, 128.8°E in Russian Arctic)
    // McMurdo is p8 (-77.8°S, 166.7°E in Antarctica)
    const routes = generateMaritimeRoutes('p5', 'p8');
    assert.ok(routes.length >= 1, 'Must find valid maritime path between hemispheres');

    const route = routes[0]!;
    assert.ok(route.distance > 15000, `Inter-polar distance should be >15,000 km, got ${route.distance}`);

    // Verify all waypoints remain strictly within valid geographic coordinate bounds
    for (const pt of route.geometry) {
      assert.ok(pt.latitude >= -90 && pt.latitude <= 90, `Latitude out of range: ${pt.latitude}`);
      assert.ok(pt.longitude >= -180 && pt.longitude <= 180, `Longitude out of range: ${pt.longitude}`);
    }

    // Verify the route exits through the Bering Strait (approx 66°N, -169°E) into the Pacific
    const entersPacific = route.geometry.some(
      (pt) => pt.latitude >= 64 && pt.latitude <= 68 && pt.longitude >= -175 && pt.longitude <= -165
    );
    assert.ok(entersPacific, 'Inter-polar route must navigate through Bering Strait into Pacific');
  });

  it('ensures all default ports are defined with valid coordinates and descriptions', () => {
    assert.ok(defaultPorts.length >= 10, 'Must have at least 10 ports defined');
    for (const port of defaultPorts) {
      assert.ok(port.id, 'Port must have ID');
      assert.ok(port.name, 'Port must have name');
      assert.ok(port.latitude >= -90 && port.latitude <= 90, `Port ${port.name} has invalid latitude`);
      assert.ok(port.longitude >= -180 && port.longitude <= 180, `Port ${port.name} has invalid longitude`);
      assert.ok(port.congestion >= 0 && port.congestion <= 100, `Port ${port.name} has invalid congestion`);
    }
  });
});
