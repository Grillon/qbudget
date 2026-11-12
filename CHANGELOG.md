# qbudget V0.20.0 — Corrections de fiabilité et outils Node uniques

- Rattacher une annotation ne crée plus d’alias concurrent d’une autre identité bancaire : les tags futurs ne peuvent plus être détournés lors du retour d’une opération absente d’un import partiel.
- Export CLI au format natif incluant toutes les manuelles et flottantes, et restauration des anciens exports qui les stockaient dans `rows`. Échecs de stockage signalés durablement, sans message de sauvegarde réussie ; les données en mémoire restent exportables.
- Noms de comptes contenant « · » préservés ; ancienne migration limitée aux correspondances prouvées et sans fusion de références ambiguës.
- Dates calendaires strictes, horizons CLI/REPL cohérents en fin de mois et comptes sans transaction accessibles dans le REPL. Calendrier de récurrences partagé par prévision et audit, sans plafond silencieux de 600 échéances.
- Soldes et projections EUR indisponibles avec diagnostic si le périmètre contient une devise incompatible, sans conversion ou suppression de ligne. Le tableau de bord utilise directement la prévision du moteur.
- Index locaux de rapprochement et contextes de lecture par calcul/rendu, formatteurs monétaires réutilisés, absence de reconstruction des backlogs cachés et préservation des brouillons ouverts.
- Importateur Node utilisant le même normaliseur que le navigateur, générateurs Node et suppression des quatre scripts Python. Formats numériques configurables, encodages, précision décimale et CSV multilignes couverts sans moteur d’import parallèle.
- Tests de régression sur les défauts reproduits et parcours fonctionnels Firefox versionnés, exécutés en CI avant publication. Documentation courante réécrite, historique conservé ici.

---

# qbudget V0.19.12 — Validation des transferts en un clic

- Suppression de la confirmation supplémentaire pour ajouter `transfert_intercomptes` depuis le backlog, sur une paire ou en groupe. Le clic sur le bouton constitue la validation.
- Vérification des correspondances au moment de l’ajout et refus atomique des données devenues ambiguës conservés.

---

# qbudget V0.19.11 — Transferts intercomptes potentiels

- Détection manuelle des paires lisibles : même date, même devise, montants exactement opposés et comptes distincts, y compris deux comptes sources d’une même banque.
- Backlog sauvegardé avec preuves et décisions d’ignorer ; ambiguïtés signalées sans choix arbitraire. Les doubles débits restent manuels.
- Valider ajoute uniquement `transfert_intercomptes` aux deux lignes. Les tags présents déterminent le traitement, y compris après une édition manuelle ; aucun état de validation indépendant.
- Validation groupée revérifiée et atomique ; imports partiels, réordonnancement et anciennes sauvegardes compatibles. Aucun changement aux montants, soldes ou exports d’audit.
- Proposition de catégories d’exploration documentée et JSON facultatif, sans modification du catalogue par défaut ou des données personnelles.

---

# qbudget V0.19.10 — Tri et nombre de lignes dans l’éditeur

- En-têtes de données cliquables au clavier comme à la souris : date, compte, élément, montant signé et tags. Alternance croissant/décroissant avec flèche et indication accessible du sens.
- Tri de toutes les correspondances avant découpage de l’affichage, valeurs absentes en fin de liste dans les deux sens et égalités stables. Filtres et sélection restent actifs.
- Choix de 120, 250, 500 ou 1 000 lignes par affichage, conservé lors des recherches ; le bouton d’affichage supplémentaire utilise le même nombre.
- Aucun changement de l’ordre bancaire enregistré, des annotations, des calculs financiers ou du format JSON.

---

# qbudget V0.19.9 — Repérage et suggestion de tags dans l’éditeur

- Cases Sans tags et Libellés partiellement tagués, combinables avec la recherche et les filtres existants. Les résultats sont les correspondances du tableau, taguables par sélection ou en totalité sans mot-clé.
- Comparaison du même libellé normalisé sur le même compte source, dans tout l’historique chargé ; tags manuels et automatiques pris en compte.
- Préremplissage modifiable avec les tags communs aux opérations similaires taguées. Aucun choix arbitraire en cas de contradiction, aucune application automatique et aucune saisie manuelle écrasée.
- Repérage sans modification des opérations, annotations, règles, montants ou calculs. Les corrections utilisent le format JSON existant.

---

