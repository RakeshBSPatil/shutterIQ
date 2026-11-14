import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { optimizePlan } from '../services/optimizer.js';

const router = Router();
router.use(requireAuth);

const DEMO_CAMPUS = {
  name: 'TechPark North Campus',
  lat: 12.9716,
  lng: 77.5946,
};

const DEMO_VEHICLES = [
  { name: 'Shuttle Alpha', capacity: 14, driver_name: 'Aarav Nair' },
  { name: 'Shuttle Beta', capacity: 14, driver_name: 'Maya Verma' },
  { name: 'Shuttle Gamma', capacity: 8, driver_name: 'Rohan Kulkarni' },
  { name: 'Shuttle Delta', capacity: 8, driver_name: 'Priya Menon' },
];

const NEIGHBOURHOODS = [
  { name: 'Indiranagar', lat: 12.9784, lng: 77.6408, street: '100 Feet Rd' },
  { name: 'Koramangala', lat: 12.9352, lng: 77.6245, street: '80 Feet Rd' },
  { name: 'Malleshwaram', lat: 13.0031, lng: 77.5643, street: 'Sampige Rd' },
  { name: 'Jayanagar', lat: 12.9299, lng: 77.5824, street: '11th Main Rd' },
  { name: 'Hebbal', lat: 13.0358, lng: 77.597, street: 'Outer Ring Rd' },
  { name: 'Whitefield West', lat: 12.9855, lng: 77.6762, street: 'ITPL Main Rd' },
];

const FIRST_NAMES = [
  'Ananya', 'Vikram', 'Diya', 'Kabir', 'Meera', 'Arjun',
  'Sanya', 'Nikhil', 'Tara', 'Siddharth', 'Isha', 'Rishabh',
  'Kavya', 'Aditya', 'Nandini', 'Dev', 'Zoya', 'Pranav',
  'Rhea', 'Varun', 'Aisha', 'Karan', 'Pooja', 'Harsh',
  'Sneha', 'Tanmay', 'Shruti', 'Gaurav', 'Lakshmi', 'Vivek',
];

const LAST_INITIALS = [
  'Rao', 'Sharma', 'Patel', 'Desai', 'Iyer', 'Reddy',
  'Gupta', 'Joshi', 'Kapoor', 'Pillai', 'Bhat', 'Sen',
];

// Deterministic Mulberry32 PRNG
function createSeededRng(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateDeterministicRiders() {
  const rng = createSeededRng(20261114);
  const riders = [];

  for (let i = 0; i < 30; i += 1) {
    // Interleave across the 6 neighbourhoods in sign-up order
    const hood = NEIGHBOURHOODS[i % NEIGHBOURHOODS.length];
    const latOffset = (rng() - 0.5) * 0.017;
    const lngOffset = (rng() - 0.5) * 0.017;
    const houseNo = 100 + Math.floor(rng() * 800);

    const first = FIRST_NAMES[i % FIRST_NAMES.length];
    const last = LAST_INITIALS[Math.floor(rng() * LAST_INITIALS.length)];

    riders.push({
      name: `${first} ${last}`,
      address: `${houseNo} ${hood.street}, ${hood.name}`,
      lat: Number((hood.lat + latOffset).toFixed(6)),
      lng: Number((hood.lng + lngOffset).toFixed(6)),
    });
  }

  return riders;
}

router.post(
  '/seed',
  asyncHandler(async (req, res) => {
    const client = await pool.connect();
    const riderSpecs = generateDeterministicRiders();

    try {
      await client.query('BEGIN');

      await client.query('DELETE FROM riders WHERE user_id = $1', [req.user.id]);
      await client.query('DELETE FROM vehicles WHERE user_id = $1', [req.user.id]);

      const insertedVehicles = [];
      for (const v of DEMO_VEHICLES) {
        const vr = await client.query(
          `INSERT INTO vehicles (user_id, name, capacity, driver_name)
           VALUES ($1, $2, $3, $4)
           RETURNING id, user_id, name, capacity, driver_name`,
          [req.user.id, v.name, v.capacity, v.driver_name]
        );
        insertedVehicles.push(vr.rows[0]);
      }

      const insertedRiders = [];
      for (const r of riderSpecs) {
        const rr = await client.query(
          `INSERT INTO riders (user_id, name, address, lat, lng)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, user_id, name, address, lat, lng`,
          [req.user.id, r.name, r.address, r.lat, r.lng]
        );
        insertedRiders.push(rr.rows[0]);
      }

      const existingPlans = await client.query(
        'SELECT COUNT(*)::int AS count FROM plans WHERE user_id = $1',
        [req.user.id]
      );

      let starterPlan = null;
      if (existingPlans.rows[0].count === 0) {
        const conditions = { weather: 'clear', incident: 'none' };
        const result = optimizePlan({
          vehicles: insertedVehicles,
          riders: insertedRiders,
          destination: DEMO_CAMPUS,
          arrivalTime: '08:30',
          bufferMin: 10,
          conditions,
        });

        const pr = await client.query(
          `INSERT INTO plans (
             user_id, name, dest_name, dest_lat, dest_lng,
             arrival_time, buffer_min, conditions, inputs, result
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING *`,
          [
            req.user.id,
            'Morning Express — Demo Campus',
            DEMO_CAMPUS.name,
            DEMO_CAMPUS.lat,
            DEMO_CAMPUS.lng,
            '08:30',
            10,
            JSON.stringify(conditions),
            JSON.stringify({ vehicles: insertedVehicles, riders: insertedRiders }),
            JSON.stringify(result),
          ]
        );
        starterPlan = pr.rows[0];
      }

      await client.query('COMMIT');

      return res.status(201).json({
        vehicles: insertedVehicles,
        riders: insertedRiders,
        starterPlan,
        seeded: {
          vehicles: insertedVehicles.length,
          riders: insertedRiders.length,
        },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  })
);

export default router;
