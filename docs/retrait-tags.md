# Retrait groupé des tags (0.19.6)

Dans le tableau de bord ou l’éditeur :

1. Sélectionner les opérations voulues, ou utiliser la recherche et les filtres pour définir les résultats à traiter.
2. Saisir le tag dans **Tag à ajouter ou retirer**. L’aperçu indique combien d’opérations portent ce tag manuellement, pour la sélection et pour tous les résultats.
3. Choisir **Retirer de la sélection** ou **Retirer de toutes les correspondances**, puis confirmer le nombre de retraits.

Le retrait porte sur un seul tag exact, sans tenir compte de la casse : `MISSION` retire `mission`, mais pas `mission-2026`. Tous les résultats filtrés sont traités, même si seuls 120 ou 150 sont affichés. Sans filtre, « toutes les correspondances » désigne toutes les opérations taguables de la vue et du compte courant.

Les autres tags et annotations sont conservés, notamment les liens de récurrence. Les prévisions calculées ne sont pas modifiées directement ; les opérations manuelles et flottantes peuvent être traitées dans l’éditeur. Les identifiants, dates, montants et calculs financiers restent inchangés.

Les tags issus d’une **association de libellés** restent automatiques. L’aperçu et le résultat indiquent sur combien d’opérations le tag restera affiché par association. Pour changer ce classement, modifier ou supprimer l’association dans son panneau. Les valeurs affichées à partir du **type** (Récurrent/Ponctuel) restent également gérées par ce réglage.

Le retrait est enregistré dans le navigateur. **Exporter les annotations JSON** sauvegarde la correction, avec le même format que les versions précédentes.
