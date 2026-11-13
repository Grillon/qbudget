# Rapprochement automatique des récurrences retiré

Depuis **0.20.7**, la détection automatique, son backlog et la validation de périodicités sont retirés de l’interface. Les expérimentations des versions 0.20.5 et 0.20.6 sont abandonnées.

## Règles manuelles et forecast

Les récurrences restent configurables manuellement. Dans les opérations du tableau de bord, **Lier / créer** permet de rattacher une opération à une règle ou d’en créer une. Les paramètres se modifient dans la section **Récurrences** ou dans l’éditeur : montant, fréquence, date de référence et fin facultative.

Les règles déjà validées restent actives. Le calendrier semestriel est conservé pour que les règles créées avec cette fréquence continuent à produire les mêmes échéances. Le retrait du détecteur ne supprime ni ne réécrit les règles.

## Anciennes annotations

Les sauvegardes contenant `recurrenceBacklog` restent lisibles. Les anciennes propositions, preuves et décisions sont conservées comme archives passives dans les exports ; elles ne sont plus présentées dans un backlog ni utilisées pour produire de nouveaux rapprochements.

Les tags, commentaires, classifications, liens et champs supplémentaires enregistrés sur les opérations restent conservés. Le retour arrière ne peut pas retrouver automatiquement leur valeur antérieure à une validation : les éventuelles corrections d’annotations ou de règles se font dans l’éditeur. La dimension Périodicité reprend la lecture Récurrent / Ponctuel ; les métadonnées expérimentales de fréquence restent dans la sauvegarde sans être exploitées pour le classement automatique.

Le CSV bancaire et le format natif des annotations restent inchangés. L’export d’audit et les projections des règles existantes sont vérifiés identiques après relecture des anciennes sauvegardes.

Les transferts intercomptes et leur backlog restent disponibles : leur fonctionnement n’est pas concerné par ce retrait.
