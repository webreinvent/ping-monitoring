---
taskId: M1-T1
milestone: M1
title: Setup Nuxt 4 + Nitro project with persistent runtime
priority: Critical
status: "🟢 Complete"
estimatedEffort: "2-3 hours"
features:
  - F1
---

# Task M1-T1 — Setup Nuxt 4 + Nitro project with persistent runtime

> **Milestone:** M1 (Backend Platform)
> **Priority:** Critical
> **Status:** 🟢 Complete
> **Estimated Effort:** 2-3 hours

## Description

Initialize the Nuxt 4 + Nitro v2 project inside the `dashboard/` directory with persistent `node-server` runtime, TypeScript configuration, project structure, and a minimal app shell. This is the foundation for every other backend task.

## Task Goals

- Create Nuxt 4 project with Nitro configured for persistent `node-server` runtime
- Establish the project directory structure per architecture spec
- Configure TypeScript, environment variables, and package.json
- Create a minimal `app.vue` shell
- Verify server starts and responds on port 3000

## Acceptance Criteria

- [x] `pnpm run dev` starts the Nitro server on port 3000 with persistent Node.js runtime
- [x] Server is NOT running in serverless mode (verify Nitro preset)
- [x] `nuxt.config.ts` contains correct configuration for persistent runtime
- [x] Project directory structure matches architecture spec
- [x] `.env.example` contains all environment variables from requirements README
- [x] TypeScript is configured with strict mode
- [x] `npx nuxi typecheck` passes with no errors

## Completion Criteria

- [x] All acceptance criteria above pass
- [x] `npx nuxi typecheck` passes with no errors
- [x] `npx nuxi dev` starts without errors
- [x] Server responds to HTTP requests on port 3000

## Testing Checklist

- [x] Server starts without errors
- [x] Persistent runtime confirmed (not serverless)
- [x] TypeScript compilation succeeds

## Dependencies

- **Requires:** None
- **Blocks:** M1-T2, M1-T4

## Documentation References

- F1: [Backend project setup](../../requirements/features/feature-0001-backend-setup.md)
- [Architecture](../../docs/architecture.md) — ADR-001: Nuxt 4 + Nitro for Backend
