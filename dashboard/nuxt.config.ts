// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  // Nuxt 4 compatibility date
  compatibilityDate: "2026-08-01",

  // Persistent node-server runtime (not serverless)
  nitro: {
    preset: "node-server",
    experimental: {
      websocket: true,
    },
  },

  // TypeScript strict mode
  typescript: {
    strict: true,
  },

  // Dev server on port 3000
  devServer: {
    port: 3000,
  },

  // SSR enabled (required for server routes)
  ssr: true,

  // CORS for API routes
  routeRules: {
    "/api/**": { cors: true },
  },
});
