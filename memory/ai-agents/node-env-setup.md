---
name: ai-agents-node-env-setup
description: Node.js version requirements, NVM vs Homebrew conflict, and native module rebuild for all agents that run commands
metadata:
  type: project
  updated: 2026-08-04
---

## Node.js Environment Requirements

**Nuxt 4.5.1 requires:** `^22.19.0 || ^24.11.0 || >=26.0.0` (NOT older 22.x like 22.15.1)

**Always use NVM, never Homebrew Node:**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && node --version
```

If the version is < 22.19.0, install latest:
```bash
source ~/.nvm/nvm.sh && nvm install 22 && nvm use 22
```

**Critical:** Homebrew's Node (`/opt/homebrew/Cellar/node/26.0.0`) takes PATH priority over NVM and silently breaks native modules (better-sqlite3, etc.). Always verify with `node --version` after `nvm use`.

**Native module rebuild (better-sqlite3):**
```bash
rm -rf node_modules/better-sqlite3
npm install better-sqlite3@11.7.0 --build-from-source
```

**Stale .pnpm binaries:** The project root has `node_modules/.pnpm` with cached binaries from Linux builds. If `better-sqlite3` loads from `.pnpm` instead of the dashboard's `node_modules`, verify the binary is Mach-O (not ELF):
```bash
file /Users/pk/Projects/ping-monitoring/node_modules/.pnpm/better-sqlite3*/node_modules/better-sqlite3/build/Release/better_sqlite3.node
```
If it says `ELF` instead of `Mach-O`, delete the `.pnpm` entry and reinstall:
```bash
rm -rf /Users/pk/Projects/ping-monitoring/node_modules/.pnpm/better-sqlite3*
cd dashboard && npm install better-sqlite3@11.7.0 --build-from-source
```

## Why

Discovered on 2026-08-04: NVM had Node 22.15.1 installed, but Nuxt 4.5.1 requires 22.19.0+. Additionally, Homebrew Node 26 was taking PATH priority, causing `better-sqlite3` to be compiled against wrong headers. A stale Linux binary in `.pnpm` store was also loaded instead of the macOS build.

## Applied to Agents

Updated all agents that run commands:
- [[agent-07-implement-the-task]] — Runtime requirements section
- [[agent-08-code-review]] — Step 0: Prepare Environment
- [[agent-09-automated-uat]] — Step 2: Infrastructure Readiness
- [[agent-10-unit-tests]] — Step 1.5: Verify Node.js Environment
- [[agent-11-e2e-tests]] — Step 1.5: Verify Node.js Environment
