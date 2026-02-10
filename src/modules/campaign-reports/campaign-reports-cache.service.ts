import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { randomUUID } from 'node:crypto';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import type {
  AggregatedReportDto,
  AggregatedReportItem,
} from './dto/aggregated-reports.dto';

@Injectable()
export class CampaignReportsCacheService {
  private readonly logger = new Logger(CampaignReportsCacheService.name);

  private readonly aggregatedTtlMs = 300000; // 5 minutes
  private readonly versionTtlMs = 31536000000; // 365 days
  private readonly aggregatedVersionKey = 'aggregated:version';

  constructor(
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async getAggregated(
    params: AggregatedReportDto,
  ): Promise<PaginatedResponseDto<AggregatedReportItem> | undefined> {
    const key = await this.buildAggregatedKey(params);
    const cached =
      await this.cacheManager.get<PaginatedResponseDto<AggregatedReportItem>>(
        key,
      );

    if (cached) {
      this.logger.debug(`Cache hit for key: ${key}`);
    } else {
      this.logger.debug(`Cache miss for key: ${key}`);
    }

    return cached;
  }

  async setAggregated(
    params: AggregatedReportDto,
    value: PaginatedResponseDto<AggregatedReportItem>,
  ): Promise<void> {
    const key = await this.buildAggregatedKey(params);
    await this.cacheManager.set(key, value, this.aggregatedTtlMs);
  }

  async invalidateAggregated(): Promise<void> {
    const nextVersion = randomUUID();
    await this.cacheManager.set(
      this.aggregatedVersionKey,
      nextVersion,
      this.versionTtlMs,
    );
    this.logger.debug(`Aggregated cache invalidated (version=${nextVersion})`);
  }

  private async buildAggregatedKey(
    params: AggregatedReportDto,
  ): Promise<string> {
    const { from_date, to_date, event_name, page = 1, take = 10 } = params;
    const version = await this.getOrInitAggregatedVersion();
    return `aggregated:${version}:${from_date}:${to_date}:${event_name}:${page}:${take}`;
  }

  private async getOrInitAggregatedVersion(): Promise<string> {
    const current = await this.cacheManager.get<string>(
      this.aggregatedVersionKey,
    );
    if (current && current.trim() !== '') {
      return current;
    }

    const initial = randomUUID();
    await this.cacheManager.set(
      this.aggregatedVersionKey,
      initial,
      this.versionTtlMs,
    );
    return initial;
  }
}
