'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchAnalyticsSummary, ApiError } from '@/services/analytics';
import { AnalyticsSummary, DateRange } from '@/types/analytics';
import {
  MetricCard,
  EventsTable,
  DateRangePicker,
  LoadingState,
  ErrorState,
  EmptyState,
} from '@/components';
import styles from './page.module.css';

// Default to last 30 days
function getDefaultDateRange(): DateRange {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  
  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

interface FetchState {
  data: AnalyticsSummary | null;
  loading: boolean;
  error: string | null;
  cached: boolean;
}

export default function AnalyticsDashboard() {
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange);
  const [state, setState] = useState<FetchState>({
    data: null,
    loading: true,
    error: null,
    cached: false,
  });

  const loadData = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetchAnalyticsSummary(dateRange);
      setState({
        data: response.data,
        loading: false,
        error: null,
        cached: response.cached,
      });
    } catch (err) {
      const message = err instanceof ApiError 
        ? err.message 
        : 'An unexpected error occurred';
      setState(prev => ({
        ...prev,
        loading: false,
        error: message,
      }));
    }
  }, [dateRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDateRangeChange = (newRange: DateRange) => {
    setDateRange(newRange);
  };

  const isEmpty = state.data && 
    state.data.totalEvents === 0 && 
    Object.keys(state.data.eventsByType).length === 0;

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Analytics Dashboard</h1>
          <p className={styles.subtitle}>Event metrics and user activity</p>
        </div>
        <div className={styles.controls}>
          <DateRangePicker
            dateRange={dateRange}
            onChange={handleDateRangeChange}
            disabled={state.loading}
          />
          {state.cached && (
            <span className={styles.cacheIndicator}>Cached</span>
          )}
        </div>
      </header>

      {state.loading && <LoadingState />}
      
      {state.error && (
        <ErrorState message={state.error} onRetry={loadData} />
      )}

      {!state.loading && !state.error && isEmpty && <EmptyState />}

      {!state.loading && !state.error && state.data && !isEmpty && (
        <div className={styles.content}>
          <section className={styles.metrics}>
            <MetricCard
              title="Total Events"
              value={state.data.totalEvents}
              subtitle="All tracked events"
            />
            <MetricCard
              title="Unique Users"
              value={state.data.uniqueUsers}
              subtitle="Distinct user IDs"
            />
            <MetricCard
              title="Event Types"
              value={Object.keys(state.data.eventsByType).length}
              subtitle="Different categories"
            />
          </section>

          <section className={styles.breakdown}>
            <EventsTable eventsByType={state.data.eventsByType} />
          </section>
        </div>
      )}
    </main>
  );
}
