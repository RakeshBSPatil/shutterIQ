import { Router } from 'express';
import bcrypt from 'bcrypt';
import { query } from '../db/pool.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { registerSchema, loginSchema } from '../schemas/index.js';

const router = Router();

// Pre-computed bcrypt hash used when an email is not found so response timing stays uniform
const DUMMY_HASH = '$2b$10$CwTycUXWue0Thq9StjUM0uJ8uL6z5t9f3vG3uK8q0p3L5oM1s0iC2';

router.post(
  '/register',
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { name, password } = req.body;
    const email = req.body.email.toLowerCase();

    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rowCount > 0) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, created_at`,
      [name, email, passwordHash]
    );

    const user = result.rows[0];
    const token = signToken(user);

    return res.status(201).json({ token, user });
  })
);

router.post(
  '/login',
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const email = req.body.email.toLowerCase();
    const { password } = req.body;

    const result = await query(
      'SELECT id, name, email, password_hash, created_at FROM users WHERE email = $1',
      [email]
    );

    const user = result.rows[0];
    if (!user) {
      await bcrypt.compare(password, DUMMY_HASH);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      created_at: user.created_at,
    };
    const token = signToken(safeUser);

    return res.json({ token, user: safeUser });
  })
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await query(
      'SELECT id, name, email, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ error: 'Account not found' });
    }

    return res.json({ user: result.rows[0] });
  })
);

export default router;
