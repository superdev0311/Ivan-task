import { AnalyticsResponse, AnalyticsError, DateRange } from '@/types/analytics';

const API_BASE = '/api/analytics';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function fetchAnalyticsSummary(dateRange: DateRange): Promise<AnalyticsResponse> {
  const params = new URLSearchParams({
    from: dateRange.from,
    to: dateRange.to,
  });

  const response = await fetch(`${API_BASE}/summary?${params}`);

  if (!response.ok) {
    const errorData: AnalyticsError = await response.json();
    throw new ApiError(
      errorData.error.statusCode,
      errorData.error.message
    );
  }

  return response.json();
}
