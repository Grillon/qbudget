# Associations de libellés (0.19.4)

Dans **Éditeur de données → Associations de libellés**, choisir un tag existant et saisir un motif par ligne : `NETFLIX` et `NFLX` signifient `NETFLIX` **OU** `NFLX`. L’aperçu affiche les correspondances avant l’enregistrement, sur tous les comptes et sans limiter la période, y compris les opérations flottantes.

Les motifs sont des mots ou expressions littérales, insensibles à la casse. Les espaces et les formes Unicode équivalentes sont normalisés pour la comparaison. `ORA` ne correspond pas à `PANORAMA`, `ORACLE` ou `ORANGEADE` ; `NFLX` correspond à `NFLX.COM`. Les symboles Regex ne sont pas interprétés. Le libellé original reste conservé.

Les tags affichés combinent les tags manuels et ceux des associations, sans doublon. Les champs d’édition ne modifient que les **tags manuels** ; les tags issus des associations sont indiqués séparément. Modifier ou supprimer une association recalcule le classement sans effacer les tags manuels. Un tag qui doit rester sur une opération peut être ajouté explicitement dans ses tags manuels.

Les associations s’appliquent aux opérations existantes et aux futurs imports. Elles sont conservées dans le stockage navigateur et dans **Exporter les annotations JSON**, sous le champ `labelAssociations`. Les anciens fichiers sans ce champ restent acceptés et restaurent une liste d’associations vide. L’export des seules catégories ne contient pas les associations.

Les identifiants, montants, soldes, règles de récurrence et écritures d’audit ne changent pas. Les graphiques et filtres utilisent les tags combinés : leur répartition peut donc changer, mais une opération garde un seul montant. Dans une même catégorie, le graphique conserve sa règle existante du premier tag, les tags manuels étant prioritaires.

## Essai rapide

1. Importer `examples/associations-libelles.csv` comme CSV déjà normalisé, dans une session de test.
2. Ajouter le tag manuel `Netflix` à **LIBELLÉ SANS LIEN** pour rendre ce tag disponible.
3. Dans les associations, choisir `Netflix`, saisir `NETFLIX` puis `NFLX` sur deux lignes : l’aperçu doit montrer **2** correspondances. Enregistrer.
4. **CB NETFLIX.COM** et **PRLV NFLX** affichent désormais `Netflix`, sans modification de leurs tags manuels.
5. Exporter les annotations, recharger la page ou réimporter les opérations : le classement reste présent.
6. Supprimer l’association : les deux tags automatiques disparaissent, tandis que le tag manuel sur **LIBELLÉ SANS LIEN** reste présent.
