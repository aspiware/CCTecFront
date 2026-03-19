#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

BUILD_CONFIG_FILE="App_Resources/iOS/build.xcconfig"
NEXT_VERSION="${1:-}"

if [[ -f "$BUILD_CONFIG_FILE" ]]; then
  if [[ -n "$NEXT_VERSION" ]]; then
    current_version="$(sed -n 's/^MARKETING_VERSION = \(.*\)$/\1/p' "$BUILD_CONFIG_FILE")"
    if [[ -n "${current_version:-}" ]]; then
      sed -i '' "s/^MARKETING_VERSION = ${current_version}$/MARKETING_VERSION = ${NEXT_VERSION}/" "$BUILD_CONFIG_FILE"
      echo "MARKETING_VERSION updated: ${current_version} -> ${NEXT_VERSION}"
    else
      echo "MARKETING_VERSION not found in $BUILD_CONFIG_FILE"
      exit 1
    fi
  fi

  current_build="$(sed -n 's/^CURRENT_PROJECT_VERSION = \([0-9][0-9]*\)$/\1/p' "$BUILD_CONFIG_FILE")"
  if [[ -n "${current_build:-}" ]]; then
    next_build=$((current_build + 1))
    sed -i '' "s/^CURRENT_PROJECT_VERSION = ${current_build}$/CURRENT_PROJECT_VERSION = ${next_build}/" "$BUILD_CONFIG_FILE"
    echo "CURRENT_PROJECT_VERSION updated: ${current_build} -> ${next_build}"
  else
    echo "CURRENT_PROJECT_VERSION not found in $BUILD_CONFIG_FILE"
    exit 1
  fi
else
  echo "Missing $BUILD_CONFIG_FILE"
  exit 1
fi

ns clean
ns build ios --release
