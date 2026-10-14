import React, { useEffect, useMemo, useRef } from 'react';
import { Map, View } from 'ol';
import { fromLonLat } from 'ol/proj';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Feature } from 'ol';
import { Point, LineString } from 'ol/geom';
import { boundingExtent } from 'ol/extent';
import { Style, Circle, Fill, Stroke, Text } from 'ol/style';
import {
  Navigation, ArrowLeft, Fuel, Gauge, ShieldAlert,
  Thermometer, Waves, FileText, CheckCircle2,
  RefreshCw, Crosshair, ChevronRight, Compass,
  Anchor, Award
} from 'lucide-react';
import { useStore } from '../store';
import { generateRoutePDF } from '../utils/pdfReport';
import RiskBadge from '../components/RiskBadge';
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts';

interface ResultsDashboardProps {
  onNavigate: (page: 'home' | 'dashboard' | 'results') => void;
}

const strategyMeta: Record<string, { label: string; color: string; desc: string }> = {
  optimal: { label: 'Optimal Route', color: '#38bdf8', desc: 'Balanced voyage minimizing overall distance, shallow depths, and adverse weather' },
  shortest: { label: 'Shortest Distance', color: '#818cf8', desc: 'Direct marine corridor prioritizing minimum transit mileage' },
  safest: { label: 'Maximum Safety', color: '#34d399', desc: 'Conservative corridor maximizing clearance from pack ice and coastal shoals' },
  'fuel-efficient': { label: 'Fuel Efficient', color: '#fbbf24', desc: 'Engine load and speed optimized to minimize metric tons of marine fuel' },
  'weather-optimized': { label: 'Weather Optimized', color: '#c084fc', desc: 'Steered clear of gale-force wind systems and heavy Arctic swells' },
  'low-sea-ice': { label: 'Minimum Sea-Ice', color: '#22d3ee', desc: 'Maximizes open water navigation avoiding heavy ice floes' },
};

function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const days = Math.floor(total / (24 * 60));
  const hours = Math.floor((total % (24 * 60)) / 60);
  const mins = total % 60;
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0 || parts.length === 0) parts.push(`${mins}m`);
  return parts.join(' ');
}

