#!/usr/bin/env bash
# CI gate: destructiveChanges manifests never come in through a PR — removals run in a separate,
# manually triggered release job.
set -euo pipefail
BASE="${1:?usage: check-destructive-changes.sh <base-ref>}"
found=$(git diff --name-only "$BASE"...HEAD | grep -i 'destructiveChanges' || true)
if [ -n "$found" ]; then
  echo "::error::destructiveChanges files are not allowed in a PR:"; echo "$found"; exit 1
fi
echo "No destructiveChanges files."
