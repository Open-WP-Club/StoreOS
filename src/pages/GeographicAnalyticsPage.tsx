import React, { useState, useEffect, useCallback, useRef, ChangeEvent } from 'react';
import type { Globe as CobeGlobe } from 'cobe';
import { useCache } from '../stores';
import { MapPin, Globe, Building2, Calendar, TrendingUp } from 'lucide-react';
import type { Order } from '../types';

// ISO 3166-1 alpha-2 → lat/lng for globe markers
const COUNTRY_COORDS: Record<string, [number, number]> = {
  US: [37.09, -95.71], GB: [55.38, -3.44], DE: [51.17, 10.45], FR: [46.23, 2.21],
  IT: [41.87, 12.57], ES: [40.46, -3.75], NL: [52.13, 5.29], PL: [51.92, 19.15],
  SE: [60.13, 18.64], NO: [60.47, 8.47], DK: [56.26, 9.50], FI: [61.92, 25.75],
  BE: [50.50, 4.47], AT: [47.52, 14.55], CH: [46.82, 8.23], PT: [39.40, -8.22],
  IE: [53.41, -8.24], CZ: [49.82, 15.47], SK: [48.67, 19.70], HU: [47.16, 19.50],
  RO: [45.94, 24.97], BG: [42.73, 25.49], HR: [45.10, 15.20], SI: [46.15, 14.99],
  GR: [39.07, 21.82], TR: [38.96, 35.24], RU: [61.52, 105.32], UA: [48.38, 31.17],
  CA: [56.13, -106.35], AU: [25.27, 133.78], NZ: [-40.90, 174.89], JP: [36.20, 138.25],
  CN: [35.86, 104.20], IN: [20.59, 78.96], BR: [-14.24, -51.93], MX: [23.63, -102.55],
  AR: [-38.42, -63.62], ZA: [-30.56, 22.94], NG: [9.08, 8.68], EG: [26.82, 30.80],
  SA: [23.89, 45.08], AE: [23.42, 53.85], IL: [31.05, 34.85], SG: [1.35, 103.82],
  MY: [4.21, 101.98], TH: [15.87, 100.99], PH: [12.88, 121.77], ID: [-0.79, 113.92],
  KR: [35.91, 127.77], TW: [23.70, 121.00], HK: [22.40, 114.11], PK: [30.38, 69.35],
  BD: [23.68, 90.36], LK: [7.87, 80.77], KE: [-0.02, 37.91], GH: [7.95, -1.02],
  MA: [31.79, -7.09], DZ: [28.03, 1.66], TN: [33.89, 9.54], CL: [-35.68, -71.54],
  CO: [4.57, -74.30], PE: [-9.19, -75.02], VE: [6.42, -66.59], EC: [-1.83, -78.18],
};

function countryCodeToFlag(code: string): string {
  const base = 0x1F1E6 - 65;
  const chars = code.toUpperCase().split('');
  return chars.map((c) => String.fromCodePoint(base + c.charCodeAt(0))).join('');
}

interface CountryStat {
  code: string;
  name: string;
  orders: number;
  revenue: number;
}

interface CityStat {
  city: string;
  country: string;
  orders: number;
}

interface GeoData {
  countries: CountryStat[];
  cities: CityStat[];
  totalOrders: number;
}

const TIME_RANGES = [
  { value: 30, label: '30 Days' },
  { value: 90, label: '3 Months' },
  { value: 180, label: '6 Months' },
  { value: 365, label: '12 Months' },
  { value: 0, label: 'All Time' },
];

// Intl.DisplayNames for country names
const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

