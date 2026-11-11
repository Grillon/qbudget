# Récurrences potentielles (0.19.7)

Dans le tableau de bord, section **Récurrences**, cliquer sur **Détecter les récurrences potentielles**. Le bouton analyse tous les comptes importés, indépendamment des filtres, puis ouvre le backlog dans l’éditeur. Il reste accessible depuis **Récurrences potentielles** dans l’éditeur.

Chaque proposition présente les dates, les montants, les libellés originaux et les tags des opérations observées. Vérifier le libellé de la règle, le montant signé, la fréquence et la dernière échéance de référence. Le montant proposé est celui de la dernière opération, même si les montants varient. La première échéance calculée est indiquée avant confirmation.

- **Créer la récurrence** crée une règle native et rattache uniquement les opérations observées, en conservant leurs tags et autres annotations. Les prévisions utilisent alors cette règle. Elle est modifiable dans l’éditeur ou la section Récurrences.
- **Ignorer** garde la décision : un nouveau scan ne repropose pas le même groupe. **Décisions déjà prises → Réexaminer** permet de revenir sur une proposition ignorée.

La détection et l’ignorance d’une proposition ne modifient aucun montant, solde, tag ou règle. Une règle validée ajoute des échéances aux prévisions ; comme pour les règles manuelles existantes, les opérations déjà prévues restent comptées séparément. Les échéances sont vérifiables dans l’export CSV d’audit.

Les propositions, leurs opérations observées et les décisions sont enregistrées dans le navigateur et dans **Exporter les annotations JSON** (`recurrenceBacklog`). Une ancienne sauvegarde sans ce champ reste compatible et restaure un backlog vide. Les imports CSV conservent le backlog ; un import partiel ne recrée aucune opération absente. Si les opérations ont changé ou ne sont plus présentes, la création est refusée : réimporter l’historique et relancer la détection. Les propositions devenues invalides restent visibles et peuvent être ignorées.

## Critères simples

- Au moins **trois dates distinctes**, sur un même compte bancaire et compte source, dans le même sens débit/crédit.
- Libellés égaux après normalisation de casse et d’espaces, ou regroupés par **une seule association de libellés** existante. Les tags manuels seuls ne servent pas à regrouper. Si plusieurs associations se chevauchent, le regroupement revient au libellé exact.
- Fréquence quotidienne, hebdomadaire, mensuelle, trimestrielle ou annuelle. Les dates sont comparées à un calendrier ancré sur la première occurrence : tolérance de 0, 2, 5, 7 ou 7 jours respectivement, avec gestion des fins de mois. Les cycles manquants ne sont pas extrapolés par ce premier détecteur.
- Montants variables admis : ce sont des **hypothèses à examiner**, jamais un classement automatique certain.

Les flottantes, opérations prévues, prévisions calculées, opérations marquées ponctuelles et identités bancaires encore ambiguës sont exclues. Un groupe avec plusieurs occurrences le même jour n’est pas proposé. Les règles et liens de récurrence existants empêchent une seconde proposition du même groupe. Cette première version ne propose que des opérations en EUR, comme les règles prévisionnelles actuelles.

## Essai rapide

Importer [le CSV fictif](../examples/recurrences-potentielles.csv), puis lancer la détection : **deux propositions** doivent apparaître (NETFLIX mensuel et SALAIRE mensuel). Les quatre autres opérations irrégulières ne doivent pas être proposées. Ignorer l’une, relancer : elle reste ignorée. Créer l’autre, après vérification : une seule règle apparaît. Exporter et réimporter les annotations conserve ces décisions.
