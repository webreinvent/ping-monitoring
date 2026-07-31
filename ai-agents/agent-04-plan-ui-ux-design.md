---
title: LNPM - Plan UI/UX Design
---

# Plan UI/UX Design

## Purpose

MANDATORY — DO NOT SKIP. Plan the UI/UX design before writing any UI code for the LNPM Cloud Dashboard. Install and invoke all design skills. This agent is a PLANNING step — it produces a UI/UX plan that Agent 05 consumes when creating the implementation plan.

## Scope Boundaries

**This agent MUST:**
- Install and invoke all design skills
- Analyze the current design system and UI patterns from the LNPM desktop app
- Plan component hierarchy, state management, and styling approach for the Nuxt 4 + Vue 3 dashboard
- Produce a UI/UX plan document

**This agent MUST NOT:**
- Write, modify, or delete any project source files
- Implement any UI components
- Write CSS or styling code
- Create implementation plans (that is Agent 05's job)
- Run the application or dev server

## Variables

- **`{{SKILLS_REGISTRY}}`** _(static)_ — `https://skills.sh/`
- **`{{PROJECT_ROOT}}`** _(static)_ — `/Users/pk/Projects/ping-monitoring`

## MCP Servers

| Server | Purpose | Install / Configure | When to Use |
|--------|---------|-------------------|-------------|
| `playwright` | Browser automation | Configure Playwright MCP | Screenshot current UI state for reference |
| `git` | Version control | No install needed | Review existing code |
| `memory` | Cross-session persistence | No install needed | Share data between agents |
| `filesystem` | File and directory operations | No install needed | Read existing UI files |
| `sequential-thinking` | Structured problem decomposition | No install needed | Complex decisions |

## Skills

| Skill | Install Command | When to Invoke |
|-------|----------------|----------------|
| `ui-ux-pro-max` | `npx skills add xxsluna/ui-ux-pro-max` | Design intelligence (color, typography, layout, UX) |
| `tailwind-best-practices` | Already available in session | Tailwind CSS patterns (if Tailwind is used) |
| `primevue` | Already available in session | PrimeVue component patterns (if PrimeVue is used) |

**Skill Installation Protocol:** Before invoking any skill, check if installed. IF not installed, run `npx skills add <owner/repo>`. Wait for installation. THEN invoke the skill.

**MANDATORY:** Invoke ALL skills listed above. Do not skip any.

## Workflow

**Step 1: Install & Invoke Design Skills**

For each skill: check if installed, install if needed, invoke and capture findings.

**Step 2: Analyze Current Design**

Analyze the LNPM desktop app's existing design:
- Read `src/styles.css` — CSS custom properties, design tokens, color palette
- Read `src/main.ts` — UI structure, layout patterns, component organization
- Review `docs/assets/lnpm-dashboard.png` — visual reference for dashboard design
- The desktop app uses vanilla CSS with custom properties (no CSS framework)
- Identify existing components that can be conceptually reused in the Vue 3 dashboard

**Step 3: Capture Current UI State**

**Invoke `playwright` MCP server** (optional): Take a screenshot of the current UI state for reference.

**Step 4: Plan UI Implementation**

Plan the Nuxt 4 + Vue 3 dashboard UI:
- **Component hierarchy:** Layout shell → Sidebar (client groups, monitor list) → Dashboard panel (chart, metrics) → Modals (settings, target dialog)
- **State management:** Vue 3 composables (`useMonitors`, `useWebSocket`, `useChart`) with reactive state. No Pinia unless complexity demands it.
- **Styling strategy:** Mirror desktop CSS custom properties. Use scoped `<style>` in Vue components. Consider whether to adopt Tailwind or continue with vanilla CSS custom properties.
- **Chart integration:** uPlot in Vue 3 via `onMounted`/`onUnmounted` lifecycle. Canvas-based rendering.
- **Accessibility:** Semantic HTML, ARIA labels, keyboard navigation (already established in desktop app)
- **Responsive design:** Desktop-first (monitoring tool), but functional on tablets
- **i18n:** Mirror 5-locales approach (en, ko, ja, zh-CN, zh-TW) using Nuxt's i18n module or lightweight alternative

## Output

```
UI/UX Plan
  Design system: [CSS custom properties from desktop, adapted for Vue 3]
  Components to create: [list with description]
  Components to reuse: [list with paths from desktop app]
  State management: [Vue 3 composables approach]
  Styling strategy: [CSS custom properties / Tailwind decision]
  Chart approach: [uPlot in Vue 3 lifecycle]
  Accessibility: [considerations]
  Responsive design: [desktop-first approach]
  i18n: [5-locales strategy]
  Current UI state: [screenshot reference or description]
  Next agent: Agent 05 (Create Implementation Plan)
```

## Gate

- [ ] All design skills installed and invoked
- [ ] Current design analyzed
- [ ] Reusable components identified
- [ ] UI implementation plan documented
