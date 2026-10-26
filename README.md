# qbudget — V0.13.0

Outil **local** de visualisation et simulation financière. Pas de compte bancaire connecté, pas de serveur de données, pas de base distante. Projet en développement : les projections sont des hypothèses, **pas** un outil comptable ou fiscal.



## V0.13.0 — Comptes hors cumul et disposition libre du tableau de bord

**1. Inclure ou exclure un compte du cumul global.** Dans **« Compte et période »**, chaque compte a une case cochée par défaut. Décocher, par exemple, **BPS** ou **Qonto** :

- Le solde et la projection de **« Tous les comptes »** n'additionnent plus ce compte. Les graphiques de flux et de dépenses agrégées portent également sur les comptes inclus seulement.
- Le graphique de trésorerie montre le **cumul actif** (historique bleu et forecast orange) et **une courbe supplémentaire par compte exclu**, avec une légende « hors cumul ». Les courbes séparées ne sont pas réintroduites dans le total.
- Le compte exclu reste **entièrement consultable** via la liste « Compte », y compris son solde, ses opérations, ses prévisions et ses règles. En vue « Tous les comptes », ses opérations restent visibles dans le tableau et portent le statut « HORS CUMUL ».
- **Toutes les opérations restent présentes dans l'export d'audit**, indépendamment des cases. Cette sélection ne supprime rien, ne désactive aucune règle et ne modifie aucun mouvement bancaire.

L'option `excludedAccounts` est conservée dans la sauvegarde locale et dans l'**export/import des annotations JSON**. Les anciens fichiers restent compatibles : si ce champ manque, tous les comptes sont inclus, comme précédemment. Le moteur CLI et le navigateur partagent la même règle pour les calculs globaux, mais un audit CSV complet ne dépend pas de cette sélection.

**2. Réorganiser les sections.** Toutes les cartes du tableau de bord, y compris les trois indicateurs et les graphiques secondaires, possèdent une poignée **« ⠿ Déplacer »**. Glisser la poignée sur une autre section pour changer l'ordre ; les boutons **↑ / ↓** offrent une alternative. La disposition est mémorisée localement dans **ce navigateur et à cette URL** (clé dédiée `qbudget-layout-v1`) et restaurée à la prochaine visite. **« Disposition d'origine »** rétablit l'ordre initial. Les largeurs restent adaptées aux écrans (cartes principales pleine largeur, deux graphiques côte à côte sur grand écran, indicateurs sur trois colonnes).

La disposition est purement visuelle et n'est pas incluse dans l'export d'annotations ; elle ne touche pas aux comptes ni aux transactions. L'import de données ou le changement de scénario ne modifie pas l'ordre des cartes.

**Tests :** 55 tests automatisés, dont 6 nouveaux sur les exclusions et leur sérialisation, plus un parcours Chromium avec Plotly réel pour le changement de compte, les courbes « hors cumul », le glisser-déposer, les flèches, la réinitialisation de l'ordre et `qbudget.test()`.

Dans la console : `qbudget.comptes()` donne l'état d'inclusion de chaque compte. `qbudget.test()` vérifie aussi que le cumul correspond à la somme des comptes actifs.

## V0.12.0 — Démo Qonto, remboursements et prévisions dans le tableau

La **démo fictive** dispose de quatre comptes (BoursoBank, BPS, Revolut, **Qonto**) et combine maintenant :

| Opération fictive | Compte | Montant | Situation au 25/10/2026 |
|---|---|---:|---|
| Essence déplacement client | BPS personnel | −68,40 € | Payée, 21/10 |
| Péage déplacement client | BPS personnel | −28,10 € | Payé, 21/10 |
| Restaurant client | Revolut personnel | −42,50 € | Payé, 22/10 |
| Indemnités kilométriques | Qonto SASU | −350,00 € | Flottante (sans date) |
| Indemnités kilométriques | BoursoBank personnel | +350,00 € | Flottante (sans date) |
| Note de frais restaurant | Qonto SASU | −42,50 € | Flottante (sans date) |
| Note de frais restaurant | Revolut personnel | +42,50 € | Flottante (sans date) |

Les **trois dépenses personnelles déjà payées sont incluses dans les soldes de référence fictifs du 25/10** ; elles ne sont donc pas déduites une seconde fois du solde à cette date. Les deux paires de remboursements restent hors soldes tant qu'elles sont sans date. Les tags `IK`, `noteDeFrais`, `SASU`, `personnel` et un identifiant de contexte permettent de les retrouver, sans automatisme métier.

