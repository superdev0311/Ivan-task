import app from './app';
import { config } from './config';
import { pool } from './db/client';
import { closeRedisClient, getRedisClient } from './cache/client';

async function start(): Promise<void> {
  try {
    // Verify database connection
    await pool.query('SELECT 1');
    console.log('Database connected');

    // Verify Redis connection
    await getRedisClient();
    console.log('Redis connected');

    app.listen(config.port, () => {
      console.log(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

async function shutdown(): Promise<void> {
  console.log('Shutting down...');
  await pool.end();
  await closeRedisClient();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();
