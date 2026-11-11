# Rapprochements après import (0.19.5)

Les ambiguïtés ne demandent plus de réponse pendant l’import dans le navigateur. Toutes les lignes valides sont chargées ; chaque ligne incertaine reçoit une identité provisoire distincte, sans récupérer arbitrairement les annotations d’une ancienne opération.

Le bandeau indique les rapprochements en attente. Le bouton **Voir les rapprochements à traiter**, ou **Éditeur de données → Rapprochements à traiter**, ouvre la liste quand tu souhaites la traiter.

- **Reprendre cette identité** : choisir l’opération historique pour retrouver son identifiant et ses annotations complètes. Une identité déjà utilisée par une autre ligne du même import n’est pas proposée.
- **Confirmer comme opération distincte** : conserver la ligne et son identifiant, sans lui attribuer les annotations d’une autre opération.
- Si les deux opérations portent des annotations différentes, le rattachement est refusé sans écrasement. Les annotations peuvent être corrigées dans l’éditeur, ou les opérations conservées distinctes.

Les lignes importées restent comptées normalement dans les calculs financiers. Les statistiques par tags peuvent évoluer après rattachement des annotations ; le bandeau rappelle cette limite. Aucune ligne n’est fusionnée ou supprimée lors du traitement.

La liste et les décisions sont conservées dans le navigateur et dans **Exporter les annotations JSON**, avec le registre d’identités. Un rechargement de page ne redemande pas de choix. Des lignes à nouveau indiscernables dans un autre relevé peuvent produire un nouveau dossier : l’ordre du CSV ne sert jamais à décider quels tags reprendre.

Un import partiel conserve les annotations des opérations absentes. Les dossiers provisoires absents et sans annotation sont remplacés par ceux du nouvel import, pour éviter une accumulation de dossiers inutiles. Un dossier absent contenant des annotations manuelles reste consultable et est signalé comme tel.

Le CLI garde son comportement strict lorsqu’un CSV ambigu ne permet pas de retrouver ses identités. Les lignes CSV invalides et les conflits structurels restent des erreurs d’import.

## Essai rapide

1. Dans une session de test, importer `examples/rapprochements-initial.csv` comme CSV déjà normalisé.
2. Sur les deux lignes **Courses**, saisir respectivement les tags manuels `premier` et `second`.
3. Importer `examples/rapprochements-ambigus.csv`. L’import se termine avec ses trois lignes ; le bandeau annonce deux rapprochements à traiter.
4. Recharger la page : la liste est toujours disponible. Ouvrir les rapprochements et sélectionner l’ancienne opération voulue pour reprendre ses tags, ou confirmer une ligne distincte.
5. Exporter les annotations JSON pour conserver aussi cette liste et les décisions prises.
