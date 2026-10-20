// Connexion par lien à usage unique et suivi projet côté serveur (KV « BRIEFS »).
// Variables : ADMIN_EMAILS (adresses autorisées à écrire le suivi, séparées par des virgules).

const SITE = "https://buttiscreen.fr";
const MAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN_RE = /^[0-9a-f]{32}$/;
const LINK_TTL = 900;
const SESSION_TTL = 30 * 86400;
const ADMIN_SESSION_TTL = 12 * 3600;
const MIN_FILL_MS = 2500;
const ETATS = ["brief", "preparation", "montage", "etalonnage", "livraison"];
const MAX_FACTURE = 2_900_000;
const MAX_INDEX = 1000;
const PAGES = { commande: "commande.html", atelier: "atelier.html", gestion: "gestion.html" };
const MAKE_HOOK = "https://hook.eu1.make.com/q9filj9cvcdae4534x28xxztxeynrqd3";

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const oneLine = (s) => String(s ?? "").replace(/[\r\n\t]+/g, " ").trim();
const randomToken = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");

async function sha256(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function bump(kv, key, limit, ttl) {
  const n = Number(await kv.get(key)) || 0;
  if (n >= limit) return false;
  await kv.put(key, String(n + 1), { expirationTtl: ttl });
  return true;
}

const admins = (env) =>
  (env.ADMIN_EMAILS || "").split(",").map((a) => a.trim().toLowerCase()).filter(Boolean);
const isAdmin = (env, email) => admins(env).includes(email);

export function buildLoginMail(email, token, page, env) {
  const contact = env.MAIL_TO || "contact@buttiscreen.fr";
  const url = `${SITE}/${PAGES[page] || PAGES.commande}#connexion=${token}`;
  return {
    from: env.MAIL_FROM || "Buttiscreen <brief@buttiscreen.fr>",
    to: [email],
    reply_to: contact,
    subject: "Votre lien de connexion — BUTTISCREEN",
    text: [
      "Bonjour,",
      "",
      "Voici votre lien de connexion à Mon compte. Il est valable 15 minutes et ne sert qu'une fois :",
      "",
      url,
      "",
      "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : personne ne peut entrer sans ce lien.",
      "",
      "BUTTISCREEN · Studio de montage vidéo · Paris",
      SITE,
    ].join("\n"),
    html:
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#efedf3"><tr><td align="center" style="padding:24px 12px">` +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff"><tr><td style="background:#07060d;padding:20px 28px;border-bottom:3px solid #ff6a00">` +
      `<img src="${SITE}/logo-mail.png" width="44" height="44" alt="" style="display:inline-block;vertical-align:middle;border:0"><span style="display:inline-block;vertical-align:middle;margin-left:14px;color:#f4f1fa;font:600 15px Helvetica,Arial,sans-serif;letter-spacing:3px">BUTTISCREEN</span></td></tr>` +
      `<tr><td style="padding:32px 28px 8px;font-family:Helvetica,Arial,sans-serif;color:#1b1826"><p style="margin:0 0 18px;font-size:16px">Bonjour,</p>` +
      `<h1 style="margin:0 0 14px;font:600 22px Georgia,'Times New Roman',serif;color:#07060d">Votre lien de connexion.</h1>` +
      `<p style="margin:0 0 24px;font-size:15px;line-height:1.6">Il est valable 15 minutes et ne sert qu’une fois.</p>` +
      `<p style="margin:0 0 28px"><a href="${esc(url)}" style="display:inline-block;padding:12px 22px;background:#ff6a00;color:#07060d;text-decoration:none;font:600 14px Helvetica,Arial,sans-serif">Ouvrir Mon compte</a></p></td></tr>` +
      `<tr><td style="padding:18px 28px 28px;border-top:1px solid #e6e2ef;font:12px/1.6 Helvetica,Arial,sans-serif;color:#7a7488">Si vous n’êtes pas à l’origine de cette demande, ignorez ce message : personne ne peut entrer sans ce lien.<br>BUTTISCREEN · Studio de montage vidéo · Paris · <a href="${esc(SITE)}" style="color:#7a7488">buttiscreen.fr</a></td></tr></table></td></tr></table>`,
    headers: { "Auto-Submitted": "auto-replied" },
  };
}

export function buildInvoiceMail(email, titre, env) {
  const contact = env.MAIL_TO || "contact@buttiscreen.fr";
  const url = `${SITE}/commande.html`;
  const projet = titre ? ` pour « ${titre} »` : "";
  return {
    from: env.MAIL_FROM || "Buttiscreen <brief@buttiscreen.fr>",
    to: [email],
    reply_to: contact,
    subject: "Votre facture est disponible — BUTTISCREEN",
    text: [
      "Bonjour,",
      "",
      `Votre facture${projet} vient d'être déposée dans votre espace Mon compte. Vous pouvez la télécharger à tout moment :`,
      "",
      url,
      "",
      "Connectez-vous avec votre adresse e-mail : un lien de connexion vous est envoyé.",
      "",
      "BUTTISCREEN · Studio de montage vidéo · Paris",
      SITE,
    ].join("\n"),
    html:
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#efedf3"><tr><td align="center" style="padding:24px 12px">` +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff"><tr><td style="background:#07060d;padding:20px 28px;border-bottom:3px solid #ff6a00">` +
      `<img src="${SITE}/logo-mail.png" width="44" height="44" alt="" style="display:inline-block;vertical-align:middle;border:0"><span style="display:inline-block;vertical-align:middle;margin-left:14px;color:#f4f1fa;font:600 15px Helvetica,Arial,sans-serif;letter-spacing:3px">BUTTISCREEN</span></td></tr>` +
      `<tr><td style="padding:32px 28px 8px;font-family:Helvetica,Arial,sans-serif;color:#1b1826"><p style="margin:0 0 18px;font-size:16px">Bonjour,</p>` +
      `<h1 style="margin:0 0 14px;font:600 22px Georgia,'Times New Roman',serif;color:#07060d">Votre facture est disponible.</h1>` +
      `<p style="margin:0 0 24px;font-size:15px;line-height:1.6">Elle vient d’être déposée${esc(projet)} dans votre espace Mon compte, où vous pouvez la télécharger à tout moment.</p>` +
      `<p style="margin:0 0 28px"><a href="${esc(url)}" style="display:inline-block;padding:12px 22px;background:#ff6a00;color:#07060d;text-decoration:none;font:600 14px Helvetica,Arial,sans-serif">Ouvrir Mon compte</a></p></td></tr>` +
      `<tr><td style="padding:18px 28px 28px;border-top:1px solid #e6e2ef;font:12px/1.6 Helvetica,Arial,sans-serif;color:#7a7488">Connectez-vous avec votre adresse e-mail : un lien de connexion vous est envoyé.<br>BUTTISCREEN · Studio de montage vidéo · Paris · <a href="${esc(SITE)}" style="color:#7a7488">buttiscreen.fr</a></td></tr></table></td></tr></table>`,
    headers: { "Auto-Submitted": "auto-generated" },
  };
}

async function sendInvoiceMail(env, email, titre) {
  if (!env.RESEND_API_KEY) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify(buildInvoiceMail(email, titre, env)),
    });
    return res.ok;
  } catch {
    return false;
  }
}

