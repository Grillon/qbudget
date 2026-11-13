# Rapprocher les opérations qui se répètent

Dans **Récurrences → Détecter les récurrences potentielles**, ou **Éditeur → Récurrences potentielles → Lancer la détection**, qbudget recherche les mouvements de même libellé et même montant sur des dates différentes. Le scan analyse tous les comptes chargés, indépendamment des filtres, et alimente un backlog à valider.

## Critères

- Au moins **deux occurrences** sur un même compte bancaire et compte source, dans la même devise EUR et avec le même montant signé exact. Débits et crédits restent séparés ; aucun arrondi ni rapprochement de montants voisins.
- Libellé identique après normalisation de la casse, des espaces et de la forme Unicode. Une association de libellés ou un tag commun ne suffit pas à regrouper deux libellés différents.
- Dates distinctes, examinées dans cet ordre : **quotidien → hebdomadaire → mensuel → trimestriel → semestriel → annuel**. Le premier rythme suffisamment étayé est prioritaire. Les comparaisons utilisent le calendrier, pas seulement le numéro de l’année.
- Tolérances de dates : 0 jour pour quotidien, 2 jours pour hebdomadaire, 5 jours pour mensuel, 7 jours pour trimestriel, semestriel et annuel. Les fins de mois et années bissextiles sont prises en compte ; un mois n’est pas assimilé à 30 jours.

Les montants variables forment des groupes distincts pour la validation. Pour déterminer le rythme, qbudget examine aussi les dates du même libellé sur le même compte, dans la même devise et le même sens de mouvement. Cela évite de classer annuel un montant qui ne revient qu’une fois par an dans une série mensuelle dont les autres montants diffèrent. Ce contexte doit confirmer au moins deux intervalles directs et au moins la moitié des intervalles ; une paire courte isolée ne suffit pas. Les preuves de contexte sont affichées séparément et ne sont pas classées avec le groupe de montants. Deux dates constituent une hypothèse à examiner, pas une certitude de répétition future. Un groupe irrégulier ou comportant plusieurs opérations le même jour n’est pas classé arbitrairement. Des cycles absents sont admis uniquement lorsque ce contexte étaye le rythme plus court et que les dates restent compatibles avec ses cycles. Sans preuve d’un rythme plus court, annuel exige des occurrences espacées d’un an calendaire, avec la tolérance bancaire indiquée ci-dessus. Deux opérations en décembre puis janvier ne deviennent pas annuelles au seul motif qu’elles appartiennent à deux années différentes.

Les flottantes, opérations prévues, échéances FORECAST et identités bancaires ambiguës sont exclues. Les opérations explicitement marquées ponctuelles restent hors des groupes à classer, mais leurs dates peuvent éclairer le rythme du même libellé sans modifier leur classification. Les opérations proposées puis validées ponctuelles par ce détecteur restent observées pour permettre de détecter une répétition ultérieure. Une règle ou un lien de récurrence existant empêche une seconde proposition pour le groupe.

## Propositions ponctuelles

Un mouvement de même libellé et montant observé **une seule fois** peut être proposé comme **ponctuel** si les opérations bancaires de son compte et compte source couvrent au moins un an calendaire complet. Avec moins d’un an de recul, il reste sans proposition ponctuelle. La plage observée est indiquée dans le backlog ; ses deux bornes sont revérifiées avant validation.

Une plage de dates ne garantit pas que tous les relevés intermédiaires ont été importés : vérifier l’historique disponible avant de valider. Une opération isolée ne permet pas de créer une règle depuis cette détection. Si une seconde occurrence apparaît ensuite à un an d’intervalle, le groupe est de nouveau soumis à validation comme annuel, sauf rythme plus court étayé.

## Valider la périodicité

Chaque proposition affiche le compte, le libellé, le montant, la fréquence et le nombre d’occurrences. **Voir les opérations observées** présente les dates, libellés originaux, montants et tags. Vérifier ces éléments, puis cliquer sur **Valider la périodicité** ; la fréquence proposée peut être corrigée avant validation.

