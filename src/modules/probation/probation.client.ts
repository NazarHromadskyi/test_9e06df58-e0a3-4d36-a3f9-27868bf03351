import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Observable, map, catchError, throwError } from 'rxjs';
import { AxiosError } from 'axios';
import { ProbationResponse } from './interfaces/probation-response.interface';
import { retryWithBackoff } from '../../common/operators/retry-with-backoff.operator';

export interface FetchPageParams {
  from_date: string;
  to_date: string;
  event_name: string;
  take: number;
}

/**
 * HTTP client for Probation API. Fetches campaign reports with retry and error handling.
 * Supports initial page fetch by params and subsequent pages by cursor URL.
 */
@Injectable()
export class ProbationClient {
  private readonly logger = new Logger(ProbationClient.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiUrl =
      this.configService.get<string>('probationApi.url') ??
      'https://probation.impulseapi.link';
    this.apiKey = this.configService.get<string>('probationApi.apiKey') ?? '';
  }

  /**
   * Fetches the first page of campaign reports from Probation API.
   * @param params - Date range, event name and page size
   * @returns Observable of API response (CSV + pagination)
   */
  fetchReportsPage(params: FetchPageParams): Observable<ProbationResponse> {
    const url = `${this.apiUrl}/tasks/campaign/reports`;

    return this.httpService
      .get<ProbationResponse>(url, {
        headers: {
          'x-api-key': this.apiKey,
        },
        params: {
          from_date: params.from_date,
          to_date: params.to_date,
          event_name: params.event_name,
          take: params.take,
        },
      })
      .pipe(
        map((response) => response.data),
        retryWithBackoff(this.maxRetries, this.retryDelay, this.logger),
        catchError((error: AxiosError) => this.handleError(error)),
      );
  }

  /**
   * Fetches a page by full URL, relative path or cursor token.
   * Validates that absolute URLs use the configured API domain.
   * @param urlOrPath - Full URL, path (e.g. /tasks/...) or cursor token
   * @returns Observable of API response
   */
  fetchPageByUrl(urlOrPath: string): Observable<ProbationResponse> {
    const fullUrl = this.resolveUrl(urlOrPath);

    return this.httpService
      .get<ProbationResponse>(fullUrl, {
        headers: {
          'x-api-key': this.apiKey,
        },
      })
      .pipe(
        map((response) => response.data),
        retryWithBackoff(this.maxRetries, this.retryDelay, this.logger),
        catchError((error: AxiosError) => this.handleError(error)),
      );
  }

  private resolveUrl(urlOrPath: string): string {
    if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
      this.validateUrlDomain(urlOrPath);
      return urlOrPath;
    }

    if (urlOrPath.startsWith('/')) {
      return `${this.apiUrl}${urlOrPath}`;
    }

    return `${this.apiUrl}/tasks/campaign/reports?cursor=${encodeURIComponent(urlOrPath)}`;
  }

  private validateUrlDomain(url: string): void {
    try {
      const targetUrl = new URL(url);
      const apiUrl = new URL(this.apiUrl);

      if (targetUrl.hostname !== apiUrl.hostname) {
        throw new HttpException(
          `Invalid pagination URL: hostname "${targetUrl.hostname}" does not match API domain "${apiUrl.hostname}"`,
          HttpStatus.BAD_REQUEST,
        );
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Invalid pagination URL format: ${url}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private handleError(error: AxiosError): Observable<never> {
    let message = 'Failed to fetch data from Probation API';
    let status = HttpStatus.INTERNAL_SERVER_ERROR;

    if (error.response) {
      status = error.response.status;
      const data = error.response.data as { error?: { message?: string } };
      message = data?.error?.message || error.message;
    } else if (error.request) {
      message = 'No response received from Probation API';
      status = HttpStatus.SERVICE_UNAVAILABLE;
    }

    this.logger.error(`Probation API error: ${message}`, error.stack);
    return throwError(() => new HttpException(message, status));
  }
}
