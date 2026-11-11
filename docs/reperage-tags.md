# Repérer les opérations sans tags (0.19.9)

Dans l’éditeur, les deux cases sous les filtres de montant et de période agissent comme la recherche : elles filtrent **le même tableau**, avec les mêmes sélections et actions groupées.

- **Sans tags** : opérations sans aucun tag manuel ni tag issu d’une association de libellés. Le type Récurrent/Ponctuel seul ne constitue pas un tag.
- **Libellés partiellement tagués** : opérations partageant le même libellé normalisé sur le même compte bancaire et compte source, avec au moins une occurrence taguée et une sans tag. Les deux sortes d’occurrences sont affichées pour comparaison.
- **Les deux cases** : seulement les opérations sans tags des groupes précédents.

La comparaison utilise toutes les opérations chargées, y compris les manuelles et flottantes, avant d’appliquer la recherche et les bornes de montant/date. La casse, les espaces et les formes Unicode équivalentes sont ignorés. Les libellés différents, tels que CARREFOUR et CARREFOUR MARKET, restent distincts. Les opérations absentes d’un import partiel ne servent pas de référence. Les règles, comptes, annotations orphelines et prévisions calculées sont exclus de ces filtres.

Le champ **Tags à ajouter ou retirer** propose les tags communs aux occurrences similaires déjà taguées. La suggestion concerne la sélection, si elle existe, sinon toutes les correspondances. Avec plusieurs groupes, seuls les tags communs à chaque groupe sont proposés. Aucun préremplissage n’est fait si une référence manque ou si les tags se contredisent. La saisie manuelle reste prioritaire ; une suggestion précédente peut être actualisée ou effacée lorsque les correspondances changent.

## Exemple Carrefour

Avec trois CARREFOUR tagués `courses` et deux sans tag :

1. Cocher **Libellés partiellement tagués** montre les cinq opérations ; `courses` est proposé.
2. Cocher aussi **Sans tags** conserve les deux opérations sans tag.
3. Vérifier ou modifier la suggestion, puis cliquer sur **Taguer toutes les correspondances**, même si la recherche est vide. La confirmation porte sur les deux opérations. Une sélection manuelle peut également être traitée.
4. Après l’ajout, ces opérations quittent le filtre automatiquement. Aucun tag n’est modifié par le simple fait de cocher une case ou d’afficher une suggestion.

Toutes les correspondances sont traitées, même au-delà des 120 lignes affichées. Les cases sont des filtres de vue ; les décisions de taggage sont enregistrées et exportables par les annotations JSON habituelles. Les identifiants, dates, montants et règles ne changent pas.
