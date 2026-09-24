# LNPM Tech Stack

## Root (Tauri Desktop Client)

| Tech | Version | Role | Docs |
|---|---|---|---|
| Tauri | ^2.11 | Desktop shell, IPC, events, updater | https://v2.tauri.app/ |
| Rust | 1.85+ (edition 2024) | Backend: ping, DB, sync, monitor loop | https://doc.rust-lang.org/ |
| tokio | ^1.52 | Async runtime (macros, net, process, sync, time) | https://docs.rs/tokio |
| rusqlite | ^0.37 | Local SQLite (bundled, backup features) | https://docs.rs/rusqlite |
| reqwest | ^0.12 | HTTP client (rustls-tls, json) — sync to dashboard | https://docs.rs/reqwest |
| serde / serde_json | ^1 | Serialization (camelCase wire format) | https://serde.rs/ |
| thiserror | ^2 | Error enums (MonitorError, StorageError, CommandError) | https://docs.rs/thiserror |
| tauri-plugin-updater | ^2 | Auto-update (minisign pubkey, GitHub releases) | https://v2.tauri.app/plugin/updater |
| tauri-plugin-notification | ^2 | Native notifications (batched 2.5s) | https://v2.tauri.app/plugin/notification |
| tauri-plugin-single-instance | ^2 | Prevent duplicate app instances | https://v2.tauri.app/plugin/single-instance |
| tauri-plugin-autostart | ^2.5 | Launch on login | https://v2.tauri.app/plugin/autostart |
| mac_address | ^1 | MAC address for client identity (slug generation) | https://docs.rs/mac_address |
| whoami | ^1 | Username for client identity | https://docs.rs/whoami |
| parking_lot | ^0.12 | Mutex (faster than std) | https://docs.rs/parking_lot |
| semver | ^1 | Version comparison (updater) | https://docs.rs/semver |
| regex | ^1 | Ping stdout parsing | https://docs.rs/regex |
| uuid | ^1 | UUID generation (v4, serde) | https://docs.rs/uuid |
| directories | ^6 | Platform data dir (lnpm.sqlite3 location) | https://docs.rs/directories |
| async-trait | ^0.1 | Trait objects for MonitorEventSink | https://docs.rs/async-trait |

## Root Frontend (TypeScript)

| Tech | Version | Role | Docs |
|---|---|---|---|
| TypeScript | ~5.6.2 | Static typing | https://www.typescriptlang.org/ |
| Vite | ^6.0.3 | Build tool (dev port 1420) | https://vitejs.dev/ |
| uPlot | ^1.6.32 | Lightweight canvas charts | https://uplot.org/ |
| @tauri-apps/api | ^2 | IPC bridge (invoke, listen) | https://tauri.app/develop/react/ |
| @tauri-apps/plugin-opener | ^2 | Open external URLs | https://v2.tauri.app/plugin/opener |
| Vitest | ^4.1.10 | Unit tests (colocated *.test.ts) | https://vitest.dev/ |

## Dashboard

| Tech | Version | Role | Docs |
|---|---|---|---|
| Nuxt | ^4.1.0 | Meta-framework (app/ dir, node-server preset) | https://nuxt.com/docs |
| Vue | ^3.5.0 | UI framework (Composition API) | https://vuejs.org/api/ |
| vue-router | ^5.2.0 | Client-side routing | https://router.vuejs.org/ |
| better-sqlite3 | ^11.10.0 | SQLite (WAL mode, sync API) | https://github.com/WiseLibs/better-sqlite3 |
| ws | ^8.18.0 | WebSocket server (Nitro native handler) | https://github.com/websockets/ws |
| uPlot | ^1.6.32 | Charts (Qual plugin for bands, Point for thresholds) | https://uplot.org/ |
| @nuxt/nitro-server | ^4.5.1 | Nitro node-server preset | https://nitro.unjs.io/ |
| Vitest | ^4.1.10 | Unit/integration tests (pool: forks, setupFiles) | https://vitest.dev/ |
| @vitest/coverage-v8 | ^4.1.10 | Coverage | https://vitest.dev/ |
| Playwright | ^1.62.1 | E2E tests (chromium, workers 1, baseURL :3000) | https://playwright.dev/ |
| vue-tsc | ^3.3.9 | Type checking (nuxt typecheck) | https://github.com/vuejs/language-tools |
| TypeScript | ^5.7.0 | Static typing (strict mode) | https://www.typescriptlang.org/ |

## Commands Quick Reference

### Dashboard
```bash
cd dashboard
pnpm dev            # Nuxt dev server, port 3000
pnpm build          # nuxt build
pnpm test           # vitest run
pnpm test:watch     # vitest watch
pnpm test:e2e       # playwright test (auto-starts dev server)
pnpm typecheck      # nuxt typecheck
```

### Root (Tauri)
```bash
pnpm dev            # vite dev, port 1420
pnpm build          # tsc && vite build
pnpm test           # vitest run
pnpm tauri          # tauri CLI (build, dev, etc.)
```

### Rust
```bash
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --locked --all-targets --all-features -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml --locked
```

### CI (.github/workflows/ci.yml)
- Matrix: windows, macos, ubuntu-24.04
- pnpm 11.9.0, Node 22, Rust stable
- Steps: `pnpm install --frozen-lockfile` → `pnpm build` → `pnpm test` → `cargo fmt --check` → `cargo test --locked` → `cargo clippy -D warnings`

## Key Gotchas

- **better-sqlite3 in vitest:** native module segfaults in forked workers. Dashboard vitest uses `pool: 'forks'` + `setupFiles: './test/setup.ts'` which mocks it. Root vitest does not use better-sqlite3.
- **Nuxt type-only imports:** `dashboard/shared/types.ts` exports types that are NOT auto-imported by Nuxt. Always import explicitly: `import type { ... } from "#shared/types"`.
- **Nitro WS handler location:** `server/routes/ws/ping.ts` (not `server/api/`). Enabled via `nitro.experimental.websocket: true` in `nuxt.config.ts`.
- **Circular dep workaround:** API routes call WS broadcast via dynamic `import("#server/routes/ws/ping")`.
- **Tauri CSP:** `tauri.conf.json` sets `default-src 'self'; connect-src 'self' ipc: http://ipc.localhost` — no external HTTP from the webview.
- **mac_address contract exception:** `sync.rs` payload uses snake_case `mac_address` (not `macAddress`) to match the dashboard ingest contract. All other fields are camelCase.
