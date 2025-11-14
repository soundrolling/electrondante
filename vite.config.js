import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig(({ mode }) => {
  // Load environment variables with both VITE_* and VUE_APP_* prefixes
  const env = loadEnv(mode, process.cwd(), '')
  
  // Helper to get env var with fallback
  const getEnv = (viteKey, vueKey) => {
    return env[viteKey] || env[vueKey] || ''
  }
  
  return {
    plugins: [
      vue(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'service-worker.js',
        injectManifest: {
          injectionPoint: undefined
        },
        injectRegister: null,  // you'll register it manually
        manifest: {
          name: 'Spatial HQ',
          short_name: 'Spatial',
          description: 'Spatial production manager and notes',
          theme_color: '#0ea5e9',
          background_color: '#ffffff',
          display: 'standalone',
          icons: [
            {
              src: '/img/icon-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: '/img/icon-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    },
    define: {
      // Expose VUE_APP_* variables through import.meta.env for compatibility
      'import.meta.env.VUE_APP_SUPABASE_URL': JSON.stringify(getEnv('VITE_SUPABASE_URL', 'VUE_APP_SUPABASE_URL')),
      'import.meta.env.VUE_APP_SUPABASE_ANON_KEY': JSON.stringify(getEnv('VITE_SUPABASE_ANON_KEY', 'VUE_APP_SUPABASE_ANON_KEY')),
      'import.meta.env.VUE_APP_SUPABASE_SERVICE_ROLE_KEY': JSON.stringify(getEnv('VITE_SUPABASE_SERVICE_ROLE_KEY', 'VUE_APP_SUPABASE_SERVICE_ROLE_KEY')),
      'import.meta.env.VUE_APP_BRIDGE_WS_URL': JSON.stringify(getEnv('VITE_BRIDGE_WS_URL', 'VUE_APP_BRIDGE_WS_URL')),
      'import.meta.env.VUE_APP_ENCRYPTION_KEY': JSON.stringify(getEnv('VITE_ENCRYPTION_KEY', 'VUE_APP_ENCRYPTION_KEY')),
      'import.meta.env.VUE_APP_WEATHERAPI_KEY': JSON.stringify(getEnv('VITE_WEATHERAPI_KEY', 'VUE_APP_WEATHERAPI_KEY')),
      // Also support process.env for legacy code
      'process.env.VUE_APP_SUPABASE_URL': JSON.stringify(getEnv('VITE_SUPABASE_URL', 'VUE_APP_SUPABASE_URL')),
      'process.env.VUE_APP_SUPABASE_ANON_KEY': JSON.stringify(getEnv('VITE_SUPABASE_ANON_KEY', 'VUE_APP_SUPABASE_ANON_KEY')),
      'process.env.VUE_APP_SUPABASE_SERVICE_ROLE_KEY': JSON.stringify(getEnv('VITE_SUPABASE_SERVICE_ROLE_KEY', 'VUE_APP_SUPABASE_SERVICE_ROLE_KEY')),
      'process.env.VUE_APP_BRIDGE_WS_URL': JSON.stringify(getEnv('VITE_BRIDGE_WS_URL', 'VUE_APP_BRIDGE_WS_URL')),
      'process.env.VUE_APP_ENCRYPTION_KEY': JSON.stringify(getEnv('VITE_ENCRYPTION_KEY', 'VUE_APP_ENCRYPTION_KEY')),
      'process.env.VUE_APP_WEATHERAPI_KEY': JSON.stringify(getEnv('VITE_WEATHERAPI_KEY', 'VUE_APP_WEATHERAPI_KEY')),
      '__VUE_PROD_HYDRATION_MISMATCH_DETAILS__': false
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false,
      rollupOptions: {
        output: {
          assetFileNames: (assetInfo) => {
            if (assetInfo.name === 'service-worker.js') {
              return 'service-worker.js'
            }
            return 'assets/[name]-[hash][extname]'
          },
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js'
        }
      }
    },
    server: {
      port: 8080,
      open: true
    }
  }
})
