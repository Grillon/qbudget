#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

echo '== Cohérence version, démo, documentation =='
python3 scripts/sync-version.py --check
python3 scripts/build-bank-config.py --check
python3 scripts/build-demo.py --check
npm run check

echo '== Tests du moteur, du CLI, filtres et des 55 jours fictifs =='
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
assert rows[0]['Montant'].count('.') == 0, 'Export qbudget devrait utiliser la virgule décimale'
assert all('.' not in row['Montant'] for row in rows), 'Montants décimaux non normalisés'
assert any(',' in row['Montant'] for row in rows), 'Aucune virgule décimale trouvée'
print('OK: 3 opérations importées, décimales à la virgule')
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
grep -q 'src/version.js' index.html
grep -q 'src/demo.js' index.html
grep -q 'src/normalize.js' index.html
grep -q 'src/bank-config.js' index.html
grep -q 'src/tags.js' index.html
grep -q 'src/ui.js' index.html
test -s src/identity.js
test -s src/transfers.js
grep -q 'src/transfers.js' index.html
test -s src/recurrences.js
grep -q 'src/recurrences.js' index.html
test -s src/tags.js
test -s src/visual-select.js
test -s src/annotations.js
test -s src/editor.js
test -s src/history-plot.js
test -s src/ui.js
node src/cli.js --version
python3 import_releves.py --version

echo 'Tous les contrôles ont réussi.'
