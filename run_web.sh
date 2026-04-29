#!/usr/bin/env bash
set -euo pipefail
# Resolve repo root (directory containing wsgi.py). Supports Railway when the
# process cwd is either the repo root or the backend/ folder.
if [[ -f ./wsgi.py ]]; then
  ROOT="$(pwd -P)"
elif [[ -f ../wsgi.py ]]; then
  ROOT="$(cd .. && pwd -P)"
else
  echo "run_web.sh: wsgi.py not found in . or .." >&2
  exit 1
fi
export PYTHONPATH="${ROOT}${PYTHONPATH:+:${PYTHONPATH}}"
cd "$ROOT"
exec gunicorn wsgi:app --bind "0.0.0.0:${PORT}" --workers 1 --timeout 120 --access-logfile - --error-logfile - --capture-output
