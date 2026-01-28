import { getRiskColor } from './riskUtils';
import React, { useEffect, useRef, useState } from 'react';
import { Map, View } from 'ol';
import { fromLonLat } from 'ol/proj';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Feature } from 'ol';
import { Point, LineString } from 'ol/geom';
import { Style, Circle, Fill, Stroke, Text } from 'ol/style';
import {
  Ship as ShipIcon, Anchor, AlertTriangle, Navigation,
  Thermometer, Wind, Gauge, Map as MapIcon,
  Activity, Info, Waves, Eye, Cloud, Users,
  Compass, FastForward, Box, Clock
} from 'lucide-react';
import { useStore } from './store';
import { Iceberg, Ship as ShipType } from './types';

// Component: Modern Risk Badge
const RiskBadge = ({ level }: { level: string }) => {
  const colors = {
    High: 'bg-red-900/40 text-red-400 border-red-800',
    Medium: 'bg-yellow-900/40 text-yellow-400 border-yellow-800',
    Low: 'bg-green-900/40 text-green-400 border-green-800'
  };
  return (
    <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-widest ${colors[level as keyof typeof colors]}`}>
      {level}
    </span>
  );
};

function App() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const [selectedIceberg, setSelectedIceberg] = useState<Iceberg | null>(null);
  const [selectedShip, setSelectedShip] = useState<ShipType | null>(null);

  const {
    ports,
    selectedDeparture,
    selectedArrival,
    currentRoute,
    setDeparture,
    setArrival,
    calculateRoute
  } = useStore();

  useEffect(() => {
    if (!mapRef.current) return;
    const map = new Map({
      target: mapRef.current,
      layers: [
        new TileLayer({
          source: new XYZ({
            url: 'https://{a-c}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
            attributions: '© CARTO'
          })
        })
      ],
      view: new View({ center: fromLonLat([0, 70]), zoom: 3.5 })
    });

    map.on('click', (e) => {
      const feature = map.forEachFeatureAtPixel(e.pixel, f => f);
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

    mapInstanceRef.current = map;
    return () => map.setTarget(undefined);
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const features: Feature[] = [];

    // Render Ports
    ports.forEach(port => {
      const feature = new Feature({ geometry: new Point(fromLonLat([port.longitude, port.latitude])), type: 'port' });
      feature.setStyle(new Style({
        image: new Circle({ radius: 6, fill: new Fill({ color: '#10b981' }), stroke: new Stroke({ color: '#fff', width: 2 }) }),
        text: new Text({ text: port.name, offsetY: -15, font: 'bold 11px Inter', fill: new Fill({ color: '#fff' }) })
      }));
      features.push(feature);
    });

    if (currentRoute) {
      // Main Route Line
      const routeFeature = new Feature({ geometry: new LineString(currentRoute.coordinates.map(c => fromLonLat(c))) });
      routeFeature.setStyle(new Style({ stroke: new Stroke({ color: getRiskColor(currentRoute.riskLevel), width: 4 }) }));
      features.push(routeFeature);

      // Render Vessels (Ships)
      currentRoute.ships?.forEach(ship => {
        const f = new Feature({ geometry: new Point(fromLonLat([ship.longitude, ship.latitude])), type: 'ship', data: ship });
        f.setStyle(new Style({
          image: new Circle({ radius: 6, fill: new Fill({ color: '#3b82f6' }), stroke: new Stroke({ color: '#fff', width: 1.5 }) }),
          text: new Text({ text: ship.name, offsetY: 12, font: '10px Inter', fill: new Fill({ color: '#3b82f6' }) })
        }));
        features.push(f);
      });

      // Render Icebergs
      currentRoute.icebergs?.forEach(ice => {
        const f = new Feature({ geometry: new Point(fromLonLat([ice.longitude, ice.latitude])), type: 'iceberg', data: ice });
        f.setStyle(new Style({ image: new Circle({ radius: 6, fill: new Fill({ color: '#ef4444' }), stroke: new Stroke({ color: '#fff', width: 1.5 }) }) }));
        features.push(f);
      });
    }

    const vectorLayer = new VectorLayer({ source: new VectorSource({ features }) });
    mapInstanceRef.current.getLayers().clear();
    mapInstanceRef.current.addLayer(new TileLayer({ source: new XYZ({ url: 'https://{a-c}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' }) }));
    mapInstanceRef.current.addLayer(vectorLayer);
  }, [ports, currentRoute]);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans">
      <div className="flex h-screen overflow-hidden">

        {/* SIDEBAR - GLASSMORPHISM PANEL */}
        <div className="w-[420px] bg-slate-950/80 backdrop-blur-xl border-r border-slate-800/60 p-5 overflow-y-auto flex flex-col gap-5 shadow-2xl z-20">

          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-500/20">
              <Navigation className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-lg font-black tracking-tighter text-white uppercase italic">Arctic Route</h1>
          </div>

          {/* ROUTE SELECTOR */}
          <section className="bg-slate-900/40 p-4 rounded-xl border border-slate-800">
            <h2 className="text-[10px] font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
              <MapIcon className="w-3 h-3" /> Mission Planning
            </h2>
            <div className="space-y-3">
              <div className="grid gap-1">
                <span className="text-[9px] text-slate-400 uppercase font-bold px-1">Departure</span>
                <select className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white outline-none focus:ring-1 focus:ring-blue-500" value={selectedDeparture?.id || ''} onChange={(e) => setDeparture(ports.find(p => p.id === e.target.value) || null)}>
                  <option value="">Select Port...</option>
                  {ports.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="grid gap-1">
                <span className="text-[9px] text-slate-400 uppercase font-bold px-1">Arrival</span>
                <select className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white outline-none focus:ring-1 focus:ring-blue-500" value={selectedArrival?.id || ''} onChange={(e) => setArrival(ports.find(p => p.id === e.target.value) || null)}>
                  <option value="">Select Port...</option>
                  {ports.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <button className="w-full bg-blue-600 hover:bg-blue-500 py-2.5 rounded-lg text-xs font-black transition-all disabled:opacity-30 shadow-lg shadow-blue-900/20" disabled={!selectedDeparture || !selectedArrival} onClick={calculateRoute}>
                GENERATE OPTIMIZED PATH
              </button>
            </div>
          </section>

          {/* VESSEL INSPECTOR (APPEARS ON CLICK) */}
          {selectedShip && (
            <div className="bg-blue-600/5 border border-blue-500/30 rounded-xl overflow-hidden animate-in slide-in-from-right-4">
              <div className="bg-blue-600/20 px-4 py-2 border-b border-blue-500/30 flex justify-between items-center">
                <h3 className="text-[10px] font-bold text-blue-400 uppercase flex items-center gap-2">
                  <ShipIcon className="w-3 h-3" /> Vessel Inspector
                </h3>
                <button onClick={() => setSelectedShip(null)} className="text-blue-400 hover:text-white">✕</button>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-lg font-bold text-white leading-none">{selectedShip.name}</h4>
                    <span className="text-[9px] text-blue-400/70 uppercase font-bold tracking-widest">{selectedShip.cargoType}</span>
                  </div>
                  <div className="bg-green-500/10 border border-green-500/30 px-2 py-1 rounded text-[10px] text-green-400 font-bold uppercase">{selectedShip.status}</div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                    <div className="flex items-center gap-1.5 text-slate-500 mb-1"><FastForward className="w-3 h-3" /><span className="text-[9px] font-bold uppercase">Speed</span></div>
                    <span className="text-sm font-mono text-white">{selectedShip.speed.toFixed(1)} kn</span>
                  </div>
                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                    <div className="flex items-center gap-1.5 text-slate-500 mb-1"><Compass className="w-3 h-3" /><span className="text-[9px] font-bold uppercase">Heading</span></div>
                    <span className="text-sm font-mono text-white">{selectedShip.heading.toFixed(0)}°</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MAIN TELEMETRY DATA (SHOWS WHEN NO SHIP IS SELECTED) */}
          {currentRoute && !selectedShip && (
            <div className="space-y-4 animate-in fade-in duration-500">

              {/* ROUTE OVERVIEW */}
              <div className="bg-slate-900/40 rounded-xl border border-slate-800 overflow-hidden">
                <div className="bg-slate-800/40 px-4 py-2 border-b border-slate-800 flex justify-between items-center">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase">Route Telemetry</h3>
                  <RiskBadge level={currentRoute.riskLevel} />
                </div>
                <div className="p-4 grid grid-cols-2 gap-4 text-center">
                  <div className="border-r border-slate-800"><span className="text-[9px] text-slate-500 uppercase block">Distance</span><span className="text-sm font-black text-white">{currentRoute.distance} KM</span></div>
                  <div><span className="text-[9px] text-slate-500 uppercase block">Est. Time</span><span className="text-sm font-black text-white">{currentRoute.estimatedTime} HRS</span></div>
                </div>
              </div>

              {/* ENVIRONMENTAL SENSORS */}
              <div className="bg-slate-900/40 rounded-xl border border-slate-800 p-4 space-y-4">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2"><Activity className="w-3 h-3" /> Sensors</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2"><Thermometer className="w-4 h-4 text-orange-400" /><div><span className="text-[9px] text-slate-500 block">TEMP</span><span className="text-xs font-bold">{currentRoute.weatherConditions.temperature.toFixed(1)}°C</span></div></div>
                  <div className="flex items-center gap-2"><Wind className="w-4 h-4 text-blue-400" /><div><span className="text-[9px] text-slate-500 block">WIND</span><span className="text-xs font-bold">{currentRoute.weatherConditions.windSpeed.toFixed(1)} kn</span></div></div>
                  <div className="flex items-center gap-2"><Waves className="w-4 h-4 text-cyan-400" /><div><span className="text-[9px] text-slate-500 block">WAVES</span><span className="text-xs font-bold">{currentRoute.weatherConditions.waveHeight.toFixed(1)}m</span></div></div>
                  <div className="flex items-center gap-2"><Eye className="w-4 h-4 text-slate-400" /><div><span className="text-[9px] text-slate-500 block">VIS</span><span className="text-xs font-bold">{currentRoute.weatherConditions.visibility}</span></div></div>
                </div>
                <div className="pt-3 border-t border-slate-800">
                  <div className="flex justify-between text-[10px] mb-1.5 font-bold"><span className="text-slate-500 uppercase">Sea Ice Concentration</span><span className="text-blue-400">{currentRoute.weatherConditions.seaIceConcentration.toFixed(1)}%</span></div>
                  <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden"><div className="bg-blue-600 h-full transition-all duration-1000" style={{ width: `${currentRoute.weatherConditions.seaIceConcentration}%` }} /></div>
                </div>
              </div>

              {/* TRAFFIC MONITOR */}
              <div className="bg-slate-900/40 rounded-xl border border-slate-800 p-4">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase mb-3 flex items-center gap-2"><Users className="w-3 h-3" /> Traffic Control</h3>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-slate-950 p-2 rounded border border-slate-800"><span className="text-[8px] text-slate-500 uppercase block">Ships</span><span className="text-xs font-black">{currentRoute.ships?.length || 0}</span></div>
                  <div className="bg-slate-950 p-2 rounded border border-slate-800"><span className="text-[8px] text-slate-500 uppercase block">Hazards</span><span className="text-xs font-black">{currentRoute.icebergs?.length || 0}</span></div>
                  <div className="bg-slate-950 p-2 rounded border border-slate-800"><span className="text-[8px] text-slate-500 uppercase block">Cong.</span><span className="text-xs font-black">{currentRoute.trafficCongestion.toFixed(0)}%</span></div>
                </div>
              </div>

              {/* ACTIVE ALERTS */}
              {currentRoute.alerts.length > 0 && (
                <div className="space-y-2">
                  {currentRoute.alerts.map((alert, i) => (
                    <div key={i} className={`p-3 rounded-xl border flex gap-3 ${alert.severity === 'High' ? 'bg-red-950/20 border-red-900/40 text-red-300' : 'bg-yellow-950/10 border-yellow-900/30 text-yellow-300'}`}>
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div className="text-[11px]"><p className="font-bold uppercase tracking-wide">{alert.message}</p><p className="opacity-60 mt-0.5 font-mono">Impact Window: {alert.timeToImpact}h</p></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* HAZARD INSPECTOR (ICEBERGS) */}
          {selectedIceberg && (
            <div className="bg-red-950/20 border border-red-500/30 p-4 rounded-xl animate-in slide-in-from-left-4">
              <h3 className="text-[10px] font-bold text-red-400 uppercase mb-3 flex items-center gap-2"><AlertTriangle className="w-3 h-3" /> Iceberg Tracking</h3>
              <div className="flex justify-between items-end">
                <div><p className="text-lg font-black text-white leading-none">{selectedIceberg.name}</p><p className="text-[10px] text-slate-500 uppercase mt-1">Mass Class: {selectedIceberg.size}</p></div>
                <div className="text-right font-mono"><span className="text-[9px] text-slate-500 uppercase block">Collision Risk</span><span className="text-sm font-bold text-red-400">{selectedIceberg.riskProbability.toFixed(1)}%</span></div>
              </div>
            </div>
          )}
        </div>

        {/* MAP CONTAINER */}
        <div className="flex-1 relative">
          <div ref={mapRef} className="absolute inset-0" />

          {/* MAP LEGEND */}
          <div className="absolute bottom-8 right-8 flex gap-5 bg-slate-950/90 backdrop-blur-lg p-3 rounded-xl border border-slate-800/80 shadow-2xl">
            <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest"><div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" /> Port</div>
            <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest"><div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" /> Hazard</div>
            <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest"><div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" /> Vessel</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;