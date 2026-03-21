#!/usr/bin/env sh
set -eu
exec "$(cd "$(dirname "$0")/../.." && pwd)/task/extended-review/run.sh" review-technology agent/execution/task-context/review-technology.yaml
