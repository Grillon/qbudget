# Comparaison en ligne

- Version principale (`main`, actuellement 0.19.3) : https://grillon.github.io/qbudget/
- Version corrigée (`dev`) : https://grillon.github.io/qbudget/dev/

GitHub Pages reçoit un seul site complet : chaque publication assemble `main` à la racine et `dev` dans son sous-dossier. Le workflow doit être présent sur **les deux branches**, afin qu’un push sur `main` conserve également `/dev/`. Le code applicatif de `main` reste indépendant de celui de `dev`.

## Activation

1. Publier la branche `dev`, puis la configuration de publication sur `main` (workflow, script, tests de publication et cette documentation).
2. Dans **Settings → Environments → github-pages → Deployment branches and tags**, ajouter la branche `dev` aux côtés de `main`. Conserver les autres protections. Au moment de la préparation, seule `main` était autorisée.
3. Conserver **Settings → Pages → Source → GitHub Actions**. Le workflow `Deploy qbudget (static)` publie les deux versions après leurs tests.

## Données navigateur

Les deux URL partagent la même origine. Le site généré dans `/dev/` utilise donc les clés `qbudget-dev-mvp-1` et `qbudget-dev-layout-v1`, distinctes de celles de la version principale. Aucune donnée existante n’est copiée ou effacée. Pour comparer les mêmes opérations, importer les fichiers voulus séparément dans chaque version. Le bandeau de `/dev/` identifie l’aperçu et permet de revenir à la version principale.

Cette séparation est appliquée seulement aux fichiers publiés : le code source et le fonctionnement du CLI restent inchangés. Les annotations et données personnelles ne font pas partie de la publication ; seuls `index.html` et ses scripts navigateur locaux sont copiés.

## Vérification locale

```sh
node scripts/build-pages.js /chemin/vers/main /chemin/vers/dev /tmp/qbudget-public
python3 -m http.server 8000 --directory /tmp/qbudget-public
```

Le dossier de sortie doit être nouveau et extérieur aux deux dossiers sources. Consulter `/` et `/dev/` ; les imports, modifications et effacements dans une version ne doivent pas changer les données de l’autre.
