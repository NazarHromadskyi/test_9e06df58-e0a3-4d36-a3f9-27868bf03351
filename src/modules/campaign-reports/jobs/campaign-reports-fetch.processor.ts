import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { CampaignReportsService } from '../campaign-reports.service';
import { ProbationService } from '../../probation/probation.service';
import {
  CAMPAIGN_REPORTS_FETCH_QUEUE,
  FetchReportsJobData,
  FetchReportsJobProgress,
  FetchReportsJobResult,
} from './campaign-reports-fetch.constants';

@Processor(CAMPAIGN_REPORTS_FETCH_QUEUE, { concurrency: 1 })
export class CampaignReportsFetchProcessor extends WorkerHost {
  private readonly logger = new Logger(CampaignReportsFetchProcessor.name);

  constructor(
    private readonly probationService: ProbationService,
    private readonly campaignReportsService: CampaignReportsService,
  ) {
    super();
  }

  async process(job: Job<FetchReportsJobData>): Promise<FetchReportsJobResult> {
    const startTime = Date.now();

    const { from_date, to_date, event_name, take } = job.data;

    this.logger.log(
      `Job ${job.id}: fetch ${from_date} to ${to_date}, event=${event_name}`,
    );

    const progress: FetchReportsJobProgress = {
      batches_processed: 0,
      total_fetched: 0,
      total_processed: 0,
    };

    await job.updateProgress(progress);

    const result = await this.probationService.fetchAndProcessReports(
      {
        from_date,
        to_date,
        event_name,
        take,
      },
      async (batch) => {
        const processed =
          await this.campaignReportsService.upsertReportsBatch(batch);

        progress.batches_processed += 1;
        progress.total_fetched += batch.length;
        progress.total_processed += processed;

        await job.updateProgress({ ...progress });

        return processed;
      },
    );

    await this.campaignReportsService.invalidateAggregatedCache();

    const duration = Date.now() - startTime;

    const output: FetchReportsJobResult = {
      total_fetched: result.totalFetched,
      total_processed: result.totalProcessed,
      pages_processed: result.pagesProcessed,
      duration_ms: duration,
    };

    this.logger.log(
      `Job ${job.id}: complete pages=${output.pages_processed} processed=${output.total_processed} duration_ms=${output.duration_ms}`,
    );

    return output;
  }
}
