# Retaguer les opérations une par une

Dans **Éditeur de données**, commencer par filtrer les opérations à revoir : recherche, expression régulière, période, montant, opérations sans tags ou libellés partiellement tagués. On peut aussi sélectionner quelques lignes.

Cliquer sur **Retaguer les résultats** ou **Retaguer la sélection**. Le parcours reprend toutes les opérations correspondantes dans l’ordre du tableau, y compris celles au-delà de la pagination. Les règles, comptes, annotations orphelines et échéances FORECAST ne sont pas retagués.

Pour chaque opération, le panneau affiche le libellé, la date, le compte, le montant et tous les tags disponibles, regroupés par catégorie. Les catégories personnalisées apparaissent également.

- Choisir **un tag par catégorie**, ou **Sans tag** pour vider cette catégorie.
- Seules les catégories où un choix a été effectué sont remplacées. Une catégorie possédant plusieurs tags reste intacte tant qu’on ne choisit pas son remplacement.
- Les tags libres sont affichés et conservés, ainsi que les annotations, commentaires et liens de récurrence.
- **Enregistrer et suivant** applique les choix à cette opération, puis avance. Sur la dernière opération, le bouton devient **Enregistrer et terminer**.
- **Passer** avance sans appliquer les choix en cours. **Précédent** permet de revenir sur une opération.
- **Fermer**, Échap ou un clic sur le fond du panneau abandonnent les choix non enregistrés. Les opérations déjà enregistrées restent modifiées.

La liste du parcours reste stable même si un retagage fait sortir une opération du filtre d’origine. Un compteur indique la progression. Les modifications enregistrées sont sauvegardées dans le navigateur et dans les exports d’annotations habituels. Si le stockage est indisponible, le panneau indique que les choix restent en mémoire et n’avance pas automatiquement ; exporter les annotations avant de fermer la page.

## Tags automatiques et périodicité

Un tag provenant d’une association de libellés ne peut pas être remplacé par un tag manuel concurrent. Le panneau indique son origine et désactive les choix incompatibles. Choisir l’unique tag automatique permet de retirer les tags manuels concurrents de sa catégorie sans recopier le tag automatique dans les annotations. Lorsque plusieurs tags automatiques se contredisent dans une catégorie, corriger leurs associations dans l’éditeur.

La périodicité actuelle, issue du backlog validé, d’une règle liée, des tags ou du type de l’opération, reste en lecture seule dans ce parcours. Elle peut être modifiée dans le détail habituel de l’opération. Ce mode ne crée ni règle de récurrence ni fréquence artificielle.

Le retagage ne change pas les montants, les dates, les comptes, les règles ou les calculs financiers. Comme dans les autres vues, le classement peut changer les branches affichées dans les graphiques sans multiplier les montants.
