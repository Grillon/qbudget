# Rapprocher les opérations qui se répètent

Dans **Récurrences → Détecter les récurrences potentielles**, ou **Éditeur → Récurrences potentielles → Lancer la détection**, qbudget recherche les mouvements de même libellé et même montant sur des dates différentes. Le scan analyse tous les comptes chargés, indépendamment des filtres, et alimente un backlog à valider.

## Critères

- Au moins **deux occurrences** sur un même compte bancaire et compte source, dans la même devise EUR et avec le même montant signé exact. Débits et crédits restent séparés ; aucun arrondi ni rapprochement de montants voisins.
- Libellé identique après normalisation de la casse, des espaces et de la forme Unicode. Une association de libellés ou un tag commun ne suffit pas à regrouper deux libellés différents.
- Dates distinctes et régulièrement espacées selon un calendrier ancré sur la première occurrence : quotidien, hebdomadaire, mensuel, trimestriel, semestriel ou annuel.
- Tolérances de dates : 0 jour pour quotidien, 2 jours pour hebdomadaire, 5 jours pour mensuel, 7 jours pour trimestriel, semestriel et annuel. Les fins de mois et années bissextiles sont prises en compte ; un mois n’est pas assimilé à 30 jours.

Les montants variables forment des groupes distincts. Deux dates constituent une hypothèse à examiner, pas une certitude de répétition future. Un groupe irrégulier ou comportant plusieurs opérations le même jour n’est pas classé arbitrairement. Les cycles manquants ne sont pas extrapolés.

Les flottantes, opérations prévues, échéances FORECAST, opérations explicitement marquées ponctuelles et identités bancaires ambiguës sont exclues. Une règle ou un lien de récurrence existant empêche une seconde proposition pour le groupe.

## Valider la périodicité

Chaque proposition affiche le compte, le libellé, le montant, la fréquence et le nombre d’occurrences. **Voir les opérations observées** présente les dates, libellés originaux, montants et tags. Vérifier ces éléments, puis cliquer sur **Valider la périodicité** ; la fréquence proposée peut être corrigée avant validation.

La validation marque les seules opérations observées comme récurrentes et conserve leur fréquence dans les annotations. Leurs tags, commentaires et autres champs restent conservés. **Aucune règle, échéance de forecast ou écriture bancaire n’est créée. Les soldes, projections et CSV d’audit ne changent pas.**

La dimension automatique **Périodicité**, avec `source: "type"`, affiche quotidien, hebdo, mensuel, trimestriel, semestriel ou annuel à partir de la validation, ou de la règle liée lorsqu’elle existe. Le tableau de l’éditeur affiche cette fréquence et permet de la rechercher. Il n’est pas nécessaire de saisir un tag manuel ; le schéma du dictionnaire reste en version 1 et ses contraintes d’unicité restent inchangées. Une opération récurrente sans fréquence connue garde le libellé Récurrent.

**Ignorer** conserve la décision et évite de reproposer le même groupe. Dans **Décisions déjà prises**, **Réexaminer** permet de rouvrir une proposition ignorée ou une périodicité validée. Cela ne retire pas une classification déjà enregistrée : elle reste en place jusqu’à une nouvelle validation ou une correction de l’opération dans l’éditeur.

Si un nouvel import ajoute des occurrences à un groupe déjà classé, celui-ci revient à examiner pour valider ces nouvelles opérations. Elles ne sont pas classées silencieusement.

## Prévoir les prochaines échéances, séparément

Le volet **Prévoir les prochaines échéances (facultatif)** permet de créer une règle native depuis une proposition. Vérifier le libellé, le montant signé, la fréquence et la dernière échéance de référence ; la première échéance calculée est indiquée.

**Créer une règle de prévision** demande une confirmation explicite, crée la règle et rattache les opérations observées. Cette action modifie le forecast. La règle reste modifiable dans l’éditeur et la section Récurrences. Le rythme semestriel est pris en charge par le calendrier, la prévision et l’audit, y compris en fin de mois.

Comme auparavant, les opérations prévues saisies et les échéances calculées restent distinctes : aucune compensation ou déduplication automatique n’est ajoutée.

## Sauvegardes et historique

Propositions, preuves, validations et décisions d’ignorer sont sauvegardées dans le navigateur et dans **Exporter les annotations JSON** (`recurrenceBacklog`). Les imports partiels conservent le backlog sans recréer d’opérations absentes. Une validation revérifie les preuves ; si une date, un montant ou une opération a changé, elle est refusée sans écrasement : relancer la détection.

Les anciens backlogs restent importables. Les anciennes propositions correspondant au nouveau critère exact sont reprises sans doublon. Les anciennes hypothèses fondées sur des montants variables ou des libellés regroupés par association peuvent devenir obsolètes ; leurs décisions restent conservées. Le scan ne modifie jamais les annotations à lui seul.

## Essais fictifs

- [Récurrences et changements de prix](../examples/recurrences-potentielles.csv) : deux propositions mensuelles, NETFLIX et SALAIRE, sur leurs deux premiers montants identiques. Le dernier montant différent n’est pas inclus.
- [Six périodicités](../examples/recurrences-periodicites.csv) : six propositions, chacune fondée sur deux occurrences ; les montants différents et les dates irrégulières ne produisent pas de proposition.
