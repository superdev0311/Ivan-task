import { createClient } from 'redis';
import { config } from '../config';

export type RedisClient = ReturnType<typeof createClient>;

let client: RedisClient | null = null;

export async function getRedisClient(): Promise<RedisClient> {
  if (client && client.isOpen) {
    return client;
  }

  client = createClient({
    url: config.redis.url,
  });

  client.on('error', (err) => {
    console.error('Redis connection error:', err);
  });

  await client.connect();
  return client;
}

export async function closeRedisClient(): Promise<void> {
  if (client && client.isOpen) {
    await client.quit();
    client = null;
  }
}
