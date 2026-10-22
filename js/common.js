// Outils partagés entre la boutique (index.html) et l'écran cuisine (cuisine.html).
window.FS = (function () {
  "use strict";

  // Lu avant que Supabase ne nettoie l'adresse : permet de savoir si le client
  // arrive depuis le lien de vérification reçu par email.
  const hash = new URLSearchParams(location.hash.slice(1));
  const query = new URLSearchParams(location.search);
  const arrival = {
    type: hash.get("type") || query.get("type") || "",
    error: hash.get("error_description") || query.get("error_description") || ""
  };

  const cfg = window.FS_CONFIG || {};
  const configured = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);
  const sb = configured
    ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" }
      })
    : null;

  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const eur = n => (Math.round(n * 100) / 100).toFixed(2).replace(".", ",") + " €";
  const store = {
    get(k, d) { try { const v = localStorage.getItem("fs_" + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("fs_" + k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem("fs_" + k); } catch (e) {} }
  };
  function toast(msg) {
    let root = $("#toastRoot");
    if (!root) { root = document.createElement("div"); root.id = "toastRoot"; document.body.appendChild(root); }
    const t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); t.textContent = msg;
    root.replaceChildren(t); setTimeout(() => t.remove(), 2600);
  }
  function copyText(txt) {
    try { navigator.clipboard.writeText(txt).then(() => toast("Copié"), () => toast("Sélectionne le texte pour le copier")); }
    catch (e) { toast("Sélectionne le texte pour le copier"); }
  }

  // Horaires (heure de Paris). Minutes depuis minuit ; au-delà de 1440 = après minuit.
  const HOURS = { 0: [[660, 1500]], 1: [[660, 1500]], 2: [[660, 1500]], 3: [[660, 1500]], 4: [[660, 1500]], 5: [[660, 780], [870, 1560]], 6: [[660, 1560]] };
  function parisNow() {
    try {
      const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
      const g = t => p.find(x => x.type === t).value;
      return { d: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(g("weekday")), m: (parseInt(g("hour"), 10) % 24) * 60 + parseInt(g("minute"), 10) };
    } catch (e) { const n = new Date(); return { d: n.getDay(), m: n.getHours() * 60 + n.getMinutes() }; }
  }
  const hhmm = m => { m = ((m % 1440) + 1440) % 1440; const h = Math.floor(m / 60), mm = m % 60; return h + "h" + (mm ? String(mm).padStart(2, "0") : ""); };
  function isOpenAt(day, mins) {
    if (mins >= 1440) { day = (day + 1) % 7; mins -= 1440; }
    if (HOURS[day].some(([a, b]) => mins >= a && mins < b)) return true;
    const pd = (day + 6) % 7;
    return HOURS[pd].some(([a, b]) => mins + 1440 >= a && mins + 1440 < b);
  }
  function openState() {
    const { d, m } = parisNow();
    for (const [a, b] of HOURS[d]) if (m >= a && m < b) return { open: true, closeAt: b };
    const pd = (d + 6) % 7;
    for (const [a, b] of HOURS[pd]) if (m + 1440 >= a && m + 1440 < b) return { open: true, closeAt: b - 1440 };
    for (const [a] of HOURS[d]) if (a > m) return { open: false, nextOpen: { today: true, m: a } };
    return { open: false, nextOpen: { today: false, m: HOURS[(d + 1) % 7][0][0] } };
  }
  function slots() {
    const { d, m } = parisNow(); const out = [];
    for (let t = Math.ceil((m + 30) / 15) * 15; t < m + 1440 && out.length < 16; t += 15) if (isOpenAt(d, t)) out.push(t);
    return out;
  }

  const STATUS = { nouvelle: "Reçue", preparation: "En préparation", prete: "Prête", terminee: "Remise", annulee: "Annulée" };

  // Messages d'erreur Supabase traduits pour les clients.
  function authError(e) {
    const m = String((e && (e.message || e.error_description)) || e || "");
    if (/Email not confirmed/i.test(m)) return "Ton adresse email n'est pas encore vérifiée. Clique sur le lien reçu par email.";
    if (/Invalid login credentials/i.test(m)) return "Email ou mot de passe incorrect.";
    if (/already registered|already been registered/i.test(m)) return "Un compte existe déjà avec cet email. Connecte-toi.";
    if (/Password should be at least/i.test(m)) return "Le mot de passe doit faire au moins 8 caractères.";
    if (/rate limit|too many/i.test(m)) return "Trop de tentatives. Patiente une minute puis réessaie.";
    if (/expired|invalid.*(link|token)/i.test(m)) return "Ce lien a expiré. Demande un nouvel email.";
    if (/valid email|invalid format/i.test(m)) return "Cette adresse email n'est pas valide.";
    if (/Failed to fetch|NetworkError/i.test(m)) return "Pas de connexion internet. Vérifie ton réseau.";
    return m || "Une erreur est survenue. Réessaie.";
  }
  const redirectUrl = () => location.origin + location.pathname;

  return { sb, configured, arrival, $, esc, eur, store, toast, copyText, HOURS, parisNow, hhmm, openState, slots, STATUS, authError, redirectUrl, PHONE: "04 82 83 87 02" };
})();
