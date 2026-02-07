import { Injectable, Logger } from '@nestjs/common';
import {
  Observable,
  expand,
  scan,
  lastValueFrom,
  EMPTY,
  tap,
  catchError,
  throwError,
  defer,
  concatMap,
} from 'rxjs';
import {
  FetchReportsParams,
  PageProcessor,
  FetchAndProcessResult,
  ProbationResponse,
} from './interfaces/probation-response.interface';
import { ProbationClient } from './probation.client';
import { CsvReportParser } from '../../common/parsers/csv-report.parser';

interface PageProcessingStep {
  recordsFetched: number;
  recordsProcessed: number;
  nextCursor?: string;
}

@Injectable()
export class ProbationService {
  private readonly logger = new Logger(ProbationService.name);
  private readonly csvBatchSize = 500;

  constructor(
    private readonly probationClient: ProbationClient,
    private readonly csvParser: CsvReportParser,
  ) {}

  /**
   * Fetches and processes campaign reports using RxJS Observable pipeline.
   *
   * Uses expand with deferred processing to ensure sequential execution:
   * fetch page → parse CSV in batches → process each batch (upsert) → THEN fetch next page
   *
   * The expand operator here recursively produces new observables AFTER the previous
   * one completes (including all downstream processing), ensuring that the next HTTP
   * request is not made until current page is fully saved to the database.
   *
   * Memory optimization: CSV is parsed in batches (default 500 records per batch).
   * Each batch is processed and freed before the next batch is parsed, significantly
   * reducing peak memory usage compared to parsing the entire page at once.
   *
   * @param params - Fetch parameters (date range, event name, page size)
   * @param processor - Callback to process each batch (e.g., save to database)
   * @returns Promise with final statistics when complete
   */
  async fetchAndProcessReports(
    params: FetchReportsParams,
    processor: PageProcessor,
  ): Promise<FetchAndProcessResult> {
    const pageSize = params.take || 1000;

    const pipeline$ = this.buildFetchAndProcessPipeline(
      params,
      pageSize,
      processor,
    ).pipe(
      scan(
        (stats, step) => ({
          totalFetched: stats.totalFetched + step.recordsFetched,
          totalProcessed: stats.totalProcessed + step.recordsProcessed,
          pagesProcessed: stats.pagesProcessed + 1,
        }),
        {
          totalFetched: 0,
          totalProcessed: 0,
          pagesProcessed: 0,
        } as FetchAndProcessResult,
      ),
      catchError((error: unknown) => {
        const err = error as Error;
        this.logger.error(
          `Failed to fetch/process reports: ${err.message}`,
          err.stack,
        );
        return throwError(() => error);
      }),
    );

    return lastValueFrom(pipeline$);
  }

  private buildFetchAndProcessPipeline(
    params: FetchReportsParams,
    pageSize: number,
    processor: PageProcessor,
  ): Observable<PageProcessingStep> {
    const seenCursors = new Set<string>();

    const initialPage$ = defer(() =>
      this.fetchAndProcessPage(
        this.probationClient.fetchReportsPage({
          from_date: params.from_date,
          to_date: params.to_date,
          event_name: params.event_name,
          take: pageSize,
        }),
        params.event_name,
        processor,
        1,
      ),
    );

    return initialPage$.pipe(
      expand((step, index) => {
        const nextCursor = step.nextCursor;

        if (!nextCursor) {
          return EMPTY;
        }

        if (seenCursors.has(nextCursor)) {
          this.logger.error(
            `Pagination cursor repeated on page ${index + 2}: ${nextCursor}`,
          );
          return throwError(
            () =>
              new Error(`Pagination cursor repeated, aborting: ${nextCursor}`),
          );
        }
        seenCursors.add(nextCursor);

        this.logger.debug(`Fetching next page: ${nextCursor}`);

        // Return new Observable that fetches and processes next page
        // index+2 because: index is 0-based from expand, +1 for initial page, +1 for next page
        return defer(() =>
          this.fetchAndProcessPage(
            this.probationClient.fetchPageByUrl(nextCursor),
            params.event_name,
            processor,
            index + 2,
          ),
        );
      }),
    );
  }

  /**
   * Fetches a single page and processes it in batches (parse + save).
   * Returns aggregated statistics along with nextCursor for pagination.
   *
   * The entire chain (HTTP → parse batches → upsert batches → aggregate) must
   * complete before expand operator triggers the next page fetch.
   *
   * Memory optimization flow:
   * 1. iterateBatches yields multiple batches (e.g., 500 records each)
   * 2. Each batch is processed sequentially (saved to DB) via await processor(batch)
   * 3. Batch is freed from memory after processing
   * 4. Aggregate counters are updated per batch
   * 5. Single PageProcessingStep is passed to expand for pagination decision
   *
   * This ensures only one batch is in memory at a time, not the entire page.
   */
  private fetchAndProcessPage(
    fetch$: Observable<ProbationResponse>,
    eventName: string,
    processor: PageProcessor,
    pageNumber: number,
  ): Observable<PageProcessingStep> {
    return fetch$.pipe(
      tap(() => this.logger.debug(`Processing page ${pageNumber}`)),
      concatMap(async (response) => {
        let recordsFetched = 0;
        let recordsProcessed = 0;
        let csvBatchIndex = 0;

        for await (const csvBatch of this.csvParser.iterateBatches(
          response.data.csv,
          eventName,
          this.csvBatchSize,
        )) {
          csvBatchIndex += 1;
          this.logger.debug(
            `Page ${pageNumber}, CSV batch ${csvBatchIndex}: ${csvBatch.length} records parsed`,
          );

          const processed = await processor(csvBatch);
          this.logger.debug(
            `Page ${pageNumber}, CSV batch ${csvBatchIndex}: ${processed} records saved`,
          );

          recordsFetched += csvBatch.length;
          recordsProcessed += processed;
        }

        return {
          recordsFetched,
          recordsProcessed,
          nextCursor: response.data.pagination?.next,
        };
      }),
    );
  }
}
