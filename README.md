# qbudget V0.7

Décompresser les fichiers **index.html** et **plotly.min.js** dans le même dossier puis ouvrir index.html dans le navigateur. Fonctionne entièrement hors ligne.

## Visualisations
- Historique et prévision avec zoom et curseur de période
- Flux mensuels recettes / dépenses
- Donut par tags des dépenses
- Sunburst interactif tag > libellé

Les graphiques suivent le compte et la date de consultation sélectionnés. Les répartitions et les flux montrent les **opérations réalisées en EUR jusqu'à la date de consultation** ; ils excluent les prévisions. Les tags saisis dans le tableau sont pris en compte lors de leur validation.

Les opérations, récurrences, références et annotations restent gérées comme en V0.6. Plotly.js est inclus localement (pas de CDN).
