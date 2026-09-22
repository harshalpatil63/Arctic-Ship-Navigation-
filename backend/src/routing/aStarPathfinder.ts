/**
 * A* Pathfinding Algorithm for Marine Routing
 * 
 * Implements A* pathfinding on bathymetric water grids
 * to find optimal routes through navigable water channels.
 */

import {
  BathymetricCell,
  GridBounds,
  getGridIndex,
  getGridCoordinates,
} from './bathymetricGrid.js';

export interface PathNode {
  row: number;
  col: number;
  gCost: number; // cost from start
  hCost: number; // heuristic cost to goal
  fCost: number; // g + h
  parent: PathNode | null;
}

export interface RouteSegment {
  latitude: number;
  longitude: number;
  distanceFromStart: number;
  durationFromStart: number;
}

export interface PathfindingResult {
  found: boolean;
  path: RouteSegment[];
  totalDistance: number;
  totalCost: number;
  alternativePaths?: PathfindingResult[];
  calculatedAt: string;
}

/**
 * Calculate heuristic distance (straight-line distance)
 * Using haversine formula for accuracy
 */
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Get valid neighbors for a grid cell (8-directional movement)
 */
function getNeighbors(
  row: number,
  col: number,
  grid: BathymetricCell[][]
): Array<{ row: number; col: number; cell: BathymetricCell }> {
  const neighbors: Array<{ row: number; col: number; cell: BathymetricCell }> =
    [];

  // Cardinal movement prevents diagonal corner-cutting across land cells.
  const directions = [
    [-1, 0], // N
    [0, 1], // E
    [1, 0], // S
    [0, -1], // W
  ];

  for (const [dRow, dCol] of directions) {
    const newRow = row + dRow;
    const newCol = col + dCol;

    // Bounds check
    if (
      newRow >= 0 &&
      newRow < grid.length &&
      newCol >= 0 &&
      newCol < grid[0]!.length
    ) {
      const cell = grid[newRow]![newCol]!;

      // Only allow navigable water cells
      if (cell.navigable && cell.isWater) {
        neighbors.push({ row: newRow, col: newCol, cell });
      }
    }
  }

  return neighbors;
}

/**
 * A* pathfinding algorithm
 */
export function findPath(
  grid: BathymetricCell[][],
  startRow: number,
  startCol: number,
  goalRow: number,
  goalCol: number,
  bounds: GridBounds,
  resolution: number
): PathfindingResult {
  const startTime = Date.now();

  // Validate start and goal
  const startCell = grid[startRow]?.[startCol];
  const goalCell = grid[goalRow]?.[goalCol];

  if (!startCell?.navigable || !goalCell?.navigable) {
    return {
      found: false,
      path: [],
      totalDistance: 0,
      totalCost: Infinity,
      calculatedAt: new Date().toISOString(),
    };
  }

  const openSet: PathNode[] = [];
  const closedSet = new Set<string>();
  const nodeMap = new Map<string, PathNode>();

  // Initialize start node
  const startNode: PathNode = {
    row: startRow,
    col: startCol,
    gCost: 0,
    hCost: haversineDistance(
      getGridCoordinates(startRow, startCol, bounds, resolution).latitude,
      getGridCoordinates(startRow, startCol, bounds, resolution).longitude,
      getGridCoordinates(goalRow, goalCol, bounds, resolution).latitude,
      getGridCoordinates(goalRow, goalCol, bounds, resolution).longitude
    ),
    fCost: 0,
    parent: null,
  };
  startNode.fCost = startNode.gCost + startNode.hCost;

  openSet.push(startNode);
  nodeMap.set(`${startRow},${startCol}`, startNode);

  // Limit iterations to prevent excessive computation
  const maxIterations = Math.max(100000, grid.length * (grid[0]?.length || 0) * 2);
  let iterations = 0;

  while (openSet.length > 0 && iterations < maxIterations) {
    iterations++;

    // Find node with lowest f cost
    let current = openSet[0]!;
    let currentIndex = 0;

    for (let i = 1; i < openSet.length; i++) {
      if (openSet[i]!.fCost < current.fCost) {
        current = openSet[i]!;
        currentIndex = i;
      }
    }

    // Goal reached
    if (current.row === goalRow && current.col === goalCol) {
      const path = reconstructPath(current, bounds, resolution);
      const totalDistance = calculatePathDistance(path);

      return {
        found: true,
        path,
        totalDistance,
        totalCost: current.gCost,
        calculatedAt: new Date().toISOString(),
      };
    }

    openSet.splice(currentIndex, 1);
    closedSet.add(`${current.row},${current.col}`);

    // Check neighbors
    const neighbors = getNeighbors(current.row, current.col, grid);

    for (const { row: neighborRow, col: neighborCol, cell: neighborCell } of neighbors) {
      const neighborKey = `${neighborRow},${neighborCol}`;

      if (closedSet.has(neighborKey)) {
        continue;
      }

      const currentCoords = getGridCoordinates(
        current.row,
        current.col,
        bounds,
        resolution
      );
      const neighborCoords = getGridCoordinates(
        neighborRow,
        neighborCol,
        bounds,
        resolution
      );

      const distance = haversineDistance(
        currentCoords.latitude,
        currentCoords.longitude,
        neighborCoords.latitude,
        neighborCoords.longitude
      );

      const tentativeGCost = current.gCost + distance * neighborCell.cost;

      let neighbor = nodeMap.get(neighborKey);

      if (!neighbor) {
        neighbor = {
          row: neighborRow,
          col: neighborCol,
          gCost: tentativeGCost,
          hCost: haversineDistance(
            neighborCoords.latitude,
            neighborCoords.longitude,
            getGridCoordinates(goalRow, goalCol, bounds, resolution).latitude,
            getGridCoordinates(goalRow, goalCol, bounds, resolution).longitude
          ),
          fCost: 0,
          parent: current,
        };
        neighbor.fCost = neighbor.gCost + neighbor.hCost;
        nodeMap.set(neighborKey, neighbor);
        openSet.push(neighbor);
      } else if (tentativeGCost < neighbor.gCost) {
        neighbor.gCost = tentativeGCost;
        neighbor.fCost = neighbor.gCost + neighbor.hCost;
        neighbor.parent = current;
      }
    }
  }

  // No path found
  return {
    found: false,
    path: [],
    totalDistance: 0,
    totalCost: Infinity,
    calculatedAt: new Date().toISOString(),
  };
}

