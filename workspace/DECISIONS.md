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

## 27/10/2026 · Figma : lecture par Claude, import validé par le diff

Besoin : construire le DS dans Figma et le vérifier dans DS-Studio.
Constat : l’app elle-même ne se connecte pas à Figma (le starter ne fournit qu’un
contrat vide, et interdit les contournements de session ou de jeton). En revanche,
Claude lit mon fichier Figma par le connecteur officiel (testé : compte reconnu,
fichier « Gutt App PFE » lu, encore aucune variable dedans).
Décision : je crée mes variables dans Figma avec les mêmes noms que l’app
(color/brand, space/md, radius/control…). Claude les lit et prépare un JSON que
j’importe ; l’app montre le diff et je valide.
Limite : 18 tokens dans le schéma actuel, au-delà migration nécessaire. Le
libellé « Figma non connecté » reste affiché : c’est l’état réel de l’app.

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
une fois replié), choix mémorisé ; l’élément affiché reste visible même si sa
catégorie est repliée. Recherche fixée à 36 px. Nouvelle catégorie « Contrôle
qualité » (au lieu de « Vérifier », trop vague).
Preuves : test navigateur (repli, mémorisation, hauteur de la recherche) ;
audit de mise en page sans anomalie.

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
Deuxième usage, « Avant / après » : même format des deux côtés, valeurs
enregistrées à gauche, modifications en cours à droite (avec leur nombre). On
voit l’effet d’une modif avant de l’enregistrer.
Écarté après essai : Comparer dans la ligne du titre (la barre passait à la
ligne et les outils changeaient de place).
Preuves : test navigateur (deux aperçus qui suivent une modification, changement
de format, retour à un seul aperçu) ; position et hauteur de la barre mesurées
identiques avant et après le clic ; audit de mise en page sans anomalie.

## 27/10/2026 · Visite guidée

Problème : l’atelier a beaucoup de zones ; une personne qui l’ouvre (intervenant,
camarade, jury) ne sait pas par où commencer.
Décision : visite courte en 5 étapes, une par grande zone, mise en évidence :
1. Design System (choisir une catégorie, modifier une valeur) ; 2. Enregistrer
(diff avant écriture) ; 3. Aperçu (écrans, formats, Comparer) ; 4. Claude (chat
ouvert pendant l’étape, modèle et quota) ; 5. Accessibilité (la page de contrôle
s’ouvre, le menu défile jusqu’au lien), avec en conclusion l’export et le bouton
« ? ». Ouverte seule au premier lancement, puis avec le bouton « ? » de l’en-tête.
Passer, Précédent, Suivant, flèches du clavier et Échap.
Écarté : une première version en 11 étapes (une par bouton), jugée trop longue.
Fluidité : à chaque étape, la carte et le contour attendent que la zone visée ne
bouge plus ; la carte réapparaît en fondu, déjà à sa place, sans glisser. En
quittant la visite, l’atelier retrouve son état d’avant (chat, Comparer, page).
Correctif général : changer de page dans le Design System repart du haut.
Preuves : test navigateur (ouverture au premier lancement, pas de réouverture,
relance par « ? », 5 étapes, page de contrôle affichée, état rétabli) ; position
de la carte mesurée à chaque image à 1440, 1280 et 1024 px : une seule position
par étape, jamais hors écran ; captures relues.
