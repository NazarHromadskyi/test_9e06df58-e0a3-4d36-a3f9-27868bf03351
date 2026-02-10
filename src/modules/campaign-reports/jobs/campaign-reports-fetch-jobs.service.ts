import { ConflictException, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { createHash } from 'crypto';
import { FetchReportsDto } from '../dto/fetch-reports.dto';
import {
  CAMPAIGN_REPORTS_FETCH_JOB,
  CAMPAIGN_REPORTS_FETCH_QUEUE,
  FetchReportsJobData,
  FetchReportsJobResult,
} from './campaign-reports-fetch.constants';

export type FetchReportsJobState =
  | 'completed'
  | 'failed'
  | 'active'
  | 'waiting'
  | 'delayed'
  | 'paused';

export interface FetchReportsJobStatus {
  job_id: string;
  state: FetchReportsJobState;
  progress: unknown;
  created_at_ms: number;
  started_at_ms?: number;
  finished_at_ms?: number;
  attempts_made: number;
  failed_reason?: string;
  result?: FetchReportsJobResult;
  params?: FetchReportsJobData;
}

@Injectable()
export class CampaignReportsFetchJobsService {
  constructor(
    @InjectQueue(CAMPAIGN_REPORTS_FETCH_QUEUE)
    private readonly queue: Queue<FetchReportsJobData, FetchReportsJobResult>,
  ) {}

  async enqueue(
    dto: FetchReportsDto,
  ): Promise<{ job_id: string; deduped: boolean }> {
    const payload: FetchReportsJobData = {
      from_date: dto.from_date,
      to_date: dto.to_date,
      event_name: dto.event_name,
      take: dto.take,
    };

    const jobId = this.buildDeterministicJobId(payload);

    try {
      const existing = await this.queue.getJob(jobId);
      if (existing) {
        return { job_id: jobId, deduped: true };
      }

      await this.queue.add(CAMPAIGN_REPORTS_FETCH_JOB, payload, {
        jobId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 30_000 },
      });

      return { job_id: jobId, deduped: false };
    } catch (error: unknown) {
      const err = error as Error;
      // BullMQ throws when adding a job with existing jobId. Treat as dedupe.
      if (
        err.message?.toLowerCase().includes('job') &&
        err.message.toLowerCase().includes('exists')
      ) {
        return { job_id: jobId, deduped: true };
      }
      throw error;
    }
  }

  async getStatus(jobId: string): Promise<FetchReportsJobStatus | null> {
    const job = await this.queue.getJob(jobId);
    if (!job) {
      return null;
    }

    const state = (await job.getState()) as FetchReportsJobState;

    return {
      job_id: jobId,
      state,
      progress: job.progress,
      created_at_ms: job.timestamp,
      started_at_ms: job.processedOn ?? undefined,
      finished_at_ms: job.finishedOn ?? undefined,
      attempts_made: job.attemptsMade,
      failed_reason: job.failedReason || undefined,
      result: job.returnvalue || undefined,
      params: job.data,
    };
  }

  async cancel(jobId: string): Promise<boolean> {
    const job = await this.queue.getJob(jobId);
    if (!job) {
      return false;
    }

    const state = (await job.getState()) as FetchReportsJobState;
    if (state === 'active') {
      throw new ConflictException(
        'Job is already active and cannot be removed',
      );
    }

    await job.remove();
    return true;
  }

  private buildDeterministicJobId(payload: FetchReportsJobData): string {
    const key = [
      payload.from_date,
      payload.to_date,
      payload.event_name,
      String(payload.take ?? ''),
    ].join('|');

    const hash = createHash('sha1').update(key).digest('hex');
    return `cr_fetch_${hash}`;
  }
}
