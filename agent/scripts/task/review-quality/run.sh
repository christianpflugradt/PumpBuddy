#!/usr/bin/env sh
set -eu
exec "$(cd "$(dirname "$0")/../.." && pwd)/task/extended-review/run.sh" review-quality agent/execution/task-context/review-quality.yaml
