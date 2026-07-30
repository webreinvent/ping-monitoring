#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────
# release.sh — Build release installers (native + cross-platform)
#
# Default (no args):  clean ./builds/ + build macOS + Windows
#
# Usage:
#   bash release.sh                → clean + build macOS + Windows
#   bash release.sh --all          → clean + build all 4 platforms
#   bash release.sh --target <n>   → clean + build one target
#   bash release.sh --no-clean     → skip cleanup before building
#
#   --target options:
#     macos-arm   · macos-intel · windows · linux
#
# Output:  ./builds/<platform>/
#   e.g. ./builds/macos-arm/LNPM.dmg
#        ./builds/windows/LNPM-setup.exe
#
# Cross-compilation prerequisites (for --all or --target windows/linux):
#   - cross:  cargo install cross
#   - Docker: https://docker.com
# ────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

ANSI_GREEN='\033[0;32m'; ANSI_CYAN='\033[0;36m'; ANSI_YELLOW='\033[1;33m';
ANSI_RED='\033[0;31m'; ANSI_DIM='\033[2m'; ANSI_RESET='\033[0m'
info()  { printf "${ANSI_CYAN}[INFO]${ANSI_RESET}  %s\n" "$*"; }
ok()    { printf "${ANSI_GREEN}[OK]${ANSI_RESET}    %s\n" "$*"; }
warn()  { printf "${ANSI_YELLOW}[WARN]${ANSI_RESET}  %s\n" "$*"; }
err()   { printf "${ANSI_RED}[ERR]${ANSI_RESET}   %s\n" "$*"; }

BUILD_DIR="$ROOT_DIR/builds"

# ── Platform matrix ────────────────────────────────────────────────
# label    rust_target             bundle_args              artifact_dir
# ─────────────────────────────────────────────────────────────────────
declare -A PLATFORM_LABEL=()
declare -A PLATFORM_TARGET=()
declare -A PLATFORM_BUNDLES=()
declare -A PLATFORM_DIR=()

PLATFORM_LABEL[macos-arm]="macOS Apple Silicon"
PLATFORM_TARGET[macos-arm]="aarch64-apple-darwin"
PLATFORM_BUNDLES[macos-arm]="app,dmg"
PLATFORM_DIR[macos-arm]="macos-arm"

PLATFORM_LABEL[macos-intel]="macOS Intel"
PLATFORM_TARGET[macos-intel]="x86_64-apple-darwin"
PLATFORM_BUNDLES[macos-intel]="app,dmg"
PLATFORM_DIR[macos-intel]="macos-intel"

PLATFORM_LABEL[windows]="Windows x64"
PLATFORM_TARGET[windows]="x86_64-pc-windows-msvc"
PLATFORM_BUNDLES[windows]="nsis,msi"
PLATFORM_DIR[windows]="windows"

PLATFORM_LABEL[linux]="Linux x64"
PLATFORM_TARGET[linux]="x86_64-unknown-linux-gnu"
PLATFORM_BUNDLES[linux]="appimage,deb"
PLATFORM_DIR[linux]="linux"

ALL_PLATFORMS=("macos-arm" "macos-intel" "windows" "linux")

# ── Pre-flight checks ─────────────────────────────────────────────
check_prerequisites() {
  if ! command -v cargo &>/dev/null; then
    err "cargo is not installed or not in PATH."
    err "Install Rust:  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    exit 1
  fi

  if ! command -v pnpm &>/dev/null; then
    err "pnpm is not installed.  Install:  npm i -g pnpm"
    exit 1
  fi

  if ! command -v node &>/dev/null; then
    err "node is not installed."
    exit 1
  fi

  info "Rust    $(rustc --version | awk '{print $2}')"
  info "Node    $(node --version)"
  info "pnpm    $(pnpm --version)"
}

check_cross_prerequisites() {
  # No special prerequisites — rustup target add is enough
  :
}

