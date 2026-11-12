# Catégories d’exploration

Depuis la version 0.20.2, le nouveau dictionnaire remplace les anciennes catégories au chargement du navigateur et à l’import d’anciennes annotations. Aucune fusion avec les anciennes catégories n’est effectuée. **Les annotations et les liens de récurrence sont conservés. Les tags restent inchangés, à l’exception de la fusion explicite personnel → Perso depuis 0.20.4.** Un tag absent du dictionnaire reste libre : il demeure visible et utilisable dans les recherches et filtres.

Le [JSON des catégories](../examples/categories-exploration.json) utilise toujours `qbudget-tag-categories`, `schemaVersion: 1`. Il est aussi fourni comme [catalogue par défaut](../examples/categories-par-defaut.json).

| Dimension | Valeurs et rôle |
|---|---|
| Entité | Micro, SASU, Perso, exploration. Depuis 0.20.4, personnel est remplacé par Perso dans les annotations et associations existantes, sans doublons. Cette dimension est analytique, indépendante du compte payeur. |
| Projet | qbudget, microbudget, levelup ; autres projets ajoutables librement. |
| Poste | Tags de consommation existants, avec cantine, transports, urssaf, pret et frais_bancaires. Les variantes transport/transports sont distinctes, sans conversion des annotations. |
| Contexte | mission, deplacement, contexte_loisirs, essentiel_quotidien, projets, Pro ; quotidien et travail restent reconnus. |
| Finalité | finalite_quotidien, finalite_loisirs, épargne, investissement, activité professionnelle. |
| Périodicité | Récurrent / Ponctuel, via `source: "type"`. La fréquence détaillée issue des règles est différée. |
| Traitement / État | remboursement, payéPerso, enCoursDeCreation, transfert_intercomptes. |
| Variabilité | fixe / variable, conservés et disponibles en exploration libre. |

## Distinguer les usages d’un même mot

Un nom de tag ne peut appartenir qu’à une seule catégorie, sans distinction de casse :

- `loisirs` reste un poste ; `contexte_loisirs` décrit le contexte ; `finalite_loisirs` décrit la finalité.
- `quotidien` reste le tag historique de contexte ; `finalite_quotidien` désigne la finalité.
- `remboursement` reste un marqueur de traitement. Aucun type de flux financier n’en est déduit.

Ces nouveaux noms ne sont pas des alias : aucune annotation n’est réécrite ni dupliquée pour remplir automatiquement un nouvel axe. Les opérations sans tag de Projet ou de Finalité apparaissent sous **Non renseigné**. Les quatre perspectives guidées deviennent disponibles, et leurs filtres restent actifs.

## Tags historiques et capacités différées

`IK` et `noteDeFrais` restent provisoirement dans Poste ; leur déplacement vers Traitement / État reste une décision séparée. Le tag technique `transfert_intercomptes` reste reconnu par la détection et l’exclusion graphique existantes. Il ne prouve pas à lui seul qu’un mouvement est interne au périmètre patrimonial analysé.

Le tag `revenu`, auparavant classé dans Nature, devient libre, comme les autres tags absents du nouveau dictionnaire. Aucun tag libre n’est supprimé des opérations ; seul le renommage explicite personnel → Perso est appliqué. Les dimensions **Flux calculé**, **Compte / Support** et la périodicité détaillée seront implémentées séparément ; elles ne sont pas simulées par de nouveaux tags. Les graphiques actuels restent des répartitions de dépenses.

## Créer ses propres catégories

Dans **Éditeur → Tags · catégories et dimensions du tableau**, utiliser **+ Catégorie**, saisir son nom et ses tags. On peut y classer un tag libre déjà posé : l’opération ne change pas, seule sa présentation devient organisée. Un tag déjà classé doit être retiré de son ancienne catégorie avant d’être affecté à une autre.

Le remplacement initial n’est effectué qu’une fois. Les catégories créées, modifiées ou retirées après cette mise à jour sont conservées au rechargement et dans les exports/imports d’annotations courants. Un import volontaire du seul JSON de catégories remplace le dictionnaire par celui du fichier ; cette personnalisation est également conservée. **Catégories par défaut** restaure le nouveau catalogue.

Le camembert et les dimensions explicitement choisies pour le graphique passent de Nature à Poste et de Traitement à Traitement / État. Les anciennes dimensions supprimées sont ignorées. Les filtres par tags restent valables et les calculs de solde, d’audit et de forecast sont inchangés.
