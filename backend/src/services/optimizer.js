import {
  WEATHER_FACTORS,
  INCIDENT_FACTORS,
  getCongestionMultiplier,
  predictRouteRisk,
} from './predictor.js';

export const ROAD_FACTOR = 1.35;
export const BASE_SPEED_KMH = 32;
export const DWELL_MIN = 1.5;
export const MAX_RIDE_LIMIT_MIN = 50;

const FIXED_VEHICLE_COST = 28;
const RIDE_COMFORT_WEIGHT = 0.35;
const OVER_LIMIT_BASE_PENALTY = 120;
const OVER_LIMIT_PER_MIN_PENALTY = 8;

const EARTH_RADIUS_KM = 6371;

export function toRadians(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Great-circle distance in kilometers between two { lat, lng } points.
 */
export function haversineKm(a, b) {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Estimated road distance in kilometers using circuity factor 1.35.
 */
export function roadDistanceKm(a, b) {
  return haversineKm(a, b) * ROAD_FACTOR;
}

/**
 * Parses 'HH:MM' into minutes since midnight.
 */
export function parseTimeToMinutes(hhmm) {
  const [hStr, mStr] = String(hhmm).split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) {
    throw new Error(`Invalid time format: ${hhmm}`);
  }
  return h * 60 + m;
}

/**
 * Formats minutes since midnight into 'HH:MM' (24-hour, wraps modulo 1440).
 */
export function formatMinutesToTime(minutes) {
  const rounded = Math.round(minutes);
  const normalized = ((rounded % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Travel time in minutes for a single road leg given departure minute and conditions.
 */
export function legTravelMinutes(from, to, departureMin, conditions = {}) {
  const distKm = roadDistanceKm(from, to);
  const congestion = getCongestionMultiplier(departureMin);
  const weatherFactor = WEATHER_FACTORS[conditions.weather] ?? 1.0;
  const incidentFactor = INCIDENT_FACTORS[conditions.incident] ?? 1.0;
  const multiplier = congestion * weatherFactor * incidentFactor;
  const effectiveSpeed = BASE_SPEED_KMH / multiplier;
  const travelMin = (distKm / effectiveSpeed) * 60;
  return {
    distKm,
    congestion,
    travelMin,
  };
}

/**
 * Computes total path distance from stops[0] -> ... -> stops[n-1] -> dest.
 */
function pathDistanceKm(stops, dest) {
  if (stops.length === 0) return 0;
  let total = 0;
  for (let i = 0; i < stops.length - 1; i += 1) {
    total += roadDistanceKm(stops[i], stops[i + 1]);
  }
  total += roadDistanceKm(stops[stops.length - 1], dest);
  return total;
}

/**
 * Orders stops in a cluster:
 * 1. Start at the rider farthest from the destination.
 * 2. Nearest-neighbour construction across remaining stops.
 * 3. 2-opt local improvement keeping stops[0] fixed and destination as fixed end.
 */
export function orderClusterStops(riders, dest) {
  if (riders.length <= 1) return [...riders];

  // 1. Start at the rider farthest from destination
  let farthestIdx = 0;
  let maxDist = -1;
  for (let i = 0; i < riders.length; i += 1) {
    const d = roadDistanceKm(riders[i], dest);
    if (d > maxDist) {
      maxDist = d;
      farthestIdx = i;
    }
  }

  const remaining = riders.filter((_, idx) => idx !== farthestIdx);
  const ordered = [riders[farthestIdx]];

  // 2. Nearest-neighbour tour
  while (remaining.length > 0) {
    const current = ordered[ordered.length - 1];
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i += 1) {
      const d = roadDistanceKm(current, remaining[i]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    ordered.push(remaining.splice(bestIdx, 1)[0]);
  }

  // 3. 2-opt refinement with fixed start (index 0) and fixed end (dest)
  if (ordered.length >= 3) {
    let improved = true;
    let guard = 0;
    while (improved && guard < 100) {
      improved = false;
      guard += 1;
      for (let i = 1; i < ordered.length - 1; i += 1) {
        for (let j = i + 1; j < ordered.length; j += 1) {
          const prevNode = ordered[i - 1];
          const nextNode = j + 1 < ordered.length ? ordered[j + 1] : dest;

          const currentEdges =
            roadDistanceKm(prevNode, ordered[i]) +
            roadDistanceKm(ordered[j], nextNode);
          const swappedEdges =
            roadDistanceKm(prevNode, ordered[j]) +
            roadDistanceKm(ordered[i], nextNode);

          if (swappedEdges + 1e-9 < currentEdges) {
            // Reverse slice [i..j]
            let left = i;
            let right = j;
            while (left < right) {
              const tmp = ordered[left];
              ordered[left] = ordered[right];
              ordered[right] = tmp;
              left += 1;
              right -= 1;
            }
            improved = true;
          }
        }
      }
    }
  }

  return ordered;
}

/**
 * Forward simulation of a route given a candidate departure minute at stop[0].
 */
function simulateRouteFromDeparture(orderedStops, dest, depMin, conditions) {
  let cursorMin = depMin;
  let totalDistKm = 0;
  let weightedCongestionSum = 0;
  let totalDrivingMin = 0;

  const stopTimings = [];

  for (let i = 0; i < orderedStops.length; i += 1) {
    const stop = orderedStops[i];
    const etaMin = cursorMin;
    cursorMin += DWELL_MIN;

    const nextTarget = i + 1 < orderedStops.length ? orderedStops[i + 1] : dest;
    const leg = legTravelMinutes(stop, nextTarget, cursorMin, conditions);
    totalDistKm += leg.distKm;
    totalDrivingMin += leg.travelMin;
    weightedCongestionSum += leg.congestion * leg.travelMin;
    cursorMin += leg.travelMin;

    stopTimings.push({
      rider: stop,
      etaMin,
      legDistanceKm: Number(leg.distKm.toFixed(2)),
      legTravelMin: Number(leg.travelMin.toFixed(1)),
    });
  }

  const arrivalMin = cursorMin;
  const avgCongestion =
    totalDrivingMin > 0 ? weightedCongestionSum / totalDrivingMin : 1.0;

  return {
    arrivalMin,
    totalDistKm,
    avgCongestion,
    stopTimings,
  };
}

/**
 * Solves each route's departure time by fixed-point iteration so that
 * destination arrival equals (arrivalDeadlineMin - bufferMin).
 */
export function scheduleRoute({
  vehicle,
  orderedStops,
  dest,
  arrivalDeadlineMin,
  bufferMin,
  conditions,
}) {
  const targetArrivalMin = arrivalDeadlineMin - bufferMin;

  if (orderedStops.length === 0) {
    return {
      vehicleId: vehicle.id,
      vehicleName: vehicle.name,
      driverName: vehicle.driver_name ?? vehicle.driverName ?? '',
      capacity: vehicle.capacity,
      riderCount: 0,
      utilizationPct: 0,
      departureTime: formatMinutesToTime(targetArrivalMin),
      departureMin: targetArrivalMin,
      arrivalTime: formatMinutesToTime(targetArrivalMin),
      arrivalMin: targetArrivalMin,
      distanceKm: 0,
      durationMin: 0,
      avgRideMin: 0,
      maxRideMin: 0,
      avgCongestion: 1.0,
      stops: [],
      risk: predictRouteRisk({
        durationMin: 0,
        bufferMin,
        weather: conditions.weather,
        incident: conditions.incident,
        avgCongestion: 1.0,
      }),
    };
  }

  // Initial guess: estimate constant congestion at target arrival minus 30 min
  const initialSim = simulateRouteFromDeparture(
    orderedStops,
    dest,
    targetArrivalMin - 30,
    conditions
  );
  let depMin =
    targetArrivalMin - (initialSim.arrivalMin - (targetArrivalMin - 30));

  let sim = initialSim;
  for (let iter = 0; iter < 30; iter += 1) {
    sim = simulateRouteFromDeparture(orderedStops, dest, depMin, conditions);
    const error = sim.arrivalMin - targetArrivalMin;
    if (Math.abs(error) < 1e-4) {
      break;
    }
    depMin -= error;
  }

  // Final simulation at converged depMin
  sim = simulateRouteFromDeparture(orderedStops, dest, depMin, conditions);

  const durationMin = Number((targetArrivalMin - depMin).toFixed(1));
  const stops = sim.stopTimings.map((item, idx) => {
    const rideMinutes = Number((targetArrivalMin - item.etaMin).toFixed(1));
    return {
      order: idx + 1,
      riderId: item.rider.id,
      name: item.rider.name,
      address: item.rider.address,
      lat: item.rider.lat,
      lng: item.rider.lng,
      eta: formatMinutesToTime(item.etaMin),
      etaMin: Number(item.etaMin.toFixed(2)),
      rideMinutes,
      legDistanceKm: item.legDistanceKm,
      legTravelMin: item.legTravelMin,
    };
  });

  const rideTimes = stops.map((s) => s.rideMinutes);
  const avgRideMin =
    rideTimes.length > 0
      ? Number(
          (rideTimes.reduce((a, b) => a + b, 0) / rideTimes.length).toFixed(1)
        )
      : 0;
  const maxRideMin =
    rideTimes.length > 0 ? Number(Math.max(...rideTimes).toFixed(1)) : 0;

  const risk = predictRouteRisk({
    durationMin,
    bufferMin,
    weather: conditions.weather,
    incident: conditions.incident,
    avgCongestion: sim.avgCongestion,
  });

  return {
    vehicleId: vehicle.id,
    vehicleName: vehicle.name,
    driverName: vehicle.driver_name ?? vehicle.driverName ?? '',
    capacity: vehicle.capacity,
    riderCount: stops.length,
    utilizationPct: Number(((stops.length / vehicle.capacity) * 100).toFixed(1)),
    departureTime: formatMinutesToTime(depMin),
    departureMin: Number(depMin.toFixed(2)),
    arrivalTime: formatMinutesToTime(targetArrivalMin),
    arrivalMin: Number(targetArrivalMin.toFixed(2)),
    distanceKm: Number(sim.totalDistKm.toFixed(2)),
    durationMin,
    avgRideMin,
    maxRideMin,
    avgCongestion: Number(sim.avgCongestion.toFixed(3)),
    stops,
    risk,
  };
}

/**
 * Farthest-point seeding for k clusters.
 * Picks first seed farthest from destination, then iteratively picks the rider
 * maximizing minimum road distance to already-chosen seeds.
 */
function farthestPointSeeds(riders, k, dest) {
  const seeds = [];
  const usedIndices = new Set();

  let firstIdx = 0;
  let maxDistDest = -1;
  for (let i = 0; i < riders.length; i += 1) {
    const d = roadDistanceKm(riders[i], dest);
    if (d > maxDistDest) {
      maxDistDest = d;
      firstIdx = i;
    }
  }
  seeds.push({ lat: riders[firstIdx].lat, lng: riders[firstIdx].lng });
  usedIndices.add(firstIdx);

  while (seeds.length < k) {
    let bestIdx = -1;
    let bestMinDist = -1;
    for (let i = 0; i < riders.length; i += 1) {
      if (usedIndices.has(i)) continue;
      let minDist = Infinity;
      for (const s of seeds) {
        const d = roadDistanceKm(riders[i], s);
        if (d < minDist) minDist = d;
      }
      if (minDist > bestMinDist) {
        bestMinDist = minDist;
        bestIdx = i;
      }
    }
    if (bestIdx === -1) break;
    seeds.push({ lat: riders[bestIdx].lat, lng: riders[bestIdx].lng });
    usedIndices.add(bestIdx);
  }

  return seeds;
}

/**
 * Capacity-constrained regret-based assignment with centroid refinement.
 */
function clusterRidersIntoVehicles(riders, selectedVehicles, dest) {
  const k = selectedVehicles.length;
  let centroids = farthestPointSeeds(riders, k, dest);

  let finalClusters = Array.from({ length: k }, () => []);
  let finalUnassigned = [];

  for (let iter = 0; iter < 6; iter += 1) {
    const clusters = Array.from({ length: k }, () => []);
    const remainingCap = selectedVehicles.map((v) => v.capacity);
    const unassigned = [];

    // Compute distances and 2-best regret for each rider
    const riderEntries = riders.map((rider) => {
      const dists = centroids.map((c, cIdx) => ({
        cIdx,
        dist: roadDistanceKm(rider, c),
      }));
      dists.sort((a, b) => a.dist - b.dist);
      const bestDist = dists[0]?.dist ?? 0;
      const secondDist = dists[1]?.dist ?? bestDist;
      const regret = secondDist - bestDist;
      const destDist = roadDistanceKm(rider, dest);
      return { rider, dists, regret, destDist };
    });

    // Assign highest-regret riders first so constrained border riders get priority
    riderEntries.sort((a, b) => {
      if (Math.abs(b.regret - a.regret) > 1e-6) return b.regret - a.regret;
      return b.destDist - a.destDist;
    });

    for (const entry of riderEntries) {
      let placed = false;
      for (const option of entry.dists) {
        if (remainingCap[option.cIdx] > 0) {
          clusters[option.cIdx].push(entry.rider);
          remainingCap[option.cIdx] -= 1;
          placed = true;
          break;
        }
      }
      if (!placed) {
        unassigned.push(entry.rider);
      }
    }

    finalClusters = clusters;
    finalUnassigned = unassigned;

    // Refine centroids
    let moved = false;
    const nextCentroids = centroids.map((prev, idx) => {
      const members = clusters[idx];
      if (members.length === 0) return prev;
      const avgLat = members.reduce((s, r) => s + r.lat, 0) / members.length;
      const avgLng = members.reduce((s, r) => s + r.lng, 0) / members.length;
      if (Math.abs(avgLat - prev.lat) > 1e-6 || Math.abs(avgLng - prev.lng) > 1e-6) {
        moved = true;
      }
      return { lat: avgLat, lng: avgLng };
    });

    centroids = nextCentroids;
    if (!moved && iter >= 1) break;
  }

  return { clusters: finalClusters, unassigned: finalUnassigned };
}

/**
 * Evaluates total plan objective cost for a candidate set of scheduled routes.
 */
function computePlanCost(routes) {
  let totalCost = 0;
  for (const route of routes) {
    if (route.riderCount === 0) continue;
    totalCost += route.durationMin + FIXED_VEHICLE_COST;
    for (const stop of route.stops) {
      totalCost += stop.rideMinutes * RIDE_COMFORT_WEIGHT;
      if (stop.rideMinutes > MAX_RIDE_LIMIT_MIN) {
        totalCost +=
          OVER_LIMIT_BASE_PENALTY +
          (stop.rideMinutes - MAX_RIDE_LIMIT_MIN) * OVER_LIMIT_PER_MIN_PENALTY;
      }
    }
  }
  return totalCost;
}

/**
 * Aggregates summary metrics across active routes.
 */
function summarizeRoutes(routes, totalFleetCapacity, unassignedCount) {
  const activeRoutes = routes.filter((r) => r.riderCount > 0);
  const totalDistanceKm = Number(
    activeRoutes.reduce((s, r) => s + r.distanceKm, 0).toFixed(2)
  );
  const totalDurationMin = Number(
    activeRoutes.reduce((s, r) => s + r.durationMin, 0).toFixed(1)
  );

  const allStops = activeRoutes.flatMap((r) => r.stops);
  const assignedRiders = allStops.length;
  const avgRideMin =
    assignedRiders > 0
      ? Number(
          (
            allStops.reduce((s, st) => s + st.rideMinutes, 0) / assignedRiders
          ).toFixed(1)
        )
      : 0;
  const maxRideMin =
    assignedRiders > 0
      ? Number(Math.max(...allStops.map((st) => st.rideMinutes)).toFixed(1))
      : 0;

  const activeCapacity = activeRoutes.reduce((s, r) => s + r.capacity, 0);
  const utilizationPct =
    activeCapacity > 0
      ? Number(((assignedRiders / activeCapacity) * 100).toFixed(1))
      : 0;
  const fleetUtilizationPct =
    totalFleetCapacity > 0
      ? Number(((assignedRiders / totalFleetCapacity) * 100).toFixed(1))
      : 0;

  const worstRiskScore =
    activeRoutes.length > 0
      ? Math.max(...activeRoutes.map((r) => r.risk.score))
      : 0;
  const worstRiskLevel =
    worstRiskScore >= 35 ? 'high' : worstRiskScore >= 15 ? 'medium' : 'low';

  return {
    vehiclesUsed: activeRoutes.length,
    assignedRiders,
    unassignedCount,
    totalDistanceKm,
    totalDurationMin,
    avgRideMin,
    maxRideMin,
    utilizationPct,
    fleetUtilizationPct,
    worstRiskScore,
    worstRiskLevel,
  };
}

/**
 * Baseline ("sign-up-order roster"):
 * Fills vehicles sequentially in rider input order and visits stops in that exact order.
 */
function buildSignUpOrderBaseline({
  vehicles,
  riders,
  dest,
  arrivalDeadlineMin,
  bufferMin,
  conditions,
}) {
  if (riders.length === 0 || vehicles.length === 0) {
    return {
      label: 'sign-up-order roster',
      routes: [],
      summary: summarizeRoutes([], 0, riders.length),
    };
  }

  const routes = [];
  let cursor = 0;

  for (const vehicle of vehicles) {
    if (cursor >= riders.length) break;
    const chunk = riders.slice(cursor, cursor + vehicle.capacity);
    cursor += chunk.length;
    if (chunk.length > 0) {
      routes.push(
        scheduleRoute({
          vehicle,
          orderedStops: chunk,
          dest,
          arrivalDeadlineMin,
          bufferMin,
          conditions,
        })
      );
    }
  }

  const totalFleetCapacity = vehicles.reduce((s, v) => s + v.capacity, 0);
  const unassignedCount = Math.max(0, riders.length - cursor);

  return {
    label: 'sign-up-order roster',
    routes,
    summary: summarizeRoutes(routes, totalFleetCapacity, unassignedCount),
  };
}

/**
 * Main ShuttleIQ route optimizer.
 * Pure JS, deterministic, capacity-aware, traffic & weather scheduled.
 */
export function optimizePlan({
  vehicles = [],
  riders = [],
  destination,
  arrivalTime = '08:30',
  bufferMin = 10,
  conditions = { weather: 'clear', incident: 'none' },
}) {
  const dest = {
    name: destination?.name ?? 'Destination',
    lat: Number(destination?.lat),
    lng: Number(destination?.lng),
  };
  const arrivalDeadlineMin = parseTimeToMinutes(arrivalTime);
  const safeBufferMin = Math.max(0, Number(bufferMin) || 0);
  const safeConditions = {
    weather: conditions?.weather ?? 'clear',
    incident: conditions?.incident ?? 'none',
  };

  // Sort vehicles by capacity DESC so kMin uses largest vehicles first
  const sortedVehicles = [...vehicles].sort((a, b) => b.capacity - a.capacity);
  const totalFleetCapacity = sortedVehicles.reduce(
    (s, v) => s + Number(v.capacity || 0),
    0
  );

  // Edge case: 0 riders or 0 vehicles
  if (riders.length === 0 || sortedVehicles.length === 0 || totalFleetCapacity === 0) {
    const baseline = buildSignUpOrderBaseline({
      vehicles: sortedVehicles,
      riders,
      dest,
      arrivalDeadlineMin,
      bufferMin: safeBufferMin,
      conditions: safeConditions,
    });
    const unassignedRiders = riders.map((r) => ({
      id: r.id,
      name: r.name,
      address: r.address,
      lat: r.lat,
      lng: r.lng,
      reason: sortedVehicles.length === 0 ? 'No vehicles available' : 'Insufficient capacity',
    }));
    return {
      destination: dest,
      arrivalTime,
      bufferMin: safeBufferMin,
      conditions: safeConditions,
      routes: [],
      unassignedRiders,
      summary: summarizeRoutes([], totalFleetCapacity, unassignedRiders.length),
      baseline: {
        label: baseline.label,
        summary: baseline.summary,
      },
      savings: {
        baselineLabel: baseline.label,
        distanceSavedKm: 0,
        distanceSavedPct: 0,
        vehicleMinutesSaved: 0,
        vehicleMinutesSavedPct: 0,
        avgRideSavedMin: 0,
        avgRideSavedPct: 0,
      },
    };
  }

  // Determine minimum feasible fleet size kMin
  const assignableTarget = Math.min(riders.length, totalFleetCapacity);
  let kMin = 0;
  let runningCap = 0;
  for (let i = 0; i < sortedVehicles.length; i += 1) {
    runningCap += sortedVehicles[i].capacity;
    kMin = i + 1;
    if (runningCap >= assignableTarget) break;
  }

  const kMax = Math.min(sortedVehicles.length, riders.length);

  let bestCandidate = null;

  for (let k = kMin; k <= kMax; k += 1) {
    const selectedVehicles = sortedVehicles.slice(0, k);
    const { clusters, unassigned } = clusterRidersIntoVehicles(
      riders,
      selectedVehicles,
      dest
    );

    const routes = [];
    for (let i = 0; i < k; i += 1) {
      if (clusters[i].length === 0) continue;
      const orderedStops = orderClusterStops(clusters[i], dest);
      const scheduled = scheduleRoute({
        vehicle: selectedVehicles[i],
        orderedStops,
        dest,
        arrivalDeadlineMin,
        bufferMin: safeBufferMin,
        conditions: safeConditions,
      });
      routes.push(scheduled);
    }

    const cost = computePlanCost(routes);
    if (!bestCandidate || cost < bestCandidate.cost) {
      bestCandidate = {
        k,
        cost,
        routes,
        unassigned,
      };
    }
  }

  const bestRoutes = bestCandidate.routes;
  const unassignedRiders = bestCandidate.unassigned.map((r) => ({
    id: r.id,
    name: r.name,
    address: r.address,
    lat: r.lat,
    lng: r.lng,
    reason: 'Exceeds total fleet seat capacity',
  }));

  const summary = summarizeRoutes(
    bestRoutes,
    totalFleetCapacity,
    unassignedRiders.length
  );

  // Baseline comparison (using input vehicle order as sign-up-order roster)
  const baseline = buildSignUpOrderBaseline({
    vehicles,
    riders,
    dest,
    arrivalDeadlineMin,
    bufferMin: safeBufferMin,
    conditions: safeConditions,
  });

  const distanceSavedKm = Number(
    (baseline.summary.totalDistanceKm - summary.totalDistanceKm).toFixed(2)
  );
  const distanceSavedPct =
    baseline.summary.totalDistanceKm > 0
      ? Number(
          ((distanceSavedKm / baseline.summary.totalDistanceKm) * 100).toFixed(1)
        )
      : 0;

  const vehicleMinutesSaved = Number(
    (baseline.summary.totalDurationMin - summary.totalDurationMin).toFixed(1)
  );
  const vehicleMinutesSavedPct =
    baseline.summary.totalDurationMin > 0
      ? Number(
          (
            (vehicleMinutesSaved / baseline.summary.totalDurationMin) *
            100
          ).toFixed(1)
        )
      : 0;

  const avgRideSavedMin = Number(
    (baseline.summary.avgRideMin - summary.avgRideMin).toFixed(1)
  );
  const avgRideSavedPct =
    baseline.summary.avgRideMin > 0
      ? Number(
          ((avgRideSavedMin / baseline.summary.avgRideMin) * 100).toFixed(1)
        )
      : 0;

  return {
    destination: dest,
    arrivalTime,
    bufferMin: safeBufferMin,
    conditions: safeConditions,
    routes: bestRoutes,
    unassignedRiders,
    summary,
    baseline: {
      label: baseline.label,
      summary: baseline.summary,
    },
    savings: {
      baselineLabel: baseline.label,
      distanceSavedKm,
      distanceSavedPct,
      vehicleMinutesSaved,
      vehicleMinutesSavedPct,
      avgRideSavedMin,
      avgRideSavedPct,
    },
  };
}
