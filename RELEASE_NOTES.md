# qbudget — Notes de version

Ce document récapitule les évolutions récentes et leur état dans **0.20.8**. Le [README](README.md) décrit l’utilisation actuelle ; le [CHANGELOG](CHANGELOG.md) conserve le détail historique.

## 0.20.8 — Sauvegarde complète en un fichier

**Exporter sauvegarde complète** réunit les opérations bancaires chargées, les saisies manuelles et toutes les annotations dans `qbudget-sauvegarde.json`. **Restaurer sauvegarde complète** permet de retrouver ce budget sans CSV complémentaire, après validation du fichier et confirmation du remplacement si des données sont déjà présentes.

Les saisies manuelles réalisées, prévues et flottantes sont incluses. Elles restent aussi dans l’export séparé des annotations, conservé pour les échanges et le CLI. Les échéances calculées sont recalculées depuis les règles et ne sont pas dupliquées comme opérations. [Guide des sauvegardes](docs/sauvegardes.md).

## 0.20.7 — Retrait du rapprochement automatique des récurrences

Le rapprochement automatique des mouvements répétés est abandonné. Les boutons de détection, la validation automatique des périodicités et le backlog associé sont retirés de l’interface.

Les récurrences manuelles et le forecast restent disponibles, ainsi que toutes les améliorations de l’exploration, des catégories, du retagage et du mobile. Le rapprochement des transferts intercomptes reste actif.

Les propositions et décisions des versions précédentes sont conservées dans les sauvegardes comme archives passives. Les tags, annotations et règles déjà validés ne sont pas effacés. Les règles semestrielles existantes restent calculables et éditables. Le retour arrière ne réécrit pas les décisions déjà enregistrées dans les données de l’utilisateur.

## Récapitulatif des versions 0.20

| Version | Évolution | État dans 0.20.8 |
|---|---|---|
| 0.20.0 | Fiabilité des annotations et réimports, exports CLI complets, erreurs de stockage visibles, calendrier partagé, contrôles des devises et outils Node unifiés. | Conservé |
| 0.20.1 | Perspectives guidées du Sunburst / Treemap, choix des dimensions, ordre libre, profondeur de 1 à 8 et sauvegarde des préférences. | Conservé |
| 0.20.2 | Dictionnaire Entité, Projet, Poste, Contexte, Finalité, Périodicité, Traitement / État et Variabilité ; tags libres et catégories personnalisables. | Conservé |
| 0.20.3 | Retagage opération par opération sur les résultats ou la sélection, un choix par catégorie, navigation et conservation des tags libres. | Conservé |
| 0.20.4 | Interface mobile, fiches d’opérations, tri et retagage tactiles ; fusion de personnel vers Perso. | Conservé |
| 0.20.5 | Expérimentation de rapprochements par libellé et montant, six périodicités et validation dans un backlog. | Retiré |
| 0.20.6 | Expérimentation de priorité aux rythmes courts, contexte sur deux ans et propositions ponctuelles. | Retiré |
| 0.20.7 | Abandon du rapprochement automatique, compatibilité des anciennes données et documentation actualisée. | Conservé |
| 0.20.8 | Sauvegarde complète restaurable sans CSV, avec toutes les saisies manuelles et annotations. | Version courante |

## Évolutions précédentes de la série 0.19

| Versions | Évolution | État actuel |
|---|---|---|
| 0.19.3 | Identités bancaires stables et conservation des annotations lors des réimports ; publication principale et développement avec stockages séparés. | Conservé |
| 0.19.4 | Associations de libellés vers des tags, sans réécriture des libellés bancaires. | Conservé |
| 0.19.5 | Backlog des identités bancaires ambiguës, sans attribution arbitraire des annotations. | Conservé |
| 0.19.6 | Retrait groupé d’un tag manuel, autres annotations conservées. | Conservé |
| 0.19.7 | Première détection indicative de récurrences. | Détection retirée en 0.20.7 ; règles manuelles conservées |
| 0.19.8 | Ajout groupé de plusieurs tags, sans doublons. | Conservé |
| 0.19.9 | Repérage des opérations sans tags et suggestions communes pour les libellés partiellement classés. | Conservé |
| 0.19.10 | Tri de l’éditeur, pagination réglable et sélection conservée. | Conservé |
| 0.19.11–0.19.12 | Détection des transferts intercomptes, contrôle des ambiguïtés et validation par tags en un clic. | Conservé |

## Données et fonctionnement

qbudget reste local, sans base de données ni serveur applicatif obligatoire. Les CSV et le JSON natif d’annotations restent utilisables séparément. La sauvegarde complète réunit les opérations bancaires chargées, les manuelles et les annotations pour une restauration en un seul fichier. Les données sont propres au navigateur et à l’appareil ; leur transfert passe par l’export et l’import des fichiers.

Les graphiques conservent une seule contribution par opération à chaque niveau, même si une opération porte plusieurs tags d’une catégorie. Les flottantes restent hors calcul financier. Les nouvelles dimensions automatiques Compte / Support et Flux ne sont pas ajoutées par ce retour arrière.
