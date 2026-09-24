# LNPM Skill Usage by Step

| Skill | Steps | Purpose |
|---|---|---|
| **brainstorming** | 3, 6 | Refine task scope (Step 3); plan UI/UX approach with trade-off analysis (Step 6) |
| **nuxt4-patterns** | 4, 9 | Nuxt 4 specific patterns (composables, server routes, Nitro plugins, WebSocket) during research and implementation |
| **playwright-cli** | 11, 13 | Write and run Playwright E2E tests (Steps 11, 13) |
| **agent-browser** | 11 | Browser automation for UAT (alternative to playwright MCP) |
| **dataviz** | 6, 9 | Chart design guidance for uPlot charts (quality bands, threshold lines, color palettes) |
| **security-best-practices** | 10 | Security audit during code quality step (SQL injection, XSS, rate limiting, env var exposure) |
| **memory-leak-audit** | 10 | Audit for memory leaks (WS subscriptions, rAF loops, event listeners) |
| **gitnexus-exploring** | 5 | Code graph exploration to understand related code (Step 5) |
| **gitnexus-debugging** | 10, 11 | Trace execution flows to find root causes of test failures or UAT bugs |
| **gitnexus-refactoring** | 9, 10 | Safe refactoring with blast-radius analysis (Steps 9, 10) |
| **ui-ux-pro-max** | 6 | UI/UX design system reference (if a project-local skill with this name exists) |
| **vue-best-practices** | 6, 9 | Vue 3 Composition API patterns for component implementation |

## Notes

- **brainstorming** is most valuable in Step 6 (UI/UX planning) — use it to explore 2–3 layout/component approaches before committing to one.
- **nuxt4-patterns** should be consulted before writing any new composable, server route, or Nitro plugin — it captures the project's established Nuxt 4 idioms.
- **playwright-cli** is the primary skill for Step 13 (E2E test writing) — use it to generate test scaffolding and to run the suite.
- **dataviz** is relevant for M3-T1 (matching Tauri chart with dashboard) — use it to compare chart design approaches.
- Skills are invoked via the `Skill` tool. Only invoke a skill if it is listed in the available-skills reminder for the current session.
- Do NOT invoke implementation skills (nuxt4-patterns, playwright-cli, etc.) before Step 7 (implementation plan is approved) — the brainstorming HARD-GATE applies.
