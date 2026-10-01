# RawNote

Traitement de texte **brut** avec mise en page en caractères, façon ASCII art.
Webapp statique (HTML/CSS/JS sans dépendance), utilisable sur ordinateur, tablette et mobile.
Rien n'est enregistré côté serveur : on importe et exporte des fichiers `.txt`.

## Fonctions

- **Alignement** gauche / centre / droite / justifié, calculé sur la ligne la plus longue du bloc (ou une largeur imposée dans les réglages). Les tableaux et dessins sont déplacés en bloc.
- **Listes** à puces, numérotées, lettrées, en chiffres romains, plan `1. a. i.` ou numérotation `1.1.`, sur plusieurs niveaux (`Tab` / `Maj+Tab`, `Entrée` prolonge la liste).
- **Tableaux** : lignes et colonnes à volonté, largeur automatique ou redimensionnée à la main, alignement par colonne, cadres simple / arrondi / double / ASCII. Un tableau existant se modifie en plaçant le curseur dedans.
- **Zone de dessin** : lignes, coudes, flèches, rectangles, losanges, texte, sélection / déplacement, gomme, et éléments de **logigramme** (étape, début/fin, décision). Option « ASCII pur ».
- **Fichiers** : import / export `.txt` UTF-8, copie, conversion des cadres Unicode en ASCII pur.
- Le brouillon est conservé dans le navigateur (`localStorage`), jamais envoyé au serveur ; désactivable dans les réglages.

## Déploiement avec Docker Compose

Il suffit du fichier [`compose.yaml`](compose.yaml) : l'image est téléchargée depuis GitHub Container Registry.

```bash
docker compose up -d
# puis http://localhost:8080
```

L'image (amd64 et arm64) est construite automatiquement par GitHub Actions à chaque push sur `main` (tag `latest`) et à chaque tag `vX.Y.Z` (tag de version).

Mise à jour vers la dernière version : `docker compose pull && docker compose up -d`.
Pour figer une version, remplacez `:latest` par le tag voulu (ex. `:v0.1.0`).

Pour construire l'image vous-même depuis les sources : `docker build -t rawnote .` (puis remplacez `image:` par `rawnote`).

Sans Compose :

```bash
docker run -d -p 8080:8080 --read-only --tmpfs /tmp ghcr.io/yogui26/rawnote:latest
```

L'image repose sur `nginx-unprivileged` (port 8080, utilisateur non root) avec une politique CSP stricte.
Placez-la derrière votre reverse proxy habituel pour le HTTPS.

## Développement

```bash
npm start   # serveur statique sur http://localhost:8080
npm test    # tests unitaires (Node 22, aucune dépendance)
```

La logique de mise en page (`src/js/lib/`) ne touche pas au DOM et est testée ; l'interface est dans `src/js/ui/`.

## Limites connues

- Pour que les cadres restent alignés, il faut une police à chasse fixe là où le texte est collé ; la police DejaVu Sans Mono est embarquée dans l'application.
- Les tableaux sans séparateurs entre lignes ne permettent pas de distinguer une cellule sur plusieurs lignes de plusieurs lignes de tableau lors d'une relecture.
- Les caractères larges (CJK, emoji) sont comptés sur 2 colonnes, mais leur rendu dépend de la police.

## Licence

[MIT](LICENSE) : réutilisation et fork libres, à condition de conserver la mention de l'auteur.
La police DejaVu Sans Mono (sous-ensemble) est distribuée sous sa propre licence : `src/fonts/LICENSE-DejaVu.txt`.
