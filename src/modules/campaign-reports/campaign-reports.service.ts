import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ParsedCampaignReport } from '../probation/interfaces/probation-response.interface';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import {
  AggregatedReportDto,
  AggregatedReportItem,
} from './dto/aggregated-reports.dto';
import { CampaignReportRepository } from './repositories/campaign-report.repository';
import { CampaignReportsCacheService } from './campaign-reports-cache.service';

/**
 * Service for managing campaign reports.
 * Handles business logic, transactions, and caching.
 * Delegates data access to CampaignReportRepository.
 */
@Injectable()
export class CampaignReportsService {
  private readonly logger = new Logger(CampaignReportsService.name);

  constructor(
    private readonly campaignReportRepository: CampaignReportRepository,
    private readonly dataSource: DataSource,
    private readonly cacheService: CampaignReportsCacheService,
  ) {}

  /**
   * Upserts a batch of campaign reports inside a single transaction.
   *
   * Note: CSV parsing already yields batches (see CsvReportParser.iterateBatches),
   * so we avoid re-batching and extra array copies here.
   */
  async upsertReportsBatch(reports: ParsedCampaignReport[]): Promise<number> {
    if (reports.length === 0) {
      return 0;
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let totalProcessed = 0;

    try {
      totalProcessed = await this.campaignReportRepository.upsertBatch(
        reports,
        queryRunner,
      );

      await queryRunner.commitTransaction();
      this.logger.debug(`Batch upserted: ${totalProcessed} records processed`);

      return totalProcessed;
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      const err = error as Error;
      this.logger.error(
        `Page transaction rolled back: ${err.message}`,
        err.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Returns aggregated data grouped by ad_id and date.
   * Results are cached for 5 minutes to improve performance.
   */
  async getAggregatedReports(
    params: AggregatedReportDto,
  ): Promise<PaginatedResponseDto<AggregatedReportItem>> {
    const cached = await this.cacheService.getAggregated(params);
    if (cached) {
      return cached;
    }

    const { page = 1, take = 10 } = params;
    const offset = (page - 1) * take;

    const { items, total } = await this.campaignReportRepository.getAggregated({
      from_date: params.from_date,
      to_date: params.to_date,
      event_name: params.event_name,
      offset,
      limit: take,
    });

    const response = new PaginatedResponseDto(items, total, page, take);

    await this.cacheService.setAggregated(params, response);

    return response;
  }

  async invalidateAggregatedCache(): Promise<void> {
    try {
      await this.cacheService.invalidateAggregated();
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.warn(`Failed to invalidate cache: ${err.message}`);
    }
  }

  async getTotalCount(): Promise<number> {
    return this.campaignReportRepository.count();
  }
}
