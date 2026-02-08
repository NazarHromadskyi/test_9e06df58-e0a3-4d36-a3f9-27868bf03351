import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  DataSource,
  QueryRunner,
  SelectQueryBuilder,
} from 'typeorm';
import { CampaignReport } from '../entities/campaign-report.entity';
import { ParsedCampaignReport } from '../../probation/interfaces/probation-response.interface';
import { AggregatedReportItem } from '../dto/aggregated-reports.dto';
import { DateUtils } from '../../../common/utils/date.utils';

export interface AggregationParams {
  from_date: string;
  to_date: string;
  event_name: string;
  offset: number;
  limit: number;
}

export interface AggregationResult {
  items: AggregatedReportItem[];
  total: number;
}

/**
 * Repository for campaign reports data access.
 * Handles database operations including upsert and aggregation queries.
 */
@Injectable()
export class CampaignReportRepository {
  private readonly logger = new Logger(CampaignReportRepository.name);

  constructor(
    @InjectRepository(CampaignReport)
    private readonly repository: Repository<CampaignReport>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Upserts a batch of campaign reports using TypeORM.
   * On conflict (event_time, client_id, event_name), existing records are updated.
   *
   * @param reports - Array of parsed campaign reports
   * @param queryRunner - Query runner for transaction management
   * @returns Number of processed records
   */
  async upsertBatch(
    reports: ParsedCampaignReport[],
    queryRunner: QueryRunner,
  ): Promise<number> {
    if (reports.length === 0) {
      return 0;
    }

    const deduped = this.deduplicateByConflictKey(reports);

    try {
      await queryRunner.manager
        .createQueryBuilder()
        .insert()
        .into(CampaignReport)
        .values(deduped)
        .orUpdate(
          [
            'campaign',
            'campaign_id',
            'adgroup',
            'adgroup_id',
            'ad',
            'ad_id',
            'updated_at',
          ],
          ['event_time', 'client_id', 'event_name'],
          {
            skipUpdateIfNoValuesChanged: true,
          },
        )
        .execute();

      return deduped.length;
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`Failed to upsert batch: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Gets aggregated event counts grouped by ad_id and date.
   * Uses explicit UTC timezone for consistent date handling.
   * Accepts datetime strings (YYYY-MM-DD HH:mm:ss) and converts them to UTC ISO format.
   *
   * @param params - Aggregation parameters
   */
  async getAggregated(params: AggregationParams): Promise<AggregationResult> {
    const { from_date, to_date, event_name, offset, limit } = params;

    const fromDateTime = DateUtils.toUtcDateTimeString(from_date);
    const toDateTime = DateUtils.toUtcDateTimeString(to_date);

    const aggregatedBaseQuery = this.buildAggregatedBaseQuery({
      from_date: fromDateTime,
      to_date: toDateTime,
      event_name,
    });

    interface RawAggregatedRow {
      ad_id: string;
      date: string;
      event_count: string;
      total: string;
    }

    const rows = await this.dataSource
      .createQueryBuilder()
      .select('agg.ad_id', 'ad_id')
      .addSelect('agg.date', 'date')
      .addSelect('agg.event_count', 'event_count')
      .addSelect('COUNT(*) OVER()', 'total')
      .from(`(${aggregatedBaseQuery.getQuery()})`, 'agg')
      .setParameters(aggregatedBaseQuery.getParameters())
      .orderBy('agg.date', 'DESC')
      .addOrderBy('agg.event_count', 'DESC')
      .addOrderBy('agg.ad_id', 'ASC')
      .offset(offset)
      .limit(limit)
      .getRawMany<RawAggregatedRow>();

    // If pagination produces 0 rows (e.g. offset beyond total), window functions can't return total.
    // Fall back to a cheap COUNT(*) over the aggregated subquery.
    const total =
      rows.length > 0
        ? parseInt(rows[0].total, 10)
        : await this.getAggregatedTotalCount(aggregatedBaseQuery);

    const items: AggregatedReportItem[] = rows.map((row) => ({
      ad_id: row.ad_id,
      date: row.date,
      event_count: parseInt(row.event_count, 10),
    }));

    return { items, total };
  }

  async count(): Promise<number> {
    return this.repository.count();
  }

  private deduplicateByConflictKey(
    reports: ParsedCampaignReport[],
  ): ParsedCampaignReport[] {
    const map = new Map<string, ParsedCampaignReport>();
    for (const r of reports) {
      const key = `${r.event_time.getTime()}-${r.client_id}-${r.event_name}`;
      map.set(key, r);
    }
    return Array.from(map.values());
  }

  private buildAggregatedBaseQuery(params: {
    from_date: string;
    to_date: string;
    event_name: string;
  }): SelectQueryBuilder<CampaignReport> {
    const { from_date, to_date, event_name } = params;

    return this.repository
      .createQueryBuilder('cr')
      .select('cr.ad_id', 'ad_id')
      .addSelect("DATE(cr.event_time AT TIME ZONE 'UTC')", 'date')
      .addSelect('COUNT(*)', 'event_count')
      .where('cr.event_time >= :from_date', { from_date })
      .andWhere('cr.event_time <= :to_date', { to_date })
      .andWhere('cr.event_name = :event_name', { event_name })
      .groupBy('cr.ad_id')
      .addGroupBy("DATE(cr.event_time AT TIME ZONE 'UTC')");
  }

  private async getAggregatedTotalCount(
    aggregatedBaseQuery: SelectQueryBuilder<CampaignReport>,
  ): Promise<number> {
    const countQuery = this.dataSource
      .createQueryBuilder()
      .select('COUNT(*)', 'count')
      .from(`(${aggregatedBaseQuery.getQuery()})`, 'agg')
      .setParameters(aggregatedBaseQuery.getParameters());

    const countResult = await countQuery.getRawOne<{ count: string }>();
    return parseInt(countResult?.count ?? '0', 10);
  }
}
