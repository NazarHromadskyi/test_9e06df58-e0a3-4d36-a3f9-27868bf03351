import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import {
  ApiProperty,
  ApiPropertyOptional,
  IntersectionType,
} from '@nestjs/swagger';
import {
  DateTimeRangeDto,
  EventNameDto,
} from '../../../common/dto/date-range.dto';

/**
 * DTO for fetch reports request.
 * Combines datetime range and event name filter with custom take parameter.
 */
export class FetchReportsDto extends IntersectionType(
  DateTimeRangeDto,
  EventNameDto,
) {
  @ApiPropertyOptional({
    description: 'Number of records per page from Probation API',
    minimum: 1,
    maximum: 1000,
    default: 1000,
    example: 1000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  take?: number = 1000;
}

/**
 * Data payload for fetch reports response.
 */
export class FetchReportsDataDto {
  @ApiProperty({
    description: 'Total records fetched and processed',
    example: 1500,
  })
  total_processed: number;

  @ApiProperty({
    description: 'Operation duration in milliseconds',
    example: 2345,
  })
  duration_ms: number;
}

/**
 * Response DTO for fetch reports endpoint.
 */
export class FetchReportsResponseDto {
  @ApiProperty({ description: 'Operation success status', example: true })
  success: boolean;

  @ApiProperty({
    description: 'Response message',
    example: 'Reports fetched and saved successfully',
  })
  message: string;

  @ApiProperty({ type: FetchReportsDataDto })
  data: FetchReportsDataDto;
}
