# Task M3-T2 — Fix Tauri client slug generation to prevent duplicate registrations

> **Milestone:** M3 (Tauri Client Enhancement)
> **Priority:** High
> **Status:** ⚪ Not Started
> **Estimated Effort:** 2-3 hours

## Description

The Tauri desktop client's `ClientIdentity::discover()` in `src-tauri/src/sync.rs` generates a client slug using only the **last 5 characters** of the MAC address, while the dashboard's `generateSlug()` in `dashboard/server/utils/client.ts` uses the **last 10 hex characters** of the MAC address. This mismatch means the Tauri client's slug is less collision-resistant than the dashboard's canonical slug format. While the client-sent slug is authoritative (the dashboard stores it as-is), the 5-char suffix increases the risk of slug collisions between different clients on the same network — and if the MAC, username, or hostname changes, a new client record is created, resulting in duplicate registrations.

Fix: Align the Tauri slug generation with the dashboard's `generateSlug` logic — strip non-hex characters from the MAC, take the last 10 hex characters, and build `username-hostname-macSuffix`.

## Task Goals

- Update `ClientIdentity::discover()` to use last 10 hex characters of MAC (matching dashboard)
- Add non-alphanumeric → hyphen replacement and hyphen collapsing (matching dashboard)
- Update the existing unit test `client_identity_discovery` to reflect the new slug format
- Add a regression test that verifies slug stability (same identity → same slug across calls)
- Verify that existing clients in the database (with 5-char slugs) are handled gracefully (the dashboard's `upsertClient` will upsert on the new 10-char slug, creating a new client row — document this migration path)

## Implementation Plan

> ⚠️ Analyze this plan thoroughly before implementing. Invoke relevant skills and MCP servers as needed.

### Pre-Implementation Analysis

- Read `src-tauri/src/sync.rs` — `ClientIdentity::discover()` (lines 143-187)
- Read `dashboard/server/utils/client.ts` — `generateSlug()` function for the canonical algorithm
- Review the existing test `client_identity_discovery` in `sync.rs` to understand what's asserted
- Check if any other code depends on the 5-char slug format (grep for `take(5)` or `rev().take(5)` in the codebase)

### Steps

1. **Update slug generation** — In `src-tauri/src/sync.rs`, `ClientIdentity::discover()`:
   ```rust
   // OLD:
   mac.chars().rev().take(5).collect::<String>().chars().rev().collect::<String>()
   
   // NEW:
   mac.replace(|c: char| !c.is_ascii_hexdigit(), "").chars().rev().take(10).collect::<String>().chars().rev().collect::<String>()
   ```
   This strips colons/non-hex chars from the MAC, takes the last 10 hex chars, matching the dashboard's `generateSlug`.

2. **Add slug normalization** — After building the raw slug, apply the same normalization the dashboard does:
   - Replace non-alphanumeric characters with hyphens: `slug.replace(|c: char| !c.is_ascii_alphanumeric(), "-")`
   - Collapse consecutive hyphens: `slug.replace("--", "-")` (repeat until stable)
   - Trim leading/trailing hyphens: `slug.trim_matches('-')`
   
   This ensures the slug is URL-safe and matches the dashboard's format exactly.

3. **Update unit test** — In `client_identity_discovery` test in `sync.rs`:
   - Assert that the slug contains the last 10 hex chars of the MAC (not 5)
   - Assert that the slug is URL-safe (no colons, no non-alphanumeric except hyphens)
   - Add a case where the MAC has colons (e.g., `aa:bb:cc:dd:ee:ff` → slug should end with `ddffeeff` or similar 10-hex suffix)

4. **Add regression test** — Add a test that calls `ClientIdentity::discover()` twice (or simulates the same input) and asserts the slug is identical.

5. **Document migration path** — Add a note in the task (or a code comment) that existing clients with 5-char slugs will appear as new clients when the 10-char slug is sent. The dashboard's `upsertClient` will create a new row with the 10-char slug. Operators can manually merge or delete the old 5-char client rows. This is a one-time data migration, not a code migration.

### Skills & MCP Servers

| Resource | Purpose | When to Invoke |
|---|---|---|
| `sequential-thinking` | Step decomposition | Slug algorithm alignment |
| `filesystem` (MCP) | File creation / modification | Reading/writing `src-tauri/src/sync.rs` |

## Acceptance Criteria

- [ ] `ClientIdentity::discover()` uses last 10 hex characters of MAC address
- [ ] Slug is URL-safe (no colons, no non-alphanumeric except hyphens)
- [ ] Slug format matches `dashboard/server/utils/client.ts` `generateSlug` exactly
- [ ] Unit test `client_identity_discovery` passes with the new 10-char slug format
- [ ] New regression test confirms slug stability (same input → same output)
- [ ] `cargo test` passes with no failures
- [ ] No other code in the codebase references the old 5-char slug format

## Completion Criteria

- [ ] All acceptance criteria above pass
- [ ] `cargo test` passes with no errors
- [ ] `cargo fmt --check` passes (no formatting issues)
- [ ] `cargo clippy` passes with no new warnings
- [ ] Manual verification: run Tauri app, check that the slug sent in the ingest payload matches the dashboard's expected format

## Testing Checklist

- [ ] Unit test: slug contains last 10 hex chars of MAC (not 5)
- [ ] Unit test: slug is URL-safe (no colons, no special chars)
- [ ] Unit test: slug matches dashboard `generateSlug` for known inputs (e.g., `alice`, `desktop`, `aa:00:bb:11:cc:22` → `alice-desktop-11cc22` or similar)
- [ ] Unit test: slug is stable across multiple calls (idempotent)
- [ ] Unit test: MAC fallback (timestamp-based) still works when MAC is unavailable
- [ ] Integration test: ingest payload sent by Tauri is accepted by dashboard without 401 errors

## Sub Tasks

| SubTask ID | Title | Status | Test Required | Priority |
|---|---|---|---|---|
| M3-T2-01 | Update slug to use last 10 hex chars | ⚪ Not Started | ✅ Yes | High |
| M3-T2-02 | Add slug normalization (hyphens, trim) | ⚪ Not Started | ✅ Yes | High |
| M3-T2-03 | Update existing unit test | ⚪ Not Started | ✅ Yes | High |
| M3-T2-04 | Add regression test (slug stability) | ⚪ Not Started | ✅ Yes | Medium |
| M3-T2-05 | Document migration path for existing clients | ⚪ Not Started | ❌ No | Low |

## Dependencies

- **Requires:** None (dashboard `generateSlug` is the reference — already implemented in M1)
- **Blocks:** None

## Documentation References

- `src-tauri/src/sync.rs` — `ClientIdentity::discover()` (to modify)
- `dashboard/server/utils/client.ts` — `generateSlug()` (canonical reference)
- `requirements/features/feature-0002-client-identity.md` — F2 slug generation rules
- `requirements/data-models/data-models.md` — clients table schema
- `docs/tauri/sync-service.md` — Tauri sync service documentation

## Notes

- **Migration impact:** Existing clients in the dashboard database have 5-char slugs. When the Tauri app sends the new 10-char slug, the dashboard will treat it as a new client (401 → upsert with identity fields). This creates a duplicate client row. Operators should manually merge or delete the old 5-char rows. This is a one-time, manual data migration.
- **MAC fallback:** If `mac_address::get_mac_address()` returns `None`, the fallback uses a timestamp-based hex value. This path is unchanged — the 10-hex-char truncation still applies to the fallback value.
- **Cross-platform:** The slug format is the same on macOS, Linux, and Windows. The `whoami` crate provides username/hostname; `mac_address` crate provides MAC (best-effort).
