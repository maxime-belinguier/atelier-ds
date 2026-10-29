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
en-tête (Brief, Historique, Export, Import) ; deux panneaux redimensionnables,
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

## 27/10/2026 · Refonte visuelle de l’atelier et audit de mise en page

Problème : interface jugée brute et froide ; titres de section et éléments
cliquables trop proches visuellement ; boutons de hauteurs différentes ;
panneaux qui s’écrasaient aux extrêmes de la poignée.
Pistes : références monday.com, Apple, Notion. Fonds testés en situation réelle :
crème, pêche, menthe (écartée : nuit à la lisibilité du voyant « Enregistré »),
blanc chaud et gris (écartés : trop ternes), pêche et lavande pâles.
Décision : fond lavande très pâle, accent corail, boutons principaux noirs ;
cartes très arrondies, tout élément cliquable en pilule ; titres de section en
texte gris simple, sans forme ni survol ; police système (SF Pro sur Mac, aucun
téléchargement, fonctionne hors ligne) ; fond neutre très clair derrière l’aperçu
pour ne pas teinter les écrans Gutt. Corail foncé (#D2401E) pour tout texte blanc
sur corail, contraste 4,5:1 minimum.
Audit : 8 largeurs d’écran (375 à 1920 px), poignée aux deux extrêmes, 4 vues et
2 largeurs d’aperçu chacune, conversation avec messages longs et mots sans
espace, diff de 8 tokens, historique : aucun débordement. Tous les boutons de
l’atelier font 34 px. Panneaux bornés (Design System 440 px, Aperçu 380 px
minimum) ; un panneau étroit replie son menu en ligne et ses réglages sous le nom.
Preuves : 12 tests navigateur et 35 tests unitaires/API réussis (Linux) ; script
d’audit exécuté avec 0 anomalie ; captures relues.
Limite : rendu Safari et vrai Mac à vérifier ; thème sombre non prévu.

## 27/10/2026 · Choix du modèle Claude et compteur de tokens

Problème : impossible de choisir entre un modèle rapide et un modèle plus poussé,
ni de voir ce que consomme chaque demande.
Décision : dans la bulle de l’assistant, choix du modèle (Sonnet par défaut, Opus,
Haiku) et de l’effort (faible à très élevé), mémorisés dans le navigateur ; sous
chaque réponse, modèle, effort, tokens envoyés (cache inclus) et générés ; total
de la conversation. Le serveur n’accepte que ces valeurs (liste fermée), jamais
un argument libre vers le CLI.
Preuves : tests unitaires (arguments ajoutés seulement depuis la liste, valeur
hostile ignorée, lecture du compteur), test HTTP (valeur inventée refusée en 400),
test navigateur (choix transmis, compteur affiché) ; essai réel Haiku / faible.
Limite : le compteur reflète ce que renvoie le CLI, pas une facturation.

## 27/10/2026 · Panneau Design System : alignement et recherche

Problème : réglages décalés d’une ligne à l’autre, liste déroulante au style
natif, recherche peu visible, numéro de révision « r3 » sans intérêt.
Décision : colonne de réglages de largeur fixe pour toutes les lignes, listes
déroulantes au style de l’atelier, recherche avec bordure, fond blanc et loupe,
numéro de révision retiré.
Preuves : 13 tests navigateur réussis ; audit de mise en page sans anomalie.

## 27/10/2026 · Bouton « Brief »

Le bouton « Mon PFE » devient « Brief », plus court et explicite ; le panneau
s’intitule « Brief du projet ». Test navigateur mis à jour et réussi.

## 27/10/2026 · Aperçu : mockups d’appareil et format libre

Problème : aperçu peu immersif, formats figés, outils qui changeaient de place.
Piste écartée : liste déroulante de formats avec champs largeur × hauteur
toujours visibles (moins intuitive, trop encombrante).
Décision : barre fixe sur deux lignes (écran, Ajuster, Mockup, plein écran ;
puis formats 320, 375, 430, 768, 1280, 1440 et « Libre ») ; case « Mockup »
qui affiche un téléphone, une tablette ou une fenêtre de navigateur selon le
format, dessinés en CSS, génériques, sans logo ; « Libre » ouvre une petite
bulle largeur × hauteur (600 × 900 par défaut, mémorisée) et des poignées pour
étirer l’aperçu ; « Ajuster » fait tenir tout l’appareil, hauteur comprise ;
1280 remplace 1024 comme format ordinateur. La largeur CSS reste exacte : le
mockup et le zoom ne changent que l’affichage.
Preuves : 14 tests navigateur (dont mockup par format, case décochée, saisie
libre, étirement à la souris, taille mémorisée) et 38 tests unitaires/API
réussis (Linux) ; audit de mise en page sans anomalie ; captures relues.
Limite : mockups indicatifs, pas des gabarits constructeur exacts.

## 27/10/2026 · Jauge des crédits Claude et zoom Fit | 100 %

Problème : impossible de savoir où en est son abonnement Claude ; le libellé
« Voir en entier » restait flou pour un mode d’affichage.
Décision : le CLI est lu en sortie « stream » pour récupérer les pourcentages
d’utilisation (session de 5 h et semaine) et l’heure de remise à zéro. Un mini
cercle dans l’en-tête de l’assistant montre la fenêtre la plus entamée (vert,
orange dès 70 %, corail dès 90 %) ; un clic ouvre le détail des deux jauges.
Valeurs bornées, mémorisées dans le navigateur, mises à jour après chaque
réponse. Dans l’Aperçu, la case « Ajuster » (puis « Voir en entier », jugé flou)
devient un sélecteur « Fit | 100 % », le vocabulaire des outils de design
(Figma : Zoom to fit).
Sécurité : tout appel d’outil visible dans le flux de Claude est refusé.
Preuves : 40 tests unitaires/API (dont lecture des limites et refus d’outil) et
14 tests navigateur réussis ; essai réel ; audit de mise en page sans anomalie.
Limite : pourcentages d’abonnement, pas un solde en euros ; pas de lecture
avant la première réponse.

## 27/10/2026 · Jauge fiabilisée et titre « Format »

Problème : la jauge restait vide sur mon poste ; les boutons de taille
n’avaient pas de titre.
Décision : lecture des limites compatible avec l’ancien format du CLI (une
seule fenêtre) ; si Claude répond sans limites, la jauge l’explique et propose
« claude update » ; cause principale constatée : serveur non redémarré après
la mise à jour. Titre « Format » devant les tailles d’écran.
Preuves : 41 tests unitaires/API (dont ancien format) et 14 tests navigateur
réussis ; jauge vérifiée sur mon Mac après redémarrage ; audit sans anomalie.

## 27/10/2026 · Navigation du Design System en panneau étroit

Problème : panneau réduit, le menu passait en ligne horizontale coupée
(recherche tronquée, sections hors champ).
Décision : sous 620 px de large, le menu devient une liste déroulante (Tokens,
Composants, Écrans) à côté de la recherche, chacune sur la moitié de la ligne ;
en panneau large, le menu latéral ne change pas.
Preuves : 14 tests navigateur réussis (dont choix d’une section par la liste à
375 px) ; audit de mise en page sans anomalie ; captures relues.

## 27/10/2026 · Sélecteur de couleur

Problème : le sélecteur natif du navigateur ne mettait pas le code HEX en avant
et ne proposait aucune palette.
Inspiration : ma maquette Figma rapide, retravaillée.
Décision : clic sur la pastille d’un token, fenêtre avec le code HEX en premier,
déjà sélectionné (accepte « 4782e1 », « #4782E1 » ou la forme courte « #48E ») ;
zone saturation / luminosité et barre de teinte, utilisables au clavier ;
pipette si le navigateur la propose ; deux palettes sans onglet pour éviter un
clic : « Récentes » (10 dernières couleurs, mémorisées dans le navigateur) et
« Dans ton DS » (couleurs des autres tokens, pour rester cohérent) ; bouton
« Revenir à » la valeur enregistrée. Aperçu immédiat, enregistrement toujours
par le diff. Écarté : les onglets « Récentes / Mes couleurs » de la maquette.
Preuves : 15 tests navigateur (dont HEX court, clavier, palette du DS, récentes,
aucune écriture) et 41 tests unitaires/API réussis ; fenêtre vérifiée dans le
panneau à 375, 1280 (panneau étroit) et 1440 px ; audit sans anomalie.
Limite : pipette absente sur Safari.

## 27/10/2026 · Formats HEX, RGB et HSL dans le sélecteur

Décision : un clic sur l’étiquette « HEX » passe à RGB puis HSL (trois champs
chacun) ; le format choisi est mémorisé. Affichage seulement : la valeur du
token reste enregistrée en HEX, seul format accepté par le schéma.
Preuves : 15 tests navigateur réussis (dont saisie RGB, lecture HSL, retour HEX).

## 27/10/2026 · Transparence écartée

Piste étudiée : ajouter la transparence (alpha) aux couleurs.
Écartée pour l’instant : le schéma n’accepte que #RRGGBB, mes 11 couleurs sont
des couleurs pleines (texte, fonds, marque), et une couleur transparente change
selon le fond, ce qui fausse le contraste 4,5:1. Si Gutt en a besoin plus tard :
tokens dédiés (voile de modale, bordure légère) avec migration du schéma.

## 27/10/2026 · Sélecteur d’écran en une seule forme

Problème : une pilule blanche posée dans une autre pilule, effet de double forme.
Décision : une seule pilule bordée, flèches précédent / suivant et liste
séparées par de fines lignes, icônes de chevron dessinées plutôt que des
caractères, survol discret sur chaque zone.
Preuves : 15 tests navigateur réussis ; audit sans anomalie ; capture relue.

## 28/10/2026 · Figma branché à l’atelier (MCP officiel via Claude Code)

Problème : l’app ne parlait pas à Figma. La consigne « pas de lien Figma » du
START_HERE était une erreur de l’intervenant ; le but est une app utile au
quotidien, branchée à Figma et à mon LLM.
Décision : l’atelier pilote le serveur MCP officiel de Figma à travers Claude Code
(client autorisé par Figma, mon OAuth). Bouton Figma dans l’en-tête et Paramètres ›
Figma : Connecter (Terminal : `claude mcp add … figma` puis `/mcp`), Lire depuis
Figma (diff « Lu dans Figma » à valider), Envoyer vers Figma (aperçu des variables
à écrire, validation à usage unique, puis écriture et relecture). Collection
« DS-Studio », noms `famille/nom` (color/brand, space/md…). La dernière lecture
sert aussi de contexte au chat.
Garde-fous : seul `use_figma` autorisé, script généré par l’atelier, garde
PreToolUse qui bloque tout autre script, fichier ou second appel ; résultat lu dans
la réponse de l’outil, pas dans le texte du modèle ; valeurs attendues recontrôlées
dans Figma avant écriture ; aucune variable Figma supprimée.
Écarté : API REST des variables (Enterprise seulement) ; plugin Figma maison (plus
long à construire et à installer avant vendredi) ; donner le MCP Figma au chat
(il pourrait écrire sans diff).
Preuves : scripts exécutés sur mon fichier « Gutt App PFE » via le MCP officiel
(18 variables créées et relues, écriture refusée quand Figma ne correspond pas) ;
vrai CLI Claude 2.1.312 + garde + faux serveur Figma : script recopié à
l’identique, appel non conforme bloqué ; tests API et navigateur (Figma simulé).
Limites : connexion OAuth sur mon Mac à faire ; plan Éducation limité à 10 appels
par minute et 200 par jour ; 20 à 60 s par action ; un seul mode Figma.

## 28/10/2026 · Tokens ajoutés

Problème : 18 tokens figés, impossible d’ajouter une couleur d’avertissement ou
un espacement sans migration.
Décision : les 18 tokens de base restent obligatoires ; on peut en ajouter avec
un préfixe connu (color., space., radius., size., font. + nom en camelCase) qui
fixe le type. « + Ajouter un token » dans chaque famille, badge « Ajouté »,
suppression par diff (« nouveau token » / « supprimé »). Compatible avec mes
anciens fichiers (même version 1), inclus dans l’historique, les exports CSS et
Tailwind et la documentation.
Écarté : noms libres (types ambigus) ; réécrire tout le schéma.
Preuves : tests unitaires (création, relecture, annulation, noms refusés dont
`__proto__`) et navigateur (ajout, diff, suppression).
Limite : les composants Gutt n’utilisent que les 18 tokens de base.

## 28/10/2026 · Claude assistant au quotidien

Problème : le chat ne servait qu’à changer des valeurs existantes.
Décision : Claude peut créer des tokens, compare avec la dernière lecture Figma,
commente le bilan d’accessibilité (bouton « Faire commenter ce bilan par Claude »)
et aide pour le PFE, l’école ou le travail. Réponses mises en forme (titres,
listes, gras, code) sans HTML, bouton Copier, 4 démarrages rapides. Il reste sans
outil : tout changement passe par le diff.
Preuves : essai réel (Haiku, effort faible) : `color.warning` proposé, écart de
marque avec Figma expliqué, aucune prétention d’écriture.
Limite : contexte = tokens, brief, règles, dernière lecture Figma ; pas de fichiers.

## 27/10/2026 · En-tête en icônes et exports pour l’app Gutt

Problème : trop de boutons texte dans l’en-tête, et un seul export (JSON) alors
que l’app Gutt sera codée en CSS / Tailwind.
Décision : bouton « Brief » à part (c’est le contenu du projet), puis Historique,
Importer et Exporter en icônes dans une seule pastille, avec info-bulle et nom
accessible. Exporter ouvre un menu : Tokens JSON (réimportable), Variables CSS,
Tailwind v4 (@theme), Tailwind v3 (config) et Documentation. Les exports
utilisent les valeurs enregistrées ; le menu prévient s’il reste des
modifications non enregistrées. Fermeture au clic extérieur et avec Échap.
Documentation : page HTML autonome, sans script, imprimable en PDF (couleurs,
typographie, espacements, chaque composant rendu avec ses tokens, bilan
d’accessibilité). Base pour le livrable Design System du PFE. Les styles des
composants sont sortis dans ds-components.css, partagé par l’atelier, l’aperçu
et la doc.
Preuves : tests unitaires des exports, tests navigateur des téléchargements et
de la page Documentation ; PDF généré et relu.

## 27/10/2026 · Menu du Design System : catégories lisibles et repliables

Problème : catégories (Tokens, Composants, Écrans…) peu distinctes des éléments ;
liste longue ; barre de recherche qui se tassait quand le menu s’allongeait.
Décision : titres de catégorie en majuscules, couleur d’accent, trait de
séparation ; chaque titre se replie au clic (chevron, nombre d’éléments affiché
une fois replié, sauf s’il n’y en a qu’un), choix mémorisé. Une catégorie
repliée masque tout ; si elle contient la page ouverte, son titre est mis en
surbrillance (corrigé le 28/10 : avant, la page ouverte restait visible, ce qui
donnait l’impression que le repli ne marchait pas).
La surbrillance est une pastille dessinée sous le titre (::before) : marges,
padding et trait restent identiques, le texte ne bouge plus (corrigé le 28/10 :
avant, le titre actif se décalait et perdait son trait). Hauteur du titre fixée
à 17 px pour que le compteur, affiché une fois fermé, ne la change pas. Recherche fixée à 36 px. Nouvelle catégorie « Contrôle
qualité » (au lieu de « Vérifier », trop vague).
Preuves : test navigateur (repli, mémorisation, hauteur de la recherche) ;
audit de mise en page sans anomalie ; 28/10 : position du texte mesurée
identique (x = 41 px, hauteur 17 px) ouverte, fermée ou surlignée, en haut et
en milieu de menu.
Écarté : changer padding et marges du titre actif (provoquait le saut).

## 27/10/2026 · Accessibilité : créer dans Couleurs, contrôler dans Accessibilité

Problème : je dois prouver que le DS est lisible par tous, et savoir quoi
corriger, selon le type de vision.
Étapes écartées : un audit qui informe sans permettre de corriger ; des
corrections faites dans l’écran de contrôle (mélange création et vérification) ;
une seule notion de « conforme » sans dire pour qui.
Décision, principe UX : on crée dans Couleurs, on contrôle dans Accessibilité.
- Couleurs : menu « Type de vision » en haut, « Vision classique » par défaut,
  puis Malvoyance, Deutéranopie, Protanopie, Tritanopie, Sans couleur. Chaque
  couleur affiche son statut ; si elle bloque, une proposition et « Appliquer »
  apparaissent sous la ligne. Appliquer crée un brouillon, validé par
  « Enregistrer » et le diff.
- Contrôle qualité › Accessibilité : un score par type de vision (6 cartes), la
  liste des problèmes et « Corriger dans Couleurs / Typographie », qui ouvre la
  bonne ligne et la met en évidence. Aucune modification ici. Zones cliquables
  mesurées sur l’écran affiché (24 px minimum, WCAG 2.5.8 ; 44 px conseillés).
- Badge rouge dans le menu : nombre de points à corriger en vision classique.
Règles :
- Vision classique : WCAG 2.2 AA, contraste 4,5:1 pour le texte (1.4.3), 3:1
  pour l’interface (1.4.11). Malvoyance : AAA, 7:1 pour le texte (1.4.6) ;
  l’interface reste à 3:1, WCAG n’a pas de niveau AAA pour elle.
- Daltonismes et sans couleur : les couleurs de sens (alerte, réussite, marque,
  focus) doivent rester différentes une fois simulées ; rappel WCAG 1.4.1 (ne
  pas compter sur la couleur seule). Simulation : matrices de Machado, Oliveira
  et Fernandes (2009), sévérité maximale ; niveaux de gris pour « Sans couleur ».
  Le même filtre s’applique à l’aperçu, avec une étiquette « Vue : … » et un ✕.
- Écart perçu : distance CIE76 (Lab). Seuil de 20 = hypothèse de l’atelier,
  pas une norme ; c’est écrit dans l’app.
- Propositions : même teinte, seule la clarté change, et la couleur reste
  lisible sur les cartes.
- Texte : 16 px conseillés sur mobile, titres au moins 1,25 fois le texte
  (conseils, hors score).
Premiers constats sur Gutt : bordures à 1,74:1 sur les cartes (problème seulement
si la bordure est le seul repère du champ) ; en deutéranopie, alerte et réussite
se rapprochent. Corrigé : le badge « points à vérifier » porte une icône ⚠ en
plus du rouge, le critère WCAG 1.4.1 passe en « OK » dans le contrôle.
Preuves : 53 tests unitaires/API (seuils, corrections qui passent vraiment le
seuil, simulation) et tests navigateur (bilan sans édition, correction appliquée
en brouillon, filtre de l’aperçu, retour en vision classique).
Limite : contrôle sur les tokens, pas un audit WCAG complet de l’app.

## 27/10/2026 · Aperçu : mode Comparer

Problème : passer d’un format à l’autre empêche de voir mobile et desktop
ensemble.
Décision : bouton « Comparer » à droite de la ligne Format. Deux formats
seulement (à trois, le desktop devient illisible dans un panneau d’environ
700 px) : Mobile 375 et Grand écran 1440 par défaut, modifiables avec deux
menus sur la même ligne. Les deux appareils ont la même hauteur, l’échelle
s’affiche sous chacun ; même écran, mêmes modifications, même type de vision.
Fit / 100 % reste en place, grisé pendant la comparaison ; le plein écran ⤢
agrandit les deux. Panneau étroit : Comparer en icône seule.
Comparer s’ouvre toujours sur les deux formats. Deuxième usage, « Avant / après » :
même format des deux côtés, modifications en cours à gauche (après, avec leur
nombre), valeurs enregistrées à droite (avant) : on voit d’abord ce qu’on change
(choix confirmé le 28/10). Libellés « Avant / après » à revoir plus tard.
Écarté après essai : Comparer dans la ligne du titre (la barre passait à la
ligne et les outils changeaient de place).
Preuves : test navigateur (deux aperçus qui suivent une modification, changement
de format, retour à un seul aperçu) ; position et hauteur de la barre mesurées
identiques avant et après le clic ; audit de mise en page sans anomalie.

## 27/10/2026 · Visite guidée

Problème : l’atelier a beaucoup de zones ; une personne qui l’ouvre (intervenant,
camarade, jury) ne sait pas par où commencer.
Décision : visite courte en 6 étapes, dans l’ordre du travail : 1. Design System
(choisir une catégorie, modifier une valeur) ; 2. Contrôle d’accessibilité, juste
après la modification et avant d’enregistrer (la page s’ouvre, le menu défile
jusqu’au lien) ; 3. Enregistrer (diff avant écriture) ; 4. Aperçu (écrans,
formats) ; 5. Comparer (activé pendant l’étape) ; 6. Claude (chat ouvert, modèle
et quota), avec en conclusion l’export et le bouton « ? ». Ouverte seule au
premier lancement, puis avec « ? ». Passer, Précédent, Suivant, flèches et Échap.
Écarté : 11 étapes (trop long), puis 5 étapes (Comparer invisible, contrôle
d’accessibilité montré trop tard).
Fluidité : à chaque étape, la carte et le contour attendent que la zone visée ne
bouge plus ; la carte réapparaît en fondu, déjà à sa place, sans glisser. En
quittant la visite, l’atelier retrouve son état d’avant (chat, Comparer, page).
Correctif général : changer de page dans le Design System repart du haut.
Preuves : test navigateur (ouverture au premier lancement, pas de réouverture,
relance par « ? », 6 étapes, contrôle en étape 2, Comparer affiché, état rétabli) ; position
de la carte mesurée à chaque image à 1440, 1280 et 1024 px : une seule position
par étape, jamais hors écran ; captures relues.

## 27/10/2026 · Paramètres de l’atelier

Problème : aucun endroit pour régler l’atelier (assistant, apparence, Figma,
préférences de démarrage).
Décision : roue crantée dans l’en-tête, qui ouvre une grande modale centrée
(880 × 600 max) avec 4 onglets à gauche. Réglages appliqués tout de suite, gardés
dans le navigateur ; le Design System n’est jamais modifié.
- Assistants IA : Claude est l’assistant du chat. Bouton « Changer de compte »
  (ou « Connecter ») : sur Mac, l’atelier ouvre le Terminal avec la commande
  officielle « claude » ; ailleurs, il affiche la commande à copier. Commande en
  liste fermée côté serveur. Modèle et effort de Claude par défaut. Codex et
  Gemini apparaissent en « Bientôt » pour montrer que l’atelier est prévu pour
  plusieurs IA. L’atelier ne lit, ne reçoit et ne stocke aucun identifiant.
  Écarté : installer et connecter Codex et Gemini depuis l’atelier (beaucoup de
  travail, non testable ici, inutile pour le PFE, et la première connexion
  Gemini exige de toute façon le Terminal).
- Apparence : 9 fonds pastel (lavande, neutre, crème, blanc, ciel, glacier,
  pêche, rose poudré, sable), 4 accents et 4 polices prêts, plus fond et accent
  au choix. Les variantes (texte blanc sur accent, texte d’accent sur fond) sont
  calculées pour rester à 4,5:1 ; un avertissement s’affiche si le fond nuit à la
  lisibilité. Les écrans Gutt de l’aperçu ne changent pas.
- Figma : connexion et synchro (voir l’entrée du 28/10).
- Général : format et type de vision au démarrage, relancer la visite,
  raccourcis clavier, réinitialiser les préférences (tokens, historique et
  brief non touchés).
Preuves : test API (commande fixe, assistant inconnu et commande injectée
refusés) ; test navigateur (onglets, Connecter, apparence appliquée et mémorisée
après rechargement, DS inchangé, état Figma, format de démarrage, Échap) ;
captures relues ; audit de mise en page sans anomalie.
Limite : l’ouverture du Terminal reste à essayer sur mon Mac (macOS ne peut pas
être testé ici).

## 28/10/2026 · Chat : historique des conversations

Problème : le chat se vidait au rechargement. Impossible de retrouver une
réponse utile, et les échanges n’apparaissent pas dans Claude Desktop.
Décision : historique gardé dans ce navigateur (localStorage), 30 conversations
de 300 messages max. « + Nouvelle conversation » et « Conversations » (rouvrir,
supprimer ×). Seuls les 10 derniers messages de la conversation ouverte partent
vers Claude, comme avant : garder l’historique ne coûte aucun token.
Écarté : synchroniser avec Claude Desktop ou un projet Claude (le chat passe par
`claude -p --no-session-persistence`, pas d’accès à ces historiques) ;
stockage côté serveur (inutile pour un usage solo).
Preuves : test navigateur (conversation gardée après rechargement, nouvelle
conversation envoyée sans historique, liste à 2 entrées, réouverture) ; suite
complète (66 unitaires, 28 navigateur) ; audit de mise en page sans anomalie ;
capture relue.
Limite : vider les données du navigateur efface l’historique ; pas d’export.

## 28/10/2026 · Plusieurs projets dans l’atelier

Problème : l’atelier ne servait qu’à Gutt. Je veux l’utiliser pour d’autres
projets (école, travail, freelance).
Décision : menu de projet sous « DS-Studio ». Chaque projet a une pastille à sa
couleur de marque et sa date de dernière utilisation. « Nouveau projet » ouvre
une fenêtre : nom, puis point de départ en deux cartes avec aperçu visuel
(« Partir de zéro » ou « Copier le projet ouvert », qui ne change pas). Après
la création, un message rassure et propose 3 raccourcis : couleur de marque,
brief, Figma. Chaque projet a ses tokens, son historique, son brief, sa lecture
Figma et ses conversations. L’app rouvre le dernier projet. Gutt garde son
dossier d’origine : rien n’est déplacé. PFE.md et les règles Gutt ne partent
vers Claude que pour Gutt. Changer de projet est bloqué si des modifs ne sont
pas enregistrées ou si Claude répond ; un onglet resté sur l’ancien projet ne
peut rien écrire (409).
Écarté : formulaire dans le menu avec boutons radio (trop petit, « tokens de
base » pas compris) ; mise en ligne pour l’instant (Cloudflare Access possible,
mais le chat demanderait une clé API payante et Figma le plugin) ; renommer et
supprimer un projet ; espace projet complet (cadrage, benchmark, Notion), prévu
après vendredi.
Preuves : test API (création, tokens et brief séparés, copie, projet inconnu,
onglet périmé refusé) ; test navigateur (fenêtre, cartes, accueil, verrou si
modif, retour sur Gutt) ; suite complète (67 unitaires, 29 navigateur) ; audits
mise en page et visite sans anomalie ; captures relues (1440 et 375 px).
Limite : les écrans de l’aperçu restent ceux de Gutt pour tous les projets.
Il faut relancer l’app après la mise à jour ; sinon le menu affiche « Projet »
et demande de relancer (au lieu de « … » et d’un bouton bloqué sans raison).

## 28/10/2026 · Bulle Figma : état de connexion

Problème : la bulle Figma de l’en-tête ne disait pas si Figma était prêt.
Décision : pastille sur le logo. Verte : connecté et fichier lié. Orange :
compte à connecter ou lien Figma manquant. Grise : vérification en cours.
Le survol affiche « Figma connecté » ou « Figma à connecter ». Vérifié au
chargement et à la fermeture des Paramètres ou du Brief (`claude mcp get`,
aucun quota).
Écarté : centraliser Notion et la recherche dans un onglet Projet (doublon
du projet Claude déjà relié à Notion et Figma).
Preuves : test navigateur Figma (orange sans lien, verte après le lien) ;
captures des deux états relues.
Limite : l’état ne se met pas à jour seul si la connexion change dans le
Terminal ; rouvrir les Paramètres ou recharger.

## 28/10/2026 · Paramètres : identité, mode sombre, projets et données

Problème : le nom et le logo de l’app sont figés alors que je ne les ai pas
choisis ; les Paramètres montraient des assistants pas encore disponibles et
il manquait des réglages de base (mode sombre, gestion des projets, données).
Décision :
- Onglets dans l’ordre d’usage : Apparence, Assistants IA, Figma, Projets,
  Général. Les Paramètres s’ouvrent sur Apparence.
- Apparence › Identité : nom de l’app (en-tête et onglet du navigateur) et
  logo en texte court, initiales ou image (PNG, JPEG, WebP, SVG, 200 Ko max),
  couleur du carré, aperçu et « Revenir à DS-Studio ». Gardé dans ce navigateur.
- Apparence › Mode : clair, sombre ou auto (suit le Mac en direct). Le sombre
  garde le fond choisi en teinte, l’accent reste lisible (4,5:1) ; les
  couleurs d’état (vert, orange, rouge) passent par des variables avec une
  version sombre. Les écrans Gutt de l’aperçu ne changent pas.
- Assistants IA : seule la carte Claude reste ; Codex et Gemini tiennent en une
  ligne « Bientôt ». L’onglet garde son nom pour changer d’assistant plus tard.
- Projets : renommer et supprimer. Gutt et le projet ouvert ne se suppriment
  pas. Supprimer n’efface rien du disque : le dossier part dans
  `projets-supprimes/` ; ses conversations sont retirées du navigateur.
- Projets › Données : chemin du dossier, « Ouvrir le dossier » (Finder sur
  Mac, chemin fixé par le serveur), « Copier le chemin » et rappel de sauvegarde.
- Général : effacer les conversations du projet (avec confirmation) et
  À propos (nom, version, doc).
Construction alignée sur le reste : cartes à 14 px et bordure forte comme
les assistants, choix exclusifs (logo, mode) en segmenté comme l’en-tête,
libellés de champ en 12 px, boutons d’action de 34 px. Sur mobile (375 px),
aucun onglet ne déborde.
Écarté : renommer l’onglet en « Claude » (je pourrais changer d’assistant) ;
sauvegarde automatique ou zip depuis l’app (l’historique doit être copié
serveur arrêté) ; corbeille avec restauration dans l’app (pour plus tard).
Preuves : test API (renommer, nom vide refusé, Gutt et projet ouvert protégés,
dossier rangé dans projets-supprimes, chemin et version) ; test navigateur
(nom, initiales, titre de l’onglet, mode sombre gardé après rechargement,
renommer, supprimer, ouvrir le dossier, retour à DS-Studio) ; suite complète
(68 unitaires, 30 navigateur) ; audit de mise en page sans anomalie ; captures
relues en clair et en sombre (atelier, chat, Paramètres).
Limite : l’ouverture du Finder reste à essayer sur mon Mac (désactivée dans
les tests) ; restaurer un projet supprimé se fait à la main pour l’instant.

## 28/10/2026 · Composants : planche à gauche, écran cohérent à droite

Problème : un composant n’était visible qu’en petite démo ; impossible de voir
ses états (survol, focus, désactivé), et l’Aperçu ne montrait pas forcément
un écran qui le contient.
Décision : quand un composant est ouvert dans le menu :
- à gauche, sa planche à taille réelle au-dessus de ses tokens : Boutons en
  3 variantes × 4 états (survol et focus forcés, sans souris), Fit / 100 %,
  mesures calculées depuis les tokens. On modifie et on voit tout de suite ;
- à droite, l’Aperçu passe sur un écran qui contient le composant, l’entoure
  en pointillé, l’amène à l’écran s’il est sous le pli et indique « Boutons ·
  1 sur cet écran ». Si on choisit à la main un écran sans ce composant, un
  message le dit et propose l’écran qui le contient.
La planche garde le fond du DS, même en mode sombre. Le contour n’altère pas
la forme du composant (outline seulement).
Constat sur Gutt : le bouton Suppression n’a pas d’état survol (identique au
normal) ; le survol principal ne suit pas un changement de couleur de marque
(token séparé `color.brandHover`).
Écarté après essai : un mode « Composant » dans l’Aperçu avec bouton Écran /
Composant (on ne voyait plus l’écran en même temps) ; la page séparée façon
Storybook ; le lien token ↔ aperçu au survol (moins direct pour ce besoin).
Preuves : test navigateur (Formulaire ouvre l’écran du formulaire et
l’entoure, planche à 12 boutons, survol et focus visibles, 100 %, contour qui
suit le composant et disparaît sur Couleurs, token modifié reflété) ; suite
complète (68 unitaires, 31 navigateur) ; audit de mise en page sans anomalie ;
visite guidée : une position par étape ; captures relues en clair et sombre.
Suite : planches d’états pour les 4 autres composants. Fiche logement
(normale, gardée), Points à vérifier (0, 2 et 5 sur 5), Formulaire (champ et
case : normal, focus, rempli, erreur, désactivé ; états en lignes pour rester
lisible sans réduire), Navigation (normal, focus, actif). Pas de colonne
survol pour les onglets : le DS n’en a pas, la planche ne l’invente pas.
Correctif : le nombre « X sur cet écran » pouvait rester à 0 si l’écran de
l’Aperçu n’avait pas fini de charger ; il est recompté quand l’écran change,
et une réponse de l’écran précédent est ignorée.
Écarté : Formulaire en colonnes d’états (réduit à 49 %, illisible).
Preuves (suite) : test navigateur par composant (2 fiches, 3 progressions,
5 champs avec erreur et focus visibles, onglet actif unique) ; suite complète
(68 unitaires, 32 navigateur, 6 passages de suite sans échec) ; audit de mise
en page sans anomalie ; visite guidée 1:1 ; captures relues en clair et sombre.
Limite : la liste des écrans par composant est écrite à la main ; l’erreur
du champ n’a pas de message texte, seulement la bordure (comme dans le DS).

## 29/10/2026 · Composants : planche collée en haut

Problème : en descendant vers les derniers tokens (taille du texte), la
planche sortait de l’écran ; on ne voyait plus l’effet du réglage.
Décision : la planche reste collée en haut du panneau pendant le défilement,
avec une ombre légère. Hauteur limitée à 46 % de l’écran pour laisser la
place aux réglages ; au-delà, la planche défile à l’intérieur.
Écarté : réduire la planche au défilement (plus complexe, moins lisible) ;
un aperçu flottant séparé.
Preuves : test navigateur (taille du texte à 20 px en bas de liste : planche
toujours visible, mesure « texte 20 px ») ; suite complète (32 navigateur) ;
audit de mise en page sans anomalie ; visite guidée 1:1 ; captures relues en
clair et sombre.
Limite : sur un petit écran, la planche occupe près de la moitié du panneau.

## 29/10/2026 · Audit : tutoiement, doublons Brief / Paramètres, survols

Problème : l’app mélangeait « tu » et « vous » ; le nom du projet et le lien
Figma se réglaient à deux endroits ; le survol de la marque ne suivait pas
une nouvelle couleur de marque, et Suppression n’avait pas de survol.
Décision :
- tous les textes passent au « tu » (atelier, messages du serveur, assistants) ;
- le Brief affiche le nom du projet sans le modifier (Paramètres › Projets)
  et n’a plus de lien Figma : il se règle dans Paramètres › Figma ;
- marque modifiée : la ligne « Marque au survol » propose une valeur qui garde
  le même écart qu’avant, avec « Appliquer ». Rien n’est appliqué seul, la
  modification passe par le diff habituel ;
- Suppression : survol qui assombrit la couleur d’alerte (sans nouveau token).
Écarté : faire suivre le survol automatiquement (modification de token non
validée) ; un token dédié au survol de Suppression (alourdit le DS).
Preuves : tests navigateur (Brief sans doublon, lien Figma enregistré dans
Paramètres, proposition de survol puis Appliquer, survol Suppression distinct) ;
suite complète (68 unitaires, 33 navigateur, 2 passages) ; audit de mise en
page sans anomalie ; visite guidée 1:1 ; captures relues.
Limite : le lanceur (scripts/launcher.mjs) garde le « vous » ; le survol
proposé est un calcul simple (même rapport de luminosité), à juger à l’œil.

## 29/10/2026 · Tests GitHub lancés à la main

Problème : chaque push lançait toute la suite sur Linux, Windows et macOS ;
les 2 000 minutes Actions du mois ont été épuisées (macOS compte ×10).
Décision : la qualification GitHub ne part plus à chaque push, elle se lance
à la main (Actions › Qualifier le starter › Run workflow). Les 3 systèmes sont
gardés pour ce lancement.
Écarté : garder Linux seul (moins de preuves multi-plateformes) ; « [skip ci] »
à chaque push (oubli facile).
Preuves : fichier relu ; les tests locaux restent faits avant chaque push.
Limite : sans lancement manuel, aucune preuve Windows / macOS n’est produite.

## 29/10/2026 · Enregistrer envoie aussi vers Figma

Problème : pour mettre Figma à jour après une modif, il fallait enregistrer,
ouvrir Paramètres › Figma, Envoyer, puis valider un second aperçu.
Décision : le diff « Valider les changements » a une case « Envoyer aussi
vers Figma » (cochée par défaut, choix retenu, visible seulement si Figma est
connecté et lié). Après l’enregistrement, l’envoi part tout seul et une
pastille à côté de « Enregistré » dit « Envoi vers Figma… » puis « Envoyé à
Figma ✓ · n variable(s) » (disparaît après 6 s). Sécurité : on n’envoie que
les tokens qui viennent d’être validés ; si Figma a d’autres écarts (modifiés
dans Figma), rien n’est écrit et la pastille propose « Voir ». Pas d’envoi
quand les valeurs viennent d’être lues dans Figma.
Écarté : un menu dans la bulle Figma (encore un clic de plus) ; un envoi sans
case (pas de choix possible).
Preuves : test navigateur (case cochée dans le diff, « Envoyé à Figma ✓ ·
1 variable », Figma ensuite identique à l’atelier) ; suite complète (68
unitaires, 33 navigateur) ; audit de mise en page sans anomalie ; visite
guidée 1:1 ; captures relues.
Limite : testé avec le Figma simulé ; le vrai envoi prend 20 à 60 s via
Claude Code.

## 29/10/2026 · Zoom libre sur la planche et l’aperçu

Problème : seulement Fit ou 100 % ; impossible de zoomer ou dézoomer.
Décision : un même contrôle « Fit | − NN % + » sur la planche des composants
et sur l’aperçu. − / + par paliers (25 à 200 %), clic sur le pourcentage =
retour à 100 %. Pincement du pavé tactile ou Cmd / Ctrl + molette, y compris
au-dessus de l’écran de l’aperçu (le geste est transmis par l’iframe). Le zoom
de l’aperçu est retenu ; la largeur CSS de l’écran ne change jamais.
Écarté : un curseur de zoom (plus large, moins précis) ; zoomer toute la page.
Preuves : tests navigateur (aperçu 100 % puis 75 %, largeur CSS 1280 gardée ;
planche 100 % puis 125 %) ; pincement vérifié sur l’écran et sur le fond ;
suite complète (68 unitaires, 33 navigateur) ; audit de mise en page sans
anomalie (outils de l’aperçu qui passent à la ligne à 1100 px) ; visite
guidée 1:1 ; captures relues.
Suite : la vue zoomée se déplace en glissant (curseur main, comme Figma) sur
la planche et sur le fond de l’aperçu ; Espace + glisser marche aussi
au-dessus de l’écran de l’aperçu. Un clic reste un clic (déplacement après
4 px). Barres de défilement toujours visibles (masquées par défaut sur Mac).
Preuves (suite) : test navigateur (planche à 125 %, glisser = défilement
horizontal) ; Espace + glisser vérifié sur l’écran ; suite complète (33
navigateur) ; audit de mise en page sans anomalie ; visite guidée 1:1.
Limite : en mode Comparer, le zoom reste automatique ; sans Espace, glisser
sur l’écran de l’aperçu agit sur l’écran (boutons, champs), pas sur la vue.

## 29/10/2026 · « Lire Figma » en accès direct, vérification automatique

Problème : « Lire depuis Figma » était caché dans Paramètres › Figma, et rien
ne prévenait d’un changement fait dans Figma.
Décision : bouton « Lire Figma » dans l’en-tête, à côté de la bulle Figma
(visible quand Figma est connecté et lié). L’app lit Figma seule à
l’ouverture et au retour sur la fenêtre (au plus une fois toutes les 5 min,
car chaque lecture passe par Claude Code) ; s’il y a des écarts, une pastille
affiche leur nombre. Un clic ouvre le diff habituel ; rien n’est appliqué sans
validation. Sans écart : « Figma : rien de nouveau ✓ ». Un envoi après
Enregistrer attend la fin d’une lecture en cours.
Écrans moyens (< 1280 px) : Figma, Lire Figma et Brief passent en icônes
(nom gardé pour les lecteurs d’écran) pour garder l’en-tête sur une ligne.
Écarté : appliquer automatiquement ce qui vient de Figma (contraire à la
règle du diff validé) ; lire Figma en continu (coût et quota).
Preuves : test navigateur (lecture « rien de nouveau », puis écart détecté
seul au rechargement : « Lire Figma, 1 nouveauté », clic = diff « Lu dans
Figma ») ; suite complète (68 unitaires, 33 navigateur) ; audit de mise en
page sans anomalie ; en-tête sur une ligne à 1024 px ; visite guidée 1:1.
Limite : pendant une lecture auto (20 à 60 s), le chat peut répondre « déjà
en cours ». Composants : voir l’entrée suivante.

## 29/10/2026 · Composants Figma visibles dans l’atelier (Figma → app)

Problème : un composant créé dans Figma n’apparaissait pas dans l’app ; seules
les variables étaient lues.
Décision : la lecture Figma (bouton « Lire Figma », lecture auto, Paramètres)
lit aussi les composants du fichier, dans le même appel unique et gardé par
empreinte. Ils apparaissent dans un groupe « Depuis Figma » sous Composants,
une colonne par variante. Le rendu est approximatif (auto-layout, couleurs,
marges, arrondis, textes) ; chaque valeur liée à une variable devient le
token de l’atelier, donc le rendu suit les modifs en cours. Les données
Figma sont relues et bornées avant stockage et affichage. Un message
« Composants Figma à jour ✓ » signale un changement.
Écarté : app → Figma pour les composants (pas fiable) ; un appel séparé pour
les composants (double quota) ; images, effets et icônes vectorielles.
Preuves : lecture réelle du fichier Gutt via Claude Code et la garde (18
variables, Bouton, Fiche logement, Tag, 14 s) ; test unitaire du nettoyage
des données ; tests serveur (lecture, conservation après envoi) et
navigateur (Tag affiché, tokens liés) ; suite complète (69 unitaires, 33
navigateur) ; audit de mise en page sans anomalie ; visite guidée 1:1.
Limite : rendu approximatif (pas d’images ni d’ombres) ; une lecture prend
environ 15 s.

## 29/10/2026 · Paramètres, projets et visite guidée remis à jour

Problème : couleur du logo limitée à 5 choix ; Apparence en une seule
colonne sans séparation ; « Partir de zéro » reprenait les couleurs de Gutt ;
suppression de projet introuvable (cachée dans Paramètres, impossible pour
le projet ouvert) ; visite guidée muette sur Figma, le zoom et les projets.
Décision : « Au choix » pour la couleur du logo, avec le sélecteur de
couleur de l’atelier ; Apparence en trois cartes (Identité, Thème, Police).
Nouveau projet « zéro » : projet libre, vide (voir l’entrée « Partir de
zéro = projet libre ») ; le nom du projet remplace « gutt » dans l’en-tête
de l’aperçu.
Menu de projet : lien « Renommer ou supprimer… » vers Paramètres › Projets ;
le projet ouvert se supprime aussi (Gutt est rouvert, dossier gardé dans
projets-supprimes). Visite guidée : 7 étapes, avec « Relie Figma », la case
d’envoi vers Figma, le zoom et le menu des projets.
Écarté : créer des composants dans l’app sans Claude (gros éditeur, doublon
de Figma, qui alimente déjà l’app) ; écrans de test propres à chaque projet
(les écrans restent ceux de Gutt, seul le nom change).
Preuves : tests serveur (départ neutre, suppression du projet ouvert,
contrastes) ; tests navigateur (logo au choix appliqué, nom dans l’aperçu,
lien du menu, visite 7 étapes) ; suite complète (70 unitaires, 33
navigateur) ; audit de mise en page sans anomalie ; visite guidée 1:1 aux
trois tailles.
Limite : les composants et écrans de l’aperçu restent ceux de Gutt pour
tout projet.

## 29/10/2026 · Âge de la lecture Figma, chat qui attend Figma

Problème : rien ne disait si les données Figma de l’app étaient fraîches ;
une lecture Figma en cours faisait répondre au chat « déjà en cours ».
Décision : « Lire Figma » affiche la dernière lecture réussie (« à
l’instant », « il y a 3 min »), reprise du dernier instantané au chargement
et mise à jour toutes les 30 s ; masquée sous 1280 px avec le libellé (gardée
dans l’infobulle). Le chat attend la fin d’une lecture Figma puis envoie la
demande, avec « Lecture Figma en cours, ta demande part juste après… » ; la
lecture auto ne démarre pas pendant une réponse de Claude.
Écarté : file d’attente côté serveur (plus lourd, même résultat ici).
Preuves : test navigateur (« à l’instant » après lecture ; demande envoyée
pendant une lecture ralentie, message d’attente puis réponse) ; suite
complète (70 unitaires, 33 navigateur) ; audit de mise en page sans
anomalie ; en-tête sur une ligne à 1280 px.
Limite : un clic manuel sur « Lire Figma » pendant une réponse de Claude
reçoit toujours « déjà en cours ».

## 29/10/2026 · Figma relu à chaque retour sur l’app

Problème : après un changement dans Figma, il fallait attendre jusqu’à 5 min
ou cliquer sur « Lire Figma » : trop lent pour un aller-retour constant.
Décision : l’app relit Figma à chaque retour sur sa fenêtre (focus ou onglet
visible), avec 20 s minimum entre deux lectures (3 par minute au plus, sous
la limite Figma de 10). Les composants s’affichent sans clic ; les variables
restent à valider dans le diff (règle du diff validé).
Écarté : plugin Figma pour une synchro instantanée (plus fluide, mais environ
un jour de travail avant la soutenance) ; lecture en continu (quota).
Preuves : test navigateur (pas de relecture avant 20 s, relecture seule
après) ; suite complète (70 unitaires, 33 navigateur).
Limite : environ 15 s entre le retour sur l’app et l’affichage ; plus de
lectures, donc plus de quota Figma (200 appels par jour sur le plan
Éducation).

## 29/10/2026 · Nouveau projet : plus de refus pendant Figma, erreur visible

Problème : créer un projet pendant une lecture Figma (souvent la lecture
auto) répondait « Attends la fin de la demande Claude ou Figma… », peu
compréhensible et affiché sous la fenêtre ; pas de création depuis
Paramètres › Projets.
Décision : le serveur attend la fin de la demande Claude ou Figma (90 s au
plus) avant de créer ou changer de projet, au lieu de refuser ; au-delà,
« Claude ou Figma travaille encore. Réessaie dans une minute. ». Les erreurs
de création s’affichent dans la fenêtre « Nouveau projet ». Bouton
« + Nouveau projet » dans Paramètres › Projets (même fenêtre que le menu).
« Partir de zéro » décrit un projet vide.
Écarté : couper la lecture Figma en cours (perdrait la lecture).
Preuves : test serveur (création lancée pendant une réponse de Claude,
créée après) ; test navigateur (création depuis les Paramètres, erreur dans
la fenêtre) ; suite complète (71 unitaires, 33 navigateur) ; audit de mise
en page sans anomalie.
Limite : la création peut prendre jusqu’à 15 s si une lecture Figma tourne.

## 29/10/2026 · Création de composant dans l’atelier : retirée

Problème : une création de composant sans Claude avait été ajoutée (trois
modèles : bouton, carte, étiquette). À l’usage, trop limitée pour créer un
vrai composant, et rangée dans un groupe à part au lieu de Composants.
Décision : feature retirée (code, données d’API, tests). Les composants se
créent dans Figma. Un seul groupe « Composants » dans le menu : ceux de
l’atelier puis ceux lus dans Figma, marqués « Figma » (plus de groupe
« Depuis Figma » à part).
Écarté : un éditeur libre (calques, mise en page, états, variantes) :
revient à refaire Figma, pas faisable proprement avant la soutenance.
Preuves : suite complète et audit de mise en page après retrait ; test
navigateur du Tag Figma dans le groupe Composants.
Limite : aucune création de composant dans l’app.

## 29/10/2026 · Composants : Figma et l’app reliés par leur nom

Problème : les composants de l’app et ceux de Figma s’affichaient côte à
côte sans lien ; impossible de savoir si les deux étaient cohérents.
Décision : chaque composant de l’app est relié au composant Figma du même
nom (accents, casse et pluriel ignorés : « Boutons » = « Bouton »). Menu :
« ✓ » si présent dans Figma, « Hors Figma » sinon, « À coder » pour un
composant présent seulement dans Figma. Sous la planche, la version Figma
(rendu lu, approximatif, avec les tokens en cours) ou « Absent de Figma ».
Dans le fichier Gutt, création des composants manquants « Points à
vérifier », « Formulaire » et « Navigation », liés aux variables DS-Studio.
Lecture Figma : tailles « fixe », « remplir » et « contenu » distinguées
(avant, fixe et remplir étaient confondus : barre et cases invisibles).
Écarté : recoder un composant depuis Figma automatiquement (pas fiable).
Preuves : lecture réelle du fichier (6 composants) ; test navigateur
(« Hors Figma », relié avec version Figma, « À coder ») ; suite complète
(71 unitaires, 33 navigateur) ; audit de mise en page sans anomalie.
Limite : le rapprochement se fait par le nom ; le rendu Figma reste
approximatif ; le statut ne compare pas le détail (couleurs, marges).

## 29/10/2026 · Partir de zéro = projet libre

Problème : un projet « Partir de zéro » gardait les 18 tokens, les 5
composants et les écrans de Gutt (seules les valeurs changeaient). On
croyait avoir encore le projet d’avant : parcours sans sens.
Décision : « Partir de zéro » crée un projet libre et vide : aucun token,
aucun composant ni écran de Gutt, brief et lien Figma vides. Les 18 tokens
de base deviennent facultatifs ; « + Ajouter un token » crée n’importe quel
token, y compris un de base (ex. color.brand). Aperçu : « Pas encore
d’écran ». Accessibilité : contrôles sans token retirés, jamais affichés
comme réussis (« – » dans le menu, « Rien à contrôler »). L’accueil propose
« Ajouter ta première couleur ». « Copier » garde tokens et nature du
projet copié. Gutt et ses données ne changent pas.
Écarté : gris neutres préremplis (pas un vrai départ de zéro).
Preuves : tests serveur (projet vide, premier token de base créé, copie non
libre) ; test navigateur (tokens vides, pas d’écran ni de composant Gutt,
retour sur Gutt intact, verrou si modif) ; suite complète (70 unitaires, 33
navigateur) ; audit de mise en page et visite guidée sans anomalie ;
captures relues.
Limite : un token de base ajouté ne se supprime pas ; les projets « zéro »
créés avant (ex. « tets gut ») gardent les gris neutres : les supprimer et
recréer. Les composants Figma lus s’affichent ; aucun composant codé.

## 29/10/2026 · Zoom de l’aperçu : barre flottante

Problème : « Fit » et le pourcentage en haut de l’aperçu n’étaient pas
compris ; il fallait deviner que cliquer sur le % remettait à 100 %.
Décision : barre de zoom flottante en bas à droite de l’aperçu, comme dans
Figma : « Ajuster » (surligné quand actif), −, niveau en %, +. Le % n’est plus
un bouton. Même barre pour la planche des composants. Glisser pour se
déplacer et Ctrl/Cmd + molette ou pincement restent en place.
Écarté : pourcentage cliquable (action cachée).
Preuves : suite navigateur (33 tests, zoom par + / − jusqu’à 100 %, Ajuster,
glisser) ; audit de mise en page et visite guidée sans anomalie ; captures
relues.
Limite : plus de raccourci direct vers 100 % (passer par + ou −) ; barre
masquée en mode Comparer (les deux aperçus restent ajustés).
