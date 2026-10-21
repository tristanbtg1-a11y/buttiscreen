# BUTTISCREEN : repères pour une session

Site statique du studio (pages HTML, `styles.css`, scripts à la racine) et Worker Cloudflare `buttiscreen-contact` (dossier `worker/`).

## Worker

- Version de wrangler : toujours `npx wrangler@4.151.2` (la même que `.github/workflows/worker.yml`). Si la version change, la changer aux deux endroits.
- Tests : `node --test "worker/*.test.mjs"` (pas `node --test worker/`, qui échoue sur GitHub).
- Déploiement : seulement par GitHub Actions (`.github/workflows/worker.yml`), à chaque fusion sur `main` qui touche `worker/`. L'intégration Git de Cloudflare (Workers Builds) est désactivée : ne pas la réactiver, ne pas déployer à la main sauf demande explicite.
- Secrets du Worker (`RESEND_API_KEY`, `MAKE_PASSWORD`) : définis dans Cloudflare, jamais dans le dépôt. `wrangler deploy` ne les touche pas.

## Réglages d'environnement attendus pour piloter le Worker

Ils se règlent une fois dans l'environnement cloud (menu de l'environnement, Edit) et valent pour toutes ses sessions.

- Domaines autorisés : `api.cloudflare.com` et `buttiscreen-contact.tristan-buttig1.workers.dev`. En plus, seulement pour tester Make ou Resend en direct : `hook.eu1.make.com`, `api.resend.com`, `eu1.make.com`.
- Variables : `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` (jeton distinct de celui de GitHub Actions, limité à « Workers Scripts : Edit » et « Workers Tail : Read »), et `MAKE_PASSWORD` seulement pour envoyer des requêtes de test à Make. Ne jamais demander de coller une valeur dans le chat.
- Le KV du Worker contient des e-mails de clients et des PDF de factures : ne pas donner au jeton le droit de le lire sans besoin précis.
- Les connecteurs (Cloudflare, Make, Resend, GitHub) fonctionnent sans ces domaines : ils ne passent pas par le réseau de la session. Les domaines servent à `wrangler` et `curl`.

## Tester le Worker

- Sans réseau vers `workers.dev` : les tests du dossier `worker/` simulent Resend et Make.
- Avec le domaine autorisé : `curl -i -H "Origin: https://buttiscreen.fr" https://buttiscreen-contact.tristan-buttig1.workers.dev/moi`, réponse attendue `401` avec `{"error":"session"}` ; depuis une autre origine : `403` avec `{"error":"origin"}`.
- Journaux en direct : `npx wrangler@4.151.2 tail buttiscreen-contact` (jeton avec « Workers Tail : Read »).
- Un brief de test envoie de vrais e-mails (studio et accusé) et écrit une vraie fiche dans la gestion : prévenir avant de le faire.

## Make

Le scénario « BUTTISCREEN - RDV, commandes et gestion » écrit dans le data store « BUTTISCREEN gestion ». Il est modifié par le connecteur Make, pas par le dépôt. Pour ajouter un champ à une fiche : l'ajouter à la structure de données, au module d'écriture et au module de consultation, puis au Worker (`worker/auth.js`) et à `gestion.js`. Avant toute modification du scénario, sauvegarder le blueprint actuel et comparer le résultat enregistré à celui attendu.

## Format des réponses

- Par défaut, répondre en cartes : une carte = un titre en gras sur une ligne, puis deux ou trois lignes au plus, une seule idée. Cinq cartes au maximum ; le détail seulement sur demande.
- Au-delà de cinq cartes, ou sur demande d'un carrousel : publier une page avec un carrousel à balayage horizontal (une carte par écran, style sombre de BUTTISCREEN : nuit violette, orange braise, coins de cadrage détachés sur la carte active). Si une page de carrousel existe déjà dans la session, la mettre à jour plutôt qu'en créer une nouvelle. Laisser dans la conversation un résumé de trois lignes et le lien. Sans possibilité de publier une page, rester sur les cartes en texte.
- Exceptions, toujours en texte brut et intactes : erreurs, commandes, extraits de code, différences de fichiers, tableaux de résultats.
- Aperçu de référence : https://claude.ai/artifact/MADDRKv5YJuLW7XL4BamLB (privé, ouvert par son propriétaire).

## Habitudes du projet

- Une modification, une branche, une PR ; pas de fusion sans demande.
- Vérifier le rendu dans Chromium (desktop et mobile) pour tout changement visuel.
- Textes du site en français ; `politique.html` et `mentions.html` suivent ce que fait réellement le site (données collectées, prestataires).
