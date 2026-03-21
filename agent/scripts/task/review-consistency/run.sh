#!/usr/bin/env sh
set -eu
exec "$(cd "$(dirname "$0")/../.." && pwd)/task/extended-review/run.sh" review-consistency agent/execution/task-context/review-consistency.yaml
