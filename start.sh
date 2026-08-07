#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────
# LNPM — Local Development Launcher
# Kills any stale processes on port 1420 (Vite/Tauri) and port 3000
# (Nuxt dashboard), then starts BOTH:
#   1. `pnpm tauri dev`   → Rust desktop binary + Vite frontend on :1420
#   2. `pnpm --filter lnpm-dashboard dev` → Nuxt dashboard on :3000
#
# Usage:
#   bash start.sh            → stop stale processes + start dev
#   bash start.sh --stop     → stop all dev processes
#   bash start.sh --status   → check what's running
# ────────────────────────────────────────────────────────────────────
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

# ANSI colours
GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; DIM='\033[2m'; NC='\033[0m'
info()  { printf "${CYAN}[INFO]${NC}  %s\n" "$*"; }
ok()    { printf "${GREEN}[OK]${NC}    %s\n" "$*"; }
warn()  { printf "${YELLOW}[WARN]${NC}  %s\n" "$*"; }
err()   { printf "${RED}[ERR]${NC}   %s\n" "$*"; }

# ── Kill processes on a given port (SIGTERM, then SIGKILL) ─────────
kill_port() {
  local port="$1"
  local label="$2"
  local pids
  pids=$(lsof -ti :"$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    for pid in $pids; do
      kill "$pid" 2>/dev/null || true
    done
    info "Sent SIGTERM to $label on :$port (PID: $(echo $pids | tr '\n' ' '))"
  fi

  # Wait up to 3 seconds for port to free
  local i=0
  while [ $i -lt 6 ]; do
    pids=$(lsof -ti :"$port" 2>/dev/null || true)
    [ -z "$pids" ] && break
    sleep 0.5
    i=$((i + 1))
  done

  # SIGKILL survivors
  pids=$(lsof -ti :"$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    for pid in $pids; do
      kill -9 "$pid" 2>/dev/null || true
    done
    info "Sent SIGKILL to $label survivors on :$port (PID: $(echo $pids | tr '\n' ' '))"
    sleep 1
  fi

  pids=$(lsof -ti :"$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    warn "Port $port still in use after SIGKILL (PID: $(echo $pids | tr '\n' ' '))"
  else
    ok "Port $port is free"
  fi
}

# Aliases preserved for clarity in kill_vite / kill_dashboard callers
kill_vite()     { kill_port 1420 "Vite dev server"; }
kill_dashboard() { kill_port 3000 "Nuxt dashboard"; }

# ── Kill existing LNPM (Tauri) instances ───────────────────────────
kill_lnpm() {
  # macOS: kill by process name (the Rust binary). The actual command line
  # is `target/debug/lnpm` (or `target/release/lnpm` in release builds), so
  # match `target/<profile>/lnpm` rather than a bare `target/lnpm`.
  local pids
  pids=$(pgrep -f "target/(debug|release)/lnpm" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    for pid in $pids; do
      kill "$pid" 2>/dev/null || true
    done
    sleep 1
    pids=$(pgrep -f "target/(debug|release)/lnpm" 2>/dev/null || true)
    for pid in $pids; do
      kill -9 "$pid" 2>/dev/null || true
    done
    info "Killed existing LNPM instances"
  fi
}

# ── Kill any lingering Nuxt dev server processes ───────────────────
kill_nuxt() {
  # Drain the port first (more reliable than pgrep on the binary path,
  # because pnpm spawns a Node child whose argv rarely contains the
  # "dashboard/node_modules/.bin/nuxt" string verbatim — it usually
  # shows up as "node /…/nuxi.mjs dev" or similar). Anything bound to
  # :3000 is by definition our dashboard.
  local port_pids
  port_pids=$(lsof -ti :3000 2>/dev/null || true)
  if [ -n "$port_pids" ]; then
    for pid in $port_pids; do
      kill "$pid" 2>/dev/null || true
    done
    info "SIGTERM sent to Nuxt dashboard on :3000 (PID: $(echo $port_pids | tr '\n' ' '))"
  fi

  # Also catch any pnpm wrapper that spawned the dashboard but isn't
  # yet bound to the port (e.g. still resolving deps).
  local pnpm_pids
  pnpm_pids=$(pgrep -f "pnpm .*lnpm-dashboard" 2>/dev/null || true)
  if [ -n "$pnpm_pids" ]; then
    for pid in $pnpm_pids; do
      kill "$pid" 2>/dev/null || true
    done
    info "SIGTERM sent to pnpm wrapper for lnpm-dashboard (PID: $(echo $pnpm_pids | tr '\n' ' '))"
  fi

  # Wait briefly, then SIGKILL survivors
  sleep 1
  port_pids=$(lsof -ti :3000 2>/dev/null || true)
  if [ -n "$port_pids" ]; then
    for pid in $port_pids; do
      kill -9 "$pid" 2>/dev/null || true
    done
    info "SIGKILL sent to dashboard survivors on :3000"
  fi
  pnpm_pids=$(pgrep -f "pnpm .*lnpm-dashboard" 2>/dev/null || true)
  if [ -n "$pnpm_pids" ]; then
    for pid in $pnpm_pids; do
      kill -9 "$pid" 2>/dev/null || true
    done
  fi
}

# ── Stop everything ────────────────────────────────────────────────
stop_services() {
  warn "Shutting down dev services …"
  kill_vite
  kill_dashboard
  kill_lnpm
  kill_nuxt
  ok "All dev processes stopped."
}

# ── Status ─────────────────────────────────────────────────────────
check_status() {
  echo ""
  info "Checking dev environment …"
  echo ""

  # Port 1420 — Vite / Tauri
  if lsof -ti :1420 &>/dev/null; then
    local pids
    pids=$(lsof -ti :1420 2>/dev/null)
    printf "  ${GREEN}[OK]${NC}  Vite dev server  →  port 1420 (PID%s)\n" "$pids"
  else
    printf "  ${DIM}[—]${NC}  Vite dev server  →  not running\n"
  fi

  # Port 3000 — Nuxt dashboard
  if lsof -ti :3000 &>/dev/null; then
    local pids
    pids=$(lsof -ti :3000 2>/dev/null)
    printf "  ${GREEN}[OK]${NC}  Nuxt dashboard   →  port 3000 (PID%s)\n" "$pids"
  else
    printf "  ${DIM}[—]${NC}  Nuxt dashboard   →  not running\n"
  fi

  # LNPM processes
  if pgrep -f "target/(debug|release)/lnpm" &>/dev/null; then
    local pids
    pids=$(pgrep -f "target/(debug|release)/lnpm" 2>/dev/null)
    printf "  ${GREEN}[OK]${NC}  LNPM (Tauri)     →  running (PID%s)\n" "$pids"
  else
    printf "  ${DIM}[—]${NC}  LNPM (Tauri)     →  not running\n"
  fi

  echo ""
}

# ── Launch the Nuxt dashboard in the background ────────────────────
launch_dashboard() {
  info "Starting Nuxt dashboard on http://localhost:3000/ …"
  local log_file="/tmp/lnpm-dashboard.log"
  local pid_file="/tmp/lnpm-dashboard.pid"
  rm -f "$pid_file" "$log_file"

  # Launch in the *current* shell so $! is our PID (a `()` subshell
  # would fork before & runs, so $! there is the subshell's child of
  # a subshell — by the time the subshell exits the captured PID is
  # already useless). Then `disown` so the job survives the parent
  # shell exit, and redirect all I/O so the launcher doesn't block.
  pnpm --filter lnpm-dashboard dev > "$log_file" 2>&1 < /dev/null &
  local dashboard_pid=$!
  echo "$dashboard_pid" > "$pid_file"
  disown "$dashboard_pid" 2>/dev/null || true

  # Give the pnpm wrapper a moment to fail loudly if it crashes
  sleep 2
  if [ -s "$pid_file" ] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
    ok "Nuxt dashboard launched (PID: $(cat "$pid_file"), logs: $log_file)"
  else
    warn "Nuxt dashboard did not start cleanly. Check: tail -f $log_file"
  fi
}

# ── Ensure dashboard native deps (better-sqlite3) are built ─────────
# The dashboard uses better-sqlite3 as a native module. pnpm hoists
# it under
#   node_modules/.pnpm/better-sqlite3@<v>/node_modules/better-sqlite3/build/Release/better_sqlite3.node
# and the package's `loadBinding` looks in *that* tree exclusively —
# so the binary has to be compiled in exactly that directory, against
# the current Node ABI, or the dashboard crashes with
#   "Could not locate the bindings file" the moment it tries to open
# the database.
#
# pnpm's `rebuild` and npm's `rebuild` from the dashboard root run
# node-gyp inside the package's *source* directory
# (dashboard/node_modules/better-sqlite3), which is a symlink that
# pnpm points at the .pnpm path — but the build artifacts land in a
# sibling location that the bindings loader doesn't search. That's a
# long-standing pnpm quirk.
#
# The reliable fix is to cd into the .pnpm directory directly and run
# `node-gyp rebuild` there. That's what we do, with a fallback to
# `pnpm install` if the .pnpm directory is missing entirely.
ensure_dashboard_dependencies() {
  local dashboard_dir="$ROOT_DIR/dashboard"
  if [ ! -d "$dashboard_dir" ]; then
    return 0
  fi

  # Probe whether better-sqlite3 can be loaded from the dashboard
  # workspace. If it can, the binding is in place and matched to the
  # current Node version — nothing to do.
  if ( cd "$dashboard_dir" && node -e "require('better-sqlite3')" >/dev/null 2>&1 ); then
    return 0
  fi

  warn "better-sqlite3 native binding is missing or built for another Node version."

  # Find the actual package directory inside .pnpm. pnpm's path is
  # stable for a given version: node_modules/.pnpm/<name>@<v>/node_modules/<name>
  local pkg_dir
  pkg_dir=$(find "$ROOT_DIR/node_modules/.pnpm" -maxdepth 4 -type d -name "better-sqlite3" 2>/dev/null | head -1)
  if [ -z "$pkg_dir" ]; then
    info "Package not in pnpm store; running 'pnpm install' inside dashboard/…"
    if ! ( cd "$dashboard_dir" && pnpm install --silent ); then
      err "pnpm install failed in dashboard/. Fix the errors above and retry."
      return 1
    fi
    pkg_dir=$(find "$ROOT_DIR/node_modules/.pnpm" -maxdepth 4 -type d -name "better-sqlite3" 2>/dev/null | head -1)
    if [ -z "$pkg_dir" ]; then
      err "Could not locate better-sqlite3 in pnpm store after install."
      return 1
    fi
  fi

  info "Rebuilding better-sqlite3 inside $pkg_dir (this can take a minute)…"
  # `node-gyp rebuild` from inside the package dir produces the `.node`
  # binary at build/Release/better_sqlite3.node — exactly where the
  # bindings loader looks.
  if ! ( cd "$pkg_dir" && npx --yes node-gyp rebuild >/dev/null 2>&1 ); then
    err "node-gyp rebuild failed. Try manually: cd $pkg_dir && npx node-gyp rebuild"
    return 1
  fi

  # Verify the binding is now loadable
  if ( cd "$dashboard_dir" && node -e "require('better-sqlite3')" >/dev/null 2>&1 ); then
    ok "better-sqlite3 rebuilt successfully"
    return 0
  else
    err "better-sqlite3 still unloadable after rebuild. Investigate with:"
    err "  cd dashboard && node -e \"console.log(require('better-sqlite3'))\""
    return 1
  fi
}

# ── Main ───────────────────────────────────────────────────────────
main() {
  echo ""
  info "═══════════════════════════════════════════════"
  info "  LNPM — Starting dev server…"
  info "═══════════════════════════════════════════════"
  echo ""

  # Kill stale processes
  kill_vite
  kill_dashboard
  kill_lnpm
  kill_nuxt
  sleep 1

  # Ensure cargo is in PATH
  if [ -d "$HOME/.cargo/bin" ] && ! command -v cargo &>/dev/null; then
    export PATH="$HOME/.cargo/bin:$PATH"
    info "Added ~/.cargo/bin to PATH"
  fi

  # Check that cargo is available
  if ! command -v cargo &>/dev/null; then
    err "cargo is not installed or not in PATH."
    err "Install Rust:  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    err "Then add to ~/.zshrc:  export PATH=\"\$HOME/.cargo/bin:\$PATH\""
    exit 1
  fi

  # Make sure the dashboard's native deps (better-sqlite3) are built
  # for the current Node version. If they're not, the dashboard will
  # launch and then crash with "Could not locate the bindings file" —
  # which is invisible to the user unless they read the log.
  if ! ensure_dashboard_dependencies; then
    err "Dashboard dependencies are not ready. Aborting launch."
    exit 1
  fi

  # Start the Nuxt dashboard in the background so the user can hit
  # http://localhost:3000/ alongside the desktop app on :1420.
  launch_dashboard

  # Foreground the Tauri dev process (which itself manages the Vite
  # frontend and the Rust binary). When this returns, the user invoked
  # `bash start.sh --stop`, or hit Ctrl-C.
  cd "$ROOT_DIR"
  pnpm tauri dev "$@"
}

# ── Dispatch ───────────────────────────────────────────────────────
case "${1:---start}" in
  --stop)   stop_services ;;
  --status) check_status ;;
  --start|"")
    main "$@"
    ;;
  *)
    echo "Usage: bash start.sh [--start|--stop|--status]"
    echo ""
    echo "  (default)          → stop stale processes + start dev"
    echo "  --stop             → stop all dev processes"
    echo "  --status           → check what's running"
    exit 1
    ;;
esac
