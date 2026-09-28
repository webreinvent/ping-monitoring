---
name: agent-pipeline-reduced
description: 16 agents merged to 6, agent-05 commits all changes, merges to develop locally, never pushes
metadata:
  type: project
---

16 agent pipeline files (agent-00 through agent-15) merged into 6 consolidated agents.

**New pipeline:**
- Agent 00: Orient & Prepare (load context + create branch + understand scope)
- Agent 01: Analyze & Plan (code analysis + UI/UX + implementation plan + audit + user approval)
- Agent 02: Implement (execute plan)
- Agent 03: Verify & Test (code review + UAT + unit tests + E2E tests)
- Agent 04: Document & Persist (AI memory + docs + project context)
- Agent 05: Finalize & Commit (commit ALL changes, merge feature branch into develop locally, **never push to origin**)

**Agent 05 rules:**
- Commit **all** changes — no uncommitted work left in the feature branch
- After committing, merge the feature branch into `develop` locally
- **DO NOT push to origin** under any circumstances
- The user decides when to push

[[no-unconfirmed-commits]] — agents must not push without user confirmation.
