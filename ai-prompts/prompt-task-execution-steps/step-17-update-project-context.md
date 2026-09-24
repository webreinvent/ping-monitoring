---
step: 17
title: Update Project Context Files
phase: Completion
---

# Step 17: Update Project Context Files

**Purpose:** Append new conventions, ADRs, and patterns to `AGENTS.md` so future sessions inherit this task's learnings.

## Instructions

1. **Read the relevant section of `AGENTS.md`** at project root:
   - Find the appropriate location for the new content.
   - AGENTS.md is organized as: Project Overview → Directory Structure → Technology Stack → Coding Conventions → Nuxt 4/Nitro Specifics → Schema and Migrations → ADRs table → Quick Reference → per-milestone "New Conventions" sections (M1-T5, M1-T6, M1-T7, … M2-T9, …).

2. **Append (do NOT rewrite) new content** to the appropriate section:

   ### Per-milestone convention section (preferred)
   - Add a new subsection under the milestone's conventions area:
     ```markdown
     ## New Conventions — {{TASK_ID}}
     
     ### Pattern: [pattern name]
     [2–5 sentences describing the pattern, with a short code snippet if it clarifies]
     
     ### Decision: [decision name] (ADR-{NNN})
     [1–3 sentences: what was decided, why, and the trade-off accepted]
     ```
   - ADR numbers continue from the highest existing ADR number in the ADRs table.

   ### ADRs table
   - IF a new ADR was created, add a row to the ADRs table:
     ```
     | ADR-{NNN} | [Short title] | [One-line summary] | {{TASK_ID}} |
     ```

   ### Coding Conventions (only if a NEW general convention was established)
   - If the task established a pattern that applies broadly (not just to this milestone), add it to the relevant Coding Conventions subsection.

3. **Do NOT:**
   - Rewrite or reorganize existing AGENTS.md content.
   - Add duplicate entries for patterns already documented.
   - Add ADRs for trivial implementation choices (only for architectural decisions with real trade-offs).

4. **Update the milestone README** (`{{MILESTONES_DIR}}/milestone-{NN}-{name}/README.md`):
   - IF the milestone README has a "Completed Tasks" list, add `{{TASK_ID}}` to it.
   - IF the milestone README has a "Patterns" or "Conventions" section, append the new pattern there.

5. **Mark `step-17` as `completed`** in TodoWrite.

## Completion Criteria

- [ ] AGENTS.md updated with new conventions/ADRs (appended, not rewritten)
- [ ] ADRs table updated (if new ADR created)
- [ ] No duplicate entries added
- [ ] Milestone README updated (if it has a completed-tasks list)
