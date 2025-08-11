import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Enable code splitting and chunk optimization
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching
        manualChunks: {
          // Vendor chunks
          'react-vendor': ['react', 'react-dom'],
          'langchain-vendor': [
            'langchain',
            '@langchain/openai',
            '@langchain/anthropic',
            '@langchain/community'
          ],
          
          // Feature-based chunks
          'audio-features': [
            './src/services/AudioController.ts',
            './src/services/LazyAudioController.ts',
            './src/components/AudioControls.tsx',
            './src/components/RecordButton.tsx'
          ],
          'langchain-features': [
            './src/services/LangChainService.ts',
            './src/services/LazyLangChainService.ts'
          ],
          'ui-components': [
            './src/components/MessageList.tsx',
            './src/components/VirtualizedMessageList.tsx',
            './src/components/MessageItem.tsx',
            './src/components/InputArea.tsx'
          ],
          'settings-features': [
            './src/components/SettingsPanel.tsx',
            './src/components/SettingsButton.tsx'
          ]
        },
        // Optimize chunk file names
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId
            ? chunkInfo.facadeModuleId.split('/').pop()?.replace('.tsx', '').replace('.ts', '')
            : 'chunk';
          return `js/${facadeModuleId}-[hash].js`;
        },
        entryFileNames: 'js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name?.split('.') || [];
          const ext = info[info.length - 1];
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext || '')) {
            return `images/[name]-[hash][extname]`;
          }
          if (/css/i.test(ext || '')) {
            return `css/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        }
      }
    },
    // Optimize bundle size
    target: 'es2020',
    minify: 'terser',
    // Set chunk size warning limit
    chunkSizeWarningLimit: 1000,
    // Enable source maps for debugging
    sourcemap: process.env.NODE_ENV === 'development'
  },
  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react/jsx-runtime'
    ],
    exclude: [
      // Exclude heavy dependencies from pre-bundling to enable lazy loading
      'langchain',
      '@langchain/openai',
      '@langchain/anthropic',
      '@langchain/community'
    ]
  },
  // Performance optimizations
  server: {
    // Optimize HMR
    hmr: {
      overlay: true
    }
  },
  // CSS optimization
  css: {
    devSourcemap: process.env.NODE_ENV === 'development',
    preprocessorOptions: {
      // Add any CSS preprocessor options here
    }
  },
  // Define environment variables for optimization
  define: {
    __DEV__: process.env.NODE_ENV === 'development',
    __PROD__: process.env.NODE_ENV === 'production'
  }
})
