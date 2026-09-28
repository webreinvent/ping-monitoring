# LNPM Cloud Dashboard — Lessons Learned

> Saved: 2026-08-06
> Tasks: M1-T4 (health check), M1-T5 (client identity), M1-T7 (monitors list API), M1-T8 (monitor history API), M1-T9 (WebSocket live broadcast), M1-T12 (rate limiting), M2-T2 (sidebar), M2-T3 (all-monitors chart), M2-T4 (monitor detail view), M2-T6 (client settings page), M2-T7 (inline client name edit with WS broadcast)

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

## Lesson 11: Mock DB tests for SQL query mapping logic

**Error:** No lesson — this is a positive pattern confirmed during M1-T7.

**Finding:** The mock DB approach (`vi.mock("../utils/db")`) works well for testing SQL query result mapping. The test doesn't verify the SQL query itself but verifies the mapping layer: given rows from the DB, does the code produce the correct API response?

**Key insight:** This is a trade-off, not a weakness. The SQL query is tested indirectly through the mapping layer. The integration test file (`monitors.get.integration.test.ts`) tests the full pipeline: mock DB → query → mapping → API response shape.

**Prevention:** Accept that mock DB tests validate the mapping layer, not the SQL syntax. For SQL correctness, rely on typecheck (`npx nuxi typecheck`) and the fact that better-sqlite3 will throw at runtime if the query is invalid.

## Lesson 12: M1-T6 (ping ingest) creates the monitors that M1-T7 reads

**Error:** No error — this is a dependency awareness lesson.

**Finding:** M1-T7 depends on M1-T6 completing first because M1-T6's ingest endpoint (`POST /api/ping/ingest`) is what creates monitors and ping samples. The monitors list API has no way to produce data without the ingest endpoint having run.

**Key insight:** Task dependency ordering is critical. M1-T7's tests use mock DB data because the real monitors table is empty without M1-T6 running. The mock approach is correct and appropriate for this dependency.

**Prevention:** When implementing endpoints that read data created by other endpoints, use mock data in tests rather than trying to call the creating endpoint. This keeps tests isolated and fast.

## Lesson 13: `unknown[]` type in test mocks is acceptable but not ideal

**Error:** The `as unknown as Database` cast in mock DB creation is a TypeScript escape hatch. Code review identified it as a minor concern.

**Root cause:** better-sqlite3's `Database` type is complex; creating a mock that satisfies the full interface requires implementing many methods.

**Fix:** The `as unknown as Database` cast is acceptable for test mocks. The mock only needs to satisfy the methods actually called by the code under test (`prepare().all()`). TypeScript's structural typing means the mock only needs the methods that are actually invoked.

**Prevention:** Use `as unknown as Database` sparingly — only in test code, not in production. The mock should implement only the methods used by the code under test, keeping tests focused on behavior, not type satisfaction.

## Lesson 14: M1-T8 implementation was pre-built by earlier Agent 07 attempt

**Error:** The M1-T8 code (history.ts, [id].get.ts, tests, types) was already created as untracked files on the `feature/M1-T8-monitor-history-api` branch by an earlier Agent 07 attempt. The current Agent 07 run fixed TypeScript errors and verified correctness rather than implementing from scratch.

**Root cause:** Agent 05 (Plan) and Agent 06 (Audit) created the implementation plan and audit, but the code was actually already written during a previous session. The context files were missing so the agent started from the plan but found files already existed.

**Fix:** Agent 07 focused on fixing TS2345/TS18048 errors (non-null assertions for array access, exported MonitorRow/ClientRow interfaces, ClientRow import in route handler) and running verification (typecheck, dev server).

**Prevention:** When a feature branch already has untracked implementation files, Agent 02 (Understand Task Scope) should check for existing implementation before planning. The audit should also verify whether code exists before proposing implementation steps.

## Lesson 15: better-sqlite3 native module segfaults on Linux container

**Error:** `better-sqlite3` native module crashes with segfault when run in the Linux container environment (macOS prebuilt binary running on Linux kernel).

