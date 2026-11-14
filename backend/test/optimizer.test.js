import test from 'node:test';
import assert from 'node:assert/strict';
import { optimizePlan, parseTimeToMinutes } from '../src/services/optimizer.js';
import { predictRouteRisk } from '../src/services/predictor.js';

const DEMO_DEST = {
  name: 'TechPark North Campus',
  lat: 12.9716,
  lng: 77.5946,
};

const DEMO_VEHICLES = [
  { id: 'v1', name: 'Shuttle Alpha', capacity: 14, driver_name: 'Aarav' },
  { id: 'v2', name: 'Shuttle Beta', capacity: 14, driver_name: 'Maya' },
  { id: 'v3', name: 'Shuttle Gamma', capacity: 8, driver_name: 'Rohan' },
  { id: 'v4', name: 'Shuttle Delta', capacity: 8, driver_name: 'Priya' },
];

// Deterministic PRNG (Mulberry32) for reproducible rider coordinates across 6 neighbourhoods
function createRng(seed = 20261114) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildDemoRiders(count = 30) {
  const rng = createRng(42);
  const neighbourhoods = [
    { name: 'Indiranagar', lat: 12.9784, lng: 77.6408 },
    { name: 'Koramangala', lat: 12.9352, lng: 77.6245 },
    { name: 'Malleshwaram', lat: 13.0031, lng: 77.5643 },
    { name: 'Jayanagar', lat: 12.9299, lng: 77.5824 },
    { name: 'Hebbal', lat: 13.0358, lng: 77.597 },
    { name: 'Whitefield West', lat: 12.9855, lng: 77.6762 },
  ];

  const riders = [];
  for (let i = 0; i < count; i += 1) {
    // Interleave neighbourhoods in sign-up order (realistic unclustered spreadsheet order)
    const hood = neighbourhoods[i % neighbourhoods.length];
    const latOffset = (rng() - 0.5) * 0.018;
    const lngOffset = (rng() - 0.5) * 0.018;
    riders.push({
      id: `r-${i + 1}`,
      name: `Rider ${i + 1}`,
      address: `${10 + i} ${hood.name} Lane`,
      lat: Number((hood.lat + latOffset).toFixed(6)),
      lng: Number((hood.lng + lngOffset).toFixed(6)),
    });
  }
  return riders;
}

test('every rider is assigned exactly once when fleet capacity is sufficient', () => {
  const riders = buildDemoRiders(30);
  const plan = optimizePlan({
    vehicles: DEMO_VEHICLES,
    riders,
    destination: DEMO_DEST,
    arrivalTime: '08:30',
    bufferMin: 10,
    conditions: { weather: 'clear', incident: 'none' },
  });

  const assignedIds = plan.routes.flatMap((r) => r.stops.map((s) => s.riderId));
  assert.equal(assignedIds.length, riders.length);
  assert.equal(new Set(assignedIds).size, riders.length);
  assert.equal(plan.unassignedRiders.length, 0);

  for (const r of riders) {
    assert.ok(assignedIds.includes(r.id), `Missing rider ${r.id}`);
  }
});

test('vehicle capacity is strictly respected on every route', () => {
  const riders = buildDemoRiders(30);
  const plan = optimizePlan({
    vehicles: DEMO_VEHICLES,
    riders,
    destination: DEMO_DEST,
    arrivalTime: '08:30',
    bufferMin: 10,
    conditions: { weather: 'cloudy', incident: 'none' },
  });

  for (const route of plan.routes) {
    assert.ok(
      route.stops.length <= route.capacity,
      `Vehicle ${route.vehicleName} exceeded capacity (${route.stops.length} > ${route.capacity})`
    );
    assert.equal(route.riderCount, route.stops.length);
  }
});

test('scheduled arrival time equals deadline minus buffer', () => {
  const riders = buildDemoRiders(24);
  const arrivalTime = '08:45';
  const bufferMin = 15;
  const plan = optimizePlan({
    vehicles: DEMO_VEHICLES,
    riders,
    destination: DEMO_DEST,
    arrivalTime,
    bufferMin,
    conditions: { weather: 'clear', incident: 'none' },
  });

  const expectedArrivalMin = parseTimeToMinutes(arrivalTime) - bufferMin;
  assert.ok(plan.routes.length > 0);
  for (const route of plan.routes) {
    assert.equal(route.arrivalMin, expectedArrivalMin);
    assert.equal(route.arrivalTime, '08:30');
    for (const stop of route.stops) {
      assert.ok(stop.etaMin < route.arrivalMin);
      assert.ok(stop.rideMinutes > 0);
    }
  }
});