const slugOf = (email) => String(email).toLowerCase().replace(/[^a-z0-9]/g, "");

// Écriture dans Make, toujours avec le mot de passe de la gestion que seul le Worker détient. Sans lui, on ne fait rien.
async function makeCall(env, body) {
  if (!env.MAKE_PASSWORD) return null;
  try {
    const res = await fetch(MAKE_HOOK, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, password: env.MAKE_PASSWORD }),
    });
    return await res.json().catch(() => null);
  } catch {
    return null;
  }
}

// Fiche « commande » de la gestion : même contenu que l'ancien envoi depuis le navigateur.
export function pushCommande(env, email, p) {
  const etat = p.etat || "brief";
  return makeCall(env, {
    action: "commande",
    clef: `cmd-${slugOf(email)}`,
    email,
    nom: p.titre || email,
    projet: p.titre || "",
    etat,
    statut: etat === "livraison" || p.clos === true ? "close" : "cours",
    delai: p.delai || "",
    message: "",
    cree: new Date().toISOString(),
  });
}

// Fiche « rendez-vous » du tunnel.
export function pushRdv(env, data) {
  return makeCall(env, {
    action: "rdv",
    clef: `rdv-${slugOf(data.email)}-${Date.now()}`,
    studio: "BUTTISCREEN",
    fuseau: "Europe/Paris",
    nom: data.nom,
    email: data.email,
    projet: data.projet,
    duree: data.duree || "",
    diffusion: data.diffusion || "",
    creneau: data.creneau || "",
    message: data.message,
    cree: new Date().toISOString(),
  });
}

