---
name: agent-prompts-generated
description: 16 AI agent pipeline files generated in ai-agents/ for LNPM Cloud Dashboard
metadata:
  type: project
---

## Agent Prompts Generated

16 independent agent system prompts created in `ai-agents/` for the LNPM Cloud Dashboard project.

### Pipeline

| # | Agent | Purpose |
|---|-------|---------|
| 00 | Load Session Context | Prime context from memory and docs |
| 01 | Create Feature Branch | GitFlow branch from `develop` |
| 02 | Understand Task Scope | Read-only task analysis |
| 03 | Analyze Related Code | Read-only code pattern analysis |
| 04 | Plan UI/UX Design | UI planning with design skills |
| 05 | Create Implementation Plan | Ordered plan with brainstorming |
| 06 | Audit & Present Plan | Principles audit, user approval gate |
| 07 | Implement the Task | Code execution (only code-writing agent) |
| 08 | Code Review | Quality review, fix issues |
| 09 | Automated UAT & Bug Fixes | Browser automation verification |
| 10 | Write Unit Tests | Vitest tests (set up infra if needed) |
| 11 | Write E2E Tests | Playwright tests (set up infra if needed) |
| 12 | Update AI Memory | Persist session knowledge |
| 13 | Update Tracking & Docs | Milestone tracking, technical docs |
| 14 | Update Project Context | AI context file updates |
| 15 | Finalize & Commit | Task completion, git commit |

### Tech Stack (embedded in agents)

- Nuxt 4 + Nitro v2 (persistent node-server)
- TypeScript ~5.6.2, Vue 3
- better-sqlite3 with WAL mode
- uPlot ^1.6.32
- Vitest ^4.1.10
- Tauri ^2 (desktop app)
- pnpm 11.9.0

### MCP Servers Mapped

- Universal: `git`, `memory`, `filesystem`, `sequential-thinking`
- Project-specific: `playwright`, `nuxt`

### Skills Mapped

- `nuxt` — Nuxt 4 patterns
- `brainstorming` — implementation planning
- `ui-ux-pro-max` — design intelligence
- `tailwind-best-practices` — CSS patterns
- `primevue` — component patterns
- `playwright` — E2E testing

### Validation

- 16/16 files present with correct frontmatter
- Zero leftover placeholders
- Every agent has scope boundaries, MUST NOT section, output format, and gate checklist

Related: [[LNPM Cloud Dashboard]], [[LNPM Milestones Plan]]
