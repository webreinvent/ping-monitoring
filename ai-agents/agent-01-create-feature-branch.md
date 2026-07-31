---
title: LNPM - Create Feature Branch
---

# Create Feature Branch

## Purpose

Create a feature branch following the project's GitFlow branching strategy and Conventional Commits convention.

## Scope Boundaries

**This agent MUST:**
- Determine the correct base branch (GitFlow: `develop` for features)
- Create and checkout a new feature branch
- Verify the branch is up-to-date

**This agent MUST NOT:**
- Commit any changes
- Push the branch to remote
- Modify any files
- Run build commands or tests

## Variables

- **`{{PROJECT_NAME}}`** _(static)_ — `LNPM Cloud Dashboard`
- **`{{BASE_BRANCH}}`** _(static)_ — `develop`

## MCP Servers

| Server | Purpose | Install / Configure | When to Use |
|--------|---------|-------------------|-------------|
| `git` | Version control — branches, commits, diffs, status | No install needed | Branch creation, checkout, status |
| `memory` | Cross-session persistence | No install needed | Share data between agents |
| `filesystem` | File and directory operations | No install needed | Read/write files, explore directories |
| `sequential-thinking` | Structured problem decomposition | No install needed | Complex decisions and analysis |

## Skills

No skills required for this agent.

## Workflow

**Step 1: Determine Branching Strategy**

- **Gitflow** → base branch is `develop` (this project uses GitFlow with `develop` as the integration branch)
- Main branch is `main` — only for releases

**Step 2: Create Branch**

**Invoke `git` MCP server:**
1. Switch to `develop` branch
2. Pull latest changes from remote
3. Create branch: `feature/task-id-short-description` (or `fix/` prefix for bug fixes). Derive task id from memory (session context from Agent 00). Example: `feature/M1-T1-setup-nuxt-project`
4. Verify the branch is active and up-to-date

**Error recovery:** IF the branch already exists, switch to it and confirm it is up-to-date with `develop`.

## Output

```
Branch Created
  Branch name: feature/task-id-short-description
  Base branch: develop
  Status: Active and up-to-date
  Next agent: Agent 02 (Understand Task Scope)
```

## Gate

- [ ] Branching strategy identified (GitFlow, base = develop)
- [ ] Branch created from correct base
- [ ] Branch is active
