export interface AnalyticsSummary {
  totalEvents: number;
  uniqueUsers: number;
  eventsByType: Record<string, number>;
}

export interface AnalyticsQueryParams {
  from: string;
  to: string;
}

export interface Event {
  id: number;
  user_id: string;
  event_type: string;
  created_at: Date;
}
