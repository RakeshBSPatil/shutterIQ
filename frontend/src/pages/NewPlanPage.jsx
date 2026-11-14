import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Building2, Loader2, Play, Search } from 'lucide-react';
import { apiClient, extractErrorMessage } from '../api/client.js';
import { DEMO_CAMPUS, INCIDENT_OPTIONS, WEATHER_OPTIONS } from '../constants/demo.js';

function createDestIcon() {
  return L.divIcon({
    className: 'shuttleiq-dest-pin',
    html: `<div style="background:#0B132B;color:#10B981;width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;border:3px solid #10B981;box-shadow:0 3px 10px rgba(0,0,0,0.4);">HQ</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

function DestPickerEvents({ onPick }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function CenterSync({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng]);
  }, [map, lat, lng]);
  return null;
}

export default function NewPlanPage() {
  const navigate = useNavigate();

  const [name, setName] = useState('Morning Commute Plan');
  const [arrivalTime, setArrivalTime] = useState('08:30');
  const [bufferMin, setBufferMin] = useState(10);
  const [weather, setWeather] = useState('clear');
  const [incident, setIncident] = useState('none');

  const [destName, setDestName] = useState(DEMO_CAMPUS.name);
  const [destLat, setDestLat] = useState(DEMO_CAMPUS.lat);
  const [destLng, setDestLng] = useState(DEMO_CAMPUS.lng);

  const [placeQuery, setPlaceQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);

  const [fleetCounts, setFleetCounts] = useState({ vehicles: 0, seats: 0, riders: 0 });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function checkInputs() {
      try {
        const [vRes, rRes] = await Promise.all([
          apiClient.get('/vehicles'),
          apiClient.get('/riders'),
        ]);
        const v = vRes.data.vehicles || [];
        const r = rRes.data.riders || [];
        setFleetCounts({
          vehicles: v.length,
          seats: v.reduce((s, item) => s + Number(item.capacity || 0), 0),
          riders: r.length,
        });
      } catch {
        // Non-blocking preview check
      }
    }
    checkInputs();
  }, []);

  function useDemoCampus() {
    setDestName(DEMO_CAMPUS.name);
    setDestLat(DEMO_CAMPUS.lat);
    setDestLng(DEMO_CAMPUS.lng);
    setSearchResults([]);
  }

  async function handleSearchDestination(e) {
    e.preventDefault();
    if (!placeQuery.trim()) return;
    setSearching(true);
    setError('');
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(
        placeQuery.trim()
      )}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Geocoding lookup failed');
      const items = await res.json();
      setSearchResults(Array.isArray(items) ? items : []);
    } catch (err) {
      setError(err.message || 'Destination search failed');
    } finally {
      setSearching(false);
    }
  }

  async function handleGeneratePlan(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await apiClient.post('/plans', {
        name: name.trim(),
        dest_name: destName.trim(),
        dest_lat: Number(destLat),
        dest_lng: Number(destLng),
        arrival_time: arrivalTime,
        buffer_min: Number(bufferMin),
        conditions: { weather, incident },
      });
      navigate(`/plans/${res.data.plan.id}`);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to generate optimized plan'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Generate Optimized Plan
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Configure arrival target, safety buffer, weather, and destination to compute
            optimal routes.
          </p>
        </div>

        <div className="rounded-lg bg-white border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700">
          Active Roster: {fleetCounts.vehicles} vehicles ({fleetCounts.seats} seats) &bull;{' '}
          {fleetCounts.riders} riders
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800"
        >
          {error}
        </div>
      )}

      <div className="grid lg:grid-cols-5 gap-6">
        <form
          onSubmit={handleGeneratePlan}
          className="lg:col-span-2 rounded-xl bg-white border border-slate-200 p-6 shadow-sm space-y-4"
        >
          <div>
            <label htmlFor="plan-name" className="block text-sm font-semibold text-slate-700 mb-1">
              Plan name
            </label>
            <input
              id="plan-name"
              name="planName"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm min-h-[44px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="plan-arrival" className="block text-sm font-semibold text-slate-700 mb-1">
                Arrive-by deadline
              </label>
              <input
                id="plan-arrival"
                name="arrivalTime"
                type="time"
                required
                value={arrivalTime}
                onChange={(e) => setArrivalTime(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm min-h-[44px]"
              />
            </div>

            <div>
              <label htmlFor="plan-buffer" className="block text-sm font-semibold text-slate-700 mb-1">
                Buffer (minutes)
              </label>
              <input
                id="plan-buffer"
                name="bufferMin"
                type="number"
                required
                min={0}
                max={60}
                value={bufferMin}
                onChange={(e) => setBufferMin(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm min-h-[44px]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="plan-weather" className="block text-sm font-semibold text-slate-700 mb-1">
              Weather condition
            </label>
            <select
              id="plan-weather"
              name="weather"
              value={weather}
              onChange={(e) => setWeather(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm bg-white min-h-[44px]"
            >
              {WEATHER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="plan-incident" className="block text-sm font-semibold text-slate-700 mb-1">
              Road / traffic incident
            </label>
            <select
              id="plan-incident"
              name="incident"
              value={incident}
              onChange={(e) => setIncident(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm bg-white min-h-[44px]"
            >
              {INCIDENT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-2 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="dest-name" className="block text-sm font-semibold text-slate-700">
                Destination campus
              </label>
              <button
                type="button"
                onClick={useDemoCampus}
                className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800"
              >
                <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Use demo campus</span>
              </button>
            </div>
            <input
              id="dest-name"
              name="destName"
              type="text"
              required
              value={destName}
              onChange={(e) => setDestName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm min-h-[44px]"
            />
            <div className="grid grid-cols-2 gap-3 text-xs text-slate-600">
              <div>
                <label htmlFor="dest-lat" className="block font-semibold mb-1">
                  Lat
                </label>
                <input
                  id="dest-lat"
                  type="number"
                  step="any"
                  required
                  value={destLat}
                  onChange={(e) => setDestLat(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-2 min-h-[40px]"
                />
              </div>
              <div>
                <label htmlFor="dest-lng" className="block font-semibold mb-1">
                  Lng
                </label>
                <input
                  id="dest-lng"
                  type="number"
                  step="any"
                  required
                  value={destLng}
                  onChange={(e) => setDestLng(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-2 min-h-[40px]"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 text-sm transition-colors min-h-[48px] shadow-sm disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Play className="h-4 w-4" aria-hidden="true" />
            )}
            <span>{submitting ? 'Running Optimizer...' : 'Run Route Optimizer'}</span>
          </button>
        </form>

        {/* Destination Map Picker */}
        <div className="lg:col-span-3 space-y-3">
          <search className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
            <form onSubmit={handleSearchDestination} className="flex gap-2">
              <label htmlFor="dest-search" className="visually-hidden">
                Search destination campus
              </label>
              <input
                id="dest-search"
                type="search"
                value={placeQuery}
                onChange={(e) => setPlaceQuery(e.target.value)}
                placeholder="Search destination address or campus..."
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[44px]"
              />
              <button
                type="submit"
                disabled={searching}
                className="inline-flex items-center gap-1.5 rounded-lg bg-navy-900 hover:bg-navy-800 text-white px-4 py-2 text-sm font-semibold min-h-[44px]"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
                <span>{searching ? 'Searching...' : 'Search'}</span>
              </button>
            </form>

            {searchResults.length > 0 && (
              <ul className="mt-2 rounded-lg border border-slate-200 divide-y divide-slate-100 max-h-40 overflow-y-auto text-xs bg-slate-50">
                {searchResults.map((place) => (
                  <li key={place.place_id}>
                    <button
                      type="button"
                      onClick={() => {
                        setDestLat(Number(Number(place.lat).toFixed(6)));
                        setDestLng(Number(Number(place.lon).toFixed(6)));
                        setDestName(place.display_name.split(',')[0]);
                        setSearchResults([]);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-emerald-50"
                    >
                      {place.display_name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </search>

          <div className="rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700">
              Click map to relocate the destination campus marker
            </div>
            <MapContainer
              center={[Number(destLat), Number(destLng)]}
              zoom={12}
              className="h-[460px] w-full"
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <CenterSync lat={Number(destLat)} lng={Number(destLng)} />
              <DestPickerEvents
                onPick={(lat, lng) => {
                  setDestLat(Number(lat.toFixed(6)));
                  setDestLng(Number(lng.toFixed(6)));
                }}
              />
              <Marker position={[Number(destLat), Number(destLng)]} icon={createDestIcon()}>
                <Popup>
                  <div className="text-xs font-semibold">{destName}</div>
                </Popup>
              </Marker>
            </MapContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
