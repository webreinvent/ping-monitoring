---
name: agent-03-code-analysis
description: Code analysis results from Agent 03 — patterns, reusable code, conventions for LNPM dashboard
metadata:
  type: project
---

Agent 03 code analysis complete. Key findings stored in `ai-milestones-and-tasks/code-analysis-agent-03.md`.

**Key patterns identified:**
- Strict TypeScript: `strict: true`, no `any`, explicit return types, `readonly` modifiers
- Naming: camelCase functions, PascalCase types, kebab-case files
- Error handling: `normalizeError()` → `UserErrorPayload { code, detail }` → localized message
- Test patterns: Vitest co-located `*.test.ts`, Playwright `*.spec.ts`, factory fixtures
- Chart: uPlot with palette `["#5eead4", "#60a5fa", "#c084fc", "#f472b6", "#facc15"]`, quality thresholds at 50/100/200ms
- State machine: discriminated union events + reducer function pattern from `update-state.ts`
- i18n: 5 locales, catalog-based `t()` with param interpolation

**Reusable from desktop:** `src/types.ts` (types), `src/chart.ts` (uPlot patterns), `src/dashboard-selection.ts` (aggregation), `src/i18n.ts` (formatters), `src/update-state.ts` (state machine pattern)

**Type divergence:** Desktop `PingSample` vs dashboard `PingSample` have different shapes. Dashboard must transform cloud data into desktop `HistoryResponse` format for chart compatibility.

See [[agent-07-m1-t1]] for M1-T1 context and [[ui-ux-design-decisions]] for UI approach.
