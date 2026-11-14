import { Router } from 'express';
import { query } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/error.js';
import { vehicleSchema, uuidParamSchema } from '../schemas/index.js';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const result = await query(
      `SELECT id, user_id, name, capacity, driver_name
       FROM vehicles
       WHERE user_id = $1
       ORDER BY capacity DESC, name ASC`,
      [req.user.id]
    );
    return res.json({ vehicles: result.rows });
  })
);

router.post(
  '/',
  validate(vehicleSchema),
  asyncHandler(async (req, res) => {
    const { name, capacity, driver_name } = req.body;
    const result = await query(
      `INSERT INTO vehicles (user_id, name, capacity, driver_name)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, name, capacity, driver_name`,
      [req.user.id, name, capacity, driver_name]
    );
    return res.status(201).json({ vehicle: result.rows[0] });
  })
);

router.put(
  '/:id',
  validate(vehicleSchema),
  asyncHandler(async (req, res) => {
    const idCheck = uuidParamSchema.safeParse(req.params.id);
    if (!idCheck.success) {
      return res.status(400).json({ error: 'Invalid vehicle ID' });
    }

    const { name, capacity, driver_name } = req.body;
    const result = await query(
      `UPDATE vehicles
       SET name = $1, capacity = $2, driver_name = $3
       WHERE id = $4 AND user_id = $5
       RETURNING id, user_id, name, capacity, driver_name`,
      [name, capacity, driver_name, idCheck.data, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    return res.json({ vehicle: result.rows[0] });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const idCheck = uuidParamSchema.safeParse(req.params.id);
    if (!idCheck.success) {
      return res.status(400).json({ error: 'Invalid vehicle ID' });
    }

    const result = await query(
      'DELETE FROM vehicles WHERE id = $1 AND user_id = $2 RETURNING id',
      [idCheck.data, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    return res.json({ deleted: true, id: idCheck.data });
  })
);

export default router;
