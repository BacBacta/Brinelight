# Décisions

Une ligne par décision, la plus récente en haut.

| Date | Décision | Pourquoi |
| --- | --- | --- |
| 2026-10-15 | Les règles s'expriment en secondes réelles et en débits par heure ; 1 seconde du prototype = 6 minutes réelles (`TIME_SCALE = 360`). | Un seul jeu de règles pour le serveur, le client et les tests ; l'accélération de développement se fait côté serveur. |
| 2026-10-15 | Monorepo npm en trois paquets (`shared`, `client`, `server`), TypeScript partout. | Le client et le serveur lisent exactement les mêmes règles. |
| 2026-10-15 | Le prototype est conservé tel quel dans `client/public/prototype/` comme référence. | Comparer le comportement pendant le portage. |

## Points ouverts

- **Début de partie trop lent avec l'échelle actuelle.** La Raffinerie niveau 2 prend 54 minutes réelles, alors que le dossier prévoit deux premières heures très rapides. À régler en semaine 17 avec une courbe de temps propre aux premiers niveaux.
- **Phare niveau 30.** Les coûts et durées au-delà du niveau 10 sont extrapolés du prototype. À équilibrer par simulation en semaine 17.
