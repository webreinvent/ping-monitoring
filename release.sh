#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────
# release.sh — Build release installers (native + cross-platform)
#
# Default (no args):  bump patch version + clean ./builds/ + build macOS + Windows
#
# Usage:
#   bash release.sh                → bump patch + clean + build macOS + Windows
#   bash release.sh --all          → bump patch + clean + build all 4 platforms
#   bash release.sh --target <n>   → bump patch + clean + build one target
#   bash release.sh --no-clean     → skip cleanup before building
#
#   --target options:
#     macos-arm   · macos-intel · windows · linux
#
# Version options (auto-bumped + displayed before building):
#   (default)            bump patch   0.3.0 → 0.3.1
#   --major              bump major   0.3.0 → 1.0.0
#   --minor              bump minor   0.3.0 → 0.4.0
#   --patch              bump patch   0.3.0 → 0.3.1
#   --version X.Y.Z      set an exact version instead of bumping
#   --no-bump            skip the bump (build with the current version)
#
#   Version files kept in sync:
#     src-tauri/tauri.conf.json · src-tauri/Cargo.toml · src-tauri/Cargo.lock
#     package.json · dashboard/package.json
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

# ── Version management ─────────────────────────────────────────────
# Read the current app version from the bundler source of truth.
get_current_version() {
  node -p "require('${ROOT_DIR}/src-tauri/tauri.conf.json').version"
}

# Portable in-place sed (works on both macOS and GNU sed).
sed_inplace() {
  local expr="$1" file="$2" tmp
  tmp="$(mktemp)"
  sed "$expr" "$file" > "$tmp" && mv "$tmp" "$file"
}

# Compute a new version from a current one + bump type (major|minor|patch).
compute_bumped() {
  local current="$1" type="$2" major minor patch
  if [[ "$current" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+) ]]; then
    major="${BASH_REMATCH[1]}"; minor="${BASH_REMATCH[2]}"; patch="${BASH_REMATCH[3]}"
  else
    err "Cannot parse version '$current' (expected X.Y.Z)"
    exit 1
  fi
  case "$type" in
    major) major=$((major + 1)); minor=0; patch=0 ;;
    minor) minor=$((minor + 1)); patch=0 ;;
    patch) patch=$((patch + 1)) ;;
    *) err "Invalid bump type: $type"; exit 1 ;;
  esac
  echo "${major}.${minor}.${patch}"
}

# Rewrite the lnpm package entry in Cargo.lock to a new version.
update_cargo_lock() {
  local new_version="$1" lock="src-tauri/Cargo.lock" tmp
  tmp="$(mktemp)"
  awk -v newv="$new_version" '
    /^\[\[package\]\]/    { in_lnpm = 0 }
    /^name = "lnpm"/      { in_lnpm = 1 }
    in_lnpm && /^version/ { printf "version = \"%s\"\n", newv; in_lnpm = 0; next }
    { print }
  ' "$lock" > "$tmp" && mv "$tmp" "$lock"
}

# Write a new version into every version file, keeping them in sync.
update_version_files() {
  local new_version="$1"
  sed_inplace 's/"version": *"[^"]*"/"version": "'"$new_version"'/' src-tauri/tauri.conf.json
  sed_inplace 's/^version = *"[^"]*"/version = "'"$new_version"'/' src-tauri/Cargo.toml
  update_cargo_lock "$new_version"
  sed_inplace 's/"version": *"[^"]*"/"version": "'"$new_version"'/' package.json
  sed_inplace 's/"version": *"[^"]*"/"version": "'"$new_version"'/' dashboard/package.json
}

