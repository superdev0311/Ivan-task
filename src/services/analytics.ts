/**
 * Analytics Service
 *
 * Responsible for aggregating event data from PostgreSQL.
 * Queries are designed to leverage indexes on created_at and event_type.
 *
 * Performance notes:
 * - Queries run in parallel to reduce total latency
 * - Raw SQL used for full control over query execution plans
 * - COUNT(*) leverages index-only scans when possible
 */

import { query, queryOne } from '../db/client';
import { AnalyticsSummary } from '../types';

interface CountResult {
  count: string;
}

interface EventTypeCount {
  event_type: string;
  count: string;
}

export async function getAnalyticsSummary(from: string, to: string): Promise<AnalyticsSummary> {
  const fromDate = new Date(from);
  const toDate = new Date(to);

  // Run queries in parallel for better performance
  const [totalEventsResult, uniqueUsersResult, eventsByTypeResult] = await Promise.all([
    queryOne<CountResult>(
      `SELECT COUNT(*) as count FROM events WHERE created_at >= $1 AND created_at <= $2`,
      [fromDate, toDate]
    ),
    queryOne<CountResult>(
      `SELECT COUNT(DISTINCT user_id) as count FROM events WHERE created_at >= $1 AND created_at <= $2`,
      [fromDate, toDate]
    ),
    query<EventTypeCount>(
      `SELECT event_type, COUNT(*) as count FROM events WHERE created_at >= $1 AND created_at <= $2 GROUP BY event_type ORDER BY count DESC`,
      [fromDate, toDate]
    ),
  ]);

  const eventsByType: Record<string, number> = {};
  for (const row of eventsByTypeResult) {
    eventsByType[row.event_type] = parseInt(row.count, 10);
  }

  return {
    totalEvents: parseInt(totalEventsResult?.count || '0', 10),
    uniqueUsers: parseInt(uniqueUsersResult?.count || '0', 10),
    eventsByType,
  };
}
