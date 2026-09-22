import { prisma } from '../config/database.js';
import { WeatherObservation } from '../providers/weatherProvider.js';

export async function persistWeatherObservation(observation: WeatherObservation): Promise<void> {
  if (observation.status !== 'LIVE' || !observation.current) return;

  await prisma.weatherRecord.create({
    data: {
      latitude: observation.coordinates.latitude,
      longitude: observation.coordinates.longitude,
      temperature: observation.current.temperatureCelsius,
      windSpeed: observation.current.windSpeedKmh,
      visibility: null,
      waveHeight: observation.marine?.waveHeightMeters,
      seaIceConcentration: null,
      snowfall: observation.current.snowfallCm,
      rainfall: observation.current.precipitationMm,
      provider: observation.provider,
      timestamp: observation.timestamp ? new Date(observation.timestamp) : new Date(observation.receivedAt),
      receivedAt: new Date(observation.receivedAt),
    },
  });
}