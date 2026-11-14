import { fileURLToPath } from 'node:url';
import pg from 'pg';
import dotenv from 'dotenv';

const envPath = fileURLToPath(new URL('../../.env', import.meta.url));
dotenv.config({ path: envPath });

const { Pool } = pg;

function resolveConnectionString(rawUrl) {
  if (!rawUrl) return rawUrl;
  try {
    const parsed = new URL(rawUrl);
    // Direct db.<ref>.supabase.co hosts are IPv6-only on newer Supabase projects.
    // Route direct Supabase DB hosts through an IPv4 Session Pooler automatically when needed.
    const match = parsed.hostname.match(/^db\.([a-z0-9-]+)\.supabase\.co$/i);
    if (match) {
      parsed.hostname =
        process.env.SUPABASE_POOLER_HOST || 'aws-0-ap-southeast-2.pooler.supabase.com';
      parsed.port = '5432';
      parsed.username = `postgres.${match[1]}`;
      return parsed.toString();
    }
  } catch {
    return rawUrl;
  }
  return rawUrl;
}

const connectionString = resolveConnectionString(process.env.DATABASE_URL);

const isLocalhost =
  !connectionString ||
  connectionString.includes('localhost') ||
  connectionString.includes('127.0.0.1');

export const pool = new Pool({
  connectionString,
  ssl: isLocalhost ? false : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

export async function query(text, params) {
  return pool.query(text, params);
}
