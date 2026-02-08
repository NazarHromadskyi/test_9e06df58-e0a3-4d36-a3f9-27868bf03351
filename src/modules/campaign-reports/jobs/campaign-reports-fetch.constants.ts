export const CAMPAIGN_REPORTS_FETCH_QUEUE = 'campaign-reports-fetch';
export const CAMPAIGN_REPORTS_FETCH_JOB = 'fetch-reports';

export interface FetchReportsJobData {
  from_date: string;
  to_date: string;
  event_name: string;
  take?: number;
}

export interface FetchReportsJobProgress {
  batches_processed: number;
  total_fetched: number;
  total_processed: number;
}

export interface FetchReportsJobResult {
  total_fetched: number;
  total_processed: number;
  pages_processed: number;
  duration_ms: number;
}
