# Proposition de catégories pour explorer ses finances

Le catalogue actuel mélange parfois le poste de dépense, la nature du mouvement et son suivi administratif. `IK` et `noteDeFrais` décrivent un suivi ; `revenu` décrit un flux ; `transfert_intercomptes` n’est pas un poste de consommation. Je propose de séparer ces questions, tout en conservant les tags existants.

| Axe | Question | Exemples de tags |
|---|---|---|
| **Poste** | À quoi sert l’argent ? | courses, logement, transport, santé, abonnements, impôts |
| **Flux** | Quel mouvement est-ce ? | depense, revenu, transfert_intercomptes, remboursement |
| **Périmètre** | Quel budget est concerné ? | personnel, SASU, copro |
| **Contexte** | Pour quelle activité ou quel projet ? | mission, quotidien, deplacement, travail, projet personnel |
| **Périodicité** | Est-ce récurrent ? | Récurrent, Ponctuel, via le type existant |
| **Variabilité** | Le montant est-il stable ? | fixe, variable |

Les exemples du tableau expriment les usages. Le [JSON proposé](../examples/categories-exploration.json) conserve les noms précis des tags existants : pas de renommage de `sante`, `telecom`, `streaming`, `essence`, etc. On peut ajouter un projet concret à Contexte quand il devient utile, sans créer un catalogue de projets hypothétiques.

Les marqueurs **IK**, **noteDeFrais**, **payéPerso** et **enCoursDeCreation** restent des **tags libres cumulables**, visibles et recherchables. Ils servent à retrouver un travail à faire ou une situation précise, plutôt qu’à ventiler des montants dans une catégorie qui mélangerait plusieurs questions. De futurs marqueurs `a_verifier` ou `a_rembourser` peuvent suivre le même principe.

Exemples : une course personnelle peut porter `courses, depense, personnel, quotidien, variable` et le type Ponctuel ; un remboursement de frais peut porter `remboursement, SASU, IK, mission`. Il n’est pas nécessaire de remplir tous les axes sur chaque opération. Le type Récurrent/Ponctuel est déjà disponible sans saisir un tag équivalent.

Pour les axes utilisés dans les graphiques, privilégier une valeur principale par opération : **le moteur actuel affiche tous les tags dans le tableau, mais utilise le premier tag d’une catégorie pour ventiler le montant**. Ajouter `transfert_intercomptes` ne retire donc pas un éventuel ancien tag `depense` ou `revenu` ; vérifier ces classifications si l’axe Flux est utilisé. Le filtre d’exclusion des transferts repose toujours directement sur `transfert_intercomptes`.

C’est une proposition à examiner, pas une migration appliquée. Le catalogue par défaut et les catégories du navigateur ne sont pas modifiés. Importer volontairement le JSON remplace les définitions de catégories, en conservant les tags des opérations ; les marqueurs de suivi deviennent simplement libres. Les calculs de trésorerie restent indépendants de ce classement.
