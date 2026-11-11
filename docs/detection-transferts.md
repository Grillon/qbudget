# Détecter les transferts intercomptes (0.19.11)

Dans le tableau de bord, section **Opérations datées et annotations**, cliquer sur **Détecter les transferts**. Le backlog reste accessible depuis **Éditeur → Transferts intercomptes**. Le scan analyse toutes les lignes bancaires chargées, indépendamment des filtres.

Une proposition exige la même date, la même devise, des montants exactement opposés et deux comptes distincts. Les comptes sources peuvent être deux comptes d’une même banque, par exemple LDD et Courant, s’ils sont renseignés dans le CSV. Aucune tolérance de date, arrondi de montant ou conversion de devise n’est appliquée. Les libellés sont affichés pour vérification ; ils n’ont pas à contenir « virement ».

Chaque opération doit avoir une seule contrepartie possible, et réciproquement. Les correspondances multiples et les identités bancaires incertaines sont montrées à part, sans proposition arbitraire. Un tag sur une seule ligne ne l’écarte pas de la comparaison. Une paire déjà identifiable parmi les lignes portant toutes deux le tag est reconnue comme traitée ; cela permet aussi de reprendre un choix effectué manuellement dans l’éditeur.

## Valider signifie taguer

**Ajouter transfert_intercomptes** ajoute ce tag aux deux lignes, en conservant tous les autres tags et annotations. Le bouton groupé traite les propositions actuellement disponibles après une confirmation. Une seconde vérification des données est effectuée au moment de l’ajout ; si une paire a changé ou est devenue ambiguë, l’action groupée entière est refusée, sans ajout partiel.

Il n’existe aucun état « validé » indépendant des tags :

- Le tag présent sur les deux opérations classe la paire comme traitée, même s’il a été ajouté depuis le tableau de l’éditeur.
- Le tag sur une seule opération laisse la paire à compléter.
- Retirer le tag d’une ligne rouvre une proposition précédemment traitée.
- Les tags effectifs, y compris ceux d’une association de libellés existante, sont pris en compte. Pour retirer un tag automatique, modifier son association.

**Ignorer** conserve une décision de ne pas proposer cette paire à chaque scan. **Réexaminer** permet de revenir sur cette décision. Une paire ignorée reste ignorée tant qu’elle n’a pas été réexaminée ; l’ajout effectif du tag sur les deux lignes est néanmoins reconnu comme un classement.

Les propositions, les opérations observées et les décisions d’ignorer sont incluses dans **Exporter les annotations JSON** (`transferBacklog`). Les tags sont sauvegardés dans les notes habituelles. Les anciens fichiers restent compatibles. Les imports partiels conservent le backlog et les annotations sans réintroduire de lignes absentes ; une paire indisponible ne peut pas être taguée depuis le backlog.

## Effets et limites

La détection seule ne change ni les annotations ni les calculs. La validation conserve les montants, dates, identifiants et lignes bancaires : aucun débit ou crédit n’est supprimé, compensé ou fusionné. Soldes, prévisions de trésorerie et CSV d’audit restent inchangés. Les graphiques qui excluent déjà `transfert_intercomptes` tiennent compte du nouveau tag.

Cette première version ne rapproche pas deux débits, les virements sur deux dates différentes, les opérations manuelles ou prévues, ni les flottantes. Un débit et un crédit de même montant peuvent aussi être une coïncidence : vérifier les lignes avant d’apposer le tag.

## Essai fictif

Importer [transferts-potentiels.csv](../examples/transferts-potentiels.csv), puis lancer la détection : **deux propositions**, **trois opérations ambiguës**, et aucune proposition pour les deux débits de 800 €. Valider une paire, retirer ensuite son tag dans l’éditeur : elle redevient à examiner. Exporter et réimporter les annotations conserve les propositions, les tags et les décisions.
