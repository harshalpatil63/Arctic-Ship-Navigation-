/**
 * RoutingProvider Abstraction
 * 
 * Defines the interface for marine routing providers.
 * All implementations must provide REAL marine/water-only routing.
 * 
 * No road routing, no fake routes, no land crossing.
 */

export interface RouteCoordinate {
  latitude: number;
  longitude: number;
}

export interface RouteWaypoint extends RouteCoordinate {
  sequenceNumber: number;
  distanceFromStart?: number; // km
  durationFromStart?: number; // minutes
}

export interface MarineRoute {
  id: string;
  provider: string;
  label: string;
  strategy?: string;
  description?: string;
  source: RouteCoordinate;
  destination: RouteCoordinate;
  geometry: RouteCoordinate[]; // LineString coordinates
  waypoints?: RouteWaypoint[];
  distance: number; // kilometers
  duration: number; // minutes
  estimatedSpeedKnots?: number;
  metadata?: {
    calculatedAt: string;
    provider_request_id?: string;
    provider_metadata?: Record<string, unknown>;
  };
  validation?: {
    waterOnly: boolean;
    valid: boolean;
    checkedPoints: number;
    checkedSegments: number;
    reason?: string;
  };
}

export interface RouteAlternative extends MarineRoute {
  routeType?: 'fastest' | 'shortest' | 'safest' | 'fuel-efficient' | 'other';
  characteristics?: {
    windExposure?: 'low' | 'medium' | 'high';
    iceRisk?: 'low' | 'medium' | 'high';
    trafficDensity?: 'low' | 'medium' | 'high';
  };
}

export interface RoutingRequest {
  source: RouteCoordinate;
  destination: RouteCoordinate;
  alternatives?: boolean;
  maxAlternatives?: number;
}

export interface RoutingResponse {
  status: 'SUCCESS' | 'NO_ROUTE_FOUND' | 'UNAVAILABLE' | 'ERROR';
  provider: string;
  routes: MarineRoute[];
  error?: string;
  message?: string;
  timestamp: string;
}

export interface RoutingProviderConfig {
  name: string;
  enabled: boolean;
  apiKey?: string;
  endpoint?: string;
  timeout?: number;
  supportsArctic?: boolean;
  supportsMultipleRoutes?: boolean;
}

/**
 * RoutingProvider Interface
 * 
 * All implementations must:
 * 1. Calculate REAL marine routes only
 * 2. Return actual water geometry from the provider
 * 3. Support multiple alternatives if provider allows
 * 4. Provide real distance and duration
 * 5. Include all waypoints from the provider
 * 
 * No implementations should:
 * - Generate fake coordinates
 * - Use road routing APIs
 * - Bend straight lines
 * - Assume land intersection checks make a route marine
 */
export interface RoutingProvider {
  name: string;
  enabled: boolean;
  config: RoutingProviderConfig;

  /**
   * Initialize the provider
   * Should verify API connectivity and configuration
   */
  initialize(): Promise<boolean>;

  /**
   * Get provider status
   */
  getStatus(): Promise<{
    available: boolean;
    lastChecked: string;
    error?: string;
  }>;

  /**
   * Calculate marine routes
   * Returns REAL routes from the provider or UNAVAILABLE if not possible
   */
  calculateRoute(request: RoutingRequest): Promise<RoutingResponse>;

  /**
   * Validate that coordinates are in water
   * Optional: helps verify route doesn't cross land
   */
  validateCoordinatesInWater?(
    coordinates: RouteCoordinate[]
  ): Promise<boolean>;
}
