import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createApp } from './app.js';
import { pool } from './db/pool.js';

dotenv.config({
  path: [
    fileURLToPath(new URL('../.env', import.meta.url)),
    fileURLToPath(new URL('../.env.example', import.meta.url)),
  ],
});

const PORT = Number(process.env.PORT) || 4000;
const app = createApp();

const server = app.listen(PORT, () => {
  console.log(`ShuttleIQ backend listening on port ${PORT}`);
});

async function shutdown(signal) {
  console.log(`Received ${signal}, shutting down gracefully...`);
  server.close(async () => {
    await pool.end().catch(() => {});
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
