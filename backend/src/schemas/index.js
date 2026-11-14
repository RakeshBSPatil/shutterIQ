import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email: z.string().trim().email('Valid email is required').max(120),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128),
});

export const loginSchema = z.object({
  email: z.string().trim().email('Valid email is required'),
  password: z.string().min(1, 'Password is required'),
});

export const vehicleSchema = z.object({
  name: z.string().trim().min(1, 'Vehicle name is required').max(60),
  capacity: z.coerce.number().int().min(1, 'Capacity must be 1-60').max(60, 'Capacity must be 1-60'),
  driver_name: z.string().trim().max(80).optional().default(''),
});

export const riderSchema = z.object({
  name: z.string().trim().min(1, 'Rider name is required').max(80),
  address: z.string().trim().min(1, 'Address is required').max(200),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export const weatherEnum = z.enum(['clear', 'cloudy', 'rain', 'heavy_rain', 'fog']);
export const incidentEnum = z.enum(['none', 'minor_accident', 'road_closure']);

export const createPlanSchema = z.object({
  name: z.string().trim().min(1, 'Plan name is required').max(100),
  dest_name: z.string().trim().min(1, 'Destination name is required').max(120),
  dest_lat: z.coerce.number().min(-90).max(90),
  dest_lng: z.coerce.number().min(-180).max(180),
  arrival_time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'arrival_time must be HH:MM (24h)'),
  buffer_min: z.coerce.number().int().min(0).max(60).default(10),
  conditions: z
    .object({
      weather: weatherEnum.default('clear'),
      incident: incidentEnum.default('none'),
    })
    .default({ weather: 'clear', incident: 'none' }),
});

export const whatIfSchema = z.object({
  weather: weatherEnum.optional(),
  incident: incidentEnum.optional(),
  removeVehicleIds: z.array(z.string().uuid()).optional().default([]),
  absentRiderIds: z.array(z.string().uuid()).optional().default([]),
});

export const chatSchema = z.object({
  message: z.string().trim().min(1, 'Message cannot be empty').max(600),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'model']),
        content: z.string().max(2000),
      })
    )
    .max(20)
    .optional()
    .default([]),
});

export const uuidParamSchema = z.string().uuid('Invalid resource ID');
