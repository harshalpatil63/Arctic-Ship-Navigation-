/**
 * Marine Routing Provider Factory
 * 
 * Creates the appropriate marine routing provider based on configuration.
 * Currently uses GEBCO-based custom Arctic marine routing.
 */

import {
  RoutingProvider,
  RoutingProviderConfig,
  RoutingRequest,
  RoutingResponse,
} from './routingProvider.js';
import {
  createGEBCOProvider,
  GEBCORoutingConfig,
} from '../routing/gebcoMarineRoutingProvider.js';

export class UnavailableMarineRoutingProvider implements RoutingProvider {
  name = 'unavailable-marine-routing';
  enabled = false;
  config: RoutingProviderConfig = {
    name: 'Unavailable',
    enabled: false,
    supportsArctic: false,
    supportsMultipleRoutes: false,
  };

  async initialize(): Promise<boolean> {
    return false;
  }

  async getStatus() {
    return {
      available: false,
      lastChecked: new Date().toISOString(),
      error: 'No marine routing provider configured. Live marine routing is unavailable.',
    };
  }

  async calculateRoute(
    _request: RoutingRequest
  ): Promise<RoutingResponse> {
    return {
      status: 'UNAVAILABLE',
      provider: this.name,
      routes: [],
      error: 'MARINE_ROUTING_UNAVAILABLE',
      message:
        'Real marine routing provider is not configured. Cannot calculate water-only routes.',
      timestamp: new Date().toISOString(),
    };
  }

  async validateCoordinatesInWater(): Promise<boolean> {
    return false;
  }
}

/**
 * Factory to get the appropriate routing provider
 * 
 * Environment variables:
 * - ROUTING_PROVIDER: 'gebco' (default), 'unavailable', or other provider name
 * - ROUTING_VESSEL_DRAFT: vessel draft in meters (default 3)
 * - ROUTING_VESSEL_SPEED: vessel speed in knots (default 12)
 */
export function createRoutingProvider(
  providerName?: string,
  config?: RoutingProviderConfig
): RoutingProvider {
  const provider = providerName || process.env.ROUTING_PROVIDER || 'gebco';

  switch (provider.toLowerCase()) {
    case 'gebco':
      return createGEBCOProvider({
        gridResolution: 0.5,
        vesselDraftMeters: parseInt(process.env.ROUTING_VESSEL_DRAFT || '3', 10),
        safetyDepthMarginMeters: 1,
        vesselSpeedKnots: parseInt(process.env.ROUTING_VESSEL_SPEED || '12', 10),
        calculateAlternatives: true,
        boundingBufferDegrees: 20,
      });

    case 'unavailable':
    default:
      return new UnavailableMarineRoutingProvider();
  }
}