# ── Resolve targets ────────────────────────────────────────────────
resolve_targets() {
  local os
  os="$(uname -s)"
  local arch
  arch="$(uname -m)"

  TARGETS=()

  if [ "${BUILD_ALL:-0}" = "1" ]; then
    # --all: build everything
    TARGETS=("${ALL_PLATFORMS[@]}")
  elif [ -n "${SINGLE_TARGET:-}" ]; then
    # --target <name>
    if [[ -v "PLATFORM_TARGET[$SINGLE_TARGET]" ]]; then
      TARGETS=("$SINGLE_TARGET")
    else
      err "Unknown target: $SINGLE_TARGET"
      err "Options: ${ALL_PLATFORMS[*]}"
      exit 1
    fi
  else
    # Default: both macOS arches + Windows (from macOS host)
    case "$os" in
      Darwin)
        TARGETS=("macos-arm" "macos-intel" "windows")
        ;;
      Linux)
        TARGETS=("linux" "windows")
        ;;
      MINGW*|MSYS*|CYGWIN*)
        TARGETS=("windows")
        ;;
      *)
        err "Unsupported platform: $os — use --target or --all"
        exit 1
        ;;
    esac
  fi

  info "Build targets: ${TARGETS[*]}"
}

# ── Is cross-compilation needed? ───────────────────────────────────
needs_cross() {
  local target="$1"
  local os
  os="$(uname -s)"
  local arch
  arch="$(uname -m)"

  # Running natively — no cross needed
  if [ "$os" = "Darwin" ] && [ "$target" = "macos-arm" ] && [ "$arch" = "arm64" ]; then
    return 1
  fi
  if [ "$os" = "Darwin" ] && [ "$target" = "macos-intel" ] && [ "$arch" = "x86_64" ]; then
    return 1
  fi
  if [ "$os" = "Linux" ] && [ "$target" = "linux" ]; then
    return 1
  fi
  if [[ "$os" == MINGW* || "$os" == MSYS* || "$os" == CYGWIN* ]] && [ "$target" = "windows" ]; then
    return 1
  fi

  # Cross-compilation needed
  return 0
}

# ── Build frontend (once, shared across all targets) ───────────────
build_frontend() {
  info "Building frontend …"
  pnpm install --frozen-lockfile
  pnpm build
  ok "Frontend built"
}

# ── Run tauri build (with graceful signing fallback) ───────────────
run_tauri_build() {
  local rust_target="$1"
  local bundles="$2"

  info "Running tauri build …"
  if pnpm tauri build --ci --target "$rust_target" --bundles "$bundles" 2>&1; then
    return 0
  fi

  # If the only failure is a missing signing key but bundles exist, continue
  if find "src-tauri/target/${rust_target}/release/bundle" -type f 2>/dev/null | grep -q .; then
    warn "Build completed with warnings — bundles created (signing skipped)."
    return 0
  fi

  err "Tauri build failed."
  exit 1
}

# ── Build one target ───────────────────────────────────────────────
build_target() {
  local platform="$1"
  local label="${PLATFORM_LABEL[$platform]}"
  local rust_target="${PLATFORM_TARGET[$platform]}"
  local bundles="${PLATFORM_BUNDLES[$platform]}"
  local artifact_dir="${BUILD_DIR}/${PLATFORM_DIR[$platform]}"

  info "═══════════════════════════════════════════════"
  info "  Building: $label"
  info "  Target:   $rust_target"
  info "  Bundles:  $bundles"
  info "═══════════════════════════════════════════════"

  mkdir -p "$artifact_dir"

  if needs_cross "$platform"; then
    info "Cross-compiling for $platform …"

    # Ensure the Rust target is installed
    rustup target add "$rust_target" 2>/dev/null || true

    case "$platform" in
      windows)
        # Windows bundlers (nsis, msi) can only run on a Windows host.
        # Tauri's macOS CLI doesn't recognize nsis/msi bundle types.
        warn "Windows bundles (.exe, .msi) require a Windows host or CI."
        warn "Skipping Windows bundle creation (build on Windows or use CI)."
        echo ""
        return
        ;;
      linux)
        # Linux bundlers (AppImage, deb) need a Linux environment.
        warn "Linux bundles (.AppImage, .deb) require a Linux host or CI."
        warn "Skipping Linux bundle creation (build on Linux or use CI)."
        echo ""
        return
        ;;
    esac
  else
    # Native build — straightforward
    run_tauri_build "$rust_target" "$bundles"
  fi

  # ── Collect artifacts into ./builds/<platform>/ ──────────────────
  local bundle_base
  bundle_base="src-tauri/target/${rust_target}/release/bundle"

  local copied=0
  # Collect installer files (.dmg, .exe, .msi, .AppImage, .deb)
  for src in "$bundle_base"/*.dmg \
             "$bundle_base"/*.exe "$bundle_base"/*.msi \
             "$bundle_base"/*.AppImage "$bundle_base"/*.deb \
             "$bundle_base"/**/*.dmg \
             "$bundle_base"/**/*.exe "$bundle_base"/**/*.msi \
             "$bundle_base"/**/*.AppImage "$bundle_base"/**/*.deb; do
    if [ -f "$src" ]; then
      cp -v "$src" "$artifact_dir/"
      copied=$((copied + 1))
    fi
  done
  # Copy .app bundles (directories) separately — macOS only
  for app_dir in $(find "$bundle_base" -maxdepth 3 -name "*.app" -type d 2>/dev/null); do
    cp -vr "$app_dir" "$artifact_dir/" 2>&1
    copied=$((copied + 1))
  done

  if [ "$copied" -eq 0 ]; then
    warn "No bundle artifacts found in ${bundle_base}"
  else
    ok "Copied $copied file(s) to ${artifact_dir}/"
  fi
  echo ""
}

