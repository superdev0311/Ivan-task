-- Migration: Create events table for analytics
-- Run: psql -d analytics_db -f migrations/001_create_events_table.sql

CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);

-- Composite index for date range queries with event type grouping
CREATE INDEX IF NOT EXISTS idx_events_created_at_event_type ON events(created_at, event_type);
