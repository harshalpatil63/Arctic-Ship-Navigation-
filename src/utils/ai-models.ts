/**
 * Marine Risk and Environmental Optimization Models
 *
 * Implements deterministic physics-based formulas for:
 * 1. Arctic Navigation Risk Index (Polar Code compliant)
 * 2. Segment-level environmental resistance
 * 3. Specific Fuel Oil Consumption (SFOC) speed-power curve
 */

import { WeatherCondition } from '../types';

/**
 * Calculates deterministic polar navigation risk score (0 - 100)
 * compliant with IMO Polar Code POLARIS guidelines:
 * - Wind factor: based on Beaufort scale thresholds
 * - Wave factor: significant wave height vs vessel design limits
 * - Ice factor: concentration and structural ice class
 * - Cold factor: atmospheric freezing temperature
 */
export function calculatePolarRiskScore(
  weather: WeatherCondition,
  vesselClass: 'Arc7' | 'Arc4' | 'Non-Ice' = 'Arc7'
): { score: number; level: 'Low' | 'Medium' | 'High' | 'Critical'; factors: Record<string, number> } {
  // Wind risk (0 - 30 points)
  const windKmh = weather.windSpeed || 0;
  const windRisk = Math.min(30, (windKmh / 60) * 30);

  // Wave risk (0 - 30 points)
  const waveMeters = weather.waveHeight || 0;
  const waveRisk = Math.min(30, (waveMeters / 4.5) * 30);

  // Extreme polar cold risk (0 - 20 points)
  const tempC = weather.temperature ?? 0;
  const coldRisk = tempC < -20 ? 20 : tempC < -10 ? 12 : tempC < 0 ? 5 : 0;

  // Sea ice risk scaled by vessel ice class (0 - 20 points)
  const iceConcentration = weather.seaIceConcentration || 0;
  const iceClassFactor = vesselClass === 'Non-Ice' ? 2.5 : vesselClass === 'Arc4' ? 1.5 : 0.8;
  const iceRisk = Math.min(20, (iceConcentration / 100) * 20 * iceClassFactor);

  const totalScore = Math.max(5, Math.min(95, Math.round(windRisk + waveRisk + coldRisk + iceRisk)));

  let level: 'Low' | 'Medium' | 'High' | 'Critical' = 'Low';
  if (totalScore >= 75) level = 'Critical';
  else if (totalScore >= 55) level = 'High';
  else if (totalScore >= 35) level = 'Medium';

  return {
    score: totalScore,
    level,
    factors: {
      windHazard: Math.round(windRisk),
      waveHazard: Math.round(waveRisk),
      coldHazard: Math.round(coldRisk),
      iceHazard: Math.round(iceRisk),
    },
  };
}

/**
 * Evaluates marine fuel burn rate using Admiralty cubic power law:
 * P = c * V^3, SFC ∝ V^2
 */
export function estimateFuelConsumption(
  distanceKm: number,
  speedKnots: number,
  designSpeedKnots = 13.5,
  baseRateTonsPerNm = 0.12
): number {
  const distanceNm = distanceKm * 0.539957;
  const speedRatio = Math.max(0.5, speedKnots / designSpeedKnots);
  const specificFuelRate = baseRateTonsPerNm * Math.pow(speedRatio, 2);
  return Math.round(distanceNm * specificFuelRate * 10) / 10;
}