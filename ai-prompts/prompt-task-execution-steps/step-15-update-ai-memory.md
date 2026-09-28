---
step: 15
title: Update AI Memory & Cache
phase: Completion
---

# Step 15: Update AI Memory & Cache

**Purpose:** Persist the session's learnings to `memory` MCP so future sessions can recover context without re-reading everything.

## Instructions

1. **Review all memory entries created this session** (search `memory` MCP for tags containing `{{TASK_ID}}`).

2. **Ensure these entries exist and are up-to-date** (create or overwrite as needed):

   | Entry Title | Tags | Content |
   |---|---|---|
   | `LNPM — {{TASK_ID}} Selected` | `task-selection`, `{{TASK_ID}}` | Task title, stack, priority |
   | `LNPM — {{TASK_ID}} Scope` | `task-scope`, `{{TASK_ID}}` | Task summary, stack, expected files |
   | `LNPM — {{TASK_ID}} Code Analysis` | `code-analysis`, `{{TASK_ID}}` | Files read, patterns observed |
   | `LNPM — {{TASK_ID}} Implementation Plan` | `implementation-plan`, `{{TASK_ID}}` | Ordered file list, changes per file |
   | `LNPM — {{TASK_ID}} UI/UX Plan` | `ui-ux-plan`, `{{TASK_ID}}` | Component plan, CSS approach (if UI changes) |
   | `LNPM — {{TASK_ID}} UAT Results` | `uat`, `{{TASK_ID}}` | Acceptance criteria results |
   | `LNPM — {{TASK_ID}} Test Results` | `test-results`, `{{TASK_ID}}` | Test files added, pass/fail counts |
   | `LNPM — {{TASK_ID}} E2E Results` | `e2e-results`, `{{TASK_ID}}` | E2E specs added or skip justification |
   | `LNPM — {{TASK_ID}} Impact Propagation` | `impact-propagation`, `{{TASK_ID}}` | Upcoming tasks affected |
   | `LNPM — {{TASK_ID}} Patterns Established` | `patterns`, `{{TASK_ID}}` | New patterns created this task (for AGENTS.md in Step 17) |
   | `LNPM — {{TASK_ID}} Lessons Learned` | `lessons-learned`, `{{TASK_ID}}` | Errors encountered, gotchas, decisions made |

3. **Patterns Established entry** — list any new reusable patterns:
   - New composable or utility function with its purpose.
   - New migration convention or DB pattern.
   - New Rust module pattern.
   - New CSS token or component pattern.

4. **Lessons Learned entry** — list:
   - Errors encountered and how they were fixed.
   - Surprising behavior (e.g., better-sqlite3 segfault, WebSocket type issue).
   - Decisions made and their rationale.

5. **Verify memory entries are searchable** — search for `{{TASK_ID}}` in `memory` MCP and confirm all entries appear.

6. **Mark `step-15` as `completed`** in TodoWrite.

## Completion Criteria

- [ ] All 11 memory entries created or updated
- [ ] Patterns Established entry is non-empty (at least one pattern)
- [ ] Lessons Learned entry is non-empty (at least one lesson or "none")
- [ ] Memory search for `{{TASK_ID}}` returns all entries
