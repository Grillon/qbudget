# qbudget — V0.19.1 · Interface accélérée

**Correction de performance, sans changement du moteur financier ni des formats CSV/JSON.**

- **Deux vues réellement indépendantes à l'affichage :** l'éditeur ne provoque plus de redessin des graphiques Plotly, et le tableau de bord ne reconstruit plus l'éditeur caché. Les modifications restent communes et apparaissent lors du retour dans l'autre vue.
- **L'éditeur affiche les 120 premiers éléments** puis « Afficher 120 éléments supplémentaires ». La recherche et le filtre portent toujours sur **tous** les éléments, pas seulement ceux affichés. Les liens et l'édition restent disponibles.
- **Le tableau affiche les 150 premières lignes** puis « Afficher 150 opérations supplémentaires », sans changer les résultats des filtres ou graphiques. « Sélectionner les résultats affichés » sélectionne uniquement les lignes effectivement visibles, jamais les occurrences `FORECAST`.
- **Courbe historique plus rapide :** un passage chronologique inverse remplace le recalcul du solde à chaque date. Chaque point est comparé dans les tests au moteur financier inchangé.
- **Recherche fluide :** l'éditeur ne reconstruit plus systématiquement tous les boutons de catégories ; ils sont calculés à l'ouverture de la rubrique correspondante. Les graphiques réagissent après une courte pause (220 ms) lors de la saisie dans les filtres, tandis que le tableau reste immédiat. Le redimensionnement de fenêtre ne déclenche plus tous les calculs.

**Mesures Chromium headless, avec 500 opérations fictives supplémentaires** (mêmes données et environnement, valeurs indicatives) : ouverture de l'éditeur ~258 ms → ~5 ms ; filtrage/recherche dans l'éditeur ~275 ms → ~4 ms ; rendu complet du tableau de bord initial ~501 ms → ~123 ms (hors cas de courbes historiques à dates nombreuses). Un essai avec 3 000 écritures supplémentaires donne une recherche dans l'éditeur ~13 ms. Les performances réelles varient selon ton navigateur et les données ; Plotly reste la dépendance graphique la plus lourde au premier chargement.

**Installation :** décompresser l'archive complète. Le nouveau module `src/history-plot.js` est requis ; le workflow GitHub Pages le publie. Les annotations en stockage local restent au format précédent, aucune migration ni réimport nécessaire. Exporter ses annotations avant de remplacer une version reste conseillé.

Modules modifiés : `Interface` et `Éditeur` **0.19.1**, nouveau module `Courbes historiques` **0.19.1**. Le moteur financier demeure en 0.16.0, les autres modules inchangés.

---

# qbudget — V0.19.0 · Tableau de bord + éditeur de données

**Deux vues, un seul produit et un seul modèle de données.** Dans `index.html`, sélectionne **Tableau de bord** ou **Éditeur de données**. Les modifications de l'éditeur se répercutent directement dans le tableau de bord et sont sauvegardées dans le stockage local du navigateur, comme auparavant.

L'éditeur affiche les **libellés lisibles** à la place des identifiants techniques : comptes et soldes de référence, règles de récurrence et leurs opérations liées, écritures bancaires et leurs annotations, saisies manuelles (datées ou flottantes). Il permet de rechercher, filtrer les types d'éléments, modifier les champs applicables et suivre les relations en cliquant sur les liens. Une rubrique relie **catégories → tags → opérations**. Les annotations sans opération correspondante (CSV non chargé, par exemple) restent visibles sous « Références non résolues » avec leur ID intact.

**Un seul éditeur de catégories** : celui de la version précédente est déplacé dans la vue Éditeur ; il conserve l'import/export `qbudget-categories.json`. Les onglets de réordonnancement à côté du Sunburst restent dans le tableau de bord.

**Aucun nouveau format de données.** Les boutons Importer/Exporter utilisent directement `qbudget-annotations.json` (même structure native `version:3` que précédemment), tandis que les relevés bancaires restent des `operations.csv` normalisés. Les lignes bancaires sont en lecture seule dans l'éditeur (seuls leurs tags, type et liens aux règles sont modifiables), alors que les opérations manuelles sont modifiables dans `manualRows`. Les identifiants de référence et les champs inconnus sont conservés. L'import remplace les annotations locales après confirmation, **jamais** le fichier original sur disque. Il faut exporter de nouveau pour récupérer les modifications en fichier ; penser à sauvegarder l'ancien JSON avant import.

**Installation :** décompresser l'archive complète avec `index.html`, `plotly.min.js` et le répertoire `src/`. Les modules ajoutés sont `src/editor.js` (interface d'édition) et `src/annotations.js` (lecture/écriture native partagée) ; aucune dépendance ni installation modulaire. GitHub Pages publie aussi ces deux fichiers.