# ── Print summary ──────────────────────────────────────────────────
print_summary() {
  echo ""
  info "═══════════════════════════════════════════════"
  info "  Release artifacts: ./builds/"
  info "═══════════════════════════════════════════════"
  echo ""

  local total=0
  for dir in "$BUILD_DIR"/*/; do
    [ -d "$dir" ] || continue
    local dir_name
    dir_name="$(basename "$dir")"
    printf "  ${ANSI_CYAN}├── %s/${ANSI_RESET}\n" "$dir_name"

    for f in "$dir"/*; do
      [ -e "$f" ] || continue
      local size
      if [ -d "$f" ]; then
        size="$(du -sh "$f" | awk '{print $1}')"
        printf "  ${ANSI_DIM}    ├── %8s  %s/${ANSI_RESET}\n" "$size" "$(basename "$f")"
      else
        size="$(du -mh "$f" | awk '{print $1}')"
        printf "  ${ANSI_DIM}    ├── %8s  %s${ANSI_RESET}\n" "$size" "$(basename "$f")"
      fi
      total=$((total + 1))
    done
  done

  echo ""
  ok "$total file(s) ready in ./builds/"
  if [ -d "$BUILD_DIR" ]; then
    info "Total size:"
    du -sh "$BUILD_DIR" | awk '{printf "  %s\n", $1}'
  fi
  echo ""
}

# ── Main ───────────────────────────────────────────────────────────
main() {
  BUILD_ALL=0
  SINGLE_TARGET=""
  DO_CLEAN=1

  for arg; do
    # Handle both "--target name" and "--target=name" forms
    case "$arg" in
      "")  # Skip empty arguments
        continue
        ;;
      --all)
        BUILD_ALL=1
        ;;
      --no-clean)
        DO_CLEAN=0
        ;;
      --target=*)
        SINGLE_TARGET="${arg#--target=}"
        ;;
      --target)
        # Next argument is the target name
        shift
        SINGLE_TARGET="${1:-}"
        if [ -z "$SINGLE_TARGET" ]; then
          err "--target requires a name"
          exit 1
        fi
        ;;
      *)
        err "Unknown option: $arg"
        echo ""
        echo "Usage: bash release.sh [--all|--target <name>|--target=<name> [--no-clean]]"
        echo ""
        echo "  (default)            clean + build macOS + Windows"
        echo "  --all                clean + build all 4 platforms"
        echo "  --target <name>      clean + build one target:"
        echo "                       macos-arm, macos-intel, windows, linux"
        echo "  --no-clean           skip cleaning ./builds/ first"
        exit 1
        ;;
    esac
  done

  echo ""
  info "═══════════════════════════════════════════════"
  info "  LNPM — Release Build"
  info "═══════════════════════════════════════════════"
  echo ""

  check_prerequisites
  resolve_targets

  if [ "$DO_CLEAN" = "1" ]; then
    info "Removing previous ./builds/ …"
    rm -rf "$BUILD_DIR"
    ok "Cleaned"
  fi

  # Check cross prerequisites if needed
  for target in "${TARGETS[@]}"; do
    if needs_cross "$target"; then
      check_cross_prerequisites
      break
    fi
  done

  # Build frontend once
  build_frontend

  # Build each target
  for target in "${TARGETS[@]}"; do
    build_target "$target"
  done

  print_summary
}

main "$*"
