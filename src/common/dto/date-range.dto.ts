import { IsString, IsNotEmpty, Matches, Validate } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsDateRangeValid } from '../validators/date-range.validator';

/**
 * Base DTO for date-only date range (YYYY-MM-DD format).
 * Used for aggregation queries.
 */
export class DateRangeDto {
  @ApiProperty({
    description: 'Start date',
    example: '2026-01-01',
    pattern: '^\\d{4}-\\d{2}-\\d{2}$',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'from_date must be in format YYYY-MM-DD',
  })
  from_date: string;

  @ApiProperty({
    description: 'End date',
    example: '2026-01-31',
    pattern: '^\\d{4}-\\d{2}-\\d{2}$',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'to_date must be in format YYYY-MM-DD',
  })
  @Validate(IsDateRangeValid)
  to_date: string;
}

/**
 * Base DTO for datetime date range (YYYY-MM-DD HH:mm:ss format).
 * Used for fetching reports; aligned with DateUtils full datetime support.
 */
export class DateTimeRangeDto {
  @ApiProperty({
    description: 'Start date and time (UTC)',
    example: '2026-01-01 00:00:00',
    pattern: '^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}$',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, {
    message: 'from_date must be in format YYYY-MM-DD HH:mm:ss',
  })
  from_date: string;

  @ApiProperty({
    description: 'End date and time (UTC)',
    example: '2026-01-31 23:59:59',
    pattern: '^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}$',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, {
    message: 'to_date must be in format YYYY-MM-DD HH:mm:ss',
  })
  @Validate(IsDateRangeValid)
  to_date: string;
}

export class EventNameDto {
  @ApiProperty({
    description: 'Type of event',
    enum: ['install', 'purchase'],
    example: 'install',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^(install|purchase)$/, {
    message: 'event_name must be either "install" or "purchase"',
  })
  event_name: string;
}