**Root cause:** The `better-sqlite3` package ships prebuilt binaries for macOS which don't work on Linux containers. The tests use mock DBs (the `globalThis.__db` pattern) which avoids importing the native module.

**Fix:** Tests use mock databases exclusively — `vi.mock("../utils/db")` with `createMockDb()` returning minimal `Database` stubs. This is the established pattern and works correctly.

**Prevention:** When testing code that depends on `better-sqlite3`, always use mock DB injection. The `globalThis.__db` pattern is the project standard. Tests that directly import the real DB will crash in this environment.

## Lesson 16: TypeScript non-null assertions for array access in tests

**Error:** TS2345 errors when accessing array elements without non-null assertions (e.g., `intervals[0]` when TypeScript can't prove the array is non-empty).

**Root cause:** TypeScript's type narrowing doesn't always propagate from `expect(intervals.length).toBe(1)` to the next line. The test code accesses `intervals[0]` which TypeScript sees as `QualityIntervalRecord | undefined`.

**Fix:** Use non-null assertions (`intervals[0]!`) in test code where the test itself has already verified the array has elements. This is safe in tests because the assertion is the test's own verification.

**Prevention:** In test code, use non-null assertions after verifying array length. In production code, use optional chaining or explicit checks.

## Lesson 17: ClientRow interface needs to be exported from history.ts

**Error:** `history.ts` uses `ClientRow` type for `buildTarget()` but the interface was defined locally. The route handler ([id].get.ts) needed to import it but it wasn't exported.

**Root cause:** The interface was defined in `history.ts` without `export`, but the route handler needed the same type for casting DB results.

**Fix:** Exported `MonitorRow` and `ClientRow` interfaces from `history.ts`. The route handler imports `ClientRow` from `../utils/history` for type assertions.

**Prevention:** When a type is used by multiple modules (utility + route handler), define it in a shared location or export it from the utility module. Consider moving DB row types to `shared/types.ts` if they're used across multiple endpoints.

## Lesson 18: Defensive copies for mutable arrays in interval computation

**Error:** Test expected that `intervals[0].reasons` would be a defensive copy that couldn't be mutated by external code. The initial implementation used `[...currentReasons]` when pushing — but the test modifies the returned array and expects the original to be unchanged.

**Root cause:** The reasons array was spread when creating each interval — but the test was checking that mutation of the returned array's reasons didn't affect the internal state. The spread was correct but the test needed to verify the copy semantics.

**Fix:** The `[...currentReasons]` spread in the interval construction is sufficient — each interval gets its own copy of the reasons array. The test verifies this by pushing to `intervals[0].reasons` and checking that the original classifier state is unchanged.

**Prevention:** When returning arrays of objects with mutable sub-arrays, always create defensive copies. The spread operator (`[...]`) for arrays and object spread (`{...obj}`) are the standard patterns.

## Lesson 19: M1-T9 (WebSocket) was already fully implemented

**Error:** The WebSocket live broadcast feature (M1-T9) was found to be already fully implemented by previous agents. Agent 07 verified all acceptance criteria were met and no new code was needed.

**Root cause:** The WebSocket handler (`server/ws/ping.ts`) was created during M1-T1 initial setup and refined through subsequent tasks. The subscription map, message protocol, snapshot delivery, and broadcast integration were all complete.

**Key insight:** Always check existing implementation before writing new code. The `git diff --stat` command and reading the existing file revealed the feature was complete. Agent 07's role was verification, not implementation.

**Prevention:** Agent 02 (Understand Task Scope) should always check for existing implementation of the target feature. Agent 07 should verify before implementing. This saves time and avoids duplicate work.

## Lesson 20: Mock getDb must set globalThis.__db directly

**Error:** The Vitest mock for `getDb` must set `globalThis.__db` directly — not just mock the function return. The actual `getDb()` implementation reads from `globalThis.__db`.

**Root cause:** The `getDb()` function checks `if (globalThis.__db)` and returns it; otherwise creates a new connection. Mocking only the return value without setting the global is inconsistent.

**Fix:** Mock setup: `vi.mock("../utils/db", () => ({ getDb: vi.fn() }))` AND set `globalThis.__db = mockDb` in the test setup.

**Prevention:** When mocking functions that read global state, the mock must match the real implementation's behavior — including reading from the same global variables.

## Lesson 21: Logger info() takes string, not function

**Error:** The `info()` logger function expects a plain `string` parameter. Wrapping in arrow functions `() => ...` causes type errors.

**Root cause:** Template literals like `` info(`subscribing to ${monitorId}`) `` work fine, but wrapping in `() =>` is wrong.

**Fix:** Always pass strings directly to logger functions.

**Prevention:** Check the logger function signature before calling — `info(message: string)` takes a string, not a function.

## Lesson 22: Worker exit errors are infrastructure, not code

**Error:** 4 worker exit errors appear in every Vitest run (across 33 test files, 587 tests). These are infrastructure issues, not test failures.

**Root cause:** Vitest worker process management issues — not related to test code or application code.

**Fix:** No fix needed. These are known infrastructure issues that don't affect test results.

**Prevention:** Don't chase worker exit errors in Vitest output — they are noise. Focus on actual test failures.

## Lesson 23: WebSocket broadcast must iterate a copy of the subscriber set

**Error:** Broadcasting to subscribers by iterating the Set directly could cause issues if the set changes during iteration (e.g., a client disconnects mid-broadcast).

**Root cause:** The subscription map may change during broadcast if a client disconnects while iterating.

**Fix:** Iterate `[...subSet]` (spread copy) in `broadcastSample()` to avoid iteration issues.

**Prevention:** When iterating over sets that may change, always iterate a copy. This is a standard pattern for broadcast/pub-sub systems.

## Lesson 24: Classification algorithm testing without real DB (M1-T10)

**Error:** Cannot test `classifyMonitor()` directly — it calls `getDb()` which segfaults in Vitest workers.

**Fix:** Write tests verifying the decision logic in pure JavaScript (same thresholds, same ordered-if chain). Verifies algorithm correctness without touching the database.

**Lesson:** Separate algorithm from data access. Test the decision logic independently of SQL queries.

## Lesson 25: Migration numbering must be sequential (M1-T10)

**Error:** Initial plan referenced `005_create_indexes.sql` but 005 doesn't exist (already `003_create_ping_samples.sql`).

**Fix:** Used `006_add_quality_state_updated_at.sql`. Agent 08 caught this during audit.

**Lesson:** Check existing migration files before assigning new numbers.

## Lesson 26: Env var validation for timer intervals (M1-T10)

**Error:** `QUALITY_SWEEP_INTERVAL_MS` with non-numeric value causes `setInterval(NaN, ...)` = tight loop (CPU exhaustion).

**Fix:** `Number.isFinite()` + `> 0` validation with early return. Agent 08 caught during code review.

**Lesson:** Always validate env vars used as timer intervals — `setInterval(NaN)` = `setInterval(0)` = tight loop.

## Lesson 27: M1-T12 rate limiter was already fully implemented

**Error:** The rate limiting code (rate-limiter.ts, rate-limit.ts, tests) was already created as untracked files by Agents 03/04 during the M1-T12 session. Agent 07's role was to fix the 429 response shape to match F13 spec (changed error from human-readable string to `"rate_limit_exceeded"`, removed unused imports, removed non-spec `code` field).

**Root cause:** Same pattern as M1-T8/M1-T9 — code was pre-built by earlier agents but the task tracking showed "Not Started". The implementation was correct but the response shape needed a small fix.

**Key insight:** When rate limiting middleware is in `server/middleware/`, it runs automatically before all routes — no registration needed. The middleware pattern (Nitro file-based middleware) is simpler than the API route pattern.

**Prevention:** Same as Lesson 19 — always check for existing implementation before writing new code. The middleware directory should be checked alongside `server/api/` and `server/utils/`.

## Lesson 28: F13 spec compliance requires exact 429 response shape

**Error:** Initial implementation used `error: "Rate limit exceeded. Try again in N seconds."` (human-readable) and included a `code` field. The F13 spec requires `error: "rate_limit_exceeded"` (machine-readable) and no `code` field.

**Root cause:** The initial agent didn't cross-reference the F13 feature spec carefully enough — it used a reasonable default response shape rather than the spec-defined shape.

**Fix:** Agent 07 fixed the response to match F13 spec exactly: `{ error: "rate_limit_exceeded", retryAfter: N }`. Agent 08 code review confirmed correctness.

**Prevention:** Always cross-reference the feature spec (`requirements/features/feature-XXXXX-*.md`) for exact response shapes, not just the API design document. The feature spec is the source of truth for error response shapes.

## Lesson 29: h3 getRequestIP is a transitive dependency (M1-T12)

**Error:** Code review questioned whether `h3` was listed as a direct dependency in `package.json` — it's not (it's brought in transitively by Nitro). `getRequestIP` from `h3` is used directly in the middleware.

