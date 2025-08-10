import { NetworkError, NetworkErrorCode } from '../types';

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryCondition?: (error: Error) => boolean;
}

export interface NetworkRequestOptions {
  timeout?: number;
  retryConfig?: Partial<RetryConfig>;
  signal?: AbortSignal;
}

/**
 * Network error handler with exponential backoff retry mechanism
 * Provides comprehensive error handling for network requests
 */
export class NetworkErrorHandler {
  private static readonly DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    retryCondition: (error: Error) => {
      // Retry on network errors, timeouts, and 5xx server errors
      if (error instanceof NetworkError) {
        return [
          NetworkErrorCode.CONNECTION_FAILED,
          NetworkErrorCode.TIMEOUT,
          NetworkErrorCode.SERVER_ERROR
        ].includes(error.code);
      }
      return false;
    }
  };

  /**
   * Execute a network request with retry logic
   */
  static async executeWithRetry<T>(
    requestFn: () => Promise<T>,
    options: NetworkRequestOptions = {}
  ): Promise<T> {
    const retryConfig = { ...this.DEFAULT_RETRY_CONFIG, ...options.retryConfig };
    let lastError: Error;
    let attempt = 0;

    while (attempt <= retryConfig.maxRetries) {
      try {
        // Check if request was aborted
        if (options.signal?.aborted) {
          throw new NetworkError(
            'Request was aborted',
            NetworkErrorCode.CONNECTION_FAILED
          );
        }

        // Execute the request with timeout if specified
        if (options.timeout) {
          return await this.withTimeout(requestFn(), options.timeout, options.signal);
        } else {
          return await requestFn();
        }
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry if this is the last attempt or if retry condition fails
        if (attempt >= retryConfig.maxRetries || 
            !retryConfig.retryCondition!(lastError)) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          retryConfig.baseDelay * Math.pow(retryConfig.backoffMultiplier, attempt),
          retryConfig.maxDelay
        );

        // Add jitter to prevent thundering herd
        const jitteredDelay = delay + Math.random() * 1000;

        console.warn(`Request failed (attempt ${attempt + 1}/${retryConfig.maxRetries + 1}), retrying in ${Math.round(jitteredDelay)}ms:`, lastError.message);

        // Wait before retrying
        await this.delay(jitteredDelay, options.signal);
        attempt++;
      }
    }

    // All retries exhausted, throw the last error
    throw this.enhanceError(lastError!, attempt);
  }

  /**
   * Wrap a promise with a timeout
   */
  private static withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    signal?: AbortSignal
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new NetworkError(
          `Request timed out after ${timeoutMs}ms`,
          NetworkErrorCode.TIMEOUT
        ));
      }, timeoutMs);

      // Handle abort signal
      const abortHandler = () => {
        clearTimeout(timeoutId);
        reject(new NetworkError(
          'Request was aborted',
          NetworkErrorCode.CONNECTION_FAILED
        ));
      };

      if (signal) {
        signal.addEventListener('abort', abortHandler);
      }

      promise
        .then((result) => {
          clearTimeout(timeoutId);
          if (signal) {
            signal.removeEventListener('abort', abortHandler);
          }
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          if (signal) {
            signal.removeEventListener('abort', abortHandler);
          }
          reject(error);
        });
    });
  }

  /**
   * Create a delay promise that can be aborted
   */
  private static delay(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new NetworkError(
          'Request was aborted',
          NetworkErrorCode.CONNECTION_FAILED
        ));
        return;
      }

      const timeoutId = setTimeout(resolve, ms);

      const abortHandler = () => {
        clearTimeout(timeoutId);
        reject(new NetworkError(
          'Request was aborted',
          NetworkErrorCode.CONNECTION_FAILED
        ));
      };

      if (signal) {
        signal.addEventListener('abort', abortHandler, { once: true });
      }
    });
  }

  /**
   * Enhance error with retry information
   */
  private static enhanceError(error: Error, attemptCount: number): Error {
    if (error instanceof NetworkError) {
      error.message = `${error.message} (failed after ${attemptCount + 1} attempts)`;
      return error;
    }

    // Convert generic errors to NetworkError
    return new NetworkError(
      `Network request failed: ${error.message} (failed after ${attemptCount + 1} attempts)`,
      NetworkErrorCode.CONNECTION_FAILED,
      undefined,
      error
    );
  }

  /**
   * Check if the current environment is online
   */
  static isOnline(): boolean {
    return navigator.onLine;
  }

  /**
   * Create a network error from a fetch response
   */
  static createErrorFromResponse(response: Response): NetworkError {
    let code: NetworkErrorCode;
    let message: string;

    if (response.status >= 500) {
      code = NetworkErrorCode.SERVER_ERROR;
      message = `Server error: ${response.status} ${response.statusText}`;
    } else if (response.status === 401) {
      code = NetworkErrorCode.UNAUTHORIZED;
      message = 'Unauthorized: Invalid credentials or session expired';
    } else if (response.status === 429) {
      code = NetworkErrorCode.RATE_LIMITED;
      message = 'Rate limited: Too many requests';
    } else {
      code = NetworkErrorCode.CONNECTION_FAILED;
      message = `HTTP error: ${response.status} ${response.statusText}`;
    }

    return new NetworkError(message, code, response.status);
  }

  /**
   * Create a network error from a fetch error
   */
  static createErrorFromFetchError(error: Error): NetworkError {
    if (error.name === 'AbortError') {
      return new NetworkError(
        'Request was aborted',
        NetworkErrorCode.CONNECTION_FAILED,
        undefined,
        error
      );
    }

    if (error.message.includes('timeout') || error.name === 'TimeoutError') {
      return new NetworkError(
        'Request timed out',
        NetworkErrorCode.TIMEOUT,
        undefined,
        error
      );
    }

    // Generic network error
    return new NetworkError(
      `Network request failed: ${error.message}`,
      NetworkErrorCode.CONNECTION_FAILED,
      undefined,
      error
    );
  }

  /**
   * Setup online/offline event listeners
   */
  static setupConnectionMonitoring(
    onOnline?: () => void,
    onOffline?: () => void
  ): () => void {
    const handleOnline = () => {
      console.log('Network connection restored');
      onOnline?.();
    };

    const handleOffline = () => {
      console.warn('Network connection lost');
      onOffline?.();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Return cleanup function
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }

  /**
   * Create an AbortController with timeout
   */
  static createAbortController(timeoutMs?: number): AbortController {
    const controller = new AbortController();

    if (timeoutMs) {
      setTimeout(() => {
        controller.abort();
      }, timeoutMs);
    }

    return controller;
  }
}