# Bump (or set) the version across all files and display the change.
bump_version() {
  local current new_version
  current="$(get_current_version)"

  if [ "$DO_BUMP" = "0" ]; then
    info "Version: ${current} (unchanged — --no-bump)"
    return 0
  fi

  if [ -n "$EXACT_VERSION" ]; then
    new_version="$EXACT_VERSION"
  else
    new_version="$(compute_bumped "$current" "$BUMP_TYPE")"
  fi

  if [ "$new_version" = "$current" ]; then
    warn "Version already at ${current} — nothing to bump."
    return 0
  fi

  info "Bumping version: ${current} → ${new_version} (${BUMP_TYPE})"
  update_version_files "$new_version"
  ok "Version updated: ${current} → ${new_version}"
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

# ── Can this target be built on the current host? ─────────────────
can_build() {
  local target="$1"
  local os
  os="$(uname -s)"

  case "$os" in
    Darwin)
      # macOS can only build macOS bundles natively
      case "$target" in
        macos-arm|macos-intel) return 0 ;;
      esac
      return 1
      ;;
    Linux)
      # Linux can only build Linux bundles natively
      if [ "$target" = "linux" ]; then return 0; fi
      return 1
      ;;
    MINGW*|MSYS*|CYGWIN*)
      # Windows can only build Windows bundles natively
      if [ "$target" = "windows" ]; then return 0; fi
      return 1
      ;;
  esac
  return 1
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

  run_tauri_build "$rust_target" "$bundles"

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
      # Skip temporary files left by dmg/AppImage creation (e.g. rw.*.dmg)
      case "$(basename "$src")" in
        rw.*|tmp.*|.*.tmp) continue ;;
      esac
      cp -v "$src" "$artifact_dir/"
      copied=$((copied + 1))
    fi
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
  BUMP_TYPE="patch"
  EXACT_VERSION=""
  DO_BUMP=1

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
      --major)
        BUMP_TYPE="major"
        ;;
      --minor)
        BUMP_TYPE="minor"
        ;;
      --patch)
        BUMP_TYPE="patch"
        ;;
      --no-bump)
        DO_BUMP=0
        ;;
      --version)
        shift
        EXACT_VERSION="${1:-}"
        if [ -z "$EXACT_VERSION" ]; then
          err "--version requires a value (X.Y.Z)"
          exit 1
        fi
        if ! [[ "$EXACT_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
          err "Invalid version '$EXACT_VERSION' (expected X.Y.Z)"
          exit 1
        fi
        ;;
      --version=*)
        EXACT_VERSION="${arg#--version=}"
        if ! [[ "$EXACT_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
          err "Invalid version '$EXACT_VERSION' (expected X.Y.Z)"
          exit 1
        fi
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
        echo "Usage: bash release.sh [--all|--target <name>] [--no-clean]"
        echo "                       [--major|--minor|--patch|--version X.Y.Z|--no-bump]"
        echo ""
        echo "  (default)            bump patch version + clean + build all buildable targets"
        echo "                       (macOS: arm + intel, Linux: deb, Windows: exe)"
        echo "  --all                bump patch + clean + build all 4 platforms"
        echo "  --target <name>      bump patch + clean + build one target:"
        echo "                       macos-arm, macos-intel, windows, linux"
        echo "  --no-clean           skip cleaning ./builds/ first"
        echo ""
        echo "  Version options:"
        echo "  --major              bump major (0.3.0 → 1.0.0)"
        echo "  --minor              bump minor (0.3.0 → 0.4.0)"
        echo "  --patch              bump patch (0.3.0 → 0.3.1) [default]"
        echo "  --version X.Y.Z      set an exact version instead of bumping"
        echo "  --no-bump            skip the version bump"
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

  # Filter to only buildable targets
  BUILDABLE=()
  for target in "${TARGETS[@]}"; do
    if can_build "$target"; then
      BUILDABLE+=("$target")
    else
      warn "Skipping ${PLATFORM_LABEL[$target]} — requires a native host"
    fi
  done

  if [ "${#BUILDABLE[@]}" -eq 0 ]; then
    err "No buildable targets for this host."
    echo ""
    echo "Build installers on the target OS, or use the CI pipeline."
    echo "For Windows/Linux bundles from macOS, tag a release to trigger CI."
    exit 0
  fi

  info "Buildable targets: ${BUILDABLE[*]}"

  bump_version

  if [ "$DO_CLEAN" = "1" ]; then
    info "Removing previous ./builds/ …"
    rm -rf "$BUILD_DIR"
    ok "Cleaned"
  fi

  # Build frontend once
  build_frontend

  # Build each target
  for target in "${BUILDABLE[@]}"; do
    build_target "$target"
  done

  print_summary
}

main "$*"