# qbudget V0.19.8 — Ajout groupé de plusieurs tags

- Ajout de plusieurs tags séparés par des virgules, sur la sélection ou sur tous les résultats filtrés, dans le tableau de bord et l’éditeur.
- Seuls les tags manquants sont ajoutés, sans doublons de casse ; les tags existants, annotations et calculs sont préservés. Les compteurs portent sur les opérations modifiées.
- Le retrait reste limité à un seul tag, avec une aide explicite lorsque plusieurs sont saisis. Le format JSON ne change pas.

---

# qbudget V0.19.7 — Backlog des récurrences potentielles

- Détection déclenchée manuellement sur les opérations réalisées : compte source, libellé normalisé ou alias explicites, au moins trois occurrences régulières.
- Backlog persistant avec opérations observées, montant et fréquence proposés, création modifiable puis confirmée ou décision d’ignorer réversible.
- Aucune modification financière avant validation. Création d’une règle native, tags conservés et échéances auditables par les exports existants.
- Scans sans doublons, décisions exportées et restaurées en JSON ; création refusée sur un historique devenu absent ou modifié.

---

# qbudget V0.19.6 — Retrait groupé des tags manuels

- Retrait d’un tag sur la sélection ou sur tous les résultats filtrés, dans le tableau de bord et l’éditeur, y compris au-delà des limites d’affichage.
- Aperçu du nombre d’opérations concernées et confirmation avant retrait ; correspondance exacte et insensible à la casse.
- Autres tags, annotations, identifiants, opérations flottantes, règles et montants conservés. Le champ historique `tag` est mis à jour pour éviter toute réapparition du tag supprimé.
- Les tags d’associations ne sont pas supprimés : le nombre d’opérations où le tag restera automatique est signalé. Les associations et le type restent gérés dans leurs réglages.

---

# qbudget V0.19.5 — Rapprochements à traiter après import

- Les ambiguïtés d’identité sont reportées dans une liste persistante : plus de questions de rapprochement pendant l’import navigateur.
- Toutes les lignes sont conservées et comptées ; les annotations incertaines ne sont pas attribuées automatiquement. Le bandeau indique que les statistiques par tags peuvent évoluer après traitement.
- Rattachement à une identité historique ou confirmation d’une opération distincte après import, sans fusion de lignes ni écrasement d’annotations différentes.
- Liste sauvegardée dans le registre d’identités du JSON existant. Imports partiels, opérations flottantes et associations de libellés préservés ; mode CLI strict inchangé.

---

# qbudget V0.19.4 — Réimports fiables et associations de libellés

- Identités bancaires stables et rapprochement au réimport, avec migration compatible des annotations et résolution explicite des ambiguïtés. Opérations manuelles et flottantes préservées.
- Associations de mots ou expressions littérales vers un tag existant, avec conditions OU, aperçu avant enregistrement et modification/suppression dans l’éditeur.
- Classement recalculé sur les opérations existantes et les futurs imports, sans copier les tags automatiques dans les annotations manuelles ni modifier les libellés originaux.
- Associations persistantes dans le navigateur et dans les annotations JSON ; même comportement dans le moteur Node et le navigateur. Anciens fichiers acceptés.
- Version produit, interface, éditeur, annotations et moteur en 0.19.4 sur dev. Aucune modification des calculs financiers ou création automatique de récurrences.

---

# qbudget V0.19.3 — Éditeur compact, sélection multiple et filtres montant/période

- **Tableau compact pleine largeur** dans l'onglet Éditeur ; aucune liste latérale étroite, pas de défilement horizontal au format bureau. Détail modifiable dans une fenêtre à la demande, non ouvert par le simple fait de sélectionner une ligne.
- Clic, `Ctrl/Cmd + clic`, `Shift + clic` pour la sélection ; recherche **Texte et Regex inchangée**, avec actions séparées pour taguer la sélection ou **toutes** les correspondances, même au-delà du lot affiché.
- Filtres **montant absolu min/max** (positifs, inclusifs, virgule ou point décimal) et **date de début/fin** inclusives, tous combinables avec recherche Texte/Regex. Filtre montant ou date seul suffit à autoriser l'action groupée ; valeurs invalides bloquées. Les opérations flottantes sont exclues uniquement si la période les exclut.
- Bouton « Effacer ces filtres » sans effacer la recherche ; les filtres sont une sélection temporaire, ni règles ni données persistées.
- Moteur financier, tags, prévisions, import/export JSON et CSV **inchangés**. Seul le module Éditeur est en 0.19.3 ; l'enveloppe produit affiche 0.19.3.
- Tests unitaires de sélection, de bornes, de combinaison Regex+période+montant, de taggage et de conservation des montants ; vérification de l'interface sous Chromium via chargement direct des scripts, sans publication distante.

