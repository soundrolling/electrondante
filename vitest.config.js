import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.js'

// Vitest extends the existing vite config so path aliases (`@/...`) and
// the `vue` plugin work in tests. We pass a stub `mode` since vite.config
// is a factory that reads env via `loadEnv`.
const baseViteConfig =
  typeof viteConfig === 'function' ? viteConfig({ mode: 'test', command: 'serve' }) : viteConfig

export default mergeConfig(
  baseViteConfig,
  defineConfig({
    test: {
      environment: 'happy-dom',
      globals: true,
      include: ['src/**/*.{test,spec}.js'],
      exclude: [
        'node_modules/**',
        'dist/**',
        // Pre-existing Jest-syntax spec; out of scope for this PR.
        'src/services/__tests__/**',
      ],
      // Don't pull bridge-server or supabase tests in
      passWithNoTests: false,
    },
  })
)