// Première connexion d'un client : prévenir le studio, et créer sa fiche dans la gestion si elle n'existe pas déjà
// (jamais d'écrasement : l'écriture dans Make remplace la fiche, donc on vérifie d'abord).
async function welcomeClient(env, email) {
  try {
    const hash = await sha256(email);
    if (await env.BRIEFS.get(`c:${hash}`)) return;
    await env.BRIEFS.put(`c:${hash}`, new Date().toISOString());
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: env.MAIL_FROM || "Buttiscreen <brief@buttiscreen.fr>",
        to: [env.MAIL_TO || "contact@buttiscreen.fr"],
        subject: `Nouveau compte client — ${email}`.slice(0, 200),
        text: `${email} vient de se connecter pour la première fois à Mon compte.\n\nSon suivi se renseigne dans l'atelier : ${SITE}/atelier.html`,
        headers: { "Auto-Submitted": "auto-generated" },
      }),
    });
    if ((await env.BRIEFS.get(`p:${hash}`)) || !env.MAKE_PASSWORD) return;
    const login = await makeCall(env, { action: "login", email: env.MAKE_OWNER_EMAIL || "tristan.buttig1@gmail.com" });
    if (!login || !login.token) return;
    const list = await makeCall(env, { action: "list", token: login.token });
    if (!list || list.ok !== true || !Array.isArray(list.items)) return; // doute : on n'écrit pas
    const known = list.items.some((i) => i && i.kind === "commande" && String(i.email || "").toLowerCase() === email);
    if (!known) await pushCommande(env, email, { etat: "brief" });
  } catch {}
}

async function parse(request, max, reply, allowed) {
  const raw = await request.text();
  if (raw.length > max) return { res: reply({ error: "size" }, 413, allowed) };
  try {
    const input = JSON.parse(raw);
    return { input: input && typeof input === "object" ? input : {} };
  } catch {
    return { res: reply({ error: "json" }, 400, allowed) };
  }
}

async function sessionOf(request, env) {
  const m = /^Bearer ([0-9a-f]{32})$/.exec(request.headers.get("authorization") || "");
  if (!m || !env.BRIEFS) return null;
  const raw = await env.BRIEFS.get(`s:${await sha256(m[1])}`);
  if (!raw) return null;
  try {
    return { token: m[1], ...JSON.parse(raw) };
  } catch {
    return null;
  }
}

const emptyProject = () => ({ titre: "", etat: "brief", delai: "", factureNom: "", facture: "", clos: false, maj: "" });

async function readProject(env, email) {
  try {
    const raw = await env.BRIEFS.get(`p:${await sha256(email)}`);
    return raw ? { ...emptyProject(), ...JSON.parse(raw) } : emptyProject();
  } catch {
    return emptyProject();
  }
}

async function latestBrief(env, email) {
  try {
    const ids = JSON.parse((await env.BRIEFS.get(`e:${await sha256(email)}`)) || "[]");
    for (const id of ids) {
      const raw = await env.BRIEFS.get(`b:${id}`);
      if (!raw) continue;
      const b = JSON.parse(raw);
      return { id, cree: b.cree, nom: b.nom, email: b.email, projet: b.projet, duree: b.duree, diffusion: b.diffusion, creneau: b.creneau, message: b.message };
    }
  } catch {}
  return null;
}

