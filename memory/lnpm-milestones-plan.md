---
name: lnpm-milestones-plan
description: Milestones and tasks plan for LNPM Cloud Dashboard (2 milestones, 19 tasks, 14 features)
metadata:
  type: project
---

# LNPM Cloud Dashboard — Milestones Plan

**Created:** 2026-07-31
**Decision:** 2 milestones, 19 tasks covering 14 features

## Milestones

- **M1 — Backend Platform** (12 tasks, 12-15 days): F1, F2, F3, F4, F5, F6, F7, F10, F12, F13, F14
  - `ai-milestones-and-tasks/milestone-01-backend-platform/`
  - Tasks: M1-T1 through M1-T12
- **M2 — Dashboard UI** (7 tasks, 5-7 days): F8, F9, F11
  - `ai-milestones-and-tasks/milestone-02-dashboard-ui/`
  - Tasks: M2-T1 through M2-T7

## Key Conventions

- Milestone IDs: `M{n}`, Task IDs: `M{n}-T{n}`
- Status values: Not Started, In Progress, Complete, Deferred, Cancelled
- Milestone folders: `milestone-{number}-{slug}/`
- Task files: `task-M{n}-T{n}-{slug}.md` inside milestone folders
- Commit messages: `feat(F{N}): [task-id] description`
- Feature branches: `feature/M{n}-T{n}-short-description`
- Base branch: `develop`

## Files

- 22 files total: 2 milestone READMEs, 19 task files, 1 project dashboard
- Dashboard: `ai-milestones-and-tasks/project-dashboard.md`
- All 14 features mapped to tasks with no gaps

**How to apply:** Use [[lnpm-cloud-dashboard]] for project context and [[lnpm-cloud-dashboard-requirements]] for feature specs.
