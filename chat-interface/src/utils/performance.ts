/**
 * Performance monitoring utilities for the chat interface
 */

interface PerformanceMetrics {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetrics> = new Map();
  private observers: PerformanceObserver[] = [];

  constructor() {
    this.setupObservers();
  }

  /**
   * Start measuring performance for a specific operation
   */
  start(name: string, metadata?: Record<string, any>): void {
    const startTime = performance.now();
    this.metrics.set(name, {
      name,
      startTime,
      metadata
    });

    // Use Performance API mark if available
    if (typeof performance.mark === 'function') {
      performance.mark(`${name}-start`);
    }
  }

  /**
   * End measuring performance for a specific operation
   */
  end(name: string): number | null {
    const metric = this.metrics.get(name);
    if (!metric) {
      console.warn(`Performance metric "${name}" not found`);
      return null;
    }

    const endTime = performance.now();
    const duration = endTime - metric.startTime;

    // Update metric
    metric.endTime = endTime;
    metric.duration = duration;

    // Use Performance API mark and measure if available
    if (typeof performance.mark === 'function' && typeof performance.measure === 'function') {
      performance.mark(`${name}-end`);
      performance.measure(name, `${name}-start`, `${name}-end`);
    }

    // Log in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`⏱️ ${name}: ${duration.toFixed(2)}ms`, metric.metadata);
    }

    return duration;
  }

  /**
   * Get performance metric
   */
  getMetric(name: string): PerformanceMetrics | null {
    return this.metrics.get(name) || null;
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): PerformanceMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
    
    // Clear Performance API entries
    if (typeof performance.clearMarks === 'function') {
      performance.clearMarks();
    }
    if (typeof performance.clearMeasures === 'function') {
      performance.clearMeasures();
    }
  }

  /**
   * Setup performance observers
   */
  private setupObservers(): void {
    if (typeof PerformanceObserver === 'undefined') {
      return;
    }

    try {
      // Observe navigation timing
      const navObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.entryType === 'navigation') {
            const navEntry = entry as PerformanceNavigationTiming;
            this.logNavigationTiming(navEntry);
          }
        });
      });
      navObserver.observe({ entryTypes: ['navigation'] });
      this.observers.push(navObserver);

      // Observe resource timing
      const resourceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.entryType === 'resource') {
            this.logResourceTiming(entry as PerformanceResourceTiming);
          }
        });
      });
      resourceObserver.observe({ entryTypes: ['resource'] });
      this.observers.push(resourceObserver);

      // Observe paint timing
      const paintObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.entryType === 'paint') {
            this.logPaintTiming(entry as PerformancePaintTiming);
          }
        });
      });
      paintObserver.observe({ entryTypes: ['paint'] });
      this.observers.push(paintObserver);

    } catch (error) {
      console.warn('Failed to setup performance observers:', error);
    }
  }

  /**
   * Log navigation timing
   */
  private logNavigationTiming(entry: PerformanceNavigationTiming): void {
    if (process.env.NODE_ENV === 'development') {
      console.log('🚀 Navigation Timing:', {
        domContentLoaded: entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart,
        loadComplete: entry.loadEventEnd - entry.loadEventStart,
        domInteractive: entry.domInteractive - entry.navigationStart,
        firstByte: entry.responseStart - entry.requestStart,
        dns: entry.domainLookupEnd - entry.domainLookupStart,
        tcp: entry.connectEnd - entry.connectStart,
        request: entry.responseEnd - entry.requestStart
      });
    }
  }

  /**
   * Log resource timing
   */
  private logResourceTiming(entry: PerformanceResourceTiming): void {
    // Only log slow resources in development
    if (process.env.NODE_ENV === 'development' && entry.duration > 100) {
      console.log(`📦 Slow Resource (${entry.duration.toFixed(2)}ms):`, {
        name: entry.name,
        type: this.getResourceType(entry.name),
        size: entry.transferSize,
        cached: entry.transferSize === 0
      });
    }
  }

  /**
   * Log paint timing
   */
  private logPaintTiming(entry: PerformancePaintTiming): void {
    if (process.env.NODE_ENV === 'development') {
      console.log(`🎨 ${entry.name}: ${entry.startTime.toFixed(2)}ms`);
    }
  }

  /**
   * Get resource type from URL
   */
  private getResourceType(url: string): string {
    if (url.includes('.js')) return 'script';
    if (url.includes('.css')) return 'stylesheet';
    if (url.match(/\.(png|jpg|jpeg|gif|svg|webp)$/)) return 'image';
    if (url.includes('.woff') || url.includes('.ttf')) return 'font';
    return 'other';
  }

  /**
   * Cleanup observers
   */
  dispose(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.clear();
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Decorator for measuring function performance
 */
export function measurePerformance(name?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const metricName = name || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      performanceMonitor.start(metricName);
      try {
        const result = await originalMethod.apply(this, args);
        return result;
      } finally {
        performanceMonitor.end(metricName);
      }
    };

    return descriptor;
  };
}

