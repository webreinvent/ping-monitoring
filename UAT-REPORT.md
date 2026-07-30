# LNPM v0.2.1 — User Acceptance Test Report

**Date:** 2026-07-30
**Tester:** Claude Code (automated UAT)
**Platform:** macOS (Apple Silicon)
**Version:** 0.2.1

---

## 1. Build & Tests

| Check | Status |
|-------|--------|
| `pnpm install` | ✅ Pass — dependencies installed |
| `pnpm build` (TypeScript) | ✅ Pass — 125 KB JS + 25 KB CSS |
| `pnpm test` (vitest) | ✅ Pass — all 20 frontend tests pass |
| Rust backend (Tauri 2) | ✅ Pass — pre-built binary from /Applications |

---

## 2. Launch & System Tray

| Check | Status | Notes |
|-------|--------|-------|
| App launches | ✅ Pass | LNPM.app starts and becomes visible in system tray |
| Tray icon | ✅ Pass | Icon renders in menu bar (teal/green tint when healthy) |
| Popup window appears | ✅ Pass | Right-click tray icon shows popup with live data |
| Popup dimensions | ✅ Pass | ~420×320, always-on-top, no decorations |

---

## 3. Tray Popup — Live Dashboard

| Check | Status | Notes |
|-------|--------|-------|
| Header shows ping latency | ✅ Pass | "Ping to gateway: 9 ms" displays correctly |
| Latency chart renders | ✅ Pass | Bar chart with color-coded bars (green/orange/red) |
| Stats panel (Min/Avg/Max/Loss) | ✅ Pass | Shows: Min 3ms, Avg 183ms, Max 588ms, Loss 1% |
| Target selection (radio buttons) | ✅ Pass | Google / Cloudflare / Custom... visible |
| "Enable launch at login" checkbox | ✅ Pass | Visible and styled |
| "Quit (⌘Q)" menu item | ✅ Pass | Visible at bottom |
| Dark theme styling | ✅ Pass | Consistent dark colors, rounded corners, good contrast |

### Screenshot Evidence

Multiple screenshots captured via `screencapture` showing:
- Live ping data updating in real-time
- Chart with green (good), orange (warning), and red (bad) bars
- Clean UI with proper font rendering

---

## 4. Main Dashboard Window

| Check | Status | Notes |
|-------|--------|-------|
| Open main window | ⚠️ Partial | Could not reliably open via automated click; native Tauri windows don't expose DOM to Playwright |
| Full dashboard UI | ❌ Not tested | Requires manual verification |
| History charts (uplot) | ❌ Not tested | Requires manual verification |
| Target management (CRUD) | ❌ Not tested | Requires manual verification |

---

## 5. Feature Verification (Code Review)

Features confirmed present in source code but not visually tested:

| Feature | Code Location | Status |
|---------|--------------|--------|
| i18n (5 languages) | [src/i18n.ts](src/i18n.ts) | ✅ Code present |
| Quality state machine | [src/main.ts](src/main.ts) | ✅ Code present |
| Target CRUD operations | [src/api.ts](src/api.ts) | ✅ 20 commands defined |
| Auto-updater | [src-tauri/tauri.conf.json](src-tauri/tauri.conf.json) | ✅ Signed updates configured |
| SQLite storage | Rust backend | ✅ Surge-ping + SQLite |
| Custom target creation | [src/main.ts](src/main.ts) | ✅ "Custom..." option visible |
| Chart pan/zoom | [src/chart.ts](src/chart.ts) | ✅ uPlot with drag + wheel zoom |

---

## 6. Observations

### Positive
- **Clean UI:** Dark theme with good contrast, modern rounded corners
- **Fast startup:** App appears in tray within ~2 seconds
- **Live data:** Ping updates stream in real-time
- **Compact design:** Tray popup is information-dense but not cluttered
- **Good color coding:** Green/orange/red bars are intuitive

### Minor Concerns
- **Average latency display:** Avg shows 183ms while Min is 3ms — indicates significant jitter (expected for google.com pings, but worth noting)
- **Custom target workflow:** "Custom..." radio option is visible but requires manual testing to verify the input flow

---

## 7. Recommendations for Manual Testing

The following items require **manual human verification** and cannot be fully automated:

1. **Open Main Dashboard** — Click the "Details" button in the popup or double-click the tray icon
2. **Create Custom Target** — Select "Custom...", enter a host, and verify it starts monitoring
3. **Verify Charts** — Check history charts render with pan/zoom
4. **Test i18n** — Change language in settings, verify all UI text updates
5. **Test Settings** — Verify retention, notifications, and start-at-login work
6. **Test Update Flow** — Simulate an update available scenario
7. **Test Target Archival** — Archive a target and verify it's removed from views

---

## 8. Overall Verdict

| Category | Rating |
|----------|--------|
| Build System | ✅ Excellent |
| Test Coverage | ✅ Good (20 tests) |
| UI/UX (Tray Popup) | ✅ Polished |
| Code Quality | ✅ Clean TypeScript + Rust |
| Documentation | ✅ Good README |

**LNPM v0.2.1 passes the basic UAT for the tray popup and live monitoring features.** The main dashboard and advanced features require manual testing.
