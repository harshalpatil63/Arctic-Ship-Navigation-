/**
 * GEBCO-Based Marine Routing Provider
 * 
 * Implements real Arctic ship navigation routing using:
 * - GEBCO bathymetric data
 * - A* pathfinding algorithm
 * - Arctic environmental constraints
 * - Vessel draft specifications
 */

import {
  RoutingProvider,
  RoutingRequest,
  RoutingResponse,
  RoutingProviderConfig,
  RouteCoordinate,
} from '../providers/routingProvider.js';
import {
  buildBathymetricGrid,
  calculateRouteBounds,
  getGridIndex,
  getNearbyNavigableGridIndices,
  VesselSpec,
  GridBounds,
} from './bathymetricGrid.js';
import { findPath, simplifyPath, PathfindingResult } from './aStarPathfinder.js';
import {
  generateAlternativeRoutes,
  analyzeRouteCharacteristics,
} from './alternativeRoutes.js';
import { isWaterOnlyRoute } from './waterOnlyRouteValidation.js';

export interface GEBCORoutingConfig extends RoutingProviderConfig {
  gridResolution: number; // degrees, e.g., 0.1 for ~11km cells
  vesselDraftMeters: number;
  safetyDepthMarginMeters: number;
  vesselSpeedKnots: number;
  calculateAlternatives: boolean;
  boundingBufferDegrees: number;
}

const defaultConfig: GEBCORoutingConfig = {
  name: 'GEBCO Marine Routing',
  enabled: true,
  supportsArctic: true,
  supportsMultipleRoutes: true,
  gridResolution: 0.1, // ~11km cells at equator
  vesselDraftMeters: 3, // Typical research vessel
  safetyDepthMarginMeters: 1, // 1m safety clearance
  vesselSpeedKnots: 12, // Typical Arctic navigation speed
  calculateAlternatives: true,
  boundingBufferDegrees: 1.5,
};

export class GEBCOMarineRoutingProvider implements RoutingProvider {
  name = 'gebco-marine-routing';
  enabled = true;
  config: GEBCORoutingConfig;

  private initialized = false;

