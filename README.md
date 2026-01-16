# Analytics Module

A high-performance analytics backend module built with Node.js, TypeScript, Express, PostgreSQL, and Redis.

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 7+

## Project Structure

```
src/
├── config/       # Environment configuration
├── db/           # Database client and queries
├── cache/        # Redis client and caching logic
├── services/     # Business logic
├── routes/       # API route handlers
├── middleware/   # Express middleware
├── types/        # TypeScript type definitions
├── app.ts        # Express app setup
└── server.ts     # Server entry point
migrations/       # SQL migration files
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env` file in the project root:

```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://user:password@localhost:5432/analytics_db
REDIS_URL=redis://localhost:6379
```

### 3. Set up the database

Create a PostgreSQL database and run the migration:

```bash
createdb analytics_db
psql -d analytics_db -f migrations/001_create_events_table.sql
```

### 4. Start Redis

Ensure Redis is running on `localhost:6379` (or update `REDIS_URL`).

### 5. Run the server

Development:
```bash
npm run dev
```

Production:
```bash
npm run build
npm start
```

## API

### GET /api/analytics/summary

Returns aggregated analytics data for a given date range.

**Query Parameters:**
- `from` (required): Start date in ISO 8601 format (e.g., `2024-01-01T00:00:00Z`)
- `to` (required): End date in ISO 8601 format (e.g., `2024-01-31T23:59:59Z`)

**Response:**
```json
{
  "data": {
    "totalEvents": 1250,
    "uniqueUsers": 342,
    "eventsByType": {
      "page_view": 800,
      "click": 350,
      "purchase": 100
    }
  },
  "cached": false
}
```

**Error Response:**
```json
{
  "error": {
    "message": "Query parameters \"from\" and \"to\" are required",
    "statusCode": 400
  }
}
```

### GET /health

Health check endpoint.

```json
{
  "status": "ok"
}
```

## Caching Strategy

The analytics summary endpoint implements a cache-aside (lazy-loading) pattern:

1. **Cache Key**: Built from the `from` and `to` query parameters: `analytics:summary:{from}:{to}`
2. **TTL**: 60 seconds (configurable in `src/config/index.ts`)
3. **Flow**:
   - On request, check Redis for cached result
   - If cache hit → return cached data immediately
   - If cache miss → query PostgreSQL → store result in Redis → return data
4. **Response Indicator**: The `cached` field in the response indicates whether data came from cache

This approach balances data freshness with performance. The 60-second TTL means:
- Frequently requested date ranges are served from memory
- Data is never more than 60 seconds stale
- Database load is reduced during traffic spikes
- Cache gracefully degrades (DB queries succeed even if Redis fails)