function getCountryName(code: string): string {
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

// ── Globe component ──────────────────────────────────────────────────────────

interface GlobeProps {
  markers: Array<{ location: [number, number]; size: number }>;
  dark: boolean;
}

function GlobeCanvas({ markers, dark }: GlobeProps): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerInteracting = useRef<number | null>(null);
  const pointerInteractionMovement = useRef(0);
  const phiRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let rafId: number;
    let globe: CobeGlobe | null = null;
    let disposed = false;
    let createGlobeFn: typeof import('cobe').default | null = null;

    const init = () => {
      const size = canvas.offsetWidth;
      // Wait until the canvas has been laid out and has a real size
      if (size === 0) {
        rafId = requestAnimationFrame(init);
        return;
      }

      if (!createGlobeFn) return;
      globe = createGlobeFn(canvas, {
        devicePixelRatio: 2,
        width: size * 2,
        height: size * 2,
        phi: 0,
        theta: 0.3,
        dark: dark ? 1 : 0,
        diffuse: 1.2,
        mapSamples: 16000,
        mapBrightness: dark ? 6 : 8,
        baseColor: dark ? [0.15, 0.2, 0.35] : [0.8, 0.87, 1.0],
        markerColor: [0.25, 0.6, 1.0],
        glowColor: dark ? [0.15, 0.2, 0.35] : [0.8, 0.87, 1.0],
        markers,
      });

      const animate = () => {
        if (!pointerInteracting.current) {
          phiRef.current += 0.003;
        }
        globe?.update({ phi: phiRef.current + pointerInteractionMovement.current });
        rafId = requestAnimationFrame(animate);
      };
      rafId = requestAnimationFrame(animate);

      setTimeout(() => { canvas.style.opacity = '1'; }, 100);
    };

    // cobe (WebGL globe) is only needed on this page; load it on demand
    void import('cobe').then(({ default: createGlobe }) => {
      if (disposed) return;
      createGlobeFn = createGlobe;
      rafId = requestAnimationFrame(init);
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      globe?.destroy();
    };
  }, [markers, dark]);

  return (
    <canvas
      ref={canvasRef}
      style={{ cursor: 'grab', width: '100%', aspectRatio: '1', opacity: 0, transition: 'opacity 0.6s ease' }}
      onPointerDown={(e) => {
        pointerInteracting.current = e.clientX - pointerInteractionMovement.current;
        if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
      }}
      onPointerUp={() => {
        pointerInteracting.current = null;
        if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
      }}
      onPointerOut={() => {
        pointerInteracting.current = null;
        if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
      }}
      onMouseMove={(e) => {
        if (pointerInteracting.current !== null) {
          const delta = e.clientX - pointerInteracting.current;
          pointerInteractionMovement.current = delta / 200;
        }
      }}
    />
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

const GeographicAnalyticsPage: React.FC = () => {
  const getCachedData = useCache((state) => state.getCachedData);
  const [timeRange, setTimeRange] = useState(90);
  const [geoData, setGeoData] = useState<GeoData>({ countries: [], cities: [], totalOrders: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'countries' | 'cities'>('countries');

  const isDark = document.documentElement.classList.contains('dark');

  // Reset loading whenever the selected time range changes (re-fetch trigger)
  const [prevTimeRange, setPrevTimeRange] = useState(timeRange);
  if (prevTimeRange !== timeRange) {
    setPrevTimeRange(timeRange);
    setLoading(true);
  }

  const calculateGeoData = useCallback((orders: Order[], days: number): void => {
    const threshold = days > 0 ? new Date(Date.now() - days * 86400000) : null;
    const filtered = threshold
      ? orders.filter((o) => new Date(o.date_created) >= threshold)
      : orders;

    const countryMap: Record<string, { orders: number; revenue: number }> = {};
    const cityMap: Record<string, { country: string; orders: number }> = {};

    filtered.forEach((order) => {
      const country = order.billing?.country?.toUpperCase() ?? '';
      const city = order.billing?.city ?? '';
      const revenue = parseFloat(order.total || '0');

      if (country) {
        if (!countryMap[country]) countryMap[country] = { orders: 0, revenue: 0 };
        countryMap[country].orders += 1;
        countryMap[country].revenue += revenue;
      }

      if (city && country) {
        const key = `${city}|${country}`;
        if (!cityMap[key]) cityMap[key] = { country, orders: 0 };
        cityMap[key].orders += 1;
      }
    });

    const countries: CountryStat[] = Object.entries(countryMap)
      .map(([code, data]) => ({ code, name: getCountryName(code), ...data }))
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 10);

    const cities: CityStat[] = Object.entries(cityMap)
      .map(([key, data]) => ({ city: key.split('|')[0] ?? key, ...data }))
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 10);

    setGeoData({ countries, cities, totalOrders: filtered.length });
  }, []);

  useEffect(() => {
    let cancelled = false;

    getCachedData('orders').then((cached) => {
      if (cancelled) return;
      const orders = (cached as Order[] | null) ?? [];
      calculateGeoData(orders, timeRange);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [getCachedData, calculateGeoData, timeRange]);

  // Build globe markers from top countries
  const globeMarkers = geoData.countries
    .filter((c) => COUNTRY_COORDS[c.code])
    .map((c) => {
      const maxOrders = geoData.countries[0]?.orders ?? 1;
      return {
        location: COUNTRY_COORDS[c.code] as [number, number],
        size: 0.04 + (c.orders / maxOrders) * 0.08,
      };
    });

  const maxCountryOrders = geoData.countries[0]?.orders ?? 1;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Globe className="w-6 h-6 text-blue-500" />
            Geographic Analytics
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Sales distribution by country and city
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <select
            value={timeRange}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setTimeRange(Number(e.target.value))}
            className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          >
            {TIME_RANGES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
              <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Orders in Period</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{geoData.totalOrders}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/40 rounded-lg">
              <MapPin className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Countries</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{geoData.countries.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/40 rounded-lg">
              <Building2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Cities</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{geoData.cities.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Globe + Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Globe */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex flex-col items-center">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 self-start">
            Order Locations
          </h2>
          {loading ? (
            <div className="flex items-center justify-center h-64 w-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
          ) : globeMarkers.length === 0 ? (
            <div className="flex items-center justify-center h-64 w-full text-gray-400 dark:text-gray-500 text-sm">
              No geographic data available
            </div>
          ) : (
            <div className="w-full max-w-sm mx-auto">
              <GlobeCanvas markers={globeMarkers} dark={isDark} />
            </div>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Drag to rotate</p>
        </div>

        {/* Tables */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {/* Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            <div className="flex">
              <button
                onClick={() => setActiveTab('countries')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'countries'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <span className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Top Countries
                </span>
              </button>
              <button
                onClick={() => setActiveTab('cities')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'cities'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Top Cities
                </span>
              </button>
            </div>
          </div>

          {/* Country table */}
          {activeTab === 'countries' && (
            <div className="overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-48">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
                </div>
              ) : geoData.countries.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-gray-400 dark:text-gray-500 text-sm">
                  No data for selected period
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">#</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Country</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Orders</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {geoData.countries.map((c, i) => (
                      <tr key={c.code} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{i + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xl leading-none" aria-label={c.name}>{countryCodeToFlag(c.code)}</span>
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{c.name}</p>
                              <p className="text-xs text-gray-400 dark:text-gray-500">{c.code}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white">{c.orders}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                              <div
                                className="bg-blue-500 h-1.5 rounded-full"
                                style={{ width: `${(c.orders / maxCountryOrders) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500 dark:text-gray-400 w-8 text-right">
                              {geoData.totalOrders > 0 ? Math.round((c.orders / geoData.totalOrders) * 100) : 0}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* City table */}
          {activeTab === 'cities' && (
            <div className="overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-48">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
                </div>
              ) : geoData.cities.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-gray-400 dark:text-gray-500 text-sm">
                  No data for selected period
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">#</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">City</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Orders</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {geoData.cities.map((c, i) => (
                      <tr key={`${c.city}-${c.country}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{i + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-lg leading-none">{countryCodeToFlag(c.country)}</span>
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{c.city}</p>
                              <p className="text-xs text-gray-400 dark:text-gray-500">{getCountryName(c.country)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white">{c.orders}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GeographicAnalyticsPage;