import React from 'react';

/**
 * Hook for measuring React component render performance
 */
export function useMeasureRender(componentName: string) {
  React.useEffect(() => {
    performanceMonitor.start(`${componentName}-render`);
    return () => {
      performanceMonitor.end(`${componentName}-render`);
    };
  });
}

/**
 * Measure memory usage
 */
export function measureMemoryUsage(): {
  used: number;
  total: number;
  percentage: number;
} | null {
  if ('memory' in performance && (performance as any).memory) {
    const memory = (performance as any).memory;
    return {
      used: memory.usedJSHeapSize,
      total: memory.totalJSHeapSize,
      percentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100
    };
  }
  return null;
}

/**
 * Monitor long tasks (tasks that block the main thread for >50ms)
 */
export function monitorLongTasks(): void {
  if (typeof PerformanceObserver === 'undefined') {
    return;
  }

  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (entry.entryType === 'longtask') {
          console.warn(`🐌 Long Task detected: ${entry.duration.toFixed(2)}ms`, entry);
        }
      });
    });
    observer.observe({ entryTypes: ['longtask'] });
  } catch (error) {
    console.warn('Long task monitoring not supported:', error);
  }
}

/**
 * Get Core Web Vitals
 */
export function getCoreWebVitals(): Promise<{
  fcp?: number;
  lcp?: number;
  fid?: number;
  cls?: number;
}> {
  return new Promise((resolve) => {
    const vitals: any = {};
    let resolveTimeout: NodeJS.Timeout;

    // Set timeout to resolve after 5 seconds
    resolveTimeout = setTimeout(() => resolve(vitals), 5000);

    if (typeof PerformanceObserver === 'undefined') {
      resolve(vitals);
      return;
    }

    try {
      // First Contentful Paint
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.name === 'first-contentful-paint') {
            vitals.fcp = entry.startTime;
          }
        });
      }).observe({ entryTypes: ['paint'] });

      // Largest Contentful Paint
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        vitals.lcp = lastEntry.startTime;
      }).observe({ entryTypes: ['largest-contentful-paint'] });

      // First Input Delay
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          vitals.fid = entry.processingStart - entry.startTime;
        });
      }).observe({ entryTypes: ['first-input'] });

      // Cumulative Layout Shift
      let clsValue = 0;
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
            vitals.cls = clsValue;
          }
        });
      }).observe({ entryTypes: ['layout-shift'] });

    } catch (error) {
      console.warn('Core Web Vitals monitoring failed:', error);
      clearTimeout(resolveTimeout);
      resolve(vitals);
    }
  });
}

/**
 * Bundle size analyzer (development only)
 */
export function analyzeBundleSize(): void {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  // This would integrate with webpack-bundle-analyzer or similar
  console.log('📊 Bundle analysis available in build:analyze script');
}