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

## Habitudes du projet

- Une modification, une branche, une PR ; pas de fusion sans demande.
- Vérifier le rendu dans Chromium (desktop et mobile) pour tout changement visuel.
- Textes du site en français ; `politique.html` et `mentions.html` suivent ce que fait réellement le site (données collectées, prestataires).