test('optimized routes beat sign-up-order baseline on total distance', () => {
  const riders = buildDemoRiders(30);
  const plan = optimizePlan({
    vehicles: DEMO_VEHICLES,
    riders,
    destination: DEMO_DEST,
    arrivalTime: '08:30',
    bufferMin: 10,
    conditions: { weather: 'clear', incident: 'none' },
  });

  assert.equal(plan.baseline.label, 'sign-up-order roster');
  assert.ok(
    plan.summary.totalDistanceKm < plan.baseline.summary.totalDistanceKm,
    `Expected optimized distance (${plan.summary.totalDistanceKm}) < baseline (${plan.baseline.summary.totalDistanceKm})`
  );
  assert.ok(plan.savings.distanceSavedKm > 0);
  assert.ok(plan.savings.distanceSavedPct > 0);
});

test('bad weather produces earlier departures and higher risk scores than clear weather', () => {
  const riders = buildDemoRiders(20);
  const clearPlan = optimizePlan({
    vehicles: DEMO_VEHICLES,
    riders,
    destination: DEMO_DEST,
    arrivalTime: '08:30',
    bufferMin: 8,
    conditions: { weather: 'clear', incident: 'none' },
  });

  const stormPlan = optimizePlan({
    vehicles: DEMO_VEHICLES,
    riders,
    destination: DEMO_DEST,
    arrivalTime: '08:30',
    bufferMin: 8,
    conditions: { weather: 'heavy_rain', incident: 'none' },
  });

  const avgClearDep =
    clearPlan.routes.reduce((s, r) => s + r.departureMin, 0) /
    clearPlan.routes.length;
  const avgStormDep =
    stormPlan.routes.reduce((s, r) => s + r.departureMin, 0) /
    stormPlan.routes.length;

  assert.ok(
    avgStormDep < avgClearDep,
    `Expected storm average departure (${avgStormDep}) earlier than clear (${avgClearDep})`
  );
  assert.ok(
    stormPlan.summary.worstRiskScore > clearPlan.summary.worstRiskScore,
    `Expected storm risk (${stormPlan.summary.worstRiskScore}) > clear risk (${clearPlan.summary.worstRiskScore})`
  );

  const lowRisk = predictRouteRisk({
    durationMin: 30,
    bufferMin: 15,
    weather: 'clear',
    incident: 'none',
    avgCongestion: 1.1,
  });
  const highRisk = predictRouteRisk({
    durationMin: 45,
    bufferMin: 5,
    weather: 'heavy_rain',
    incident: 'road_closure',
    avgCongestion: 1.5,
  });
  assert.equal(lowRisk.level, 'low');
  assert.equal(highRisk.level, 'high');
  assert.ok(highRisk.p80DelayMin > lowRisk.p80DelayMin);
});

test('over-capacity riders are reported in unassignedRiders', () => {
  const totalSeats = DEMO_VEHICLES.reduce((s, v) => s + v.capacity, 0); // 44 seats
  const riders = buildDemoRiders(50);

  const plan = optimizePlan({
    vehicles: DEMO_VEHICLES,
    riders,
    destination: DEMO_DEST,
    arrivalTime: '08:30',
    bufferMin: 10,
    conditions: { weather: 'clear', incident: 'none' },
  });

  const assignedIds = plan.routes.flatMap((r) => r.stops.map((s) => s.riderId));
  const unassignedIds = plan.unassignedRiders.map((u) => u.id);

  assert.equal(assignedIds.length, totalSeats);
  assert.equal(unassignedIds.length, riders.length - totalSeats);
  assert.equal(
    new Set([...assignedIds, ...unassignedIds]).size,
    riders.length
  );
});

test('edge cases: single rider and zero riders', () => {
  const singleRider = buildDemoRiders(1);
  const singlePlan = optimizePlan({
    vehicles: DEMO_VEHICLES,
    riders: singleRider,
    destination: DEMO_DEST,
    arrivalTime: '09:00',
    bufferMin: 10,
    conditions: { weather: 'clear', incident: 'none' },
  });

  assert.equal(singlePlan.routes.length, 1);
  assert.equal(singlePlan.routes[0].stops.length, 1);
  assert.equal(singlePlan.routes[0].arrivalTime, '08:50');
  assert.equal(singlePlan.unassignedRiders.length, 0);

  const zeroPlan = optimizePlan({
    vehicles: DEMO_VEHICLES,
    riders: [],
    destination: DEMO_DEST,
    arrivalTime: '09:00',
    bufferMin: 10,
    conditions: { weather: 'clear', incident: 'none' },
  });

  assert.equal(zeroPlan.routes.length, 0);
  assert.equal(zeroPlan.unassignedRiders.length, 0);
  assert.equal(zeroPlan.summary.totalDistanceKm, 0);
  assert.equal(zeroPlan.summary.vehiclesUsed, 0);
});
