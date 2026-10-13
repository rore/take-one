#!/usr/bin/env bash
exec node "$(dirname "$0")/render-parallel.mjs" "$@"
