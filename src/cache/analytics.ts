import { getRedisClient } from './client';
import { config } from '../config';
import { AnalyticsSummary } from '../types';

const CACHE_PREFIX = 'analytics:summary';

function buildCacheKey(from: string, to: string): string {
  return `${CACHE_PREFIX}:${from}:${to}`;
}

export async function getCachedSummary(from: string, to: string): Promise<AnalyticsSummary | null> {
  try {
    const client = await getRedisClient();
    const key = buildCacheKey(from, to);
    const cached = await client.get(key);
    
    if (cached) {
      return JSON.parse(cached) as AnalyticsSummary;
    }
    return null;
  } catch (error) {
    console.error('Cache read error:', error);
    return null;
  }
}

export async function setCachedSummary(from: string, to: string, summary: AnalyticsSummary): Promise<void> {
  try {
    const client = await getRedisClient();
    const key = buildCacheKey(from, to);
    await client.setEx(key, config.cache.ttlSeconds, JSON.stringify(summary));
  } catch (error) {
    console.error('Cache write error:', error);
  }
}
