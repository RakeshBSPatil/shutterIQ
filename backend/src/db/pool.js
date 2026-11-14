import { fileURLToPath } from 'node:url';
import pg from 'pg';
import dotenv from 'dotenv';

const envPath = fileURLToPath(new URL('../../.env', import.meta.url));
const envExamplePath = fileURLToPath(new URL('../../.env.example', import.meta.url));
dotenv.config({ path: [envPath, envExamplePath] });

const { Pool } = pg;

function resolveConnectionString(rawUrl) {
  if (!rawUrl) return rawUrl;
  try {
    const parsed = new URL(rawUrl);
    // Direct db.<ref>.supabase.co hosts are IPv6-only on newer Supabase projects.
    // Route known IPv6-only project host through its IPv4 Session Pooler automatically.
    if (parsed.hostname === 'db.lbvhnavwrmzdwcbqjsjp.supabase.co') {
      parsed.hostname =
        process.env.SUPABASE_POOLER_HOST || 'aws-0-ap-southeast-2.pooler.supabase.com';
      parsed.port = '5432';
      parsed.username = 'postgres.lbvhnavwrmzdwcbqjsjp';
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
