# Food Square · commande en ligne

Site de commande du snack **Food Square**, 140 rue Nationale, 69400 Villefranche-sur-Saône.

- **Clients** (`index.html`) : la carte complète avec personnalisation (tailles, viandes, sauces, suppléments, menus). Le client commande à emporter ou en livraison (dès 20 €), en invité ou avec un compte.
- **Numéro de commande** : il repart à 1 chaque jour, avec un suivi en direct (Reçue → En préparation → Prête).
- **Comptes clients** : inscription par email avec un lien de vérification, ou connexion Google. Le client inscrit retrouve ses infos et l'historique de ses commandes, et peut recommander en un clic.
- **Barre du bas** sur téléphone : Carte · Commandes · Panier · Infos · Compte.
- **Écran cuisine** (`cuisine.html`) : les commandes arrivent en direct avec un son. On les fait passer de Nouvelles à En préparation, Prêtes puis Remises. Réservé aux comptes de l'équipe.

Le site est fait de simples fichiers (HTML, CSS, JavaScript), sans installation. Les commandes et les comptes sont gérés par **Supabase**, gratuit pour un snack.

---

## Mise en ligne, étape par étape (environ 30 minutes)

### 1. Créer la base de données Supabase

1. Va sur [supabase.com](https://supabase.com) et crée un compte. Le plus simple : « Continue with GitHub ».
2. Clique sur **New project** :
   - **Name** : `food-square`
   - **Database password** : clique sur « Generate » et garde-le de côté.
   - **Region** : *West EU (Paris)*.
3. Attends 2 minutes que le projet soit prêt.
4. Dans le menu de gauche, ouvre **SQL Editor**, puis **New query**.
5. Copie tout le contenu du fichier [`supabase/schema.sql`](supabase/schema.sql), colle-le et clique sur **Run**. Le message attendu est « Success. No rows returned ».

### 2. Relier le site à Supabase

1. Dans Supabase, va dans **Project Settings → API** (ou **Data API**). Copie :
   - le **Project URL** (`https://xxxx.supabase.co`) ;
   - la clé **anon public**.
2. Sur GitHub, ouvre le fichier [`js/config.js`](js/config.js), clique sur le crayon ✏️ et colle les deux valeurs entre les guillemets :
   ```js
   SUPABASE_URL: "https://xxxx.supabase.co",
   SUPABASE_ANON_KEY: "eyJhbGciOi...",
   ```
3. Clique sur **Commit changes**.

La clé « anon » est faite pour être publique. Ne mets jamais la clé **service_role** dans ce fichier.

### 3. Mettre le site en ligne avec GitHub Pages

1. Sur GitHub, dans ton dépôt, va dans **Settings → Pages**.
2. Dans **Branch**, choisis `main` et le dossier `/ (root)`, puis **Save**.
3. Après 1 à 2 minutes, l'adresse du site s'affiche en haut de la page, par exemple `https://694aminee.github.io/food-square/`.

### 4. Régler les emails de vérification

1. Dans Supabase, va dans **Authentication → URL Configuration** :
   - **Site URL** : l'adresse de ton site, par exemple `https://694aminee.github.io/food-square/`.
   - **Redirect URLs** : ajoute la même adresse, plus la même suivie de `cuisine.html`.
2. Vérifie dans **Authentication → Sign In / Providers → Email** que **Confirm email** est activé. C'est le réglage par défaut.
3. Pour avoir l'email en français : **Authentication → Emails → Confirm signup**.
   - Sujet : `Confirme ton compte Food Square`
   - Message : le contenu de [`supabase/email-confirmation.html`](supabase/email-confirmation.html).
4. **Important avant le lancement** : l'envoi d'emails fourni par Supabase est limité à quelques emails par heure. Il sert aux tests. Pour les vrais clients, branche un service d'envoi gratuit comme [Brevo](https://www.brevo.com) ou [Resend](https://resend.com) dans **Project Settings → Authentication → SMTP Settings**.

### 5. Activer la connexion avec Google

1. Va sur [console.cloud.google.com](https://console.cloud.google.com) et crée un projet « Food Square ».
2. Va dans **APIs & Services → OAuth consent screen**. Choisis « External » et renseigne le nom « Food Square » et ton email.
3. Va ensuite dans **APIs & Services → Credentials → Create credentials → OAuth client ID** :
   - Type : **Web application**
   - **Authorized JavaScript origins** : `https://694aminee.github.io`
   - **Authorized redirect URIs** : `https://xxxx.supabase.co/auth/v1/callback`. Remplace `xxxx` par ton projet ; l'adresse exacte est affichée dans Supabase, sur la page du fournisseur Google.
4. Copie le **Client ID** et le **Client secret**.
5. Dans Supabase, va dans **Authentication → Sign In / Providers → Google**. Active-le, colle les deux valeurs et enregistre.

### 6. Donner accès à l'écran cuisine

1. Sur ton site, crée un compte avec l'email de l'équipe (bouton « Compte » ou « Se connecter »), puis vérifie-le avec le lien reçu.
2. Dans Supabase, ouvre **SQL Editor**, remplace l'email dans la requête ci-dessous puis clique sur **Run** :
   ```sql
   insert into public.staff (user_id)
   select id from auth.users where email = 'ton-email@exemple.fr';
   ```
3. Sur la tablette ou l'ordinateur de la cuisine, ouvre `https://.../cuisine.html` et connecte-toi. Clique sur **Activer le son** pour être prévenu à chaque nouvelle commande.

Recommence l'étape 2 pour chaque personne de l'équipe.

### 7. Tester

1. Passe une commande en invité depuis ton téléphone.
2. Vérifie qu'elle apparaît dans l'écran cuisine, puis clique sur « Lancer ».
3. Sur le téléphone, le statut passe à « En préparation » en moins de 15 secondes.

---

## Modifier la carte

Tout est dans [`js/menu.js`](js/menu.js) :

- **Changer un prix** : modifie `price:` de l'article, par exemple `price:7.9`. Le point remplace la virgule.
- **Changer le prix d'un menu** : c'est le nombre dans `G.formule(2)`, soit +2 € pour frites + boisson.
- **Boissons, sauces, suppléments** : listes `DRINKS`, `SAUCES` et `SUPP` en haut du fichier.
- **Retirer un article** : supprime sa ligne `{id:..., ...},`.

Les horaires sont dans [`js/common.js`](js/common.js), dans `HOURS`. Ils sont comptés en minutes depuis minuit : 11h = 660, 1h du matin = 1500, 2h du matin = 1560.

## Bon à savoir

- **Paiement** : il se fait au retrait ou à la livraison (carte, espèces, tickets restaurant). Le total est calculé par le site. L'équipe voit le détail de chaque article en cuisine et encaisse selon la carte.
- **Protection anti-abus** : 5 commandes maximum par numéro de téléphone sur 10 minutes.
- **Données des clients** : un client ne voit que ses propres commandes. Seuls les comptes de l'équipe voient toutes les commandes.
- **Mode démo** : tant que `js/config.js` est vide, la carte et le panier marchent, mais les commandes ne partent pas en cuisine. Un bandeau l'indique en haut du site.
