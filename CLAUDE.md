# Projet Phare · règles pour l'assistant de code

Jeu de stratégie mobile et web (genre Whiteout Survival) dans un monde noyé. Solana sert de notaire : paiements en USDC, preuves, badges et cosmétiques. Un seul développeur, budget serré.

Lis ce fichier en entier avant chaque tâche. En cas de doute, demande plutôt que de deviner.

## Structure

- `shared/` : les règles du jeu en TypeScript pur (`@phare/shared`). Aucune dépendance au réseau, au DOM, à l'heure système ni au hasard. Tout y est testé.
- `server/` : Fastify. Le serveur DÉCIDE. Il applique les règles de `shared/` et refuse tout ce qu'elles refusent.
- `client/` : Vite + three.js. Le client AFFICHE. Il envoie des intentions (« améliorer la Raffinerie »), jamais des résultats (« j'ai 9 000 huile »).
- `client/public/prototype/` : le prototype de référence. On le consulte, on ne le modifie plus.
- `docs/decisions.md` : les décisions prises et pourquoi. Ajoute une ligne quand tu tranches quelque chose.

## Commandes

- `npm install` : installe tout le monorepo.
- `npm test` : tous les tests (Vitest). Doit passer avant chaque commit.
- `npm run typecheck` : vérification des types des trois paquets.
- `npm run build` : build du client.
- `npm run check` : les trois à la suite. C'est ce que lance l'intégration continue.
- `npm run dev:client` et `npm run dev:server` : développement local.

## Règles de travail

1. Une tâche à la fois, petite, décrite par écrit : ce qu'elle fait, ce qu'elle ne fait pas, comment on la teste.
2. Toute règle de jeu nouvelle ou modifiée va dans `shared/src/rules/` avec ses tests dans `shared/test/`. Écris le test d'abord quand c'est possible.
3. Ne change jamais une valeur d'équilibrage (coût, durée, débit, plafond) sans le dire explicitement dans ta réponse et sans mettre à jour le test concerné.
4. Les durées des règles sont en secondes RÉELLES et les débits PAR HEURE réelle (voir `shared/src/rules/time.ts`). L'accélération de développement se fait côté serveur, jamais dans les règles.
5. Une règle refuse avec une raison lisible en français (`refuse("…")`). Le serveur renvoie cette raison telle quelle.
6. Pas de nouvelle dépendance sans l'annoncer et dire pourquoi. Versions exactes uniquement.
7. Lance `npm run check` avant de dire qu'une tâche est finie.

## Zones protégées : ne pas modifier sans demande explicite et relecture humaine

- Tout code de paiement, de vérification de transaction Solana ou de livraison d'achat.
- Les clés, secrets et fichiers `.env` (ne jamais les lire, les afficher ni les commiter).
- `shared/src/rules/comfort.ts` : le plafond de confort (100 USDC par mois, 30 pour un mineur, 4 h par jour) est une promesse publique.
- Les probabilités du recrutement (`RECRUIT_ODDS`) : elles sont publiées.

## Principes du jeu à ne jamais casser

- Jamais de hasard payant. Le seul tirage aléatoire, le recrutement quotidien, est gratuit et vérifiable.
- Jamais de jeton, d'airdrop, ni de terrain vendu en NFT.
- Ne se vendent jamais : troupes, recrutements, fragments, Perles, radeaux, protections, places d'alliance.
- Le paiement en USDC est réservé aux majeurs ; le plafond de confort se compte par compte de jeu, pas par wallet.
- Le coffre d'alliance ne contient que des Perles et ne peut jamais payer un joueur choisi.
- Aucune donnée personnelle sur la chaîne.

## Style

- TypeScript strict. Fonctions pures dans `shared/`. Noms en anglais dans le code, textes visibles par le joueur en français.
- Textes du jeu : phrases courtes, tutoiement, vocabulaire du joueur (« cité », « Phare », « flotte »), jamais de jargon technique.
- Commits courts au présent : « Ajoute la règle des radeaux ».
