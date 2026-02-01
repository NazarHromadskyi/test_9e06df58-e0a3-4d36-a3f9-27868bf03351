import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { CampaignReportsService } from './campaign-reports.service';
import { ProbationService } from '../probation/probation.service';
import {
  FetchReportsDto,
  FetchReportsResponseDto,
} from './dto/fetch-reports.dto';
import {
  AggregatedReportDto,
  AggregatedReportItem,
} from './dto/aggregated-reports.dto';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';

@ApiTags('campaign-reports')
@Controller('campaign-reports')
export class CampaignReportsController {
  private readonly logger = new Logger(CampaignReportsController.name);

  constructor(
    private readonly campaignReportsService: CampaignReportsService,
    private readonly probationService: ProbationService,
  ) {}

  @Post('fetch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Fetch campaign reports from Probation API',
    description:
      'Fetches campaign reports from external Probation API for the specified date range and event type, then saves them to the database with upsert logic.',
  })
  @ApiResponse({
    status: 200,
    description: 'Reports fetched and saved successfully',
    type: FetchReportsResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid request parameters' })
  @ApiInternalServerErrorResponse({
    description: 'Failed to fetch or save reports',
  })
  async fetchReports(
    @Body() dto: FetchReportsDto,
  ): Promise<FetchReportsResponseDto> {
    const startTime = Date.now();

    this.logger.log(
      `Starting fetch: ${dto.from_date} to ${dto.to_date}, event: ${dto.event_name}`,
    );

    const result = await this.probationService.fetchAndProcessReports(
      {
        from_date: dto.from_date,
        to_date: dto.to_date,
        event_name: dto.event_name,
        take: dto.take,
      },
      (reports) => this.campaignReportsService.upsertReportsPage(reports),
    );

    this.logger.log(
      `Complete: ${result.pagesProcessed} pages, ${result.totalFetched} records`,
    );

    const duration = Date.now() - startTime;

    return {
      success: true,
      message: 'Reports fetched and saved successfully',
      data: {
        total_processed: result.totalProcessed,
        duration_ms: duration,
      },
    };
  }

  @Get('aggregated')
  @ApiOperation({
    summary: 'Get aggregated event counts',
    description:
      'Returns aggregated event counts grouped by ad_id and date for the specified date range and event type.',
  })
  @ApiResponse({
    status: 200,
    description: 'Aggregated reports retrieved successfully',
  })
  @ApiBadRequestResponse({ description: 'Invalid query parameters' })
  async getAggregatedReports(
    @Query() dto: AggregatedReportDto,
  ): Promise<PaginatedResponseDto<AggregatedReportItem>> {
    this.logger.log(
      `Aggregation request: ${dto.from_date} to ${dto.to_date}, event: ${dto.event_name}`,
    );

    return this.campaignReportsService.getAggregatedReports(dto);
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Get database statistics',
    description: 'Returns the total count of campaign reports in the database.',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        total_records: { type: 'number', example: 15000 },
      },
    },
  })
  async getStats(): Promise<{ total_records: number }> {
    const total = await this.campaignReportsService.getTotalCount();
    return { total_records: total };
  }
}
