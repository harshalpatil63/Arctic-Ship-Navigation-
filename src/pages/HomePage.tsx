import React from 'react';
import {
  Navigation, ArrowRight, Anchor, MapPin,
  Snowflake, BarChart3, AlertTriangle, Ship
} from 'lucide-react';
import { getAllPorts } from '../utils/generators';

interface HomePageProps {
  onNavigate: (page: 'dashboard') => void;
}

const ports = getAllPorts();

const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  return (
    <div className="min-h-screen pt-16">

      {/* ---- HERO ---- */}
      <section className="px-6 py-20 max-w-5xl mx-auto">
        <div className="max-w-3xl">
          <p className="text-sm text-cyan-500 font-medium mb-4 flex items-center gap-2">
            <Snowflake className="w-4 h-4" />
            Polar Maritime Navigation Tool
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight tracking-tight">
            Arctic Ship<br />
            <span className="text-gradient">Navigation</span>
          </h1>
          <p className="mt-5 text-slate-400 text-base leading-relaxed max-w-2xl">
            A route planning tool for Arctic and Antarctic shipping. It calculates optimal 
            paths between polar ports, accounting for sea ice concentration, iceberg positions, 
            weather conditions, and vessel traffic — then recommends the safest route with 
            alternatives to compare.
          </p>
          <p className="mt-3 text-slate-500 text-sm leading-relaxed max-w-2xl">
            Built for the Northern Sea Route (NSR) and Antarctic supply routes, where conventional 
            navigation tools fall short. The system generates weather-aware risk assessments and 
            fuel estimates for each voyage.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              onClick={() => onNavigate('dashboard')}
              className="group flex items-center gap-2.5 px-6 py-3 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-white text-sm font-semibold transition-colors"
            >
              <Navigation className="w-4 h-4" />
              Open Dashboard
              <ArrowRight className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
            </button>
            <a
              href="#ports"
              className="px-5 py-3 rounded-lg text-sm font-medium text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700 transition-colors"
            >
              View ports
            </a>
          </div>
        </div>
      </section>

      {/* ---- WHAT IT DOES ---- */}
      <section className="px-6 py-16 border-t border-slate-800/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-lg font-semibold text-white mb-8">How it works</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800/50">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-mono text-slate-600">01</span>
                <MapPin className="w-4 h-4 text-cyan-500" />
              </div>
              <h3 className="text-sm font-semibold text-white mb-1.5">Select departure & arrival</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Pick two ports from the database. The system supports 10 polar locations 
                across Russia, Norway, Greenland, Canada, and Antarctica.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800/50">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-mono text-slate-600">02</span>
                <BarChart3 className="w-4 h-4 text-cyan-500" />
              </div>
              <h3 className="text-sm font-semibold text-white mb-1.5">Route computation</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                The system calculates the primary route along known sea lanes, generates 
                current weather and ice conditions, detects icebergs, and computes fuel and 
                time estimates based on ice penalty factors.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800/50">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-mono text-slate-600">03</span>
                <AlertTriangle className="w-4 h-4 text-cyan-500" />
              </div>
              <h3 className="text-sm font-semibold text-white mb-1.5">Review & compare</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                View the route on an interactive map with hazard markers. Compare 2 alternative 
                routes side-by-side for distance, time, fuel, and risk level. Check active 
                alerts before departure.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---- PORT DATABASE ---- */}
      <section id="ports" className="px-6 py-16 border-t border-slate-800/50">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-white">Port database</h2>
              <p className="text-xs text-slate-500 mt-1">{ports.length} polar ports across Arctic and Antarctic regions</p>
            </div>
            <Anchor className="w-5 h-5 text-slate-700" />
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800/50">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-900/60 text-[10px] text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-3 font-semibold">Port</th>
                  <th className="px-4 py-3 font-semibold">Country</th>
                  <th className="px-4 py-3 font-semibold text-right">Latitude</th>
                  <th className="px-4 py-3 font-semibold text-right">Longitude</th>
                  <th className="px-4 py-3 font-semibold text-right">Congestion</th>
                  <th className="px-4 py-3 font-semibold hidden md:table-cell">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {ports.map((port) => (
                  <tr key={port.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium text-white">{port.name}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{port.country}</td>
                    <td className="px-4 py-3 text-xs text-slate-400 font-mono text-right">
                      {port.latitude.toFixed(2)}°
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 font-mono text-right">
                      {port.longitude.toFixed(2)}°
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              port.congestion > 70 ? 'bg-red-500' :
                              port.congestion > 40 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${port.congestion}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-slate-500 w-7 text-right">
                          {port.congestion}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-slate-500 hidden md:table-cell max-w-[200px] truncate">
                      {port.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ---- PROJECT SCOPE ---- */}
      <section className="px-6 py-16 border-t border-slate-800/50">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12">
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">About the project</h2>
            <div className="space-y-3 text-sm text-slate-400 leading-relaxed">
              <p>
                Arctic Ship Navigation addresses the growing need for 
                safe navigation tools as polar shipping routes become more viable due to 
                changing ice patterns.
              </p>
              <p>
                The Northern Sea Route between Europe and Asia cuts transit time by up to 40% 
                compared to the Suez Canal route, but presents unique hazards: drifting icebergs, 
                extreme weather, limited visibility, and sparse traffic management infrastructure.
              </p>
              <p>
                The system combines route optimization algorithms with environmental data to produce 
                actionable voyage plans. Risk is scored across three dimensions — ice conditions, 
                weather severity, and traffic density — to give a composite safety rating.
              </p>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Technical approach</h2>
            <div className="space-y-3">
              {[
                { label: 'Route optimization', desc: 'TensorFlow.js neural network for multi-factor risk classification across 10 input features' },
                { label: 'Weather prediction', desc: 'Simulated Random Forest model using latitude, season, and distance as predictive features' },
                { label: 'Traffic analysis', desc: 'K-Means clustering on vessel position, speed, and heading to identify congestion zones' },
                { label: 'Collision assessment', desc: 'Binary classification model scoring ship-iceberg proximity using 8 spatial features' },
                { label: 'Fuel estimation', desc: 'Distance-based calculation at 0.12 tons/NM with speed penalties for ice concentration' },
              ].map((item) => (
                <div key={item.label} className="flex gap-3">
                  <Ship className="w-3.5 h-3.5 text-slate-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-xs font-medium text-slate-300">{item.label}</span>
                    <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---- FOOTER ---- */}
      <footer className="border-t border-slate-800/50 px-6 py-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Navigation className="w-4 h-4 text-slate-600" />
            <span className="text-xs text-slate-600 font-medium">
              Arctic Ship Navigation
            </span>
          </div>
          <p className="text-[11px] text-slate-700">
            Built with React, TypeScript, OpenLayers, TensorFlow.js
          </p>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
