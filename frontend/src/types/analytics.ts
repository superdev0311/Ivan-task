export interface AnalyticsSummary {
  totalEvents: number;
  uniqueUsers: number;
  eventsByType: Record<string, number>;
}

export interface AnalyticsResponse {
  data: AnalyticsSummary;
  cached: boolean;
}

export interface AnalyticsError {
  error: {
    message: string;
    statusCode: number;
  };
}

export interface DateRange {
  from: string;
  to: string;
}
