import { Matrix } from 'ml-matrix';

export interface Port {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  congestion: number;
  description: string;
  historicalData?: {
    averageTraffic: number[];
    weatherPatterns: string[];
    seasonalRisks: string[];
  };
}

export interface Ship {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  speed: number;
  destination: string;
  riskScore: number;
  cargoType: string;
  eta: string;
  heading: number;
  status: 'En Route' | 'Anchored' | 'Loading';
  fuelEfficiency?: number;
  vesselType?: string;
  iceClass?: string;
  previousPositions?: [number, number][];
}

export interface Iceberg {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  size: string;
  driftSpeed: number;
  riskProbability: number;
  lastSeen: string;
  predictedPath: [number, number][];
  description: string;
  estimatedMeltDate: string;
  volume?: number;
  surfaceArea?: number;
  stabilityIndex?: number;
  meltRate?: number;
  environmentalImpact?: {
    wildlifeThreat: number;
    ecosystemDisruption: number;
  };
}

export interface WeatherPrediction {
  hour: number;
  temperature: number;
  windSpeed: number;
  condition: string;
  precipitation?: number;
  humidity?: number;
  pressure?: number;
  uvIndex?: number;
}

export interface WeatherCondition {
  temperature: number;
  windSpeed: number;
  visibility: 'Poor' | 'Moderate' | 'Good';
  forecast: string;
  waveHeight: number;
  seaIceConcentration: number;
  predictions: WeatherPrediction[];
  atmosphericPressure?: number;
  waterTemperature?: number;
  currentDirection?: number;
  currentSpeed?: number;
}

export interface LiveWeatherObservation {
  status: 'LIVE' | 'UNAVAILABLE' | 'INVALID_LOCATION' | 'STALE';
  provider: string;
  timestamp?: string;
  receivedAt: string;
  coordinates: { latitude: number; longitude: number };
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

export type VesselClass = 'Arc7' | 'Arc4' | 'Non-Ice';

export type RouteStrategy =
  | 'shortest'
  | 'safest'
  | 'fuel-efficient'
  | 'weather-optimized'
  | 'low-sea-ice'
  | 'low-traffic';

export interface RouteSegment {
  latitude: number;
  longitude: number;
  weather: string;
  windSpeed: number;
  visibility: WeatherCondition['visibility'];
  waveHeight: number;
  seaIceConcentration: number;
  icebergRisk: number;
  trafficDensity: number;
  riskScore: number;
  timestamp: string;
}

export interface AlertLocation {
  latitude: number;
  longitude: number;
}

export interface Alert {
  type: 'Collision' | 'Weather' | 'Traffic' | 'Environmental';
  severity: 'Low' | 'Medium' | 'High';
  message: string;
  timeToImpact: number;
  location?: AlertLocation;
  details?: string;
  confidence?: number;
  recommendations?: string[];
  impactAssessment?: {
    economic: number;
    environmental: number;
    safety: number;
  };
}

export interface AlternativeRoute {
  coordinates: [number, number][];
  distance: number;
  estimatedTimeMinutes: number;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  fuelConsumption?: number;
  costEstimate?: number;
  environmentalImpact?: number;
  confidenceScore?: number;
}

export interface Route {
  id: string;
  strategy?: RouteStrategy;
  label?: string;
  score?: number;
  departure: Port;
  arrival: Port;
  distance: number;
  estimatedTimeMinutes: number;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  weatherConditions: WeatherCondition;
  trafficCongestion: number;
  coordinates: [number, number][];
  alerts: Alert[];
  alternativeRoutes: AlternativeRoute[];
  ships?: Ship[];
  icebergs?: Iceberg[];
  fuelEstimate?: number;
  avgSpeed?: number;
  mlPredictions?: {
    collisionProbability: number;
    weatherRiskMatrix: Matrix;
    trafficPredictions: number[];
    routeOptimality: number;
    confidenceIntervals: {
      lower: number;
      upper: number;
    };
  };
  environmentalMetrics?: {
    carbonFootprint: number;
    marineLifeImpact: number;
    noiseLevel: number;
  };
  segments?: RouteSegment[];
  validation?: {
    waterOnly: boolean;
    valid: boolean;
    checkedPoints: number;
    checkedSegments: number;
    reason?: string;
  };
}

export interface AIModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  confusionMatrix: number[][];
  rocCurve: [number, number][];
}

export interface ModelPerformance {
  routePrediction: AIModelMetrics;
  weatherForecasting: AIModelMetrics;
  collisionPrediction: AIModelMetrics;
  trafficAnalysis: AIModelMetrics;
}