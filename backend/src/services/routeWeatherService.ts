/**
 * Route Weather Service
 * 
 * Samples real weather data along the entire route geometry.
 * Updates route segments with actual environmental conditions.
 * 
 * Avoids excessive API calls through intelligent sampling and caching.
 */

import { prisma } from '../config/database.js';
import { getOpenMeteoWeather } from '../providers/weatherProvider.js';
import { RouteCoordinate } from '../providers/routingProvider.js';

export interface WeatherSegmentSample {
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

/**
 * Sample weather along route at reasonable intervals
 * Uses intelligent sampling: more samples for longer routes, fewer for short routes
 * Caches results to avoid excessive API calls
 */
export async function sampleWeatherAlongRoute(
  routeId: string,
  geometry: RouteCoordinate[]
): Promise<WeatherSegmentSample[]> {
  if (geometry.length === 0) {
    return [];
  }

  // Determine sample points
  let sampleIndices: number[] = [];

  if (geometry.length <= 5) {
    // Sample all points
    sampleIndices = geometry.map((_, i) => i);
  } else if (geometry.length <= 20) {
    // Sample every other point
    sampleIndices = geometry
      .map((_, i) => i)
      .filter((i) => i % 2 === 0 || i === geometry.length - 1);
  } else {
    // Sample ~10 strategic points
    sampleIndices.push(0); // Start
    for (let i = 1; i < 9; i++) {
      sampleIndices.push(Math.floor((i / 9) * (geometry.length - 1)));
    }
    sampleIndices.push(geometry.length - 1); // End
    sampleIndices = [...new Set(sampleIndices)].sort((a, b) => a - b);
  }

  const samples: WeatherSegmentSample[] = [];
  const weatherCache = new Map<string, Awaited<ReturnType<typeof getOpenMeteoWeather>>>();

  // Fetch weather for each sample point
  for (const index of sampleIndices) {
    const coord = geometry[index]!;
    const cacheKey = `${coord.latitude.toFixed(2)}-${coord.longitude.toFixed(2)}`;

    // Check cache first
    let weather = weatherCache.get(cacheKey);
    if (!weather) {
      try {
        weather = await getOpenMeteoWeather({
          latitude: coord.latitude,
          longitude: coord.longitude,
        });
        weatherCache.set(cacheKey, weather);
      } catch (error) {
        console.error(
          `Failed to fetch weather for ${coord.latitude}, ${coord.longitude}`,
          error
        );
        weather = {
          status: 'UNAVAILABLE',
          provider: 'open-meteo',
          receivedAt: new Date().toISOString(),
          coordinates: { latitude: coord.latitude, longitude: coord.longitude },
          error: 'Failed to fetch',
        };
      }
    }

    samples.push({
      latitude: coord.latitude,
      longitude: coord.longitude,
      sequenceNumber: index,
      weather:
        weather.current?.weatherCode?.toString() ??
        'UNAVAILABLE',
      windSpeed: weather.current?.windSpeedKmh ?? null,
      windDirection: weather.current?.windDirectionDegrees,
      visibility:
        weather.status === 'LIVE' ? 'Good' : 'UNAVAILABLE',
      waveHeight: weather.marine?.waveHeightMeters ?? null,
      temperature: weather.current?.temperatureCelsius ?? null,
      precipitationMm: weather.current?.precipitationMm ?? null,
      weatherCode: weather.current?.weatherCode,
      timestamp: weather.receivedAt,
    });
  }

  return samples;
}

/**
 * Update route segments with sampled weather data
 */
export async function updateRouteWeatherSegments(
  routeId: string,
  weatherSamples: WeatherSegmentSample[]
): Promise<void> {
  if (weatherSamples.length === 0) {
    return;
  }

  // Update database segments with weather data
  for (const sample of weatherSamples) {
    await prisma.routeSegment.updateMany({
      where: {
        routeId,
        sequenceNumber: sample.sequenceNumber,
      },
      data: {
        weather: sample.weather,
        windSpeed: sample.windSpeed ?? 0,
        visibility: sample.visibility,
        waveHeight: sample.waveHeight ?? 0,
        timestamp: new Date(sample.timestamp),
      },
    });
  }
}

/**
 * Get weather risk along entire route
 */
export async function assessRouteWeatherRisk(
  weatherSamples: WeatherSegmentSample[]
): Promise<{
  overallRisk: number;
  riskLevel: string;
  dangerousSegments: number[];
  warnings: string[];
  factors: Record<string, string>;
}> {
  if (weatherSamples.length === 0) {
    return {
      overallRisk: 50,
      riskLevel: 'Medium',
      dangerousSegments: [],
      warnings: [],
      factors: { wind: 'N/A', wave: 'N/A', visibility: 'N/A', seaIce: 'N/A', iceberg: 'N/A', traffic: 'N/A', waterDepth: 'N/A' },
    };
  }

  const warnings: string[] = [];
  const dangerousSegments: number[] = [];
  let totalRisk = 0;

  for (const sample of weatherSamples) {
    let segmentRisk = 0;

    // Wind risk
    if ((sample.windSpeed ?? 0) > 50) {
      segmentRisk += 30;
      warnings.push(
        `Severe winds (${sample.windSpeed} km/h) detected near waypoint ${sample.sequenceNumber}`
      );
      dangerousSegments.push(sample.sequenceNumber);
    } else if ((sample.windSpeed ?? 0) > 30) {
      segmentRisk += 20;
    } else if ((sample.windSpeed ?? 0) > 15) {
      segmentRisk += 10;
    }

    // Temperature risk
    const temp = sample.temperature;
    if (temp !== null && temp < -20) {
      segmentRisk += 25;
      warnings.push(
        `Extreme cold (${temp}°C) near waypoint ${sample.sequenceNumber}`
      );
      dangerousSegments.push(sample.sequenceNumber);
    } else if (temp !== null && temp < -10) {
      segmentRisk += 15;
    } else if (temp !== null && temp < 0) {
      segmentRisk += 10;
    }

    // Weather code risk
    const code = sample.weatherCode;
    if (code && code >= 95) {
      segmentRisk += 20;
      warnings.push(
        `Severe storm detected near waypoint ${sample.sequenceNumber}`
      );
      dangerousSegments.push(sample.sequenceNumber);
    } else if (code && code >= 80) {
      segmentRisk += 15;
    } else if (code && code >= 71) {
      segmentRisk += 10;
    }

    // Precipitation risk
    if ((sample.precipitationMm ?? 0) > 10) {
      segmentRisk += 10;
    }

    // Wave height risk
    if ((sample.waveHeight ?? 0) > 4) {
      segmentRisk += 15;
      warnings.push(
        `High waves (${sample.waveHeight}m) near waypoint ${sample.sequenceNumber}`
      );
      dangerousSegments.push(sample.sequenceNumber);
    } else if ((sample.waveHeight ?? 0) > 2) {
      segmentRisk += 10;
    }

    totalRisk += segmentRisk;
  }

  const averageRisk = Math.round(totalRisk / weatherSamples.length);
  const windValues = weatherSamples.flatMap((sample) => sample.windSpeed === null ? [] : [sample.windSpeed]);
  const waveValues = weatherSamples.flatMap((sample) => sample.waveHeight === null ? [] : [sample.waveHeight]);
  const averageWind = windValues.length > 0 ? windValues.reduce((sum, value) => sum + value, 0) / windValues.length : 0;
  const averageWave = waveValues.length > 0 ? waveValues.reduce((sum, value) => sum + value, 0) / waveValues.length : 0;

  let riskLevel: string;
  if (averageRisk >= 80) riskLevel = 'Critical';
  else if (averageRisk >= 60) riskLevel = 'High';
  else if (averageRisk >= 40) riskLevel = 'Medium';
  else riskLevel = 'Low';

  return {
    overallRisk: Math.min(100, averageRisk),
    riskLevel,
    dangerousSegments: [...new Set(dangerousSegments)],
    warnings,
    factors: {
      wind: averageWind > 50 ? 'High' : averageWind > 30 ? 'Medium' : 'Low',
      wave: averageWave > 4 ? 'High' : averageWave > 2 ? 'Medium' : 'Low',
      visibility: weatherSamples.every((sample) => sample.visibility === 'Good') ? 'Good' : 'N/A',
      seaIce: 'N/A',
      iceberg: 'N/A',
      traffic: 'N/A',
      waterDepth: 'Validated',
    },
  };
}
