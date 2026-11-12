# qbudget V0.20.3 — Pilotage financier local

qbudget aide à explorer ses finances par les tags, suivre ses soldes, anticiper sa trésorerie et comparer des scénarios. Les opérations flottantes, prévisions et classifications restent souples. Les données sont locales ; aucun service ne reçoit les relevés.

**0.20.3 :** retagage opération par opération depuis les résultats filtrés ou la sélection. Tous les tags sont proposés par catégorie, avec validation et passage à l’opération suivante ; les tags libres et les annotations restent conservés.

## Démarrer

Node.js **22 ou plus récent** suffit aux outils du projet. Aucune installation de dépendances n’est nécessaire.

```sh
node scripts/serve.js
```

Ouvrir <http://127.0.0.1:8000/>. Le serveur n’expose que les fichiers de l’application, de documentation et d’exemples, et écoute uniquement sur la machine locale. On peut également ouvrir `index.html` directement dans un navigateur récent. Conserver ensemble `index.html`, `plotly.min.js` et le dossier `src/`.

Versions en ligne : [principale](https://grillon.github.io/qbudget/) et [développement](https://grillon.github.io/qbudget/dev/). Les données navigateur des deux versions sont séparées. [Publication Pages](docs/pages.md).

## Importer et sauvegarder

Le navigateur accepte les CSV bruts BoursoBank, BPS et Revolut, ou un CSV qbudget déjà normalisé. La configuration des banques vient de `banques.json` ; le module navigateur correspondant est généré depuis ce fichier. La prévisualisation précède l’import des CSV bruts. Une erreur de normalisation interrompt tout le lot.

Un import CSV remplace les opérations bancaires affichées. Il conserve les opérations manuelles, les annotations et les décisions utiles des lignes absentes. Aucune opération distincte n’est fusionnée automatiquement.

**Exporter mes annotations** sauvegarde les notes, tags, règles, soldes de référence, catégories, associations, opérations manuelles et flottantes, ainsi que les backlogs et décisions. **Exporter les données CLI** utilise ce même format natif afin de conserver aussi les manuelles. Les opérations bancaires restent dans le CSV : garder les deux fichiers.

Le JSON conserve le schéma natif `version:3`. Les anciens fichiers sont acceptés, y compris les anciens exports CLI qui plaçaient les manuelles dans `rows` ; seuls les champs manuels y sont repris, sans remplacer le CSV bancaire. Les champs supplémentaires sont reconnus ou conservés. Un import d’annotations remplace les annotations et manuelles locales après confirmation ; le fichier original sur disque n’est pas réécrit.

Les modifications sont sauvegardées dans le navigateur. Si ce stockage échoue, une alerte persistante l’indique : les modifications restent en mémoire et peuvent être exportées avant de fermer la page. Un message de succès n’est pas affiché pour une sauvegarde échouée.

### Identifiants et réimports

Une opération bancaire porte une identité `SHA256-SUFFIXE` fondée sur la banque, le compte source, le libellé normalisé, la date, le montant exact et la devise. Le nom du fichier et l’ordre des lignes n’interviennent pas. Le libellé bancaire original reste conservé.

Les suffixes distinguent les véritables opérations identiques. Une référence bancaire stable peut aider à les reconnaître ; la colonne historique `Identifiant` du normaliseur ne constitue pas cette preuve.

Les identités et annotations anciennes sont conservées dans `bankIdentities`. Les ambiguïtés arrivent dans **Rapprochements à traiter**, après la fin de l’import. Choisir une identité connue ou confirmer une opération distincte ; aucun tag incertain n’est déplacé automatiquement. Le CLI refuse les ambiguïtés non résolues. [Rapprochements](docs/rapprochements.md).

Un rattachement manuel d’annotation ne fusionne pas deux identités bancaires : une nouvelle annotation sur l’opération source reste attachée à cette source lors des imports suivants. Les anciens alias concurrents sont nettoyés sans déplacer les notes ; une annotation déjà mal attribuée avant ce correctif reste à vérifier manuellement. Les opérations manuelles conservent leur UUID lorsqu’elles changent de date.

## Explorer et classer

Le tableau de bord et l’éditeur partagent les mêmes données et calculs.

- **Retagage guidé** : parcourir les résultats ou la sélection, choisir un tag par catégorie et enregistrer avant de passer à la suivante. Les tags libres et catégories non modifiées restent conservés. [Guide](docs/retagage.md).
- **Tags multiples** : `SASU, IK, mission` ajoute les tags manquants à une sélection ou aux résultats filtrés, sans doublons. Le retrait groupé porte sur un tag à la fois. [Guide](docs/retrait-tags.md).
- **Associations de libellés** : motifs littéraux avec condition OU, insensibles à la casse et par mots entiers, vers un tag existant. Les tags manuels restent distincts des tags déduits. [Guide](docs/associations-libelles.md).
- **Sans tags / Libellés partiellement tagués** : filtres combinables avec la recherche et les bornes de date/montant. Une suggestion commune peut préremplir le champ ; votre saisie reste prioritaire. [Guide](docs/reperage-tags.md).
- **Tri et affichage** : en-têtes Date, Compte, Élément, Montant et Tags, croissants ou décroissants, sur tous les résultats. Choix de 120, 250, 500 ou 1 000 lignes ; sélection conservée après tri. [Guide](docs/tri-editeur.md).
- **Catégories** : dimensions modifiables et réordonnables. Tous les tags restent visibles ; un graphique retient le premier tag de chaque catégorie pour ventiler un montant. Le [dictionnaire d’exploration](docs/categories-exploration.md) remplace les anciennes catégories. Les tags non classés restent libres ; **+ Catégorie** permet de créer ses propres dimensions.

Dans le Sunburst / Treemap, les questions proposées appliquent une sélection de dimensions, un ordre et une profondeur. Les filtres restent actifs. **Dimensions du graphique** permet de masquer ou réintroduire un axe sans supprimer sa catégorie ; les onglets restent réordonnables à la souris ou avec Alt + flèches. La profondeur va de 1 à 8 ; les axes au-delà de la profondeur choisie restent disponibles. Les perspectives Projet et Finalité apparaissent lorsque ces catégories sont configurées. Compte / Flux et la périodicité détaillée restent différés. [Guide](docs/perspectives.md).

Les graphiques de répartition incluent les dépenses réalisées, les manuelles prévues datées et les occurrences récurrentes calculées jusqu’à l’horizon choisi. Cliquer sur une part retrouve les opérations correspondantes. Les flottantes restent hors calcul. Les transferts tagués peuvent être exclus des répartitions sans modifier les soldes ou l’audit.

Les recettes et dépenses du graphique mensuel gardent leur périmètre historique, jusqu’à la date de consultation. Les transferts restent présents dans ces flux et dans l’impact filtré : ces vues montrent les mouvements, tandis que l’exclusion concerne les répartitions de dépenses.

## Prévoir et vérifier

Une opération manuelle peut être **réalisée**, **prévue** ou sans date (**flottante**). Une prévue ne doit pas être déplacée dans le passé sans passer en réalisé ; une flottante n’a jamais d’effet sur le solde ou les prévisions.

- **Récurrences potentielles** : détection sur au moins trois occurrences régulières, puis backlog modifiable. Seule la création explicite d’une règle modifie les prévisions. Les brouillons restent présents lors des changements de filtre ou de vue. [Guide](docs/detection-recurrences.md).
- **Transferts potentiels** : même date, devise et montant opposé, entre comptes distincts. Un clic appose `transfert_intercomptes` aux deux lignes ; les tags constituent la validation, même ajoutés depuis le tableau. Doubles débits et ambiguïtés restent manuels. [Guide](docs/detection-transferts.md).

Un solde de référence est un solde de **fin de journée**. Les calculs historiques partent de cette référence dans les deux sens. Les prévisions et exports utilisent le même calendrier ancré, y compris les fins de mois et années bissextiles. Une règle ancienne ne cesse plus après 600 occurrences.

Les soldes et projections sont exprimés en EUR. Si des mouvements d’une autre devise interviennent dans le périmètre calculé, le résultat est **indisponible avec diagnostic** : aucune conversion implicite ni addition EUR/USD. Les lignes originales restent stockées et présentes dans l’audit exhaustif.

Il n’existe pas de déduplication automatique entre une opération saisie et une occurrence récurrente : elles peuvent représenter deux hypothèses et sont comptées séparément. Leur rapprochement reste une décision utilisateur. Les comptes exclus restent consultables individuellement et figurent dans l’audit, même si le cumul global les omet.

**Exporter CSV d’audit** détaille les opérations datées et, selon le périmètre, les échéances prévisionnelles. Cet export permet de retrouver dates, comptes, montants, origines et règles ; il ne remplace pas une sauvegarde d’annotations et n’inclut pas les flottantes.

## Outils Node

### Normalisation des relevés bruts

```sh
node import_releves.js bourso.csv bps.csv revolut.csv -o data/operations.csv
node import_releves.js -c banques.json -o operations_normalisees.csv releve.csv
node import_releves.js --help
node import_releves.js --version
```

L’importateur appelle le même `src/normalize.js` que le navigateur : séparateurs, encodages UTF-8/Windows-1252, montants décimaux, champs multilignes, doublons potentiels et sortie personnalisée. Il n’écrit aucune sortie partielle en cas d’erreur. Par défaut, le CSV qbudget utilise `;` et la virgule décimale.

Les formats de date numériques configurables acceptent `%Y`, `%y`, `%m` et `%d`, dans l’ordre et avec les séparateurs voulus. Les années à deux chiffres suivent le pivot 68/69. Le format ISO `%Y-%m-%d` accepte les horodatages dont il extrait la date. Les directives non prises en charge sont refusées explicitement ; les mois textuels et formats de semaines ne sont pas interprétés.

### CLI et REPL

Copier `.env.example` vers `.env`, adapter les chemins du CSV normalisé et du JSON exporté, puis :

```sh
node src/cli.js forecast --csv data/operations.csv --annotations data/annotations.json --at 2026-10-25 --months 2 --json
node src/cli.js balance --at 2026-10-25 --account BPS
node src/cli.js check --json
node src/cli.js export --scope all --at 2026-10-25 --until 2026-11-30 -o audit.csv
node src/cli.js repl
```

Les arguments priment sur `.env`. Le CLI et le REPL valident les dates calendaires réelles et utilisent le même ajout de mois borné : 31 janvier + un mois = 28 ou 29 février. Le navigateur conserve son horizon par défaut en fin du mois cible.

Le REPL permet `accounts`, `rules`, `forecast`, `balance`, `set`, `set-rule`, `compare`, `reset`, `reload`, `export`, `help` et `quit`. Ses scénarios restent en mémoire ; seule la commande `export` écrit un fichier. Les comptes sans transaction mais possédant un solde de référence sont disponibles.

## Développement et vérifications

```sh
./run-tests.sh
npm run test:browser
```

La première commande vérifie la syntaxe, les générateurs, les tests métier, l’importateur, le CLI et les assets. La seconde lance de vrais parcours Firefox sur des données fictives : export/relecture des manuelles, sauvegarde indisponible, noms de comptes, brouillons de récurrence, transferts, tri, pagination et taggage groupé. Firefox doit être installé ; `FIREFOX_BIN` permet d’indiquer son chemin. Les profils de test sont indépendants du navigateur personnel et supprimés après exécution.

Les deux workflows GitHub exécutent les contrôles avant publication. Pages assemble `main` à la racine et `dev` dans `/dev/` sans publier les relevés, annotations ou autres données personnelles.

`package.json` est la source de vérité de la version. Après modification des sources générées :

```sh
node scripts/sync-version.js
node scripts/build-bank-config.js
node scripts/build-demo.js
```

Leur option `--check` détecte un décalage sans écrire de fichier. `banques.json` fournit la configuration ; les fixtures du scénario fictif fournissent la démonstration.

| Module | Responsabilité |
|---|---|
| `src/engine.js` | Dates, soldes, prévisions, audit et lecture des tags |
| `src/identity.js` | Identités stables, rapprochements et migration des notes |
| `src/normalize.js` | Normalisation unique des CSV bruts, navigateur et CLI |
| `src/annotations.js`, `src/tags.js` | Format natif, catégories et actions de tags |
| `src/recurrences.js`, `src/transfers.js` | Détection et backlogs de propositions |
| `src/ui.js`, `src/editor.js` | Vues sur le même modèle, sans format de données séparé |
| `src/cli.js`, `src/repl.js` | Commandes et scénarios locaux |
| `scripts/` | Génération, publication, serveur local et tests navigateur |

[Historique des versions](CHANGELOG.md).
