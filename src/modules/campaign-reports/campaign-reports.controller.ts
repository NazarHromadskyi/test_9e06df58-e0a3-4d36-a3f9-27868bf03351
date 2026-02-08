import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { CampaignReportsService } from './campaign-reports.service';
import { FetchReportsDto } from './dto/fetch-reports.dto';
import {
  FetchReportsJobStatusResponseDto,
  FetchReportsQueuedResponseDto,
} from './dto/fetch-reports-job.dto';
import {
  AggregatedReportDto,
  AggregatedReportItem,
} from './dto/aggregated-reports.dto';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { CampaignReportsFetchJobsService } from './jobs/campaign-reports-fetch-jobs.service';

@ApiTags('campaign-reports')
@Controller('campaign-reports')
export class CampaignReportsController {
  private readonly logger = new Logger(CampaignReportsController.name);

  constructor(
    private readonly campaignReportsService: CampaignReportsService,
    private readonly fetchJobsService: CampaignReportsFetchJobsService,
  ) {}

  @Post('fetch')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Enqueue background fetch from Probation API',
    description:
      'Creates a BullMQ job and returns its id immediately. The job will fetch campaign reports from external Probation API and upsert them into the database in the background.',
  })
  @ApiResponse({
    status: 202,
    description: 'Job enqueued successfully',
    type: FetchReportsQueuedResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid request parameters' })
  @ApiInternalServerErrorResponse({
    description: 'Failed to enqueue fetch job',
  })
  async fetchReports(
    @Body() dto: FetchReportsDto,
  ): Promise<FetchReportsQueuedResponseDto> {
    this.logger.log(
      `Enqueue fetch: ${dto.from_date} to ${dto.to_date}, event: ${dto.event_name}`,
    );

    const { job_id, deduped } = await this.fetchJobsService.enqueue(dto);

    return {
      success: true,
      message: 'Fetch job enqueued',
      data: {
        job_id,
        deduped,
        status_url: `/campaign-reports/fetch/${job_id}`,
      },
    };
  }

  @Get('fetch/:jobId')
  @ApiOperation({
    summary: 'Get fetch job status',
    description:
      'Returns BullMQ job state, progress, params and (if completed) the result summary.',
  })
  @ApiResponse({
    status: 200,
    description: 'Job status retrieved successfully',
    type: FetchReportsJobStatusResponseDto,
  })
  async getFetchJobStatus(
    @Param('jobId') jobId: string,
  ): Promise<FetchReportsJobStatusResponseDto> {
    const status = await this.fetchJobsService.getStatus(jobId);
    if (!status) {
      throw new NotFoundException('Job not found');
    }

    return {
      success: true,
      message: 'Job status',
      data: status,
    };
  }

  @Post('fetch/:jobId/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel fetch job',
    description:
      'Removes a queued job from BullMQ if it has not started processing yet.',
  })
  @ApiResponse({
    status: 200,
    description: 'Cancel request processed',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Job cancelled' },
        data: {
          type: 'object',
          properties: {
            cancelled: { type: 'boolean', example: true },
          },
        },
      },
    },
  })
  async cancelFetchJob(@Param('jobId') jobId: string): Promise<{
    success: boolean;
    message: string;
    data: { cancelled: boolean };
  }> {
    const cancelled = await this.fetchJobsService.cancel(jobId);
    if (!cancelled) {
      throw new NotFoundException('Job not found');
    }

    return {
      success: true,
      message: 'Job cancelled',
      data: { cancelled: true },
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
