import { IntersectionType } from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import {
  DateTimeRangeDto,
  EventNameDto,
} from '../../../common/dto/date-range.dto';

/**
 * DTO for aggregated reports query parameters.
 * Combines datetime range, event name filter, and pagination using composition.
 * Accepts full datetime format (YYYY-MM-DD HH:mm:ss) aligned with source API.
 */
export class AggregatedReportDto extends IntersectionType(
  IntersectionType(DateTimeRangeDto, EventNameDto),
  PaginationDto,
) {}

/**
 * Single item in the aggregated reports response.
 */
export class AggregatedReportItem {
  @ApiProperty({ description: 'Advertisement ID', example: 'ad_123' })
  ad_id: string;

  @ApiProperty({
    description: 'Date of the aggregated events (UTC)',
    example: '2024-01-15',
  })
  date: string;

  @ApiProperty({
    description: 'Number of events for this ad on this date',
    example: 150,
  })
  event_count: number;
}
