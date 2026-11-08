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
