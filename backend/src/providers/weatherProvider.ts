export interface WeatherCoordinates {
  latitude: number;
  longitude: number;
}

export interface WeatherObservation {
  status: 'LIVE' | 'UNAVAILABLE' | 'INVALID_LOCATION' | 'STALE';
  provider: 'open-meteo';
  timestamp?: string;
  receivedAt: string;
  coordinates: WeatherCoordinates;
  current?: {
    temperatureCelsius?: number;
    apparentTemperatureCelsius?: number;
    windSpeedKmh?: number;
    windDirectionDegrees?: number;
    windGustsKmh?: number;
    precipitationMm?: number;
    snowfallCm?: number;
    pressureHpa?: number;
    weatherCode?: number;
  };
  marine?: {
    waveHeightMeters?: number;
    waveDirectionDegrees?: number;
    wavePeriodSeconds?: number;
    swellHeightMeters?: number;
  };
  forecast?: {
    time: string[];
    temperatureCelsius?: number[];
    windSpeedKmh?: number[];
    precipitationProbability?: number[];
    weatherCode?: number[];
  };
  error?: string;
  persistenceStatus?: 'PERSISTED' | 'PERSISTENCE_UNAVAILABLE';
}

const forecastEndpoint = 'https://api.open-meteo.com/v1/forecast';
const marineEndpoint = 'https://marine-api.open-meteo.com/v1/marine';
const timeoutMilliseconds = 10_000;

async function fetchJson(url: URL): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMilliseconds);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Open-Meteo returned ${response.status}`);
    return await response.json() as Record<string, unknown>;
  } finally {
    clearTimeout(timeout);
  }
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function numberArray(value: unknown): number[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === 'number') ? value : undefined;
}

function stringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : undefined;
}

export async function getOpenMeteoWeather(coordinates: WeatherCoordinates): Promise<WeatherObservation> {
  const receivedAt = new Date().toISOString();
  if (!Number.isFinite(coordinates.latitude) || coordinates.latitude < -90 || coordinates.latitude > 90 ||
    !Number.isFinite(coordinates.longitude) || coordinates.longitude < -180 || coordinates.longitude > 180) {
    return { status: 'INVALID_LOCATION', provider: 'open-meteo', receivedAt, coordinates, error: 'Latitude or longitude is outside the valid range' };
  }
  const forecastUrl = new URL(forecastEndpoint);
  forecastUrl.search = new URLSearchParams({
    latitude: String(coordinates.latitude),
    longitude: String(coordinates.longitude),
    current: 'temperature_2m,apparent_temperature,precipitation,snowfall,weather_code,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m',
    hourly: 'temperature_2m,precipitation_probability,weather_code,wind_speed_10m',
    forecast_days: '3',
    timezone: 'UTC',
  }).toString();
  const marineUrl = new URL(marineEndpoint);
  marineUrl.search = new URLSearchParams({
    latitude: String(coordinates.latitude),
    longitude: String(coordinates.longitude),
    current: 'wave_height,wave_direction,wave_period,swell_wave_height',
    timezone: 'UTC',
  }).toString();

  try {
    const [forecastResult, marineResult] = await Promise.allSettled([fetchJson(forecastUrl), fetchJson(marineUrl)]);
    if (forecastResult.status === 'rejected') throw forecastResult.reason;
    const forecast = forecastResult.value;
    const marine = marineResult.status === 'fulfilled' ? marineResult.value : {};
    const current = forecast.current as Record<string, unknown> | undefined;
    const marineCurrent = marine.current as Record<string, unknown> | undefined;
    const hourly = forecast.hourly as Record<string, unknown> | undefined;
    const timestamp = typeof current?.time === 'string' ? current.time : receivedAt;
    return {
      status: 'LIVE',
      provider: 'open-meteo',
      timestamp,
      receivedAt,
      coordinates,
      current: {
        temperatureCelsius: numberValue(current?.temperature_2m),
        apparentTemperatureCelsius: numberValue(current?.apparent_temperature),
        windSpeedKmh: numberValue(current?.wind_speed_10m),
        windDirectionDegrees: numberValue(current?.wind_direction_10m),
        windGustsKmh: numberValue(current?.wind_gusts_10m),
        precipitationMm: numberValue(current?.precipitation),
        snowfallCm: numberValue(current?.snowfall),
        pressureHpa: numberValue(current?.pressure_msl),
        weatherCode: numberValue(current?.weather_code),
      },
      marine: {
        waveHeightMeters: numberValue(marineCurrent?.wave_height),
        waveDirectionDegrees: numberValue(marineCurrent?.wave_direction),
        wavePeriodSeconds: numberValue(marineCurrent?.wave_period),
        swellHeightMeters: numberValue(marineCurrent?.swell_wave_height),
      },
      forecast: {
        time: stringArray(hourly?.time) || [],
        temperatureCelsius: numberArray(hourly?.temperature_2m),
        windSpeedKmh: numberArray(hourly?.wind_speed_10m),
        precipitationProbability: numberArray(hourly?.precipitation_probability),
        weatherCode: numberArray(hourly?.weather_code),
      },
    };
  } catch (error) {
    return {
      status: 'UNAVAILABLE',
      provider: 'open-meteo',
      receivedAt,
      coordinates,
      error: error instanceof Error ? error.message : 'Open-Meteo request failed',
    };
  }
}