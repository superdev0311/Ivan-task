/**
 * Analytics API Routes
 *
 * GET /api/analytics/summary
 *
 * Request flow:
 * 1. Validate query parameters (from, to)
 * 2. Check Redis cache for existing result
 * 3. On cache miss: query PostgreSQL, store result, return
 * 4. On cache hit: return immediately
 *
 * The "cached" field in response helps clients and debugging.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { getAnalyticsSummary } from '../services/analytics';
import { getCachedSummary, setCachedSummary } from '../cache/analytics';
import { AppError } from '../middleware/errorHandler';

const router = Router();

function isValidISODate(dateString: string): boolean {
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

function validateDateRange(from: unknown, to: unknown): { from: string; to: string } {
  if (typeof from !== 'string' || typeof to !== 'string') {
    throw new AppError(400, 'Query parameters "from" and "to" are required');
  }

  if (!isValidISODate(from) || !isValidISODate(to)) {
    throw new AppError(400, 'Invalid date format. Use ISO 8601 format (e.g., 2024-01-01T00:00:00Z)');
  }

  const fromDate = new Date(from);
  const toDate = new Date(to);

  if (fromDate > toDate) {
    throw new AppError(400, '"from" date must be before or equal to "to" date');
  }

  return { from, to };
}

router.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { from, to } = validateDateRange(req.query.from, req.query.to);

    // Check cache first
    const cached = await getCachedSummary(from, to);
    if (cached) {
      res.json({
        data: cached,
        cached: true,
      });
      return;
    }

    // Cache miss - query database
    const summary = await getAnalyticsSummary(from, to);

    // Store in cache for future requests
    await setCachedSummary(from, to, summary);

    res.json({
      data: summary,
      cached: false,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
