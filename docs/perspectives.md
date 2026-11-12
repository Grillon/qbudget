# Explorer ses dépenses avec les perspectives

Dans le panneau Sunburst / Treemap, les questions proposent des points de départ :

- **Comment se répartissent mes dépenses entre perso et pro ?** : Entité → Poste.
- **Dans quels contextes est-ce que je dépense ?** : Contexte → Poste.
- **Combien coûtent mes projets ?** : Entité → Projet → Poste, si Projet est configuré.
- **Où va mon argent ?** : Finalité → Poste, si Finalité est configurée.

Le nouveau catalogue active directement les quatre questions. Les opérations sans Projet ou Finalité restent « Non renseigné » ; aucune classification n’est inventée.

Un dictionnaire importé peut encore utiliser **Nature** : cette catégorie reste utilisable à la place de Poste, sans modification de ses tags. Si Poste existe, la perspective utilise Poste. Les noms personnalisés ne sont pas interprétés arbitrairement. Une question est proposée uniquement lorsque toutes ses dimensions sont présentes ; cela ne remplit pas les classifications manquantes des opérations, qui restent « Non renseigné ».

Un clic règle les dimensions, leur ordre et la profondeur, sans filtrer sur Perso, mission ou un projet particulier. Les filtres et le compte actuellement sélectionnés restent actifs. La lecture concerne toujours des **dépenses**, dans le périmètre et jusqu’à l’horizon indiqués au-dessus du graphique.

## Continuer librement

Ouvrir **Dimensions du graphique** pour masquer ou réintroduire un axe. Ce choix ne supprime pas la catégorie ni ses tags. Un axe réintroduit s’ajoute à la fin ; glisser les onglets, ou utiliser **Alt + flèche gauche/droite** sur un onglet, pour changer l’ordre. Le curseur limite les niveaux affichés, de 1 à 8. Les dimensions au-delà de cette profondeur restent sélectionnées et disponibles. Sans axe sélectionné, le graphique invite à en choisir un.

Les perspectives restent modifiables et les deux formes Sunburst / Treemap partagent la même configuration. Une opération avec plusieurs tags d’une même catégorie garde tous ses tags ; seul le premier est utilisé pour sa branche, sans multiplication du montant. Cliquer une branche retrouve ses opérations dans le tableau.

La configuration du graphique est sauvegardée dans le navigateur et dans l’export des annotations JSON. Un ancien fichier sans sélection explicite reprend l’ordre de ses catégories. L’import du seul dictionnaire de catégories conserve les préférences dont les noms existent encore ; les noms absents sont ignorés. Aucun classement historique n’est converti automatiquement.

## Perspectives différées

**Comment circule mon argent ?** attend une dimension Compte issue des données bancaires, des flux calculés et une lecture fiable des transferts selon le périmètre. La dimension Périodicité est disponible en exploration libre : elle affiche la fréquence issue des validations du backlog ou des règles liées, avec Récurrent / Ponctuel en complément lorsque la fréquence est inconnue. Une fréquence historique validée ne crée pas, à elle seule, de prévision future.

Ces contrôles ne modifient ni les soldes, ni les règles, ni le forecast. Ils ne rapprochent pas une opération prévue saisie d’une échéance récurrente correspondante ; ces deux éléments restent distincts comme auparavant.
