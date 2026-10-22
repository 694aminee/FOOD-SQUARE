// Écran cuisine : commandes en direct, réservé aux comptes de l'équipe (table "staff").
(function () {
  "use strict";
  const { sb, configured, $, esc, eur, toast, authError, redirectUrl } = window.FS;
  const FLOW = ["nouvelle", "preparation", "prete", "terminee"];
  const COLS = [["nouvelle", "Nouvelles", "Lancer"], ["preparation", "En préparation", "Prête"], ["prete", "Prêtes", "Remise au client"]];
  let orders = [], channel = null, soundOn = false, audio = null, armed = null, started = false;

  const show = id => ["loginForm", "denied", "board", "setupMsg"].forEach(x => { $("#" + x).hidden = x !== id; });

  if (!configured) { show("setupMsg"); return; }

  function beep() {
    if (!soundOn || !audio) return;
    try {
      [0, .25].forEach(dt => {
        const o = audio.createOscillator(), g = audio.createGain(); o.connect(g); g.connect(audio.destination);
        o.frequency.value = 880; const t = audio.currentTime + dt;
        g.gain.setValueAtTime(.25, t); g.gain.exponentialRampToValueAtTime(.001, t + .2);
        o.start(t); o.stop(t + .2);
      });
    } catch (e) {}
  }
  function ago(ts) {
    const m = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
    return m < 1 ? "à l'instant" : m < 60 ? `il y a ${m} min` : `il y a ${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
  }

  function render() {
    const done = orders.filter(o => o.status === "terminee");
    $("#kSummary").textContent = `${done.length} remise${done.length > 1 ? "s" : ""} · ${eur(done.reduce((s, o) => s + Number(o.total || 0), 0))}`;
    $("#kcols").innerHTML = COLS.map(([s, label, next]) => {
      const list = orders.filter(o => o.status === s).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      return `<section class="kcol" data-s="${s}"><h2><span>${label}</span><span class="num">${list.length}</span></h2><div class="klist">${list.length ? list.map(o => {
        const c = o.customer || {};
        return `<article class="kcard">
          <div class="kt"><b>#${esc(o.number)}</b><span>${o.mode === "livraison" ? "Livraison" : "Emporter"} · ${o.pickup_time === "asap" ? "au plus vite" : esc(o.pickup_time)}</span></div>
          <div style="color:var(--muted)">${esc(c.name)} · <a href="tel:${esc(String(c.phone || "").replace(/[^\d+]/g, ""))}" style="color:inherit">${esc(c.phone)}</a> · ${ago(o.created_at)}${o.user_id ? " · client inscrit" : " · invité"}</div>
          ${o.mode === "livraison" ? `<div><b>${esc(c.address)}</b>, ${esc(c.city)}</div>` : ""}
          <ul>${(o.items || []).map(i => `<li><b>${i.qty} × ${esc(i.name)}</b>${(i.lines || []).length ? `<small>${esc(i.lines.join(" · "))}</small>` : ""}${i.note ? `<small>« ${esc(i.note)} »</small>` : ""}</li>`).join("")}</ul>
          ${c.notes ? `<div style="color:var(--warn)">Note : ${esc(c.notes)}</div>` : ""}
          <div class="kt"><span class="num" style="font-size:18px;font-weight:700">${eur(Number(o.total || 0))} · ${esc(o.payment)}</span></div>
          <div class="kbtns"><button class="kbtn" data-adv="${o.id}">${next}</button>
            ${s !== "nouvelle" ? `<button class="kbtn alt" data-back="${o.id}">Revenir</button>` : `<button class="kbtn alt" data-cancel="${o.id}">${armed === o.id ? "Confirmer l'annulation" : "Annuler"}</button>`}</div>
        </article>`;
      }).join("") : `<div class="kempty">${s === "nouvelle" ? "Les nouvelles commandes arrivent ici en direct." : "Rien pour l'instant."}</div>`}</div></section>`;
    }).join("");
  }

  async function load() {
    const since = new Date(Date.now() - 20 * 3600e3).toISOString();
    const { data, error } = await sb.from("orders").select("*").gte("created_at", since).order("created_at", { ascending: false }).limit(500);
    if (error) { toast(authError(error)); return; }
    orders = data; render();
  }
  function live(state) {
    const p = $("#kLive"); p.hidden = false;
    p.className = "pill " + (state === "ok" ? "open" : "closed");
    p.innerHTML = "<i></i>" + (state === "ok" ? "En direct" : "Reconnexion…");
  }
  function subscribe() {
    if (channel) return;
    channel = sb.channel("orders-kitchen")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, payload => {
        const row = payload.new;
        if (payload.eventType === "INSERT") {
          if (!orders.some(o => o.id === row.id)) { orders.unshift(row); beep(); toast(`Nouvelle commande #${row.number}`); }
        } else if (payload.eventType === "UPDATE") {
          const i = orders.findIndex(o => o.id === row.id); if (i > -1) orders[i] = row; else orders.unshift(row);
        }
        render();
      })
      .subscribe(status => {
        if (status === "SUBSCRIBED") { live("ok"); load(); }
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") live("ko");
      });
  }

  async function setStatus(id, status) {
    const i = orders.findIndex(o => o.id === id); if (i < 0) return;
    const prev = orders[i].status; orders[i].status = status; render();
    const { error } = await sb.from("orders").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) { orders[i].status = prev; render(); toast("Mise à jour impossible : " + authError(error)); }
  }

  async function enter(session) {
    if (!session) { show("loginForm"); $("#logoutBtn").hidden = true; $("#soundBtn").hidden = true; $("#kLive").hidden = true; return; }
    const { data } = await sb.from("staff").select("user_id").eq("user_id", session.user.id).maybeSingle();
    $("#logoutBtn").hidden = false;
    if (!data) { $("#deniedEmail").textContent = session.user.email || ""; show("denied"); return; }
    show("board"); $("#soundBtn").hidden = false;
    if (!started) { started = true; await load(); subscribe(); setInterval(render, 60000); setInterval(load, 5 * 60000); }
    try { if (navigator.wakeLock) navigator.wakeLock.request("screen").catch(() => {}); } catch (e) {}
  }

  document.addEventListener("click", async e => {
    const t = e.target.closest("button"); if (!t) return;
    const d = t.dataset;
    if (d.adv) { const o = orders.find(x => x.id === d.adv); if (o) setStatus(o.id, FLOW[Math.min(3, FLOW.indexOf(o.status) + 1)]); }
    else if (d.back) { const o = orders.find(x => x.id === d.back); if (o) setStatus(o.id, FLOW[Math.max(0, FLOW.indexOf(o.status) - 1)]); }
    else if (d.cancel) { if (armed === d.cancel) { armed = null; setStatus(d.cancel, "annulee"); } else { armed = d.cancel; render(); setTimeout(() => { if (armed === d.cancel) { armed = null; render(); } }, 4000); } }
    else if (t.id === "soundBtn") {
      soundOn = !soundOn; t.setAttribute("aria-pressed", soundOn); t.textContent = soundOn ? "Son activé" : "Activer le son";
      if (soundOn) { try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); await audio.resume(); beep(); } catch (err) {} }
    }
    else if (t.id === "logoutBtn" || t.id === "deniedLogout") { await sb.auth.signOut(); location.reload(); }
    else if (t.id === "googleBtn") { const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectUrl() } }); if (error) $("#loginErr").textContent = authError(error); }
  });
  $("#loginForm").addEventListener("submit", async e => {
    e.preventDefault();
    const { error } = await sb.auth.signInWithPassword({ email: $("#l-email").value.trim(), password: $("#l-pass").value });
    $("#loginErr").textContent = error ? authError(error) : "";
  });

  sb.auth.onAuthStateChange((event, session) => { setTimeout(() => enter(session), 0); });
})();
