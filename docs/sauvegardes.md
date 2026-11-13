# Sauvegarder et restaurer son budget

## Sauvegarde complète : un fichier pour tout restaurer

Dans **Fichiers et sauvegardes**, cliquer sur **Exporter sauvegarde complète**. Le fichier `qbudget-sauvegarde.json` contient :

- Toutes les opérations bancaires actuellement chargées, avec leurs identifiants et comptes sources.
- Toutes les opérations ajoutées manuellement : réalisées, prévues et flottantes, même sans compte ou sans date.
- Les tags, commentaires, annotations orphelines, catégories et associations de libellés.
- Les comptes, exclusions du cumul, soldes de référence et règles de récurrence.
- Les identités et rapprochements à traiter, ainsi que les archives des anciennes propositions de récurrences.
- Les préférences des graphiques enregistrées dans le modèle et les dates de consultation et de prévision.

Pour restaurer ce fichier, cliquer sur **Restaurer sauvegarde complète**, puis le sélectionner. Aucun CSV complémentaire n’est nécessaire. Si un budget est déjà chargé, le nombre d’opérations à restaurer est présenté avant confirmation de son remplacement. Les opérations du fichier remplacent le budget local ; elles ne s’ajoutent pas à celui-ci, ce qui évite les doublons lors d’une restauration répétée.

Le fichier est validé avant confirmation et avant toute modification du budget. Annuler ou sélectionner un fichier invalide laisse les données locales intactes. Si le stockage du navigateur est indisponible, le budget restauré reste en mémoire et un avertissement demande d’exporter avant de fermer la page.

Les échéances calculées du forecast ne sont pas sauvegardées comme de nouvelles écritures : elles sont recalculées à partir des règles. Les opérations prévues saisies manuellement restent, elles, dans la sauvegarde.

Le fichier représente le budget présent dans qbudget au moment de l’export. Les opérations bancaires absentes du dernier import ne sont pas reconstruites à partir des seules annotations historiques ; conserver aussi les relevés d’origine pour compléter l’historique si nécessaire.

## Annotations séparées : les saisies manuelles sont déjà dedans

**Exporter mes annotations** reste disponible. Son fichier `qbudget-annotations.json` conserve les tags, catégories, règles, comptes, soldes et opérations manuelles, y compris les flottantes. Les saisies manuelles ne sont donc pas uniquement dans le navigateur : elles sont aussi exportées dans ce fichier.

Pour restaurer un budget depuis cet export séparé, réimporter le CSV bancaire, puis utiliser **Importer mes annotations** avec le JSON. Le même bouton accepte `qbudget-data.json`, produit par **Exporter annotations pour le CLI**. Ces deux JSON ont le même format natif ; ils ne contiennent pas la liste complète des opérations bancaires.

## Quel export choisir ?

| Export | Contenu | Restauration |
|---|---|---|
| Sauvegarde complète | Bancaires, manuelles et toutes les annotations | Restaurer sauvegarde complète, sans CSV |
| Mes annotations | Annotations, règles, comptes et manuelles | Importer mes annotations, avec le CSV bancaire pour le reste |
| Annotations pour le CLI | Même contenu que Mes annotations | Importer mes annotations, ou utiliser avec le CSV dans le CLI |
| CSV d’audit | Résultats financiers datés, avec les prévisions selon le périmètre | Consultation et contrôle ; ne constitue pas une sauvegarde restaurable |

Les anciens exports d’annotations restent acceptés. Ils ne deviennent pas automatiquement des sauvegardes complètes : les données bancaires qu’ils ne contiennent pas nécessitent toujours le CSV ou les relevés d’origine.

Tout reste local au navigateur. Pour déplacer le budget vers un autre appareil, transférer le fichier de sauvegarde complète puis le restaurer dans qbudget sur cet appareil.
