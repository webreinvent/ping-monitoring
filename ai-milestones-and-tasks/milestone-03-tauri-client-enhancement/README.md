# Milestone M3 — Tauri Client Enhancement

> **Category:** Client Enhancement
> **Priority:** High
> **Status:** ⚪ Not Started
> **Estimated Effort:** 6-9 days
> **Dependencies:** None (M1, M2 complete)

## Objective

Align the Tauri desktop client's visual and behavioral fidelity with the LNPM Cloud Dashboard, and fix client identity generation to prevent duplicate registrations. This milestone ensures the desktop app feels like a first-class client of the cloud dashboard — the charts look the same, the data flows consistently, and the client identity is stable and collision-resistant.

## Success Criteria

- [ ] Tauri `LatencyChart` uses the same 12-color palette, line style, threshold colors, and quality-band rendering as the dashboard's `LatencyChart.vue`
- [ ] Tauri chart line width, font, padding, cursor, and Y-axis configuration match the dashboard
- [ ] Tauri chart no longer renders bar mode; all views use line-only rendering
- [ ] Tauri quality interval bands are rendered as background fills (matching dashboard `drawClear` behavior)
- [ ] Tauri client slug uses last 10 hex characters of MAC address (matching dashboard `generateSlug`)
- [ ] Unit test `client_identity_discovery` in `sync.rs` passes with the new 10-char slug format
- [ ] `cargo test` passes with no failures
- [ ] Visual side-by-side comparison of Tauri and dashboard charts confirms matching appearance

## Tasks

- M3-T1 — Match Tauri chart with dashboard chart
- M3-T2 — Fix Tauri client slug generation to prevent duplicate registrations

## Dependencies

- **Blocks:** None
- **Requires:** M1 (Backend Platform — complete), M2 (Dashboard UI — complete)