// Demande de lien : réponse identique que l'adresse soit connue ou non.
async function handleRequest(request, env, ctx, allowed, reply) {
  const { input: d, res } = await parse(request, 2000, reply, allowed);
  if (res) return res;
  const email = oneLine(d.email).toLowerCase();
  if (!MAIL_RE.test(email) || email.length > 254) return reply({ error: "validation" }, 422, allowed);
  const ok = reply({ ok: true }, 200, allowed);
  if (Boolean(d.website) || !(Date.now() - Number(d.t) >= MIN_FILL_MS)) return ok;
  if (!env.BRIEFS || !env.RATE) return ok;
  const page = d.page === "atelier" || d.page === "gestion" ? d.page : "commande";
  if (page !== "commande" && !isAdmin(env, email)) return ok; // pas de lien d'atelier ni de gestion pour un tiers
  const ip = request.headers.get("cf-connecting-ip") || "inconnue";
  if (!(await bump(env.RATE, `ar:${ip}:${Math.floor(Date.now() / 3_600_000)}`, 8, 3600))) return ok;
  const hash = await sha256(email);
  if (!(await bump(env.RATE, `arm:${hash}:${Math.floor(Date.now() / 3_600_000)}`, 3, 3600))) return ok;
  const task = (async () => {
    try {
      const token = randomToken();
      await env.BRIEFS.put(`ml:${await sha256(token)}`, JSON.stringify({ email }), { expirationTtl: LINK_TTL });
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
        body: JSON.stringify(buildLoginMail(email, token, page, env)),
      });
    } catch {}
  })();
  if (ctx && ctx.waitUntil) ctx.waitUntil(task);
  else await task;
  return ok;
}

// Le jeton du lien s'échange une seule fois contre une session. Il est dans le fragment (#), donc jamais envoyé
// au serveur par un simple clic : un scanner de messagerie qui ouvre le lien ne le consomme pas.
async function handleVerify(request, env, ctx, allowed, reply) {
  const { input: d, res } = await parse(request, 500, reply, allowed);
  if (res) return res;
  const token = String(d.token || "");
  if (!env.BRIEFS || !TOKEN_RE.test(token)) return reply({ error: "lien" }, 400, allowed);
  const ip = request.headers.get("cf-connecting-ip") || "inconnue";
  if (env.RATE && !(await bump(env.RATE, `av:${ip}:${Math.floor(Date.now() / 3_600_000)}`, 20, 3600))) {
    return reply({ error: "limite" }, 429, allowed);
  }
  const key = `ml:${await sha256(token)}`;
  const raw = await env.BRIEFS.get(key);
  if (!raw) return reply({ error: "lien" }, 400, allowed);
  await env.BRIEFS.delete(key);
  const { email } = JSON.parse(raw);
  const admin = isAdmin(env, email);
  const session = randomToken();
  await env.BRIEFS.put(`s:${await sha256(session)}`, JSON.stringify({ email, admin }), {
    expirationTtl: admin ? ADMIN_SESSION_TTL : SESSION_TTL,
  });
  if (!admin) {
    const welcome = welcomeClient(env, email);
    if (ctx && ctx.waitUntil) ctx.waitUntil(welcome);
    else await welcome;
  }
  return reply({ ok: true, session, email, admin }, 200, allowed);
}

async function handleMe(request, env, allowed, reply) {
  const s = await sessionOf(request, env);
  if (!s) return reply({ error: "session" }, 401, allowed);
  const projet = await readProject(env, s.email);
  const brief = await latestBrief(env, s.email);
  return reply({ ok: true, email: s.email, admin: isAdmin(env, s.email), projet, brief }, 200, allowed);
}

async function handleLogout(request, env, allowed, reply) {
  const s = await sessionOf(request, env);
  if (s) await env.BRIEFS.delete(`s:${await sha256(s.token)}`);
  return reply({ ok: true }, 200, allowed);
}

const readIndex = async (env) => {
  try {
    return JSON.parse((await env.BRIEFS.get("pidx")) || "[]");
  } catch {
    return [];
  }
};

// Historique des factures : le PDF vit dans « f:<id> », l'index « fidx » ne garde que les métadonnées.
// Une facture déposée n'est jamais effacée : une erreur se corrige par un nouveau dépôt.
const sizeOf = (data) => Math.round((String(data).length * 3) / 4);