Dans **« 8 · Opérations datées et annotations »**, la case **« Afficher les récurrences futures »** ajoute au tableau les lignes calculées entre la date de consultation et la fin de prévision. Elles portent le statut **`FORECAST · calculé`**, ont un fond distinct et **aucun contrôle d'édition**. Les opérations réalisées et prévues manuellement ont leur propre statut ; les lignes de forecast ne sont jamais ajoutées aux transactions stockées. La case permet de masquer uniquement leur affichage. Les exports CSV d'audit « all » conservent les prévisions comme auparavant ; l'export « actual » ne les inclut pas.

### Exemples à exécuter dans la console du navigateur (F12)

Après avoir cliqué sur **Charger une démo fictive**, saisir :

```javascript
qbudget.help()                    // Liste des commandes disponibles
qbudget.test()                    // Vérification des invariants sur les données affichées
qbudget.demo()                    // Contrôle Qonto, dépenses payées et paires flottantes
qbudget.pending(['SASU', 'IK'])   // Filtre ET sur les opérations en attente
qbudget.forecast('Qonto')        // Prévision de trésorerie pro
qbudget.recurrences()             // Prévisions récurrentes calculées pour la période
const copie = qbudget.snapshot()  // Copie indépendante pour explorer sans toucher aux données
```

Ces méthodes n'enregistrent aucune modification ; les tests échouent explicitement en cas d'invariant violé. `qbudget.demo()` n'est pertinent que lorsque la **démo** est effectivement chargée. Elles ne remplacent pas les tests automatisés `./run-tests.sh`.

## V0.11.0 — Qonto et opérations flottantes

- Dans « Ajouter un compte », le nom **Qonto** est prérempli (modifiable). Saisir le solde initial, initialement `0`, puis cliquer sur « Créer le compte » : cette action explicite enregistre un solde de référence daté et permet d'utiliser Qonto même sans aucune transaction. L'import d'un nouveau relevé ne supprime plus ces comptes ni les opérations manuelles.
- Dans « Ajouter un montant », **laisser la date vide** pour placer l'opération en file d'attente ; elle ne change aucun solde, aucune projection et n'apparaît pas dans l'export CSV d'audit. La nature doit rester « Prévu ». Le compte est facultatif tant que l'opération est flottante. Les tags sont séparés par des virgules (`SASU, IK, enCoursDeCreation`).
- La « File d'attente » dispose d'une recherche, d'un filtre de tags **ET/OU** (noms exacts, sans distinction de casse), d'une édition de compte/libellé/montant/tags, ainsi que d'une date à choisir dans le calendrier et du bouton « Dater ». Les opérations prévues doivent être datées après la date de consultation ; on peut aussi choisir « Réalisé » pour une opération passée. Une date retirée dans le tableau des opérations replace l'opération manuelle en attente.
- La sauvegarde « Exporter mes annotations » comprend `accounts` et `manualRows` (y compris les dates absentes), puis « Importer mes annotations » reconstitue la file. Le CLI relit la même structure via `--annotations`. Un export d'audit CSV représente **uniquement des écritures datées** : ce n'est donc pas une sauvegarde des opérations flottantes.
- Les tags ne déclenchent aucun calcul : `IK` ne crée pas automatiquement une contrepartie. On pourra définir cette règle nous-mêmes plus tard.

**Pour démarrer sans risque :** exporter d'abord ses annotations, créer Qonto, puis créer une opération en laissant la date vide. Si le solde Qonto n'est pas 0, renseigner son véritable solde dans « Solde de référence ».

## Composants et version

| Composant | Rôle |
|---|---|
| `index.html` | Interface navigateur (version affichée dans le titre) |
| `src/engine.js` | Moteur JavaScript commun (normalisation CSV, soldes, récurrences, audit) |
| `src/cli.js` | CLI Node.js pour les commandes ponctuelles et les scripts (`qbudget --version`) |
| `src/repl.js` | REPL pour explorer les données et simuler plusieurs scénarios en mémoire |
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

**Charger une démo fictive** charge les **92 opérations bancaires du 01/09 au 25/10/2026**, **7 opérations manuelles supplémentaires (dont 4 flottantes), quatre comptes, 12 récurrences** mensuelles, trimestrielles ou annuelles, et des soldes de référence datés du 25/10. Ces données proviennent exactement des fixtures des tests. Le chargement de la démo demande confirmation si des opérations sont déjà présentes : exporter préalablement les annotations JSON si nécessaire.

L'interface garde les opérations et annotations dans le **stockage local du navigateur**, et permet de télécharger les annotations avec **Exporter mes annotations**. Une origine `file://` et une origine GitHub Pages ne partagent pas leur stockage. **Sauvegarder régulièrement les annotations**, surtout avant réimport.

