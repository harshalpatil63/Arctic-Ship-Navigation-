import { getRiskColor } from '../riskUtils';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Map, View } from 'ol';
import { fromLonLat, toLonLat } from 'ol/proj';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Feature } from 'ol';
import { Point, LineString } from 'ol/geom';
import { boundingExtent } from 'ol/extent';
import { Style, Circle, Fill, Stroke, Text } from 'ol/style';
import {
  Ship as ShipIcon, Navigation, AlertTriangle,
  Thermometer, Wind, Map as MapIcon,
  Waves, Eye, Users, Fuel, Gauge, RefreshCw,
  ArrowLeft, Crosshair, ChevronDown, ChevronUp,
  ArrowRightLeft, X, RotateCcw, ShieldAlert, Compass
} from 'lucide-react';
import { useStore } from '../store';
import { RouteMonitoringSample } from '../services/api';
import { Iceberg, LiveWeatherObservation, Port, Ship as ShipType } from '../types';
import RiskBadge from '../components/RiskBadge';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const routeColors: Record<string, string> = {
  shortest: '#38bdf8',
  safest: '#34d399',
  'fuel-efficient': '#fbbf24',
  'weather-optimized': '#a78bfa',
  'low-sea-ice': '#22d3ee',
  'low-traffic': '#fb7185',
};

const segmentRiskColor = (riskScore: number): string => {
  if (riskScore >= 80) return '#ef4444';
  if (riskScore >= 60) return '#f97316';
  if (riskScore >= 40) return '#f59e0b';
  return '#10b981';
};

function weatherCondition(code?: number): string {
  if (code === undefined) return 'Unavailable';
  if (code === 0) return 'Clear';
  if (code <= 3) return 'Partly cloudy';
  if (code <= 48) return 'Fog';
  if (code <= 57) return 'Drizzle';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Rain showers';
  return 'Storm';
}

function windDirection(degrees?: number): string {
  if (degrees === undefined) return '—';
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(degrees / 45) % 8] || '—';
}

/**
 * Validate that coordinates are valid WGS84 values
 */
function isValidCoordinate(longitude: number, latitude: number): boolean {
  return (
    typeof longitude === 'number' &&
    typeof latitude === 'number' &&
    !isNaN(longitude) &&
    !isNaN(latitude) &&
    longitude >= -180 &&
    longitude <= 180 &&
    latitude >= -90 &&
    latitude <= 90
  );
}

function formatDuration(minutes: number): string {
  const totalMinutes = Math.max(0, Math.round(minutes));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const remainingMinutes = totalMinutes % 60;
  return `${days} days ${hours} hours ${remainingMinutes} minutes`;
}

function formatDurationHours(minutes: number): string {
  return `${(minutes / 60).toFixed(1)} h`;
}

function WeatherPanel({ label, port, observation, status, error }: {
  label: string;
  port: Port | null;
  observation: LiveWeatherObservation | null;
  status: 'idle' | 'loading' | 'live' | 'unavailable';
  error: string | null;
}) {
  const live = status === 'live' && observation?.status === 'LIVE';
  return (
    <section className="rounded-lg bg-slate-900/50 border border-slate-800/40 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-800/40 flex items-center justify-between">
        <h2 className="text-[11px] font-semibold text-slate-400">{label} WEATHER</h2>
        <span className={`text-[9px] font-mono ${live ? 'text-emerald-400' : 'text-amber-400'}`}>
          {live ? 'LIVE' : status === 'loading' ? 'LOADING' : 'UNAVAILABLE'}
        </span>
      </div>
      <div className="p-3 text-[10px] text-slate-500">
        {live && observation?.current ? (
          <div className="grid grid-cols-2 gap-2">
            <span className="col-span-2 text-slate-300 font-semibold">{port?.name || 'Selected location'}</span>
            <span>Lat <strong className="text-slate-200">{observation.coordinates.latitude.toFixed(4)}°</strong></span>
            <span>Lon <strong className="text-slate-200">{observation.coordinates.longitude.toFixed(4)}°</strong></span>
            <span>Temp <strong className="text-slate-200">{observation.current.temperatureCelsius ?? '—'}°C</strong></span>
            <span>Wind <strong className="text-slate-200">{observation.current.windSpeedKmh ?? '—'} km/h</strong></span>
            <span>Direction <strong className="text-slate-200">{windDirection(observation.current.windDirectionDegrees)}</strong></span>
            <span>Precip. <strong className="text-slate-200">{observation.current.precipitationMm ?? '—'} mm</strong></span>
            <span>Condition <strong className="text-slate-200">{weatherCondition(observation.current.weatherCode)}</strong></span>
            <span className="col-span-2 text-slate-600">Updated {observation.timestamp || observation.receivedAt} · {observation.provider}</span>
          </div>
        ) : (
          <span>{error || (port ? 'Weather unavailable for this location.' : 'Select a location to retrieve weather.')}</span>
        )}
      </div>
    </section>
  );
}

interface DashboardPageProps {
  onNavigate: (page: 'home') => void;
}

