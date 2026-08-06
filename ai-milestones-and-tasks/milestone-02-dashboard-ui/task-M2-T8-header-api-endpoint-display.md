---
taskId: M2-T8
milestone: M2
title: Display Nitro API endpoint in dashboard header for Tauri client setup
priority: Medium
status: "🟢 Complete"
estimatedEffort: "2-3 hours"
features:
  - F8
---

# Task M2-T8 — Display Nitro API endpoint in dashboard header for Tauri client setup

> **Milestone:** M2 (Dashboard UI)
> **Priority:** Medium
> **Status:** 🟢 Complete
> **Estimated Effort:** 2-3 hours

## Description

Surface the single ingest endpoint URL (`POST /api/ping/ingest`) prominently in the dashboard header so that operators installing LNPM Tauri clients on remote computers can immediately see and copy the URL they need to configure. Tauri clients use this URL to register themselves on first POST and to send subsequent ping batches. The dashboard already auto-registers clients and auto-creates monitors via the deterministic client-slug mechanism (M1-T5, M1-T6); this task only changes how the URL is communicated to operators.

## Task Goals

- Show the ingest endpoint URL in the header, between the brand block and the connection-status pill
- Auto-detect the URL from the incoming request via `useRequestURL()` so it works on any deployment (localhost, LAN IP, reverse-proxy domain) without configuration
- Provide a one-click copy-to-clipboard button so operators don't transcribe 40+ characters manually
- Wrap the disclosure in `<ClientOnly>` with a static fallback to prevent hydration mismatches (same pattern used by the existing connection-status pill)

## Implementation Plan

> ⚠️ Analyze this plan thoroughly before implementing. Invoke relevant skills and MCP servers as needed.

### Pre-Implementation Analysis

- Review existing `DashboardHeader.vue` structure (brand on left, connection-status pill on right with `<ClientOnly>` wrapper, fallback pattern at lines 22-33).
- Confirm `useRequestURL()` is available in Nuxt 4 — it returns the full URL of the current request and is SSR-safe.
- Confirm `navigator.clipboard.writeText` API and pick a fallback strategy for non-secure contexts (textarea + `document.execCommand("copy")`).
- No backend changes required — `POST /api/ping/ingest` already exists and matches the contract Tauri clients expect.

### Steps

1. Open `dashboard/app/components/layout/DashboardHeader.vue`.
2. Add a new `<div class="api-endpoint">` block in the template, positioned between `.brand-block` and the existing connection-status `<ClientOnly>` wrapper.
3. Inside the new block add:
   - `<span class="api-endpoint-label">API endpoint</span>`
   - `<code :title="ingestUrl">{{ ingestUrl }}</code>`
   - `<button class="copy-btn" @click="copyIngestUrl" :aria-label="copied ? 'Copied' : 'Copy API endpoint URL'">📋</button>`
   - `<span class="sr-only" aria-live="polite">{{ copyStatusText }}</span>`
4. Wrap the entire block in `<ClientOnly>` with a static fallback (`<span class="api-endpoint-label">API endpoint</span>`) so SSR HTML matches the client first render.
5. In the `<script setup>` block:
   - Compute `ingestUrl` with `useRequestURL()` → `${u.protocol}//${u.host}/api/ping/ingest`
   - Add a `copied` ref + `copyIngestUrl()` async handler that calls `navigator.clipboard.writeText(ingestUrl.value)`, then sets `copied = true` and resets after 1500 ms via `setTimeout`
   - Add a hidden-textarea fallback path for `try/catch` rejection on insecure contexts
6. Add scoped CSS:
   - Pill shape (rounded border, subtle background) with `max-width: 480px` and `overflow: hidden; text-overflow: ellipsis; white-space: nowrap` on the `<code>` element
   - Copy button: subtle hover/focus state, `aria-pressed` toggling
   - `.sr-only` utility class for the live-region
   - Mobile breakpoint: collapse to icon-only at `< 768px` (hide the label, keep code + button)
7. Verify on desktop (`http://localhost:3000`) and a tunneled URL (`https://lnpm-tunnel.example.com`) that the displayed URL matches the browser's address bar.
8. Run `cd dashboard && npx nuxi typecheck` and confirm zero errors.
9. Restart the dev server (port 3000) and click the copy button → confirm clipboard contains the full URL.

### Skills & MCP Servers

| Resource | Purpose | When to Invoke |
|---|---|---|
| `nuxt` | Nuxt 4 + Nitro specifics (useRequestURL, ClientOnly) | Confirming SSR-safe patterns |
| `filesystem` (MCP) | File read/write | Modifying DashboardHeader.vue |
| Playwright MCP (optional) | Visual validation | Smoke test the disclosure after dev-server restart |

## Acceptance Criteria

- [x] Dashboard header shows the ingest URL between the brand block and the connection-status pill
- [x] URL is auto-detected via `useRequestURL()` — no env var or runtime config required
- [x] URL matches the browser's address bar in every deployment scenario (localhost, LAN IP, reverse-proxy)
- [x] Copy button copies the full URL to the clipboard on click
- [x] "Copied" feedback appears for 1.5 s after a successful copy (visual + screen-reader live region)
- [x] Disclosure is wrapped in `<ClientOnly>` with a static fallback — no Vue hydration mismatch warnings in dev console
- [x] `npx nuxi typecheck` passes with zero errors
- [x] Mobile viewport (`< 768px`) shows a compact icon-only label, the URL, and the copy button without overflow

## Completion Criteria

- [x] All acceptance criteria above pass
- [x] `cd dashboard && npx nuxi typecheck` passes with zero errors
- [x] `cd dashboard && npm run dev` starts without errors and `/api/health` returns 200
- [x] Manual smoke test: paste the copied URL into a curl command targeting a sample payload shape (see `docs/api/ping-ingest.md`) and confirm a `201` response with `accepted: 1`

## Testing Checklist

- [x] Header renders the URL on desktop and mobile
- [x] Copy button works (clipboard contains the full URL)
- [x] "Copied" feedback visible and announced to screen readers
- [x] Page source contains the static fallback (not the live URL) — confirms SSR-safe
- [x] No Vue hydration mismatch warnings appear in dev console
- [x] Curl POST against the copied URL returns 201 with accepted samples
- [x] New client + monitor appears in the dashboard sidebar within ~1 s of the curl POST (via WebSocket broadcast, M1-T9)

## Dependencies

- **Requires:** M2-T1 (dashboard shell layout exists), M1-T6 (ingest endpoint exists)
- **Blocks:** None

## Documentation References

- F3: [Ping data ingest endpoint](../../requirements/features/feature-0003-ping-ingest.md)
- F4: [LNPM client sync service](../../requirements/features/feature-0004-client-sync.md)
- F8: [Web dashboard UI](../../requirements/features/feature-0008-web-dashboard.md)
- M1-T5: [Client identity task](../milestone-01-backend-platform/task-M1-T5-client-identity.md)
- M1-T6: [Ping ingest endpoint task](../milestone-01-backend-platform/task-M1-T6-ping-ingest-endpoint.md)
- M2-T1: [Dashboard shell layout task](./task-M2-T1-dashboard-shell-layout.md)
