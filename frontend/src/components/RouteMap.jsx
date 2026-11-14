import { useEffect, useMemo, useState } from 'react';
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import { ROUTE_COLORS } from '../constants/demo.js';

function createStopIcon(color, label) {
  return L.divIcon({
    className: 'shuttleiq-stop-marker',
    html: `<div style="background:${color};color:#fff;width:26px;height:26px;border-radius:9999px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;border:2px solid #ffffff;box-shadow:0 2px 6px rgba(0,0,0,0.35);">${label}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function createDestinationIcon() {
  return L.divIcon({
    className: 'shuttleiq-dest-marker',
    html: `<div style="background:#0B132B;color:#10B981;width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;border:3px solid #10B981;box-shadow:0 3px 10px rgba(0,0,0,0.4);">HQ</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

function FitBounds({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!points || points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 13);
      return;
    }
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [36, 36] });
  }, [map, points]);

  return null;
}

async function fetchOsrmGeometry(waypoints, signal) {
  const coords = waypoints.map((p) => `${p.lng},${p.lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
  const data = await res.json();
  const rawCoords = data?.routes?.[0]?.geometry?.coordinates;
  if (!Array.isArray(rawCoords) || rawCoords.length < 2) {
    throw new Error('OSRM returned empty geometry');
  }
  return rawCoords.map(([lng, lat]) => [lat, lng]);
}

export default function RouteMap({
  routes = [],
  destination,
  unassignedRiders = [],
  heightClass = 'h-[460px]',
}) {
  const [geometries, setGeometries] = useState({});

  const destPoint = useMemo(() => {
    if (!destination) return null;
    return {
      name: destination.name || 'Destination',
      lat: Number(destination.lat),
      lng: Number(destination.lng),
    };
  }, [destination]);

  useEffect(() => {
    if (!destPoint || routes.length === 0) {
      setGeometries({});
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    async function loadAllRoutes() {
      const next = {};
      await Promise.all(
        routes.map(async (route, idx) => {
          const waypoints = [
            ...route.stops.map((s) => ({ lat: s.lat, lng: s.lng })),
            { lat: destPoint.lat, lng: destPoint.lng },
          ];
          if (waypoints.length < 2) return;

          const key = `${route.vehicleId}-${idx}`;
          try {
            const roadPositions = await fetchOsrmGeometry(waypoints, controller.signal);
            next[key] = { positions: roadPositions, isRoad: true };
          } catch {
            next[key] = {
              positions: waypoints.map((w) => [w.lat, w.lng]),
              isRoad: false,
            };
          }
        })
      );

      if (!cancelled) {
        setGeometries(next);
      }
    }

    loadAllRoutes();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [routes, destPoint]);

  const allPoints = useMemo(() => {
    const pts = [];
    if (destPoint) pts.push([destPoint.lat, destPoint.lng]);
    for (const r of routes) {
      for (const s of r.stops) {
        pts.push([s.lat, s.lng]);
      }
    }
    for (const u of unassignedRiders) {
      pts.push([u.lat, u.lng]);
    }
    return pts;
  }, [destPoint, routes, unassignedRiders]);

  const center = destPoint ? [destPoint.lat, destPoint.lng] : [12.9716, 77.5946];
  const anyFallback = Object.values(geometries).some((g) => !g.isRoad);

  return (
    <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm">
      <MapContainer
        center={center}
        zoom={12}
        className={`w-full ${heightClass}`}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={allPoints} />

        {routes.map((route, idx) => {
          const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];
          const key = `${route.vehicleId}-${idx}`;
          const geom = geometries[key];
          const fallbackPositions = [
            ...route.stops.map((s) => [s.lat, s.lng]),
            ...(destPoint ? [[destPoint.lat, destPoint.lng]] : []),
          ];
          const positions = geom?.positions || fallbackPositions;
          const isRoad = geom?.isRoad ?? false;

          return (
            <div key={key}>
              {positions.length >= 2 && (
                <Polyline
                  positions={positions}
                  pathOptions={{
                    color,
                    weight: 4,
                    opacity: 0.88,
                    dashArray: isRoad ? undefined : '8 6',
                  }}
                />
              )}

              {route.stops.map((stop) => (
                <Marker
                  key={stop.riderId}
                  position={[stop.lat, stop.lng]}
                  icon={createStopIcon(color, stop.order)}
                >
                  <Popup>
                    <div className="text-xs space-y-1">
                      <p className="font-bold text-slate-900">
                        Stop #{stop.order}: {stop.name}
                      </p>
                      <p className="text-slate-600">{stop.address}</p>
                      <p className="font-medium text-emerald-700">
                        {route.vehicleName} &bull; Pickup ETA {stop.eta}
                      </p>
                      <p className="text-slate-600">
                        Ride duration: {stop.rideMinutes} min
                      </p>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </div>
          );
        })}

        {unassignedRiders.map((rider) => (
          <Marker
            key={rider.id}
            position={[rider.lat, rider.lng]}
            icon={createStopIcon('#64748B', '!')}
          >
            <Popup>
              <div className="text-xs space-y-1">
                <p className="font-bold text-rose-700">Unassigned: {rider.name}</p>
                <p className="text-slate-600">{rider.address}</p>
                <p className="text-rose-600">{rider.reason}</p>
              </div>
            </Popup>
          </Marker>
        ))}

        {destPoint && (
          <Marker
            position={[destPoint.lat, destPoint.lng]}
            icon={createDestinationIcon()}
          >
            <Popup>
              <div className="text-xs">
                <p className="font-bold text-slate-900">{destPoint.name}</p>
                <p className="text-emerald-700 font-medium">Destination Campus</p>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-600">
        <div className="flex flex-wrap items-center gap-3">
          {routes.map((r, idx) => (
            <span key={r.vehicleId} className="inline-flex items-center gap-1.5 font-medium">
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ backgroundColor: ROUTE_COLORS[idx % ROUTE_COLORS.length] }}
                aria-hidden="true"
              />
              {r.vehicleName} ({r.riderCount}/{r.capacity})
            </span>
          ))}
        </div>
        <span className="text-slate-500">
          {anyFallback
            ? 'Dashed segments = straight-line fallback (OSRM unavailable)'
            : 'Road geometry via OSRM'}
        </span>
      </div>
    </div>
  );
}