/**
 * Reconstruct path from goal node back to start
 */
function reconstructPath(
  node: PathNode,
  bounds: GridBounds,
  resolution: number
): RouteSegment[] {
  const path: RouteSegment[] = [];
  let current: PathNode | null = node;
  let totalDistance = 0;

  while (current) {
    const coords = getGridCoordinates(
      current.row,
      current.col,
      bounds,
      resolution
    );
    path.unshift({
      latitude: coords.latitude,
      longitude: coords.longitude,
      distanceFromStart: 0, // Will be calculated
      durationFromStart: 0, // Will be calculated
    });

    current = current.parent;
  }

  // Calculate distance and duration for each waypoint
  for (let i = 0; i < path.length; i++) {
    if (i === 0) {
      path[i]!.distanceFromStart = 0;
      path[i]!.durationFromStart = 0;
    } else {
      const prev = path[i - 1]!;
      const current = path[i]!;
      const segmentDistance = haversineDistance(
        prev.latitude,
        prev.longitude,
        current.latitude,
        current.longitude
      );
      totalDistance += segmentDistance;

      path[i]!.distanceFromStart = totalDistance;
    }
  }

  return path;
}

/**
 * Calculate total distance of a path
 */
function calculatePathDistance(path: RouteSegment[]): number {
  if (path.length === 0) return 0;

  let totalDistance = 0;
  for (let i = 1; i < path.length; i++) {
    totalDistance += haversineDistance(
      path[i - 1]!.latitude,
      path[i - 1]!.longitude,
      path[i]!.latitude,
      path[i]!.longitude
    );
  }

  return totalDistance;
}

/**
 * Simplify path by removing intermediate waypoints that are nearly collinear
 * Reduces the number of waypoints while preserving route accuracy
 */
export function simplifyPath(
  path: RouteSegment[],
  toleranceKm: number = 0.5
): RouteSegment[] {
  if (path.length <= 2) return path;

  const simplified: RouteSegment[] = [path[0]!];

  for (let i = 1; i < path.length - 1; i++) {
    const prev = simplified[simplified.length - 1]!;
    const current = path[i]!;
    const next = path[i + 1]!;

    // Calculate perpendicular distance from current point to line between prev and next
    const distance = perpendicularDistance(
      prev.latitude,
      prev.longitude,
      next.latitude,
      next.longitude,
      current.latitude,
      current.longitude
    );

    if (distance > toleranceKm) {
      simplified.push(current);
    }
  }

  simplified.push(path[path.length - 1]!);
  return simplified;
}

/**
 * Calculate perpendicular distance from point to line
 */
function perpendicularDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  latP: number,
  lonP: number
): number {
  const A = haversineDistance(lat1, lon1, latP, lonP);
  const B = haversineDistance(lat2, lon2, latP, lonP);
  const C = haversineDistance(lat1, lon1, lat2, lon2);

  if (C === 0) return A;

  const s = (A + B + C) / 2;
  const area = Math.sqrt(s * (s - A) * (s - B) * (s - C));
  return (2 * area) / C;
}