**Versions des modules :** interface/éditeur/annotations `0.19.0` ; moteur financier `0.16.0`, tags `0.18.3`, normalisation `0.15.0`, sélection graphique `0.18.5`. Les calculs et exports d'audit n'ont pas été modifiés. 110 tests automatisés et un parcours Chromium **avec Plotly réel**, scripts injectés sans navigation réseau (18 contrôles d'interaction) ; publication GitHub Pages non testée en ligne.

---

### V0.18.5 — Répartitions avec saisies manuelles et prévisions

Les graphiques **camembert**, **Sunburst** et **Treemap** incluent désormais : les dépenses réalisées (importées ou manuelles), les opérations **manuelles prévues ayant une date**, et les échéances `FORECAST` produites par les règles de récurrence entre la date de consultation et la **fin de prévision** choisie. La période passée est conservée dans la répartition. Les opérations flottantes **sans date** n’y entrent pas.

Les graphiques indiquent le nombre d’opérations réalisées, prévues et récurrentes calculées. Leurs montants sont des **dépenses brutes** : les recettes ne viennent pas les annuler. La case d’exclusion des transferts fonctionne toujours. Un clic sur un secteur/rectangle retrouve dans le tableau les écritures enregistrées **et** les occurrences `FORECAST`, qui restent consultables mais non modifiables.

Il n’y a **pas de déduplication automatique** entre une saisie manuelle et une récurrence générée : si les deux décrivent la même dépense, elles apparaissent séparément dans les répartitions. Cela préserve la traçabilité des hypothèses.

Aucun changement du moteur des soldes, des exports d’audit, du calendrier de récurrences ni du graphique d’évolution des soldes. Les **flux mensuels** conservent pour l’instant leur affichage historique.

# qbudget — V0.18.4

Outil **local** de visualisation et simulation financière. Pas de compte bancaire connecté, pas de serveur de données, pas de base distante. Projet en développement : les projections sont des hypothèses, **pas** un outil comptable ou fiscal.



## V0.18.4 — Treemap et navigation graphique vers les écritures

La répartition hiérarchique Plotly propose désormais deux représentations du **même arbre de données** : **Sunburst** (anneaux) et **Treemap** (rectangles imbriqués). Choisis la vue avec les deux boutons radio directement au-dessus du graphique. L’ordre des catégories par onglets et la profondeur de 2 à 8 s’appliquent aux deux vues. Le choix est conservé dans les annotations JSON et le stockage du navigateur.

**Cliquer pour auditer une dépense :** clique sur une part du camembert ou un secteur du Sunburst/Treemap. qbudget filtre **uniquement le tableau** sur les écritures réelles composant exactement ce montant, et affiche une bannière avec leur nombre et leur total. Tu peux les consulter et leur ajouter un tag en lot. **« Voir toutes les opérations »** quitte ce détail. Modifier un filtre, une date ou le compte sélectionné abandonne également cette navigation ponctuelle.

Les transferts portant `transfert_intercomptes` restent exclus des deux répartitions si l’option est active ; ils ne sont pas automatiquement supprimés des écritures. Les recettes, opérations flottantes et prévisions ne sont pas comptées comme dépenses des graphiques. Les comptes, soldes, prévisions, exports d’audit, flux mensuels et courbe d’impact ne sont **jamais modifiés par un clic**. Le total du détail est calculé sur les opérations sources **une seule fois**, pas en additionnant les niveaux du graphique.

Le petit module `src/visual-select.js` fait cette correspondance lecture seule ; Plotly reste l’unique dépendance graphique. Versions affichées : interface et sélection graphique `0.18.4`, moteur financier `0.16.0`, tags `0.18.3`, normalisation `0.15.0`. La suite compte 99 tests. Les clics réels ont été contrôlés dans Chromium avec Plotly (scripts injectés ; déploiement Pages non vérifié).

## V0.18.2 — Tableau sur deux lignes

Dans le tableau des opérations datées, la première ligne montre la sélection, la date, le compte, le libellé, le montant et l'origine. Une seconde ligne regroupe les tags par catégorie, suivant l’ordre choisi sur les onglets du Sunburst, puis les tags libres. Pour les écritures enregistrées, elle conserve les contrôles d'édition des tags, de périodicité et de récurrence, ainsi que le signalement des doublons. Les occurrences FORECAST restent en lecture seule. Cette présentation ne change ni les exports, ni la sélection par lot, ni les calculs.

## V0.18.0 — Onglets glissables et Sunburst stabilisé

- **Réorganiser les dimensions :** dans « Tags · catégories et dimensions du tableau », fais glisser les onglets `⠿ Nature`, `⠿ Périodicité`, etc., vers leur nouvelle place. Les lignes d'édition, les colonnes du tableau et la hiérarchie du Sunburst se réorganisent ensemble. Pour une alternative clavier, focalise un onglet et utilise **Alt + ←/→**.
- **Profondeur :** le curseur Sunburst de 2 à 8 reste à la même place, même quand la liste descriptive des catégories à sa droite s'allonge. Sur petit écran, les contrôles passent à la ligne sans pousser le curseur.
- **Persistance :** le nouvel ordre reste une simple propriété du dictionnaire de catégories, conservée dans le stockage local et dans les exports JSON. Pas de migration à effectuer. Les opérations et soldes restent inchangés.
- **Modules :** Interface et Tags passent à 0.18.0 ; Moteur et Normalisation gardent leurs versions précédentes. 86 tests automatisés, parcours Chromium/Plotly du drag & drop, de l'alternative clavier et du curseur stable.

## V0.17.0 — Catégories prêtes à l’emploi, JSON indépendant, tags par lots, modules versionnés

**Catégories prêtes à l’emploi.** Un nouveau profil de qbudget démarre avec six dimensions éditables (Nature, Périodicité, Contexte, Entité, Traitement, Variabilité) et leurs tags usuels. Ces catégories n'imposent aucune règle aux opérations, et un tag inconnu reste utilisable. Un profil existant qui possédait déjà sa propre taxonomie est **conservé tel quel**, y compris un dictionnaire volontairement vide : utilise **« Catégories par défaut »** pour remplacer le dictionnaire manuellement.

**Exporter/importer uniquement les catégories.** Dans « Tags · catégories et dimensions du tableau » : **Exporter catégories JSON** télécharge `qbudget-categories.json` ; **Importer catégories JSON** remplace uniquement le dictionnaire après validation stricte (format `qbudget-tag-categories`, `schemaVersion: 1`, noms uniques et tags non ambigus). Les opérations, comptes, annotations, tags existants, soldes et règles ne changent pas. Les fichiers incomplets ou invalides sont refusés sans import partiel. **Catégories par défaut** restaure le dictionnaire de départ après confirmation. Un exemple prêt à importer est fourni dans `examples/categories-par-defaut.json`. L'export/import JSON général des annotations reste disponible et distinct.

**Ajouter un tag à un ensemble de lignes.** Dans « 8 · Opérations datées », commence par filtrer (mot-clé, compte, type, tags ET/OU). Coche individuellement des lignes ou clique **Sélectionner les résultats affichés** (au maximum les 1 000 lignes effectivement affichées), saisis **un tag**, puis **Ajouter le tag aux lignes sélectionnées**. Les tags existants sont conservés ; une seconde application n’ajoute pas de doublon. Le compteur indique combien de lignes ont réellement changé. La sélection est vidée quand les filtres changent, pour éviter de modifier par erreur des lignes masquées. Les occurrences `FORECAST · calculé` sont exclues, non sélectionnables. Les opérations flottantes restent modifiables individuellement dans leur file d’attente ; le bouton de lot concerne **le tableau des opérations datées** uniquement. Les montants, dates et prévisions ne sont jamais altérés par cette action.

**Organisation plus modulaire.** L'ancien gros JavaScript embarqué dans `index.html` se trouve désormais dans `src/ui.js`. Le dictionnaire, sa sérialisation JSON et l'opération de taggage par lot sont dans `src/tags.js`. Le moteur (`src/engine.js`) et l'importeur (`src/normalize.js`) restent des modules indépendants. La section **« Versions des modules »** en haut de l’interface affiche leurs versions spécifiques : une évolution du seul module de tags n'implique pas un changement de version du moteur. La version globale suit `package.json` et `src/version.js`. Le CLI, les générateurs de configuration/démo, les tests et la feuille CSS intégrée ne sont pas tous découpés en modules supplémentaires : nous évitons une refonte artificielle.

**Pour mise à jour :** exporte d'abord tes annotations JSON. Décompresse **toute** l'archive en conservant le dossier `src/` à côté de `index.html`. Ne copie pas `index.html` seul : il référence désormais explicitement `src/ui.js` et `src/tags.js`. Le site GitHub Pages publie ces nouveaux fichiers. `./run-tests.sh` vérifie 84 tests Node et la cohérence de version ; un parcours Chromium/Plotly a vérifié la recherche, la sélection de 24 lignes, le taggage groupé, les soldes et l'import/export JSON. Le test navigateur utilise une injection des scripts à cause des restrictions d'accès aux fichiers locaux de l'environnement ; ce n'est pas une certification du déploiement Pages.

## V0.16.0 — Dictionnaire de tags, tableau et Sunburst (2 à 8 niveaux)

**L’idée de Wallex : un tag saisi librement devient une dimension, sans compréhension métier codée en dur.**

1. Dans **« Tags · catégories et dimensions du tableau »**, cliquer sur **+ Catégorie**, donner un nom (ex. `Nature`) et saisir ses tags séparés par des virgules (`transport, repas, logement`). Les **onglets ⠿ glissables** déterminent l’ordre des colonnes de dimensions et de la hiérarchie du Sunburst. Supprimer une catégorie ne supprime aucun tag des opérations.
2. Dans **« 8 · Opérations datées et annotations »**, renseigner les tags librement, comme précédemment. Une colonne est automatiquement créée pour chaque catégorie ; **« Tags (saisie libre) »** conserve la liste complète, y compris les tags non classés. Un tag est affecté à une seule catégorie pour éviter les ambiguïtés. Si plusieurs tags appartiennent à une même catégorie, la colonne affiche tous les tags ; le graphique choisit le premier **uniquement pour éviter de compter deux fois le montant**. La règle est explicite et ne modifie ni la dépense ni sa liste de tags.
3. Déplacer le curseur **Sunburst · profondeur** de **2 à 8**. Les niveaux suivent l’ordre des catégories configurées. Si tu n’as que 3 catégories, monter à 8 conserve 3 niveaux : il ne crée pas de dimension fictive. Sans catégories, le Sunburst historique *premier tag → libellé* fonctionne toujours.
4. Les **boutons radio du camembert** choisissent une dimension pour le camembert **seulement**. Ils n’ont aucun effet sur les colonnes du tableau, le Sunburst ou les soldes. Recherche et filtres ET/OU restent communs au tableau et aux graphiques d’analyse.

**Périodicité :** créer une catégorie `Périodicité` avec les tags `Récurrent, Ponctuel`. La source « Tags libres » n’utilise que la classification explicite. La source facultative « Type existant » utilise le tag explicite s’il existe, puis, faute de tag, le champ `type` historique (dont les prévisions récurrentes). Cela **ne crée aucune règle de récurrence**. L’état d’une écriture (`RÉEL`, `PRÉVU`, `FORECAST`, `flottant`) reste entièrement distinct. Une écriture importée n’est pas déclarée ponctuelle par défaut.

**Exemple :** la démo fictive initialise six catégories (Nature, Périodicité, Contexte, Entité, Traitement, Variabilité), basées sur les tags des fixtures ; tu peux en ajouter deux de plus pour explorer huit niveaux. Les choix sont conservés dans le stockage local et dans l'export/import d'annotations JSON. **Sauvegarder les annotations avant une mise à jour** ; les anciens exports restent acceptés et démarrent avec un dictionnaire vide.

**Validations :** tests Node (`npm test`, dont `tests/tag_categories.test.js`) et vérification manuelle Chromium avec le vrai Plotly, sans erreurs JavaScript. Le moteur des soldes, l'audit complet et les règles de projection sont inchangés.

## V0.15.0 — Normalisation locale des relevés dans l’interface

Importer directement les CSV bruts BoursoBank, BPS ou Revolut depuis le navigateur, vérifier l'aperçu, puis confirmer l'import. La normalisation est locale ; le téléchargement du CSV normalisé et l'import historique sont conservés. Le script Python est facultatif pour l'utilisateur et reste utile pour tests/CLI. Aucun doublon n'est supprimé automatiquement.

## V0.14.0 — Filtres partagés et courbe d’impact, sans altérer les soldes

Dans **« 8 · Opérations datées et annotations »**, les filtres **Recherche**, **Type** et **Tags multiples (ET/OU)** pilotent ensemble le tableau ainsi que les graphiques **Flux mensuels**, **Donut** et **Sunburst**. Les répartitions présentent toujours les opérations **réalisées en EUR jusqu’à la date de consultation** ; elles n’incluent ni les opérations flottantes ni les échéances futures. Un montant portant plusieurs tags n’est compté **qu’une seule fois** ; le donut et le sunburst répartissent les dépenses suivant le premier tag, les autres servant au filtrage.

Le graphique **« Évolution et forecast »** reste le **solde bancaire intégral**, totalement indépendant des filtres de recherche/type/tags. Dès qu’au moins un de ces filtres est actif, une **courbe turquoise supplémentaire** représente le **cumul signé des opérations sélectionnées, partant de 0 €**, sur **un axe vertical droit distinct**. Elle n’est **ni un solde bancaire ni un solde hypothétique** : elle mesure l’impact des mouvements correspondant aux filtres. La partie réalisée est en trait plein et les mouvements futurs en tirets. Le solde historique reste bleu, sa prévision orange et chaque compte exclu garde sa courbe spécifique.

- La courbe turquoise inclut les opérations réalisées correspondant aux filtres dans l’historique visible et les opérations datées futures jusqu’à l’horizon. Si **« Afficher les récurrences futures »** est coché, elle inclut aussi leurs échéances calculées, sans jamais les enregistrer comme écritures.
- Les opérations flottantes restent **hors de tous les calculs**, même si elles correspondent aux tags recherchés.
- En vue **Tous les comptes**, l'impact filtré concerne les comptes **inclus dans le cumul** ; les autres courbes hors cumul sont inchangées. En sélectionnant un compte individuel, son impact filtré fonctionne même si ce compte est exclu du global.
- Lorsque les filtres sont effacés, la courbe d'impact disparaît. Le choix de tri des lignes ne modifie jamais les graphiques.
- Pour examiner les chiffres sans altérer les données : **`qbudget.impact()`** dans la console navigateur. Cette méthode reprend la période de la courbe affichée et renvoie les points réalisés et projetés.

**Tests :** 61 tests Node (dont 6 nouveaux sur filtres ET/OU, projeté/réalisé, conservation des soldes, comptes exclus et non-multiplication par les tags), ainsi qu'un parcours Chromium/Plotly réel par chargement de la démo et filtrage d'une dépense « Essence » de −68,40 € : aucune modification des soldes constatée.

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
| `src/visual-select.js` | Relie les secteurs Plotly aux écritures du tableau, sans modifier les opérations |
| `src/cli.js` | CLI Node.js pour les commandes ponctuelles et les scripts (`qbudget --version`) |
| `src/repl.js` | REPL pour explorer les données et simuler plusieurs scénarios en mémoire |
| `src/version.js` | Version du navigateur, générée depuis `package.json` |
| `src/demo.js` | **Démo fictive** générée depuis les fixtures des tests |
| `import_releves.py`, `banques.json` | Normalisation Python conservée pour CLI/tests et configuration des banques |
| `src/normalize.js`, `src/bank-config.js` | Normalisation JavaScript native dans le navigateur, profils générés depuis `banques.json` |
| `tests/` | Fixtures et tests sans données privées |
| `run-tests.sh` | Test local et GitHub Actions |

`package.json` est la source de vérité du numéro de version. Exécuter `python3 scripts/sync-version.py` après l'avoir changé : le test vérifiera la synchronisation.

## Navigateur

Garder `index.html`, `plotly.min.js`, `src/engine.js`, `src/normalize.js`, `src/bank-config.js`, `src/version.js` et `src/demo.js` aux mêmes emplacements. Ouvrir `index.html` ou, en cas de limitation de `file://`, démarrer :

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

### Ergonomie V0.18.1 — onglets et Sunburst

Les **onglets de catégories sont placés directement au-dessus du Sunburst**. Glisse-les pour changer l’ordre des dimensions affichées, sans quitter le graphique ; les colonnes du tableau suivent le même ordre. Au clavier, utilise `Alt + ←/→` lorsque l’onglet est sélectionné. Le panneau « Tags · catégories » reste consacré à l’édition du dictionnaire et aux imports/exports JSON.

### Transferts entre comptes et graphiques de répartition (V0.18.3)

Pour un virement entre tes comptes (par exemple BoursoBank → BPS), ajoute manuellement `transfert_intercomptes` aux **deux** écritures, éventuellement via la sélection multiple des résultats de recherche. Par défaut, le camembert et le Sunburst ignorent les lignes portant ce tag ; une case à cocher dans chacun des deux graphiques permet de réafficher ces mouvements (les deux cases sont synchronisées). Les autres graphiques, le tableau, les soldes et l’audit conservent **tous** les mouvements, sans suppression ni compensation automatique.

Le tag appartient à la catégorie **Traitement** du catalogue par défaut. Lors d’une mise à jour depuis V0.18.2, une catégorie Traitement strictement conforme à l’ancien catalogue reçoit le nouveau tag ; les catégories personnalisées ne sont jamais écrasées (le tag libre reste utilisable et peut être ajouté manuellement au catalogue). La préférence d’exclusion est sauvegardée et exportée avec les annotations. Une fois la mise à jour du catalogue réalisée, retirer volontairement le nouveau tag du dictionnaire ne le réintroduit pas au prochain chargement.
