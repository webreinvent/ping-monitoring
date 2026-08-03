---
title: LNPM - Agent 01 - Create Feature Branch
description: Create a feature branch from the latest feature branch using GitFlow branching strategy
version: 2.0
---

# Create Feature Branch

## Purpose

Create a feature branch from the latest feature branch following the project's GitFlow branching strategy and Conventional Commits convention.

## Instructions

- Always create branches from the **latest feature branch**, NOT from `develop`.
- Use the `git` MCP server for all git operations — do NOT use Bash for git commands.
- Write down the branch name inline so it survives context compaction.
- IF the branch already exists, THEN switch to it and verify it is up-to-date.
- Faithful reporting: IF the branch creation fails or the latest feature branch cannot be found, report it as Blocked — do not guess.

## Scope Boundaries

**This agent MUST:**
- Find the latest feature branch (most recent `feature/*` branch by commit date)
- Create a new feature branch from that latest feature branch
- Verify the branch is active and up-to-date

**This agent MUST NOT:**
- Commit any changes
- Push the branch to remote
- Modify any files
- Run build commands or tests
- Create branches from `develop` directly — always from the latest feature branch

## Variables

- **`{{PROJECT_NAME}}`** *(static)* — `LNPM Cloud Dashboard`
- **`{{TASK_ID}}`** *(dynamic)* — The task ID from session context (e.g., `M1-T7`). Provided by Agent 00.
- **`{{BRANCH_NAME}}`** *(dynamic)* — Derived as `feature/{{TASK_ID}}-short-description`. Example: `feature/M1-T7-monitors-list-api`.

## Codebase Structure

```
GitFlow branches:
  main              — Production releases only
  develop           — Integration branch
  feature/*         — Feature branches (this agent creates from the latest one)
```

## MCP Servers

| Server | Purpose | When to Use |
|--------|---------|-------------|
| `git` | Version control — branches, commits, diffs, status | Branch creation, checkout, status |
| `memory` | Cross-session persistence | Read {{TASK_ID}} from Agent 00 session context |

## Skills

No skills required for this agent.

## Workflow

### Step 1: Load Task ID

Read `{{TASK_ID}}` from memory (session context passed by Agent 00).

**Gate:** IF `{{TASK_ID}}` is not found in memory, THEN stop and ask the user for the task ID.

### Step 2: Find Latest Feature Branch

List all local `feature/*` branches sorted by most recent commit. Identify the latest feature branch.

**Gate:** IF no `feature/*` branches exist, THEN fall back to `develop` as the base. Note this fallback in the report.

### Step 3: Create Branch

1. Checkout the latest feature branch identified in Step 2
2. Pull latest changes from remote to ensure it's up-to-date
3. Create new branch: `feature/{{TASK_ID}}-short-description`
4. Verify the new branch is active

**Error recovery:** IF a branch with `{{BRANCH_NAME}}` already exists locally or remotely, THEN switch to it and verify it is up-to-date with its parent feature branch.

### Step 4: Verify Branch

Confirm:
- The branch name matches `{{BRANCH_NAME}}`
- The branch is active (HEAD points to it)
- Note the parent branch it was created from

## Report

After completing the workflow, output this summary:

```
Branch Created
  Task: {{TASK_ID}}
  Branch name: {{BRANCH_NAME}}
  Parent branch: [latest feature branch or develop if fallback]
  Status: Complete | Partial | Blocked
  Branch existed: [true/false — reused existing]
  Verification: [branch is active, commit count vs parent]
  Notes: [any fallbacks, warnings, or decisions]
  Next agent: Agent 02 (Understand Task Scope)
```
