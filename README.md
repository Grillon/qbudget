# qbudget — V0.9 (socle local CLI + navigateur)

Aucune BDD distante, aucun accès bancaire direct. L'importateur Python produit un **CSV normalisé**. L'interface conserve les opérations et annotations dans son stockage local et permet d'exporter uniquement les **annotations JSON** (bouton « Exporter mes annotations »). Le CLI reconstitue son modèle à partir des deux fichiers, sans aucune écriture.

## Interface web

Ouvrir `index.html` avec `plotly.min.js` et `src/engine.js` dans leurs répertoires d'origine. En cas de restriction de navigateur sur `file://` :

```bash
python3 -m http.server 8000
# puis http://localhost:8000
```

Dans qbudget : importer `operations.csv`, annoter, puis **Exporter mes annotations**. Conserver cet export dans un emplacement privé, par exemple `data/annotations.json`. Le bouton « Exporter les données CLI » est hérité de la V0.8 mais n'est plus nécessaire pour le CLI.

## CLI (Node.js >=22)

```bash
cp .env.example .env
# adapter les deux chemins dans .env
npm link
qbudget                              # forecast par défaut, 14 mois
qbudget --months 24
qbudget balance --account BoursoBank --at 2026-10-25
qbudget check
qbudget --format json
qbudget forecast --set-rule netflix:amount=-25 --months 14
```

Sans `npm link` : `node src/cli.js` fonctionne aussi.

Le `.env` est lu dans le **répertoire de travail courant** et ne doit pas être poussé dans Git. Priorité : argument CLI > `.env` > défaut intégré. `--csv` et `--annotations` peuvent remplacer temporairement chaque chemin. Un fichier d'annotations absent est traité comme un JSON vide (mais les soldes de référence peuvent alors manquer). Les commandes n'enregistrent jamais les scénarios.

**Attention :** le CLI lit le CSV *déjà normalisé* produit par `import_releves.py`, pas les exports bruts des banques. Le format JSON attendu correspond au bouton « Exporter mes annotations » : `notes`, `references`, `rules`, `manualRows`.

## Tests et CI

```bash
./run-tests.sh
```

GitHub Actions exécute les tests Node et l'import Python à chaque push / PR. Les nouveaux tests vérifient la concordance CSV entre moteur et CLI, la préservation des opérations identiques, la fusion des annotations et l'absence de modification des fichiers lors d'un scénario temporaire.

**Limites actuelles :** pas encore de test automatisé des interactions du navigateur (Playwright prévu ultérieurement). L'interface conserve sa logique d'édition (tags, récurrences) dans le HTML ; l'extraction du parseur CSV et des calculs est une étape vers sa séparation complète. Le CSV de l'interface utilise encore certains identifiants dépendant de l'ordre des lignes : éviter de changer l'ordre des exports après annotation sans vérifier les correspondances.

## Vie privée

Tous les relevés et annotations réels doivent rester hors Git. Le répertoire `data/`, `.env`, `operations.csv` et les exports d'annotations sont ignorés. Vérifier systématiquement `git status` avant de pousser.


### Déploiement GitHub Pages

Le workflow `.github/workflows/pages.yml` ne publie que `index.html`, `plotly.min.js` et `src/engine.js`. Dans GitHub > Settings > Pages, sélectionner **GitHub Actions**. Attention : le site Pages peut être public même si le dépôt est privé ; ne jamais committer de données bancaires. Le stockage navigateur pour cette nouvelle origine sera distinct du `file://` local.

### Diagnostic des écarts de nombre de lignes

```bash
node src/audit.js data/operations.csv data/annotations.json
```

Ce diagnostic distingue nombre de lignes CSV et opérations manuelles, sans afficher les libellés ou les montants individuels. Le nombre seul ne permet pas de trancher entre un bug et des opérations ajoutées légitimement.
