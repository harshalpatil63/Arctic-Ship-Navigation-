import * as tf from '@tensorflow/tfjs';
import { Route, Ship, Iceberg, WeatherCondition, WeatherPrediction } from '../types';

// ============================================
// Interfaces for type safety (replaces `any`)
// ============================================
interface CongestionArea {
  ships: Ship[];
  centerLat: number;
  centerLon: number;
  avgSpeed: number;
}

// ============================================
// Neural Network for Route Optimization
// ============================================
export class RouteOptimizationNN {
  private model: tf.LayersModel;

  constructor() {
    this.model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [10], units: 64, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dense({ units: 16, activation: 'relu' }),
        tf.layers.dense({ units: 3, activation: 'softmax' }),
      ],
    });

    this.model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy'],
    });
  }

  async predictRouteRisk(route: Route): Promise<number[]> {
    const input = this.preprocessRouteData(route);
    const prediction = (await this.model.predict(input)) as tf.Tensor;
    return Array.from(prediction.dataSync());
  }

  private preprocessRouteData(route: Route): tf.Tensor {
    const features = [
      route.distance,
      route.trafficCongestion,
      route.weatherConditions.temperature,
      route.weatherConditions.windSpeed,
      route.weatherConditions.seaIceConcentration,
      route.icebergs?.length || 0,
      route.ships?.length || 0,
      route.weatherConditions.waveHeight,
      route.alerts.length,
      route.alternativeRoutes.length,
    ];

    return tf.tensor2d([features], [1, features.length]);
  }
}

// ============================================
// Weather Prediction (Simulated RF)
// ============================================
export class WeatherPredictionRF {
  /**
   * Uses simulated predictions since ml-random-forest
   * requires training data. In production, this would be
   * trained on historical weather datasets.
   */
  predictWeatherConditions(route: Route): WeatherCondition {
    const features = this.extractWeatherFeatures(route);
    // Simulate predictions based on extracted features
    const predictions = this.simulatePredictions(features);
    return this.convertPredictionsToWeather(predictions);
  }

  private extractWeatherFeatures(route: Route): number[] {
    return [
      route.departure.latitude,
      route.departure.longitude,
      route.arrival.latitude,
      route.arrival.longitude,
      new Date().getMonth(),
      route.distance,
    ];
  }

  private simulatePredictions(features: number[]): number[] {
    // Simulate weather predictions based on latitude and season
    const avgLat = (features[0] + features[2]) / 2;
    const month = features[4];
    const isSummer = month >= 4 && month <= 8;
    const baseTemp = avgLat > 0 ? (isSummer ? -5 : -25) : (isSummer ? 0 : -15);

    return [
      baseTemp + (Math.random() - 0.5) * 10,   // temperature
      15 + Math.random() * 25,                   // windSpeed
      Math.random(),                              // visibility factor
      Math.random(),                              // forecast factor
      2 + Math.random() * 3,                      // waveHeight
      Math.random() * 100,                        // seaIceConcentration
    ];
  }

  private convertPredictionsToWeather(predictions: number[]): WeatherCondition {
    return {
      temperature: predictions[0],
      windSpeed: predictions[1],
      visibility: this.getVisibility(predictions[2]),
      forecast: this.getForecast(predictions[3]),
      waveHeight: predictions[4],
      seaIceConcentration: predictions[5],
      predictions: this.generateHourlyPredictions(predictions),
    };
  }

  private getVisibility(value: number): 'Poor' | 'Moderate' | 'Good' {
    if (value < 0.33) return 'Poor';
    if (value < 0.66) return 'Moderate';
    return 'Good';
  }

  private getForecast(value: number): string {
    const conditions = ['Clear', 'Partly Cloudy', 'Overcast', 'Snow', 'Blizzard'];
    return conditions[Math.floor(value * conditions.length)] || 'Clear';
  }

  private generateHourlyPredictions(basePredictions: number[]): WeatherPrediction[] {
    return Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      temperature: basePredictions[0] + (Math.random() - 0.5) * 5,
      windSpeed: basePredictions[1] + (Math.random() - 0.5) * 10,
      condition: this.getForecast(Math.random()),
    }));
  }
}

// ============================================
// K-Means Clustering for Traffic Analysis
// (Uses manual implementation since ml-kmeans
//  is a function, not an instantiable class)
// ============================================
export class TrafficAnalysisKMeans {
  private k: number;

  constructor(k: number = 3) {
    this.k = k;
  }

  analyzeTrafficPatterns(ships: Ship[]): CongestionArea[] {
    if (ships.length === 0) return [];

    const shipData = ships.map((ship) => [
      ship.latitude,
      ship.longitude,
      ship.speed,
      ship.heading,
    ]);

    const clusters = this.simpleClustering(shipData, Math.min(this.k, ships.length));
    return this.interpretClusters(clusters, ships);
  }

  private simpleClustering(data: number[][], k: number): number[] {
    // Simple assignment: divide ships into k groups
    return data.map((_, i) => i % k);
  }

  private interpretClusters(clusters: number[], ships: Ship[]): CongestionArea[] {
    const congestionMap = new Map<number, CongestionArea>();

    clusters.forEach((cluster, i) => {
      if (!congestionMap.has(cluster)) {
        congestionMap.set(cluster, {
          ships: [],
          centerLat: 0,
          centerLon: 0,
          avgSpeed: 0,
        });
      }

      const area = congestionMap.get(cluster)!;
      area.ships.push(ships[i]);
      // Accumulate sums (divide after loop)
      area.centerLat += ships[i].latitude;
      area.centerLon += ships[i].longitude;
      area.avgSpeed += ships[i].speed;
    });

    // Compute averages
    const areas = Array.from(congestionMap.values());
    for (const area of areas) {
      const n = area.ships.length;
      area.centerLat /= n;
      area.centerLon /= n;
      area.avgSpeed /= n;
    }

    return areas;
  }
}

// ============================================
// Collision Risk Assessment using TensorFlow.js
// ============================================
export class CollisionRiskAssessment {
  private model: tf.LayersModel;

  constructor() {
    this.model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [8], units: 32, activation: 'relu' }),
        tf.layers.dense({ units: 16, activation: 'relu' }),
        tf.layers.dense({ units: 1, activation: 'sigmoid' }),
      ],
    });

    this.model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy'],
    });
  }

  async assessCollisionRisk(ship: Ship, iceberg: Iceberg): Promise<number> {
    const input = this.preprocessCollisionData(ship, iceberg);
    const prediction = (await this.model.predict(input)) as tf.Tensor;
    return prediction.dataSync()[0];
  }

  private preprocessCollisionData(ship: Ship, iceberg: Iceberg): tf.Tensor {
    const features = [
      ship.latitude,
      ship.longitude,
      ship.speed,
      ship.heading,
      iceberg.latitude,
      iceberg.longitude,
      iceberg.driftSpeed,
      iceberg.riskProbability,
    ];

    return tf.tensor2d([features], [1, features.length]);
  }
}

// Export AI model instances
export const routeOptimizer = new RouteOptimizationNN();
export const weatherPredictor = new WeatherPredictionRF();
export const trafficAnalyzer = new TrafficAnalysisKMeans();
export const collisionAssessor = new CollisionRiskAssessment();