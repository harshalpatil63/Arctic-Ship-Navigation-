import { getRiskColor } from '../riskUtils';
import React, { useEffect, useRef, useState } from 'react';
import { Map, View } from 'ol';
import { fromLonLat, toLonLat } from 'ol/proj';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Feature } from 'ol';
import { Point, LineString } from 'ol/geom';
import { Style, Circle, Fill, Stroke, Text } from 'ol/style';
import {
  Ship as ShipIcon, Navigation, AlertTriangle,
  Thermometer, Wind, Map as MapIcon,
  Waves, Eye, Users, Fuel, Gauge, RefreshCw,
  ArrowLeft, Crosshair, ChevronDown, ChevronUp,
  ArrowRightLeft
} from 'lucide-react';
import { useStore } from '../store';
import { Iceberg, Ship as ShipType } from '../types';
import RiskBadge from '../components/RiskBadge';

interface DashboardPageProps {
  onNavigate: (page: 'home') => void;
}

const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const [selectedIceberg, setSelectedIceberg] = useState<Iceberg | null>(null);
  const [selectedShip, setSelectedShip] = useState<ShipType | null>(null);
  const [hoverData, setHoverData] = useState<{ lat: string; lon: string } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [sectionsOpen, setSectionsOpen] = useState({
    telemetry: true, weather: true, traffic: true, alternatives: false
  });

  const {
    ports,
    selectedDeparture,
    selectedArrival,
    currentRoute,
    setDeparture,
    setArrival,
    calculateRoute,
  } = useStore();

  const toggleSection = (key: keyof typeof sectionsOpen) => {
    setSectionsOpen(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Initialize Map
  useEffect(() => {
    if (!mapRef.current) return;
    const map = new Map({
      target: mapRef.current,
      layers: [
        new TileLayer({
          source: new XYZ({
            url: 'https://{a-c}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
            attributions: '© CARTO',
          }),
        }),
      ],
      view: new View({ center: fromLonLat([90, 70]), zoom: 3.5 }),
    });

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
    const features: Feature[] = [];

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

    if (currentRoute) {
      // Route glow
      const glowFeature = new Feature({
        geometry: new LineString(currentRoute.coordinates.map((c) => fromLonLat(c))),
      });
      glowFeature.setStyle(
        new Style({
          stroke: new Stroke({
            color: getRiskColor(currentRoute.riskLevel).replace('0.5', '0.12'),
            width: 10,
          }),
        })
      );
      features.push(glowFeature);

      // Route line
      const routeFeature = new Feature({
        geometry: new LineString(currentRoute.coordinates.map((c) => fromLonLat(c))),
      });
      routeFeature.setStyle(
        new Style({
          stroke: new Stroke({
            color: getRiskColor(currentRoute.riskLevel),
            width: 3,
          }),
        })
      );
      features.push(routeFeature);

      // Waypoint dots
      currentRoute.coordinates.forEach((coord, i) => {
        if (i === 0 || i === currentRoute.coordinates.length - 1) return;
        const wp = new Feature({ geometry: new Point(fromLonLat(coord)) });
        wp.setStyle(new Style({
          image: new Circle({
            radius: 3,
            fill: new Fill({ color: '#475569' }),
            stroke: new Stroke({ color: '#1e293b', width: 1 }),
          }),
        }));
        features.push(wp);
      });

      // Ships
      currentRoute.ships?.forEach((ship) => {
        const f = new Feature({
          geometry: new Point(fromLonLat([ship.longitude, ship.latitude])),
          type: 'ship',
          data: ship,
        });
        f.setStyle(
          new Style({
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
          })
        );
        features.push(f);
      });

      // Icebergs
      currentRoute.icebergs?.forEach((ice) => {
        const f = new Feature({
          geometry: new Point(fromLonLat([ice.longitude, ice.latitude])),
          type: 'iceberg',
          data: ice,
        });
        f.setStyle(
          new Style({
            image: new Circle({
              radius: 5,
              fill: new Fill({ color: '#ef4444' }),
              stroke: new Stroke({ color: '#7f1d1d', width: 1.5 }),
            }),
            text: new Text({
              text: ice.name,
              offsetY: -12,
              font: '600 8px Inter, sans-serif',
              fill: new Fill({ color: '#fca5a5' }),
            }),
          })
        );
        features.push(f);
      });
    }

    const vectorLayer = new VectorLayer({ source: new VectorSource({ features }) });
    mapInstanceRef.current.getLayers().clear();
    mapInstanceRef.current.addLayer(
      new TileLayer({
        source: new XYZ({
          url: 'https://{a-c}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        }),
      })
    );
    mapInstanceRef.current.addLayer(vectorLayer);
  }, [ports, currentRoute, hoverData]);

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
          <div className="px-4 py-2.5 border-b border-slate-800/40 flex items-center gap-2">
            <MapIcon className="w-3.5 h-3.5 text-slate-500" />
            <h2 className="text-[11px] font-semibold text-slate-400">Route Planning</h2>
          </div>
          <div className="p-3 space-y-2.5">
            <div>
              <label className="text-[10px] text-slate-500 font-medium block mb-1">From</label>
              <select
                className="w-full bg-slate-950 border border-slate-800 rounded-md p-2 text-xs text-white outline-none focus:border-slate-700 transition-colors"
                value={selectedDeparture?.id || ''}
                onChange={(e) => setDeparture(ports.find((p) => p.id === e.target.value) || null)}
              >
                <option value="">Select port...</option>
                {ports.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}, {p.country}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-500 font-medium block mb-1">To</label>
              <select
                className="w-full bg-slate-950 border border-slate-800 rounded-md p-2 text-xs text-white outline-none focus:border-slate-700 transition-colors"
                value={selectedArrival?.id || ''}
                onChange={(e) => setArrival(ports.find((p) => p.id === e.target.value) || null)}
              >
                <option value="">Select port...</option>
                {ports.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}, {p.country}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-600 py-2 rounded-md text-xs font-semibold transition-colors flex items-center justify-center gap-2"
              disabled={!selectedDeparture || !selectedArrival}
              onClick={calculateRoute}
            >
              <Navigation className="w-3.5 h-3.5" />
              Calculate Route
            </button>
          </div>
        </section>

        {/* Route results */}
        {currentRoute && !selectedShip && !selectedIceberg && (
          <div className="space-y-3">

            {/* Route header */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="font-medium text-white">{currentRoute.departure.name}</span>
                <ArrowRightLeft className="w-3 h-3 text-slate-600" />
                <span className="font-medium text-white">{currentRoute.arrival.name}</span>
              </div>
              <button
                onClick={calculateRoute}
                className="p-1.5 rounded-md hover:bg-slate-800 text-slate-500 hover:text-white transition-colors"
                title="Recalculate with new conditions"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

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
                      <span className="text-sm font-semibold text-white">{currentRoute.estimatedTime} <span className="text-[10px] text-slate-500">hrs</span></span>
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
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/30">
                        {/* Primary route */}
                        <tr className="text-white">
                          <td className="py-1.5 font-medium text-cyan-400">Primary</td>
                          <td className="py-1.5 text-right font-mono">{currentRoute.distance} km</td>
                          <td className="py-1.5 text-right font-mono">{currentRoute.estimatedTime}h</td>
                          <td className="py-1.5 text-right font-mono">{currentRoute.fuelEstimate}t</td>
                          <td className="py-1.5 text-right"><RiskBadge level={currentRoute.riskLevel} size="sm" /></td>
                        </tr>
                        {currentRoute.alternativeRoutes.map((alt, i) => (
                          <tr key={i} className="text-slate-400">
                            <td className="py-1.5 font-medium">Alt {i + 1}</td>
                            <td className="py-1.5 text-right font-mono">{Math.round(alt.distance)} km</td>
                            <td className="py-1.5 text-right font-mono">{alt.estimatedTime}h</td>
                            <td className="py-1.5 text-right font-mono">{alt.fuelConsumption || '—'}t</td>
                            <td className="py-1.5 text-right"><RiskBadge level={alt.riskLevel} size="sm" /></td>
                          </tr>
                        ))}
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
          <div className="absolute top-4 left-4 bg-slate-950/85 border border-slate-800/50 px-3 py-2 rounded-lg z-[1001]">
            <div className="flex items-center gap-2 text-xs">
              <Eye className="w-3 h-3 text-slate-500" />
              <span className="text-slate-400">
                {currentRoute.departure.name} → {currentRoute.arrival.name}
              </span>
              <RiskBadge level={currentRoute.riskLevel} size="sm" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
