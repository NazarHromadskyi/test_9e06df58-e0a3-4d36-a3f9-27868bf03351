import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { parse } from 'csv-parse';
import { Readable } from 'stream';
import { DateUtils } from '../utils/date.utils';
import { ParsedCampaignReport } from '../../modules/probation/interfaces/probation-response.interface';

/**
 * Service responsible for parsing CSV data from Probation API responses.
 * Uses streaming parser to handle large datasets without blocking the event loop.
 */
@Injectable()
export class CsvReportParser {
  private readonly logger = new Logger(CsvReportParser.name);
  private readonly defaultBatchSize = 500;

  /**
   * Pull-based CSV parsing that supports backpressure via `for await`.
   *
   * This method yields batches only when the consumer asks for them, which enables
   * strict sequential processing (e.g., `await processor(batch)` before reading more).
   */
  async *iterateBatches(
    csv: string,
    fallbackEventName: string,
    batchSize: number = this.defaultBatchSize,
  ): AsyncGenerator<ParsedCampaignReport[]> {
    if (!csv || csv.trim() === '') {
      return;
    }

    const input = Readable.from([csv]);
    const parser = parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    input.pipe(parser);

    let buffer: ParsedCampaignReport[] = [];

    try {
      for await (const record of parser as AsyncIterable<
        Record<string, string>
      >) {
        try {
          buffer.push(this.mapRecord(record, fallbackEventName));

          if (buffer.length >= batchSize) {
            yield buffer;
            buffer = [];
          }
        } catch (error) {
          const err = error as Error;
          this.logger.warn(`Skipping invalid record: ${err.message}`);
        }
      }

      if (buffer.length > 0) {
        yield buffer;
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to parse CSV data: ${err.message}`, err.stack);
      throw new HttpException(
        'Failed to parse response data',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      parser.destroy();
      input.destroy();
    }
  }

  /**
   * Maps a single CSV record to ParsedCampaignReport.
   * Validates required fields and parses event_time strictly.
   */
  private mapRecord(
    record: Record<string, string>,
    fallbackEventName: string,
  ): ParsedCampaignReport {
    const eventTime = this.parseEventTime(record.event_time);

    return {
      campaign: record.campaign || '',
      campaign_id: record.campaign_id || '',
      adgroup: record.adgroup || '',
      adgroup_id: record.adgroup_id || '',
      ad: record.ad || '',
      ad_id: record.ad_id || '',
      client_id: record.client_id || '',
      event_name: record.event_name || fallbackEventName,
      event_time: eventTime,
    };
  }

  /**
   * Parses event_time string to Date with strict UTC handling.
   * Throws error for invalid formats instead of using fallback values.
   *
   * @param rawTime - Raw time string from CSV
   * @throws Error if time format is invalid
   */
  private parseEventTime(rawTime: string): Date {
    if (!rawTime || rawTime.trim() === '') {
      throw new Error('event_time is required but was empty');
    }

    try {
      return DateUtils.parseToUtc(rawTime);
    } catch (error) {
      const err = error as Error;
      throw new Error(`Invalid event_time "${rawTime}": ${err.message}`);
    }
  }
}
