# qbudget — prototype V0.4

Ouvrir `index.html` dans un navigateur moderne. Aucune dépendance externe et aucun appel réseau.

1. Charger un CSV de l'importateur bancaire (ou la démo fictive).
2. Ajouter un montant réalisé ou prévu sur un compte existant.
3. Cliquer « Lier / créer » sur une opération : une récurrence portant le même libellé sur le même compte est proposée automatiquement. Les libellés différents créent des règles séparées. Lors de la saisie manuelle, une récurrence au même libellé est automatiquement proposée.
4. Modifier la fréquence, la date de référence et éventuellement la date de fin dans le tableau « Récurrences ».
5. Choisir compte, date de consultation et horizon pour voir la prévision.
6. Exporter régulièrement les annotations JSON (elles contiennent aussi les opérations saisies manuellement).

## Logique

- Les opérations réelles restent distinctes des règles de récurrence (identifiants masqués). Le libellé normalisé, associé au compte, sert à proposer la règle ; un même libellé peut aussi avoir deux règles distinctes sur demande.
- Une même récurrence peut relier plusieurs opérations : une seule échéance par période est projetée.
- Lorsqu'une nouvelle opération est liée à une récurrence existante, la date de référence est décalée si la nouvelle date est plus récente ; le montant de référence est alors actualisé.
- Une date de fin est facultative.
- Les montants prévus n'affectent pas le solde historique ; les montants réalisés, oui.
- Une saisie explicite à la même date qu'une échéance et reliée à la même règle remplace cette échéance pour le forecast.

## Limites connues

- Le prototype suppose une devise commune en vue globale et affiche un avertissement si elles diffèrent.
- Le CSV ne fournit jamais de solde utilisé par qbudget : saisir pour chaque banque un solde de référence et sa date. Les opérations permettent de calculer le solde aux autres dates. Pour cette version, les opérations sont regroupées par banque (BPS, BoursoBank, Revolut), sans distinction de sous-comptes.
- L'import d'un nouveau CSV remplace les opérations et les annotations : faire un export JSON avant, puis le réimporter. Les opérations manuelles seront restaurées, mais les annotations des lignes CSV requièrent des identifiants stables.
- Une récurrence modifiée en cours de période est représentée par sa dernière valeur ; il n'y a pas encore de gestion de versions historiques des règles.
- Deux opérations distinctes au même jour et liées à la même récurrence sont conservées en historique, mais une seule échéance par période est projetée.
- Les dates de projection sont des dates théoriques, non des dates de règlement garanties.