---

# qbudget V0.19.2 — Recherche Regex et taggage des correspondances

**Sélectionner → vérifier → taguer, sans règle implicite.** La recherche existante du tableau de bord et celle de l'éditeur acceptent désormais un mode **Texte** (comportement historique) ou **Regex** (expressions régulières natives JavaScript, insensibles à la casse).

Exemples :

- `CARREFOUR|AUCHAN|LECLERC` : plusieurs commerçants en une recherche.
- `^VIR|VIREMENT` : libellés qui commencent par VIR ou comportent VIREMENT.
- `ESSENCE|CARBURANT|PÉAGE` : regrouper les frais de déplacement pour inspection.

La recherche s'applique comme avant aux **libellés, comptes et tags** (ainsi qu'à la devise côté tableau de bord). Les filtres Compte, Type et Tags ET/OU restent combinables. **Le tableau lui-même constitue l'aperçu** ; une ligne indique combien d'opérations enregistrées correspondent et combien d'échéances `FORECAST` ne sont pas modifiables. Dans l'éditeur, le compteur donne aussi le nombre d'opérations taguables dans les résultats.

**Deux actions différentes :**

1. « Ajouter le tag aux lignes sélectionnées » reste disponible et ne touche que les cases cochées.
2. « Taguer toutes les correspondances » ajoute le tag à **toutes les opérations enregistrées** répondant à la recherche, y compris au-delà des 150 premières affichées. L'éditeur propose la même action sur les opérations de ses résultats. L'action exige un motif non vide, un tag et une confirmation explicite. Les tags existants sont conservés, et les tags déjà présents ne sont pas dupliqués.

Une Regex invalide affiche un message et **bloque le taggage groupé** au lieu d'élargir les résultats. Limite de 250 caractères par motif. Les expressions utilisent la syntaxe JavaScript (`RegExp`), sans notation `/.../`. Aucun pattern n'est enregistré comme règle ni appliqué automatiquement aux imports : cette automatisation pourra être envisagée plus tard si elle devient utile.

**Architecture :** aucune dépendance ajoutée, aucun nouveau format, aucun calcul financier changé. Le module Moteur passe en 0.19.2 parce que son **filtre partagé** sait interpréter Regex ; les calculs de soldes et prévisions ne changent pas. Interface et Éditeur passent en 0.19.2 ; les autres modules gardent leur version. Les imports/exports natifs `operations.csv`, `qbudget-annotations.json` et `qbudget-categories.json` ne changent pas. Pense à exporter tes annotations avant mise à jour.

