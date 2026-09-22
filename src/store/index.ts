import { create } from 'zustand';
import { LiveWeatherObservation, Port, Route, Ship, Iceberg, VesselClass } from '../types';
import { generateRoutesFromApi, getPortsFromApi, getWeatherFromApi, getRouteMonitoring, RouteMonitoringResponse } from '../services/api';
import { getAllPorts, generateRoutes } from '../utils/generators';

interface AppState {
  selectedDeparture: Port | null;
  selectedArrival: Port | null;
  vesselClass: VesselClass;
  currentRoute: Route | null;
  selectedRouteId: string | null;
  routeMonitoring: RouteMonitoringResponse | null;
  monitoringStatus: 'idle' | 'loading' | 'live' | 'stale';
  monitoringError: string | null;
  monitoringWarning: string | null;
  routes: Route[];
  routeFound: boolean;
  routeStatus: 'idle' | 'loading' | 'success' | 'error';
  routeError: string | null;
  apiStatus: 'idle' | 'connected' | 'unavailable';
  websocketConnected: boolean;
  lastUpdated: string | null;
  ships: Ship[];
  icebergs: Iceberg[];
  ports: Port[];
  portsStatus: 'idle' | 'loading' | 'live' | 'empty' | 'error';
  portsError: string | null;
  sourceWeather: LiveWeatherObservation | null;
  destinationWeather: LiveWeatherObservation | null;
  sourceWeatherStatus: 'idle' | 'loading' | 'live' | 'unavailable';
  destinationWeatherStatus: 'idle' | 'loading' | 'live' | 'unavailable';
  sourceWeatherError: string | null;
  destinationWeatherError: string | null;
  setDeparture: (port: Port | null) => void;
  setArrival: (port: Port | null) => void;
  setVesselClass: (vesselClass: VesselClass) => void;
  swapPorts: () => void;
  loadPorts: () => Promise<void>;
  fetchSourceWeather: (coordinates: { latitude: number; longitude: number }) => Promise<void>;
  fetchDestinationWeather: (coordinates: { latitude: number; longitude: number }) => Promise<void>;
  cancelRoute: () => void;
  calculateRoute: () => void;
  selectRoute: (routeId: string) => void;
  cancelSelectedRoute: () => void;
  refreshSelectedRouteConditions: () => Promise<void>;
  setWebsocketStatus: (connected: boolean) => void;
}

