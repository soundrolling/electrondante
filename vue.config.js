const { defineConfig } = require('@vue/cli-service')

module.exports = defineConfig({
  transpileDependencies: true,
  configureWebpack: {
    resolve: {
      // Remove the Vue compatibility alias for proper Vue 3 support
    }
  },
  chainWebpack: config => {
    config.plugin('define').tap(args => {
      args[0]['__VUE_PROD_HYDRATION_MISMATCH_DETAILS__'] = false
      
      // Ensure environment variables are properly injected
      if (process.env.VUE_APP_SUPABASE_URL) {
        args[0]['process.env.VUE_APP_SUPABASE_URL'] = JSON.stringify(process.env.VUE_APP_SUPABASE_URL)
      }
      if (process.env.VUE_APP_SUPABASE_ANON_KEY) {
        args[0]['process.env.VUE_APP_SUPABASE_ANON_KEY'] = JSON.stringify(process.env.VUE_APP_SUPABASE_ANON_KEY)
      }
      if (process.env.VUE_APP_SUPABASE_SERVICE_ROLE_KEY) {
        args[0]['process.env.VUE_APP_SUPABASE_SERVICE_ROLE_KEY'] = JSON.stringify(process.env.VUE_APP_SUPABASE_SERVICE_ROLE_KEY)
      }
      if (process.env.VUE_APP_BRIDGE_WS_URL) {
        args[0]['process.env.VUE_APP_BRIDGE_WS_URL'] = JSON.stringify(process.env.VUE_APP_BRIDGE_WS_URL)
      }
      
      return args
    })
  }
})
