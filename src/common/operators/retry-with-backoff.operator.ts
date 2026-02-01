import { Logger } from '@nestjs/common';
import { MonoTypeOperatorFunction, retry, timer } from 'rxjs';

/**
 * RxJS operator that retries failed requests with exponential backoff
 * @param maxRetries - Maximum number of retry attempts
 * @param baseDelay - Base delay in milliseconds (multiplied by retry count)
 * @param logger - NestJS Logger instance for logging retry attempts
 */
export function retryWithBackoff<T>(
  maxRetries: number,
  baseDelay: number,
  logger: Logger,
): MonoTypeOperatorFunction<T> {
  return retry({
    count: maxRetries,
    delay: (error: Error, retryCount: number) => {
      logger.warn(
        `Request failed, attempt ${retryCount}/${maxRetries}: ${error.message}`,
      );
      return timer(baseDelay * retryCount);
    },
  });
}
