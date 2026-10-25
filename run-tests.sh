#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

echo '== Vérification du code =='
npm run check

echo '== Tests du moteur, du CLI et des 55 jours fictifs =='
npm test

echo '== Import bancaire fictif (3 banques) =='
tmp_csv="$(mktemp --suffix=.csv)"
trap 'rm -f "$tmp_csv"' EXIT
python3 import_releves.py \
  tests/fixtures/bourso_exemple.csv \
  tests/fixtures/bps_exemple.csv \
  tests/fixtures/revolut_exemple.csv \
  -o "$tmp_csv"
python3 - "$tmp_csv" <<'PY'
import csv, sys
with open(sys.argv[1], encoding='utf-8-sig', newline='') as f:
    rows = list(csv.DictReader(f, delimiter=';'))
assert len(rows) == 3, f'3 opérations attendues, obtenu {len(rows)}'
print('OK: 3 opérations importées')
PY

echo '== Contrôle du CLI sur données fictives =='
node src/cli.js check \
  --csv tests/fixtures/operations.csv \
  --annotations tests/fixtures/annotations.json \
  --json

echo '== Présence des assets de l’interface =='
test -s index.html
test -s plotly.min.js
grep -q 'src/engine.js' index.html
grep -q 'plotly.min.js' index.html

echo 'Tous les contrôles ont réussi.'
