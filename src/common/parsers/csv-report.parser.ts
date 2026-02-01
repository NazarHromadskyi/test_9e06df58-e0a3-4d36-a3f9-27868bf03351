import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { Observable, EMPTY } from 'rxjs';
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
   * Parses CSV data into batches of structured campaign report objects.
   * Emits multiple batches instead of accumulating all records in memory.
   * This significantly reduces peak memory usage for large datasets.
   *
   * Note: Stream-based parsing without true backpressure control. The CSV stream
   * continues reading while batches are being processed, which may result in
   * multiple batches queued in memory if downstream processing is slower than parsing.
   * For applications requiring strict memory control with large pages (>10k records),
   * consider alternative approaches like AsyncGenerator or callback-based processing.
   *
   * @param csv - Raw CSV string from API response
   * @param fallbackEventName - Event name to use if not present in CSV row
   * @param batchSize - Number of records per batch (default: 500)
   * @returns Observable that emits batches of parsed reports, or completes without emissions if CSV is empty
   *
   * @example
   * // Emits: [batch1 (500 records)], [batch2 (500 records)], [batch3 (87 records)]
   * parseInBatches(csv, 'install', 500)
   */
  parseInBatches(
    csv: string,
    fallbackEventName: string,
    batchSize: number = this.defaultBatchSize,
  ): Observable<ParsedCampaignReport[]> {
    if (!csv || csv.trim() === '') {
      return EMPTY; // Complete without emissions to avoid unnecessary processing
    }

    return new Observable((subscriber) => {
      let buffer: ParsedCampaignReport[] = [];
      const parser = Readable.from([csv]).pipe(
        parse({
          columns: true,
          skip_empty_lines: true,
          trim: true,
        }),
      );

      parser.on('data', (record: Record<string, string>) => {
        try {
          buffer.push(this.mapRecord(record, fallbackEventName));

          // Emit batch when buffer reaches batch size
          if (buffer.length >= batchSize) {
            subscriber.next([...buffer]);
            buffer = [];
          }
        } catch (error) {
          const err = error as Error;
          this.logger.warn(`Skipping invalid record: ${err.message}`);
        }
      });

      parser.on('end', () => {
        // Emit remaining records in buffer
        if (buffer.length > 0) {
          subscriber.next(buffer);
        }
        subscriber.complete();
      });

      parser.on('error', (error: Error) => {
        this.logger.error(`Failed to parse CSV data: ${error.message}`);
        subscriber.error(
          new HttpException(
            'Failed to parse response data',
            HttpStatus.INTERNAL_SERVER_ERROR,
          ),
        );
      });

      // Cleanup on unsubscribe
      return () => {
        parser.destroy();
      };
    });
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
