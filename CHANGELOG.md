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
