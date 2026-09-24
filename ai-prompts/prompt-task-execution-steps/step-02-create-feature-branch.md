---
step: 2
title: Create Feature Branch
phase: Orientation
---

# Step 2: Create Feature Branch

**Purpose:** Create an isolated git branch for the task so changes never touch `develop` directly.

## Instructions

1. **Ensure clean state:**
   - Run `git status` (Bash). IF uncommitted changes exist, ask the user whether to stash or commit them first.

2. **Switch to base branch:**
   - Run `git checkout develop` (Bash).
   - Run `git pull origin develop` (Bash) to sync with remote. (If the pull fails due to a missing remote or network, note it and proceed from local `develop`.)

3. **Create the feature branch** from `develop`:
   - Branch name pattern: `feature/{{TASK_ID}}-short-description`
     - `{{TASK_ID}}` uses the milestone/task format: `M3-T1`
     - `short-description` is 2–4 kebab-case words describing the task.
   - Example: `feature/M3-T1-match-tauri-chart-with-dashboard`
   - Run: `git checkout -b feature/{{TASK_ID}}-short-description` (Bash)

4. **Set the branch variable:** `{{FEATURE_BRANCH}}` = the branch name just created.

5. **Verify:**
   - Run `git branch --show-current` (Bash) — confirm it matches `{{FEATURE_BRANCH}}`.

6. **Mark `step-02` as `completed`** in TodoWrite.

## Completion Criteria

- [ ] On a new branch `feature/{{TASK_ID}}-short-description` created from `develop`
- [ ] `{{FEATURE_BRANCH}}` variable set
- [ ] Branch confirmed via `git branch --show-current`
