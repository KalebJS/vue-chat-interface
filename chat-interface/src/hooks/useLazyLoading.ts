import { useState, useCallback, useRef } from 'react';

interface LazyLoadState<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  isLoaded: boolean;
}

interface LazyLoadOptions {
  retryCount?: number;
  retryDelay?: number;
  timeout?: number;
}

/**
 * Hook for lazy loading resources with error handling and retry logic
 */
export function useLazyLoading<T>(
  loader: () => Promise<T>,
  options: LazyLoadOptions = {}
): [LazyLoadState<T>, () => Promise<void>, () => void] {
  const { retryCount = 3, retryDelay = 1000, timeout = 10000 } = options;
  
  const [state, setState] = useState<LazyLoadState<T>>({
    data: null,
    isLoading: false,
    error: null,
    isLoaded: false
  });

  const retryCountRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const load = useCallback(async (): Promise<void> => {
    // Don't load if already loaded or currently loading
    if (state.isLoaded || state.isLoading) {
      return;
    }

    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null
    }));

    try {
      // Set up timeout
      const timeoutId = setTimeout(() => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      }, timeout);

      // Load the resource
      const data = await loader();

      // Clear timeout
      clearTimeout(timeoutId);

      // Check if request was aborted
      if (signal.aborted) {
        return;
      }

      setState({
        data,
        isLoading: false,
        error: null,
        isLoaded: true
      });

      // Reset retry count on success
      retryCountRef.current = 0;

    } catch (error) {
      // Check if request was aborted
      if (signal.aborted) {
        return;
      }

      const currentError = error instanceof Error ? error : new Error('Unknown error');

      // Retry logic
      if (retryCountRef.current < retryCount) {
        retryCountRef.current++;
        
        // Wait before retrying
        setTimeout(() => {
          if (!signal.aborted) {
            load();
          }
        }, retryDelay * retryCountRef.current);
        
        return;
      }

      // Max retries reached
      setState({
        data: null,
        isLoading: false,
        error: currentError,
        isLoaded: false
      });
    }
  }, [loader, retryCount, retryDelay, timeout, state.isLoaded, state.isLoading]);

  const reset = useCallback(() => {
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Reset state
    setState({
      data: null,
      isLoading: false,
      error: null,
      isLoaded: false
    });

    // Reset retry count
    retryCountRef.current = 0;
  }, []);

  return [state, load, reset];
}

/**
 * Hook for lazy loading multiple resources
 */
