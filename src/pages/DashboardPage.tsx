import React, { useEffect, useRef, useState } from 'react';
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
  Ship as ShipIcon,
  Navigation,
  AlertTriangle,
  Thermometer,
  Map as MapIcon,
  Fuel,
  Gauge,
  RefreshCw,
  ArrowLeft,
  Crosshair,
  ArrowRightLeft,
  RotateCcw,
  ShieldAlert,
  Compass,
  BarChart3,
  CloudSun,
  Activity,
  CheckCircle2,
  FileDown,
  Play,
  Pause,
  X,
} from 'lucide-react';
import { useStore } from '../store';
import { Iceberg, Port, Ship as ShipType } from '../types';
import RiskBadge from '../components/RiskBadge';
import { generateRoutePDF } from '../utils/pdfReport';
import { getRiskColor } from '../riskUtils';

const routeColors: Record<string, string> = {
  shortest: '#38bdf8',
  safest: '#34d399',
  'fuel-efficient': '#fbbf24',
  'weather-optimized': '#a78bfa',
  'low-sea-ice': '#22d3ee',
  'low-traffic': '#fb7185',
};

function weatherCondition(code?: number): string {
  if (code === undefined) return 'Unavailable';
  if (code === 0) return 'Clear skies';
  if (code <= 3) return 'Partly cloudy';
  if (code <= 48) return 'Polar fog';
  if (code <= 57) return 'Drizzle';
  if (code <= 67) return 'Freezing rain';
  if (code <= 77) return 'Snow fall';
  if (code <= 82) return 'Snow showers';
  return 'Arctic storm';
}

