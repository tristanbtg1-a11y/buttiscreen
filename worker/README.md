# Envoi du brief par Resend

Le site est statique : la clé Resend ne doit jamais apparaître dans le navigateur.
Le formulaire de l'accueil envoie donc le brief à ce petit Worker Cloudflare, qui appelle Resend.

## Mise en place

1. **Resend** : ajouter et vérifier le domaine `buttiscreen.fr` (enregistrements DNS SPF et DKIM), puis créer une clé d'API limitée à l'envoi.
2. **Worker** (depuis ce dossier) :
   ```bash
   npx wrangler deploy
   npx wrangler secret put RESEND_API_KEY
   ```
   `MAIL_TO` et `MAIL_FROM` se règlent dans `wrangler.toml`. L'adresse d'expédition doit appartenir au domaine vérifié.
3. **Adresse du Worker** : la renseigner dans `index.html`, attribut `data-endpoint` du formulaire `#brief`
   (par exemple `https://buttiscreen-contact.<compte>.workers.dev`, ou un sous-domaine du site).
4. **Test local** : ajouter `http://localhost:4173` dans la variable `ALLOWED_ORIGINS` du Worker.

Tant que `data-endpoint` est vide, le formulaire garde l'ancien comportement (ouverture de la messagerie).
Si l'envoi échoue, le visiteur voit un message avec un lien e-mail de secours.

## Protections

Origine contrôlée (CORS), champ piège invisible, délai minimal de remplissage, validation et limites de taille côté serveur, contenu échappé dans l'e-mail, `reply_to` sur l'adresse du visiteur.
Pour aller plus loin : une règle de limitation de débit Cloudflare sur la route du Worker.

## Tests

```bash
node --test worker/contact.test.mjs
```

13 tests avec un Resend simulé : envoi normal, robot (champ piège, envoi trop rapide), validation, origine étrangère, panne Resend, clé absente, JSON invalide, corps trop gros, CORS, échappement du contenu.
Ils ne contactent jamais le vrai Resend.

## Activation, dans l'ordre

