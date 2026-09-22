/**
 * Alternative Route Generation
 * 
 * Generates meaningful alternative marine routes by applying
 * controlled penalties to previously selected routes and re-running pathfinding.
 */

import { BathymetricCell, GridBounds } from './bathymetricGrid.js';
import { findPath, PathfindingResult, simplifyPath } from './aStarPathfinder.js';

export interface AlternativeRouteStrategy {
  strategy: 'safest' | 'fuel-efficient';
  name: string;
  description: string;
  penaltyRadius: number; // grid cells around main route to penalize
  penaltyFactor: number; // multiplier for cell costs
}

export type AlternativePathfindingResult = PathfindingResult & {
  strategy: AlternativeRouteStrategy['strategy'];
};

const alternativeStrategies: AlternativeRouteStrategy[] = [
  {
    strategy: 'safest',
    name: 'Safer Route',
    description: 'Avoiding the main route - potentially safer alternative',
    penaltyRadius: 3,
    penaltyFactor: 3.0,
  },
  {
    strategy: 'fuel-efficient',
    name: 'Northern Route',
    description: 'Longer but potentially fewer ice concerns in deep water',
    penaltyRadius: 5,
    penaltyFactor: 2.0,
  },
];

/**
 * Generate alternative routes by penalizing the original route
 */
export function generateAlternativeRoutes(
  grid: BathymetricCell[][],
  primaryRoute: { row: number; col: number }[],
  startRow: number,
  startCol: number,
  goalRow: number,
  goalCol: number,
  bounds: GridBounds,
  resolution: number
): AlternativePathfindingResult[] {
  const alternatives: AlternativePathfindingResult[] = [];

  for (const strategy of alternativeStrategies) {
    // Create penalized copy of grid
    const penalizedGrid = applyRoutePenalty(
      grid,
      primaryRoute,
      strategy.penaltyRadius,
      strategy.penaltyFactor
    );

    // Find path in penalized grid
    const result = findPath(
      penalizedGrid,
      startRow,
      startCol,
      goalRow,
      goalCol,
      bounds,
      resolution
    );

    if (result.found) {
      // Ensure alternative is meaningfully different
      if (!isPathTooSimilar(primaryRoute, result.path, bounds, resolution)) {
        alternatives.push({ ...result, strategy: strategy.strategy });
      }
    }
  }

  return alternatives;
}

/**
 * Apply penalty to grid cells near the main route
 * Makes alternative pathfinding avoid the main route
 */
function applyRoutePenalty(
  grid: BathymetricCell[][],
  route: { row: number; col: number }[],
  penaltyRadius: number,
  penaltyFactor: number
): BathymetricCell[][] {
  // Deep copy the grid
  const penalizedGrid = grid.map((row) =>
    row.map((cell) => ({ ...cell }))
  );

  // Mark cells near the route
  const penalizedCells = new Set<string>();

  for (const { row, col } of route) {
    // Apply penalty in radius
    for (let r = row - penaltyRadius; r <= row + penaltyRadius; r++) {
      for (let c = col - penaltyRadius; c <= col + penaltyRadius; c++) {
        if (
          r >= 0 &&
          r < penalizedGrid.length &&
          c >= 0 &&
          c < penalizedGrid[0]!.length
        ) {
          const key = `${r},${c}`;
          if (!penalizedCells.has(key)) {
            penalizedCells.add(key);
            const cell = penalizedGrid[r]![c]!;
            if (cell.navigable && cell.isWater) {
              cell.cost *= penaltyFactor;
            }
          }
        }
      }
    }
  }

  return penalizedGrid;
}

/**
 * Check if two paths are too similar
 * If paths overlap significantly, they're not meaningfully different
 */
function isPathTooSimilar(
  path1: { row: number; col: number }[],
  path2: RouteSegment[],
  bounds: GridBounds,
  resolution: number
): boolean {
  if (path1.length === 0 || path2.length === 0) {
    return false;
  }

  // Convert path2 back to grid indices
  const path2Indices: { row: number; col: number }[] = path2.map((segment) => {
    // Find closest grid cell
    const row = Math.round((segment.latitude - bounds.south) / resolution);
    const col = Math.round((segment.longitude - bounds.west) / resolution);
    return { row, col };
  });

  // Count overlapping cells
  const set1 = new Set(path1.map((p) => `${p.row},${p.col}`));
  let overlapCount = 0;

  for (const p of path2Indices) {
    if (set1.has(`${p.row},${p.col}`)) {
      overlapCount++;
    }
  }

  // If overlap > 50%, paths are too similar
  const minLength = Math.min(path1.length, path2Indices.length);
  const similarityRatio = overlapCount / minLength;

  return similarityRatio > 0.5;
}

/**
 * Route characteristics based on its properties
 */
export function analyzeRouteCharacteristics(
  distance: number,
  cost: number,
  primaryDistance: number,
  primaryCost: number
): {
  windExposure: 'low' | 'medium' | 'high';
  iceRisk: 'low' | 'medium' | 'high';
  trafficDensity: 'low' | 'medium' | 'high';
} {
  return {
    // Longer routes might indicate more exposure
    windExposure:
      distance > primaryDistance * 1.2
        ? 'high'
        : distance > primaryDistance * 1.05
          ? 'medium'
          : 'low',

    // Higher cost routes indicate more challenging conditions
    iceRisk:
      cost > primaryCost * 1.5
        ? 'high'
        : cost > primaryCost * 1.1
          ? 'medium'
          : 'low',

    // Arctic typically has low traffic
    trafficDensity: 'low',
  };
}

// Export type for use in route type
export interface RouteSegment {
  latitude: number;
  longitude: number;
  distanceFromStart: number;
  durationFromStart: number;
}
