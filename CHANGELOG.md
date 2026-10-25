# V0.12.0 — Démo pro/perso et affichage des échéances calculées

- Démo fictive enrichie : compte Qonto SASU avec solde 0 €, essence/péage/restaurant datés et payés côté personnel, remboursements IK et note de frais en paires pro (−) / perso (+), flottantes.
- Les tags expriment le contexte et la relation entre contreparties ; aucune génération automatique de remboursement.
- Le tableau des opérations peut afficher ou masquer les occurrences récurrentes futures, calculées depuis l’audit commun. Elles ont un indicateur « FORECAST · calculé », un style distinct, aucune commande d’édition et ne sont jamais écrites dans les données.
- Affichage explicite du statut des autres opérations (réelles importées, réalisées manuellement, prévues saisies).
- API de consultation/test en lecture seule depuis la console navigateur : `qbudget.help()`, `qbudget.test()`, `qbudget.demo()`, `qbudget.pending()`, `qbudget.forecast()`, `qbudget.recurrences()`, `qbudget.snapshot()`.
- 49 tests automatisés réussis incluant des invariants de parité de l’audit, d’exclusion des flottantes et d’import/export.

# V0.11.0 — Opérations flottantes et compte Qonto

- Compte créé explicitement sans transaction, solde de référence initial.
- Opérations manuelles sans date, visibles dans une file filtrable (tags ET/OU), planifiables avec le calendrier.
- Exclusion explicite des opérations flottantes de tous les calculs et de l'audit CSV.
- Import CSV actualisable sans effacer opérations manuelles, comptes, règles ni annotations.
- Export/import d'annotations préservant les comptes et opérations en attente.
- Tests supplémentaires de non-régression, sérialisation et CLI.

# Historique des versions de qbudget

## 0.10.0 — CLI et REPL interactif
- `qbudget` ouvre un REPL dans un terminal interactif, `qbudget repl` le lance explicitement ; les commandes CLI existantes restent disponibles.
- CSV normalisé et annotations chargés une seule fois pendant la session ; consultation des soldes, des récurrences et des prévisions.
- Simulations **non sauvegardées** : ajuster une récurrence avec `set-rule`, comparer plusieurs valeurs avec `compare`, rétablir avec `reset`.
- `export` dans le REPL produit le même CSV d'audit déterministe (virgule décimale) que le CLI, uniquement sur demande explicite.
- Tests automatisés de parité du REPL, d'absence de modification des fichiers et de compatibilité du CLI non interactif.


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
