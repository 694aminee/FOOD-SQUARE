// Boutique Food Square : carte, panier, comptes clients, commande et suivi.
(function () {
  "use strict";
  const { sb, configured, arrival, $, esc, eur, store, toast, copyText, hhmm, openState, slots, parisNow, STATUS, authError, redirectUrl, PHONE } = window.FS;
  const { ICON, CATS, ITEMS, byId } = window.FS_MENU;
  const MIN_DELIVERY = 20;

  /* ---------- état ---------- */
  let cart = store.get("cart", []);
  let mode = store.get("mode", "emporter");
  let customer = store.get("customer", { name: "", phone: "", address: "", city: "Villefranche-sur-Saône", notes: "" });
  let session = null;
  let sheetState = null;
  let lastFocus = null;
  let trackTimer = null;
  const saveCart = () => store.set("cart", cart);
  const subtotal = () => cart.reduce((s, l) => s + l.unit * l.qty, 0);
  const count = () => cart.reduce((s, l) => s + l.qty, 0);

  /* ---------- options d'un article ---------- */
  function visible(g, sel) { if (!g.when) return true; const v = sel[g.when[0]]; return !!v && v[0] === g.when[1]; }
  function limitOf(g, sel) { if (g.exact) return g.exact(sel); return g.max || Infinity; }
  function unitPrice(item, sel) {
    let p = item.price;
    for (const g of item.opts) if (visible(g, sel)) for (const i of (sel[g.id] || [])) p += g.choices[i].p;
    return Math.round(p * 100) / 100;
  }
  function missing(item, sel) {
    for (const g of item.opts) {
      if (!visible(g, sel)) continue;
      const n = (sel[g.id] || []).length;
      if (g.exact) { const e = g.exact(sel); if (n !== e) return `Choisis ${e} ${g.label.toLowerCase()}`; }
      else if (g.req && n === 0) return `Choisis : ${g.label.toLowerCase()}`;
    }
    return "";
  }
  function summary(item, sel) {
    const out = [];
    for (const g of item.opts) {
      if (!visible(g, sel)) continue;
      const picked = (sel[g.id] || []).map(i => g.choices[i]);
      if (!picked.length) continue;
      if (g.id === "formule") { if (sel.formule[0] === 1) out.push(picked[0].n.replace(" · frites + boisson", " (frites + boisson)")); continue; }
      if (g.id === "gratine" && sel.gratine[0] === 0) continue;
      if (g.id === "taille" || g.id === "plat") { out.push(picked[0].n); continue; }
      out.push((g.short || g.label) + " : " + picked.map(c => c.n).join(", "));
    }
    return out;
  }
  function makeLine(item, sel, qty, note) {
    const clean = {};
    item.opts.forEach(g => { if (visible(g, sel) && sel[g.id] && sel[g.id].length) clean[g.id] = sel[g.id].slice(); });
    return { id: item.id, name: item.name, sel: clean, lines: summary(item, clean), unit: unitPrice(item, clean), qty, note: note || "" };
  }
  function addLine(line) {
    const same = cart.findIndex(l => l.id === line.id && JSON.stringify(l.sel) === JSON.stringify(line.sel) && (l.note || "") === line.note);
    if (same > -1) cart[same].qty += line.qty; else cart.push(line);
  }

  /* ---------- en-tête, horaires ---------- */
  function renderOpen() {
    const s = openState(); const pill = $("#openPill");
    pill.className = "pill " + (s.open ? "open" : "closed");
    $("#openTxt").textContent = s.open ? "Ouvert · jusqu'à " + hhmm(s.closeAt) : "Fermé · ouvre " + (s.nextOpen.today ? "à " : "demain à ") + hhmm(s.nextOpen.m);
    pill.title = $("#openTxt").textContent;
    const { d } = parisNow();
    const rows = [[0, "Dimanche – Jeudi", "11h – 1h"], [5, "Vendredi", "11h – 13h · 14h30 – 2h"], [6, "Samedi", "11h – 2h"]];
    $("#hoursTbl").innerHTML = rows.map(([k, l, h]) => {
      const today = k === 0 ? d <= 4 : d === k;
      return `<tr class="${today ? "today" : ""}"><td>${l}${today ? " · aujourd'hui" : ""}</td><td class="num">${h}</td></tr>`;
    }).join("");
  }
  const USER_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6"/></svg>';
  function activeOrder() {
    const last = store.get("last", null);
    return last && !["terminee", "annulee"].includes(last.status) && Date.now() - last.at < 6 * 3600e3 ? last : null;
  }
  function renderHeader() {
    $("#accountBtn").innerHTML = USER_ICON + `<span>${session ? "Mon compte" : "Se connecter"}</span>`;
    $("#accountBtn").hidden = !configured;
    const act = activeOrder();
    $("#ordersBtn").innerHTML = act ? `Commande #${esc(act.number)} <span class="dot"></span>` : "Mes commandes";
    const n = count();
    $("#bnCartCount").textContent = n; $("#bnCartCount").hidden = !n;
    $("#bnCartLabel").textContent = n ? eur(subtotal()) : "Panier";
    $("#bnOrdersDot").hidden = !act;
    $("#bnAccountLabel").textContent = session ? "Compte" : "Connexion";
  }
  function setTab(tab) {
    document.querySelectorAll(".bnav button").forEach(b => b.setAttribute("aria-current", b.dataset.tab === tab ? "page" : "false"));
  }

  /* ---------- carte ---------- */
  function renderNav() {
    $("#catNav").innerHTML = CATS.map(c => `<a class="chip" href="#cat-${c.id}" data-cat="${c.id}">${ICON[c.icon]}${esc(c.name)}</a>`).join("");
  }
  function priceTag(it) {
    const from = it.id === "tacos" ? "<small>dès </small>" : "";
    return `<span class="tagprice num">${from}${eur(it.price).replace(" €", "€")}</span>`;
  }
  function menuLine(it) {
    const f = it.opts.find(g => g.id === "formule");
    if (!f) return "";
    const word = f.choices[1].n.startsWith("Avec") ? "Avec boisson" : "Menu";
    return `<span class="menu">${word} <b class="num">${eur(it.price + f.choices[1].p)}</b></span>`;
  }
  function renderMenu() {
    const inCart = {}; cart.forEach(l => inCart[l.id] = (inCart[l.id] || 0) + l.qty);
    $("#menu").innerHTML = CATS.map(c => {
      const items = ITEMS.filter(i => i.cat === c.id);
      const title = c.brush ? `<span class="brush">${esc(c.name)}</span>${esc(c.label)}` : esc(c.name);
      return `<section class="sec" id="cat-${c.id}" data-sec="${c.id}">
        <div class="sechead">${ICON[c.icon]}<h2>${title}</h2>${c.note ? `<p>${esc(c.note)}</p>` : ""}</div>
        <div class="grid">${items.map(it => `
          <button class="item" data-open="${it.id}" aria-label="${esc(it.name)}, ${eur(it.price)}">
            ${inCart[it.id] ? `<span class="incart">${inCart[it.id]} au panier</span>` : ""}
            ${priceTag(it)}
            ${it.badge ? `<span class="badge">${esc(it.badge)}</span>` : ""}
            <h3>${esc(it.name)}</h3>
            <p class="desc">${esc(it.desc || "")}</p>
            <div class="foot">${menuLine(it) || "<span></span>"}<span class="add" aria-hidden="true">+</span></div>
          </button>`).join("")}</div>
      </section>`;
    }).join("");
  }

  /* ---------- panier ---------- */
  function cartHTML() {
    const st = subtotal();
    const lines = cart.length ? cart.map((l, i) => `
      <div class="line">
        <div class="qty"><button data-inc="${i}" aria-label="Ajouter un ${esc(l.name)}">+</button><b>${l.qty}</b><button data-dec="${i}" aria-label="Retirer un ${esc(l.name)}">−</button></div>
        <div style="min-width:0"><h4>${esc(l.name)}</h4><ul>${l.lines.map(x => `<li>${esc(x)}</li>`).join("")}${l.note ? `<li>« ${esc(l.note)} »</li>` : ""}</ul>
          <button class="linkbtn" data-edit="${i}">Modifier</button></div>
        <div class="lp num">${eur(l.unit * l.qty)}</div>
      </div>`).join("") : `<div class="empty"><b>Ton panier est vide</b>Choisis un tacos, un smash ou un menu pour commencer.</div>`;
    let warn = "";
    if (mode === "livraison" && cart.length && st < MIN_DELIVERY) {
      warn = `<div class="warnline">Encore <b class="num">${eur(MIN_DELIVERY - st)}</b> pour la livraison (minimum 20 €).<div class="bar" style="margin-top:6px"><i style="width:${Math.min(100, st / MIN_DELIVERY * 100)}%"></i></div></div>`;
    }
    const ok = cart.length && !(mode === "livraison" && st < MIN_DELIVERY);
    return `<header><h2>Ta commande</h2><span>${mode === "livraison" ? "Livraison" : "À emporter"} · ${count()} article${count() > 1 ? "s" : ""}</span></header>
      <div class="lines">${lines}</div>
      <div class="totals">${warn}
        <div class="row total"><span>Total</span><span class="num">${eur(st)}</span></div>
        <button class="btn" data-checkout ${ok ? "" : "disabled"}><span>Valider la commande</span><span class="num">${eur(st)}</span></button>
      </div>`;
  }
  function renderCart() {
    $("#sideTicket").innerHTML = cartHTML();
    const n = count();
    void n; if ($("#bnav")) renderHeader();
    document.querySelectorAll(".modebox .seg button").forEach(b => b.setAttribute("aria-pressed", b.dataset.mode === mode));
    $("#modeNote").textContent = mode === "livraison"
      ? "Livré sur Villefranche-sur-Saône et alentours, à partir de 20 € de commande."
      : "À récupérer au 140 rue Nationale, Villefranche-sur-Saône.";
  }
  function refreshCartViews() {
    renderCart(); renderMenu();
    const sc = $("#sheetCart"); if (sc) { if (!cart.length) closeSheet(); else sc.innerHTML = cartHTML(); }
  }

  /* ---------- fenêtre (sheet) ---------- */
  function openSheet(html, onMount) {
    if (!sheetState || !$("#sheetRoot .sheet")) lastFocus = document.activeElement;
    stopTracking();
    $("#sheetRoot").innerHTML = `<div class="scrim" data-scrim><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`;
    document.body.style.overflow = "hidden";
    onMount && onMount();
    const f = $("#sheetRoot .sheet input, #sheetRoot .sheet .btn, #sheetRoot .sheet button");
    if (f) f.focus({ preventScroll: true });
  }
  function closeSheet() {
    stopTracking();
    $("#sheetRoot").innerHTML = ""; document.body.style.overflow = ""; sheetState = null; setTab("menu");
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  const closeX = '<button class="x" data-close aria-label="Fermer">×</button>';

  /* ---------- composer un article ---------- */
  function openItem(id, editIndex) {
    const item = byId[id]; if (!item) return;
    let sel = {}, qty = 1, note = "";
    if (editIndex != null) { const l = cart[editIndex]; sel = JSON.parse(JSON.stringify(l.sel)); qty = l.qty; note = l.note || ""; }
    else item.opts.forEach(g => { if (g.def != null) sel[g.id] = [g.def]; });
    sheetState = { kind: "item", item, sel, qty, note, editIndex };
    openSheet(`<header><h2>${esc(item.name)}</h2><p>${esc(item.desc || "")}</p>${closeX}</header>
      <div class="sbody" id="sbody"></div>
      <div class="sfoot">
        <div class="stepper"><button data-q="-1" aria-label="Moins">−</button><b id="qv">1</b><button data-q="1" aria-label="Plus">+</button></div>
        <button class="btn" id="addBtn" style="flex:1"></button>
      </div>`, renderItem);
  }
  function renderItem() {
    const { item, sel, note } = sheetState;
    const body = item.opts.filter(g => visible(g, sel)).map(g => {
      const lim = limitOf(g, sel); const n = (sel[g.id] || []).length;
      const hint = g.exact ? `${lim} au choix` : (g.hint || "");
      const reqTag = (g.req || g.exact) ? `<small class="req">obligatoire${hint ? " · " + esc(hint) : ""}</small>` : `<small>${esc(hint || "facultatif")}</small>`;
      return `<fieldset class="grp"><legend><span>${esc(g.label)}</span>${reqTag}</legend><div class="opts">${g.choices.map((c, i) => {
        const checked = (sel[g.id] || []).includes(i);
        const dis = g.type === "many" && !checked && n >= lim;
        const t = g.type === "one" ? "radio" : "checkbox";
        return `<label class="opt"><input type="${t}" name="g-${g.id}" id="o-${g.id}-${i}" data-g="${g.id}" data-i="${i}" ${checked ? "checked" : ""} ${dis ? "disabled" : ""}><span>${esc(c.n)}${c.p ? `<em>+${eur(c.p).replace(" €", "€")}</em>` : ""}</span></label>`;
      }).join("")}</div></fieldset>`;
    }).join("");
    $("#sbody").innerHTML = body + `<fieldset class="grp"><legend><span>Une précision ?</span><small>facultatif</small></legend><textarea id="note" maxlength="140" placeholder="Ex. sans oignons, bien cuit, sauce à part">${esc(note)}</textarea></fieldset>`;
    updateItemFoot();
  }
  function updateItemFoot() {
    const { item, sel, qty, editIndex } = sheetState;
    $("#qv").textContent = qty;
    const miss = missing(item, sel);
    const b = $("#addBtn");
    b.disabled = !!miss;
    b.innerHTML = miss ? `<span>${esc(miss)}</span>` : `<span>${editIndex != null ? "Mettre à jour" : "Ajouter au panier"}</span><span class="num">${eur(unitPrice(item, sel) * qty)}</span>`;
  }
  function onOptChange(input) {
    const { item, sel } = sheetState; const g = item.opts.find(x => x.id === input.dataset.g); const i = +input.dataset.i;
    if (g.type === "one") sel[g.id] = [i];
    else { const cur = sel[g.id] || []; sel[g.id] = input.checked ? cur.concat(i) : cur.filter(x => x !== i); }
    item.opts.forEach(x => { const lim = limitOf(x, sel); if (sel[x.id] && sel[x.id].length > lim) sel[x.id] = sel[x.id].slice(0, lim); });
    const scroll = $("#sbody").scrollTop; renderItem(); $("#sbody").scrollTop = scroll;
    const again = document.getElementById(input.id); if (again) again.focus({ preventScroll: true });
  }
  function commitItem() {
    const { item, sel, qty, editIndex } = sheetState;
    if (missing(item, sel)) return;
    const line = makeLine(item, sel, qty, ($("#note").value || "").trim());
    if (editIndex != null) cart[editIndex] = line; else addLine(line);
    saveCart(); closeSheet(); renderCart(); renderMenu();
    toast(editIndex != null ? "Article modifié" : item.name + " ajouté");
  }

  function openCartSheet() {
    sheetState = { kind: "cart" };
    openSheet(`<button class="x" data-close aria-label="Fermer" style="z-index:2">×</button><div class="ticket" style="position:static;box-shadow:none;border:0;max-height:none;overflow:auto" id="sheetCart">${cartHTML()}</div>`);
  }

  /* ---------- comptes clients ---------- */
  const GOOGLE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.3H12v4.3h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.2-4.8 3.2-8z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z"/></svg>';

  function openAuth(view, msg) {
    if (!configured) { toast("Les comptes seront actifs une fois le site relié à Supabase"); return; }
    if (session && view !== "newpass") { openAccount(); return; }
    sheetState = { kind: "auth", view: view || "login" };
    const v = sheetState.view;
    const email = esc(store.get("email", ""));
    let body = "";
    if (v === "login" || v === "signup") {
      body = `<div class="tabs" role="tablist"><button role="tab" data-authview="login" aria-selected="${v === "login"}">Se connecter</button><button role="tab" data-authview="signup" aria-selected="${v === "signup"}">Créer un compte</button></div>
      <form class="form" id="authForm" novalidate style="padding-top:16px">
        ${msg ? `<div class="msg ${msg.type}">${msg.html}</div>` : ""}
        <button type="button" class="gbtn" data-google>${GOOGLE}Continuer avec Google</button>
        <div class="or">ou avec ton email</div>
        ${v === "signup" ? `<div class="field"><label for="a-name">Prénom</label><input id="a-name" autocomplete="given-name" required></div>` : ""}
        <div class="field"><label for="a-email">Email</label><input id="a-email" type="email" autocomplete="email" inputmode="email" value="${email}" required></div>
        <div class="field"><label for="a-pass">Mot de passe</label><input id="a-pass" type="password" autocomplete="${v === "signup" ? "new-password" : "current-password"}" minlength="8" required>${v === "signup" ? `<small style="color:var(--muted)">8 caractères minimum</small>` : ""}</div>
        <span class="err" id="authErr" role="alert" style="color:var(--red);font-size:14px"></span>
        <button class="btn" type="submit" id="authSubmit" style="justify-content:center">${v === "signup" ? "Créer mon compte" : "Se connecter"}</button>
        ${v === "login" ? `<button type="button" class="linkbtn" data-authview="forgot" style="justify-self:center">Mot de passe oublié ?</button>` : `<p style="margin:0;font-size:13px;color:var(--muted)">Tu recevras un email pour vérifier ton adresse avant ta première connexion.</p>`}
      </form>`;
    } else if (v === "forgot") {
      body = `<form class="form" id="authForm" novalidate style="padding-top:16px">
        ${msg ? `<div class="msg ${msg.type}">${msg.html}</div>` : `<p style="margin:0">Indique ton email : on t'envoie un lien pour choisir un nouveau mot de passe.</p>`}
        <div class="field"><label for="a-email">Email</label><input id="a-email" type="email" autocomplete="email" value="${email}" required></div>
        <span class="err" id="authErr" role="alert" style="color:var(--red);font-size:14px"></span>
        <button class="btn" type="submit" id="authSubmit" style="justify-content:center">Envoyer le lien</button>
        <button type="button" class="linkbtn" data-authview="login" style="justify-self:center">Retour à la connexion</button>
      </form>`;
    } else if (v === "sent") {
      body = `<div class="form" style="padding-top:16px">
        <div class="msg ok"><b>Vérifie ta boîte mail.</b><br>On a envoyé un lien de confirmation à <b>${esc(msg.email)}</b>. Clique dessus pour activer ton compte, puis reviens ici. Pense à regarder dans les spams.</div>
        <button class="btn ghost" data-resend="${esc(msg.email)}">Renvoyer l'email</button>
        <button class="btn" data-authview="login" style="justify-content:center">J'ai vérifié, me connecter</button>
      </div>`;
    } else if (v === "newpass") {
      body = `<form class="form" id="authForm" novalidate style="padding-top:16px">
        <p style="margin:0">Choisis ton nouveau mot de passe.</p>
        <div class="field"><label for="a-pass">Nouveau mot de passe</label><input id="a-pass" type="password" autocomplete="new-password" minlength="8" required></div>
        <span class="err" id="authErr" role="alert" style="color:var(--red);font-size:14px"></span>
        <button class="btn" type="submit" id="authSubmit" style="justify-content:center">Enregistrer</button>
      </form>`;
    }
    const titles = { login: "Mon compte", signup: "Mon compte", forgot: "Mot de passe oublié", sent: "Presque fini", newpass: "Nouveau mot de passe" };
    openSheet(`<header><h2>${titles[v]}</h2><p>Retrouve tes infos et tes commandes à chaque visite.</p>${closeX}</header><div class="sbody">${body}</div>`);
  }

  async function submitAuth() {
    const v = sheetState.view; const err = $("#authErr"); const btn = $("#authSubmit");
    const email = ($("#a-email") ? $("#a-email").value.trim() : "");
    const pass = ($("#a-pass") ? $("#a-pass").value : "");
    if (v !== "newpass" && !/^\S+@\S+\.\S+$/.test(email)) { err.textContent = "Indique une adresse email valide."; return; }
    if ((v === "signup" || v === "newpass") && pass.length < 8) { err.textContent = "Le mot de passe doit faire au moins 8 caractères."; return; }
    if (v === "login" && !pass) { err.textContent = "Indique ton mot de passe."; return; }
    if (email) store.set("email", email);
    err.textContent = ""; btn.disabled = true; const label = btn.textContent; btn.textContent = "Patiente…";
    try {
      if (v === "login") {
        const { error } = await sb.auth.signInWithPassword({ email, password: pass });
        if (error) throw error;
        closeSheet(); toast("Connecté");
      } else if (v === "signup") {
        const name = $("#a-name").value.trim();
        if (!name) { throw new Error("Indique ton prénom."); }
        const { data, error } = await sb.auth.signUp({ email, password: pass, options: { emailRedirectTo: redirectUrl(), data: { first_name: name } } });
        if (error) throw error;
        // Supabase renvoie un utilisateur sans identités quand l'email existe déjà.
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) throw new Error("already registered");
        if (!customer.name) { customer.name = name; store.set("customer", customer); }
        if (data.session) { closeSheet(); toast("Compte créé"); }
        else openAuth("sent", { email });
      } else if (v === "forgot") {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl() });
        if (error) throw error;
        openAuth("forgot", { type: "ok", html: `Si un compte existe pour <b>${esc(email)}</b>, un lien vient d'être envoyé. Ouvre-le sur cet appareil.` });
      } else if (v === "newpass") {
        const { error } = await sb.auth.updateUser({ password: pass });
        if (error) throw error;
        closeSheet(); toast("Mot de passe mis à jour");
      }
    } catch (e) {
      const m = authError(e);
      if (err && document.body.contains(err)) {
        err.innerHTML = esc(m) + (/pas encore vérifiée/.test(m) ? ` <button type="button" class="linkbtn" data-resend="${esc(email)}">Renvoyer l'email</button>` : "");
        btn.disabled = false; btn.textContent = label;
      } else toast(m);
    }
  }
  async function resendEmail(email) {
    const { error } = await sb.auth.resend({ type: "signup", email, options: { emailRedirectTo: redirectUrl() } });
    toast(error ? authError(error) : "Email renvoyé à " + email);
  }
  async function googleLogin() {
    const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectUrl() } });
    if (error) toast(authError(error));
  }

  async function loadProfile() {
    if (!session) return;
    const { data } = await sb.from("profiles").select("first_name, phone, address, city").eq("id", session.user.id).maybeSingle();
    const meta = session.user.user_metadata || {};
    const p = data || {};
    customer = {
      name: p.first_name || customer.name || meta.first_name || (meta.full_name || meta.name || "").split(" ")[0] || "",
      phone: p.phone || customer.phone || "",
      address: p.address || customer.address || "",
      city: p.city || customer.city || "Villefranche-sur-Saône",
      notes: customer.notes || ""
    };
    store.set("customer", customer);
  }
  async function saveProfile(c) {
    if (!session) return;
    await sb.from("profiles").upsert({ id: session.user.id, first_name: c.name, phone: c.phone, address: c.address, city: c.city, updated_at: new Date().toISOString() });
  }

  async function openAccount() {
    sheetState = { kind: "account" };
    const u = session.user;
    openSheet(`<header><h2>Mon compte</h2><p>${esc(u.email || "")}</p>${closeX}</header>
      <div class="sbody form" style="padding-top:16px">
        <button class="btn" data-tab="orders"><span>Mes commandes</span><span>→</span></button>
        <form class="form" id="profileForm" novalidate>
          <div class="field"><label for="p-name">Prénom</label><input id="p-name" autocomplete="given-name" value="${esc(customer.name)}"></div>
          <div class="field"><label for="p-phone">Téléphone</label><input id="p-phone" type="tel" autocomplete="tel" value="${esc(customer.phone)}"></div>
          <div class="field"><label for="p-addr">Adresse de livraison</label><input id="p-addr" autocomplete="street-address" value="${esc(customer.address)}"></div>
          <div class="field"><label for="p-city">Ville</label><input id="p-city" autocomplete="address-level2" value="${esc(customer.city)}"></div>
          <button class="btn ghost" type="submit">Enregistrer mes infos</button>
        </form>
        <button class="btn ghost" data-logout>Se déconnecter</button>
      </div>`);
  }

  // Mes commandes : celles du compte si le client est connecté,
  // sinon celles passées en invité depuis ce téléphone.
  async function openOrders() {
    sheetState = { kind: "orders", orders: [] };
    const intro = session
      ? "Toutes les commandes passées avec ton compte."
      : "Les commandes passées depuis ce téléphone." + (configured ? ` <button class="linkbtn" data-authview="login">Connecte-toi</button> pour les retrouver partout.` : "");
    openSheet(`<header><h2>Mes commandes</h2><p>${intro}</p>${closeX}</header>
      <div class="sbody" style="padding-top:16px"><div class="orders" id="myOrders"><div class="empty">Chargement…</div></div></div>`);
    let list = [];
    if (session) {
      const { data, error } = await sb.from("orders").select("id, number, created_at, status, total, items, mode").order("created_at", { ascending: false }).limit(30);
      if (error) { const box = $("#myOrders"); if (box) box.innerHTML = `<div class="msg err">${esc(authError(error))}</div>`; return; }
      list = data;
    } else {
      list = store.get("history", []).map(h => Object.assign({}, h));
      // Rafraîchit le statut des commandes récentes (moins de 24 h).
      if (sb) await Promise.all(list.filter(h => Date.now() - new Date(h.created_at).getTime() < 864e5 && h.id).map(async h => {
        const { data } = await sb.rpc("order_status", { order_id: h.id }); if (data) h.status = data.status;
      }));
      store.set("history", list);
    }
    if (!sheetState || sheetState.kind !== "orders") return;
    sheetState.orders = list;
    const box = $("#myOrders"); if (!box) return;
    if (!list.length) { box.innerHTML = `<div class="empty"><b>Aucune commande</b>Tes commandes apparaîtront ici avec leur suivi.</div><button class="btn" data-close><span>Voir la carte</span><span>→</span></button>`; return; }
    box.innerHTML = list.map((o, i) => {
      const active = ["nouvelle", "preparation", "prete"].includes(o.status) && Date.now() - new Date(o.created_at).getTime() < 864e5;
      return `<div class="ocard">
      <div class="row"><b>#${esc(o.number)}</b><span class="st ${esc(o.status)}">${esc(STATUS[o.status] || o.status)}</span></div>
      <div style="color:var(--muted)">${new Date(o.created_at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })} · ${o.mode === "livraison" ? "Livraison" : "À emporter"}</div>
      ${active ? trackerHTML(o.status) : ""}
      <div>${(o.items || []).map(it => `${it.qty} × ${esc(it.name)}`).join(", ")}</div>
      <div class="row"><span class="num" style="font-weight:700">${eur(+o.total)}</span><span style="display:flex;gap:14px">${active && o.id ? `<button class="linkbtn" data-trackid="${i}">Suivre</button>` : ""}<button class="linkbtn" data-reorder="${i}">Recommander</button></span></div>
    </div>`;
    }).join("");
  }
  function reorder(i) {
    const o = sheetState.orders[i]; let added = 0;
    (o.items || []).forEach(it => {
      const item = byId[it.id]; if (!item || !it.sel || missing(item, it.sel)) return;
      addLine(makeLine(item, it.sel, it.qty, it.note)); added++;
    });
    saveCart(); refreshCartViews(); closeSheet();
    toast(added ? "Ajouté au panier aux prix actuels" : "Ces articles ne sont plus à la carte");
  }

  /* ---------- commande ---------- */
  function openCheckout() {
    sheetState = { kind: "checkout" };
    const sl = slots(); const s = openState();
    const timeOpts = (s.open ? `<option value="asap">Dès que possible (${mode === "livraison" ? "30-45 min" : "~15 min"})</option>` : "")
      + sl.map(t => `<option value="${t}">${hhmm(t)}</option>`).join("");
    const who = session
      ? `<div class="msg ok">Connecté avec <b>${esc(session.user.email)}</b>. La commande sera enregistrée dans ton compte.</div>`
      : `<div class="recap"><b>Commande en invité</b><span style="color:var(--muted)">Pas besoin de compte : ton prénom et ton téléphone suffisent. Tu reçois un numéro de commande à la fin.</span>${configured ? `<button type="button" class="linkbtn" data-authview="login" style="justify-self:start">Se connecter pour retrouver tes commandes</button>` : ""}</div>`;
    openSheet(`<header><h2>Finaliser</h2><p>${mode === "livraison" ? "Livraison" : "À emporter au 140 rue Nationale"} · <span class="num">${eur(subtotal())}</span></p>${closeX}</header>
      <form class="sbody form" id="coForm" novalidate>
        <div class="seg" role="group" aria-label="Mode"><button type="button" data-mode="emporter" aria-pressed="${mode === "emporter"}">À emporter</button><button type="button" data-mode="livraison" aria-pressed="${mode === "livraison"}">Livraison</button></div>
        ${who}
        ${!s.open ? `<div class="warnline">Le snack est fermé. Choisis un horaire : ta commande sera préparée pour l'ouverture.</div>` : ""}
        <div class="field"><label for="f-name">Prénom</label><input id="f-name" autocomplete="given-name" value="${esc(customer.name)}" required></div>
        <div class="field"><label for="f-phone">Téléphone</label><input id="f-phone" type="tel" autocomplete="tel" inputmode="tel" placeholder="06 12 34 56 78" value="${esc(customer.phone)}" required></div>
        <div id="addrBox" ${mode === "livraison" ? "" : "hidden"} style="display:grid;gap:12px">
          <div class="field"><label for="f-addr">Adresse de livraison</label><input id="f-addr" autocomplete="street-address" placeholder="N° et rue, étage, code" value="${esc(customer.address)}"></div>
          <div class="field"><label for="f-city">Ville</label><input id="f-city" autocomplete="address-level2" value="${esc(customer.city)}"></div>
        </div>
        <div class="field"><label for="f-time">Heure</label><select id="f-time">${timeOpts}</select></div>
        <div class="field"><label for="f-pay">Paiement</label><select id="f-pay"><option>Carte bancaire</option><option>Espèces</option><option>Tickets restaurant</option></select></div>
        <div class="field"><label for="f-notes">Note pour le snack</label><input id="f-notes" maxlength="200" placeholder="Ex. sonner à l'interphone 3B" value="${esc(customer.notes)}"></div>
        <div class="recap">${cart.map(l => `<div class="row"><span>${l.qty} × ${esc(l.name)}</span><span class="num">${eur(l.unit * l.qty)}</span></div>`).join("")}
          <div class="row" style="font-weight:700;border-top:1px solid var(--line);padding-top:6px"><span>À payer ${mode === "livraison" ? "à la livraison" : "au retrait"}</span><span class="num">${eur(subtotal())}</span></div></div>
        <span class="err" id="coErr" role="alert" style="color:var(--red);font-size:14px"></span>
      </form>
      <div class="sfoot"><button class="btn" id="sendBtn" form="coForm" type="submit"><span>Envoyer la commande</span><span class="num">${eur(subtotal())}</span></button></div>`);
  }

  async function submitOrder() {
    const v = id => ($(id) ? $(id).value.trim() : "");
    customer = { name: v("#f-name"), phone: v("#f-phone"), address: v("#f-addr"), city: v("#f-city") || "Villefranche-sur-Saône", notes: v("#f-notes") };
    store.set("customer", customer);
    const err = $("#coErr");
    if (!customer.name) return void (err.textContent = "Indique ton prénom pour qu'on t'appelle au comptoir.");
    if (customer.phone.replace(/\D/g, "").length < 10) return void (err.textContent = "Indique un numéro de téléphone à 10 chiffres.");
    if (mode === "livraison" && !customer.address) return void (err.textContent = "Indique l'adresse de livraison.");
    if (mode === "livraison" && subtotal() < MIN_DELIVERY) return void (err.textContent = "La livraison démarre à 20 € de commande.");
    const tv = v("#f-time");
    if (!tv) return void (err.textContent = "Aucun horaire disponible pour le moment. Appelle le " + PHONE + ".");
    err.textContent = "";
    const btn = $("#sendBtn"); btn.disabled = true; btn.innerHTML = "<span>Envoi…</span>";
    const payload = {
      mode, time: tv === "asap" ? "asap" : hhmm(+tv), payment: v("#f-pay"),
      customer: { name: customer.name, phone: customer.phone, address: mode === "livraison" ? customer.address : "", city: mode === "livraison" ? customer.city : "", notes: customer.notes },
      items: cart.map(l => ({ id: l.id, sel: l.sel, name: l.name, qty: l.qty, lines: l.lines, note: l.note || "", total: Math.round(l.unit * l.qty * 100) / 100 })),
      total: Math.round(subtotal() * 100) / 100
    };
    let result = null;
    if (sb) {
      const { data, error } = await sb.rpc("place_order", { payload });
      if (error) {
        err.textContent = /fetch|network/i.test(error.message) ? "Pas de connexion. Vérifie ton réseau et réessaie." : "La commande n'est pas passée : " + error.message;
        btn.disabled = false; btn.innerHTML = `<span>Réessayer</span><span class="num">${eur(payload.total)}</span>`;
        return;
      }
      result = data;
      if (session) saveProfile(customer).catch(() => {});
    }
    const order = Object.assign({}, payload, result || { number: "—" });
    if (result) store.set("last", { id: result.id, number: result.number, status: "nouvelle", at: Date.now() });
    const hist = store.get("history", []);
    hist.unshift({ id: result ? result.id : null, number: result ? result.number : "—", status: result ? "nouvelle" : "non envoyée", created_at: new Date().toISOString(), mode, total: payload.total, items: payload.items });
    store.set("history", hist.slice(0, 30));
    cart = []; saveCart(); renderCart(); renderMenu(); renderHeader();
    showConfirm(order, !!result);
  }
  function orderText(o) {
    return `Commande Food Square\n${o.mode === "livraison" ? "Livraison : " + o.customer.address + ", " + o.customer.city : "À emporter"}\nHeure : ${o.time === "asap" ? "dès que possible" : o.time}\n${o.customer.name} · ${o.customer.phone}\n\n` +
      o.items.map(i => `${i.qty} × ${i.name}${i.lines.length ? " (" + i.lines.join(" ; ") + ")" : ""}${i.note ? " — " + i.note : ""}`).join("\n") +
      `\n\nTotal : ${eur(o.total)} · ${o.payment}${o.customer.notes ? "\nNote : " + o.customer.notes : ""}`;
  }
  function trackerHTML(status) {
    const steps = ["nouvelle", "preparation", "prete"];
    const idx = status === "terminee" ? 3 : steps.indexOf(status);
    return `<div class="track">${steps.map((s, i) => `<div class="${i <= idx ? "on" : ""} ${i === idx ? "now" : ""}">${STATUS[s]}</div>`).join("")}</div>`;
  }
  function showConfirm(o, sent) {
    sheetState = { kind: "confirm", copy: orderText(o), orderId: o.id };
    openSheet(`<button class="x" data-close aria-label="Fermer" style="z-index:2">×</button>
      <div class="sbody" style="padding-top:28px;display:grid;gap:18px">
        <div class="paper">
          ${sent ? `<p class="center" style="margin:0;text-transform:uppercase;letter-spacing:.1em;font-size:12px;color:var(--muted)">Ton numéro de commande</p>
          <div class="ordno num">#${esc(o.number)}</div>` : `<p class="center" style="margin:0 0 6px;font-family:var(--f-display);font-size:30px;text-transform:uppercase">Récapitulatif</p>`}
          <p class="center" style="margin:4px 0 14px;font-weight:600">${esc(o.customer.name)} · ${o.mode === "livraison" ? "Livraison" : "À emporter"} · ${o.time === "asap" ? (o.mode === "livraison" ? "dans 30-45 min" : "prête dans ~15 min") : "pour " + esc(o.time)}</p>
          ${o.items.map(i => `<div class="row" style="border-top:1px dashed var(--line);padding:6px 0"><span>${i.qty} × ${esc(i.name)}${i.lines.length ? `<br><small style="color:var(--muted)">${esc(i.lines.join(" · "))}</small>` : ""}</span><span class="num">${eur(i.total)}</span></div>`).join("")}
          <div class="row total" style="border-top:2px solid var(--ink);padding-top:8px;margin-top:4px"><span>Total</span><span class="num">${eur(o.total)}</span></div>
          <p class="center" style="margin:8px 0 0;color:var(--muted)">Paiement : ${esc(o.payment)}</p>
        </div>
        ${sent
          ? `<div id="trackBox">${trackerHTML("nouvelle")}</div>
             <div class="status ok"><b>✓</b><span>Commande envoyée en cuisine. Cette page se met à jour toute seule. Garde ton numéro, on t'appelle au ${esc(o.customer.phone)} en cas de souci.</span></div>`
          : `<div class="status warn"><span>Le site n'est pas encore relié à la cuisine. Appelle le snack au <b class="num">${PHONE}</b> pour passer cette commande, ou copie le récapitulatif.</span></div>
             <button class="btn ghost" data-copytext>Copier le récapitulatif</button>`}
        <button class="btn" data-close><span>Retour à la carte</span><span>→</span></button>
      </div>`);
    if (sent) startTracking(o.id);
  }
  function startTracking(id) {
    const tick = async () => {
      const { data } = await sb.rpc("order_status", { order_id: id });
      if (!data) return;
      const box = $("#trackBox"); if (box) box.innerHTML = trackerHTML(data.status);
      const last = store.get("last", null);
      if (last && last.id === id) { last.status = data.status; store.set("last", last); renderHeader(); }
      const hist = store.get("history", []); const h = hist.find(x => x.id === id); if (h && h.status !== data.status) { h.status = data.status; store.set("history", hist); }
      if (data.status === "prete" && sheetState && sheetState.notified !== id) { sheetState.notified = id; toast(data.mode === "livraison" ? "Ta commande part en livraison" : "Ta commande est prête !"); }
      if (data.status === "terminee" || data.status === "annulee") stopTracking();
    };
    stopTracking(); tick(); trackTimer = setInterval(tick, 15000);
  }
  function stopTracking() { if (trackTimer) { clearInterval(trackTimer); trackTimer = null; } }
  function openTrack() {
    const last = store.get("last", null); if (!last || !sb) return;
    sheetState = { kind: "track" };
    openSheet(`<header><h2>Commande #${esc(last.number)}</h2><p>Suivi en direct, mis à jour toutes les 15 secondes.</p>${closeX}</header>
      <div class="sbody" style="display:grid;gap:16px;padding-top:18px"><div id="trackBox">${trackerHTML(last.status || "nouvelle")}</div>
      <p style="margin:0;color:var(--muted)">Une question ? Appelle le <b class="num">${PHONE}</b> en donnant ton numéro.</p></div>`);
    startTracking(last.id);
  }

  /* ---------- événements ---------- */
  document.addEventListener("click", e => {
    const t = e.target.closest("button, a, [data-scrim]"); if (!t) return;
    if (t.matches("[data-scrim]")) { if (e.target === t) closeSheet(); return; }
    const d = t.dataset;
    if (d.open) return openItem(d.open);
    if (d.close !== undefined) return closeSheet();
    if (d.q) { sheetState.qty = Math.max(1, Math.min(20, sheetState.qty + (+d.q))); return updateItemFoot(); }
    if (t.id === "addBtn") return commitItem();
    if (d.inc) { cart[+d.inc].qty++; saveCart(); return refreshCartViews(); }
    if (d.dec) { const i = +d.dec; cart[i].qty--; if (cart[i].qty <= 0) cart.splice(i, 1); saveCart(); return refreshCartViews(); }
    if (d.edit) { const i = +d.edit; const l = cart[i]; closeSheet(); return openItem(l.id, i); }
    if (d.checkout !== undefined) { if (!t.disabled) openCheckout(); return; }
    if (d.showcart !== undefined) return openCartSheet();
    if (d.mode) {
      mode = d.mode; store.set("mode", mode); renderCart();
      if (sheetState && sheetState.kind === "checkout") {
        if (mode === "livraison" && subtotal() < MIN_DELIVERY) { closeSheet(); toast("Livraison dès 20 € de commande"); } else openCheckout();
      }
      return;
    }
    if (d.authview) return openAuth(d.authview);
    if (d.google !== undefined) return googleLogin();
    if (d.resend) return resendEmail(d.resend);
    if (d.logout !== undefined) { sb.auth.signOut().then(() => { closeSheet(); toast("Déconnecté"); }); return; }
    if (d.reorder) return reorder(+d.reorder);
    if (d.copy) return copyText(d.copy);
    if (d.copytext !== undefined && sheetState) return copyText(sheetState.copy);
    if (t.id === "accountBtn") return session ? openAccount() : openAuth("login");
    if (t.id === "ordersBtn") { setTab("orders"); return openOrders(); }
    if (d.trackid) { const o = sheetState.orders[+d.trackid]; store.set("last", { id: o.id, number: o.number, status: o.status, at: new Date(o.created_at).getTime() }); return openTrack(); }
    if (d.tab) {
      const tab = d.tab;
      if (sheetState) closeSheet();
      setTab(tab);
      if (tab === "menu") { const m = $("#cat-" + CATS[0].id); window.scrollTo({ top: 0, behavior: "smooth" }); void m; }
      else if (tab === "orders") openOrders();
      else if (tab === "cart") { if (count()) openCartSheet(); else { toast("Ton panier est vide"); setTab("menu"); } }
      else if (tab === "infos") { setTab("infos"); $("#infos").scrollIntoView({ behavior: "smooth" }); }
      else if (tab === "account") { if (!configured) { toast("Les comptes seront actifs une fois le site relié à Supabase"); setTab("menu"); } else if (session) openAccount(); else openAuth("login"); }
      if (["orders", "cart", "account"].includes(tab) && sheetState) setTab(tab);
      return;
    }
    if (t.id === "home") { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }
  });
  document.addEventListener("change", e => { if (e.target.matches("#sbody input[data-g]")) onOptChange(e.target); });
  document.addEventListener("input", e => { if (e.target.id === "note" && sheetState) sheetState.note = e.target.value; });
  document.addEventListener("submit", e => {
    e.preventDefault();
    if (e.target.id === "coForm") submitOrder();
    else if (e.target.id === "authForm") submitAuth();
    else if (e.target.id === "profileForm") {
      const v = id => $(id).value.trim();
      customer = Object.assign(customer, { name: v("#p-name"), phone: v("#p-phone"), address: v("#p-addr"), city: v("#p-city") });
      store.set("customer", customer);
      saveProfile(customer).then(() => toast("Infos enregistrées"), () => toast("Enregistrement impossible, réessaie"));
    }
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && sheetState) closeSheet(); });

  function watchCats() {
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        const id = en.target.dataset.sec;
        document.querySelectorAll(".chip").forEach(c => c.classList.toggle("on", c.dataset.cat === id));
        const chip = document.querySelector(`.chip[data-cat="${id}"]`);
        if (chip) chip.scrollIntoView({ block: "nearest", inline: "center" });
      });
    }, { rootMargin: "-140px 0px -60% 0px" });
    document.querySelectorAll(".sec").forEach(s => io.observe(s));
  }

  /* ---------- démarrage ---------- */
  renderOpen(); renderNav(); renderMenu(); renderCart(); renderHeader(); watchCats();
  setInterval(renderOpen, 60000);
  if (!configured) $("#demoBar").hidden = false;
  if (sb) {
    sb.auth.onAuthStateChange((event, s) => {
      session = s; renderHeader();
      if (event === "PASSWORD_RECOVERY") { setTimeout(() => openAuth("newpass"), 0); return; }
      if (event === "SIGNED_IN") {
        setTimeout(() => {
          loadProfile();
          if (arrival.type === "signup") { arrival.type = ""; toast("Adresse vérifiée, bienvenue chez Food Square !"); }
        }, 0);
      }
    });
    if (arrival.error) setTimeout(() => openAuth("login", { type: "err", html: esc(authError(arrival.error)) }), 300);
  }
})();