async function readInvoices(env) {
  const raw = await env.BRIEFS.get("fidx");
  if (raw !== null) {
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
  // Première lecture : les factures déposées avant l'historique y entrent une fois.
  const found = [];
  for (const email of await readIndex(env)) {
    const p = await readProject(env, email);
    if (!p.facture) continue;
    const id = randomToken();
    await env.BRIEFS.put(`f:${id}`, JSON.stringify({ email, nom: p.factureNom, data: p.facture, cree: p.maj }));
    found.push({ id, email, titre: p.titre, nom: p.factureNom || "facture.pdf", cree: p.maj, taille: sizeOf(p.facture) });
  }
  found.sort((a, b) => String(b.cree).localeCompare(String(a.cree)));
  await env.BRIEFS.put("fidx", JSON.stringify(found.slice(0, MAX_INDEX)));
  return found;
}

async function addInvoice(env, email, titre, nom, data, cree) {
  const index = await readInvoices(env);
  const id = randomToken();
  await env.BRIEFS.put(`f:${id}`, JSON.stringify({ email, nom, data, cree }));
  const entry = { id, email, titre, nom, cree, taille: sizeOf(data) };
  await env.BRIEFS.put("fidx", JSON.stringify([entry, ...index].slice(0, MAX_INDEX)));
  return entry;
}

async function handleInvoices(request, env, allowed, reply) {
  const s = await sessionOf(request, env);
  if (!s || !isAdmin(env, s.email)) return reply({ error: "session" }, 401, allowed);
  return reply({ ok: true, factures: await readInvoices(env) }, 200, allowed);
}

async function handleInvoice(request, env, id, allowed, reply) {
  const s = await sessionOf(request, env);
  if (!s || !isAdmin(env, s.email)) return reply({ error: "session" }, 401, allowed);
  if (!TOKEN_RE.test(id)) return reply({ error: "introuvable" }, 404, allowed);
  try {
    const f = JSON.parse((await env.BRIEFS.get(`f:${id}`)) || "null");
    if (!f) return reply({ error: "introuvable" }, 404, allowed);
    return reply({ ok: true, nom: f.nom, data: f.data }, 200, allowed);
  } catch {
    return reply({ error: "introuvable" }, 404, allowed);
  }
}

// Écriture du suivi : réservée aux adresses du studio (ADMIN_EMAILS), vérifiée à chaque appel.
async function handleSave(request, env, allowed, reply) {
  const s = await sessionOf(request, env);
  if (!s || !isAdmin(env, s.email)) return reply({ error: "session" }, 401, allowed);
  const { input: d, res } = await parse(request, MAX_FACTURE + 2000, reply, allowed);
  if (res) return res;
  const email = oneLine(d.email).toLowerCase();
  if (!MAIL_RE.test(email) || email.length > 254) return reply({ error: "validation" }, 422, allowed);
  const current = await readProject(env, email);
  const next = { ...current };
  if (d.titre !== undefined) next.titre = oneLine(d.titre).slice(0, 160);
  if (d.etat !== undefined) {
    if (!ETATS.includes(d.etat)) return reply({ error: "validation" }, 422, allowed);
    next.etat = d.etat;
  }
  if (d.delai !== undefined) next.delai = oneLine(d.delai).slice(0, 40);
  if (d.clos !== undefined) next.clos = d.clos === true; // dossier clôturé à la main : archivé, jamais effacé
  let depot = null;
  const f = d.facture === undefined ? "" : String(d.facture);
  if (f) {
    if (!f.startsWith("data:application/pdf;base64,") || f.length > MAX_FACTURE) {
      return reply({ error: "facture" }, 422, allowed);
    }
    next.facture = f; // dernière facture : c'est celle que Mon compte propose
    next.factureNom = oneLine(d.factureNom).slice(0, 120) || "facture.pdf";
  }
  next.maj = new Date().toISOString();
  if (f) depot = await addInvoice(env, email, next.titre, next.factureNom, f, next.maj);
  await env.BRIEFS.put(`p:${await sha256(email)}`, JSON.stringify(next));
  const idx = await readIndex(env);
  if (!idx.includes(email)) await env.BRIEFS.put("pidx", JSON.stringify([email, ...idx].slice(0, 500)));
  await pushCommande(env, email, next);
  const mailed = depot && d.notifier === true ? await sendInvoiceMail(env, email, next.titre) : false;
  return reply({ ok: true, mailed, facture: depot, projet: { ...next, facture: undefined, hasFacture: Boolean(next.facture) } }, 200, allowed);
}

// Ouvre la gestion avec la session studio : le Worker se connecte à Make à la place du studio.
// Le mot de passe de Make (MAKE_PASSWORD) reste un secret du Worker, jamais dans le navigateur.
async function handleGestion(request, env, allowed, reply) {
  const s = await sessionOf(request, env);
  if (!s || !isAdmin(env, s.email)) return reply({ error: "session" }, 401, allowed);
  if (!env.MAKE_PASSWORD) return reply({ error: "config" }, 503, allowed);
  if (env.RATE && !(await bump(env.RATE, `ag:${await sha256(s.token)}:${Math.floor(Date.now() / 3_600_000)}`, 12, 3600))) {
    return reply({ error: "limite" }, 429, allowed);
  }
  const email = env.MAKE_OWNER_EMAIL || "tristan.buttig1@gmail.com";
  try {
    const res = await fetch(MAKE_HOOK, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "login", email, password: env.MAKE_PASSWORD }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data && data.token) return reply({ ok: true, email, token: String(data.token) }, 200, allowed);
    return reply({ error: "refus" }, 502, allowed);
  } catch {
    return reply({ error: "make" }, 502, allowed);
  }
}

