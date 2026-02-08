import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FetchReportsQueuedDataDto {
  @ApiProperty({
    description: 'BullMQ job id (deterministic for same params)',
    example: 'cr_fetch_2a1f6a9d5b8a0d0f7dd6f0a5d4f3f2e1c0b9a8d7',
  })
  job_id: string;

  @ApiProperty({
    description: 'True when an identical job already exists (deduped by job_id)',
    example: false,
  })
  deduped: boolean;

  @ApiProperty({
    description: 'Relative URL to poll for job status',
    example: '/campaign-reports/fetch/cr_fetch_2a1f6a9d5b8a0d0f7dd6f0a5d4f3f2e1c0b9a8d7',
  })
  status_url: string;
}

export class FetchReportsQueuedResponseDto {
  @ApiProperty({ description: 'Operation success status', example: true })
  success: boolean;

  @ApiProperty({
    description: 'Response message',
    example: 'Fetch job enqueued',
  })
  message: string;

  @ApiProperty({ type: FetchReportsQueuedDataDto })
  data: FetchReportsQueuedDataDto;
}

export class FetchReportsJobStatusDataDto {
  @ApiProperty({ description: 'Job id', example: 'cr_fetch_...' })
  job_id: string;

  @ApiProperty({
    description: 'BullMQ job state',
    example: 'waiting',
    enum: ['completed', 'failed', 'active', 'waiting', 'delayed', 'paused'],
  })
  state: string;

  @ApiPropertyOptional({
    description: 'Job progress (shape depends on processor)',
    type: 'object',
    additionalProperties: true,
  })
  progress?: unknown;

  @ApiProperty({ description: 'Creation time (ms since epoch)', example: 1739000000000 })
  created_at_ms: number;

  @ApiPropertyOptional({ description: 'Start time (ms since epoch)', example: 1739000001234 })
  started_at_ms?: number;

  @ApiPropertyOptional({ description: 'Finish time (ms since epoch)', example: 1739000009876 })
  finished_at_ms?: number;

  @ApiProperty({ description: 'Attempts made', example: 0 })
  attempts_made: number;

  @ApiPropertyOptional({ description: 'Failure reason (if failed)' })
  failed_reason?: string;

  @ApiPropertyOptional({
    description: 'Result summary (if completed)',
    type: 'object',
    additionalProperties: true,
  })
  result?: unknown;

  @ApiPropertyOptional({
    description: 'Original fetch params',
    type: 'object',
    additionalProperties: true,
  })
  params?: unknown;
}

export class FetchReportsJobStatusResponseDto {
  @ApiProperty({ description: 'Operation success status', example: true })
  success: boolean;

  @ApiProperty({
    description: 'Response message',
    example: 'Job status',
  })
  message: string;

  @ApiProperty({ type: FetchReportsJobStatusDataDto })
  data: FetchReportsJobStatusDataDto;
}