function windDirection(degrees?: number): string {
  if (degrees === undefined) return '—';
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(degrees / 45) % 8] || '—';
}

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
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h ${remainingMinutes}m`;
}

function formatDurationHours(minutes: number): string {
  return `${(minutes / 60).toFixed(1)} h`;
}

interface DashboardPageProps {
  onNavigate: (page: 'home' | 'dashboard' | 'results') => void;
}

type SidebarTab = 'voyage' | 'weather' | 'hazards';

const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const baseLayerRef = useRef<TileLayer | null>(null);
  const routeLayerRef = useRef<VectorLayer | null>(null);

  // Tab State: 'voyage' | 'weather' | 'hazards'
  const [activeTab, setActiveTab] = useState<SidebarTab>('voyage');

  // Inspection states
  const [selectedIceberg, setSelectedIceberg] = useState<Iceberg | null>(null);
  const [selectedShip, setSelectedShip] = useState<ShipType | null>(null);
  const [hoverData, setHoverData] = useState<{ lat: string; lon: string } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Map overlays toggles
  const [mapOverlays, setMapOverlays] = useState({ traffic: true, icebergs: true });

  // Simulation state
  const [isSimulationActive, setIsSimulationActive] = useState(false);
  const [simulationProgress, setSimulationProgress] = useState(0);
  const [simulationSpeed, setSimulationSpeed] = useState(1);

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
    routes,
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
    cancelRoute,
    refreshSelectedRouteConditions,
    calculateRoute,
    selectRoute,
    websocketConnected,
  } = useStore();

  // Reset simulation when route changes
  useEffect(() => {
    setSimulationProgress(0);
  }, [selectedRouteId]);

  // Weather fetch for departure/arrival
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

  // Periodic weather refresh for active route
  useEffect(() => {
    if (!selectedRouteId) return;
    void refreshSelectedRouteConditions();
    const interval = Number(import.meta.env.VITE_WEATHER_REFRESH_INTERVAL_MS || 60000);
    const timer = window.setInterval(() => void refreshSelectedRouteConditions(), interval);
    return () => window.clearInterval(timer);
  }, [refreshSelectedRouteConditions, selectedRouteId]);

  // Simulation ticker
  useEffect(() => {
    if (!currentRoute || !isSimulationActive) return;
    const interval = window.setInterval(() => {
      setSimulationProgress((prev) => (prev >= 100 ? 0 : prev + simulationSpeed * 3));
    }, 150);
    return () => window.clearInterval(interval);
  }, [currentRoute, isSimulationActive, simulationSpeed]);

  // Initialize Map
  useEffect(() => {
    if (!mapRef.current) return;

    const map = new Map({
      target: mapRef.current,
      layers: [],
      view: new View({ center: fromLonLat([90, 70]), zoom: 3.2 }),
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
        }
      } else {
        setSelectedIceberg(null);
        setSelectedShip(null);
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
          lat: lonLat[1].toFixed(3) + '°',
          lon: lonLat[0].toFixed(3) + '°',
        });
        map.getTargetElement().style.cursor = 'crosshair';
      } else {
        setHoverData(null);
        map.getTargetElement().style.cursor = feature ? 'pointer' : '';
      }
    });

    mapInstanceRef.current = map;

    return () => {
      map.setTarget(undefined);
    };
  }, []);

  // Update Vector Layer Features
  useEffect(() => {
    if (!mapInstanceRef.current || !routeLayerRef.current) return;

    const features: Feature[] = [];
    const validRoutes = routes.filter(
      (route) => route && route.id && Array.isArray(route.coordinates) && route.coordinates.length >= 2
    );

    // Draw Ports
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
            backgroundFill: new Fill({ color: 'rgba(2, 6, 23, 0.85)' }),
            padding: [2, 5, 2, 5],
          }),
        })
      );
      features.push(feature);
    });

    // Draw Source & Destination Markers
    const addLocationMarker = (port: Port | null, label: string, color: string) => {
      if (!port) return;
      const feature = new Feature({
        geometry: new Point(fromLonLat([port.longitude, port.latitude])),
        type: 'location-marker',
        data: port,
      });
      feature.setStyle(
        new Style({
          image: new Circle({
            radius: 9,
            fill: new Fill({ color }),
            stroke: new Stroke({ color: '#ffffff', width: 2.5 }),
          }),
          text: new Text({
            text: label,
            offsetY: -18,
            font: '800 11px Inter, sans-serif',
            fill: new Fill({ color: '#020617' }),
            backgroundFill: new Fill({ color: 'rgba(255, 255, 255, 0.95)' }),
            padding: [3, 6, 3, 6],
          }),
        })
      );
      features.push(feature);
    };

    addLocationMarker(selectedDeparture, 'ORIGIN', '#2563eb');
    addLocationMarker(selectedArrival, 'DESTINATION', '#ef4444');

    // Draw Route Polylines (Splitting at antimeridian to prevent wrap-around horizontal streaks)
    validRoutes.forEach((route) => {
      const isSelected = route.id === currentRoute?.id;
      const color = routeColors[route.strategy || 'shortest'] || getRiskColor(route.riskLevel);
      const rawCoords = route.coordinates.filter(
        (c) => Array.isArray(c) && c.length >= 2 && isValidCoordinate(c[0], c[1])
      ) as [number, number][];

      if (rawCoords.length < 2) return;

      const coordChains: [number, number][][] = [];
      let currentChain: [number, number][] = [rawCoords[0]!];
      for (let i = 1; i < rawCoords.length; i++) {
        const prev = rawCoords[i - 1]!;
        const curr = rawCoords[i]!;
        if (Math.abs(curr[0] - prev[0]) > 180) {
          coordChains.push(currentChain);
          currentChain = [curr];
        } else {
          currentChain.push(curr);
        }
      }
      if (currentChain.length > 0) coordChains.push(currentChain);

      coordChains.forEach((chain) => {
        if (chain.length < 2) return;
        const projected = chain.map((coordinate) => fromLonLat(coordinate));
        const routeFeature = new Feature({
          geometry: new LineString(projected),
          type: 'route-segment',
        });
        routeFeature.setStyle(
          new Style({
            stroke: new Stroke({
              color: isSelected ? '#06b6d4' : `${color}66`,
              width: isSelected ? 5 : 2.5,
              lineDash: isSelected ? undefined : [8, 6],
            }),
          })
        );
        features.push(routeFeature);
      });
    });

    // Draw Simulation Ship Marker
    if (currentRoute && isSimulationActive && currentRoute.coordinates.length > 1) {
      const validCoords = currentRoute.coordinates.filter(
        (c) => Array.isArray(c) && c.length >= 2 && isValidCoordinate(c[0], c[1])
      ) as [number, number][];

      if (validCoords.length > 1) {
        const idx = Math.min(
          validCoords.length - 1,
          Math.max(0, Math.round((simulationProgress / 100) * (validCoords.length - 1)))
        );
        const currentCoord = validCoords[idx];
        if (currentCoord) {
          const simMarker = new Feature({
            geometry: new Point(fromLonLat(currentCoord)),
            type: 'vessel-sim',
          });
          simMarker.setStyle(
            new Style({
              image: new Circle({
                radius: 8,
                fill: new Fill({ color: '#22c55e' }),
                stroke: new Stroke({ color: '#f0fdf4', width: 2.5 }),
              }),
              text: new Text({
                text: '🚢 VESSEL',
                offsetY: 16,
                fill: new Fill({ color: '#86efac' }),
                backgroundFill: new Fill({ color: 'rgba(2, 6, 23, 0.9)' }),
                padding: [2, 4, 2, 4],
                font: '700 9px Inter, sans-serif',
              }),
            })
          );
          features.push(simMarker);
        }
      }
    }

    // Draw AIS Vessels
    if (mapOverlays.traffic) {
      ships.forEach((ship) => {
        const feature = new Feature({
          geometry: new Point(fromLonLat([ship.longitude, ship.latitude])),
          type: 'ship',
          data: ship,
        });
        feature.setStyle(
          new Style({
            image: new Circle({
              radius: 6,
              fill: new Fill({ color: '#3b82f6' }),
              stroke: new Stroke({ color: '#1e3a5f', width: 1.5 }),
            }),
            text: new Text({
              text: ship.name,
              offsetY: 14,
              font: '600 9px Inter, sans-serif',
              fill: new Fill({ color: '#93c5fd' }),
              backgroundFill: new Fill({ color: 'rgba(2, 6, 23, 0.8)' }),
              padding: [1, 4, 1, 4],
            }),
          })
        );
        features.push(feature);
      });
    }

    // Draw Icebergs
    if (mapOverlays.icebergs) {
      icebergs.forEach((iceberg) => {
        const feature = new Feature({
          geometry: new Point(fromLonLat([iceberg.longitude, iceberg.latitude])),
          type: 'iceberg',
          data: iceberg,
        });
        feature.setStyle(
          new Style({
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
              backgroundFill: new Fill({ color: 'rgba(2, 6, 23, 0.8)' }),
              padding: [1, 3, 1, 3],
            }),
          })
        );
        features.push(feature);
      });
    }

    routeLayerRef.current.setSource(new VectorSource({ features }));
  }, [
    ports,
    ships,
    icebergs,
    routes,
    currentRoute,
    selectedRouteId,
    selectedDeparture,
    selectedArrival,
    isSimulationActive,
    simulationProgress,
    mapOverlays,
  ]);

  // Center & Fit Route Function
  const focusRouteOnMap = () => {
    if (!mapInstanceRef.current || !currentRoute) return;
    try {
      const routeCoordinates = currentRoute.coordinates
        .filter((coord) => Array.isArray(coord) && coord.length >= 2 && isValidCoordinate(coord[0], coord[1]))
        .map((coord) => fromLonLat(coord as [number, number]));
      if (routeCoordinates.length > 0) {
        mapInstanceRef.current.getView().fit(boundingExtent(routeCoordinates), {
          padding: [70, 70, 70, 70],
          maxZoom: 6,
          duration: 600,
        });
      }
    } catch (e) {
      console.warn('Map fit error:', e);
    }
  };

  // Export PDF Report handler
  const handleExportPDF = () => {
    if (!currentRoute) return;
    generateRoutePDF(routes.length > 0 ? routes : [currentRoute], currentRoute);
  };

  return (
    <div className="h-screen flex overflow-hidden bg-[#020617] pt-16 select-none">
      {/* Position Tooltip */}
      {hoverData && (
        <div
          className="fixed pointer-events-none bg-slate-950/95 border border-cyan-500/30 p-2 rounded-lg shadow-2xl z-[3000] backdrop-blur-md"
          style={{ left: mousePos.x + 16, top: mousePos.y - 36 }}
        >
          <div className="flex items-center gap-1.5 mb-0.5">
            <Crosshair className="w-3 h-3 text-cyan-400" />
            <span className="text-[9px] font-bold text-cyan-300 uppercase tracking-widest">Crosshair Nav</span>
          </div>
          <div className="flex gap-3 text-[10px] font-mono text-slate-300">
            <span>LAT: <strong className="text-white">{hoverData.lat}</strong></span>
            <span>LON: <strong className="text-white">{hoverData.lon}</strong></span>
          </div>
        </div>
      )}

      {/* =========================================================================
          RE-ARCHITECTED COMMAND SIDEBAR (Fixed layout, 3 Dedicated Useful Tabs)
          ========================================================================= */}
      <aside className="w-[380px] xl:w-[420px] flex-shrink-0 bg-slate-950/95 border-r border-slate-800/60 flex flex-col z-20 shadow-2xl overflow-hidden">
        {/* Top Header / Status Strip */}
        <div className="px-4 py-3 border-b border-slate-800/60 bg-slate-900/40 flex items-center justify-between flex-shrink-0">
          <button
            onClick={() => onNavigate('home')}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors group"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform text-cyan-400" />
            <span>Voyage Home</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">
              <span className={`w-1.5 h-1.5 rounded-full ${websocketConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              {websocketConnected ? 'LIVE FEED' : 'STANDBY'}
            </span>
          </div>
        </div>

        {/* 3 Unified Navigation Tabs */}
        <div className="grid grid-cols-3 p-1.5 bg-slate-900/60 border-b border-slate-800/60 flex-shrink-0 gap-1 text-[11px] font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('voyage')}
            className={`py-2 px-1 rounded-md transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'voyage'
                ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Navigation className="w-3.5 h-3.5 text-cyan-400" />
            <span>Voyage</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('weather')}
            className={`py-2 px-1 rounded-md transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'weather'
                ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <CloudSun className="w-3.5 h-3.5 text-amber-400" />
            <span>Metocean</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('hazards')}
            className={`py-2 px-1 rounded-md transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'hazards'
                ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span>Hazards</span>
            {icebergs.length > 0 && (
              <span className="text-[9px] bg-rose-500/20 text-rose-300 px-1 py-0.2 rounded-full border border-rose-500/30">
                {icebergs.length}
              </span>
            )}
          </button>
        </div>

        {/* Scrollable Tab Content Container */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 custom-scrollbar">
          {/* =========================================================================
              TAB 1: VOYAGE & ROUTE PLANNING
              ========================================================================= */}
          {activeTab === 'voyage' && (
            <>
              {/* Port & Vessel Configuration Card */}
              <section className="rounded-xl bg-slate-900/70 border border-slate-800/80 p-3.5 shadow-lg space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                  <div className="flex items-center gap-1.5">
                    <MapIcon className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-200">Voyage Configuration</span>
                  </div>
                  {currentRoute && (
                    <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                      ROUTE ACTIVE
                    </span>
                  )}
                </div>

                {/* Ports Selection with Swap button */}
                <div className="space-y-2">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Departure Port</label>
                      <button
                        type="button"
                        onClick={swapPorts}
                        disabled={!selectedDeparture && !selectedArrival}
                        className="text-[9px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 hover:underline disabled:opacity-30 font-bold"
                        title="Swap Origin and Destination Ports"
                      >
                        <ArrowRightLeft className="w-2.5 h-2.5" />
                        Swap
                      </button>
                    </div>
                    <select
                      className="w-full rounded-lg px-3 py-2 text-[12px] font-medium bg-slate-950 border border-slate-700/80 text-white outline-none focus:border-cyan-500 transition-colors"
                      value={selectedDeparture?.id || ''}
                      onChange={(e) => setDeparture(ports.find((p) => p.id === e.target.value) || null)}
                    >
                      <option value="">Select departure harbor...</option>
                      {ports.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.country})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Destination Port</label>
                    <select
                      className="w-full rounded-lg px-3 py-2 text-[12px] font-medium bg-slate-950 border border-slate-700/80 text-white outline-none focus:border-cyan-500 transition-colors"
                      value={selectedArrival?.id || ''}
                      onChange={(e) => setArrival(ports.find((p) => p.id === e.target.value) || null)}
                    >
                      <option value="">Select destination harbor...</option>
                      {ports.map((p) => (
                        <option key={p.id} value={p.id} disabled={p.id === selectedDeparture?.id}>
                          {p.name} ({p.country}) {p.id === selectedDeparture?.id ? '— (Origin)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Vessel Ice Class Selection */}
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Vessel Ice Class Rating</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['Arc7', 'Arc4', 'Non-Ice'] as const).map((cls) => (
                        <button
                          key={cls}
                          type="button"
                          onClick={() => setVesselClass(cls)}
                          className={`py-1.5 px-2 rounded-lg text-[10px] font-bold border transition-all ${
                            vesselClass === cls
                              ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200 shadow-sm shadow-cyan-500/25'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                          }`}
                        >
                          {cls === 'Arc7' ? '🛡️ Arc7 Heavy' : cls === 'Arc4' ? '🚢 Arc4 Med' : '⚓ Standard'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Primary Action Buttons */}
                <div className="space-y-1.5 pt-1">
                  <button
                    className={`w-full py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg ${
                      !selectedDeparture || !selectedArrival || selectedDeparture.id === selectedArrival.id || routeStatus === 'loading'
                        ? 'bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-cyan-600/30'
                    }`}
                    disabled={!selectedDeparture || !selectedArrival || selectedDeparture.id === selectedArrival.id || routeStatus === 'loading'}
                    onClick={() => calculateRoute()}
                  >
                    <Navigation className={`w-3.5 h-3.5 ${routeStatus === 'loading' ? 'animate-spin' : ''}`} />
                    {routeStatus === 'loading' ? 'Calculating 100% Water Routes...' : 'Calculate Optimal Route'}
                  </button>

                  {(selectedDeparture || selectedArrival || currentRoute) && (
                    <button
                      type="button"
                      onClick={() => cancelRoute()}
                      className="w-full py-1.5 text-[11px] font-semibold text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-md transition-colors flex items-center justify-center gap-1.5"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Clear Voyage Selection
                    </button>
                  )}
                </div>

                {routeStatus === 'error' && (
                  <p className="text-[10px] text-rose-400 font-semibold p-2 rounded bg-rose-500/10 border border-rose-500/20">
                    {routeError || 'Unable to calculate route.'}
                  </p>
                )}
              </section>

              {/* Strategy Selector (Highlighted when routes available) */}
              {routes.length > 0 && (
                <section className="rounded-xl bg-slate-900/70 border border-cyan-500/30 p-3 shadow-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Compass className="w-3.5 h-3.5 text-cyan-400" />
                      Select Route Strategy
                    </span>
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-bold">
                      {routes.length} OPTIONS
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    {routes.map((route, rIdx) => {
                      const isSelected = route.id === selectedRouteId;
                      const color = routeColors[route.strategy || 'shortest'] || '#38bdf8';
                      return (
                        <button
                          key={route.id}
                          type="button"
                          onClick={() => selectRoute(route.id)}
                          className={`p-2.5 rounded-lg border text-left transition-all relative overflow-hidden ${
                            isSelected
                              ? 'bg-cyan-500/25 border-cyan-400 text-white shadow-md shadow-cyan-500/25 ring-1 ring-cyan-400'
                              : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 text-[10px] font-bold mb-1">
                            <span className="flex items-center gap-1.5 truncate">
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                              <span className="truncate">{route.label || `Route ${rIdx + 1}`}</span>
                            </span>
                            <RiskBadge level={route.riskLevel} size="sm" />
                          </div>

                          <div className="flex justify-between items-center text-[9px] font-mono text-slate-400">
                            <span className="text-white font-bold">{Math.round(route.distance)} km</span>
                            <span className="text-amber-300 font-semibold">{route.fuelEstimate ?? '—'}t fuel</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Essential Voyage Metrics (Core KPI Dashboard - Always Accessible!) */}
              {currentRoute && (
                <section className="rounded-xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-slate-800 p-3.5 shadow-xl space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                    <div>
                      <div className="text-[11px] font-black text-white tracking-wide">
                        {currentRoute.label || 'Active Marine Route'}
                      </div>
                      <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                        {currentRoute.departure.name} → {currentRoute.arrival.name}
                      </div>
                    </div>
                    <RiskBadge level={routeMonitoring?.risk.riskLevel || currentRoute.riskLevel} size="sm" />
                  </div>

                  {/* 4 Primary KPI Cards in 2x2 Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* Distance */}
                    <div className="rounded-lg bg-slate-950/80 border border-slate-800/80 p-2.5">
                      <div className="text-[9px] uppercase font-bold text-slate-500 flex items-center gap-1">
                        <Navigation className="w-3 h-3 text-cyan-400" />
                        Voyage Distance
                      </div>
                      <div className="mt-1 text-base font-black text-white">
                        {Math.round(currentRoute.distance).toLocaleString()} <span className="text-[10px] font-semibold text-cyan-400">km</span>
                      </div>
                      <div className="text-[9px] text-slate-500 font-mono">
                        ≈ {Math.round(currentRoute.distance * 0.539957).toLocaleString()} NM
                      </div>
                    </div>

                    {/* ETA Duration */}
                    <div className="rounded-lg bg-slate-950/80 border border-slate-800/80 p-2.5">
                      <div className="text-[9px] uppercase font-bold text-slate-500 flex items-center gap-1">
                        <Gauge className="w-3 h-3 text-emerald-400" />
                        Est. Duration
                      </div>
                      <div className="mt-1 text-base font-black text-emerald-300">
                        {formatDuration(currentRoute.estimatedTimeMinutes)}
                      </div>
                      <div className="text-[9px] text-slate-500 font-mono">
                        {formatDurationHours(currentRoute.estimatedTimeMinutes)} total
                      </div>
                    </div>

                    {/* Fuel Consumption */}
                    <div className="rounded-lg bg-slate-950/80 border border-slate-800/80 p-2.5">
                      <div className="text-[9px] uppercase font-bold text-slate-500 flex items-center gap-1">
                        <Fuel className="w-3 h-3 text-amber-400" />
                        Fuel Required
                      </div>
                      <div className="mt-1 text-base font-black text-amber-300">
                        {currentRoute.fuelEstimate ?? '—'} <span className="text-[10px] font-semibold text-slate-400">tons</span>
                      </div>
                      <div className="text-[9px] text-slate-500 font-mono">
                        {vesselClass} Optimized
                      </div>
                    </div>

                    {/* Navigation Safety */}
                    <div className="rounded-lg bg-slate-950/80 border border-slate-800/80 p-2.5">
                      <div className="text-[9px] uppercase font-bold text-slate-500 flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3 text-cyan-400" />
                        Water Validation
                      </div>
                      <div className="mt-1 text-xs font-bold text-emerald-300 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        100% Navigable
                      </div>
                      <div className="text-[9px] text-slate-500 font-mono">
                        {currentRoute.coordinates.length} Ocean Waypoints
                      </div>
                    </div>
                  </div>

                  {/* Mission Control & Reporting Quick Actions */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
                    <button
                      type="button"
                      onClick={handleExportPDF}
                      className="py-2 px-2.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 font-bold text-[11px] transition-all flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <FileDown className="w-3.5 h-3.5" />
                      Export PDF Report
                    </button>

                    <button
                      type="button"
                      onClick={() => onNavigate('results')}
                      className="py-2 px-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-[11px] transition-all flex items-center justify-center gap-1.5 shadow-md shadow-cyan-600/20"
                    >
                      <BarChart3 className="w-3.5 h-3.5" />
                      Results Dashboard →
                    </button>
                  </div>

                  {/* Voyage Simulation Widget */}
                  <div className="rounded-lg bg-slate-950/90 border border-slate-800 p-2.5 space-y-2">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-bold text-slate-300 flex items-center gap-1">
                        <Activity className="w-3 h-3 text-emerald-400" />
                        Voyage Simulation
                      </span>
                      <span className="font-mono text-cyan-400 font-semibold">{simulationProgress.toFixed(0)}% Completed</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsSimulationActive(!isSimulationActive)}
                        className={`flex-1 py-1.5 rounded-md text-[10px] font-bold flex items-center justify-center gap-1.5 border transition-all ${
                          isSimulationActive
                            ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                            : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                        }`}
                      >
                        {isSimulationActive ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                        {isSimulationActive ? 'Pause Simulation' : 'Run Simulation'}
                      </button>

                      <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 px-2 py-1 rounded-md text-[10px] font-mono">
                        <span className="text-slate-500">Speed:</span>
                        {[1, 2, 4].map((spd) => (
                          <button
                            key={spd}
                            type="button"
                            onClick={() => setSimulationSpeed(spd)}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              simulationSpeed === spd ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            {spd}x
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              )}
            </>
          )}

          {/* =========================================================================
              TAB 2: METOCEAN & WEATHER CONDITIONS
              ========================================================================= */}
          {activeTab === 'weather' && (
            <div className="space-y-3.5">
              {/* Departure Port Weather */}
              <section className="rounded-xl bg-slate-900/70 border border-slate-800 p-3 space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Thermometer className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-[10px] font-black uppercase text-slate-300">Origin Port Weather</span>
                  </div>
                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    sourceWeatherStatus === 'live' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {sourceWeatherStatus === 'live' ? '● LIVE' : 'OFFLINE'}
                  </span>
                </div>

                {selectedDeparture ? (
                  sourceWeather?.current ? (
                    <div className="space-y-2">
                      <div className="text-[11px] font-bold text-white">{selectedDeparture.name}</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-slate-950 p-2 border border-slate-800">
                          <span className="text-[8px] uppercase font-bold text-slate-500 block">Air Temp</span>
                          <span className="text-base font-black text-cyan-300">
                            {sourceWeather.current.temperatureCelsius ?? '—'}°C
                          </span>
                        </div>
                        <div className="rounded-lg bg-slate-950 p-2 border border-slate-800">
                          <span className="text-[8px] uppercase font-bold text-slate-500 block">Wind Velocity</span>
                          <span className="text-base font-black text-blue-300">
                            {sourceWeather.current.windSpeedKmh ?? '—'} <span className="text-[9px]">km/h</span>
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 text-[9px] text-slate-400 bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
                        <div>Dir: <strong className="text-white">{windDirection(sourceWeather.current.windDirectionDegrees)}</strong></div>
                        <div>Precip: <strong className="text-white">{sourceWeather.current.precipitationMm ?? 0}mm</strong></div>
                        <div>Sky: <strong className="text-white">{weatherCondition(sourceWeather.current.weatherCode)}</strong></div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-500 py-2">Loading environmental data for {selectedDeparture.name}...</div>
                  )
                ) : (
                  <div className="text-[10px] text-slate-500 py-2">Select a departure harbor in the Voyage tab to view weather.</div>
                )}
              </section>

              {/* Destination Port Weather */}
              <section className="rounded-xl bg-slate-900/70 border border-slate-800 p-3 space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Thermometer className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[10px] font-black uppercase text-slate-300">Destination Port Weather</span>
                  </div>
                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    destinationWeatherStatus === 'live' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {destinationWeatherStatus === 'live' ? '● LIVE' : 'OFFLINE'}
                  </span>
                </div>

                {selectedArrival ? (
                  destinationWeather?.current ? (
                    <div className="space-y-2">
                      <div className="text-[11px] font-bold text-white">{selectedArrival.name}</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-slate-950 p-2 border border-slate-800">
                          <span className="text-[8px] uppercase font-bold text-slate-500 block">Air Temp</span>
                          <span className="text-base font-black text-amber-300">
                            {destinationWeather.current.temperatureCelsius ?? '—'}°C
                          </span>
                        </div>
                        <div className="rounded-lg bg-slate-950 p-2 border border-slate-800">
                          <span className="text-[8px] uppercase font-bold text-slate-500 block">Wind Velocity</span>
                          <span className="text-base font-black text-blue-300">
                            {destinationWeather.current.windSpeedKmh ?? '—'} <span className="text-[9px]">km/h</span>
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 text-[9px] text-slate-400 bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
                        <div>Dir: <strong className="text-white">{windDirection(destinationWeather.current.windDirectionDegrees)}</strong></div>
                        <div>Precip: <strong className="text-white">{destinationWeather.current.precipitationMm ?? 0}mm</strong></div>
                        <div>Sky: <strong className="text-white">{weatherCondition(destinationWeather.current.weatherCode)}</strong></div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-500 py-2">Loading environmental data for {selectedArrival.name}...</div>
                  )
                ) : (
                  <div className="text-[10px] text-slate-500 py-2">Select a destination harbor in the Voyage tab to view weather.</div>
                )}
              </section>

              {/* En-Route Environmental Conditions (Live Sampled) */}
              {currentRoute && (
                <section className="rounded-xl bg-slate-900/70 border border-cyan-500/30 p-3 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
                    <span className="text-[10px] font-black uppercase text-cyan-200">En-Route Metocean Telemetry</span>
                    <button
                      type="button"
                      onClick={() => void refreshSelectedRouteConditions()}
                      disabled={monitoringStatus === 'loading'}
                      className="text-[9px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-bold disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${monitoringStatus === 'loading' ? 'animate-spin' : ''}`} />
                      Refresh
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 text-center">
                    <div className="rounded-lg bg-slate-950 p-2 border border-slate-800">
                      <span className="text-[8px] uppercase text-slate-500 font-bold block">Avg Temp</span>
                      <span className="text-sm font-black text-cyan-300">
                        {currentRoute.weatherConditions?.temperature?.toFixed(1) ?? '—'}°C
                      </span>
                    </div>
                    <div className="rounded-lg bg-slate-950 p-2 border border-slate-800">
                      <span className="text-[8px] uppercase text-slate-500 font-bold block">Avg Wind</span>
                      <span className="text-sm font-black text-blue-300">
                        {currentRoute.weatherConditions?.windSpeed?.toFixed(0) ?? '—'} <span className="text-[8px]">km/h</span>
                      </span>
                    </div>
                    <div className="rounded-lg bg-slate-950 p-2 border border-slate-800">
                      <span className="text-[8px] uppercase text-slate-500 font-bold block">Wave Height</span>
                      <span className="text-sm font-black text-indigo-300">
                        {currentRoute.weatherConditions?.waveHeight?.toFixed(1) ?? '—'} <span className="text-[8px]">m</span>
                      </span>
                    </div>
                  </div>

                  {/* Sea Ice Concentration Progress Bar */}
                  <div className="rounded-lg bg-slate-950 p-2.5 border border-slate-800 space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-slate-400 font-semibold">Sea Ice Concentration:</span>
                      <span className="font-mono font-bold text-cyan-300">
                        {currentRoute.weatherConditions?.seaIceConcentration?.toFixed(0) ?? 0}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500 rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(100, Math.max(5, currentRoute.weatherConditions?.seaIceConcentration ?? 0))}%` }}
                      />
                    </div>
                  </div>
                </section>
              )}
            </div>
          )}

          {/* =========================================================================
              TAB 3: HAZARDS & TRAFFIC (Real-Time Safety & AIS)
              ========================================================================= */}
          {activeTab === 'hazards' && (
            <div className="space-y-3.5">
              {/* Iceberg Threat Section */}
              <section className="rounded-xl bg-slate-900/70 border border-rose-500/30 p-3 space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    <span className="text-[10px] font-black uppercase text-rose-200">Iceberg Hazards ({icebergs.length})</span>
                  </div>
                  <span className="text-[9px] font-mono font-bold text-rose-400">MONITORED</span>
                </div>

                {icebergs.length > 0 ? (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                    {icebergs.map((ice) => (
                      <button
                        key={ice.id}
                        type="button"
                        onClick={() => {
                          setSelectedIceberg(ice);
                          setSelectedShip(null);
                          if (mapInstanceRef.current) {
                            mapInstanceRef.current.getView().animate({
                              center: fromLonLat([ice.longitude, ice.latitude]),
                              zoom: 5,
                              duration: 400,
                            });
                          }
                        }}
                        className={`w-full text-left p-2 rounded-lg border transition-all ${
                          selectedIceberg?.id === ice.id
                            ? 'bg-rose-500/20 border-rose-400 ring-1 ring-rose-400'
                            : 'bg-slate-950/80 border-slate-800/80 hover:border-rose-500/50'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-bold">
                          <span className="text-white flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-rose-500" />
                            {ice.name}
                          </span>
                          <span className="text-rose-400 font-mono">{ice.riskProbability.toFixed(0)}% Risk</span>
                        </div>
                        <div className="mt-1 flex justify-between text-[9px] text-slate-400 font-mono">
                          <span>Size: {ice.size}</span>
                          <span>Drift: {ice.driftSpeed.toFixed(1)} kn</span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-500 py-2">No active iceberg threats along this corridor.</div>
                )}
              </section>

              {/* AIS Vessels Section */}
              <section className="rounded-xl bg-slate-900/70 border border-blue-500/30 p-3 space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
                  <div className="flex items-center gap-1.5">
                    <ShipIcon className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-[10px] font-black uppercase text-blue-200">AIS Vessels Nearby ({ships.length})</span>
                  </div>
                  <span className="text-[9px] font-mono font-bold text-emerald-400">ACTIVE</span>
                </div>

                {ships.length > 0 ? (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                    {ships.map((ship) => (
                      <button
                        key={ship.id}
                        type="button"
                        onClick={() => {
                          setSelectedShip(ship);
                          setSelectedIceberg(null);
                          if (mapInstanceRef.current) {
                            mapInstanceRef.current.getView().animate({
                              center: fromLonLat([ship.longitude, ship.latitude]),
                              zoom: 5,
                              duration: 400,
                            });
                          }
                        }}
                        className={`w-full text-left p-2 rounded-lg border transition-all ${
                          selectedShip?.id === ship.id
                            ? 'bg-blue-500/20 border-blue-400 ring-1 ring-blue-400'
                            : 'bg-slate-950/80 border-slate-800/80 hover:border-blue-500/50'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-bold">
                          <span className="text-white flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                            {ship.name}
                          </span>
                          <span className="text-emerald-400 font-mono text-[9px]">{ship.status}</span>
                        </div>
                        <div className="mt-1 flex justify-between text-[9px] text-slate-400 font-mono">
                          <span>Speed: {ship.speed.toFixed(1)} kn</span>
                          <span>Heading: {ship.heading.toFixed(0)}°</span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-500 py-2">No commercial vessels detected in this operational area.</div>
                )}
              </section>
            </div>
          )}
        </div>
      </aside>

      {/* =========================================================================
          MAIN MAP CANVAS & FLOATING CONTROL OVERLAYS
          ========================================================================= */}
      <main className="flex-1 relative overflow-hidden bg-[#020617]">
        {/* OpenLayers Map Canvas */}
        <div ref={mapRef} className="absolute inset-0 w-full h-full" />

        {/* Top-Right Floating Controls Bar (Unified HUD) */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          {/* Layer Controls Pill */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-950/90 p-1.5 shadow-2xl backdrop-blur-md flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMapOverlays((prev) => ({ ...prev, traffic: !prev.traffic }))}
              className={`px-2.5 py-1 rounded-md text-[10px] font-bold border transition-all ${
                mapOverlays.traffic
                  ? 'bg-blue-500/20 border-blue-500/40 text-blue-300 shadow-sm'
                  : 'bg-slate-900 border-slate-800 text-slate-500'
              }`}
            >
              🚢 AIS Vessels
            </button>
            <button
              type="button"
              onClick={() => setMapOverlays((prev) => ({ ...prev, icebergs: !prev.icebergs }))}
              className={`px-2.5 py-1 rounded-md text-[10px] font-bold border transition-all ${
                mapOverlays.icebergs
                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-300 shadow-sm'
                  : 'bg-slate-900 border-slate-800 text-slate-500'
              }`}
            >
              ⛰️ Icebergs
            </button>
          </div>

          {/* Zoom & Fit Tools */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-950/90 p-1.5 shadow-2xl backdrop-blur-md flex items-center gap-1">
            <button
              type="button"
              onClick={focusRouteOnMap}
              disabled={!currentRoute}
              title="Fit Calculated Route"
              className="p-1.5 rounded-md hover:bg-slate-800 text-cyan-400 transition-colors disabled:opacity-40"
            >
              <Crosshair className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={zoomIn}
              title="Zoom In"
              className="p-1.5 rounded-md hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={zoomOut}
              title="Zoom Out"
              className="p-1.5 rounded-md hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Floating Interactive Inspector Card (When Vessel or Iceberg is clicked) */}
        {selectedShip && (
          <div className="absolute bottom-16 left-6 z-20 w-72 rounded-xl bg-slate-950/95 border border-blue-500/40 p-3.5 shadow-2xl backdrop-blur-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-1.5">
                <ShipIcon className="w-4 h-4 text-blue-400" />
                <span className="text-[11px] font-black uppercase text-blue-200">AIS Vessel Track</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedShip(null)}
                className="text-slate-400 hover:text-white p-0.5 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="mt-2 space-y-1.5 text-[10px]">
              <div className="text-sm font-black text-white">{selectedShip.name}</div>
              <div className="grid grid-cols-2 gap-1 text-slate-400 font-mono">
                <div>Status: <strong className="text-emerald-400">{selectedShip.status}</strong></div>
                <div>Speed: <strong className="text-white">{selectedShip.speed.toFixed(1)} kn</strong></div>
                <div>Heading: <strong className="text-white">{selectedShip.heading.toFixed(0)}°</strong></div>
                <div>Risk: <strong className="text-amber-300">{selectedShip.riskScore}</strong></div>
              </div>
              <div className="text-slate-400 font-mono">Destination: <strong className="text-white">{selectedShip.destination}</strong></div>
            </div>
          </div>
        )}

        {selectedIceberg && (
          <div className="absolute bottom-16 left-6 z-20 w-72 rounded-xl bg-slate-950/95 border border-rose-500/40 p-3.5 shadow-2xl backdrop-blur-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span className="text-[11px] font-black uppercase text-rose-200">Iceberg Hazard Threat</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedIceberg(null)}
                className="text-slate-400 hover:text-white p-0.5 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="mt-2 space-y-1.5 text-[10px]">
              <div className="text-sm font-black text-white">{selectedIceberg.name}</div>
              <div className="grid grid-cols-2 gap-1 text-slate-400 font-mono">
                <div>Size: <strong className="text-white">{selectedIceberg.size}</strong></div>
                <div>Drift: <strong className="text-white">{selectedIceberg.driftSpeed.toFixed(1)} kn</strong></div>
                <div>Risk: <strong className="text-rose-400 font-bold">{selectedIceberg.riskProbability.toFixed(0)}%</strong></div>
              </div>
              <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden mt-1">
                <div
                  className="h-full bg-rose-500 rounded-full"
                  style={{ width: `${selectedIceberg.riskProbability}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Map Legend (Bottom Right) */}
        <div className="absolute bottom-4 right-4 z-10 rounded-xl border border-slate-800/80 bg-slate-950/90 px-3 py-2 shadow-2xl backdrop-blur-md flex items-center gap-3 text-[10px] font-bold text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Port</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
            <span>Marine Route</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span>AIS Vessel</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span>Iceberg</span>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;
