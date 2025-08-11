/**
 * Deployment configuration for the chat interface
 */

export default {
  // Build settings
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false, // Disable source maps in production
    minify: true,
    target: 'es2020'
  },

  // Server settings for production
  server: {
    port: 3000,
    host: '0.0.0.0',
    cors: true,
    headers: {
      'Cache-Control': 'public, max-age=31536000', // 1 year cache for assets
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block'
    }
  },

  // Performance optimizations
  performance: {
    // Bundle size limits
    maxAssetSize: 500000, // 500KB
    maxEntrypointSize: 1000000, // 1MB
    
    // Compression
    gzip: true,
    brotli: true,
    
    // Caching strategy
    cacheStrategy: {
      // Cache static assets for 1 year
      assets: '1y',
      // Cache HTML for 1 hour
      html: '1h',
      // Cache API responses for 5 minutes
      api: '5m'
    }
  },

  // Environment-specific settings
  environments: {
    development: {
      sourcemap: true,
      minify: false,
      performance: {
        maxAssetSize: 2000000, // 2MB in dev
        maxEntrypointSize: 4000000 // 4MB in dev
      }
    },
    
    staging: {
      sourcemap: true,
      minify: true,
      performance: {
        maxAssetSize: 750000, // 750KB in staging
        maxEntrypointSize: 1500000 // 1.5MB in staging
      }
    },
    
    production: {
      sourcemap: false,
      minify: true,
      performance: {
        maxAssetSize: 500000, // 500KB in production
        maxEntrypointSize: 1000000 // 1MB in production
      }
    }
  },

  // CDN settings
  cdn: {
    enabled: false, // Set to true when using a CDN
    baseUrl: '', // CDN base URL
    assets: ['js', 'css', 'images', 'fonts']
  },

  // Analytics and monitoring
  monitoring: {
    // Performance monitoring
    webVitals: true,
    errorTracking: true,
    
    // Bundle analysis
    bundleAnalyzer: {
      enabled: process.env.ANALYZE === 'true',
      openAnalyzer: false,
      generateStatsFile: true
    }
  }
};