La validation marque les seules opérations observées comme récurrentes, ou ponctuelles pour une proposition ponctuelle, et conserve la périodicité dans les annotations. Leurs tags, commentaires et autres champs restent conservés. **Aucune règle, échéance de forecast ou écriture bancaire n’est créée. Les soldes, projections et CSV d’audit ne changent pas.**

La dimension automatique **Périodicité**, avec `source: "type"`, affiche quotidien, hebdo, mensuel, trimestriel, semestriel ou annuel à partir de la validation, ou de la règle liée lorsqu’elle existe. Le tableau de l’éditeur affiche cette fréquence et permet de la rechercher. Il n’est pas nécessaire de saisir un tag manuel ; le schéma du dictionnaire reste en version 1 et ses contraintes d’unicité restent inchangées. Une opération récurrente sans fréquence connue garde le libellé Récurrent.

**Ignorer** conserve la décision et évite de reproposer le même groupe. Dans **Décisions déjà prises**, **Réexaminer** permet de rouvrir une proposition ignorée ou une périodicité validée. Cela ne retire pas une classification déjà enregistrée : elle reste en place jusqu’à une nouvelle validation ou une correction de l’opération dans l’éditeur.

Si un nouvel import ajoute des occurrences à un groupe déjà classé, celui-ci revient à examiner pour valider ces nouvelles opérations. Elles ne sont pas classées silencieusement.

## Prévoir les prochaines échéances, séparément

Le volet **Prévoir les prochaines échéances (facultatif)** permet de créer une règle native depuis une proposition. Vérifier le libellé, le montant signé, la fréquence et la dernière échéance de référence ; la première échéance calculée est indiquée.

**Créer une règle de prévision** demande une confirmation explicite, crée la règle et rattache les opérations observées. Cette action modifie le forecast. La règle reste modifiable dans l’éditeur et la section Récurrences. Le rythme semestriel est pris en charge par le calendrier, la prévision et l’audit, y compris en fin de mois.

Comme auparavant, les opérations prévues saisies et les échéances calculées restent distinctes : aucune compensation ou déduplication automatique n’est ajoutée.

## Sauvegardes et historique

Propositions, preuves, validations et décisions d’ignorer sont sauvegardées dans le navigateur et dans **Exporter les annotations JSON** (`recurrenceBacklog`). Les imports partiels conservent le backlog sans recréer d’opérations absentes. Une validation revérifie les preuves ; si une date, un montant ou une opération a changé, elle est refusée sans écrasement : relancer la détection.

Les anciens backlogs restent importables. Les anciennes propositions correspondant au nouveau critère exact sont reprises sans doublon. Les anciennes hypothèses fondées sur des montants variables ou des libellés regroupés par association peuvent devenir obsolètes ; leurs décisions restent conservées. Relancer la détection actualise les propositions annuelles devenues mensuelles. Les classifications déjà validées sans règle reviennent à examiner si le nouveau contexte révèle un rythme plus court ; aucune annotation n’est corrigée sans validation. Les choix explicites de fréquence effectués à la validation et les décisions d’ignorer restent respectés. Le scan ne modifie jamais les annotations à lui seul.

## Essais fictifs

- [Récurrences et changements de prix](../examples/recurrences-potentielles.csv) : deux propositions mensuelles, NETFLIX et SALAIRE, sur leurs deux premiers montants identiques. Le dernier montant différent n’est pas inclus.
- [Six périodicités](../examples/recurrences-periodicites.csv) : six propositions de récurrence, chacune fondée sur deux occurrences, et deux propositions ponctuelles pour les montants isolés sur la plage d’un an. Les dates irrégulières ne produisent pas de récurrence.
- [Priorités sur deux ans](../examples/recurrences-priorites.csv) : 24 échéances mensuelles, dont un montant qui ne revient qu’une fois par an. Les deux groupes de montants sont proposés mensuels, sans classement annuel trompeur.
