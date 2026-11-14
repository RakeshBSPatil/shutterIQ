import { Router } from 'express';
import { query } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/error.js';
import {
  createPlanSchema,
  whatIfSchema,
  chatSchema,
  uuidParamSchema,
} from '../schemas/index.js';
import { optimizePlan } from '../services/optimizer.js';
import {
  generatePlanInsights,
  generateWhatIfNarrative,
  answerPlanChat,
} from '../services/gemini.js';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const result = await query(
      `SELECT id, user_id, name, dest_name, dest_lat, dest_lng,
              arrival_time, buffer_min, conditions, result, insights, created_at
       FROM plans
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    return res.json({ plans: result.rows });
  })
);

router.post(
  '/',
  validate(createPlanSchema),
  asyncHandler(async (req, res) => {
    const {
      name,
      dest_name,
      dest_lat,
      dest_lng,
      arrival_time,
      buffer_min,
      conditions,
    } = req.body;

    const [vehiclesRes, ridersRes] = await Promise.all([
      query(
        'SELECT id, name, capacity, driver_name FROM vehicles WHERE user_id = $1 ORDER BY capacity DESC, name ASC',
        [req.user.id]
      ),
      query(
        'SELECT id, name, address, lat, lng FROM riders WHERE user_id = $1 ORDER BY name ASC',
        [req.user.id]
      ),
    ]);

    const vehicles = vehiclesRes.rows;
    const riders = ridersRes.rows;

    const result = optimizePlan({
      vehicles,
      riders,
      destination: { name: dest_name, lat: dest_lat, lng: dest_lng },
      arrivalTime: arrival_time,
      bufferMin: buffer_min,
      conditions,
    });

    const insertRes = await query(
      `INSERT INTO plans (
         user_id, name, dest_name, dest_lat, dest_lng,
         arrival_time, buffer_min, conditions, inputs, result
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        req.user.id,
        name,
        dest_name,
        dest_lat,
        dest_lng,
        arrival_time,
        buffer_min,
        JSON.stringify(conditions),
        JSON.stringify({ vehicles, riders }),
        JSON.stringify(result),
      ]
    );

    return res.status(201).json({ plan: insertRes.rows[0] });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const idCheck = uuidParamSchema.safeParse(req.params.id);
    if (!idCheck.success) {
      return res.status(400).json({ error: 'Invalid plan ID' });
    }

    const result = await query(
      'SELECT * FROM plans WHERE id = $1 AND user_id = $2',
      [idCheck.data, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    return res.json({ plan: result.rows[0] });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const idCheck = uuidParamSchema.safeParse(req.params.id);
    if (!idCheck.success) {
      return res.status(400).json({ error: 'Invalid plan ID' });
    }

    const result = await query(
      'DELETE FROM plans WHERE id = $1 AND user_id = $2 RETURNING id',
      [idCheck.data, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    return res.json({ deleted: true, id: idCheck.data });
  })
);

router.post(
  '/:id/insights',
  asyncHandler(async (req, res) => {
    const idCheck = uuidParamSchema.safeParse(req.params.id);
    if (!idCheck.success) {
      return res.status(400).json({ error: 'Invalid plan ID' });
    }

    const planRes = await query(
      'SELECT * FROM plans WHERE id = $1 AND user_id = $2',
      [idCheck.data, req.user.id]
    );

    if (planRes.rowCount === 0) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const plan = planRes.rows[0];
    const { insights, source } = await generatePlanInsights(plan);

    const payload = { ...insights, source, generatedAt: new Date().toISOString() };
    await query(
      'UPDATE plans SET insights = $1 WHERE id = $2 AND user_id = $3',
      [JSON.stringify(payload), plan.id, req.user.id]
    );

    return res.json({ insights: payload, source });
  })
);

router.post(
  '/:id/whatif',
  validate(whatIfSchema),
  asyncHandler(async (req, res) => {
    const idCheck = uuidParamSchema.safeParse(req.params.id);
    if (!idCheck.success) {
      return res.status(400).json({ error: 'Invalid plan ID' });
    }

    const planRes = await query(
      'SELECT * FROM plans WHERE id = $1 AND user_id = $2',
      [idCheck.data, req.user.id]
    );

    if (planRes.rowCount === 0) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const plan = planRes.rows[0];
    const snapshotVehicles = Array.isArray(plan.inputs?.vehicles)
      ? plan.inputs.vehicles
      : [];
    const snapshotRiders = Array.isArray(plan.inputs?.riders)
      ? plan.inputs.riders
      : [];

    const removeSet = new Set(req.body.removeVehicleIds || []);
    const absentSet = new Set(req.body.absentRiderIds || []);

    const filteredVehicles = snapshotVehicles.filter((v) => !removeSet.has(v.id));
    const filteredRiders = snapshotRiders.filter((r) => !absentSet.has(r.id));

    const scenarioConditions = {
      weather: req.body.weather ?? plan.conditions?.weather ?? 'clear',
      incident: req.body.incident ?? plan.conditions?.incident ?? 'none',
    };

    const scenarioResult = optimizePlan({
      vehicles: filteredVehicles,
      riders: filteredRiders,
      destination: {
        name: plan.dest_name,
        lat: plan.dest_lat,
        lng: plan.dest_lng,
      },
      arrivalTime: plan.arrival_time,
      bufferMin: plan.buffer_min,
      conditions: scenarioConditions,
    });

    const baseSummary = plan.result?.summary || {};
    const scenSummary = scenarioResult.summary || {};

    const comparison = {
      vehiclesUsedDelta: (scenSummary.vehiclesUsed ?? 0) - (baseSummary.vehiclesUsed ?? 0),
      assignedRidersDelta:
        (scenSummary.assignedRiders ?? 0) - (baseSummary.assignedRiders ?? 0),
      unassignedDelta:
        (scenSummary.unassignedCount ?? 0) - (baseSummary.unassignedCount ?? 0),
      distanceDeltaKm: Number(
        ((scenSummary.totalDistanceKm ?? 0) - (baseSummary.totalDistanceKm ?? 0)).toFixed(2)
      ),
      vehicleMinutesDelta: Number(
        ((scenSummary.totalDurationMin ?? 0) - (baseSummary.totalDurationMin ?? 0)).toFixed(1)
      ),
      avgRideDeltaMin: Number(
        ((scenSummary.avgRideMin ?? 0) - (baseSummary.avgRideMin ?? 0)).toFixed(1)
      ),
      worstRiskDeltaPct: Number(
        ((scenSummary.worstRiskScore ?? 0) - (baseSummary.worstRiskScore ?? 0)).toFixed(1)
      ),
    };

    const { narrative, source } = await generateWhatIfNarrative({
      basePlanRow: plan,
      scenarioResult,
      comparison,
      scenarioConditions,
    });

    return res.json({
      result: scenarioResult,
      comparison,
      narrative,
      source,
    });
  })
);

router.post(
  '/:id/chat',
  validate(chatSchema),
  asyncHandler(async (req, res) => {
    const idCheck = uuidParamSchema.safeParse(req.params.id);
    if (!idCheck.success) {
      return res.status(400).json({ error: 'Invalid plan ID' });
    }

    const planRes = await query(
      'SELECT * FROM plans WHERE id = $1 AND user_id = $2',
      [idCheck.data, req.user.id]
    );

    if (planRes.rowCount === 0) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const plan = planRes.rows[0];
    const { answer, source } = await answerPlanChat({
      planRow: plan,
      message: req.body.message,
      history: req.body.history,
    });

    return res.json({ answer, source });
  })
);

export default router;
