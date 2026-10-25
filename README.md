# qbudget — V0.9.8

Outil **local** de visualisation et simulation financière. Pas de compte bancaire connecté, pas de serveur de données, pas de base distante. Projet en développement : les projections sont des hypothèses, **pas** un outil comptable ou fiscal.

## Composants et version

| Composant | Rôle |
|---|---|
| `index.html` | Interface navigateur (version affichée dans le titre) |
| `src/engine.js` | Moteur JavaScript commun (normalisation CSV, soldes, récurrences, audit) |
| `src/cli.js` | CLI Node.js (`qbudget --version`) |
| `src/version.js` | Version du navigateur, générée depuis `package.json` |
| `src/demo.js` | **Démo fictive** générée depuis les fixtures des tests |
| `import_releves.py`, `banques.json` | Importateur Python indépendant et configurable (`--version`) |
| `tests/` | Fixtures et tests sans données privées |
| `run-tests.sh` | Test local et GitHub Actions |

`package.json` est la source de vérité du numéro de version. Exécuter `python3 scripts/sync-version.py` après l'avoir changé : le test vérifiera la synchronisation.

## Navigateur

Garder `index.html`, `plotly.min.js`, `src/engine.js`, `src/version.js` et `src/demo.js` aux mêmes emplacements. Ouvrir `index.html` ou, en cas de limitation de `file://`, démarrer :

```bash
python3 -m http.server 8000
# http://localhost:8000
```

**Charger une démo fictive** charge les **92 opérations du 01/09 au 25/10/2026**, trois comptes, **12 récurrences** mensuelles, trimestrielles ou annuelles, et des soldes de référence datés du 25/10. Ces données proviennent exactement des fixtures des tests. Le chargement de la démo demande confirmation si des opérations sont déjà présentes : exporter préalablement les annotations JSON si nécessaire.

L'interface garde les opérations et annotations dans le **stockage local du navigateur**, et permet de télécharger les annotations avec **Exporter mes annotations**. Une origine `file://` et une origine GitHub Pages ne partagent pas leur stockage. **Sauvegarder régulièrement les annotations**, surtout avant réimport.

Les opérations bancaires doivent venir d'un CSV normalisé :

```bash
python3 import_releves.py bourso.csv bps.csv revolut.csv -o data/operations.csv
python3 import_releves.py --version
```

Les formats d'entrée propres à chaque banque sont décrits dans `banques.json`. L'importateur conserve les doublons potentiels et les signale sans les supprimer. La sortie normalisée est configurable dans `banques.json` (**`;` et décimales `,` par défaut**, comme l’export d’audit).

## CLI — Node.js 22+

```bash
cp .env.example .env
# Personnaliser QBUDGET_CSV / QBUDGET_ANNOTATIONS / QBUDGET_MONTHS
npm link
qbudget --version
qbudget
qbudget balance --account BoursoBank --at 2026-10-25
qbudget check
qbudget forecast --months 14 --json
```

Le CLI est **sans état** : il lit uniquement le CSV **normalisé** et le JSON d'annotations exporté du navigateur, et ne les modifie pas. Le `.env` est lu depuis le dossier courant. Paramètres : options CLI > `.env` > valeurs par défaut. `--set-rule ID:amount=-25` permet de simuler sans sauvegarder.

## Export CSV d'audit

```bash
qbudget export --scope actual --until 2026-10-25 -o actual.csv
qbudget export --scope all --at 2026-10-25 --until 2027-12-31 -o forecast.csv
vimdiff actual.csv forecast.csv
```

Le navigateur dispose des mêmes sélecteurs et du bouton **Exporter CSV d'audit**. Convention : **`;` entre colonnes, virgule décimale**, date `AAAA-MM-JJ`, tri déterministe. L'export est indépendant des filtres visuels et conserve les opérations identiques. Le point de référence `--at` correspond à une fin de journée, et `--until` est inclus. Pour comparer les deux interfaces, importer les mêmes données bancaires et annotations, et utiliser les mêmes bornes temporelles. **Attention :** les identifiants d'opérations bancaires dépendent encore de l'ordre du CSV, qui doit rester stable pour la comparaison.

## Tests et régressions

```bash
./run-tests.sh
```

Le script exécute les tests Node, contrôle l'importateur Python, vérifie l'intégrité des assets et les **versions synchronisées**. Les tests de scénario utilisent `tests/fixtures/life_2026_operations.csv` et `tests/fixtures/life_2026_annotations.json` : 92 opérations fictives (dont deux montants identiques distincts), 12 récurrences, soldes au 25/10/2026. La démo est générée automatiquement avec `python3 scripts/build-demo.py` ; le test `--check` empêche toute divergence. GitHub Actions exécute `run-tests.sh` à chaque push et PR. **Le workflow Pages le relance avant toute publication**, pour éviter de publier une interface incohérente.

Les snapshots servent à détecter les changements, pas à prouver la vérité comptable. L'interface n'est pas encore couverte par une batterie E2E navigateur dans la CI ; les tests valident sa structure et le moteur commun.

## Pages et confidentialité

Le workflow `.github/workflows/pages.yml` publie uniquement `index.html`, Plotly et les modules JS `engine.js`, `version.js`, `demo.js`. Les fichiers **fictifs** de démonstration sont publiés ; **aucun relevé bancaire réel** ne doit être ajouté à Git.

GitHub > Settings > Pages > Source : **GitHub Actions**. GitHub Pages est potentiellement public même si le dépôt est privé. Les données personnelles restent localement dans le navigateur.

`.gitignore` exclut `.env`, `data/`, les annotations privées et **tous les CSV à la racine**. Les CSV synthétiques sous `tests/fixtures/` restent suivis. Vérifier `git status` avant de pousser. Si tu souhaites forcer un fichier CSV de test supplémentaire, le placer dans `tests/fixtures/`.

## Périmètre à venir

Multi-tags complets et filtres ET/OU, opérations calculées et scénarios SASU, liens entre transferts, choix explicite de désactiver une opération **sans suppression automatique**. La présente version consolide le socle existant et explicite la règle « aucune suppression automatique », sans constituer une simulation fiscale validée.
