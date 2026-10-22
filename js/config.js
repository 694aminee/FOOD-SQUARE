// Réglages de connexion à Supabase.
// Remplace les deux valeurs ci-dessous par celles de ton projet
// (Supabase > Project Settings > API). La clé "anon" est publique : elle peut
// être dans ce fichier sans risque, la sécurité est gérée par le schéma SQL.
// Tant que ces deux valeurs sont vides, le site tourne en mode démo :
// la carte et le panier marchent, mais les commandes ne partent pas en cuisine.
window.FS_CONFIG = {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: ""
};
