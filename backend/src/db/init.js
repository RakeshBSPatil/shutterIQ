import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { pool } from './pool.js';

dotenv.config({
  path: [
    fileURLToPath(new URL('../../.env', import.meta.url)),
    fileURLToPath(new URL('../../.env.example', import.meta.url)),
  ],
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initDatabase() {
  const dbUrl = process.env.DATABASE_URL?.trim();
  if (!dbUrl) {
    console.error('Missing DATABASE_URL in environment.');
    await pool.end().catch(() => {});
    process.exit(1);
  }

  if (/^https?:\/\//i.test(dbUrl)) {
    console.error(
      'Invalid DATABASE_URL: received an HTTP/HTTPS project URL instead of a PostgreSQL connection URI (postgresql://...). Copy the Postgres URI from Supabase Connect -> Connection String.'
    );
    await pool.end().catch(() => {});
    process.exit(1);
  }

  const schemaPath = path.resolve(__dirname, '../../sql/schema.sql');
  const sql = await fs.readFile(schemaPath, 'utf8');

  try {
    await pool.query(sql);
    console.log('ShuttleIQ database schema initialized successfully.');
  } catch (err) {
    console.error('Failed to initialize database schema:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

initDatabase();
