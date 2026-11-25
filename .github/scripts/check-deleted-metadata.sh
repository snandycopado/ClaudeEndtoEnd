#!/usr/bin/env bash
# CI gate: fail if the PR deletes metadata files, unless an architect added the
# 'architect-approved-deletion' label (APPROVED=true). Moves/renames are not deletions.
set -euo pipefail
BASE="${1:?usage: check-deleted-metadata.sh <base-ref>}"
deleted=$(git diff --find-renames --diff-filter=D --name-only "$BASE"...HEAD -- force-app manifest \
  | grep -v -E '(^|/)(CLAUDE|README)\.md$' || true)
if [ -n "$deleted" ]; then
  if [ "${APPROVED:-false}" = "true" ]; then
    echo "::warning::Metadata deletions approved by architect label:"; echo "$deleted"; exit 0
  fi
  echo "::error::This PR deletes metadata. Deletions need the 'architect-approved-deletion' label:"
  echo "$deleted"
  exit 1
fi
echo "No deleted metadata."
