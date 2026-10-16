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

1. Resend : ajouter `buttiscreen.fr`, copier les enregistrements DNS (SPF, DKIM) chez le registrar, attendre « Verified ».
2. Resend : créer une clé d'API, accès « Sending access », restreinte au domaine.
3. Depuis `worker/` : `npx wrangler deploy`, puis `npx wrangler secret put RESEND_API_KEY`.
4. Test réel : `curl -X POST <adresse du Worker> -H "origin: https://buttiscreen.fr" -H "content-type: application/json" -d '{"nom":"Test","email":"toi@example.com","projet":"Clip","message":"Message de test du formulaire.","website":"","t":1}'`
   Le champ `t` doit dater d'au moins 2,5 s : avec `t` égal à 1, la réponse est « ok » mais rien n'est envoyé (c'est voulu). Pour un vrai envoi, utiliser le formulaire du site.
5. Renseigner `data-endpoint` de `#brief` dans `index.html`, publier.
6. Réappliquer le texte de la politique de confidentialité : `git show 41b38a3:politique.html > politique.html`, puis le faire relire (région d'hébergement Resend, durée du journal, Cloudflare). Vérifier aussi `mentions.html`.
7. Facultatif : règle de limitation de débit Cloudflare sur la route du Worker.

Ne publier `politique.html` mise à jour qu'au moment où l'étape 5 est faite : tant que le formulaire ouvre la messagerie, le texte actuel est le bon.