const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const baseLayerRef = useRef<TileLayer | null>(null);
  const routeLayerRef = useRef<VectorLayer | null>(null);
  const [selectedIceberg, setSelectedIceberg] = useState<Iceberg | null>(null);
  const [selectedShip, setSelectedShip] = useState<ShipType | null>(null);
  const [selectedCondition, setSelectedCondition] = useState<(RouteMonitoringSample & { riskScore: number | null; condition: string }) | null>(null);
  const [hoverData, setHoverData] = useState<{ lat: string; lon: string } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [routeFilter, setRouteFilter] = useState<'all' | 'shortest' | 'safest' | 'fuel-efficient'>('all');
  const [isSimulationActive, setIsSimulationActive] = useState(false);
  const [simulationProgress, setSimulationProgress] = useState(0);
  const [simulationSpeed, setSimulationSpeed] = useState(1);
  const [sectionsOpen, setSectionsOpen] = useState({
    telemetry: true, weather: true, traffic: true, alternatives: true
  });
  const [mapOverlays, setMapOverlays] = useState({ ice: true, traffic: true, icebergs: true });
  const [isEditingRoute, setIsEditingRoute] = useState(true);

  const {
    ports,
    ships,
    icebergs,
    selectedDeparture,
    selectedArrival,
    vesselClass,
    setVesselClass,
    swapPorts,
    currentRoute,
    selectedRouteId,
    routeMonitoring,
    monitoringStatus,
    monitoringError,
    monitoringWarning,
    routes,
    portsStatus,
    portsError,
    loadPorts,
    routeStatus,
    routeError,
    setDeparture,
    setArrival,
    fetchSourceWeather,
    fetchDestinationWeather,
    sourceWeather,
    destinationWeather,
    sourceWeatherStatus,
    destinationWeatherStatus,
    sourceWeatherError,
    destinationWeatherError,
    cancelRoute,
    cancelSelectedRoute,
    refreshSelectedRouteConditions,
    calculateRoute,
    selectRoute,
    websocketConnected,
    apiStatus,
    lastUpdated,
  } = useStore();

  const toggleSection = (key: keyof typeof sectionsOpen) => {
    setSectionsOpen(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const visibleRoutes = useMemo(() => {
    if (routeFilter === 'all') return routes;
    return routes.filter((route) => (route.strategy || 'shortest') === routeFilter);
  }, [routeFilter, routes]);

  const routeComparisonData = useMemo(() => routes.map((route) => ({
    name: route.label || `Route ${route.id.slice(-3)}`,
    distance: route.distance,
    fuel: Number(route.fuelEstimate ?? 0),
    risk: route.riskLevel === 'Low' ? 25 : route.riskLevel === 'Medium' ? 50 : route.riskLevel === 'High' ? 75 : 90,
  })), [routes]);

  const riskTimelineData = useMemo(() => {
    if (!routeMonitoring?.samples?.length) return [];
    return routeMonitoring.samples.map((sample, index) => ({
      label: `${index + 1}`,
      risk: sample.windSpeed !== null || sample.waveHeight !== null
        ? Math.min(100, Math.round(((sample.windSpeed ?? 0) / 60) * 55 + ((sample.waveHeight ?? 0) / 6) * 45))
        : 25,
      temperature: sample.temperature ?? 0,
      wind: sample.windSpeed ?? 0,
    }));
  }, [routeMonitoring]);

  const routeHighlights = [
    {
      label: 'Distance',
      value: currentRoute ? `${currentRoute.distance} km` : '—',
      accent: 'text-cyan-300',
    },
    {
      label: 'Fuel',
      value: currentRoute ? `${currentRoute.fuelEstimate ?? '—'} t` : '—',
      accent: 'text-amber-300',
    },
    {
      label: 'Risk',
      value: currentRoute ? currentRoute.riskLevel : '—',
      accent: 'text-rose-300',
    },
    {
      label: 'ETA',
      value: currentRoute ? formatDurationHours(currentRoute.estimatedTimeMinutes) : '—',
      accent: 'text-emerald-300',
    },
  ];

  const exportRouteReport = () => {
    if (!currentRoute) return;

    const report = {
      generatedAt: new Date().toISOString(),
      departure: selectedDeparture,
      arrival: selectedArrival,
      route: currentRoute,
      monitoring: routeMonitoring,
      status: routeStatus,
      summary: {
        distanceKm: currentRoute.distance,
        etaMinutes: currentRoute.estimatedTimeMinutes,
        fuelTons: currentRoute.fuelEstimate ?? 0,
        riskLevel: currentRoute.riskLevel,
        waterOnly: currentRoute.validation?.waterOnly ?? false,
      },
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `arctic-route-report-${currentRoute.id}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (!currentRoute || !isSimulationActive) return;
    const interval = window.setInterval(() => {
      setSimulationProgress((prev) => {
        const next = prev >= 100 ? 0 : prev + simulationSpeed * 5;
        return next;
      });
    }, 150);

    return () => window.clearInterval(interval);
  }, [currentRoute, isSimulationActive, simulationSpeed]);

  useEffect(() => {
    if (!currentRoute) {
      setIsSimulationActive(false);
      setSimulationProgress(0);
      return;
    }

    if (!isSimulationActive) {
      setSimulationProgress(0);
    }
  }, [currentRoute, isSimulationActive]);

  useEffect(() => {
    if (!selectedRouteId) return;
    setSimulationProgress(0);
  }, [selectedRouteId]);

  useEffect(() => {
    if (!selectedRouteId) return;
    if (!routeMonitoring?.samples?.length) return;
    setIsSimulationActive(false);
  }, [selectedRouteId, routeMonitoring]);

  useEffect(() => {
    if (!currentRoute) return;
    const validCoords = currentRoute.coordinates.filter(
      (coord) => Array.isArray(coord) && coord.length >= 2 && isValidCoordinate(coord[0], coord[1])
    ) as [number, number][];
    if (validCoords.length < 2) return;
    const index = Math.min(validCoords.length - 1, Math.max(0, Math.round((simulationProgress / 100) * (validCoords.length - 1))));
    if (selectedCondition) {
      setSelectedCondition((prev) => prev ? { ...prev, latitude: validCoords[index][1], longitude: validCoords[index][0] } : prev);
    }
  }, [currentRoute, selectedCondition, simulationProgress]);

  useEffect(() => {
    if (routeMonitoring?.samples?.length) {
      setSelectedCondition((prev) => prev ?? null);
    }
  }, [routeMonitoring]);

  useEffect(() => {
    if (selectedDeparture) {
      void fetchSourceWeather({ latitude: selectedDeparture.latitude, longitude: selectedDeparture.longitude });
    }
  }, [fetchSourceWeather, selectedDeparture]);

  useEffect(() => {
    if (selectedArrival) {
      void fetchDestinationWeather({ latitude: selectedArrival.latitude, longitude: selectedArrival.longitude });
    }
  }, [fetchDestinationWeather, selectedArrival]);

  useEffect(() => {
    if (!selectedRouteId) return;
    setSelectedCondition(null);
    void refreshSelectedRouteConditions();
    const interval = Number(import.meta.env.VITE_WEATHER_REFRESH_INTERVAL_MS || 60000);
    const timer = window.setInterval(() => void refreshSelectedRouteConditions(), interval);
    return () => window.clearInterval(timer);
  }, [refreshSelectedRouteConditions, selectedRouteId]);

  // Initialize Map
  useEffect(() => {
    if (!mapRef.current) return;
    const map = new Map({
      target: mapRef.current,
      layers: [],
      view: new View({ center: fromLonLat([90, 70]), zoom: 3.5 }),
    });

    const baseLayer = new TileLayer({
      source: new XYZ({
        url: 'https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attributions: '© OpenStreetMap contributors',
      }),
    });
    const routeLayer = new VectorLayer({ source: new VectorSource(), zIndex: 10 });

    baseLayerRef.current = baseLayer;
    routeLayerRef.current = routeLayer;
    map.addLayer(baseLayer);
    map.addLayer(routeLayer);

    map.on('click', (e) => {
      const feature = map.forEachFeatureAtPixel(e.pixel, (f) => f);
      if (feature) {
        const props = feature.getProperties();
        if (props.type === 'iceberg') {
          setSelectedIceberg(props.data);
          setSelectedShip(null);
        } else if (props.type === 'ship') {
          setSelectedShip(props.data);
          setSelectedIceberg(null);
        } else if (props.type === 'condition-marker') {
          setSelectedCondition(props.data);
          setSelectedIceberg(null);
          setSelectedShip(null);
        }
      } else {
        setSelectedIceberg(null);
        setSelectedShip(null);
        setSelectedCondition(null);
      }
    });

    map.on('pointermove', (e) => {
      const pixel = map.getEventPixel(e.originalEvent);
      const feature = map.forEachFeatureAtPixel(pixel, (f) => f);
      if (feature && !feature.get('type')) {
        const coordinate = map.getCoordinateFromPixel(pixel);
        const lonLat = toLonLat(coordinate);
        setMousePos({ x: e.originalEvent.clientX, y: e.originalEvent.clientY });
        setHoverData({
          lat: lonLat[1].toFixed(4) + '°',
          lon: lonLat[0].toFixed(4) + '°',
        });
        map.getTargetElement().style.cursor = 'crosshair';
      } else {
        setHoverData(null);
        map.getTargetElement().style.cursor = feature ? 'pointer' : '';
      }
    });

    mapInstanceRef.current = map;
    return () => map.setTarget(undefined);
  }, []);

  // Render features
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const validRoutes = routes.filter((route) => {
      if (!route || !route.coordinates || !Array.isArray(route.coordinates) || route.coordinates.length < 2) return false;
      if (route.validation && route.validation.waterOnly === false) return false;
      return route.coordinates.some(
        (coord) => Array.isArray(coord) && coord.length >= 2 && isValidCoordinate(coord[0], coord[1])
      );
    });

    const features: Feature[] = [];

    if (currentRoute && isSimulationActive && currentRoute.coordinates.length > 1) {
      const validCoords = currentRoute.coordinates.filter(
        (coord) => Array.isArray(coord) && coord.length >= 2 && isValidCoordinate(coord[0], coord[1])
      ) as [number, number][];
      if (validCoords.length > 0) {
        const index = Math.min(validCoords.length - 1, Math.max(0, Math.round((simulationProgress / 100) * (validCoords.length - 1))));
        const simulationCoord = validCoords[index]!;
        const shipMarker = new Feature({
          geometry: new Point(fromLonLat(simulationCoord)),
          type: 'simulated-ship',
          data: { name: 'Simulation vessel', latitude: simulationCoord[1], longitude: simulationCoord[0] },
        });
        shipMarker.setStyle(new Style({
          image: new Circle({
            radius: 7,
            fill: new Fill({ color: '#22c55e' }),
            stroke: new Stroke({ color: '#dcfce7', width: 2 }),
          }),
          text: new Text({ text: 'SIM', offsetY: 14, fill: new Fill({ color: '#86efac' }), font: '600 8px Inter, sans-serif' }),
        }));
        features.push(shipMarker);
      }
    }

    ports.forEach((port) => {
      const feature = new Feature({
        geometry: new Point(fromLonLat([port.longitude, port.latitude])),
        type: 'port',
      });
      feature.setStyle(
        new Style({
          image: new Circle({
            radius: 5,
            fill: new Fill({ color: '#10b981' }),
            stroke: new Stroke({ color: '#064e3b', width: 1.5 }),
          }),
          text: new Text({
            text: port.name,
            offsetY: -14,
            font: '600 10px Inter, sans-serif',
            fill: new Fill({ color: '#94a3b8' }),
            backgroundFill: new Fill({ color: 'rgba(2, 6, 23, 0.8)' }),
            padding: [2, 5, 2, 5],
          }),
        })
      );
      features.push(feature);
    });

    const addLocationMarker = (port: Port | null, label: string, color: string, coordinate?: [number, number]) => {
      if (!port) return;
      const markerCoordinate = coordinate || [port.longitude, port.latitude];
      const feature = new Feature({
        geometry: new Point(fromLonLat(markerCoordinate)),
        type: 'location-marker',
        data: port,
      });
      feature.setStyle(new Style({
        image: new Circle({ radius: 8, fill: new Fill({ color }), stroke: new Stroke({ color: '#ffffff', width: 2 }) }),
        text: new Text({ text: label, offsetY: -18, font: '700 11px Inter, sans-serif', fill: new Fill({ color: '#102a43' }), backgroundFill: new Fill({ color: 'rgba(255,255,255,0.9)' }), padding: [2, 4, 2, 4] }),
      }));
      features.push(feature);
    };
    const routeStart = currentRoute?.coordinates[0];
    const routeEnd = currentRoute?.coordinates[currentRoute.coordinates.length - 1];
    const sourceCoordinate = routeStart && isValidCoordinate(routeStart[0], routeStart[1]) ? routeStart : undefined;
    const destinationCoordinate = routeEnd && isValidCoordinate(routeEnd[0], routeEnd[1]) ? routeEnd : undefined;
    addLocationMarker(selectedDeparture, 'Source', '#2563eb', sourceCoordinate);
    addLocationMarker(selectedArrival, 'Destination', '#dc2626', destinationCoordinate);

    validRoutes.forEach((route) => {
      const color = routeColors[route.strategy || 'shortest'] || getRiskColor(route.riskLevel);
      const isSelected = route.id === currentRoute?.id;

      const routeCoordinates = route.coordinates
        .filter((coordinate) => Array.isArray(coordinate) && coordinate.length >= 2 && isValidCoordinate(coordinate[0], coordinate[1]))
        .map((coordinate) => fromLonLat(coordinate as [number, number]));
      if (routeCoordinates.length < 2) return;

      const routeFeature = new Feature({
        geometry: new LineString(routeCoordinates),
        type: 'route-segment',
      });
      routeFeature.setStyle(
        new Style({
          stroke: new Stroke({
            color: isSelected ? '#06b6d4' : `${color}88`,
            width: isSelected ? 5 : 2,
            lineDash: isSelected ? undefined : [8, 6],
          }),
        })
      );
      features.push(routeFeature);
    });

    if (currentRoute && currentRoute.coordinates && Array.isArray(currentRoute.coordinates)) {
      // Waypoint dots
      currentRoute.coordinates.forEach((coord, i) => {
        if (i === 0 || i === currentRoute!.coordinates.length - 1) return;

        // Validate coordinate
        if (!Array.isArray(coord) || coord.length < 2) return;
        const [lon, lat] = coord as [number, number];
        if (!isValidCoordinate(lon, lat)) return;

        const wp = new Feature({ geometry: new Point(fromLonLat(coord as [number, number])) });
        wp.setStyle(new Style({
          image: new Circle({
            radius: 3,
            fill: new Fill({ color: '#475569' }),
            stroke: new Stroke({ color: '#1e293b', width: 1 }),
          }),
        }));
        features.push(wp);
      });
    }

    if (selectedRouteId && routeMonitoring?.samples) {
      routeMonitoring.samples.forEach((sample) => {
        const hasRiskInputs = sample.windSpeed !== null || sample.waveHeight !== null;
        const riskScore = hasRiskInputs ? ((sample.windSpeed ?? 0) > 50 || (sample.waveHeight ?? 0) > 4 ? 80 : (sample.windSpeed ?? 0) > 30 || (sample.waveHeight ?? 0) > 2 ? 50 : 15) : null;
        const markerColor = riskScore === null ? '#64748b' : segmentRiskColor(riskScore);
        const feature = new Feature({
          geometry: new Point(fromLonLat([sample.longitude, sample.latitude])),
          type: 'condition-marker',
          data: { ...sample, riskScore, condition: weatherCondition(sample.weatherCode) },
        });
        feature.setStyle(new Style({
          image: new Circle({ radius: 6, fill: new Fill({ color: markerColor }), stroke: new Stroke({ color: '#ffffff', width: 1.5 }) }),
        }));
        features.push(feature);
      });
    }

    if (mapOverlays.traffic) {
      ships.forEach((ship) => {
        const feature = new Feature({
          geometry: new Point(fromLonLat([ship.longitude, ship.latitude])),
          type: 'ship',
          data: ship,
        });
        feature.setStyle(new Style({
          image: new Circle({
            radius: 6,
            fill: new Fill({ color: '#3b82f6' }),
            stroke: new Stroke({ color: '#1e3a5f', width: 1.5 }),
          }),
          text: new Text({
            text: ship.name,
            offsetY: 14,
            font: '500 9px Inter, sans-serif',
            fill: new Fill({ color: '#60a5fa' }),
          }),
        }));
        features.push(feature);
      });
    }

    if (mapOverlays.icebergs) {
      icebergs.forEach((iceberg) => {
        const feature = new Feature({
          geometry: new Point(fromLonLat([iceberg.longitude, iceberg.latitude])),
          type: 'iceberg',
          data: iceberg,
        });
        feature.setStyle(new Style({
          image: new Circle({
            radius: 5,
            fill: new Fill({ color: '#ef4444' }),
            stroke: new Stroke({ color: '#7f1d1d', width: 1.5 }),
          }),
          text: new Text({
            text: iceberg.name,
            offsetY: -12,
            font: '600 8px Inter, sans-serif',
            fill: new Fill({ color: '#fca5a5' }),
          }),
        }));
        features.push(feature);
      });
    }

    if (routeLayerRef.current) {
      routeLayerRef.current.setSource(new VectorSource({ features }));
    }

    if (validRoutes.length > 0) {
      try {
        mapInstanceRef.current.updateSize();
        const routesToFit = selectedRouteId
          ? validRoutes.filter((route) => route.id === selectedRouteId)
          : validRoutes;
        const routeCoordinates = routesToFit
          .filter((route) => route && route.coordinates && Array.isArray(route.coordinates))
          .flatMap((route) =>
            route.coordinates
              .filter(
                (coord) =>
                  Array.isArray(coord) &&
                  coord.length >= 2 &&
                  isValidCoordinate(coord[0], coord[1])
              )
              .map((coordinate) => fromLonLat(coordinate as [number, number]))
          );

        if (routeCoordinates.length > 0) {
          mapInstanceRef.current
            .getView()
            .fit(boundingExtent(routeCoordinates), {
              padding: [80, 80, 80, 80],
              maxZoom: 6,
              duration: 500,
            });
        }
      } catch (error) {
        console.error('Error fitting map bounds:', error);
      }
    }
  }, [ports, ships, icebergs, routes, currentRoute, selectedRouteId, routeMonitoring, selectedDeparture, selectedArrival, hoverData, isSimulationActive, simulationProgress, mapOverlays]);

  return (
    <div className="h-screen flex overflow-hidden bg-[#020617] pt-16">
      {/* Hover Tooltip */}
      {hoverData && (
        <div
          className="fixed pointer-events-none bg-slate-950/90 border border-slate-800 p-2.5 rounded-lg shadow-xl z-[3000]"
          style={{ left: mousePos.x + 16, top: mousePos.y - 36 }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <Crosshair className="w-3 h-3 text-slate-500" />
            <span className="text-[9px] font-semibold text-slate-600 uppercase tracking-wider">Position</span>
          </div>
          <div className="flex gap-4 text-[10px] font-mono">
            <span className="text-slate-500">LAT <span className="text-slate-300">{hoverData.lat}</span></span>
            <span className="text-slate-500">LON <span className="text-slate-300">{hoverData.lon}</span></span>
          </div>
        </div>
      )}

      <div className="absolute right-4 top-20 z-10 hidden xl:flex flex-col gap-2.5">
        {/* Map Layer Controls */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-2.5 shadow-2xl backdrop-blur-md flex items-center gap-1.5">
          <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider mr-1">Layers:</span>
          <button
            type="button"
            onClick={() => setMapOverlays(prev => ({ ...prev, traffic: !prev.traffic }))}
            className={`px-2 py-1 rounded text-[10px] font-semibold border transition-all ${
              mapOverlays.traffic
                ? 'bg-blue-500/20 border-blue-500/50 text-blue-300 shadow-sm shadow-blue-500/20'
                : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
          >
            🚢 Vessel AIS
          </button>
          <button
            type="button"
            onClick={() => setMapOverlays(prev => ({ ...prev, icebergs: !prev.icebergs }))}
            className={`px-2 py-1 rounded text-[10px] font-semibold border transition-all ${
              mapOverlays.icebergs
                ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 shadow-sm shadow-rose-500/20'
                : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
          >
            ⛰️ Icebergs
          </button>
        </div>

        {/* Mission Overview */}
        <div className="rounded-xl border border-cyan-500/20 bg-slate-900/80 p-3 shadow-2xl backdrop-blur-sm min-w-[220px]">
          <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-400 mb-2">Mission Overview</div>
          <div className="space-y-2 text-[11px] text-slate-300">
            <div className="flex items-center justify-between">
              <span>Route status</span>
              <span className="font-semibold text-emerald-400">{routeStatus === 'success' ? 'Active' : routeStatus === 'loading' ? 'Processing' : 'Standby'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Vessel Class</span>
              <span className="font-semibold text-cyan-300">{vesselClass}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Risk posture</span>
              <span className="font-semibold text-amber-300">{currentRoute?.riskLevel || 'N/A'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Water-only validation</span>
              <span className="font-semibold text-emerald-400">Confirmed (100%)</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Live network</span>
              <span className="font-semibold text-slate-100">{websocketConnected ? 'Connected' : 'Monitoring'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* SIDEBAR */}
      <div className="w-[380px] bg-slate-950/90 border-r border-slate-800/50 overflow-y-auto flex flex-col gap-3 z-20 p-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-800/40">
          <button
            onClick={() => onNavigate('home')}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Home
          </button>
          <span className="text-[10px] text-slate-600 font-mono">Arctic Ship Navigation</span>
        </div>

        {/* Route Planning */}
        <section className="rounded-lg bg-slate-900/50 border border-slate-800/40 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-800/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapIcon className="w-3.5 h-3.5 text-cyan-400" />
              <h2 className="text-[11px] font-semibold text-slate-300">Route Planning & Controls</h2>
            </div>
            {currentRoute && (
              <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                ACTIVE VOYAGE
              </span>
            )}
          </div>
          <div className="p-3 space-y-3">
            {portsStatus !== 'live' && (
              <div className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[10px] text-amber-300">
                {portsStatus === 'loading' ? 'Loading live ports...' : portsStatus === 'empty' ? 'No ports available' : portsError || 'Live ports unavailable'}
                {portsStatus === 'error' && (
                  <button type="button" onClick={() => void loadPorts()} className="ml-2 text-cyan-400 underline">Retry</button>
                )}
              </div>
            )}

            <div className="space-y-2.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Source Port</label>
                  <button
                    type="button"
                    onClick={swapPorts}
                    disabled={!selectedDeparture && !selectedArrival}
                    className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 hover:underline disabled:opacity-30"
                    title="Swap Departure and Arrival Ports"
                  >
                    <ArrowRightLeft className="w-2.5 h-2.5" />
                    Swap Ports
                  </button>
                </div>
                <select
                  className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2.5 text-xs text-white outline-none focus:border-cyan-500/50 transition-colors"
                  value={selectedDeparture?.id || ''}
                  onChange={(e) => setDeparture(ports.find((p) => p.id === e.target.value) || null)}
                >
                  <option value="">Select departure port...</option>
                  {ports.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}, {p.country}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block mb-1">Destination Port</label>
                <select
                  className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2.5 text-xs text-white outline-none focus:border-cyan-500/50 transition-colors"
                  value={selectedArrival?.id || ''}
                  onChange={(e) => setArrival(ports.find((p) => p.id === e.target.value) || null)}
                >
                  <option value="">Select destination port...</option>
                  {ports.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}, {p.country}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block mb-1">Vessel Ice Class</label>
                <div className="grid grid-cols-3 gap-1">
                  {(['Arc7', 'Arc4', 'Non-Ice'] as const).map((cls) => (
                    <button
                      key={cls}
                      type="button"
                      onClick={() => setVesselClass(cls)}
                      className={`py-1.5 px-2 rounded text-[10px] font-semibold border transition-all ${
                        vesselClass === cls
                          ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-200 shadow-sm shadow-cyan-500/20'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {cls === 'Arc7' ? '🛡️ Arc7' : cls === 'Arc4' ? '🚢 Arc4' : '⚓ Non-Ice'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 pt-1">
              <button
                className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-600 py-2.5 rounded-md text-xs font-semibold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-cyan-600/20"
                disabled={!selectedDeparture || !selectedArrival || routeStatus === 'loading'}
                onClick={calculateRoute}
              >
                <Navigation className="w-3.5 h-3.5" />
                {routeStatus === 'loading' ? 'Calculating routes...' : 'Calculate / Update Route'}
              </button>

              {(selectedDeparture || selectedArrival || currentRoute) && (
                <button
                  type="button"
                  className="w-full border border-slate-800 hover:border-amber-500/40 text-slate-400 hover:text-amber-300 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center justify-center gap-2"
                  onClick={cancelRoute}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Clear Voyage / Reset
                </button>
              )}
            </div>

            {routeStatus === 'success' && <p className="text-[10px] text-emerald-400 font-semibold">✓ Routes calculated for selected voyage</p>}
            {routeStatus === 'error' && <p className="text-[10px] text-red-400">{routeError || 'Unable to calculate routes. Please try again.'}</p>}

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/40">
              <button
                type="button"
                onClick={exportRouteReport}
                disabled={!currentRoute}
                className="w-full rounded-md border border-cyan-500/30 bg-cyan-500/5 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-cyan-300 disabled:opacity-50"
              >
                Export Report
              </button>
              <button
                type="button"
                onClick={() => setIsSimulationActive((value) => !value)}
                disabled={!currentRoute}
                className="w-full rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-emerald-300 disabled:opacity-50"
              >
                {isSimulationActive ? 'Pause Sim' : 'Run Sim'}
              </button>
            </div>

            {currentRoute && (
              <div className="rounded-md border border-slate-800 bg-slate-950/50 p-2.5">
                <div className="flex items-center justify-between text-[9px] uppercase tracking-wide text-slate-500">
                  <span>Simulation speed</span>
                  <span>{simulationSpeed}x</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="4"
                  step="1"
                  value={simulationSpeed}
                  onChange={(event) => setSimulationSpeed(Number(event.target.value))}
                  className="mt-2 w-full accent-cyan-500"
                />
              </div>
            )}
          </div>
        </section>

        <WeatherPanel label="Source" port={selectedDeparture} observation={sourceWeather} status={sourceWeatherStatus} error={sourceWeatherError} />
        <WeatherPanel label="Destination" port={selectedArrival} observation={destinationWeather} status={destinationWeatherStatus} error={destinationWeatherError} />

        {/* Route results */}
        {routes.length > 0 && (
          <section className="rounded-lg bg-slate-900/50 border border-cyan-500/15 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-800/40 flex items-center justify-between">
              <div>
                <h2 className="text-[11px] font-semibold text-slate-300">Routes</h2>
                <p className="text-[9px] text-slate-600 mt-0.5">{routes.length} live planning options</p>
              </div>
              <span className="text-[9px] font-mono text-cyan-500">MAP: LIVE</span>
            </div>

            <div className="px-3 pt-3">
              <div className="flex flex-wrap gap-1.5">
                {(['all', 'shortest', 'safest', 'fuel-efficient'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setRouteFilter(option)}
                    className={`rounded-full border px-2 py-1 text-[9px] uppercase tracking-wide transition-colors ${
                      routeFilter === option
                        ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200'
                        : 'border-slate-700 bg-slate-950/40 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    {option === 'all' ? 'All' : option}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-2 space-y-1.5">
              {visibleRoutes.map((route, routeIndex) => {
                const isSelected = route.id === selectedRouteId;
                const color = routeColors[route.strategy || 'shortest'] || '#94a3b8';
                return (
                  <button
                    key={route.id}
                    type="button"
                    onClick={() => selectRoute(route.id)}
                    aria-label={`${isSelected ? 'Selected Route' : 'Select Route'} ${routeIndex + 1}: ${route.label || 'Route'}`}
                    className={`w-full text-left rounded-md border px-2.5 py-2 transition-colors ${
                      isSelected ? 'bg-slate-800/80 border-cyan-500/30' : 'bg-slate-950/40 border-slate-800/40 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-200">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                        <span>Route {routeIndex + 1} · {route.label || 'Route'}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-[9px] text-slate-500 uppercase">{route.strategy || 'optimal'}</span>
                        <RiskBadge level={route.riskLevel} size="sm" />
                      </span>
                    </div>
                    <div className="mt-1.5 grid grid-cols-3 text-[9px] font-mono text-slate-500">
                      <span>{route.distance} km</span>
                      <span className="col-span-2" aria-label={`ETA ${formatDuration(route.estimatedTimeMinutes)}`}>
                        ETA {formatDurationHours(route.estimatedTimeMinutes)} · {formatDuration(route.estimatedTimeMinutes)}
                      </span>
                      <span className="text-right">{route.fuelEstimate ?? '—'}t fuel</span>
                    </div>
                    <div className="mt-1 text-[9px]">
                      <span className={route.validation?.waterOnly ? 'text-emerald-400' : 'text-red-400'}>
                        {route.validation?.waterOnly ? '✓ Water Only' : 'Water validation failed'}
                      </span>
                      <span className="ml-2 text-cyan-400">{isSelected ? 'Selected Route' : 'Select Route'}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {routeComparisonData.length > 0 && (
          <section className="rounded-lg bg-slate-900/50 border border-slate-800/40 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-800/40 flex items-center justify-between">
              <h2 className="text-[11px] font-semibold text-slate-300">Route Analytics</h2>
              <span className="text-[9px] font-mono text-cyan-500">LIVE OPS</span>
            </div>
            <div className="p-3 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {routeHighlights.map((item) => (
                  <div key={item.label} className="rounded-md border border-slate-800 bg-slate-950/40 p-2">
                    <div className="text-[9px] uppercase tracking-wide text-slate-500">{item.label}</div>
                    <div className={`mt-1 text-sm font-semibold ${item.accent}`}>{item.value}</div>
                  </div>
                ))}
              </div>

              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={routeComparisonData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 9 }} interval={0} angle={-15} textAnchor="end" height={40} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 9 }} />
                    <Tooltip />
                    <Bar dataKey="distance" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="h-28">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={routeComparisonData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="routeRiskFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.7} />
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0.1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 9 }} interval={0} angle={-15} textAnchor="end" height={40} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 9 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="risk" stroke="#f97316" fill="url(#routeRiskFill)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
        )}

        {riskTimelineData.length > 0 && (
          <section className="rounded-lg bg-slate-900/50 border border-slate-800/40 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-800/40 flex items-center justify-between">
              <h2 className="text-[11px] font-semibold text-slate-300">Risk Timeline</h2>
              <span className="text-[9px] font-mono text-amber-400">LIVE RISK</span>
            </div>
            <div className="h-32 p-3">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={riskTimelineData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="timelineFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.7} />
                      <stop offset="95%" stopColor="#22d3ee" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 9 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 9 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="risk" stroke="#22d3ee" fill="url(#timelineFill)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {ships.length > 0 && (
          <section className="rounded-lg bg-slate-900/50 border border-slate-800/40 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-800/40 flex items-center justify-between">
              <h2 className="text-[11px] font-semibold text-slate-300">Vessel Tracking</h2>
              <span className="text-[9px] font-mono text-emerald-400">REAL-TIME</span>
            </div>
            <div className="p-2 space-y-2">
              {ships.map((ship) => (
                <div key={ship.id} className="rounded-md border border-slate-800 bg-slate-950/40 p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-white">{ship.name}</span>
                    <span className="text-[9px] uppercase text-emerald-400">{ship.status}</span>
                  </div>
                  <div className="mt-1 grid grid-cols-2 gap-1 text-[9px] text-slate-400">
                    <span>Speed <strong className="text-slate-200">{ship.speed.toFixed(1)} kn</strong></span>
                    <span>Heading <strong className="text-slate-200">{ship.heading.toFixed(0)}°</strong></span>
                    <span>Risk <strong className="text-slate-200">{ship.riskScore}</strong></span>
                    <span>ETA <strong className="text-slate-200">{ship.eta}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {currentRoute && !selectedShip && !selectedIceberg && (
          <div className="space-y-3">

            {/* Route header & Quick Actions */}
            <div className="rounded-lg bg-slate-900/80 border border-slate-800 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-white">
                  <span>{currentRoute.departure.name}</span>
                  <button
                    type="button"
                    onClick={swapPorts}
                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1"
                    title="Swap Departure & Arrival Ports"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                  </button>
                  <span>{currentRoute.arrival.name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsEditingRoute(!isEditingRoute)}
                    className="px-2 py-1 text-[10px] font-semibold bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 rounded border border-cyan-500/30 transition-colors"
                    title="Change departure or destination port"
                  >
                    {isEditingRoute ? 'Hide Form' : '✏️ Change Ports'}
                  </button>
                  <button
                    type="button"
                    onClick={calculateRoute}
                    className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                    title="Recalculate with new conditions"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Active Route Strategy Switcher Bar */}
            {routes.length > 0 && (
              <div className="rounded-lg bg-slate-900/90 border border-cyan-500/30 p-3 space-y-2.5 shadow-lg shadow-cyan-950/30">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-cyan-400" />
                    Select / Switch Route Strategy
                  </span>
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                    {routes.length} ROUTES AVAILABLE
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {routes.map((route, routeIndex) => {
                    const isSelected = route.id === selectedRouteId;
                    const color = routeColors[route.strategy || 'shortest'] || '#38bdf8';
                    return (
                      <button
                        key={route.id}
                        type="button"
                        onClick={() => selectRoute(route.id)}
                        className={`p-2 rounded-md border text-left transition-all ${
                          isSelected
                            ? 'bg-cyan-500/25 border-cyan-400 text-white shadow-md shadow-cyan-500/25 ring-1 ring-cyan-400'
                            : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 text-[10px] font-semibold">
                          <span className="flex items-center gap-1.5 truncate">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                            <span className="truncate">{route.label || `Route ${routeIndex + 1}`}</span>
                          </span>
                          <RiskBadge level={route.riskLevel} size="sm" />
                        </div>
                        <div className="mt-1 flex justify-between items-center text-[9px] font-mono text-slate-400">
                          <span>{route.distance} km</span>
                          <span>{route.fuelEstimate ?? '—'}t fuel</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Telemetry */}
            <section className="rounded-lg bg-slate-900/50 border border-slate-800/40 overflow-hidden">
              <button
                onClick={() => toggleSection('telemetry')}
                className="w-full px-4 py-2.5 border-b border-slate-800/40 flex justify-between items-center hover:bg-slate-800/20 transition-colors"
              >
                <span className="text-[11px] font-semibold text-slate-400">Route Summary</span>
                <div className="flex items-center gap-2">
                  <RiskBadge level={currentRoute.riskLevel} />
                  {sectionsOpen.telemetry ? <ChevronUp className="w-3 h-3 text-slate-600" /> : <ChevronDown className="w-3 h-3 text-slate-600" />}
                </div>
              </button>
              {sectionsOpen.telemetry && (
                <div className="p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-slate-950/60 rounded-md p-2.5">
                      <span className="text-[9px] text-slate-600 uppercase font-medium block">Distance</span>
                      <span className="text-sm font-semibold text-white">{currentRoute.distance} <span className="text-[10px] text-slate-500">km</span></span>
                    </div>
                    <div className="bg-slate-950/60 rounded-md p-2.5">
                      <span className="text-[9px] text-slate-600 uppercase font-medium block">Est. Time</span>
                      <span className="text-sm font-semibold text-white">
                        {formatDuration(currentRoute.estimatedTimeMinutes)}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        ({formatDurationHours(currentRoute.estimatedTimeMinutes)})
                      </span>
                    </div>
                    <div className="bg-slate-950/60 rounded-md p-2.5 flex items-center gap-2">
                      <Fuel className="w-3.5 h-3.5 text-amber-500/60" />
                      <div>
                        <span className="text-[9px] text-slate-600 uppercase font-medium block">Fuel Est.</span>
                        <span className="text-sm font-semibold text-white">{currentRoute.fuelEstimate} <span className="text-[10px] text-slate-500">tons</span></span>
                      </div>
                    </div>
                    <div className="bg-slate-950/60 rounded-md p-2.5 flex items-center gap-2">
                      <Gauge className="w-3.5 h-3.5 text-cyan-500/60" />
                      <div>
                        <span className="text-[9px] text-slate-600 uppercase font-medium block">Avg Speed</span>
                        <span className="text-sm font-semibold text-white">{currentRoute.avgSpeed} <span className="text-[10px] text-slate-500">kn</span></span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-600 px-1">
                    <span>{currentRoute.coordinates.length} waypoints</span>
                    <span>•</span>
                    <span>{currentRoute.icebergs?.length || 0} icebergs detected</span>
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-lg bg-slate-900/50 border border-cyan-500/20 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-800/40 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-300">Selected Route Conditions</span>
                <span className={monitoringStatus === 'live' ? 'text-[9px] text-emerald-400' : 'text-[9px] text-amber-400'}>
                  {monitoringStatus === 'loading' ? '● REFRESHING' : monitoringStatus === 'live' ? '● LIVE' : '● DATA STALE'}
                </span>
              </div>
              <div className="p-3 space-y-2 text-[10px]">
                <div className="flex justify-between text-slate-300"><span>{currentRoute.label || 'Route'}</span><span className="uppercase text-slate-500">{currentRoute.strategy || 'optimal'}</span></div>
                <div className="grid grid-cols-2 gap-2 text-slate-400">
                  <span>Distance <strong className="text-white">{currentRoute.distance} km</strong></span>
                  <span>ETA <strong className="text-white">{formatDurationHours(currentRoute.estimatedTimeMinutes)}</strong></span>
                  <span>Fuel <strong className="text-white">{currentRoute.fuelEstimate ?? 'N/A'} tons</strong></span>
                  <span>Risk <strong className="text-white">{routeMonitoring?.risk.riskLevel || currentRoute.riskLevel}</strong></span>
                  <span>Water Only <strong className="text-emerald-400">{currentRoute.validation?.waterOnly ? '✓' : 'N/A'}</strong></span>
                  <span>Updated <strong className="text-white">{routeMonitoring ? new Date(routeMonitoring.lastUpdated).toLocaleTimeString() : 'N/A'}</strong></span>
                </div>
                <div className="border-t border-slate-800/40 pt-2 grid grid-cols-2 gap-2 text-slate-400">
                  <span>Temperature <strong className="text-white">{routeMonitoring && routeMonitoring.samples.some((sample) => sample.temperature !== null) ? `${currentRoute.weatherConditions.temperature.toFixed(1)} °C` : 'N/A'}</strong></span>
                  <span>Wind <strong className="text-white">{routeMonitoring && routeMonitoring.samples.some((sample) => sample.windSpeed !== null) ? `${currentRoute.weatherConditions.windSpeed.toFixed(0)} km/h` : 'N/A'}</strong></span>
                  <span>Visibility <strong className="text-white">{routeMonitoring && routeMonitoring.samples.some((sample) => sample.visibility !== 'UNAVAILABLE') ? currentRoute.weatherConditions.visibility : 'N/A'}</strong></span>
                  <span>Waves <strong className="text-white">{routeMonitoring && routeMonitoring.samples.some((sample) => sample.waveHeight !== null) ? `${currentRoute.weatherConditions.waveHeight.toFixed(1)} m` : 'N/A'}</strong></span>
                  <span>Sea ice <strong className="text-white">N/A</strong></span>
                  <span>Iceberg risk <strong className="text-white">N/A</strong></span>
                  <span>Traffic density <strong className="text-white">N/A</strong></span>
                </div>
                {monitoringError && <p className="text-amber-300">Unable to refresh environmental data. Showing last successful update.</p>}
                {monitoringWarning && <p className="text-amber-300">{monitoringWarning}</p>}
                <button type="button" onClick={() => void refreshSelectedRouteConditions()} disabled={monitoringStatus === 'loading'} className="inline-flex items-center gap-1 border border-cyan-500/30 px-2 py-1 text-cyan-300 rounded disabled:opacity-50">
                  <RefreshCw className="w-3 h-3" /> Refresh Conditions
                </button>
                {routeMonitoring?.risk.warnings.map((warning) => <p key={warning} className="text-amber-300">{warning}</p>)}
                {routeMonitoring && (
                  <div className="border-t border-slate-800/40 pt-2 text-slate-400">
                    <div className="text-slate-500 uppercase mb-1">Risk factors</div>
                    <div className="grid grid-cols-2 gap-1">
                      {Object.entries(routeMonitoring.risk.factors).map(([factor, value]) => <span key={factor}>{factor}: <strong className="text-slate-200">{value}</strong></span>)}
                    </div>
                    <div className="mt-1 text-slate-300">Overall risk: <strong>{routeMonitoring.risk.riskLevel}</strong></div>
                  </div>
                )}
                {selectedCondition && (
                  <div className="border-t border-slate-800/40 pt-2 text-slate-300">
                    <div className="font-semibold">Condition marker · {selectedCondition.condition}</div>
                    <div>{selectedCondition.temperature === null ? 'N/A' : `${selectedCondition.temperature.toFixed(1)} °C`} · {selectedCondition.windSpeed === null ? 'N/A' : `${selectedCondition.windSpeed.toFixed(0)} km/h`} · {selectedCondition.waveHeight === null ? 'N/A' : `${selectedCondition.waveHeight.toFixed(1)} m`} · {selectedCondition.visibility || 'N/A'} · Sea ice N/A · Iceberg N/A · Risk {selectedCondition.riskScore === null ? 'N/A' : selectedCondition.riskScore}</div>
                    <div className="text-slate-500">Updated {new Date(selectedCondition.timestamp).toLocaleString()}</div>
                  </div>
                )}
              </div>
            </section>

            {/* Weather */}
            <section className="rounded-lg bg-slate-900/50 border border-slate-800/40 overflow-hidden">
              <button
                onClick={() => toggleSection('weather')}
                className="w-full px-4 py-2.5 border-b border-slate-800/40 flex justify-between items-center hover:bg-slate-800/20 transition-colors"
              >
                <span className="text-[11px] font-semibold text-slate-400">Weather Conditions</span>
                {sectionsOpen.weather ? <ChevronUp className="w-3 h-3 text-slate-600" /> : <ChevronDown className="w-3 h-3 text-slate-600" />}
              </button>
              {sectionsOpen.weather && (
                <div className="p-3 space-y-3">
                  {/* Forecast banner */}
                  <div className="bg-slate-950/60 rounded-md px-3 py-2 flex items-center justify-between">
                    <span className="text-xs text-slate-300">{currentRoute.weatherConditions.forecast}</span>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${
                      currentRoute.weatherConditions.visibility === 'Good' ? 'bg-emerald-500/10 text-emerald-400' :
                      currentRoute.weatherConditions.visibility === 'Moderate' ? 'bg-amber-500/10 text-amber-400' :
                      'bg-red-500/10 text-red-400'
                    }`}>
                      {currentRoute.weatherConditions.visibility} vis.
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-slate-950/60 rounded-md p-2 text-center">
                      <Thermometer className="w-3.5 h-3.5 text-orange-400/60 mx-auto mb-1" />
                      <span className="text-xs font-mono text-white block">{currentRoute.weatherConditions.temperature.toFixed(1)}°C</span>
                      <span className="text-[8px] text-slate-600 uppercase">Temp</span>
                    </div>
                    <div className="bg-slate-950/60 rounded-md p-2 text-center">
                      <Wind className="w-3.5 h-3.5 text-blue-400/60 mx-auto mb-1" />
                      <span className="text-xs font-mono text-white block">{currentRoute.weatherConditions.windSpeed.toFixed(0)} kn</span>
                      <span className="text-[8px] text-slate-600 uppercase">Wind</span>
                    </div>
                    <div className="bg-slate-950/60 rounded-md p-2 text-center">
                      <Waves className="w-3.5 h-3.5 text-cyan-400/60 mx-auto mb-1" />
                      <span className="text-xs font-mono text-white block">{currentRoute.weatherConditions.waveHeight.toFixed(1)}m</span>
                      <span className="text-[8px] text-slate-600 uppercase">Waves</span>
                    </div>
                  </div>

                  {/* Ice concentration */}
                  <div>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-slate-500">Sea ice concentration</span>
                      <span className={`font-mono font-medium ${
                        currentRoute.weatherConditions.seaIceConcentration > 70 ? 'text-red-400' :
                        currentRoute.weatherConditions.seaIceConcentration > 40 ? 'text-amber-400' : 'text-emerald-400'
                      }`}>
                        {currentRoute.weatherConditions.seaIceConcentration.toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          currentRoute.weatherConditions.seaIceConcentration > 70 ? 'bg-red-500' :
                          currentRoute.weatherConditions.seaIceConcentration > 40 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${currentRoute.weatherConditions.seaIceConcentration}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Traffic */}
            <section className="rounded-lg bg-slate-900/50 border border-slate-800/40 overflow-hidden">
              <button
                onClick={() => toggleSection('traffic')}
                className="w-full px-4 py-2.5 border-b border-slate-800/40 flex justify-between items-center hover:bg-slate-800/20 transition-colors"
              >
                <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                  <Users className="w-3 h-3" /> Traffic
                </span>
                {sectionsOpen.traffic ? <ChevronUp className="w-3 h-3 text-slate-600" /> : <ChevronDown className="w-3 h-3 text-slate-600" />}
              </button>
              {sectionsOpen.traffic && (
                <div className="p-3 grid grid-cols-3 gap-2 text-center">
                  <div className="bg-slate-950/60 rounded-md p-2">
                    <span className="text-sm font-semibold text-white block">{currentRoute.ships?.length || 0}</span>
                    <span className="text-[8px] text-slate-600 uppercase">Vessels</span>
                  </div>
                  <div className="bg-slate-950/60 rounded-md p-2">
                    <span className="text-sm font-semibold text-red-400 block">{currentRoute.icebergs?.length || 0}</span>
                    <span className="text-[8px] text-slate-600 uppercase">Icebergs</span>
                  </div>
                  <div className="bg-slate-950/60 rounded-md p-2">
                    <span className="text-sm font-semibold text-amber-400 block">{currentRoute.trafficCongestion.toFixed(0)}%</span>
                    <span className="text-[8px] text-slate-600 uppercase">Congestion</span>
                  </div>
                </div>
              )}
            </section>

            {/* Alternative Routes */}
            {currentRoute.alternativeRoutes.length > 0 && (
              <section className="rounded-lg bg-slate-900/50 border border-slate-800/40 overflow-hidden">
                <button
                  onClick={() => toggleSection('alternatives')}
                  className="w-full px-4 py-2.5 border-b border-slate-800/40 flex justify-between items-center hover:bg-slate-800/20 transition-colors"
                >
                  <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                    <ArrowRightLeft className="w-3 h-3" /> Route Comparison
                  </span>
                  {sectionsOpen.alternatives ? <ChevronUp className="w-3 h-3 text-slate-600" /> : <ChevronDown className="w-3 h-3 text-slate-600" />}
                </button>
                {sectionsOpen.alternatives && (
                  <div className="p-3">
                    <table className="w-full text-[10px]">
                      <thead>
                        <tr className="text-slate-600 uppercase">
                          <th className="text-left pb-2 font-medium">Route</th>
                          <th className="text-right pb-2 font-medium">Dist</th>
                          <th className="text-right pb-2 font-medium">Time</th>
                          <th className="text-right pb-2 font-medium">Fuel</th>
                          <th className="text-right pb-2 font-medium">Risk</th>
                          <th className="text-right pb-2 font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/30">
                        {/* Primary route */}
                        <tr className="text-white bg-cyan-500/10 font-semibold">
                          <td className="py-2 font-medium text-cyan-300">Active (Primary)</td>
                          <td className="py-2 text-right font-mono">{currentRoute.distance} km</td>
                          <td className="py-2 text-right font-mono" aria-label={`ETA ${formatDuration(currentRoute.estimatedTimeMinutes)}`}>
                            {formatDurationHours(currentRoute.estimatedTimeMinutes)}
                          </td>
                          <td className="py-2 text-right font-mono">{currentRoute.fuelEstimate}t</td>
                          <td className="py-2 text-right"><RiskBadge level={currentRoute.riskLevel} size="sm" /></td>
                          <td className="py-2 text-right text-[9px] text-emerald-400 font-mono">SELECTED</td>
                        </tr>
                        {currentRoute.alternativeRoutes.map((alt, i) => {
                          const matchedRoute = routes.find((r) => r.strategy === alt.strategy || Math.abs(r.distance - alt.distance) < 5);
                          return (
                            <tr
                              key={i}
                              onClick={() => matchedRoute && selectRoute(matchedRoute.id)}
                              className="text-slate-400 hover:text-white hover:bg-slate-800/40 cursor-pointer transition-colors"
                            >
                              <td className="py-2 font-medium capitalize text-slate-300">{alt.name || alt.strategy || `Alt ${i + 1}`}</td>
                              <td className="py-2 text-right font-mono">{Math.round(alt.distance)} km</td>
                              <td className="py-2 text-right font-mono" aria-label={`ETA ${formatDuration(alt.estimatedTimeMinutes)}`}>
                                {formatDurationHours(alt.estimatedTimeMinutes)}
                              </td>
                              <td className="py-2 text-right font-mono">{alt.fuelConsumption || '—'}t</td>
                              <td className="py-2 text-right"><RiskBadge level={alt.riskLevel} size="sm" /></td>
                              <td className="py-2 text-right">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (matchedRoute) selectRoute(matchedRoute.id);
                                  }}
                                  className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20"
                                >
                                  Switch
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {/* Alerts */}
            {currentRoute.alerts.length > 0 && (
              <section className="rounded-lg bg-slate-900/50 border border-red-500/15 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-red-500/15 flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3 text-red-500" />
                  <span className="text-[11px] font-semibold text-red-400">
                    Alerts ({currentRoute.alerts.length})
                  </span>
                </div>
                <div className="p-2 space-y-1 max-h-32 overflow-y-auto">
                  {currentRoute.alerts.map((alert, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 px-2.5 py-2 rounded-md bg-slate-950/50"
                    >
                      <div className={`w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0 ${
                        alert.severity === 'High' ? 'bg-red-400' :
                        alert.severity === 'Medium' ? 'bg-amber-400' : 'bg-slate-400'
                      }`} />
                      <div>
                        <span className="text-[10px] text-slate-300 block">{alert.message}</span>
                        <span className="text-[9px] text-slate-600">
                          {alert.severity} • {alert.type} • {alert.timeToImpact}h
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* Ship Inspector */}
        {selectedShip && (
          <div className="rounded-lg bg-slate-900/50 border border-blue-500/20 p-3 space-y-2">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-1.5">
                <ShipIcon className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-[10px] font-semibold text-blue-400 uppercase">Vessel</span>
              </div>
              <button onClick={() => setSelectedShip(null)} className="text-slate-600 hover:text-white text-xs">✕</button>
            </div>
            <p className="text-sm font-semibold text-white">{selectedShip.name}</p>
            <div className="space-y-1 text-[10px]">
              {[
                ['Cargo', selectedShip.cargoType],
                ['Speed', `${selectedShip.speed.toFixed(1)} kn`],
                ['Heading', `${selectedShip.heading.toFixed(0)}°`],
                ['Status', selectedShip.status],
                ['Destination', selectedShip.destination],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-slate-600">{k}</span>
                  <span className="text-slate-300 font-mono">{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Iceberg Inspector */}
        {selectedIceberg && (
          <div className="rounded-lg bg-slate-900/50 border border-red-500/20 p-3 space-y-2">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                <span className="text-[10px] font-semibold text-red-400 uppercase">Iceberg</span>
              </div>
              <button onClick={() => setSelectedIceberg(null)} className="text-slate-600 hover:text-white text-xs">✕</button>
            </div>
            <p className="text-sm font-semibold text-white">{selectedIceberg.name}</p>
            <div className="space-y-1 text-[10px]">
              {[
                ['Size', selectedIceberg.size],
                ['Drift', `${selectedIceberg.driftSpeed.toFixed(1)} kn`],
                ['Collision risk', `${selectedIceberg.riskProbability.toFixed(0)}%`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-slate-600">{k}</span>
                  <span className="text-slate-300 font-mono">{v}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-500">{selectedIceberg.description}</p>
            <div className="w-full bg-slate-950 h-1 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${selectedIceberg.riskProbability > 70 ? 'bg-red-500' : selectedIceberg.riskProbability > 40 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                style={{ width: `${selectedIceberg.riskProbability}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* MAP */}
      <div className="flex-1 relative">
        <div ref={mapRef} className="absolute inset-0" />

        <div className="absolute top-4 right-4 flex items-center gap-0.5 bg-slate-950/90 border border-slate-800/60 p-1 rounded-lg z-[1001] shadow-lg shadow-black/20" role="group" aria-label="Route risk level">
          {(['LOW', 'MEDIUM', 'HIGH'] as const).map((riskLevel) => {
            const currentRisk = (routeMonitoring?.risk.riskLevel || currentRoute?.riskLevel || 'Low').toUpperCase();
            const selected = riskLevel === 'HIGH' ? currentRisk === 'HIGH' || currentRisk === 'CRITICAL' : currentRisk === riskLevel;
            return (
              <span
                key={riskLevel}
                className={`px-2.5 py-1.5 rounded-md text-[9px] font-semibold tracking-wider ${selected ? riskLevel === 'HIGH' ? 'bg-red-500/20 text-red-300' : riskLevel === 'MEDIUM' ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300' : 'text-slate-500'}`}
              >
                {riskLevel}
              </span>
            );
          })}
        </div>

        {/* Legend */}
        <div className="absolute bottom-5 right-5 flex gap-3 bg-slate-950/85 border border-slate-800/50 px-3 py-2 rounded-lg z-[1001]">
          {[
            { color: 'bg-emerald-500', label: 'Port' },
            { color: 'bg-red-500', label: 'Iceberg' },
            { color: 'bg-blue-500', label: 'Vessel' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5 text-[9px] font-medium text-slate-500">
              <div className={`w-2 h-2 rounded-full ${item.color}`} />
              {item.label}
            </div>
          ))}
        </div>

        {/* Route info overlay */}
        {currentRoute && (
          <div className="absolute top-4 right-4 max-w-[calc(100%-2rem)] bg-slate-950/85 border border-slate-800/50 px-3 py-2 rounded-lg z-[1001]">
            <div className="flex items-center gap-2 text-xs">
              <Eye className="w-3 h-3 text-slate-500" />
              <span className="text-slate-400">
                {currentRoute.departure.name} → {currentRoute.arrival.name}
              </span>
              <RiskBadge level={currentRoute.riskLevel} size="sm" />
            </div>
            <div className="mt-1 text-[9px] font-mono text-slate-600">
              {websocketConnected ? 'SOCKET CONNECTED' : 'SOCKET UNAVAILABLE'} · {apiStatus === 'connected' ? 'API CONNECTED' : 'LIVE DATA UNAVAILABLE'}
              {lastUpdated ? ` · ${new Date(lastUpdated).toLocaleTimeString()}` : ''}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