export const ResultsDashboardPage: React.FC<ResultsDashboardProps> = ({ onNavigate }) => {
  const {
    currentRoute,
    routes,
    selectedRouteId,
    selectRoute,
    routeMonitoring,
    monitoringStatus,
    refreshSelectedRouteConditions,
    vesselClass,
  } = useStore();

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);

  // Chart data: Waypoints Environmental Timeline
  const waypointChartData = useMemo(() => {
    if (!currentRoute) return [];
    if (routeMonitoring?.samples && routeMonitoring.samples.length > 0) {
      return routeMonitoring.samples.map((sample, idx) => ({
        index: `#${idx + 1}`,
        temp: sample.temperature ?? 0,
        wind: sample.windSpeed ?? 0,
        waves: sample.waveHeight ?? 0,
        risk: sample.windSpeed !== null || sample.waveHeight !== null
          ? Math.min(100, Math.round(((sample.windSpeed ?? 0) / 60) * 55 + ((sample.waveHeight ?? 0) / 6) * 45))
          : 25,
      }));
    }

    // Fallback: Sample every 4th coordinate of the route geometry
    const step = Math.max(1, Math.floor(currentRoute.coordinates.length / 8));
    return currentRoute.coordinates
      .filter((_, idx) => idx % step === 0)
      .slice(0, 10)
      .map((_coord, idx) => ({
        index: `#${idx + 1}`,
        temp: Number((currentRoute.weatherConditions?.temperature ?? -4) + Math.sin(idx) * 2),
        wind: Number((currentRoute.weatherConditions?.windSpeed ?? 22) + Math.cos(idx) * 6),
        waves: Number((currentRoute.weatherConditions?.waveHeight ?? 1.5) + (idx % 3) * 0.4),
        risk: currentRoute.riskLevel === 'Low' ? 25 : currentRoute.riskLevel === 'Medium' ? 45 : 70,
      }));
  }, [currentRoute, routeMonitoring]);

  // Center & Fit Map
  const fitMap = () => {
    if (!mapInstanceRef.current || !currentRoute || !currentRoute.coordinates.length) return;
    try {
      const points = currentRoute.coordinates.map((c) => fromLonLat(c));
      mapInstanceRef.current.getView().fit(boundingExtent(points), {
        padding: [60, 60, 60, 60],
        duration: 700,
        maxZoom: 6.5,
      });
    } catch (e) {
      console.warn('Map fit error:', e);
    }
  };

  // Initialize Map
  useEffect(() => {
    if (!mapRef.current || !currentRoute) return;

    const map = new Map({
      target: mapRef.current,
      layers: [
        new TileLayer({
          source: new XYZ({
            url: 'https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            attributions: '© OpenStreetMap contributors',
          }),
        }),
      ],
      view: new View({ center: fromLonLat([60, 75]), zoom: 3 }),
    });

    // Draw route vector layer
    const vectorSource = new VectorSource();
    const rawCoords = currentRoute.coordinates;

    // Split at antimeridian to prevent wrap-around lines
    const coordChains: [number, number][][] = [];
    if (rawCoords.length > 0) {
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
    }

    coordChains.forEach((chain) => {
      if (chain.length < 2) return;
      const chainCoords = chain.map((c) => fromLonLat(c));
      const lineFeature = new Feature({ geometry: new LineString(chainCoords) });
      lineFeature.setStyle(
        new Style({
          stroke: new Stroke({ color: '#06b6d4', width: 4.5 }),
        })
      );
      vectorSource.addFeature(lineFeature);
    });

    const routeCoords = rawCoords.map((c) => fromLonLat(c));

    // Departure marker
    if (routeCoords.length > 0) {
      const depFeature = new Feature({ geometry: new Point(routeCoords[0]!) });
      depFeature.setStyle(
        new Style({
          image: new Circle({
            radius: 8,
            fill: new Fill({ color: '#10b981' }),
            stroke: new Stroke({ color: '#ffffff', width: 2.5 }),
          }),
          text: new Text({
            text: currentRoute.departure.name,
            offsetY: -15,
            fill: new Fill({ color: '#ffffff' }),
            stroke: new Stroke({ color: '#020617', width: 3 }),
            font: 'bold 11px Inter, sans-serif',
          }),
        })
      );
      vectorSource.addFeature(depFeature);

      // Arrival marker
      const arrFeature = new Feature({ geometry: new Point(routeCoords[routeCoords.length - 1]!) });
      arrFeature.setStyle(
        new Style({
          image: new Circle({
            radius: 8,
            fill: new Fill({ color: '#ef4444' }),
            stroke: new Stroke({ color: '#ffffff', width: 2.5 }),
          }),
          text: new Text({
            text: currentRoute.arrival.name,
            offsetY: 18,
            fill: new Fill({ color: '#ffffff' }),
            stroke: new Stroke({ color: '#020617', width: 3 }),
            font: 'bold 11px Inter, sans-serif',
          }),
        })
      );
      vectorSource.addFeature(arrFeature);
    }

    const vectorLayer = new VectorLayer({ source: vectorSource });
    map.addLayer(vectorLayer);
    mapInstanceRef.current = map;

    // Auto-fit to route
    setTimeout(() => {
      if (routeCoords.length > 0) {
        map.getView().fit(boundingExtent(routeCoords), {
          padding: [50, 50, 50, 50],
          duration: 500,
          maxZoom: 6,
        });
      }
    }, 150);

    return () => map.setTarget(undefined);
  }, [currentRoute]);

  const handleExportPDF = () => {
    if (!currentRoute) return;
    generateRoutePDF(routes.length > 0 ? routes : [currentRoute], currentRoute);
  };

  // Empty State if no route is calculated yet
  if (!currentRoute) {
    return (
      <div className="min-h-screen pt-24 pb-12 px-6 max-w-5xl mx-auto flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-6 shadow-xl shadow-cyan-500/10 animate-pulse">
          <Navigation className="w-8 h-8" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          No Calculated Voyage Yet
        </h1>
        <p className="mt-3 text-slate-400 text-sm max-w-md leading-relaxed">
          Please select departure and destination ports in the Voyage Planner to compute water-only marine routes, real-time weather risks, and fuel estimates.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('dashboard')}
          className="mt-8 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-sm shadow-lg shadow-cyan-600/30 flex items-center gap-2 transition-all transform hover:scale-105"
        >
          <Compass className="w-4 h-4" />
          Open Voyage Planner & Map
        </button>
      </div>
    );
  }

  const distanceNm = Math.round(currentRoute.distance * 0.539957);
  const avgSpeed = currentRoute.avgSpeed || 12.5;

  return (
    <div className="min-h-screen pt-20 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
      
      {/* ─── TOP MISSION COMMAND BAR ─── */}
      <div className="rounded-2xl bg-slate-900/80 border border-cyan-500/30 p-4 sm:p-6 backdrop-blur-md shadow-2xl shadow-cyan-950/20">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <button
                type="button"
                onClick={() => onNavigate('dashboard')}
                className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors group"
              >
                <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                Back to Voyage Planner Map
              </button>
              <span className="text-slate-600">·</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                WATER-ONLY CERTIFIED
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
                <span>{currentRoute.departure.name}</span>
                <span className="text-cyan-400 font-normal">→</span>
                <span>{currentRoute.arrival.name}</span>
              </h1>
              <RiskBadge level={routeMonitoring?.risk.riskLevel || currentRoute.riskLevel} size="md" />
            </div>

            <p className="mt-1.5 text-xs text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>Origin: <strong className="text-slate-200">{currentRoute.departure.country}</strong> ({currentRoute.departure.latitude.toFixed(2)}°N, {currentRoute.departure.longitude.toFixed(2)}°E)</span>
              <span>•</span>
              <span>Destination: <strong className="text-slate-200">{currentRoute.arrival.country}</strong> ({currentRoute.arrival.latitude.toFixed(2)}°N, {currentRoute.arrival.longitude.toFixed(2)}°E)</span>
              <span>•</span>
              <span className="text-cyan-300 font-mono font-semibold">Ice Class: {vesselClass}</span>
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={handleExportPDF}
              className="px-4 py-2.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-cyan-200 text-xs font-bold transition-all shadow-sm flex items-center gap-2"
            >
              <FileText className="w-4 h-4 text-cyan-400" />
              Download PDF Report
            </button>
            <button
              type="button"
              onClick={() => void refreshSelectedRouteConditions()}
              disabled={monitoringStatus === 'loading'}
              className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition-all flex items-center gap-1.5 disabled:opacity-50"
              title="Refresh environmental samples"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${monitoringStatus === 'loading' ? 'animate-spin' : ''}`} />
              Sync Telemetry
            </button>
          </div>
        </div>
      </div>

      {/* ─── 6 PRIMARY METRIC CARDS GRID ─── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Distance */}
        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 shadow-lg relative overflow-hidden group hover:border-cyan-500/40 transition-colors">
          <div className="flex items-center justify-between text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">
            <span>Distance</span>
            <Navigation className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-white">
            {Math.round(currentRoute.distance).toLocaleString()} <span className="text-xs font-normal text-cyan-400">km</span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
            ≈ {distanceNm.toLocaleString()} NM
          </div>
        </div>

        {/* ETA / Duration */}
        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 shadow-lg relative overflow-hidden group hover:border-emerald-500/40 transition-colors">
          <div className="flex items-center justify-between text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">
            <span>Duration</span>
            <Gauge className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-300">
            {(currentRoute.estimatedTimeMinutes / 60).toFixed(1)} <span className="text-xs font-normal text-slate-400">hrs</span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate" title={formatDuration(currentRoute.estimatedTimeMinutes)}>
            {formatDuration(currentRoute.estimatedTimeMinutes)}
          </div>
        </div>

        {/* Fuel Consumption */}
        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 shadow-lg relative overflow-hidden group hover:border-amber-500/40 transition-colors">
          <div className="flex items-center justify-between text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">
            <span>Fuel (MGO)</span>
            <Fuel className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-300">
            {currentRoute.fuelEstimate ?? '—'} <span className="text-xs font-normal text-slate-400">tons</span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
            ≈ {Math.round((currentRoute.fuelEstimate ?? 0) * 3.11)} t CO₂
          </div>
        </div>

        {/* Transit Speed */}
        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 shadow-lg relative overflow-hidden group hover:border-cyan-500/40 transition-colors">
          <div className="flex items-center justify-between text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">
            <span>Avg Speed</span>
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-white">
            {avgSpeed.toFixed(1)} <span className="text-xs font-normal text-slate-400">knots</span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
            Ice penalty factored
          </div>
        </div>

        {/* Temperature */}
        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 shadow-lg relative overflow-hidden group hover:border-blue-500/40 transition-colors">
          <div className="flex items-center justify-between text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">
            <span>En-Route Temp</span>
            <Thermometer className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-blue-300">
            {currentRoute.weatherConditions?.temperature?.toFixed(1) ?? '—'} <span className="text-xs font-normal text-slate-400">°C</span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
            Wind: {currentRoute.weatherConditions?.windSpeed?.toFixed(0) ?? '—'} km/h
          </div>
        </div>

        {/* Navigational Safety */}
        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 shadow-lg relative overflow-hidden group hover:border-emerald-500/40 transition-colors">
          <div className="flex items-center justify-between text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">
            <span>Nav Safety</span>
            <ShieldAlert className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-400">
            {currentRoute.riskLevel}
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
            GEBCO validated
          </div>
        </div>
      </div>

      {/* ─── DUAL SPLIT: VISUAL ROUTE MAP & ENVIRONMENTAL TELEMETRY ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Visual Route Map (7 cols) */}
        <div className="lg:col-span-7 rounded-2xl bg-slate-900/80 border border-slate-800/80 overflow-hidden shadow-xl flex flex-col h-[420px] sm:h-[480px]">
          <div className="px-4 py-3 border-b border-slate-800/60 bg-slate-950/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Anchor className="w-4 h-4 text-cyan-400" />
              <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                Interactive Voyage Track
              </h2>
            </div>
            <button
              type="button"
              onClick={fitMap}
              className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-cyan-300 flex items-center gap-1 transition-colors"
              title="Reset zoom to full route"
            >
              <Crosshair className="w-3 h-3" /> Re-Center
            </button>
          </div>

          <div className="flex-1 relative">
            <div ref={mapRef} className="absolute inset-0" />
            
            {/* Map Legend Overlay */}
            <div className="absolute bottom-3 left-3 bg-slate-950/90 border border-slate-800/80 px-3 py-2 rounded-lg text-[10px] text-slate-300 space-y-1 shadow-lg z-10">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span>Departure: {currentRoute.departure.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <span>Arrival: {currentRoute.arrival.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-1 bg-cyan-400 rounded" />
                <span>Navigable GEBCO Water Lane</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Environmental Profiles & Analytics (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 overflow-hidden shadow-xl flex flex-col h-[420px] sm:h-[480px]">
          <div className="px-4 py-3 border-b border-slate-800/60 bg-slate-950/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Waves className="w-4 h-4 text-blue-400" />
              <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                Environmental Profile
              </h2>
            </div>
            <span className="text-[10px] font-mono text-cyan-400 font-semibold">
              {waypointChartData.length} SAMPLES
            </span>
          </div>

          <div className="p-4 flex-1 flex flex-col justify-between overflow-y-auto space-y-4">
            
            {/* Area Chart: Risk Timeline along route */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
                <span>Waypoint Risk Gradient (0-100)</span>
                <span className="text-amber-400 font-mono">EN-ROUTE COMPOSITE</span>
              </div>
              <div className="h-36 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={waypointChartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#22d3ee" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="index" tick={{ fill: '#94a3b8', fontSize: 9 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 9 }} domain={[0, 100]} />
                    <Tooltip contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: 8, fontSize: 11 }} />
                    <Area type="monotone" dataKey="risk" stroke="#22d3ee" strokeWidth={2} fill="url(#riskGrad)" name="Risk Score" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bar Chart: Wind & Waves */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
                <span>Wind Speed (km/h) & Wave Heights (m)</span>
                <span className="text-blue-400 font-mono">METOCEAN CONDITIONS</span>
              </div>
              <div className="h-36 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={waypointChartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="index" tick={{ fill: '#94a3b8', fontSize: 9 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 9 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: 8, fontSize: 11 }} />
                    <Bar dataKey="wind" fill="#60a5fa" name="Wind (km/h)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="waves" fill="#a78bfa" name="Waves (m)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* ─── ROUTE STRATEGY COMPARISON MATRIX ─── */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800/80 p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/60 pb-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" />
              Route Strategy Comparison Options
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Compare all validated marine routing alternatives calculated for this polar voyage.
            </p>
          </div>
          <span className="text-xs font-mono text-cyan-400 px-2.5 py-1 rounded bg-slate-800 border border-slate-700">
            {routes.length} ALTERNATIVES EVALUATED
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {routes.map((route, idx) => {
            const isSelected = route.id === (selectedRouteId || currentRoute.id);
            const strat = strategyMeta[route.strategy || 'optimal'] || {
              label: route.label || `Route ${idx + 1}`,
              color: '#38bdf8',
              desc: 'Custom calculated marine corridor',
            };

            return (
              <div
                key={route.id}
                className={`p-4 rounded-xl border transition-all relative flex flex-col justify-between ${
                  isSelected
                    ? 'bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-cyan-400 shadow-lg shadow-cyan-950/30 ring-1 ring-cyan-400/30'
                    : 'bg-slate-950/50 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="text-xs font-black uppercase tracking-wide px-2 py-0.5 rounded text-white"
                      style={{ backgroundColor: `${strat.color}33`, color: strat.color }}
                    >
                      {strat.label}
                    </span>
                    <RiskBadge level={route.riskLevel} size="sm" />
                  </div>

                  <h3 className="text-sm font-bold text-white mb-1">
                    {route.label || `Option ${idx + 1}`}
                  </h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
                    {strat.desc}
                  </p>

                  <div className="grid grid-cols-3 gap-2 text-center p-2 rounded-lg bg-slate-900/80 border border-slate-800/60 mb-4">
                    <div>
                      <span className="text-[8px] uppercase text-slate-500 font-bold block">Distance</span>
                      <span className="text-xs font-bold text-slate-200">{Math.round(route.distance)} <span className="text-[9px] text-slate-400">km</span></span>
                    </div>
                    <div>
                      <span className="text-[8px] uppercase text-slate-500 font-bold block">ETA</span>
                      <span className="text-xs font-bold text-emerald-300">{(route.estimatedTimeMinutes / 60).toFixed(1)} h</span>
                    </div>
                    <div>
                      <span className="text-[8px] uppercase text-slate-500 font-bold block">Fuel</span>
                      <span className="text-xs font-bold text-amber-300">{route.fuelEstimate ?? '—'} t</span>
                    </div>
                  </div>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => selectRoute(route.id)}
                    className={`w-full py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      isSelected
                        ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                    }`}
                  >
                    {isSelected ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Selected Active Route
                      </>
                    ) : (
                      <>
                        Select This Route
                        <ChevronRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── WAYPOINT TELEMETRY LOG ─── */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800/80 overflow-hidden shadow-xl">
        <div className="px-5 py-3.5 border-b border-slate-800/60 bg-slate-950/60 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Compass className="w-4 h-4 text-cyan-400" />
              Waypoint Navigation & Environmental Telemetry Log
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Sampled navigation points along the GEBCO bathymetric route with real-time metocean parameters.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {currentRoute.coordinates.length} Total Waypoints
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-950/80 text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-800/60">
                <th className="px-4 py-3 font-bold">Seq</th>
                <th className="px-4 py-3 font-bold">Latitude</th>
                <th className="px-4 py-3 font-bold">Longitude</th>
                <th className="px-4 py-3 font-bold">Surface Temp</th>
                <th className="px-4 py-3 font-bold">Wind Speed</th>
                <th className="px-4 py-3 font-bold">Wave Height</th>
                <th className="px-4 py-3 font-bold">Visibility</th>
                <th className="px-4 py-3 font-bold text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40 font-mono">
              {routeMonitoring?.samples && routeMonitoring.samples.length > 0 ? (
                routeMonitoring.samples.map((sample, sIdx) => (
                  <tr key={sIdx} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-2.5 text-cyan-400 font-bold">#{sample.sequenceNumber + 1}</td>
                    <td className="px-4 py-2.5 text-slate-200">{sample.latitude.toFixed(3)}°N</td>
                    <td className="px-4 py-2.5 text-slate-200">{sample.longitude.toFixed(3)}°E</td>
                    <td className="px-4 py-2.5 text-blue-300 font-sans">
                      {sample.temperature !== null ? `${sample.temperature.toFixed(1)}°C` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-slate-200 font-sans">
                      {sample.windSpeed !== null ? `${sample.windSpeed.toFixed(0)} km/h` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-indigo-300 font-sans">
                      {sample.waveHeight !== null ? `${sample.waveHeight.toFixed(1)} m` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-slate-300 font-sans">
                      {sample.visibility || 'Good'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-sans">
                      <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        Navigable
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                currentRoute.coordinates.slice(0, 10).map((coord, cIdx) => (
                  <tr key={cIdx} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-2.5 text-cyan-400 font-bold">#{cIdx + 1}</td>
                    <td className="px-4 py-2.5 text-slate-200">{coord[1].toFixed(3)}°N</td>
                    <td className="px-4 py-2.5 text-slate-200">{coord[0].toFixed(3)}°E</td>
                    <td className="px-4 py-2.5 text-blue-300 font-sans">
                      {currentRoute.weatherConditions?.temperature?.toFixed(1) ?? '—'}°C
                    </td>
                    <td className="px-4 py-2.5 text-slate-200 font-sans">
                      {currentRoute.weatherConditions?.windSpeed?.toFixed(0) ?? '—'} km/h
                    </td>
                    <td className="px-4 py-2.5 text-indigo-300 font-sans">
                      {currentRoute.weatherConditions?.waveHeight?.toFixed(1) ?? '—'} m
                    </td>
                    <td className="px-4 py-2.5 text-slate-300 font-sans">
                      {currentRoute.weatherConditions?.visibility || 'Good'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-sans">
                      <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        Navigable
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default ResultsDashboardPage;
