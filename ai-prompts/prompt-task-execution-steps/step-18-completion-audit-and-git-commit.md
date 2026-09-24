---
step: 18
title: Completion Audit & Git Commit
phase: Completion
---

# Step 18: Completion Audit & Git Commit

**Purpose:** Run a final audit of all deliverables and commit the work to the feature branch.

## Instructions

### 1. Final audit checklist

- [ ] **Acceptance criteria:** Every criterion in the task file is met (or marked `manual-verified` with justification).
- [ ] **Quality gates:** All quality gate commands from Step 10 pass cleanly.
- [ ] **Tests:** All unit/integration/E2E tests from Steps 12–13 pass.
- [ ] **Tracking:** Task file status = `Complete`; milestone dashboard updated (Step 16).
- [ ] **AGENTS.md:** New conventions/ADRs appended (Step 17).
- [ ] **Memory:** All entries from Step 15 are present and searchable.
- [ ] **No leftover debug code:** No `console.log`, `println!`, or temporary comments in the committed code.
- [ ] **No out-of-scope changes:** `git diff --name-only` shows only files within the task's stated scope.

### 2. Check the diff

- Run `git diff --name-only` (Bash) — list all changed files.
- Run `git diff --stat` (Bash) — check the size of the change.
- IF any file is unexpectedly in the diff, investigate before committing.

### 3. Stage and commit

- Run `git add -A` (Bash) — stage all changes (or stage specific files if the diff includes unrelated changes).
- Run `git commit` (Bash) with the following message format:

  ```
  {type}({scope}): [{{TASK_ID}}] {short description}

  {body: 1–5 bullet points describing what was done}
  - {bullet 1}
  - {bullet 2}
  - ...

  Refs: ai-milestones-and-tasks/milestone-{NN}-{name}/task-{{TASK_ID}}-*.md
  ```

  **Commit message rules:**
  - `type`: `feat` (new feature), `fix` (bug fix), `refactor` (code change without behavior change), `chore` (config/tooling), `docs` (documentation only).
  - `scope`: milestone scope (`M3-T1`), or component scope (`tauri`, `dashboard`, `sync`) — use the milestone scope for task commits.
  - The `[{{TASK_ID}}]` tag MUST appear in the subject line.
  - `Refs:` line points to the task file path (no wildcard — use the exact filename).

  **Example:**
  ```
  feat(M3-T1): [M3-T1] Match Tauri chart with dashboard palette

  - Aligned Tauri uPlot chart colors with dashboard design tokens
  - Added quality band overlay to Tauri LatencyChart
  - Fixed threshold line rendering in Tauri popup view
  - Added 4 unit tests for chart color mapping

  Refs: ai-milestones-and-tasks/milestone-03-tauri-client-enhancement/task-M3-T1-match-tauri-chart-with-dashboard.md
  ```

### 4. Verify the commit

- Run `git log --oneline -1` (Bash) — confirm the commit message is correct.
- Run `git status` (Bash) — confirm clean working tree.

### 5. Do NOT push

- Per the "No unconfirmed commits" workflow rule: **do not push the branch** without explicit user confirmation.
- Report the branch name and commit hash to the user.

### 6. Write the completion report

Present the Task Completion Report (format from `{{PROMPT_FILE_PATH}}` § "Report"):

```
## Task Completion Report
- **Task:** {{TASK_ID}} — [Task title]
- **Branch:** {{FEATURE_BRANCH}}
- **Stack:** [Dashboard | Tauri | Cross-stack]
- **Status:** 🟢 Complete | 🔵 Blocked | 🟠 Partial
- **Changes:** [List of files created/modified]
- **Tests:** [Pass/Fail count + commands run, per stack]
- **Verification:** [What was verified vs `manual-verified`]
- **Memory Updated:** [List of entries]
- **Notes:** [Decisions, patterns, follow-ups, skipped steps with justification]
```

### 7. Mark `step-18` as `completed`** in TodoWrite.

## Completion Criteria

- [ ] Full audit checklist passed
- [ ] Commit made with correct message format (type, scope, `[{{TASK_ID}}]` tag, `Refs:` line)
- [ ] Working tree clean after commit
- [ ] Branch NOT pushed (awaiting user confirmation)
- [ ] Task Completion Report presented to user