**Tests :** tests Node pour les Regex, les motifs invalides, les tags ET/OU, la prévision, l'absence de doublon, les soldes et l'audit. Vérification interactive dans Chromium avec Plotly réel, en chargeant les scripts par injection (le navigateur de cet environnement bloque l'ouverture directe des fichiers locaux). Le déploiement GitHub Pages n'a pas été testé.

---

## 0.19.1 — Accélération des interfaces (9 novembre 2026)

- Évite tous les rendus de vues masquées, notamment Plotly pendant une édition et l'éditeur sur chaque sauvegarde.
- Affichage progressif : 150 lignes par lot dans le tableau, 120 éléments par lot dans l'éditeur ; recherches et filtres restent globaux.
- Rubrique des liens catégories/tags calculée uniquement à son ouverture, en un passage sur les écritures ; sélection d'élément sans reconstruire la liste entière.
- Courbes historiques en O(n log n), module `src/history-plot.js`, moteur financier inchangé et points vérifiés sur données de test.
- Rafraîchissement des graphiques légèrement différé pour les filtres saisis au clavier et redimensionnement sans reconstitution de tous les graphiques.
- Publication GitHub Pages du nouveau module ; annotations JSON et CSV inchangés.

# V0.19.0 — Éditeur de données intégré à qbudget

- Navigation entre **Tableau de bord** et **Éditeur de données**, partageant le même modèle en mémoire, les mêmes opérations, les mêmes catégories et le même stockage local. Une seule application, aucun second outil à installer.
- Vue éditable des saisies manuelles, annotations bancaires, récurrences, comptes/références ; liaisons visibles par leurs libellés plutôt que par leurs identifiants techniques ; références orphelines conservées et recherchables.
- Dictionnaire de catégories **déplacé**, pas recopié ; exploration catégorie → tag → opérations, filtre/recherche.
- `src/annotations.js` centralise le **format natif** d'export/import d'annotations, partagé par les deux vues. `qbudget-categories.json` reste inchangé. Pas de nouveau schéma. Champs JSON inconnus et identifiants conservés. Import atomique et confirmation avant remplacement des annotations locales.
- `src/editor.js` expose l'interface indépendante du moteur ; aucun changement à `src/engine.js`, `src/tags.js`, `src/normalize.js`, `src/visual-select.js`. GitHub Pages, documentation et suite de tests mis à jour.
- Tests : 110 automatisés réussis et 18 étapes interactives Chromium avec Plotly réel (scripts injectés). Aucune erreur JS. Déploiement GitHub Pages non validé en ligne.

## V0.18.5 — Saisies manuelles et prévisions dans les répartitions

- Camembert, Sunburst et Treemap : les **saisies manuelles datées** (réalisées ou prévues) sont incluses, ainsi que les **échéances récurrentes calculées** jusqu’à la date de fin de prévision choisie.
- Les écritures enregistrées sont conservées une seule fois, les récurrences sont virtuelles et non enregistrées ; les opérations flottantes sans date restent exclues.
- Les comptes hors cumul restent exclus de la vue globale et consultables individuellement ; filtres par tags et exclusion `transfert_intercomptes` conservés.
- Rappel explicite du périmètre analysé à côté des graphiques, avec compteurs par provenance. Les graphiques montrent les **dépenses brutes**, non des soldes ou flux nets.
- Navigation depuis le camembert / Sunburst / Treemap : les lignes `FORECAST` sont retrouvables dans le tableau même si la case générale « Afficher les récurrences futures » est décochée. Elles demeurent non éditables.
- Modules modifiés : `src/ui.js` et `src/visual-select.js` (v0.18.5). Moteur `src/engine.js` (v0.16.0) inchangé.
- Tests de régression : présence des opérations manuelles datées, bornes d’horizon, exclusion des flottantes, conservation des comptes exclus et des montants, clic graphique vers FORECAST ; test interactif Chromium avec Plotly.

**Attention** : aucun rapprochement automatique n’est effectué entre une saisie datée et une échéance générée semblable. Les deux peuvent apparaître dans une même répartition et doivent être auditées séparément.

# V0.18.4 — Navigation graphique et Treemap

- Vue au choix **Sunburst / Treemap Plotly** dans le même panneau, sans ajout de dépendance ; partage de l’ordre des catégories, du curseur de profondeur et de la même agrégation de dépenses.
- Cliquer sur une part du camembert ou un nœud Sunburst/Treemap affiche **les écritures exactes qui composent son montant** dans le tableau, avec un compteur, un total et un bouton de retour. La sélection par clic ne change pas les filtres globaux ni les soldes.
- Exclusions de transferts respectées ; aucun montant multiplié par le nombre de niveaux ou de tags. La somme du détail est recomptée une fois par opération source.
- Petit module indépendant `src/visual-select.js` (0.18.4), interface 0.18.4 ; moteur financier 0.16.0, tags 0.18.3 et normalisation 0.15.0 inchangés. Choix de vue exportable en JSON, publication Pages inclut le nouveau module.
- 99 tests automatisés, parcours Chromium/Plotly : affichage Treemap, sélection camembert/Sunburst/Treemap et retour au tableau ; aucun changement du moteur financier.

# V0.18.3 — Transferts intercomptes dans les répartitions

- Nouveau tag prédéfini `transfert_intercomptes` dans la catégorie **Traitement** ; les tags des écritures demeurent libres, aucune détection ou attribution automatique.
- Camembert et Sunburst excluent **par défaut** les opérations portant ce tag, avec option synchronisée sur les deux cartes pour afficher les transferts. Filtre appliqué après les filtres de recherche / période / compte, sans modifier le moteur financier.
- Solde, prévision, audit, flux mensuels, tableau des opérations et courbe d'impact ne sont jamais modifiés par cette préférence d'affichage.
- Préférence conservée dans le navigateur et l'export/import des annotations. Migration ciblée du dictionnaire Traitement conservé à l'identique depuis la version précédente ; les dictionnaires personnalisés restent respectés.
- Versions : interface et module Tags 0.18.3 ; moteur 0.16.0 et normalisation 0.15.0 inchangés.

# V0.18.2 — Tableau compact : données puis tags par catégorie

- Chaque opération enregistrée ou prévisionnelle est affichée sur deux lignes visuelles : informations financières en haut, tags regroupés par catégorie et contrôles en dessous. Le modèle et les calculs restent inchangés.
- La liste de tags, le type, le lien aux récurrences et les alertes de doublon restent accessibles sous chaque écriture. Les prévisions calculées restent en lecture seule ; sélection et ajout groupé de tags inchangés.
- Aucune dépendance ajoutée ; seul le module UI est passé en version 0.18.2.

# V0.18.1 — Onglets de dimensions à côté de leur graphique

- Les onglets de catégories sont déplacés depuis la rubrique d’édition des tags vers le **haut du panneau Sunburst**, directement au-dessus du graphique ; le réordonnancement agit immédiatement sur le Sunburst et les colonnes du tableau.
- Suppression du saut automatique vers l’éditeur lorsqu’on clique sur un onglet : la visualisation reste sous les yeux. Le glisser-déposer et le raccourci Alt + ←/→ restent disponibles.
- Le dictionnaire, son import/export JSON, l’ordre persistant des catégories et le moteur financier sont inchangés. Mise à jour de l’interface seule (0.18.1) ; module Tags toujours 0.18.0.

# V0.18.0 — Ergonomie Sunburst et réorganisation des catégories par onglets

- **Curseur de profondeur stable** : largeur et position fixes (2 à 8), quelle que soit la longueur de la description dynamique des dimensions affichée à droite. Mise en page responsive sans bibliothèque.
- **Onglets de catégories glissables** au-dessus du dictionnaire, à la place des boutons ↑/↓ catégorie par catégorie. Un déplacement réordonne simultanément les colonnes du tableau et les dimensions du Sunburst. Possibilité de réordonner au clavier avec Alt + ←/→.
- L'ordre des catégories est toujours enregistré dans le dictionnaire actuel (local et JSON import/export). Aucune modification des opérations, montants, comptes, soldes, règles, graphiques de flux ou de répartition.
- Versions mises à jour : application, interface et module Tags 0.18.0 ; moteur et normaliseur inchangés. Deux nouveaux tests de non-régression, soit **86 tests**. Vérification interactive Chromium/Plotly du déplacement des onglets et de la position du curseur ; vérification du rechargement local non réalisée en navigateur, mais export/import de l'ordre testé.

# V0.17.0 — Catalogue de catégories, import/export JSON dédié, taggage groupé, modules visibles

- Six catégories de tags fournies par défaut, éditables et remplaçables sans toucher aux opérations ; anciens réglages locaux respectés.
- Export JSON autonome `qbudget-categories.json` + import validé avant modification, sans effet sur les annotations bancaires ou les références ; fichier d'exemple livré.
- Filtrage par mot-clé/compte/tags puis sélection individuelle ou de toutes les lignes affichées ; ajout d’un tag en masse sans écraser les tags précédents. Lignes de forecast calculées jamais modifiables ; sélection remise à zéro aux changements de filtre.
- Extraction de l’interface vers `src/ui.js`, nouvelle bibliothèque autonome `src/tags.js`, versions spécifiques des modules affichées dans l’interface ; scripts GitHub Pages mis à jour pour publier les nouveaux modules.
- 84 tests automatisés, vérification Chromium/Plotly avec 24 opérations « Supermarché », valeur globale inchangée et réimport du catalogue JSON. Pas de dépendance supplémentaire.

# V0.16.0 — Tags organisés et exploration multidimensionnelle façon Wallex

- Dictionnaire éditable de catégories et tags : les tags restent saisis librement, et le tableau les redistribue automatiquement dans une colonne par dimension, dans l’ordre choisi avec ↑/↓. Aucun changement des opérations bancaires ni des formules de solde.
- Nouvelle rubrique de gestion des catégories ; ajout, renommage, édition des valeurs, suppression, réordonnancement. Les tags non classés restent consultables et éditables ; un tag appartient à une catégorie au maximum pour rendre le regroupement déterministe.
- **Sunburst Plotly** : reprend l’ordre des dimensions du tableau et propose un curseur de profondeur de 2 à 8 ; si le dictionnaire possède moins de catégories, il affiche seulement les catégories disponibles. Un même montant apparaît une seule fois par niveau, y compris en présence de plusieurs tags de la même catégorie. Sans dictionnaire, le mode historique tag/libellé reste disponible.
- **Camembert Plotly** : boutons radio indépendants pour choisir la catégorie de répartition, sans modifier le tableau ni le Sunburst.
- La dimension Périodicité peut afficher un tag explicite (`Récurrent`/`Ponctuel`) ou reprendre à défaut la classification historique du tableau, sans créer de récurrence. Ce n’est ni l’état d’une opération (réalisé, prévu, flottant) ni une règle financière.
- Démo avec six dimensions configurées à partir des tags existants ; jusqu’à huit dimensions sont possibles en ajoutant des catégories. Filtres existants, comptes exclus du cumul, opérations flottantes, import bancaire local et exports inchangés.
- Export/import des annotations JSON inclut le dictionnaire, le choix du camembert et la profondeur. Anciens exports sans catégories acceptés. Les fonctions du moteur demeurent accessibles en Node.js pour tester et expérimenter.
- Tests ciblés de taxonomie, niveaux 2 à 8, non-duplication des montants, indépendance des soldes et navigation ; parcours Chromium avec Plotly réel (démo, slider, camembert, réorganisation) sans erreur JavaScript.

# V0.15.0 — Normalisation des relevés dans le navigateur

- Import direct de plusieurs CSV bancaires bruts (BoursoBank, BPS, Revolut), sans dépendance ni serveur : sélection → prévisualisation → import explicite.
- Même configuration `banques.json` embarquée localement ; profils personnalisés rechargeables via l'interface.
- Encodages UTF-8 (avec BOM) et Windows-1252, détection des formats, dates ISO, décimales virgule/point et traitement correct des débits BPS négatifs.
- SHA-256 identiques au script Python (Web Crypto ou repli JS natif), doublons **signalés et conservés**, jamais supprimés ; sortie CSV optionnelle pour le CLI.
- Échec atomique sur fichiers/lignes invalides, sans modifier les données du tableau ; parcours ancien « CSV déjà normalisé » conservé.
- Tests de parité octet pour octet navigateur/Python, sans modification du moteur de soldes ni des prévisions.

# V0.14.0 — Filtrage partagé et impact cumulé indépendant des soldes

- Recherche, type et tags ET/OU partagés entre tableau des opérations et graphiques de flux / répartition / sunburst.
- Superposition conditionnelle sur le graphique de trésorerie d'une courbe d'impact financier filtré (cumul signé partant de zéro, axe droit séparé, réalisé plein / futur tirets). Soldes bancaires et audit inchangés.
- Respect des comptes exclus du cumul ; les opérations flottantes restent hors calcul ; les récurrences futures sont projetées seulement si leur affichage est activé.
- Fonction pure `operationMatchesFilter` et `filteredImpact` dans le moteur, réutilisables pour les tests et la console `qbudget.impact()`.
- 61 tests automatisés réussis, parcours Chromium/Plotly de la démo et filtrage « Essence » sans altération du solde.

# V0.13.0 — Comptes exclus du cumul et sections réorganisables

- Inclusion/exclusion explicite de chaque compte dans les calculs globaux ; consultation indépendante toujours possible, données et audit complet inchangés.
- Vue « Tous les comptes » : cumul des comptes inclus + courbe distincte par compte exclu (légende « hors cumul »), sans double comptage. Flux, catégories et indicateurs agrégés respectent l'inclusion.
- Sauvegarde `excludedAccounts` dans le modèle et l'export/import JSON d'annotations, rétrocompatibilité avec les anciens exports ; le moteur et le CLI partagent les mêmes règles.
- Déplacement de l'ensemble des cartes (y compris les graphiques et indicateurs) via poignée HTML5 Drag & Drop, boutons ↑/↓, remise en ordre d'origine ; ordre sauvegardé séparément dans localStorage, aucun effet sur les calculs.
- `qbudget.comptes()` dans la console ; invariant ajouté à `qbudget.test()`.
- 55 tests automatisés réussis. Vérification complémentaire Chromium avec Plotly réel : Qonto et BPS exclus, consultation individuelle, courbes, glisser-déposer et reset.

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