  constructor(config: Partial<GEBCORoutingConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  async initialize(): Promise<boolean> {
    // Validate configuration
    if (
      this.config.vesselDraftMeters <= 0 ||
      this.config.gridResolution <= 0 ||
      this.config.vesselSpeedKnots <= 0
    ) {
      console.error('Invalid GEBCO routing configuration');
      return false;
    }

    this.initialized = true;
    console.log('GEBCO Marine Routing Provider initialized', {
      gridResolution: `${this.config.gridResolution}°`,
      vesselDraft: `${this.config.vesselDraftMeters}m`,
      vesselSpeed: `${this.config.vesselSpeedKnots} knots`,
    });

    return true;
  }

  async getStatus() {
    return {
      available: this.initialized,
      lastChecked: new Date().toISOString(),
      error: this.initialized
        ? undefined
        : 'GEBCO Marine Routing Provider not initialized',
    };
  }

  async calculateRoute(request: RoutingRequest): Promise<RoutingResponse> {
    if (!this.initialized) {
      return {
        status: 'UNAVAILABLE',
        provider: this.name,
        routes: [],
        error: 'GEBCO_PROVIDER_NOT_INITIALIZED',
        message: 'GEBCO Marine Routing Provider is not initialized',
        timestamp: new Date().toISOString(),
      };
    }

    try {
      // Calculate bounding box
      const bounds = calculateRouteBounds(
        request.source.latitude,
        request.source.longitude,
        request.destination.latitude,
        request.destination.longitude,
        this.config.boundingBufferDegrees
      );

      // Build bathymetric grid
      const vessel: VesselSpec = {
        draftMeters: this.config.vesselDraftMeters,
        safetyDepthMarginMeters: this.config.safetyDepthMarginMeters,
      };

      const grid = buildBathymetricGrid(
        bounds,
        this.config.gridResolution,
        vessel
      );

      // Find grid indices for source and destination
      const sourceGridIndex = getGridIndex(
        request.source.latitude,
        request.source.longitude,
        bounds,
        this.config.gridResolution
      );

      const destinationGridIndex = getGridIndex(
        request.destination.latitude,
        request.destination.longitude,
        bounds,
        this.config.gridResolution
      );

      const startCandidates = sourceGridIndex ? getNearbyNavigableGridIndices(grid, sourceGridIndex) : [];
      const goalCandidates = destinationGridIndex ? getNearbyNavigableGridIndices(grid, destinationGridIndex) : [];

      if (startCandidates.length === 0 || goalCandidates.length === 0) {
        return {
          status: 'NO_ROUTE_FOUND',
          provider: this.name,
          routes: [],
          error: 'INVALID_COORDINATES',
          message: 'No navigable water connection was found near the source or destination.',
          timestamp: new Date().toISOString(),
        };
      }

      // Find primary route using A*
      let primaryRoute: PathfindingResult = {
        found: false,
        path: [],
        totalDistance: 0,
        totalCost: Infinity,
        calculatedAt: new Date().toISOString(),
      };
      let startIndex = startCandidates[0]!;
      let goalIndex = goalCandidates[0]!;
      for (const startCandidate of startCandidates) {
        for (const goalCandidate of goalCandidates) {
          const candidate = findPath(grid, startCandidate.row, startCandidate.col, goalCandidate.row, goalCandidate.col, bounds, this.config.gridResolution);
          if (candidate.found) {
            primaryRoute = candidate;
            startIndex = startCandidate;
            goalIndex = goalCandidate;
            break;
          }
        }
        if (primaryRoute.found) break;
      }

      if (!primaryRoute.found) {
        return {
          status: 'NO_ROUTE_FOUND',
          provider: this.name,
          routes: [],
          error: 'NO_NAVIGABLE_MARINE_ROUTE',
          message:
            'No navigable water route found. Water depth may be insufficient for vessel draft.',
          timestamp: new Date().toISOString(),
        };
      }

      // Create route object
      const routes = [] as ReturnType<typeof this.pathToRoute>[];
      try {
        routes.push(this.pathToRoute(primaryRoute, 'Optimal Route', 'Balanced route minimizing distance and shallow water', 'optimal', request, grid, bounds));
      } catch (error) {
        return {
          status: 'NO_ROUTE_FOUND',
          provider: this.name,
          routes: [],
          error: 'NO_VALID_WATER_ROUTE',
          message: error instanceof Error ? error.message : 'No valid water route found between these locations.',
          timestamp: new Date().toISOString(),
        };
      }

      // Generate alternatives if requested
      if (request.alternatives && this.config.calculateAlternatives) {
        const routeIndices = primaryRoute.path.map((segment) => {
          const idx = getGridIndex(
            segment.latitude,
            segment.longitude,
            bounds,
            this.config.gridResolution
          );
          return idx || { row: -1, col: -1 };
        });

        const alternatives = generateAlternativeRoutes(
          grid,
          routeIndices,
          startIndex.row,
          startIndex.col,
          goalIndex.row,
          goalIndex.col,
          bounds,
          this.config.gridResolution
        );

        for (const alt of alternatives) {
          try {
            routes.push(this.pathToRoute(alt, alt.strategy === 'safest' ? 'Safest Route' : 'Fuel Efficient Route', 'Alternative routing calculated via different water channels', alt.strategy, request, grid, bounds));
          } catch {
            // Keep valid alternatives and discard only the invalid candidate.
          }
        }
      }

      return {
        status: 'SUCCESS',
        provider: this.name,
        routes,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('GEBCO routing error:', error);
      return {
        status: 'ERROR',
        provider: this.name,
        routes: [],
        error: 'ROUTING_ERROR',
        message: `Routing calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  private pathToRoute(
    pathResult: PathfindingResult,
    label: string,
    description: string,
    strategy: 'optimal' | 'safest' | 'fuel-efficient',
    request: RoutingRequest,
    grid: ReturnType<typeof buildBathymetricGrid>,
    bounds: GridBounds
  ) {
    const distanceKm = pathResult.totalDistance;
    const durationMinutes = (distanceKm / this.config.vesselSpeedKnots) * 60;
    const durationHours = durationMinutes / 60;

    // Format duration for display
    const hours = Math.floor(durationHours);
    const minutes = Math.round((durationHours - hours) * 60);
    const durationDisplay =
      hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

    const geometry = [
      { latitude: request.source.latitude, longitude: request.source.longitude },
      ...pathResult.path.map((seg) => ({ latitude: seg.latitude, longitude: seg.longitude })),
      { latitude: request.destination.latitude, longitude: request.destination.longitude },
    ];
    const validation = isWaterOnlyRoute(geometry, grid, bounds, this.config.gridResolution, { allowLandEndpoints: true });
    if (!validation.waterOnly) {
      throw new Error(`Generated route failed water-only validation: ${validation.reason}`);
    }

    return {
      id: `gebco-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      provider: this.name,
      label,
      description,
      strategy,
      source: geometry[0]!,
      destination: geometry[geometry.length - 1]!,
      geometry,
      waypoints: geometry.map((seg, index) => ({
        sequenceNumber: index,
        latitude: seg.latitude,
        longitude: seg.longitude,
        distanceFromStart:
          index === 0
            ? 0
            : index === geometry.length - 1
              ? distanceKm
              : pathResult.path[index - 1]?.distanceFromStart ?? 0,
        durationFromStart:
          ((index === 0
            ? 0
            : index === geometry.length - 1
              ? distanceKm
              : pathResult.path[index - 1]?.distanceFromStart ?? 0) /
            this.config.vesselSpeedKnots) *
          60,
      })),
      distance: Math.round(distanceKm * 10) / 10, // 1 decimal place
      duration: Math.round(durationMinutes),
      estimatedSpeedKnots: this.config.vesselSpeedKnots,
      metadata: {
        calculatedAt: new Date().toISOString(),
        provider_type: 'GEBCO + A* Pathfinding',
        gridResolution: this.config.gridResolution,
        vesselDraft: this.config.vesselDraftMeters,
        algorithm: 'A* on bathymetric water grid',
        waypoints: pathResult.path.length,
        durationDisplay,
        validation,
      },
      validation,
    };
  }
}

/**
 * Create a configured GEBCO provider instance
 */
export function createGEBCOProvider(
  config?: Partial<GEBCORoutingConfig>
): GEBCOMarineRoutingProvider {
  return new GEBCOMarineRoutingProvider(config);
}
