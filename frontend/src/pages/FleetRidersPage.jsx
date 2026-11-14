import { useCallback, useEffect, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Bus, Loader2, MapPin, Plus, Search, Trash2, Users } from 'lucide-react';
import { apiClient, extractErrorMessage } from '../api/client.js';
import { DEMO_CAMPUS } from '../constants/demo.js';

function createPinIcon(color = '#10B981') {
  return L.divIcon({
    className: 'shuttleiq-pin',
    html: `<div style="background:${color};width:18px;height:18px;border-radius:9999px;border:3px solid #ffffff;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function MapClickPicker({ onSelect }) {
  useMapEvents({
    click(e) {
      onSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapCenterUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, 13);
    }
  }, [map, center]);
  return null;
}

export default function FleetRidersPage() {
  const [vehicles, setVehicles] = useState([]);
  const [riders, setRiders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  // Vehicle form state
  const [vName, setVName] = useState('');
  const [vCapacity, setVCapacity] = useState(14);
  const [vDriver, setVDriver] = useState('');
  const [addingVehicle, setAddingVehicle] = useState(false);

  // Rider form state
  const [rName, setRName] = useState('');
  const [rAddress, setRAddress] = useState('');
  const [rLat, setRLat] = useState(DEMO_CAMPUS.lat);
  const [rLng, setRLng] = useState(DEMO_CAMPUS.lng);
  const [addingRider, setAddingRider] = useState(false);

  // Nominatim search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [mapCenter, setMapCenter] = useState([DEMO_CAMPUS.lat, DEMO_CAMPUS.lng]);

  const loadData = useCallback(async () => {
    setError('');
    try {
      const [vRes, rRes] = await Promise.all([
        apiClient.get('/vehicles'),
        apiClient.get('/riders'),
      ]);
      setVehicles(vRes.data.vehicles || []);
      setRiders(rRes.data.riders || []);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load fleet and riders'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleAddVehicle(e) {
    e.preventDefault();
    setAddingVehicle(true);
    setError('');
    setStatusMsg('');
    try {
      const res = await apiClient.post('/vehicles', {
        name: vName.trim(),
        capacity: Number(vCapacity),
        driver_name: vDriver.trim(),
      });
      setVehicles((prev) => [...prev, res.data.vehicle]);
      setVName('');
      setVDriver('');
      setVCapacity(14);
      setStatusMsg(`Added vehicle ${res.data.vehicle.name}.`);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to add vehicle'));
    } finally {
      setAddingVehicle(false);
    }
  }

  async function handleDeleteVehicle(id) {
    setError('');
    try {
      await apiClient.delete(`/vehicles/${id}`);
      setVehicles((prev) => prev.filter((v) => v.id !== id));
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to remove vehicle'));
    }
  }

  async function handleSearchPlace(e) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    setError('');
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(
        searchQuery.trim()
      )}`;
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error('Geocoding service returned an error');
      const items = await res.json();
      setSearchResults(Array.isArray(items) ? items : []);
      if (items.length === 0) {
        setStatusMsg('No places matched that search. You can also click directly on the map.');
      }
    } catch (err) {
      setError(err.message || 'Place lookup failed');
    } finally {
      setSearching(false);
    }
  }

  function handleSelectPlace(place) {
    const lat = Number(Number(place.lat).toFixed(6));
    const lng = Number(Number(place.lon).toFixed(6));
    setRLat(lat);
    setRLng(lng);
    setRAddress(place.display_name.slice(0, 180));
    setMapCenter([lat, lng]);
    setSearchResults([]);
  }

  function handleMapClick(lat, lng) {
    const roundedLat = Number(lat.toFixed(6));
    const roundedLng = Number(lng.toFixed(6));
    setRLat(roundedLat);
    setRLng(roundedLng);
    if (!rAddress.trim()) {
      setRAddress(`Pin (${roundedLat}, ${roundedLng})`);
    }
  }

  async function handleAddRider(e) {
    e.preventDefault();
    setAddingRider(true);
    setError('');
    setStatusMsg('');
    try {
      const res = await apiClient.post('/riders', {
        name: rName.trim(),
        address: rAddress.trim() || `Stop (${rLat}, ${rLng})`,
        lat: Number(rLat),
        lng: Number(rLng),
      });
      setRiders((prev) => [...prev, res.data.rider]);
      setRName('');
      setRAddress('');
      setStatusMsg(`Added rider ${res.data.rider.name}.`);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to add rider'));
    } finally {
      setAddingRider(false);
    }
  }

  async function handleDeleteRider(id) {
    setError('');
    try {
      await apiClient.delete(`/riders/${id}`);
      setRiders((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to remove rider'));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-600 gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-emerald-600" aria-hidden="true" />
        <span className="text-sm font-medium">Loading fleet and riders...</span>
      </div>
    );
  }

  const totalSeats = vehicles.reduce((s, v) => s + Number(v.capacity || 0), 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Fleet &amp; Rider Roster
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Configure shuttle capacities and place rider pickup stops by clicking the map or
          searching Nominatim.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800"
        >
          {error}
        </div>
      )}

      {statusMsg && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900"
        >
          {statusMsg}
        </div>
      )}

      {/* Vehicles Section */}
      <section aria-labelledby="vehicles-heading" className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 rounded-xl bg-white border border-slate-200 p-5 shadow-sm">
          <h2 id="vehicles-heading" className="text-base font-bold text-slate-900 flex items-center gap-2 mb-4">
            <Bus className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            <span>Add Shuttle Vehicle</span>
          </h2>

          <form onSubmit={handleAddVehicle} className="space-y-4">
            <div>
              <label htmlFor="v-name" className="block text-sm font-semibold text-slate-700 mb-1">
                Vehicle name
              </label>
              <input
                id="v-name"
                name="vehicleName"
                type="text"
                required
                value={vName}
                onChange={(e) => setVName(e.target.value)}
                placeholder="Shuttle Echo"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[44px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="v-cap" className="block text-sm font-semibold text-slate-700 mb-1">
                  Seats (1–60)
                </label>
                <input
                  id="v-cap"
                  name="capacity"
                  type="number"
                  required
                  min={1}
                  max={60}
                  value={vCapacity}
                  onChange={(e) => setVCapacity(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[44px]"
                />
              </div>
              <div>
                <label htmlFor="v-driver" className="block text-sm font-semibold text-slate-700 mb-1">
                  Driver name
                </label>
                <input
                  id="v-driver"
                  name="driverName"
                  type="text"
                  value={vDriver}
                  onChange={(e) => setVDriver(e.target.value)}
                  placeholder="Optional"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[44px]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={addingVehicle}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-navy-900 hover:bg-navy-800 text-white font-semibold py-2.5 px-4 text-sm min-h-[44px] disabled:opacity-60"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>{addingVehicle ? 'Adding...' : 'Add Vehicle'}</span>
            </button>
          </form>
        </div>

        <div className="lg:col-span-3 rounded-xl bg-white border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold text-slate-900">
              Active Fleet ({vehicles.length} vehicles &bull; {totalSeats} seats)
            </h3>
          </div>

          {vehicles.length === 0 ? (
            <p className="text-sm text-slate-500 py-6">
              No vehicles added yet. Add a vehicle on the left or load demo data from the
              Dashboard.
            </p>
          ) : (
            <div
              tabIndex={0}
              role="region"
              aria-labelledby="fleet-table-caption"
              className="table-wrapper max-h-72 border border-slate-200 rounded-lg"
            >
              <table className="w-full text-left text-sm">
                <caption id="fleet-table-caption" className="visually-hidden">
                  Shuttle fleet vehicles and seat capacities
                </caption>
                <thead className="bg-slate-50 text-slate-600 text-xs uppercase border-b border-slate-200">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">Vehicle</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Capacity</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Driver</th>
                    <th scope="col" className="px-4 py-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {vehicles.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50">
                      <th scope="row" className="px-4 py-3 font-semibold text-slate-900">
                        {v.name}
                      </th>
                      <td className="px-4 py-3 text-slate-700">{v.capacity} seats</td>
                      <td className="px-4 py-3 text-slate-600">
                        {v.driver_name || 'Unassigned'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteVehicle(v.id)}
                          aria-label={`Remove ${v.name}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-800 px-2 py-1 rounded"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Remove</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Riders & Map Section */}
      <section aria-labelledby="riders-heading" className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 rounded-xl bg-white border border-slate-200 p-5 shadow-sm space-y-4">
          <h2 id="riders-heading" className="text-base font-bold text-slate-900 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            <span>Add Rider Stop</span>
          </h2>

          {/* Nominatim search */}
          <search>
            <form onSubmit={handleSearchPlace} className="space-y-2">
              <label htmlFor="place-search" className="block text-xs font-semibold text-slate-600">
                Search place via OpenStreetMap Nominatim
              </label>
              <div className="flex gap-2">
                <input
                  id="place-search"
                  name="placeSearch"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Indiranagar, Bengaluru..."
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[44px]"
                />
                <button
                  type="submit"
                  disabled={searching}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white px-3 py-2 text-xs font-semibold min-h-[44px]"
                >
                  <Search className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{searching ? '...' : 'Find'}</span>
                </button>
              </div>
            </form>
          </search>

          {searchResults.length > 0 && (
            <ul className="rounded-lg border border-slate-200 divide-y divide-slate-100 max-h-40 overflow-y-auto text-xs bg-slate-50">
              {searchResults.map((place) => (
                <li key={place.place_id}>
                  <button
                    type="button"
                    onClick={() => handleSelectPlace(place)}
                    className="w-full text-left px-3 py-2 hover:bg-emerald-50 text-slate-800"
                  >
                    {place.display_name}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={handleAddRider} className="space-y-3 pt-2 border-t border-slate-100">
            <div>
              <label htmlFor="r-name" className="block text-sm font-semibold text-slate-700 mb-1">
                Rider full name
              </label>
              <input
                id="r-name"
                name="riderName"
                type="text"
                required
                value={rName}
                onChange={(e) => setRName(e.target.value)}
                placeholder="Ananya Rao"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[44px]"
              />
            </div>

            <div>
              <label htmlFor="r-address" className="block text-sm font-semibold text-slate-700 mb-1">
                Pickup address / landmark
              </label>
              <input
                id="r-address"
                name="riderAddress"
                type="text"
                required
                value={rAddress}
                onChange={(e) => setRAddress(e.target.value)}
                placeholder="Click map or search above"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[44px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="r-lat" className="block text-xs font-semibold text-slate-600 mb-1">
                  Latitude
                </label>
                <input
                  id="r-lat"
                  name="lat"
                  type="number"
                  step="any"
                  required
                  value={rLat}
                  onChange={(e) => setRLat(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs min-h-[42px]"
                />
              </div>
              <div>
                <label htmlFor="r-lng" className="block text-xs font-semibold text-slate-600 mb-1">
                  Longitude
                </label>
                <input
                  id="r-lng"
                  name="lng"
                  type="number"
                  step="any"
                  required
                  value={rLng}
                  onChange={(e) => setRLng(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs min-h-[42px]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={addingRider}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 text-sm min-h-[44px] disabled:opacity-60"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>{addingRider ? 'Saving Rider...' : 'Add Rider Stop'}</span>
            </button>
          </form>
        </div>

        <div className="lg:col-span-3 space-y-4">
          <div className="rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700 flex items-center justify-between">
              <span>Click anywhere on the map to set new rider coordinates</span>
              <span className="text-emerald-700">{riders.length} riders plotted</span>
            </div>
            <MapContainer
              center={mapCenter}
              zoom={12}
              className="h-80 w-full"
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapClickPicker onSelect={handleMapClick} />
              <MapCenterUpdater center={mapCenter} />

              <Marker
                position={[Number(rLat) || DEMO_CAMPUS.lat, Number(rLng) || DEMO_CAMPUS.lng]}
                icon={createPinIcon('#0B132B')}
              >
                <Popup>New rider pin location</Popup>
              </Marker>

              {riders.map((r) => (
                <Marker
                  key={r.id}
                  position={[r.lat, r.lng]}
                  icon={createPinIcon('#10B981')}
                >
                  <Popup>
                    <div className="text-xs">
                      <p className="font-bold">{r.name}</p>
                      <p className="text-slate-600">{r.address}</p>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>

          <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              <span>Registered Riders ({riders.length})</span>
            </h3>

            {riders.length === 0 ? (
              <p className="text-sm text-slate-500 py-4">
                No riders registered yet. Click the map on the left to add stops or seed demo
                riders from the Dashboard.
              </p>
            ) : (
              <div
                tabIndex={0}
                role="region"
                aria-labelledby="riders-table-caption"
                className="table-wrapper max-h-72 border border-slate-200 rounded-lg"
              >
                <table className="w-full text-left text-sm">
                  <caption id="riders-table-caption" className="visually-hidden">
                    Registered rider pickup stops
                  </caption>
                  <thead className="bg-slate-50 text-slate-600 text-xs uppercase border-b border-slate-200">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-semibold">Rider</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Pickup Address</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Coordinates</th>
                      <th scope="col" className="px-4 py-3 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {riders.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <th scope="row" className="px-4 py-3 font-semibold text-slate-900">
                          {r.name}
                        </th>
                        <td className="px-4 py-3 text-slate-600 max-w-xs truncate">
                          {r.address}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 font-mono">
                          {Number(r.lat).toFixed(4)}, {Number(r.lng).toFixed(4)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteRider(r.id)}
                            aria-label={`Remove ${r.name}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-800 px-2 py-1 rounded"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Remove</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
