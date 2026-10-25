# Historique des versions de qbudget

## 0.9.8 — Cohérence et démonstration unifiée

- Numéro de version affiché dans le navigateur et l'onglet, accessible par `qbudget --version` et `python3 import_releves.py --version`.
- `package.json` fait référence : `scripts/sync-version.py` génère `src/version.js`, et les tests détectent les divergences.
- Le bouton **Charger une démo fictive** utilise les mêmes **92 opérations**, **12 règles** et **3 soldes de référence** que `tests/fixtures/life_2026_*` ; `scripts/build-demo.py` génère `src/demo.js` et les tests en vérifient le contenu exact.
- Les exports normalisés (importateur et CLI) ont **`;` pour séparateur de colonnes** et **`,` pour séparateur décimal**, configurables via `banques.json` pour l'importateur.
- Les opérations et les échéances liées restent toutes visibles, sans suppression automatique ; cette règle est couverte par un test. L'interface de signalement/décision pour ces cas reste à créer.
- Les tests et la cohérence des modules sont vérifiés **avant** le déploiement GitHub Pages.
- `.gitignore` protège aussi tous les CSV à la racine du dépôt ; les fixtures sous `tests/fixtures` restent versionnées.
- 27 tests Node réussis et importateur testé. Une vérification en Chromium, avec chargement de la démo et export CSV, a été effectuée hors GitHub Actions.

## 0.9.7

- Sélection de la date de fin du forecast au calendrier.

## 0.9.6

- Export CSV d'audit depuis le navigateur.

## 0.9.5

- Virgule décimale dans l'export CSV d'audit CLI.

## 0.9.4

- Export CSV déterministe depuis le CLI.

## 0.9.3

- Scénario fictif de 55 jours dans la suite de tests.
