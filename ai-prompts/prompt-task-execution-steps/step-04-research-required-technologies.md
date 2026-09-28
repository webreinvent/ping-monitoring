---
step: 4
title: Research Required Technologies
phase: Preparation & Planning
---

# Step 4: Research Required Technologies

**Purpose:** Confirm exact versions and find official documentation for any technologies the task uses.

## Instructions

1. **Check the tech-stack reference:**
   - Load `{{STEPS_DIR}}/reference-tech-stack.md` for known versions and docs URLs.

2. **For each technology the task touches**, confirm:
   - **Exact version** (from `package.json` / `Cargo.toml` / lockfile — not from memory).
   - **Official docs URL** (if not already in the reference file).

   Key technologies in this project:
   - Nuxt 4.1+ / Nitro — `https://nuxt.com/docs`
   - Vue 3.5 — `https://vuejs.org/api/`
   - uPlot 1.6.32 — `https://uplot.org/`
   - better-sqlite3 11.10 — `https://github.com/WiseLibs/better-sqlite3`
   - ws 8.18 (dashboard WebSocket) — `https://github.com/websockets/ws`
   - Playwright 1.62 — `https://playwright.dev/docs/intro`
   - Tauri 2.11 — `https://v2.tauri.app/`
   - rusqlite 0.37 — `https://docs.rs/rusqlite`
   - tokio 1.52 — `https://docs.rs/tokio`

3. **Use context7 MCP for library docs:**
   - For Nuxt: resolve `/nuxt/nuxt`, query for the specific feature.
   - For Playwright: resolve `/microsoft/playwright`, query for test patterns.
   - For Tauri/Rust: use WebSearch or WebFetch on the official docs URLs above.

4. **Record findings** in your working notes (not a file) — versions, API signatures, gotchas.

5. **Mark `step-04` as `completed`** in TodoWrite.

## Completion Criteria

- [ ] All task-relevant technologies have confirmed versions
- [ ] Docs URLs available for any unfamiliar API
- [ ] Findings noted in working context
