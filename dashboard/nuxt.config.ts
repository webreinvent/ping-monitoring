// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  // Persistent node-server runtime (not serverless)
  nitro: {
    preset: 'node-server',
    // CORS for API routes
    routeRules: {
      '/api/**': { cors: true },
    },
  },

  // TypeScript strict mode
  typescript: {
    strict: true,
  },

  // Import shared types
  imports: {
    dirs: ['shared'],
  },

  // CSS / module configuration
  css: [],

  // Dev server on port 3000
  devServer: {
    port: 3000,
  },

  // SSR enabled (required for server routes)
  ssr: true,

  // CORS for API routes
  routeRules: {
    '/api/**': { cors: true },
  },
});
