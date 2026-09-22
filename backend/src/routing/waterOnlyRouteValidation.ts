import {
  BathymetricCell,
  GridBounds,
  getGridIndex,
} from './bathymetricGrid.js';

export interface WaterOnlyRouteValidation {
  waterOnly: boolean;
  valid: boolean;
  checkedPoints: number;
  checkedSegments: number;
  reason?: string;
  invalidPointIndex?: number;
  invalidSegmentIndex?: number;
}

export interface WaterOnlyValidationOptions {
  allowLandEndpoints?: boolean;
}

export function isWaterOnlyRoute(
  coordinates: Array<{ latitude: number; longitude: number }>,
  grid: BathymetricCell[][],
  bounds: GridBounds,
  resolution: number,
  options: WaterOnlyValidationOptions = {}
): WaterOnlyRouteValidation {
  if (coordinates.length < 2) {
    return { waterOnly: false, valid: false, checkedPoints: coordinates.length, checkedSegments: 0, reason: 'Route must contain at least two points' };
  }

  for (let index = 0; index < coordinates.length; index += 1) {
    const coordinate = coordinates[index]!;
    if (
      !Number.isFinite(coordinate.latitude) ||
      !Number.isFinite(coordinate.longitude) ||
      coordinate.latitude < -90 ||
      coordinate.latitude > 90 ||
      coordinate.longitude < -180 ||
      coordinate.longitude > 180
    ) {
      return { waterOnly: false, valid: false, checkedPoints: index, checkedSegments: 0, reason: 'Route contains invalid latitude/longitude values', invalidPointIndex: index };
    }

    const cellIndex = getGridIndex(coordinate.latitude, coordinate.longitude, bounds, resolution);
    const cell = cellIndex ? grid[cellIndex.row]?.[cellIndex.col] : undefined;
    const isEndpoint = index === 0 || index === coordinates.length - 1;
    if (!cellIndex || !cell || (!options.allowLandEndpoints || !isEndpoint) && (!cell.isWater || !cell.navigable)) {
      return { waterOnly: false, valid: false, checkedPoints: index + 1, checkedSegments: 0, reason: 'Route point is outside the navigable water grid', invalidPointIndex: index };
    }
  }

  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const start = coordinates[index]!;
    const end = coordinates[index + 1]!;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(end.latitude - start.latitude), Math.abs(end.longitude - start.longitude)) / (resolution / 2)));

    for (let step = 1; step <= steps; step += 1) {
      const fraction = step / steps;
      const latitude = start.latitude + (end.latitude - start.latitude) * fraction;
      const longitude = start.longitude + (end.longitude - start.longitude) * fraction;
      const cellIndex = getGridIndex(latitude, longitude, bounds, resolution);
      const cell = cellIndex ? grid[cellIndex.row]?.[cellIndex.col] : undefined;
      const isEndpointConnector = (index === 0 || index === coordinates.length - 2) && options.allowLandEndpoints;
      if (!cellIndex || !cell || (!isEndpointConnector && (!cell.isWater || !cell.navigable))) {
        return { waterOnly: false, valid: false, checkedPoints: coordinates.length, checkedSegments: index + 1, reason: 'Route segment crosses land or unsafe water', invalidSegmentIndex: index };
      }
    }
  }

  return { waterOnly: true, valid: true, checkedPoints: coordinates.length, checkedSegments: coordinates.length - 1 };
}
