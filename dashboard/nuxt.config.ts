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

  // Global CSS
  css: ["~/assets/css/dashboard.css", "~/assets/css/charts.css"],

  // App head defaults
  app: {
    head: {
      title: "LNPM Cloud Dashboard",
      meta: [
        { name: "viewport", content: "width=device-width, initial-scale=1" },
      ],
      link: [
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;650;700&display=swap",
        },
      ],
    },
  },
});
