import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/auth.js';
import vehicleRoutes from './routes/vehicles.js';
import riderRoutes from './routes/riders.js';
import demoRoutes from './routes/demo.js';
import planRoutes from './routes/plans.js';
import { notFoundHandler, errorHandler } from './middleware/error.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());

  const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        const err = new Error('Origin not allowed by CORS');
        err.statusCode = 403;
        return callback(err);
      },
      credentials: true,
    })
  );

  app.use(express.json({ limit: '100kb' }));

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again shortly.' },
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many authentication attempts, please wait.' },
  });

  app.use('/api', apiLimiter);
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      ai: Boolean(process.env.GEMINI_API_KEY?.trim()),
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/vehicles', vehicleRoutes);
  app.use('/api/riders', riderRoutes);
  app.use('/api/demo', demoRoutes);
  app.use('/api/plans', planRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