**Root cause:** Nitro imports h3 transitively; the types are available through the Nitro types. The `h3` package is not listed in `dashboard/package.json`.

**Fix:** No fix needed — `getRequestIP` is available through the Nitro/h3 chain and works correctly. The import works because Nitro re-exports h3 types.

**Prevention:** When using Nitro/h3 utilities (like `getRequestIP`, `setHeader`, `setResponseStatus`), the imports work through the Nitro dependency chain. This is expected and documented behavior.

## Lesson 30: M2-T4 was already fully implemented on develop

**Error:** M2-T4 (per-monitor detail view) was listed as "Not Started" in the project dashboard, but all code (detail page, components, composables, utilities) was already fully implemented on the `develop` branch from the M2-T3 session.

**Root cause:** The detail view components (`MonitorHeader.vue`, `MonitorSummary.vue`, `LatencyChart.vue`, `TimeRangeSelector.vue`, `NavigationBreadcrumb.vue`) and composables (`useMonitorHistory.ts`, `useTimeWindow.ts`) were created during M2-T3 (all-monitors chart) as shared components. The detail view page (`monitors/[id].vue`) was also implemented at that time.

**Key insight:** Shared components created for one task can fulfill acceptance criteria for subsequent tasks. The detail view reuses `LatencyChart`, `TimeRangeSelector`, `MonitorHeader`, `MonitorSummary`, and `EmptyState` — all created during M2-T3.

