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

## À mettre à jour avec la mise en ligne

`politique.html` indique encore que le formulaire ouvre la messagerie et que rien n'est transmis au site.
Une fois Resend actif, le texte doit mentionner Resend comme prestataire d'envoi d'e-mails et la durée de conservation.
