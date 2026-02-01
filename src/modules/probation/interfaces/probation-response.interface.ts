export interface ProbationResponse {
  timestamp: number;
  data: {
    csv: string;
    pagination?: {
      next: string;
    };
  };
}

export interface ProbationErrorResponse {
  timestamp: number;
  error: {
    code: number;
    message: string;
  };
}

export interface ParsedCampaignReport {
  campaign: string;
  campaign_id: string;
  adgroup: string;
  adgroup_id: string;
  ad: string;
  ad_id: string;
  client_id: string;
  event_name: string;
  event_time: Date;
}

export interface FetchReportsParams {
  from_date: string;
  to_date: string;
  event_name: string;
  take?: number;
}

/**
 * Callback function type for processing a page of reports
 * Must return a Promise that resolves when processing is complete
 */
export type PageProcessor = (
  reports: ParsedCampaignReport[],
) => Promise<number>;

/**
 * Final result of fetching and processing all reports
 */
export interface FetchAndProcessResult {
  totalFetched: number;
  totalProcessed: number;
  pagesProcessed: number;
}