export function useLazyLoadingMultiple<T extends Record<string, any>>(
  loaders: { [K in keyof T]: () => Promise<T[K]> },
  options: LazyLoadOptions = {}
): [
  { [K in keyof T]: LazyLoadState<T[K]> },
  (keys?: (keyof T)[]) => Promise<void>,
  (keys?: (keyof T)[]) => void
] {
  const [states, setStates] = useState<{ [K in keyof T]: LazyLoadState<T[K]> }>(() => {
    const initialStates = {} as { [K in keyof T]: LazyLoadState<T[K]> };
    for (const key in loaders) {
      initialStates[key] = {
        data: null,
        isLoading: false,
        error: null,
        isLoaded: false
      };
    }
    return initialStates;
  });

  const abortControllersRef = useRef<{ [K in keyof T]?: AbortController }>({});
  const retryCountsRef = useRef<{ [K in keyof T]?: number }>({});

  const loadMultiple = useCallback(async (keys?: (keyof T)[]): Promise<void> => {
    const keysToLoad = keys || Object.keys(loaders) as (keyof T)[];
    
    const loadPromises = keysToLoad.map(async (key) => {
      const loader = loaders[key];
      const currentState = states[key];

      // Don't load if already loaded or currently loading
      if (currentState.isLoaded || currentState.isLoading) {
        return;
      }

      // Cancel any existing request for this key
      if (abortControllersRef.current[key]) {
        abortControllersRef.current[key]!.abort();
      }

      // Create new abort controller
      abortControllersRef.current[key] = new AbortController();
      const signal = abortControllersRef.current[key]!.signal;

      // Update state to loading
      setStates(prev => ({
        ...prev,
        [key]: {
          ...prev[key],
          isLoading: true,
          error: null
        }
      }));

      try {
        // Set up timeout
        const timeoutId = setTimeout(() => {
          if (abortControllersRef.current[key]) {
            abortControllersRef.current[key]!.abort();
          }
        }, options.timeout || 10000);

        // Load the resource
        const data = await loader();

        // Clear timeout
        clearTimeout(timeoutId);

        // Check if request was aborted
        if (signal.aborted) {
          return;
        }

        // Update state with loaded data
        setStates(prev => ({
          ...prev,
          [key]: {
            data,
            isLoading: false,
            error: null,
            isLoaded: true
          }
        }));

        // Reset retry count on success
        retryCountsRef.current[key] = 0;

      } catch (error) {
        // Check if request was aborted
        if (signal.aborted) {
          return;
        }

        const currentError = error instanceof Error ? error : new Error('Unknown error');
        const currentRetryCount = retryCountsRef.current[key] || 0;
        const maxRetries = options.retryCount || 3;

        // Retry logic
        if (currentRetryCount < maxRetries) {
          retryCountsRef.current[key] = currentRetryCount + 1;
          
          // Wait before retrying
          setTimeout(() => {
            if (!signal.aborted) {
              loadMultiple([key]);
            }
          }, (options.retryDelay || 1000) * (currentRetryCount + 1));
          
          return;
        }

        // Max retries reached
        setStates(prev => ({
          ...prev,
          [key]: {
            data: null,
            isLoading: false,
            error: currentError,
            isLoaded: false
          }
        }));
      }
    });

    await Promise.allSettled(loadPromises);
  }, [loaders, states, options]);

  const resetMultiple = useCallback((keys?: (keyof T)[]) => {
    const keysToReset = keys || Object.keys(loaders) as (keyof T)[];
    
    // Cancel any ongoing requests
    keysToReset.forEach(key => {
      if (abortControllersRef.current[key]) {
        abortControllersRef.current[key]!.abort();
        delete abortControllersRef.current[key];
      }
      delete retryCountsRef.current[key];
    });

    // Reset states
    setStates(prev => {
      const newStates = { ...prev };
      keysToReset.forEach(key => {
        newStates[key] = {
          data: null,
          isLoading: false,
          error: null,
          isLoaded: false
        };
      });
      return newStates;
    });
  }, [loaders]);

  return [states, loadMultiple, resetMultiple];
}

/**
 * Hook for lazy loading with intersection observer (load when element becomes visible)
 */
export function useLazyLoadingWithIntersection<T>(
  loader: () => Promise<T>,
  options: LazyLoadOptions & {
    rootMargin?: string;
    threshold?: number;
  } = {}
): [LazyLoadState<T>, (element: Element | null) => void, () => void] {
  const [lazyState, load, reset] = useLazyLoading(loader, options);
  const [targetElement, setTargetElement] = useState<Element | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const setTarget = useCallback((element: Element | null) => {
    // Disconnect previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    setTargetElement(element);

    if (element && !lazyState.isLoaded && !lazyState.isLoading) {
      // Create intersection observer
      observerRef.current = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (entry.isIntersecting) {
            load();
            // Disconnect after loading starts
            if (observerRef.current) {
              observerRef.current.disconnect();
            }
          }
        },
        {
          rootMargin: options.rootMargin || '50px',
          threshold: options.threshold || 0.1
        }
      );

      observerRef.current.observe(element);
    }
  }, [load, lazyState.isLoaded, lazyState.isLoading, options.rootMargin, options.threshold]);

  // Cleanup observer on unmount
  React.useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  return [lazyState, setTarget, reset];
}