Les opérations bancaires doivent venir d'un CSV normalisé :

```bash
python3 import_releves.py bourso.csv bps.csv revolut.csv -o data/operations.csv
python3 import_releves.py --version
```

Les formats d'entrée propres à chaque banque sont décrits dans `banques.json`. L'importateur conserve les doublons potentiels et les signale sans les supprimer. La sortie normalisée est configurable dans `banques.json` (**`;` et décimales `,` par défaut**, comme l’export d’audit).

## CLI + REPL — Node.js 22+

**Deux modes avec le même moteur :** `qbudget` ouvre un REPL lorsque lancé dans un terminal interactif ; `qbudget forecast` / `balance` / `check` / `export` restent des commandes CLI ponctuelles pour les scripts. Quand son entrée n'est pas interactive (`cron`, pipes, CI), `qbudget` sans argument conserve le forecast pour compatibilité. On peut demander explicitement `qbudget repl` dans tous les cas.

Un REPL garde en mémoire le CSV normalisé, les annotations et les hypothèses pendant toute la session ; il n'écrit **rien** à moins de demander explicitement `export`. `reset` annule les ajustements temporaires, sans altérer le JSON d'annotations.

```bash
qbudget            # REPL depuis le terminal
# ou : qbudget repl
# puis, dans qbudget> :
status
rules
balance 2026-10-25
set at 2026-10-25
set until 2027-12-31
forecast
compare r_netflix -16 -20 -25
set-rule r_netflix:amount=-25
forecast
reset
forecast
export all simulation.csv 2027-12-31
quit
```

La comparaison `compare` recalcule temporairement une règle pour chaque montant, affiche le solde final et minimum, puis restaure implicitement le scénario courant. `set-rule` conserve une hypothèse **uniquement pour la session**. `reload` relit les deux fichiers et efface ces hypothèses. `set format json` permet d'obtenir les résultats détaillés. `help` affiche les commandes disponibles.

**Limites actuelles :** le REPL explore les calculs déjà présents (soldes et récurrences). Les futures formules, variables SASU et scénarios complexes ne sont pas encore implémentés. Il n'existe aucune sauvegarde automatique des hypothèses.

### Commandes CLI pour automatisation

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

Le CLI ponctuel est **sans état** : il lit uniquement le CSV **normalisé** et le JSON d'annotations exporté du navigateur, et ne les modifie pas. Le `.env` est lu depuis le dossier courant. Paramètres : options CLI > `.env` > valeurs par défaut. `--set-rule ID:amount=-25` permet de simuler sans sauvegarder.

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

Le script exécute les tests Node, dont les tests REPL, contrôle l'importateur Python, vérifie l'intégrité des assets et les **versions synchronisées**. Les tests de scénario utilisent `tests/fixtures/life_2026_operations.csv` et `tests/fixtures/life_2026_annotations.json` : 92 opérations bancaires fictives (dont deux montants identiques distincts), 7 opérations manuelles supplémentaires, 12 récurrences, soldes au 25/10/2026. La démo est générée automatiquement avec `python3 scripts/build-demo.py` ; le test `--check` empêche toute divergence. GitHub Actions exécute `run-tests.sh` à chaque push et PR. **Le workflow Pages le relance avant toute publication**, pour éviter de publier une interface incohérente.

Les snapshots servent à détecter les changements, pas à prouver la vérité comptable. L'interface n'est pas encore couverte par une batterie E2E navigateur dans la CI ; les tests valident sa structure et le moteur commun.

## Pages et confidentialité

Le workflow `.github/workflows/pages.yml` publie uniquement `index.html`, Plotly et les modules JS `engine.js`, `version.js`, `demo.js`. Les fichiers **fictifs** de démonstration sont publiés ; **aucun relevé bancaire réel** ne doit être ajouté à Git.

GitHub > Settings > Pages > Source : **GitHub Actions**. GitHub Pages est potentiellement public même si le dépôt est privé. Les données personnelles restent localement dans le navigateur.

`.gitignore` exclut `.env`, `data/`, les annotations privées et **tous les CSV à la racine**. Les CSV synthétiques sous `tests/fixtures/` restent suivis. Vérifier `git status` avant de pousser. Si tu souhaites forcer un fichier CSV de test supplémentaire, le placer dans `tests/fixtures/`.

## Périmètre à venir

Multi-tags complets et filtres ET/OU, opérations calculées et scénarios SASU, liens entre transferts, choix explicite de désactiver une opération **sans suppression automatique**. La présente version consolide le socle existant et explicite la règle « aucune suppression automatique », sans constituer une simulation fiscale validée.