// Devis et lien de paiement : le Worker interroge Make avec le mot de passe de la gestion, que le navigateur ne voit jamais.
async function askQuote(env, email) {
  try {
    const res = await fetch(MAKE_HOOK, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "payer", email, password: env.MAKE_PASSWORD }),
    });
    const d = await res.json().catch(() => null);
    if (!res.ok || !d || d.ok === false) return null;
    const pick = (v) => String(v ?? "").slice(0, 500);
    return {
      url: pick(d.url),
      montant: pick(d.montant),
      etat: pick(d.etat),
      nom: pick(d.nom),
      projet: pick(d.projet),
      cree: pick(d.cree),
      detail: pick(d.detail),
      regle: pick(d.regle),
    };
  } catch {
    return null;
  }
}

async function quoteReply(env, email, bucket, limit, allowed, reply) {
  if (!env.MAKE_PASSWORD) return reply({ error: "config" }, 503, allowed);
  if (env.RATE && !(await bump(env.RATE, `dv:${bucket}:${Math.floor(Date.now() / 3_600_000)}`, limit, 3600))) {
    return reply({ error: "limite" }, 429, allowed);
  }
  const devis = await askQuote(env, email);
  if (!devis) return reply({ error: "make" }, 502, allowed);
  return reply({ ok: true, ...devis }, 200, allowed);
}

// Client connecté : son devis, d'après l'adresse de sa session.
async function handleMyQuote(request, env, allowed, reply) {
  const s = await sessionOf(request, env);
  if (!s) return reply({ error: "session" }, 401, allowed);
  return quoteReply(env, s.email, await sha256(s.token), 60, allowed, reply);
}

// Visiteur du tunnel : le brief qu'il vient d'envoyer (identifiant aléatoire) tient lieu de clé.
async function handleBriefQuote(request, env, id, allowed, reply) {
  if (!env.BRIEFS || !TOKEN_RE.test(id)) return reply({ error: "introuvable" }, 404, allowed);
  let record = null;
  try {
    record = JSON.parse((await env.BRIEFS.get(`b:${id}`)) || "null");
  } catch {}
  if (!record || !record.email) return reply({ error: "introuvable" }, 404, allowed);
  const ip = request.headers.get("cf-connecting-ip") || "inconnue";
  return quoteReply(env, record.email, `ip:${ip}`, 30, allowed, reply);
}

// Dépôt de rushes : le Worker demande à Make l'espace d'envoi (Frame.io) pour l'adresse de la session.
// Le navigateur envoie ensuite le fichier directement aux adresses fournies.
const clean = (v, n) => String(v ?? "").replace(/[\u0000-\u001f\u007f/\\]+/g, " ").trim().slice(0, n);

