# Journal de décisions du projet

## V1 — Starter

React permet d’employer exactement les mêmes composants dans le catalogue et
le viewport isolé. Le backend HTTP Node utilise la bibliothèque standard ; Zod
valide les entrées et les fichiers. Vite compile le frontend. Pas d’Electron,
base distante, Figma ou LLM obligatoire.

Codex propose du JSON sans outils ; le contrôleur est l’unique auteur des changements
locaux validés. Claude et Gemini ne sont pas activés sans qualification.

## À compléter par l’étudiant

Date, problème, options explorées, décision, preuves et limite connue.

## 27/10/2026 · Claude dans l’application

Problème : je veux travailler uniquement dans DS-Studio, demande à gauche et
résultat à droite, avec Claude plutôt que Codex.
Option écartée : utiliser Codex (autre compte) ou Claude seulement en terminal.
Décision : adaptateur Claude Code sans outils, sur le modèle de Codex. Le chat
propose des valeurs de tokens, je valide toujours le diff.
Preuves : 35 tests unitaires/API et 10 tests navigateur réussis (Linux), essai
réel Claude 2.1.311 : diff ouvert sans écriture, demande hostile refusée.
Limite : essai sur mon Mac à faire ; le chat ne crée ni token ni composant.


## 27/10/2026 · Écrans et composants Gutt

Problème : l’exemple Lisière (ateliers de quartier) ne parle pas de mon PFE.
Décision : remplacer le contenu par Gutt, sans changer les tokens ni le moteur.
Fiche logement (loyer, prix au m², badge danger « points à vérifier »), liste
des points à vérifier avec barre de progression (seul élément ludique), formulaire
« Ajouter un logement » qui calcule le prix au m², navigation Mes biens / À vérifier
/ Profil. Vocabulaire du tuteur respecté (pas de « red flags »). Tutoiement.
Preuves : 35 tests unitaires/API et 10 tests navigateur réussis (Linux), captures
375 px et desktop relues. Limite : couleurs encore celles de l’exemple, données fictives.

## 27/10/2026 · Historique en panneau latéral

Problème : l’historique s’ouvrait comme une section en haut de page, qui poussait
le contenu, avec un vocabulaire technique (« révision », clés de tokens seules).
Décision : panneau latéral modal au-dessus de l’atelier (fond flouté, fermeture
par ×, Échap ou clic sur le fond), frise des changements du plus récent au plus
ancien, nom lisible du token (« Couleur de marque ») avec sa clé, valeurs avant
et après avec pastille de couleur, origine en clair (« Fait à la main »,
« Proposé par Claude »). Bouton « Revenir en arrière sur ce changement » : le
panneau se ferme et le diff de validation s’ouvre.
Preuves : 35 tests unitaires/API et 11 tests navigateur réussis (Linux), dont un
test du panneau (Échap, ×, clic sur le fond) ; captures desktop et 375 px relues.
Limite : animation coupée si l’utilisateur réduit les animations du système.

## 27/10/2026 · Refonte de l’interface de l’atelier

Problème : trois colonnes figées, éditeur de tokens peu lisible (un token à la
fois via une liste déroulante), aperçu desktop difficile à voir, chat qui occupe
une colonne entière.
Pistes écartées : trois panneaux redimensionnables (plus de réglages sans
simplifier), bandeau assistant en haut (mange la hauteur).
Décision, inspirée de Storybook, du panneau Variables de Figma et de Tokens Studio :
en-tête (Mon PFE, Historique, Export, Import) ; deux panneaux redimensionnables,
Design System (menu Tokens / Composants / Écrans, recherche, une ligne par token
avec nom lisible, pastille ou curseur, contraste, rétablir) et Aperçu (320 à
1440 px, « Ajuster » qui réduit l’affichage sans changer la largeur CSS réelle,
plein écran) ; assistant Claude en bulle flottante qui se replie quand un diff
s’ouvre ; chaque composant affiche les tokens qu’il utilise.
Écart assumé avec le starter : aperçu immédiat des modifications non validées.
Justification : rien n’est écrit sur disque avant le diff et la validation ;
l’aperçu passe à l’iframe par message de même origine, revalidé par le schéma ;
plusieurs tokens se valident en un seul diff ; les modifications en cours sont
gardées dans l’onglet après rechargement.
Preuves : 35 tests unitaires/API et 12 tests navigateur réussis (Linux), dont
aperçu sans écriture, diff refusé sans perte, largeurs réelles, redimensionnement
au clavier, plein écran, assistant ; essai réel avec Claude (diff ouvert, bulle
repliée) ; captures desktop et 375 px relues.
Limites : liste des tokens utilisés par composant tenue à la main (à mettre à
jour si le CSS change) ; zoom « Ajuster » visuel seulement ; essai sur Mac à faire.

## 27/10/2026 · Statut d’enregistrement en haut, enregistrement manuel

Problème : la barre jaune en bas du panneau prenait de la place et l’état
« enregistré ou non » n’était pas visible partout.
Piste écartée : enregistrement automatique. Il supprimerait le diff avant
écriture, règle centrale du starter ; je garde l’enregistrement manuel.
Décision : voyant discret dans l’en-tête, vert « Enregistré », orange « n modifs
non enregistrées », rouge « valeur à corriger », avec Annuler et Enregistrer (n)
à côté ; raccourci Ctrl/Cmd + S qui ouvre le même diff.
Preuves : 12 tests navigateur réussis (Linux), dont statut « Enregistré » après
validation et enregistrement au clavier ; captures desktop et 375 px relues.

## 27/10/2026 · Sélecteur d’écran évolutif et historique simplifié

Problème : deux boutons d’écran côte à côte ne tiennent plus avec beaucoup
d’écrans ; le numéro de version sur le bouton Historique grossit sans rien dire
d’utile ; l’enregistrement groupé n’était pas assez explicite.
Décision : sélecteur d’écran avec position (« 1/2 »), écran précédent / suivant,
liste filtrable avec description, utilisable au clavier (flèches, Entrée, Échap) ;
bouton « Historique » sans numéro ; phrase d’aide qui rappelle qu’un seul
« Enregistrer » valide toutes les modifications en cours.
Preuves : 12 tests navigateur réussis (Linux), dont recherche d’écran, choix et
précédent / suivant ; capture relue.
Limite : la liste des écrans est déclarée à la main dans DesignSystem.tsx.