1. Resend : le domaine `buttiscreen.fr` est créé en région `eu-west-1` (Irlande), suivi des ouvertures et des clics désactivé. Copier les enregistrements DNS (SPF, DKIM) chez le registrar, attendre « Verified ».
2. Resend : créer une clé d'API, accès « Sending access », restreinte au domaine.
3. Depuis `worker/` : `npx wrangler deploy`, puis `npx wrangler secret put RESEND_API_KEY`.
4. Test réel : `curl -X POST <adresse du Worker> -H "origin: https://buttiscreen.fr" -H "content-type: application/json" -d '{"nom":"Test","email":"toi@example.com","projet":"Clip","message":"Message de test du formulaire.","website":"","t":1}'`
   Le champ `t` doit dater d'au moins 2,5 s : avec `t` égal à 1, la réponse est « ok » mais rien n'est envoyé (c'est voulu). Pour un vrai envoi, utiliser le formulaire du site.
5. Renseigner `data-endpoint` de `#brief` dans `index.html`, publier.
6. Réappliquer le texte de la politique de confidentialité : `git show 41b38a3:politique.html > politique.html`, puis le faire relire (région d'hébergement Resend, durée du journal, Cloudflare). Vérifier aussi `mentions.html`.
7. Facultatif : règle de limitation de débit Cloudflare sur la route du Worker.

Ne publier `politique.html` mise à jour qu'au moment où l'étape 5 est faite : tant que le formulaire ouvre la messagerie, le texte actuel est le bon.

## Déploiement par GitHub Actions

Le workflow `.github/workflows/worker.yml` lance les tests (`node --test "worker/*.test.mjs"`) sur chaque PR, puis déploie le Worker à chaque envoi sur `main` qui touche `worker/`. Il se lance aussi à la main (onglet Actions, « Run workflow »).
Deux secrets de dépôt sont nécessaires (GitHub : Settings, Secrets and variables, Actions) :
- `CLOUDFLARE_API_TOKEN` : jeton créé dans Cloudflare (My Profile, API Tokens) avec le modèle « Edit Cloudflare Workers » ;
- `CLOUDFLARE_ACCOUNT_ID` : identifiant du compte, visible dans l'adresse du tableau de bord.
Les secrets du Worker (`RESEND_API_KEY`, `MAKE_PASSWORD`) restent dans Cloudflare, `wrangler deploy` ne les touche pas. Une fois ce déploiement en service, déconnecter le dépôt de l'intégration Git de Cloudflare (Worker, Settings, Builds) pour éviter un double déploiement.

## Déploiement par Cloudflare (Git)

Le Worker `buttiscreen-contact` est relié à ce dépôt : Cloudflare le construit et le déploie à chaque envoi sur `main`.
Réglages de la construction : branche de production `main`, dossier racine `worker`, commande de build vide, commande de déploiement `npx wrangler deploy`.
Le secret `RESEND_API_KEY` se règle dans Cloudflare (Paramètres, Variables d'exécution et secrets), jamais dans le dépôt.
`MAIL_TO` et `MAIL_FROM` restent dans `wrangler.toml`.

## Accusé de réception au visiteur

Après l'envoi du brief au studio, le Worker envoie au visiteur un accusé de réception qui reprend son brief (projet, e-mail, message). Les réponses du visiteur arrivent sur `MAIL_TO`.

- **Désactivé tant qu'aucun KV `RATE` n'est lié** : un formulaire public ne doit pas pouvoir écrire à des tiers sans limite. Une fois lié, au plus un accusé par adresse et par jour, et cinq par IP et par heure.
- L'accusé ne fait jamais échouer le brief : s'il échoue, le visiteur voit quand même « brief envoyé ».
- `REPLY_DELAY` (défaut : « 48 heures ouvrées ») règle le délai annoncé ; `CONFIRMATION = "off"` coupe l'accusé.
- Tests : `node --test worker/contact.test.mjs` (29 tests).

## Copie du brief et lien personnel

- Binding `BRIEFS` (même KV que `RATE`, clés distinctes) : chaque brief est conservé 90 jours sous un identifiant aléatoire de 128 bits.
- L'accusé contient un lien `commande.html#brief=<id>` ; `GET /brief/<id>` renvoie le brief, sans liste ni recherche par e-mail.
- `POST /lien` renvoie le lien par e-mail à l'adresse du brief le plus récent (réponse identique que l'adresse existe ou non, limitée par adresse et par IP).
- `POST /tunnel` enregistre le brief du tunnel de rendez-vous et envoie l'accusé.

## Connexion par lien et suivi projet

- `POST /auth/demande` envoie un lien de connexion (15 minutes, usage unique) ; réponse identique que l'adresse soit connue ou non ; 3 par adresse et par heure, 8 par IP et par heure.
- `POST /auth/verification` échange le jeton (dans le fragment `#connexion=…` de l'URL, donc jamais envoyé par un simple clic) contre une session : 30 jours pour un client, 12 heures pour le studio.
- `GET /moi` (en-tête `Authorization: Bearer <session>`) renvoie le suivi du projet et le dernier brief de l'adresse.
- `ADMIN_EMAILS` (variable de `wrangler.toml`) : adresses du studio. Seules elles peuvent écrire le suivi (`POST /admin/projet`) et le lister (`GET /admin/projets`), via un lien envoyé depuis l'atelier. L'atelier ne reçoit de lien que pour ces adresses.
- Le suivi et les sessions sont dans le KV `BRIEFS` (clés `p:`, `s:`, `ml:`, index `pidx`).
- Tests : `node --test worker/*.test.mjs` (39 tests).

## Gestion avec la session studio

- `POST /admin/gestion` (session studio) : le Worker se connecte à Make avec `MAKE_PASSWORD` (secret du Worker) et renvoie le jeton de la gestion. `MAKE_OWNER_EMAIL` (défaut `tristan.buttig1@gmail.com`) est l'adresse du compte Make.
- Sans `MAKE_PASSWORD` : 503, et la page gestion propose l'accès de secours par mot de passe.
- Le lien de connexion peut viser la page `gestion` ou `atelier`, seulement pour les adresses de `ADMIN_EMAILS`.

## Devis et paiement

- Historique des factures : chaque PDF déposé par `POST /admin/projet` est gardé à part (`f:<id>`), avec un index de métadonnées (`fidx`, 1000 entrées au plus). `GET /admin/factures` renvoie la liste sans les PDF, `GET /admin/facture/<id>` un PDF, tous deux réservés aux adresses du studio. Une facture déposée ne se supprime pas : une erreur se corrige par un nouveau dépôt. Avec `notifier: true`, le client reçoit un e-mail « Votre facture est disponible » (lien vers Mon compte, jamais de pièce jointe) ; la réponse indique `mailed`. Les factures déposées avant l'historique y entrent à la première lecture.
- Clôture : `clos: true` sur `POST /admin/projet` archive le dossier (statut `close` chez Make) sans toucher à l'état vu par le client.
- `GET /moi/devis` (session client) et `GET /devis/<id du brief>` (visiteur du tunnel : l'identifiant aléatoire du brief qu'il vient d'envoyer tient lieu de clé) : le Worker interroge Make (`action: "payer"`) avec `MAKE_PASSWORD` et ne renvoie que les champs utiles (lien Stripe, montant, état, nom, projet, date, détail, règlement).
- `POST /tunnel` renvoie l'identifiant du brief.
- Une fois cette version en ligne, la route « payer » de Make peut exiger le mot de passe : le navigateur n'appelle plus Make pour le paiement.

## Rushes

- `POST /moi/rushes` (session client) : le Worker demande à Make l'espace d'envoi Frame.io pour l'adresse de la session (jamais celle envoyée par le navigateur), avec `MAKE_PASSWORD`. Noms de fichier nettoyés, taille bornée, 120 demandes par session et par heure. Le navigateur envoie ensuite les fichiers directement aux adresses renvoyées.

## Écritures dans Make (commande et rendez-vous)

- Le navigateur n'écrit plus dans Make. Le Worker écrit avec `MAKE_PASSWORD` :
  - **rendez-vous** : à chaque `POST /tunnel`, fiche `rdv` (mêmes champs que l'ancien envoi du navigateur) ;
  - **commande** : à chaque enregistrement du suivi par le studio (`POST /admin/projet`), fiche `commande` (état, délai, titre, statut `close` à la livraison) ;
  - **première connexion d'un client** : e-mail « Nouveau compte client » au studio, et fiche `commande` (état « brief ») créée seulement si la gestion ne la connaît pas : le Worker lit d'abord la liste (jamais d'écrasement, et rien n'est écrit si la lecture échoue). Repère `c:<hash>` dans le KV pour ne le faire qu'une fois par adresse.
- Sans `MAKE_PASSWORD`, aucune écriture dans Make : les e-mails (brief, accusé) partent quand même.
- Tests : `node --test "worker/*.test.mjs"` (54 tests).
