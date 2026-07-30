#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────
# LNPM — Local Development Launcher
# Kills any stale processes on port 1420 and any running LNPM
# (Tauri) instances, then starts `pnpm tauri dev`.
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

# ── Kill processes on port 1420 (Vite dev server) ──────────────────
kill_vite() {
  # SIGTERM first
  local pids
  pids=$(lsof -ti :1420 2>/dev/null || true)
  if [ -n "$pids" ]; then
    for pid in $pids; do
      kill "$pid" 2>/dev/null || true
    done
    info "Sent SIGTERM to processes on port 1420 (PID: $(echo $pids | tr '\n' ' '))"
  fi

  # Wait up to 3 seconds for port to free
  local i=0
  while [ $i -lt 6 ]; do
    pids=$(lsof -ti :1420 2>/dev/null || true)
    [ -z "$pids" ] && break
    sleep 0.5
    i=$((i + 1))
  done

  # SIGKILL survivors
  pids=$(lsof -ti :1420 2>/dev/null || true)
  if [ -n "$pids" ]; then
    for pid in $pids; do
      kill -9 "$pid" 2>/dev/null || true
    done
    info "Sent SIGKILL to survivors on port 1420 (PID: $(echo $pids | tr '\n' ' '))"
    sleep 1
  fi

  # Final check
  pids=$(lsof -ti :1420 2>/dev/null || true)
  if [ -n "$pids" ]; then
    warn "Port 1420 still in use after SIGKILL (PID: $(echo $pids | tr '\n' ' '))"
  else
    ok "Port 1420 is free"
  fi
}

# ── Kill existing LNPM (Tauri) instances ───────────────────────────
kill_lnpm() {
  # macOS: kill by process name (the Rust binary)
  local pids
  pids=$(pgrep -f "target/lnpm" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    for pid in $pids; do
      kill "$pid" 2>/dev/null || true
    done
    sleep 1
    pids=$(pgrep -f "target/lnpm" 2>/dev/null || true)
    for pid in $pids; do
      kill -9 "$pid" 2>/dev/null || true
    done
    info "Killed existing LNPM instances"
  fi
}

# ── Stop everything ────────────────────────────────────────────────
stop_services() {
  warn "Shutting down dev services …"
  kill_vite
  kill_lnpm
  ok "All dev processes stopped."
}

# ── Status ─────────────────────────────────────────────────────────
check_status() {
  echo ""
  info "Checking dev environment …"
  echo ""

  # Port 1420
  if lsof -ti :1420 &>/dev/null; then
    local pids
    pids=$(lsof -ti :1420 2>/dev/null)
    printf "  ${GREEN}[OK]${NC}  Vite dev server  →  port 1420 (PID%s)\n" "$pids"
  else
    printf "  ${DIM}[—]${NC}  Vite dev server  →  not running\n"
  fi

  # LNPM processes
  if pgrep -f "target/lnpm" &>/dev/null; then
    local pids
    pids=$(pgrep -f "target/lnpm" 2>/dev/null)
    printf "  ${GREEN}[OK]${NC}  LNPM (Tauri)     →  running (PID%s)\n" "$pids"
  else
    printf "  ${DIM}[—]${NC}  LNPM (Tauri)     →  not running\n"
  fi

  echo ""
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
  kill_lnpm
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

  # Start dev
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
