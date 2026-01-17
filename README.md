# Analytics Module

A high-performance analytics backend and dashboard for tracking and visualizing user events.

## Project Overview

This module provides aggregated analytics for a platform that tracks user events. It answers questions like:
- How many events occurred in a given time range?
- How many unique users were active?
- What types of events are most common?

**Problem solved**: Raw event data is expensive to query at scale. This module provides a caching layer and optimized queries to serve analytics dashboards without overloading the primary database.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ DatePicker   │  │ MetricCards  │  │ EventsTable          │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
│                              │                                   │
│                    fetchAnalyticsSummary()                       │
└─────────────────────────────────┬───────────────────────────────┘
                                  │ HTTP
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend (Express + Node.js)                 │
│                                                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │   Routes    │───▶│  Services   │───▶│   Cache / DB        │  │
│  │  (validate) │    │ (aggregate) │    │   (read/write)      │  │
│  └─────────────┘    └─────────────┘    └─────────────────────┘  │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    ▼                           ▼
             ┌─────────────┐            ┌─────────────┐
             │    Redis    │            │ PostgreSQL  │
             │   (cache)   │            │  (storage)  │
             └─────────────┘            └─────────────┘
```

### Data Flow

1. User selects date range in dashboard
2. Frontend calls `GET /api/analytics/summary?from=...&to=...`
3. Backend checks Redis for cached result
4. **Cache hit**: Return immediately (~1ms)
5. **Cache miss**: Query PostgreSQL, store in Redis, return result (~50-200ms)
6. Frontend renders metrics and table

### Backend Structure

```
src/
├── config/          # Environment variables, constants
├── db/              # PostgreSQL client, raw queries
├── cache/           # Redis client, cache operations
├── services/        # Business logic (analytics aggregation)
├── routes/          # HTTP handlers, validation
├── middleware/      # Error handling
└── types/           # Shared TypeScript interfaces
```

### Frontend Structure

```
frontend/src/
├── app/             # Next.js app router, pages
├── components/      # Reusable UI (MetricCard, EventsTable, states)
├── services/        # API client
└── types/           # Shared TypeScript interfaces
```

---

## Backend Decisions

### Why PostgreSQL

PostgreSQL was chosen over alternatives for several reasons:

| Consideration | PostgreSQL | Alternative |
|---------------|-----------|-------------|
| Analytics queries | Native `COUNT`, `GROUP BY`, window functions | MongoDB requires aggregation pipelines |
| Date range filtering | Excellent with B-tree indexes on timestamps | Time-series DBs (InfluxDB) would be overkill for this use case |
| Operational simplicity | Standard, well-understood, easy to hire for | Specialized DBs add operational burden |
| Future flexibility | Can add materialized views, partitioning | Already battle-tested at scale |

**Trade-off**: PostgreSQL is not the best choice for write-heavy workloads at extreme scale. If ingesting millions of events per second, consider a dedicated time-series database (TimescaleDB, ClickHouse) with PostgreSQL for serving aggregated results.

### Query Design

The analytics service runs three queries in parallel:

```sql
-- Total events (uses idx_events_created_at)
SELECT COUNT(*) FROM events WHERE created_at >= $1 AND created_at <= $2

-- Unique users (uses idx_events_created_at, then scans user_id)
SELECT COUNT(DISTINCT user_id) FROM events WHERE created_at >= $1 AND created_at <= $2

-- Events by type (uses idx_events_created_at_event_type composite index)
SELECT event_type, COUNT(*) FROM events 
WHERE created_at >= $1 AND created_at <= $2 
GROUP BY event_type ORDER BY count DESC
```

**Why parallel**: Each query is independent. Running them concurrently reduces total latency from ~150ms to ~60ms (limited by slowest query).

**Why raw SQL**: ORMs (Prisma, TypeORM) add abstraction that makes it harder to optimize analytics queries. Raw SQL with parameterized queries gives full control over execution plans.

### Redis Caching Strategy

**Pattern**: Cache-aside (lazy loading)

```
Request → Check Redis → Hit? Return cached
                      → Miss? Query DB → Store in Redis → Return
