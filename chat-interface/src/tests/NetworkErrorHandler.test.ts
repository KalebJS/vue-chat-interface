import { vi } from 'vitest';
import { NetworkErrorHandler } from '../services/NetworkErrorHandler';
import { NetworkError, NetworkErrorCode } from '../types';

// Mock fetch for testing
global.fetch = vi.fn();
const mockFetch = fetch as ReturnType<typeof vi.fn>;

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true
});

// Mock window event listeners
const mockAddEventListener = vi.fn();
const mockRemoveEventListener = vi.fn();
Object.defineProperty(window, 'addEventListener', { value: mockAddEventListener });
Object.defineProperty(window, 'removeEventListener', { value: mockRemoveEventListener });

describe('NetworkErrorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockClear();
    navigator.onLine = true;
  });

  describe('executeWithRetry', () => {
    it('executes request successfully on first attempt', async () => {
      const mockRequest = vi.fn().mockResolvedValue('success');

      const result = await NetworkErrorHandler.executeWithRetry(mockRequest);

      expect(result).toBe('success');
      expect(mockRequest).toHaveBeenCalledTimes(1);
    });

    it('retries on network errors', async () => {
      const networkError = new NetworkError(
        'Connection failed',
        NetworkErrorCode.CONNECTION_FAILED
      );
      
      const mockRequest = vi.fn()
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValue('success');

      const result = await NetworkErrorHandler.executeWithRetry(mockRequest, {
        retryConfig: { maxRetries: 2, baseDelay: 10 }
      });

      expect(result).toBe('success');
      expect(mockRequest).toHaveBeenCalledTimes(3);
    });

    it('fails after max retries', async () => {
      const networkError = new NetworkError(
        'Connection failed',
        NetworkErrorCode.CONNECTION_FAILED
      );
      
      const mockRequest = vi.fn().mockRejectedValue(networkError);

      await expect(
        NetworkErrorHandler.executeWithRetry(mockRequest, {
          retryConfig: { maxRetries: 2, baseDelay: 10 }
        })
      ).rejects.toThrow('Connection failed (failed after 3 attempts)');

      expect(mockRequest).toHaveBeenCalledTimes(3);
    });

    it('does not retry on non-retryable errors', async () => {
      const authError = new NetworkError(
        'Unauthorized',
        NetworkErrorCode.UNAUTHORIZED
      );
      
      const mockRequest = vi.fn().mockRejectedValue(authError);

      await expect(
        NetworkErrorHandler.executeWithRetry(mockRequest, {
          retryConfig: { maxRetries: 2, baseDelay: 10 }
        })
      ).rejects.toThrow('Unauthorized');

      expect(mockRequest).toHaveBeenCalledTimes(1);
    });

    it('respects timeout option', async () => {
      const mockRequest = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 200))
      );

      await expect(
        NetworkErrorHandler.executeWithRetry(mockRequest, {
          timeout: 100
        })
      ).rejects.toThrow('Request timed out after 100ms');
    });

    it('respects abort signal', async () => {
      const controller = new AbortController();
      const mockRequest = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 200))
      );

      // Abort after 50ms
      setTimeout(() => controller.abort(), 50);

      await expect(
        NetworkErrorHandler.executeWithRetry(mockRequest, {
          signal: controller.signal
        })
      ).rejects.toThrow('Request was aborted');
    });

    it('uses exponential backoff for retry delays', async () => {
      const networkError = new NetworkError(
        'Connection failed',
        NetworkErrorCode.CONNECTION_FAILED
      );
      
      const mockRequest = vi.fn()
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValue('success');

      const startTime = Date.now();
      
      await NetworkErrorHandler.executeWithRetry(mockRequest, {
        retryConfig: { 
          maxRetries: 2, 
          baseDelay: 100,
          backoffMultiplier: 2
        }
      });

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should take at least 100ms (first retry) + 200ms (second retry) = 300ms
      // Adding some buffer for execution time and jitter
      expect(totalTime).toBeGreaterThan(250);
    });

    it('handles custom retry conditions', async () => {
      const customError = new Error('Custom error');
      const mockRequest = vi.fn().mockRejectedValue(customError);

      await expect(
        NetworkErrorHandler.executeWithRetry(mockRequest, {
          retryConfig: {
            maxRetries: 2,
            baseDelay: 10,
            retryCondition: (error) => error.message === 'Custom error'
          }
        })
      ).rejects.toThrow('Custom error (failed after 3 attempts)');

      expect(mockRequest).toHaveBeenCalledTimes(3);
    });
  });

  describe('isOnline', () => {
    it('returns true when navigator.onLine is true', () => {
      navigator.onLine = true;
      expect(NetworkErrorHandler.isOnline()).toBe(true);
    });

    it('returns false when navigator.onLine is false', () => {
      navigator.onLine = false;
      expect(NetworkErrorHandler.isOnline()).toBe(false);
    });
  });

  describe('createErrorFromResponse', () => {
    it('creates server error for 5xx status codes', () => {
      const response = new Response(null, { 
        status: 500, 
        statusText: 'Internal Server Error' 
      });

      const error = NetworkErrorHandler.createErrorFromResponse(response);

      expect(error).toBeInstanceOf(NetworkError);
      expect(error.code).toBe(NetworkErrorCode.SERVER_ERROR);
      expect(error.message).toContain('Server error: 500');
      expect(error.statusCode).toBe(500);
    });

    it('creates unauthorized error for 401 status', () => {
      const response = new Response(null, { 
        status: 401, 
        statusText: 'Unauthorized' 
      });

      const error = NetworkErrorHandler.createErrorFromResponse(response);

      expect(error.code).toBe(NetworkErrorCode.UNAUTHORIZED);
      expect(error.message).toContain('Unauthorized');
    });

    it('creates rate limit error for 429 status', () => {
      const response = new Response(null, { 
        status: 429, 
        statusText: 'Too Many Requests' 
      });

      const error = NetworkErrorHandler.createErrorFromResponse(response);

      expect(error.code).toBe(NetworkErrorCode.RATE_LIMITED);
      expect(error.message).toContain('Rate limited');
    });

    it('creates generic connection error for other status codes', () => {
      const response = new Response(null, { 
        status: 404, 
        statusText: 'Not Found' 
      });

      const error = NetworkErrorHandler.createErrorFromResponse(response);

      expect(error.code).toBe(NetworkErrorCode.CONNECTION_FAILED);
      expect(error.message).toContain('HTTP error: 404');
    });
  });

  describe('createErrorFromFetchError', () => {
    it('creates abort error for AbortError', () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';

      const error = NetworkErrorHandler.createErrorFromFetchError(abortError);

      expect(error.code).toBe(NetworkErrorCode.CONNECTION_FAILED);
      expect(error.message).toContain('Request was aborted');
    });

    it('creates timeout error for timeout errors', () => {
      const timeoutError = new Error('Request timeout');

      const error = NetworkErrorHandler.createErrorFromFetchError(timeoutError);

      expect(error.code).toBe(NetworkErrorCode.TIMEOUT);
      expect(error.message).toContain('Request timed out');
    });

    it('creates generic network error for other errors', () => {
      const genericError = new Error('Network failure');

      const error = NetworkErrorHandler.createErrorFromFetchError(genericError);

      expect(error.code).toBe(NetworkErrorCode.CONNECTION_FAILED);
      expect(error.message).toContain('Network request failed');
    });
  });

  describe('setupConnectionMonitoring', () => {
    it('sets up online and offline event listeners', () => {
      const onOnline = vi.fn();
      const onOffline = vi.fn();

      const cleanup = NetworkErrorHandler.setupConnectionMonitoring(onOnline, onOffline);

      expect(mockAddEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(mockAddEventListener).toHaveBeenCalledWith('offline', expect.any(Function));

      // Test cleanup
      cleanup();
      expect(mockRemoveEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(mockRemoveEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    });

    it('calls callbacks when events are triggered', () => {
      const onOnline = vi.fn();
      const onOffline = vi.fn();

      NetworkErrorHandler.setupConnectionMonitoring(onOnline, onOffline);

      // Get the event handlers that were registered
      const onlineHandler = mockAddEventListener.mock.calls.find(
        call => call[0] === 'online'
      )?.[1];
      const offlineHandler = mockAddEventListener.mock.calls.find(
        call => call[0] === 'offline'
      )?.[1];

      // Simulate events
      onlineHandler?.();
      offlineHandler?.();

      expect(onOnline).toHaveBeenCalled();
      expect(onOffline).toHaveBeenCalled();
    });
  });

  describe('createAbortController', () => {
    it('creates abort controller without timeout', () => {
      const controller = NetworkErrorHandler.createAbortController();

      expect(controller).toBeInstanceOf(AbortController);
      expect(controller.signal.aborted).toBe(false);
    });

    it('creates abort controller with timeout', (done) => {
      const controller = NetworkErrorHandler.createAbortController(50);

      expect(controller.signal.aborted).toBe(false);

      setTimeout(() => {
        expect(controller.signal.aborted).toBe(true);
        done();
      }, 100);
    });
  });

  describe('Integration with real network scenarios', () => {
    it('handles fetch request with retry', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(new Response('success'));

      const result = await NetworkErrorHandler.executeWithRetry(
        () => fetch('/api/test').then(r => r.text()),
        { retryConfig: { maxRetries: 1, baseDelay: 10 } }
      );

      expect(result).toBe('success');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('handles fetch response errors', async () => {
      mockFetch.mockResolvedValue(new Response(null, { status: 500 }));

      const requestFn = async () => {
        const response = await fetch('/api/test');
        if (!response.ok) {
          throw NetworkErrorHandler.createErrorFromResponse(response);
        }
        return response.text();
      };

      await expect(
        NetworkErrorHandler.executeWithRetry(requestFn, {
          retryConfig: { maxRetries: 1, baseDelay: 10 }
        })
      ).rejects.toThrow('Server error: 500');

      expect(mockFetch).toHaveBeenCalledTimes(2); // Initial + 1 retry
    });
  });
});