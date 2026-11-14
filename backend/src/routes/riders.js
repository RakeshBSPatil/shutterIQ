import { Router } from 'express';
import { query } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/error.js';
import { riderSchema, uuidParamSchema } from '../schemas/index.js';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const result = await query(
      `SELECT id, user_id, name, address, lat, lng
       FROM riders
       WHERE user_id = $1
       ORDER BY name ASC`,
      [req.user.id]
    );
    return res.json({ riders: result.rows });
  })
);

router.post(
  '/',
  validate(riderSchema),
  asyncHandler(async (req, res) => {
    const { name, address, lat, lng } = req.body;
    const result = await query(
      `INSERT INTO riders (user_id, name, address, lat, lng)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id, name, address, lat, lng`,
      [req.user.id, name, address, lat, lng]
    );
    return res.status(201).json({ rider: result.rows[0] });
  })
);

router.put(
  '/:id',
  validate(riderSchema),
  asyncHandler(async (req, res) => {
    const idCheck = uuidParamSchema.safeParse(req.params.id);
    if (!idCheck.success) {
      return res.status(400).json({ error: 'Invalid rider ID' });
    }

    const { name, address, lat, lng } = req.body;
    const result = await query(
      `UPDATE riders
       SET name = $1, address = $2, lat = $3, lng = $4
       WHERE id = $5 AND user_id = $6
       RETURNING id, user_id, name, address, lat, lng`,
      [name, address, lat, lng, idCheck.data, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Rider not found' });
    }

    return res.json({ rider: result.rows[0] });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const idCheck = uuidParamSchema.safeParse(req.params.id);
    if (!idCheck.success) {
      return res.status(400).json({ error: 'Invalid rider ID' });
    }

    const result = await query(
      'DELETE FROM riders WHERE id = $1 AND user_id = $2 RETURNING id',
      [idCheck.data, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Rider not found' });
    }

    return res.json({ deleted: true, id: idCheck.data });
  })
);

export default router;
