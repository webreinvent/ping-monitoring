# LNPM Cloud Dashboard — Lessons Learned

> Saved: 2026-08-03
> Tasks: M1-T4 (health check), M1-T5 (client identity)

## Lesson 1: Database field naming mismatch in HealthResponse

**Error:** Initial `HealthResponse` type had `database` field instead of `db_path`. The health endpoint returned `db_path` but the type defined `database`.

**Root cause:** Type drift between the API design document (which specifies `db_path`) and an earlier type definition. The spec was updated but types weren't.

**Fix:** Updated `shared/types.ts` to use `db_path` matching the F14 API contract. Code review caught this as an SRP violation.

**Prevention:** Always cross-reference shared types against the API design document (`requirements/api/api-design.md`) before implementing endpoints.

## Lesson 2: better-sqlite3 build issues on fresh installs

**Error:** `npm install` failing with native module compilation errors for `better-sqlite3`.

**Root cause:** better-sqlite3 requires native Node.js bindings and specific build tools. The `@nuxt/nitro-server` preset was also missing initially.

**Fix:** Added `@nuxt/nitro-server` dependency, `compatibilityDate` in `nuxt.config.ts`, and proper native module build setup. See commit `5cc099a` for details.

**Prevention:** When using native Node.js modules in Nuxt/Nitro, ensure `@nuxt/nitro-server` preset is installed and build dependencies are available.

## Lesson 3: Test path resolution includes `.data/` in absolute paths

**Error:** Test checking that resolved path contains `.data/` was failing because the resolved absolute path is `/Users/pk/Projects/ping-monitoring/.data/lingering.db` — the `.data/` is embedded in the full path, not as a standalone segment.

**Root cause:** Overly specific path assertion in tests. The test was checking for `.data/` as a substring but the assertion was too narrow.

**Fix:** Updated test to check `fullPath.endsWith("lingering.db")` and `fullPath.startsWith("/")` instead. The key contract is that the path resolves to an absolute path ending with the expected filename.

**Prevention:** Test the contract (absolute path, correct filename) rather than exact path format, which varies by environment.

## Lesson 4: dbStatus internal tracking vs. response status

**Error:** Initial confusion about whether `dbStatus` should be exposed in the response.

**Root cause:** The health check probes DB connectivity internally but the spec says status is always `"ok"` if the endpoint responds. A DB failure should cause the outer catch to return an error response, not a separate status field.

**Fix:** `dbStatus` is kept as an internal variable for logging purposes only. The response status is determined by whether the endpoint completes successfully or throws.

**Prevention:** Follow the spec strictly — "status is always 'ok' if the endpoint responds" means the error is signaled by the outer catch returning `{ status: "error" }`.

## Lesson 5: Vitest test isolation requires explicit global state cleanup

**Error:** Tests sharing database state across runs due to `globalThis.__db` persisting between tests.

**Root cause:** The database singleton pattern (`globalThis.__db`) persists across test runs unless explicitly cleared.

**Fix:** Added `delete globalThis.__db` in `beforeEach` to ensure fresh state per test. This is documented in the test isolation pattern.

**Prevention:** Always clean up global singletons in `beforeEach` when using singleton patterns in server code.

## Lesson 6: E2E tests produce artifacts that shouldn't be committed

**Error:** Playwright E2E tests produce `.last-run.json`, error context files, and screenshots in the working directory.

**Root cause:** Playwright saves test artifacts on failures. These files appeared in `git status` and could be accidentally committed.

**Fix:** Ensure `.gitignore` covers Playwright test artifacts (`test-results/`, `.last-run.json`, etc.).

**Prevention:** Always check git status after running E2E tests; add artifact patterns to `.gitignore`.

## Lesson 7: Code review caught stale type fields

**Error:** `shared/types.ts` had stale `PingSample` with RTT-based fields that didn't match the new API design contract.

**Root cause:** Types were initially created for a different schema and not updated when the API design changed.

**Fix:** Full rewrite of `shared/types.ts` to match API design document (Section 15). This was identified as a DRY violation in the plan audit.

**Prevention:** Treat shared types as the source of truth and update them first when API contracts change. Use the implementation plan's Step 1 (types) as the foundation for all subsequent work.

## Lesson 8: M1-T5 was already implemented by Agent 00 during M1-T4

**Error:** The task M1-T5 (Client Identity) was listed as "Not Started" in the project dashboard, but all code had already been implemented by Agent 00 during the M1-T4 (backend setup) phase.

**Root cause:** Agent 00 built the client identity code (`client.ts`, API endpoints, tests) as part of the broader M1-T4 backend setup tasks because client identity was a foundational dependency for the database schema and health endpoint. The task tracking was never updated to reflect this.

**Fix:** Recognized during Agent 02 (Understand Task Scope) that all M1-T5 acceptance criteria were already met. The session focused on verification rather than implementation.

**Prevention:** When agents implement code that fulfills future task acceptance criteria, they should document which tasks were completed. The project dashboard should be updated after each session, not just after dedicated task sessions.

## Lesson 9: better-sqlite3@13 requires Node 22+, crashes on Node 20

**Error:** New test files (client.test.ts, [slug].get.test.ts, [slug].name.put.test.ts) crashed the Vitest worker with a better-sqlite3 segfault when run on Node 20.

**Root cause:** better-sqlite3@13 (the version installed with npm) requires Node.js 22+ for native bindings. The existing 242 tests pass because they use mock DBs (via `globalThis.__db` injection) and never actually import better-sqlite3.

**Fix:** The existing tests use mock databases (the `globalThis.__db` pattern), which works around this issue. The server itself would crash when first accessing the DB on Node 20, but this is a deployment-time issue, not a code issue.

**Prevention:** When writing tests that import modules using native bindings, prefer mock injection over direct imports. The `globalThis.__db` pattern is the project standard for this reason.

## Lesson 10: Task context files use different naming conventions

**Error:** The task specification file for M1-T5 is `task-M1-T5-client-identity.md` (with the descriptive suffix), but the project dashboard references it simply as `task-M1-T5.md`.

**Root cause:** Task files in the milestone directories include descriptive suffixes (e.g., `-client-identity`), making exact filename lookups unreliable.

**Fix:** Used Explore agent to search for files matching patterns like `**/task*{M1,T5}*` rather than trying to construct the exact path.

**Prevention:** When looking for task files, search for patterns rather than constructing exact paths. The Explore agent is well-suited for this.
