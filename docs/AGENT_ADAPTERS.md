# Adaptateurs d’agents

## Contrat commun

`connectors/agents/types.ts` définit `status()` et `reply(message, context, signal)`.
Entrée : tokens structurés, contexte PFE, règles et dix messages précédents maximum.
Sortie : `{message, changes:[{key,value}]}` validée par Zod. L’adaptateur ne reçoit
pas de Store et ne peut pas accepter une proposition. Le contrôleur HTTP prépare
le diff avec la révision de départ ; l’UI décide de sa validation humaine.

Les conversations de fournisseurs ne sont pas reprises ni mélangées. Le chat embarqué
est en mémoire dans le navigateur ; après recharge l’historique affiché est vide.
Les refus, délais et interruptions n’entraînent aucun renvoi automatique ni commit.
Pas d’orchestration parallèle de plusieurs agents dans la V2 : architecture multi-fournisseurs,
un fournisseur intégré et qualifié, deux points d’extension indisponibles.

## Codex — TESTED sous Linux avec 0.164.0

Le CLI officiel fournit `exec --json`, `--ephemeral` et `--ignore-user-config`.
Ce dernier ignore la configuration globale mais conserve la gestion officielle de
l’authentification. Référence : [official OpenAI documentation — CLI](https://learn.chatgpt.com/docs/cli/reference).
L’activation des outils shell est une option documentée ; le profil du starter la
désactive ainsi que les plugins, apps, MCP et la recherche web.
[Configuration officielle](https://learn.chatgpt.com/docs/config-file/config-reference).

Le processus n’est pas lancé dans le dépôt : un dossier temporaire vide évite de
charger la configuration du projet. Pas de shell interpolé : arguments en liste,
prompt via stdin. Authentification par `codex login`, effectuée par l’utilisateur.
Le starter ne déduit pas la validité d’une session de l’existence d’un fichier.
La disponibilité initiale signifie seulement binaire/version détectés ; le compte,
le réseau et le quota sont réellement sollicités à l’envoi. Délai maximum 120 s.

Choix : `exec` plutôt qu’app-server réduit les RPC, sessions et approbations à
maintenir pour ce profil à propositions seules. Le flux manuel reste indépendant.
Le protocole et la version ont été exécutés, pas seulement décrits. Pour changer
la version acceptée, refaire le smoke test, le test hostile, le refus sans auth,
la proposition/validation via API et les essais sur chaque OS cible.

## Claude Code — expérimental, TESTED sous Linux avec 2.1.311

Ajout étudiant (27/10/2026). `connectors/agents/claude.ts` appelle `claude -p`
avec la sortie JSON, le contexte passé par stdin et un profil sans outils :
`--tools ""`, `--no-chrome`, `--disable-slash-commands`, `--strict-mcp-config`
avec une liste MCP vide, `--setting-sources ""`, `--permission-mode dontAsk`,
`--permission-prompts none`, `--no-session-persistence` et un prompt système
dédié. Aucun `--dangerously-skip-permissions`. `--bare` n’est pas utilisé car il
empêche la lecture du trousseau macOS, donc la connexion par abonnement.

Modèle (`sonnet`, `opus`, `haiku`) et effort (`low`, `medium`, `high`, `xhigh`)
se choisissent dans la bulle de l’assistant. Le serveur n’accepte que ces
valeurs (liste fermée validée par Zod), puis ajoute `--model` et `--effort`.
Les tokens envoyés (cache inclus) et générés sont lus dans la sortie JSON et
affichés sous chaque réponse, avec un total par conversation ; ils ne sont ni
stockés ni renvoyés au fournisseur.

Le processus tourne dans un dossier temporaire vide, avec une liste limitée de
variables d’environnement ; aucune clé d’API n’est transmise. Le résultat est
refusé si plus d’un tour ou un refus de permission apparaît (signe d’un appel
d’outil), si le JSON est invalide ou hors format. La proposition passe par le
même diff et la même validation humaine que Codex, avec la source `claude`.

Preuves : tests unitaires (CLI absent, profil, sortie, outil refusé, faux CLI
réel, stderr masqué), test HTTP sans auto-commit, essai réel avec le CLI 2.1.311
(proposition puis diff ouvert, révision inchangée) et demande hostile refusée.
Limites : macOS du poste étudiant à vérifier ; toute version du CLI est acceptée,
pas seulement la version testée ; ce profil n’est pas un confinement formel.

### 28/10/2026 · Assistant élargi

Le prompt système couvre aussi le PFE, l’école et le travail (réponse en Markdown
simple, rendu sans HTML). Le chat peut **créer** un token (`color.`, `space.`,
`radius.`, `size.`, `font.` + camelCase) ou supprimer un token ajouté (`value: null`),
toujours via le diff. Le contexte inclut le dernier instantané des variables Figma
(`context.figma`, 200 variables au plus) ; le chat n’a toujours aucun outil.
Essai réel CLI 2.1.312 (Haiku, effort faible) : `color.warning` proposé en diff,
comparaison correcte avec l’instantané Figma, aucune prétention d’écriture.

### Connecteur Figma (même CLI, autre profil)

`connectors/figma/claudeFigma.ts` lance `claude -p` avec seulement le serveur MCP
officiel de Figma et seulement `use_figma` autorisé, plus une garde PreToolUse.
Détails : [FIGMA](FIGMA.md).

## Gemini CLI — NOT IMPLEMENTED

Point d’extension : `unvalidatedAdapter('gemini')`. La [référence headless officielle](https://geminicli.com/docs/cli/headless/)
présente JSON/stream-json. L’authentification et les callbacks de permissions restent
à éprouver dans un vrai processus embarqué. Ne pas utiliser de mode yolo ou
supposer qu’un login étudiant permet un usage gratuit sans quota. Même série de
tests que Claude avant d’exposer un bouton actif.
