#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
npm run check
npm test
python3 import_releves.py tests/fixtures/bourso_exemple.csv tests/fixtures/bps_exemple.csv tests/fixtures/revolut_exemple.csv -o /tmp/qbudget-fixture-output.csv
node src/cli.js check --csv tests/fixtures/operations.csv --annotations tests/fixtures/annotations.json
