# Commencer ici — pour l’agent de l’étudiant

DS-Studio est un starter pédagogique évolutif, pas un produit fini à figer.
Votre rôle est d’aider l’étudiant à faire ses propres recherches et choix, sans
uniformiser les 19 projets. Lisez AGENTS.md, README.md, workspace/PFE.md,
workspace/DESIGN_RULES.md et workspace/DECISIONS.md avant une intervention utile.

Préservez ses modifications et ses données locales. Ne réinitialisez pas le
workspace, l’historique ou Git pour résoudre une difficulté. N’inspectez ni
ne copiez d’identifiants. Les CLI conservent leur authentification officielle.

Le cœur de l’atelier : proposition de token, diff avant acceptation, écriture
atomique sur disque, propagation dans les mêmes composants du catalogue et de
l’iframe, réouverture et annulation sélective. Il marche aussi hors ligne.

L’atelier est branché à **Claude** (chat) et à **Figma** (variables), et l’étudiant
peut les faire évoluer. Les deux passent par Claude Code et le compte de l’étudiant :

- Le chat Claude n’a aucun outil. Il reçoit les tokens, le brief, les règles et le
  dernier instantané des variables Figma, puis propose des changements (y compris
  de nouveaux tokens) qui passent par le diff validé par l’étudiant.
- La synchro Figma (`connectors/figma/`) utilise le serveur MCP officiel de Figma via
  Claude Code. Seul `use_figma` est autorisé, avec un script généré par l’atelier ;
  une garde PreToolUse bloque tout autre script, fichier ou second appel. Lecture :
  diff à valider dans l’atelier. Écriture : aperçu, validation à usage unique liée
  à la révision et au fichier, contrôle des valeurs attendues dans Figma, relecture.
- Ne donnez jamais au chat un accès libre au MCP Figma : passez par le connecteur.

Séparez intention, code écrit et preuve exécutée. Indiquez IMPLEMENTED, TESTED,
PARTIAL ou NOT IMPLEMENTED en précisant la plateforme et le périmètre du test.
Ne présentez pas comme fait ce qui n’a pas été exécuté (connexion, écriture Figma).
L’agent utilisé dans votre terminal est distinct : vérifiez ses permissions réelles.

Pour travailler : proposez un changement borné, implémentez-le avec l’accord déjà
donné par l’étudiant, testez le parcours concerné et consignez la décision utile.
Ne publiez, poussez ou déployez rien sans demande explicite. Lisez
[STUDENT_GUIDE](docs/STUDENT_GUIDE.md) pour les pistes d’appropriation.

## Entrées V2

Commencez par la boucle manuelle du README. `docs/V2_AUDIT.md` sépare les défauts
observés des hypothèses ; `docs/V2_CHANGELOG.md` et `DELIVERY_REPORT.md` donnent
les preuves réelles. Le brief du panneau est privé dans `.ds-studio/project.json` :
ne le lisez que si l’étudiant demande d’utiliser son contexte, ne le publiez pas.
Il peut exporter un Markdown puis choisir ce qu’il reprend dans `workspace/PFE.md`.

Le schéma de tokens reste version 1 : aucune migration destructive. Les 18 tokens
de base sont obligatoires ; des tokens ajoutés (`color.`, `space.`, `radius.`,
`size.`, `font.` + nom en camelCase) peuvent compléter le DS, sans toucher au journal. La copie
précédente ne remplace pas une sauvegarde externe. Pour une réparation, lire
`.agents/skills/safe-recovery/SKILL.md` et préserver le fichier original.