async function handleRushes(request, env, allowed, reply) {
  const s = await sessionOf(request, env);
  if (!s) return reply({ error: "session" }, 401, allowed);
  if (!env.MAKE_PASSWORD) return reply({ error: "config" }, 503, allowed);
  const { input: d, res } = await parse(request, 2000, reply, allowed);
  if (res) return res;
  const size = Number(d.size);
  const stem = clean(d.stem, 120);
  const ext = /^\.[A-Za-z0-9]{1,8}$/.test(String(d.ext || "")) ? String(d.ext) : "";
  if (!Number.isInteger(size) || size < 1 || size > 100e9 || !stem) return reply({ error: "validation" }, 422, allowed);
  if (env.RATE && !(await bump(env.RATE, `rs:${await sha256(s.token)}:${Math.floor(Date.now() / 3_600_000)}`, 120, 3600))) {
    return reply({ error: "limite" }, 429, allowed);
  }
  const slug = /^[a-z0-9-]{1,60}$/.test(String(d.slug || ""))
    ? String(d.slug)
    : s.email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 60) || "client";
  try {
    const made = await fetch(MAKE_HOOK, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "rushes",
        email: s.email,
        password: env.MAKE_PASSWORD,
        nom: clean(d.nom, 120),
        slug,
        stem,
        ext,
        size: String(size),
        type: clean(d.type, 100),
      }),
    });
    const data = await made.json().catch(() => null);
    if (!made.ok || !data || data.ok !== true) return reply({ ok: false }, 200, allowed);
    return reply({ ok: true, name: data.name, type: data.type, parts: data.parts, file: data.file }, 200, allowed);
  } catch {
    return reply({ error: "make" }, 502, allowed);
  }
}

async function handleList(request, env, allowed, reply) {
  const s = await sessionOf(request, env);
  if (!s || !isAdmin(env, s.email)) return reply({ error: "session" }, 401, allowed);
  const idx = await readIndex(env);
  const projets = [];
  for (const email of idx) {
    const p = await readProject(env, email);
    projets.push({ email, titre: p.titre, etat: p.etat, delai: p.delai, clos: p.clos === true, factureNom: p.factureNom, hasFacture: Boolean(p.facture), maj: p.maj });
  }
  return reply({ ok: true, projets }, 200, allowed);
}

// Renvoie une Response si le chemin est géré ici, sinon null.
export async function handleAuth(request, env, ctx, allowed, path, reply) {
  const m = request.method;
  if (!path.startsWith("/auth/") && !path.startsWith("/moi") && !path.startsWith("/admin/") && !path.startsWith("/devis/")) return null;
  if (!allowed) return reply({ error: "origin" }, 403, "");
  if (m === "POST" && path === "/auth/demande") {
    if (!env.RESEND_API_KEY) return reply({ error: "config" }, 500, allowed);
    return handleRequest(request, env, ctx, allowed, reply);
  }
  if (m === "POST" && path === "/auth/verification") return handleVerify(request, env, ctx, allowed, reply);
  if (m === "POST" && path === "/auth/deconnexion") return handleLogout(request, env, allowed, reply);
  if (m === "GET" && path === "/moi") return handleMe(request, env, allowed, reply);
  if (m === "POST" && path === "/moi/rushes") return handleRushes(request, env, allowed, reply);
  if (m === "GET" && path === "/moi/devis") return handleMyQuote(request, env, allowed, reply);
  if (m === "GET" && path.startsWith("/devis/")) return handleBriefQuote(request, env, path.slice("/devis/".length), allowed, reply);
  if (m === "POST" && path === "/admin/projet") return handleSave(request, env, allowed, reply);
  if (m === "POST" && path === "/admin/gestion") return handleGestion(request, env, allowed, reply);
  if (m === "GET" && path === "/admin/projets") return handleList(request, env, allowed, reply);
  if (m === "GET" && path === "/admin/factures") return handleInvoices(request, env, allowed, reply);
  if (m === "GET" && path.startsWith("/admin/facture/")) return handleInvoice(request, env, path.slice("/admin/facture/".length), allowed, reply);
  return reply({ error: "method" }, 405, allowed);
}