```

**Why cache-aside over write-through**: Analytics queries are read-heavy. Events are written frequently, but summaries are read more often. Caching on read avoids wasting Redis memory on ranges that are never queried.

### Cache Key Design

```
analytics:summary:{from}:{to}
```

Example: `analytics:summary:2024-01-01T00:00:00.000Z:2024-01-31T23:59:59.999Z`

**Why include full ISO timestamps**: 
- Exact date ranges get exact cache hits
- No normalization complexity (e.g., rounding to day boundaries)
- Cache naturally segments by query pattern

**Trade-off**: Different timestamps for the same logical day won't share cache. This is acceptable because:
1. Dashboards typically use consistent date boundaries
2. Optimizing for exact match is simpler and more predictable

### TTL Choice (60 seconds)

| TTL | Freshness | Cache Hit Rate | DB Load |
|-----|-----------|----------------|---------|
| 10s | High | Low | High |
| 60s | Acceptable | Medium | Medium |
| 300s | Stale | High | Low |

60 seconds balances freshness with performance. For a dashboard refreshed every few minutes, users won't notice 60-second staleness.

### Cache Invalidation

**Current approach**: TTL-based expiration only.

**Why no active invalidation**: 
- Events are append-only (no updates/deletes)
- New events don't invalidate old date ranges
- Historical ranges are immutable after the day ends

**When active invalidation would be needed**:
- If events could be deleted or modified
- If real-time accuracy was required
- If caching "today's" data (constantly changing)

---

## Scalability & Performance

### Current Bottlenecks

1. **PostgreSQL**: Single database handles all reads
2. **Redis**: Single instance, no clustering
3. **Backend**: Single Node.js process

### Scaling for High Traffic (1000+ concurrent users)

**Layer 1: Add more backend instances**

```
Load Balancer
     │
     ├── Backend 1 ─┐
     ├── Backend 2 ─┼──▶ Redis ──▶ PostgreSQL
     └── Backend 3 ─┘
```

Node.js is single-threaded but async. Multiple instances behind a load balancer handle concurrent requests efficiently. The backend is stateless—any instance can serve any request.

**Layer 2: Redis Cluster**

For cache capacity beyond single-node Redis (~25GB), use Redis Cluster with hash-based sharding. Cache keys naturally distribute across shards.

**Layer 3: PostgreSQL Read Replicas**

```
Primary (writes) ──▶ Replica 1 (reads)
                 ──▶ Replica 2 (reads)
```

Analytics queries hit replicas. Replication lag (typically <1 second) is acceptable for dashboard data.

### Scaling for Volume (millions of events/day)

**Problem**: Large tables slow down aggregation queries.

**Solution 1: Table Partitioning**

```sql
CREATE TABLE events (
    id SERIAL,
    user_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
) PARTITION BY RANGE (created_at);

CREATE TABLE events_2024_01 PARTITION OF events
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

Date range queries only scan relevant partitions. Old partitions can be archived or dropped.

**Solution 2: Materialized Views**

Pre-compute daily aggregates:

```sql
CREATE MATERIALIZED VIEW daily_stats AS
SELECT 
    DATE(created_at) as day,
    COUNT(*) as total_events,
    COUNT(DISTINCT user_id) as unique_users,
    event_type,
    COUNT(*) as type_count
FROM events
GROUP BY DATE(created_at), event_type;
```

Refresh nightly. Dashboard queries hit the view instead of raw events.

**Solution 3: Separate Write and Read Paths**

For extreme scale:

```
Events ──▶ Kafka ──▶ ClickHouse (analytics)
                 ──▶ PostgreSQL (transactional)
```

ClickHouse handles billions of rows with sub-second aggregations. PostgreSQL remains the source of truth for transactional data.

### Indexing Strategy

Current indexes:

| Index | Purpose | Query |
|-------|---------|-------|
| `idx_events_created_at` | Date range filtering | `WHERE created_at >= $1` |
| `idx_events_user_id` | User-specific queries | Future: per-user analytics |
| `idx_events_event_type` | Type filtering | Future: filter by event type |
| `idx_events_created_at_event_type` | Composite for GROUP BY | `GROUP BY event_type` with date filter |

**Why composite index**: PostgreSQL can use `(created_at, event_type)` for both the WHERE clause and GROUP BY, avoiding a separate sort operation.

---