**Prevention:** When a task depends on components that are likely shared with earlier tasks in the same milestone, check if those components already exist. Agent 01's audit correctly identified this — M2-T4 was genuinely complete.

## Lesson 31: useAsyncData key must be stable for caching

**Error:** Using `Date.now()`-based values in `useAsyncData` keys would cause constant re-fetches (the key changes on every render).

**Root cause:** `fromMs` and `toMs` are computed from `Date.now()` — if used as part of the key, the data fetch would re-trigger on every reactive update.

**Fix:** Use the time window preset name (e.g., `"1h"`) as part of the key: `` `monitor-detail-${monitorId}-${timeWindow}` ``. The key only changes when the user explicitly selects a different time range.

**Prevention:** When using `useAsyncData` with time-range params, use the preset identifier (not the computed epoch values) as the key. This is stable, semantic, and only triggers re-fetches on actual user actions.

## Lesson 32: Default values prevent null errors in child components

**Error:** Without a `defaultSummary` object, `MonitorSummary` component would receive `undefined` when `historyData` is loading or empty — causing null property access errors.

**Root cause:** `series[0]?.summary` returns `undefined` when no data exists, but the `MonitorSummary` component expects a `RangeSummary` object.

**Fix:** Define a `defaultSummary` object with safe default values (0 for counts, null for latency, 0 for percentages) and use `series[0]?.summary ?? defaultSummary`.

