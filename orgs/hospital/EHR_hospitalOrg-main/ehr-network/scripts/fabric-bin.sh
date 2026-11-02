#!/usr/bin/env bash
# fabric-bin.sh — sourced (not executed) by the network scripts to resolve the
# platform-appropriate Hyperledger Fabric binary directory and prepend it to PATH.
#
#   macOS (Darwin) → the host's darwin/arm64 binaries. The committed repo `bin/`
#                     holds Linux ELF binaries that cannot run on Apple Silicon.
#   Linux / other   → the committed repo `bin/`.
#
# Override with FABRIC_BIN_DIR (an env var or exported in your shell) to point at
# a custom location on any OS.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../../.." && pwd)"

_resolve_fabric_bin() {
  local d p

  # 1) explicit override (any OS)
  if [ -n "${FABRIC_BIN_DIR:-}" ] && [ -x "${FABRIC_BIN_DIR}/peer" ]; then
    printf '%s' "$FABRIC_BIN_DIR"; return 0
  fi

  # 2) macOS: use the host's darwin binaries
  if [ "$(uname -s)" = "Darwin" ]; then
    # (a) a runnable `peer` already on PATH (but not the committed Linux one)
    p="$(command -v peer 2>/dev/null || true)"
    if [ -n "$p" ] && [ -x "$p" ] && [ "$p" != "$REPO_ROOT/bin/peer" ]; then
      dirname "$p"; return 0
    fi
    # (b) common darwin fabric-samples install locations
    for d in "$HOME"/go/src/github.com/*/fabric-samples/bin \
             "$HOME"/fabric-samples/bin \
             "$HOME"/blockchain/fabric-samples/bin; do
      if [ -x "$d/peer" ]; then
        printf '%s' "$d"; return 0
      fi
    done
    return 1
  fi

  # 3) Linux / other: committed repo bin/
  if [ -x "$REPO_ROOT/bin/peer" ]; then
    printf '%s' "$REPO_ROOT/bin"; return 0
  fi
  return 1
}

if FBIN="$(_resolve_fabric_bin)"; then
  export FABRIC_BIN_DIR="$FBIN"
  export PATH="$FBIN:$PATH"
fi
