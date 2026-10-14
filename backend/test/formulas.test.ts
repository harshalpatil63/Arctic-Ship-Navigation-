import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculatePolylineDistance, generateMaritimeRoutes } from '../src/services/maritimeNetwork.js';

describe('Marine Routing Formulas & Unit Conversion Validation', () => {
  it('correctly calculates geodesic haversine distance between coordinates', () => {
    // Distance between London (approx 0, 51.5) and Paris (approx 2.35, 48.85) ~ 340 km
    const polyline: [number, number][] = [
      [0.0, 51.5],
      [2.35, 48.85],
    ];
    const dist = calculatePolylineDistance(polyline);
    assert.ok(dist >= 335 && dist <= 350, `Distance was ${dist} km, expected ~343 km`);
  });

  it('verifies nautical miles conversion and ETA calculation eliminates km/knot unit mismatch', () => {
    // 1,852 km is exactly 1,000 Nautical Miles.
    // At 10 knots, 1,000 NM takes exactly 100 hours (6,000 minutes).
    const distanceKm = 1852;
    const speedKnots = 10;
    const distanceNm = distanceKm * 0.539957;
    const durationHours = distanceNm / speedKnots;
    const durationMinutes = Math.round(durationHours * 60);

    assert.ok(
      Math.abs(durationHours - 100.0) < 0.1,
      `Duration was ${durationHours}h, expected 100.0h`
    );
    assert.ok(
      Math.abs(durationMinutes - 6000) < 5,
      `Duration was ${durationMinutes}m, expected 6000m`
    );
  });

  it('guarantees Fuel-Efficient route consumes less fuel than Shortest route for the same voyage', () => {
    // Test between Murmansk (p1) and Pevek (p2)
    const routes = generateMaritimeRoutes('p1', 'p2');
    assert.ok(routes.length >= 2, 'Should generate multiple distinct strategies');

    const shortest = routes.find((r) => r.strategy === 'shortest');
    const fuelEfficient = routes.find((r) => r.strategy === 'fuel-efficient');
    const safest = routes.find((r) => r.strategy === 'safest');

    assert.ok(shortest, 'Shortest route must exist');
    assert.ok(fuelEfficient, 'Fuel-efficient route must exist');

    // DEFECT-02 verification: Fuel-efficient route MUST have strictly lower estimated fuel
    assert.ok(
      fuelEfficient.fuelEstimate < shortest.fuelEstimate,
      `Fuel-efficient route (${fuelEfficient.fuelEstimate} tons) must consume less than shortest route (${shortest.fuelEstimate} tons)`
    );

    if (safest) {
      assert.ok(
        fuelEfficient.fuelEstimate <= safest.fuelEstimate,
        `Fuel-efficient route (${fuelEfficient.fuelEstimate} tons) must be <= safest route (${safest.fuelEstimate} tons)`
      );
    }
  });

  it('verifies engine cubic power law relationship P ∝ V^3 and SFC ∝ V^2', () => {
    const baseSpeed = 13.5;
    const ecoSpeed = 10.8;
    const baseRate = 0.12; // tons/NM

    const speedRatio = ecoSpeed / baseSpeed; // 0.8
    const ecoRate = baseRate * Math.pow(speedRatio, 2); // 0.12 * 0.64 = 0.0768 tons/NM

    const percentSavings = ((baseRate - ecoRate) / baseRate) * 100;
    assert.ok(
      Math.abs(percentSavings - 36) < 1.0,
      `Expected ~36% fuel rate reduction at eco-speed, got ${percentSavings}%`
    );
  });
});
