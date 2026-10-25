# qbudget — premier dépôt Git (socle V0.8-dev)

Application locale de suivi et prévision de trésorerie. Aucun service bancaire ou cloud n'est sollicité. Les données restent dans le navigateur ou les fichiers locaux.

## Démarrage

Ouvrir `index.html` directement dans le navigateur (avec `plotly.min.js` et `src/engine.js` aux chemins prévus). En cas de restriction de sécurité `file://`, lancer `python3 -m http.server 8000` puis visiter http://localhost:8000.

L'interface reprend qbudget V0.7.1, avec la logique de soldes et de récurrences appelée depuis `src/engine.js`. Les opérations, tags et références continuent d'être stockés localement dans le navigateur. La nouvelle action **Exporter les données CLI** crée un JSON complet incluant les opérations bancaires : fichier **confidentiel à ne pas committer**.

## CLI (Node.js >=20)

```bash
node src/cli.js check --data tests/fixtures/sample.json
node src/cli.js balance --data tests/fixtures/sample.json --account BoursoBank --at 2026-10-25
node src/cli.js forecast --data tests/fixtures/sample.json --account BoursoBank --at 2026-10-25 --until 2027-12-25 --json
node src/cli.js forecast --data qbudget-data.json --account BoursoBank --at 2026-10-25 --until 2027-12-25 --set-rule ID_REGLE:amount=-20
```

`--set-rule` teste une modification temporaire de montant, sans écrire les données sur disque. `--json` rend la sortie exploitable par scripts. Les commandes utilisent les mêmes calculs que l'interface.

## Tests

```bash
npm test
npm run check
python3 import_releves.py tests/fixtures/bourso_exemple.csv tests/fixtures/bps_exemple.csv tests/fixtures/revolut_exemple.csv -o /tmp/operations-test.csv
```

Le workflow `.github/workflows/tests.yml` lance ces contrôles à chaque push et pull request. Il n'y a **pas encore de tests fonctionnels de navigateur** : leur ajout avec Playwright constitue l'étape suivante. La syntaxe JS de l'interface a été contrôlée, mais l'intégration navigateur n'a pas été totalement validée ici.

## Structure

- `index.html` : interface historique, maintenant branchée sur le moteur partagé pour le calcul des soldes et récurrences.
- `plotly.min.js` : Plotly local.
- `src/engine.js` : fonctions pures partagées (solde, prévisions, dates, récurrences, contrôles).
- `src/cli.js` : terminal `balance`, `forecast`, `check`.
- `import_releves.py` et `banques.json` : importateur bancaire V1.4.2 avec configuration de sortie et correction BPS.
- `tests/` : tests Node et exemples totalement fictifs.

## Points de vigilance

- Cette première extraction ne constitue pas encore une séparation complète de l'interface. L'import CSV, la gestion des annotations et des règles restent dans `index.html`. Ils seront progressivement isolés et testés.
- La prévision actuelle suit le comportement de la V0.7.1 : même règle par abonnement ; opérations planifiées prioritaires à la même date. Vérifier les cas particuliers avant toute décision financière.
- Aucun CSV bancaire personnel ni export JSON réel ne doit être poussé sur GitHub. Le `.gitignore` masque les exports courants ; examiner `git status` avant chaque commit.
- Les opérations calculées SASU, les multi-tags et les scénarios fiscaux complexes ne sont **pas encore implémentés**.
