#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

echo '== Cohérence version, démo, documentation =='
node scripts/sync-version.js --check
node scripts/build-bank-config.js --check
node scripts/build-demo.js --check
npm run check

echo '== Tests du moteur, du CLI, filtres et des 55 jours fictifs =='
npm test

echo '== Import bancaire fictif (3 banques) =='
tmp_csv="$(mktemp --suffix=.csv)"
trap 'rm -f "$tmp_csv"' EXIT
node import_releves.js \
  tests/fixtures/bourso_exemple.csv \
  tests/fixtures/bps_exemple.csv \
  tests/fixtures/revolut_exemple.csv \
  -o "$tmp_csv"
node - "$tmp_csv" <<'JS'
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {csvRows}=require('./src/normalize.js');
const [header,...rows]=csvRows(fs.readFileSync(process.argv[2],'utf8'),';').map(row=>row.cells);
const amount=header.indexOf('Montant');
assert.notEqual(amount,-1,'Colonne Montant absente');
assert.equal(rows.length,3,'3 opérations attendues');
assert.ok(rows.every(row=>!row[amount].includes('.')),'Montants décimaux non normalisés');
assert.ok(rows.some(row=>row[amount].includes(',')),'Aucune virgule décimale trouvée');
console.log('OK: 3 opérations importées, décimales à la virgule');
JS

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
node import_releves.js --version

echo 'Tous les contrôles ont réussi.'
