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
  map,
  reduce,
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
  private readonly parseBatchSize = 500;

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
    const take = params.take || 1000;

    const pipeline$ = this.buildFetchAndProcessPipeline(
      params,
      take,
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
    take: number,
    processor: PageProcessor,
  ): Observable<PageProcessingStep> {
    const seenCursors = new Set<string>();

    const initialPage$ = defer(() =>
      this.fetchAndProcessPage(
        this.probationClient.fetchReportsPage({
          from_date: params.from_date,
          to_date: params.to_date,
          event_name: params.event_name,
          take,
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
   * 1. parseInBatches emits multiple batches (e.g., 500 records each)
   * 2. Each batch is immediately processed (saved to DB) via concatMap
   * 3. Batch is freed from memory after processing
   * 4. reduce aggregates all batch results into single PageProcessingStep
   * 5. This single step is passed to expand for pagination decision
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
      concatMap((response) =>
        this.csvParser
          .parseInBatches(response.data.csv, eventName, this.parseBatchSize)
          .pipe(
            concatMap((batch, batchIndex) => {
              this.logger.debug(
                `Page ${pageNumber}, batch ${batchIndex + 1}: ${batch.length} records parsed`,
              );

              return defer(() => processor(batch)).pipe(
                tap((processed) =>
                  this.logger.debug(
                    `Page ${pageNumber}, batch ${batchIndex + 1}: ${processed} records saved`,
                  ),
                ),
                // Map to batch statistics
                map((processed) => ({
                  recordsFetched: batch.length,
                  recordsProcessed: processed,
                })),
              );
            }),
            reduce(
              (acc, batchResult) => ({
                recordsFetched: acc.recordsFetched + batchResult.recordsFetched,
                recordsProcessed:
                  acc.recordsProcessed + batchResult.recordsProcessed,
              }),
              { recordsFetched: 0, recordsProcessed: 0 },
            ),
            map((aggregated) => ({
              ...aggregated,
              nextCursor: response.data.pagination?.next,
            })),
          ),
      ),
    );
  }
}