export const useStore = create<AppState>((set, get) => ({
  selectedDeparture: null,
  selectedArrival: null,
  vesselClass: 'Arc7',
  currentRoute: null,
  selectedRouteId: null,
  routeMonitoring: null,
  monitoringStatus: 'idle',
  monitoringError: null,
  monitoringWarning: null,
  routes: [],
  routeFound: false,
  routeStatus: 'idle',
  routeError: null,
  apiStatus: 'idle',
  websocketConnected: false,
  lastUpdated: null,
  ships: [],
  icebergs: [],
  ports: [],
  portsStatus: 'idle',
  portsError: null,
  sourceWeather: null,
  destinationWeather: null,
  sourceWeatherStatus: 'idle',
  destinationWeatherStatus: 'idle',
  sourceWeatherError: null,
  destinationWeatherError: null,

  setDeparture: (port) => set({ selectedDeparture: port, sourceWeather: null, sourceWeatherStatus: 'idle', sourceWeatherError: null, currentRoute: null, selectedRouteId: null, routeMonitoring: null, monitoringStatus: 'idle', monitoringError: null, monitoringWarning: null, routes: [], routeFound: false, routeStatus: 'idle', routeError: null }),
  
  setArrival: (port) => set({ selectedArrival: port, destinationWeather: null, destinationWeatherStatus: 'idle', destinationWeatherError: null, currentRoute: null, selectedRouteId: null, routeMonitoring: null, monitoringStatus: 'idle', monitoringError: null, monitoringWarning: null, routes: [], routeFound: false, routeStatus: 'idle', routeError: null }),

  setVesselClass: (vesselClass) => set({ vesselClass }),

  swapPorts: () => {
    const { selectedDeparture, selectedArrival } = get();
    set({
      selectedDeparture: selectedArrival,
      selectedArrival: selectedDeparture,
      sourceWeather: null,
      destinationWeather: null,
      currentRoute: null,
      selectedRouteId: null,
      routeMonitoring: null,
      routes: [],
      routeFound: false,
      routeStatus: 'idle',
      routeError: null,
    });
  },

  loadPorts: async () => {
    set({ portsStatus: 'loading', portsError: null });
    try {
      const response = await getPortsFromApi();
      if (response.data && response.data.length > 0) {
        set({ ports: response.data, portsStatus: 'live' });
        return;
      }
    } catch (error) {
      console.warn('Backend ports endpoint unavailable, using polar ports fallback:', error);
    }
    // Fallback to static polar ports dataset
    const fallbackPorts = getAllPorts();
    set({ ports: fallbackPorts, portsStatus: 'live', portsError: null });
  },

  fetchSourceWeather: async (coordinates) => {
    set({ sourceWeatherStatus: 'loading', sourceWeatherError: null });
    try {
      const weather = await getWeatherFromApi(coordinates.latitude, coordinates.longitude);
      set({ sourceWeather: weather, sourceWeatherStatus: weather.status === 'LIVE' ? 'live' : 'unavailable', sourceWeatherError: weather.error || null,
        lastUpdated: weather.receivedAt,
      });
    } catch {
      set({ sourceWeather: null, sourceWeatherStatus: 'unavailable', sourceWeatherError: 'Unable to reach weather endpoint' });
    }
  },

  fetchDestinationWeather: async (coordinates) => {
    set({ destinationWeatherStatus: 'loading', destinationWeatherError: null });
    try {
      const weather = await getWeatherFromApi(coordinates.latitude, coordinates.longitude);
      set({ destinationWeather: weather, destinationWeatherStatus: weather.status === 'LIVE' ? 'live' : 'unavailable', destinationWeatherError: weather.error || null, lastUpdated: weather.receivedAt });
    } catch {
      set({ destinationWeather: null, destinationWeatherStatus: 'unavailable', destinationWeatherError: 'Unable to reach weather endpoint' });
    }
  },

  cancelRoute: () => set({
    selectedDeparture: null,
    selectedArrival: null,
    currentRoute: null,
    selectedRouteId: null,
    routeMonitoring: null,
    monitoringStatus: 'idle',
    monitoringError: null,
    monitoringWarning: null,
    routes: [],
    routeFound: false,
    routeStatus: 'idle',
    routeError: null,
    sourceWeather: null,
    destinationWeather: null,
    sourceWeatherStatus: 'idle',
    destinationWeatherStatus: 'idle',
    sourceWeatherError: null,
    destinationWeatherError: null,
    lastUpdated: new Date().toISOString(),
  }),

  calculateRoute: async () => {
    const { selectedDeparture, selectedArrival } = get();
    if (!selectedDeparture || !selectedArrival) return;

    set({ routeStatus: 'loading', routeError: null, routes: [], currentRoute: null, routeFound: false });
    try {
      const response = await generateRoutesFromApi(selectedDeparture.id, selectedArrival.id);
      
      const validRoutes = (response.routes || []).filter((route) => {
        return (
          route &&
          route.id &&
          route.coordinates &&
          Array.isArray(route.coordinates) &&
          route.coordinates.length >= 2
        );
      });

      if (validRoutes.length > 0) {
        set({
          routes: validRoutes,
          currentRoute: validRoutes[0]!,
          selectedRouteId: validRoutes[0]!.id,
          routeMonitoring: null,
          monitoringStatus: 'idle',
          monitoringError: null,
          monitoringWarning: null,
          routeFound: true,
          ships: validRoutes[0]?.ships || [],
          icebergs: validRoutes[0]?.icebergs || [],
          lastUpdated: new Date().toISOString(),
          routeStatus: 'success',
          apiStatus: 'connected',
          routeError: response.message || null,
        });
        return;
      }
    } catch (error) {
      console.warn('Backend route generation unavailable, using local pathfinder fallback:', error);
    }

    // Fallback route generation using local marine pathfinder
    const fallbackRoutes = generateRoutes(selectedDeparture.id, selectedArrival.id);
    if (fallbackRoutes && fallbackRoutes.length > 0) {
      set({
        routes: fallbackRoutes,
        currentRoute: fallbackRoutes[0]!,
        selectedRouteId: fallbackRoutes[0]!.id,
        routeMonitoring: null,
        monitoringStatus: 'idle',
        monitoringError: null,
        monitoringWarning: null,
        routeFound: true,
        ships: fallbackRoutes[0]?.ships || [],
        icebergs: fallbackRoutes[0]?.icebergs || [],
        lastUpdated: new Date().toISOString(),
        routeStatus: 'success',
        apiStatus: 'unavailable',
        routeError: null,
      });
    } else {
      set({
        routeStatus: 'error',
        routeError: 'Unable to calculate routes between selected ports',
        routes: [],
        currentRoute: null,
        routeFound: false,
        apiStatus: 'unavailable',
      });
    }
  },

  selectRoute: (routeId) => {
    const route = get().routes.find((candidate) => candidate.id === routeId);
    if (!route) {
      set({ currentRoute: null, selectedRouteId: null, routeMonitoring: null, monitoringStatus: 'idle', monitoringError: null, monitoringWarning: null, ships: [], icebergs: [] });
      return;
    }

    set({
      currentRoute: route,
      selectedRouteId: route.id,
      routeMonitoring: null,
      monitoringStatus: 'idle',
      monitoringError: null,
      monitoringWarning: null,
      ships: route.ships || [],
      icebergs: route.icebergs || [],
    });
  },

  cancelSelectedRoute: () => set({ currentRoute: null, selectedRouteId: null, routeMonitoring: null, monitoringStatus: 'idle', monitoringError: null, monitoringWarning: null, ships: [], icebergs: [] }),

  refreshSelectedRouteConditions: async () => {
    const routeId = get().selectedRouteId;
    if (!routeId) return;
    set({ monitoringStatus: 'loading', monitoringError: null });
    try {
      const monitoring = await getRouteMonitoring(routeId);
      if (get().selectedRouteId !== routeId) return;
      const route = get().routes.find((candidate) => candidate.id === routeId);
      if (!route) return;
      const updatedRoute = {
        ...route,
        riskLevel: monitoring.risk.riskLevel as Route['riskLevel'],
        score: monitoring.risk.overallRisk,
        weatherConditions: {
          ...route.weatherConditions,
          temperature: monitoring.samples.some((sample) => sample.temperature !== null) ? monitoring.samples.reduce((sum, sample) => sum + (sample.temperature ?? 0), 0) / monitoring.samples.filter((sample) => sample.temperature !== null).length : route.weatherConditions.temperature,
          windSpeed: monitoring.samples.some((sample) => sample.windSpeed !== null) ? monitoring.samples.reduce((sum, sample) => sum + (sample.windSpeed ?? 0), 0) / monitoring.samples.filter((sample) => sample.windSpeed !== null).length : route.weatherConditions.windSpeed,
          waveHeight: monitoring.samples.some((sample) => sample.waveHeight !== null) ? monitoring.samples.reduce((sum, sample) => sum + (sample.waveHeight ?? 0), 0) / monitoring.samples.filter((sample) => sample.waveHeight !== null).length : route.weatherConditions.waveHeight,
          visibility: monitoring.samples.every((sample) => sample.visibility === 'Good') ? 'Good' as const : 'Moderate' as const,
          forecast: `Sampled at ${monitoring.samples.length} points along route`,
        },
      };
      const previousRisk = get().routeMonitoring?.risk.riskLevel;
      set({ routeMonitoring: monitoring, monitoringStatus: monitoring.status === 'LIVE' ? 'live' : 'stale', monitoringError: null, monitoringWarning: previousRisk && previousRisk !== monitoring.risk.riskLevel ? `Route risk changed from ${previousRisk} to ${monitoring.risk.riskLevel}.` : null, currentRoute: updatedRoute, routes: get().routes.map((candidate) => candidate.id === routeId ? updatedRoute : candidate), lastUpdated: monitoring.lastUpdated });
    } catch (error) {
      if (get().selectedRouteId === routeId) set({ monitoringStatus: 'stale', monitoringError: error instanceof Error ? error.message : 'Unable to refresh environmental data' });
    }
  },

  setWebsocketStatus: (connected) => set({ websocketConnected: connected, lastUpdated: new Date().toISOString() })
  
}));