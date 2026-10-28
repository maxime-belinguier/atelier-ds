# Figma : synchro des variables via Claude Code

DS-Studio lit et met à jour les **variables Figma** de la collection `DS-Studio` d’un
fichier choisi par l’étudiant. Le lien se colle dans le **Brief** du projet ; tout se
pilote depuis **Paramètres › Figma** (ou le bouton **Figma** de l’en-tête).

## Pourquoi ce chemin

- L’API REST des variables Figma est réservée aux comptes Enterprise.
- Le [serveur MCP officiel de Figma](https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/)
  n’accepte que des clients autorisés. **Claude Code en fait partie** : l’atelier passe
  donc par le CLI `claude` de l’étudiant, avec son propre OAuth Figma.
- L’outil `use_figma` exécute un script Plugin API dans le fichier : il sait lire et
  écrire les variables sur tous les plans.
- L’atelier ne lit, ne reçoit et ne stocke aucun jeton : Claude Code s’en charge.

## Connexion (une fois, sur le Mac)

1. Paramètres › Figma › **Connecter** : le Terminal lance
   `claude mcp add --transport http --scope user figma https://mcp.figma.com/mcp`
   puis ouvre Claude Code.
2. Dans Claude Code : `/mcp`, choisir **figma**, puis **Authenticate**. Figma s’ouvre
   dans le navigateur, autoriser.
3. Revenir dans l’atelier : **Revérifier**. L’état vient de `claude mcp get figma`
   (aucun appel au modèle ni à Figma).

Le nom `figma`, le type `http` et l’URL doivent rester identiques : Claude Code range
l’autorisation sous une clé calculée à partir de ces trois valeurs, et l’atelier lance
Claude Code avec exactement la même configuration.

## Ce qui se passe à chaque action

| Action                 | Étapes                                                                                                                                                                                                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Lire depuis Figma**  | Script de lecture → variables `famille/nom` converties en tokens (`color/brand` → `color.brand`) → **diff** habituel « Lu dans Figma ». Rien n’est écrit avant ta validation. Les variables hors convention ou de mauvais type sont listées comme ignorées. |
| **Envoyer vers Figma** | Lecture fraîche → aperçu des seules variables à créer ou changer → **validation** (usage unique, 10 min, liée à la révision du DS et au fichier) → script d’écriture qui **recontrôle dans Figma** les valeurs attendues, écrit, puis **relit**.            |

Une variable Figma absente de l’atelier n’est jamais supprimée. Si Figma a changé
entre l’aperçu et la validation, rien n’est écrit. La dernière lecture est gardée
dans `.ds-studio/figma.json` (privé) : le chat Claude s’en sert pour comparer.

## Garde-fous techniques

- Claude Code est lancé sans outil intégré (`--tools ""`), sans Chrome, sans réglages
  utilisateur, avec **seulement** le serveur `figma` (`--strict-mcp-config`) et
  **seulement** `mcp__figma__use_figma` autorisé (`--permission-mode dontAsk`).
- Le script Plugin API est **généré par l’atelier** (`connectors/figma/scripts.ts`) à
  partir de valeurs validées par le schéma : rien ne vient du navigateur ni du modèle.
- Une **garde PreToolUse** (`connectors/figma/guard.mjs`) bloque l’appel si l’outil,
  le fichier ou l’empreinte SHA-256 du script diffèrent, et n’autorise **qu’un appel**.
- Le résultat est lu dans la **réponse de l’outil**, jamais dans le texte du modèle.
- Le chat Claude n’a jamais accès au MCP Figma : seul le connecteur l’utilise.

## Limites

- Plan Éducation : **10 appels par minute, 200 par jour** sur le MCP Figma
  ([droits et limites](https://developers.figma.com/docs/figma-mcp-server/rate-limits-access/)).
  Chaque lecture compte 1 appel, chaque envoi 2 (aperçu puis écriture).
- Chaque action prend 20 à 60 s et consomme un peu de quota Claude (modèle Sonnet).
- Un seul mode (le mode par défaut de la collection). Pas d’alias en écriture.
- Polices : seules `system-ui`, `Arial`, `Georgia`, `Verdana` sont acceptées par l’atelier.

## Preuves (28/10/2026)

| Élément                                                          | État                                                                                                       |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Scripts de lecture et d’écriture sur le vrai fichier Gutt        | **TESTED** via le MCP officiel : 18 variables créées et relues, écriture refusée si valeur attendue fausse |
| CLI Claude 2.1.312 + garde + MCP simulé (`check-figma-guard.ts`) | **TESTED**, Linux : script recopié à l’identique, appel non conforme bloqué avant le serveur               |
| Lecture en diff, aperçu, validation unique, révision périmée     | **TESTED**, API (`tests/http.test.ts`) et navigateur avec Figma simulé                                     |
| Chaîne complète sur le Mac (OAuth Figma réel dans Claude Code)   | **À FAIRE** : connexion puis « Lire depuis Figma »                                                         |
