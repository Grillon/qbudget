IMPORTATEUR BANCAIRE V1.4 — Python standard, 100 % local

Fichiers : import_releves_v1_4.py, banques.json

Usage :
  python3 import_releves_v1_4.py bourso.csv bps.csv revolut.csv -c banques.json -o operations.csv

La section "banques" gère les formats d'entrée (inchangés).
La section "sortie" gère le CSV généré :
  - separateur : séparateur du fichier de sortie (ex. ";")
  - decimal : séparateur décimal de sortie ("." ou ",")
  - colonnes : champs conservés, dans l'ordre choisi, et intitulés de sortie.

Exemple : {"champ": "montant", "nom": "Montant en euros"}
Pour masquer une colonne, la retirer de "sortie.colonnes".
Pour changer l'ordre, déplacer son élément dans la liste.
Pour rétablir les colonnes originales V1.3, retirer la section "sortie" du JSON.

Champs disponibles : id, banque, compte, date, date_valeur, description,
montant, devise, solde, categorie, sous_categorie, statut, source, doublon_potentiel.

Les doublons potentiels restent tous conservés et marqués "oui".

V1.4.2 : restaure la section "sortie" dans banques.json ; calcul BPS debit signe ou non.