## Real-Time Updates

### Current State

The dashboard polls on date range change. No automatic refresh.

### Options for Real-Time

| Approach | Latency | Complexity | Best For |
|----------|---------|------------|----------|
| Polling | 5-30s | Low | Dashboards with acceptable delay |
| SSE | 1-5s | Medium | One-way server updates |
| WebSockets | <1s | High | Bidirectional, low-latency |

### Implementation Recommendations

**For this analytics use case**: Server-Sent Events (SSE)

```
Client ──HTTP──▶ Server
Client ◀──SSE─── Server (push updates)
```

**Why SSE over WebSockets**:
- Analytics is read-only (no client→server messages needed)
- SSE works over HTTP/2, simpler infrastructure
- Automatic reconnection built into browser EventSource API
- No WebSocket upgrade overhead

**Implementation sketch**:

```typescript
// Backend: Push updates when cache refreshes
app.get('/api/analytics/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  
  const interval = setInterval(async () => {
    const data = await getAnalyticsSummary(from, to);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }, 5000);
  
  req.on('close', () => clearInterval(interval));
});
```

**When WebSockets make sense**:
- Collaborative features (multiple users editing)
- Chat or notifications
- Sub-second latency requirements

---

## API Versioning

### Recommended Approach: URL Path Versioning

```
/api/v1/analytics/summary
/api/v2/analytics/summary
```

**Why URL versioning over headers**:
- Explicit and visible in logs, documentation
- Easy to route at load balancer level
- Cacheable (different URLs = different cache entries)
- No ambiguity about which version a request uses

### Backward Compatibility Strategy

1. **Additive changes are safe**: New fields in response don't break clients
2. **Breaking changes get new version**: Removing fields, changing types
3. **Deprecation period**: v1 continues working for 6-12 months after v2 launch
4. **Sunset header**: `Sunset: Sat, 01 Jan 2025 00:00:00 GMT`

**Example migration**:

```typescript
// v1 response (current)
{ "data": { "totalEvents": 100 } }

// v2 response (new field, renamed field)
{ "data": { "total_events": 100, "period": { "from": "...", "to": "..." } } }
```

v1 clients continue working. v2 clients opt-in to new structure.

---

## Local Development

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 7+

### Backend Setup

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env  # Edit with your database credentials

# Run database migration
psql -d analytics_db -f migrations/001_create_events_table.sql

# Start development server
npm run dev
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:3001`, proxies API requests to backend on `http://localhost:3000`.

### Environment Variables

```env
# Backend
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://user:password@localhost:5432/analytics_db
REDIS_URL=redis://localhost:6379
```

---

## Improvements & Next Steps

### If More Time Was Available

**Code Quality**
- Add integration tests for API endpoints
- Add unit tests for analytics service
- Set up CI pipeline (GitHub Actions)

**Performance**
- Add request logging with correlation IDs
- Implement rate limiting
- Add Prometheus metrics endpoint
- Profile and optimize slow queries

**Features**
- Add date range presets (last 7d, 30d, 90d)
- Add CSV export
- Add comparison view (this period vs. previous)
- Add drill-down by user or event type

**Infrastructure**
- Dockerize for consistent local development
- Add health checks for Redis and PostgreSQL
- Implement graceful degradation (serve stale cache if DB is down)

**Security**
- Add API authentication (JWT or API keys)
- Add input sanitization middleware
- Add CORS configuration for production

### What I Would Refactor

1. **Cache key normalization**: Round timestamps to minute boundaries to improve cache hit rate for similar queries
2. **Query optimization**: Consider a single query with subqueries instead of three parallel queries (reduces connection overhead)
3. **Error types**: Create specific error classes for different failure modes (DatabaseError, CacheError, ValidationError)

---

## API Reference

### GET /api/analytics/summary

Returns aggregated analytics for a date range.

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `from` | ISO 8601 string | Yes | Start of date range |
| `to` | ISO 8601 string | Yes | End of date range |

**Success Response (200)**

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

**Error Responses**

| Status | Condition |
|--------|-----------|
| 400 | Missing or invalid query parameters |
| 500 | Database or server error |

### GET /health

Returns server health status.

**Response (200)**

```json
{
  "status": "ok"
}
```