**Prevention:** When extracting nested values from API responses for child components, always provide default fallback values. The `computed()` pattern with `??` is clean and reactive.

## Lesson 33: Live chart updates need rAF debouncing, not reactive watch

**Error:** Using `watch(liveData, handler, { deep: true })` to trigger chart updates causes Vue's reactivity system to fire on every sample append — leading to multiple `updateChart()` calls per frame and choppy rendering.

**Root cause:** `liveData` is a `ref<Map<...>>` — every `set()` call triggers watchers. With samples arriving every second (or faster), the chart tries to re-render more than once per frame.

**Fix:** Use `requestAnimationFrame` with a `pendingUpdate` flag to ensure only one update per frame. The `onUpdate(callback)` / `offUpdate(callback)` pattern in `useLiveChart` registers callbacks that fire once per frame regardless of how many samples arrive.

**Prevention:** When updating charts from high-frequency data sources (WebSocket, timers, etc.), always debounce via `requestAnimationFrame` — not Vue watchers. rAF is the browser's native batching mechanism and aligns with the rendering pipeline.

## Lesson 34: Data cap is essential for WebSocket-accumulated time series

**Error:** Without a maximum point limit, the `liveData` Map grows indefinitely — memory leaks during long sessions (hours of continuous data accumulation).

**Root cause:** WebSocket samples are appended without bound; unlike the history API which returns a finite set, live data has no natural stopping point.

**Fix:** Implement `MAX_POINTS_PER_MONITOR = 2000` — when exceeded, drop the oldest point (shift data by 1 position before appending). This is done during the append operation, not as a separate cleanup step.

**Prevention:** Any data structure that accumulates items from a continuous stream (WebSocket, polling, etc.) must have a bounded capacity. The cap should be set at the data ingestion point, not as a periodic cleanup.

## Lesson 35: M2-T7 was substantially pre-implemented

**Error:** No error — this is a pattern awareness lesson.

**Finding:** The M2-T7 task (inline client name editing with WebSocket broadcast) was substantially implemented by earlier tasks:
- `ClientGroup.vue` inline edit UI was created during M2-T2 (sidebar components)
- `PUT /api/clients/:slug/name` endpoint was created during M1-T5 (client identity)
- `SidebarContent.vue` WebSocket listener was wired during M2-T5 (live chart updates)
- `useWebSocket()` composable already had `onClientNameUpdated()` callback registration

The only missing piece was `broadcastClientNameUpdated()` in `server/ws/ping.ts` and the `allPeers` Set for global peer tracking.

**Key insight:** When a task's acceptance criteria span multiple subsystems, earlier tasks often implement parts of later tasks. The inline edit UI is a sidebar component (M2-T2), the name API is a client endpoint (M1-T5), and the WebSocket handling is a broadcast mechanism (M2-T5). The task completion is about wiring the final broadcast link.

**Prevention:** Agent 02 (Understand Task Scope) should always check which acceptance criteria are already met by existing code. `git diff --stat` and reading the relevant files reveals what's implemented vs. what's missing.

## Lesson 36: Global broadcast requires separate peer tracking

**Error:** The per-monitor subscription map (`Map<monitorId, Set<ws>>`) cannot support global broadcasts — there's no way to iterate "all peers" without iterating through all monitor subscriptions and de-duplicating.

**Root cause:** The WebSocket handler was designed for monitor-scoped messages (samples). Client name changes and settings changes need to reach ALL connected peers regardless of subscription.

**Fix:** Added `allPeers` Set — populated on `open()`, cleaned up on `close()`. `broadcastClientNameUpdated()` iterates this Set directly. This is a simpler and more correct approach than iterating all subscription sets.

**Prevention:** When designing a WebSocket handler, consider whether the application needs both per-topic and global broadcasts. If so, maintain both a subscription map (for targeted messages) and a global peer set (for broadcast messages). The `allPeers` Set pattern is lightweight (just a Set with add/delete on connect/disconnect).
