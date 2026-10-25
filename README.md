# qbudget — jeu de tests de vie quotidienne

Données **100 % inventées** (graine aléatoire fixe), du **01/09/2026 au 25/10/2026** inclus.

- `tests/fixtures/life_2026_operations.csv` : 92 opérations normalisées au même format que l'importateur (`;`, dates ISO, montants signés), trois comptes fictifs : BoursoBank, BPS, Revolut.
- `tests/fixtures/life_2026_annotations.json` : 12 récurrences avec liens vers 21 opérations historiques, tags, soldes de référence fictifs au 25/10/2026.
- `tests/fixtures/life_2026_manifest.json` : effectifs, répartition et somme de contrôle (en centimes).
- `tests/fixtures/life_2026_expected_forecast.json` : résultat de référence **du moteur V0.9.1**, du 25/10/2026 au 31/12/2027. C'est un *golden master*, pas une garantie de justesse métier.
- `tests/life.test.js` : tests Node.js à exécuter avec `node --test tests/life.test.js`, ou automatiquement via `npm test` si les tests du projet sont détectés par Node.

## Cas couverts

- Recettes récurrentes : salaire mensuel (pour éviter une dérive mécanique du solde vers zéro).
- Dépenses mensuelles : loyer, électricité, eau, fibre, téléphone, Netflix, assurance habitation, sport.
- Dépenses trimestrielles : charges de copropriété et assurance automobile.
- Dépense annuelle : taxe foncière.
- Dépenses ponctuelles : alimentation, restaurant, carburant, cinéma, vêtements, vélo, cadeau, pharmacie, etc.
- **Deux paiements de métro strictement identiques et légitimes**, qu'il ne faut pas dédupliquer.

**Important :** les dates futures sont générées à partir des règles d'annotations et non insérées dans le CSV historique. Les sorties `expected` reflètent actuellement le comportement de V0.9.1 : si le moteur a un défaut, il faudra corriger la règle métier et mettre à jour la référence après examen. Les données fictives ne doivent jamais être remplacées par des relevés personnels dans Git.

## Installation

À la racine du dépôt qbudget, extraire les fichiers avec conservation des chemins. Les vrais fichiers `src/engine.js`, `index.html` et `banques.json` ne sont pas remplacés.

```bash
node --test tests/life.test.js
qbudget forecast --csv tests/fixtures/life_2026_operations.csv --annotations tests/fixtures/life_2026_annotations.json --at 2026-10-25 --until 2027-12-31 --json
```

Les annotations utilisent les identifiants d'opération du **parseur actuel** (`Identifiant|index`). Cette fragilité justifie un futur identifiant stable lors des réimports.
