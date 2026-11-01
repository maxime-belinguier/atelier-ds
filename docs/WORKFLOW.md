# Méthode de travail avec Claude (DS-Studio Gutt)

Objectif : démarrer vite, faire petit quand c'est petit, livrer sans casser.

## 1. Récupérer l'app (1 à 2 min)

Le dossier du projet est sur l'ordinateur de l'auteur, relié à la conversation
(dans le shell relié : `$HOME/mnt/<dossier-du-projet>`).

1. Shell relié à l'ordinateur : créer une archive des fichiers suivis par Git
   (`test-results/` est ignoré par Git, on peut y écrire sans rien polluer) :
   `cd "$HOME/mnt/<dossier-du-projet>" && git ls-files -z | tar --null -czf test-results/source.tgz -T -`
2. Copier cette archive dans le conteneur (outil de copie depuis l'ordinateur), puis :
   `mkdir -p ~/ds && tar xzf <archive> -C ~/ds && cd ~/ds && npm ci`
3. Navigateur des tests : déjà installé dans le conteneur. Si Playwright cherche
   une autre version de Chromium, créer un lien symbolique vers celle présente
   dans `/opt/pw-browsers`.

Ne pas lire tout le code : commencer par `README.md`, `workspace/DECISIONS.md`
et le fichier concerné. Fichiers clés : `app/client/App.tsx` (atelier),
`app/client/DesignSystem.tsx` (composants Gutt), `app/client/styles.css`,
`app/client/a11yAudit.ts`, `app/client/Settings.tsx`, `app/client/Tour.tsx`.

## 2. Proportionner la vérification

**Petit changement** (texte, couleur, placement, un style) :
`npx prettier --write <fichiers>`, `npx tsc --noEmit`, `npm run build`, puis le
seul test Playwright concerné (`npx playwright test -g "<nom>"`) et une capture
de la zone touchée. Rien d'autre.

**Vraie fonctionnalité** : tout ce qui suit.

- `npx prettier --write app/client tests`, `npx tsc --noEmit`, `npm run build`
- `npm test` (tests unitaires et API)
- `npx playwright test` (navigateur)
- Serveur de contrôle :
  `DS_STUDIO_DATA_DIR=/tmp/ds-check PORT=4332 node_modules/.bin/tsx app/server/index.ts`
  puis `node scripts/check/layout.mjs` (doit finir par `[]` = 0 anomalie, contrôles
  à 34 px) et, si la visite guidée est touchée, `node scripts/check/tour.mjs`
  (une seule position par étape).

## 3. Livrer

1. Copier vers l'ordinateur uniquement les fichiers modifiés, plus `dist/` (les
   fichiers de `dist/assets` changent de nom à chaque build).
2. Ajouter ou mettre à jour l'entrée de `workspace/DECISIONS.md` (Problème,
   Décision, Écarté, Preuves, Limite). Mettre à jour l'entrée existante plutôt
   qu'en ajouter une nouvelle sur le même sujet.
3. Si le serveur a changé (`app/server`, `connectors`), dire à l'auteur de fermer
   et relancer l'app ; sinon un rechargement suffit.
4. Donner le texte du « Summary » GitHub (l'auteur pousse lui-même).

## Pièges connus

- Ne jamais toucher à `.ds-studio/` (état et historique personnels).
- `git` ne peut pas supprimer de fichiers dans le dossier relié sans autorisation :
  ne pas lancer de commit, pull ou reset depuis le shell relié.
- La visite guidée s'ouvre au premier lancement : dans les scripts Playwright,
  marquer `ds-studio-tour-done` dans le localStorage avant de charger la page.
- Le CSP interdit `eval` : `app/client/zodConfig.ts` doit rester importé en premier.
