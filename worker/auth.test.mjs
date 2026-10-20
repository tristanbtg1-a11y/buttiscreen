// Tests de la connexion par lien et du suivi projet. Lancer : node --test worker/
import test from "node:test";
import assert from "node:assert/strict";
import worker from "./contact.js";
import { buildLoginMail } from "./auth.js";

const ORIGIN = "https://buttiscreen.fr";
const kv = () => {
  const m = new Map();
  return {
    get: async (k) => m.get(k) ?? null,
    put: async (k, v) => void m.set(k, v),
    delete: async (k) => void m.delete(k),
    keys: () => [...m.keys()],
  };
};
const env = () => ({
  RESEND_API_KEY: "re_test",
  MAIL_TO: "contact@buttiscreen.fr",
  ADMIN_EMAILS: "Tristan@buttiscreen.fr",
  RATE: kv(),
  BRIEFS: kv(),
});
const call = (path, { method = "POST", body, token, origin = ORIGIN, e, ip = "203.0.113.9" } = {}) =>
  worker.fetch(
    new Request("https://worker.example" + path, {
      method,
      headers: {
        ...(origin ? { origin } : {}),
        "content-type": "application/json",
        "cf-connecting-ip": ip,
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: method === "GET" ? undefined : JSON.stringify(body),
    }),
    e
  );
function mockResend() {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return new Response("{}", { status: 200 });
  };
  return { calls, restore: () => (globalThis.fetch = original) };
}
const demande = (email, extra = {}) => ({ email, website: "", t: Date.now() - 10_000, ...extra });
const tokenOf = (mail) => mail.body.text.match(/#connexion=([0-9a-f]{32})/)?.[1];

async function login(e, email, page) {
  const r = mockResend();
  try {
    await call("/auth/demande", { body: demande(email, page ? { page } : {}), e, ip: "198.51.100." + Math.floor(Math.random() * 200) });
    const token = tokenOf(r.calls[0]);
    const res = await call("/auth/verification", { body: { token }, e });
    return { res, json: await res.json(), token };
  } finally {
    r.restore();
  }
}

test("lien : un e-mail reçoit un lien valable, réponse neutre", async () => {
  const e = env();
  const r = mockResend();
  try {
    const res = await call("/auth/demande", { body: demande("Camille@Example.com"), e });
    assert.deepEqual(await res.json(), { ok: true });
    assert.equal(r.calls.length, 1);
    assert.deepEqual(r.calls[0].body.to, ["camille@example.com"]);
    assert.match(r.calls[0].body.text, /commande\.html#connexion=[0-9a-f]{32}/);
  } finally {
    r.restore();
  }
});

test("lien : robot, adresse invalide, origine étrangère, limites", async () => {
  const e = env();
  const r = mockResend();
  try {
    await call("/auth/demande", { body: demande("a@b.fr", { website: "x" }), e });
    await call("/auth/demande", { body: demande("a@b.fr", { t: Date.now() }), e });
    assert.equal(r.calls.length, 0);
    assert.equal((await call("/auth/demande", { body: demande("pas-un-mail"), e })).status, 422);
    assert.equal((await call("/auth/demande", { body: demande("a@b.fr"), e, origin: "https://evil.example" })).status, 403);
    for (let i = 0; i < 5; i++) await call("/auth/demande", { body: demande("m@x.fr"), e });
    assert.equal(r.calls.length, 3); // 3 par adresse et par heure
  } finally {
    r.restore();
  }
});

test("session : le jeton ne sert qu'une fois, la session ouvre /moi", async () => {
  const e = env();
  const r = mockResend();
  try {
    await call("/auth/demande", { body: demande("client@example.com"), e });
    const token = tokenOf(r.calls[0]);
    const ok = await (await call("/auth/verification", { body: { token }, e })).json();
    assert.equal(ok.ok, true);
    assert.equal(ok.email, "client@example.com");
    assert.equal(ok.admin, false);
    assert.equal((await call("/auth/verification", { body: { token }, e })).status, 400);
    const me = await (await call("/moi", { method: "GET", token: ok.session, e })).json();
    assert.equal(me.email, "client@example.com");
    assert.equal(me.projet.etat, "brief");
    assert.equal(me.brief, null);
  } finally {
    r.restore();
  }
});

test("session : sans jeton valide, 401 ; jeton mal formé refusé", async () => {
  const e = env();
  assert.equal((await call("/moi", { method: "GET", e })).status, 401);
  assert.equal((await call("/moi", { method: "GET", token: "0".repeat(32), e })).status, 401);
  assert.equal((await call("/auth/verification", { body: { token: "nope" }, e })).status, 400);
});

test("déconnexion : la session n'est plus valable", async () => {
  const e = env();
  const { json } = await login(e, "client@example.com");
  await call("/auth/deconnexion", { token: json.session, body: {}, e });
  assert.equal((await call("/moi", { method: "GET", token: json.session, e })).status, 401);
});

test("atelier : lien réservé aux adresses admin, écriture du suivi, lecture par le client", async () => {
  const e = env();
  const r = mockResend();
  try {
    await call("/auth/demande", { body: demande("tiers@example.com", { page: "atelier" }), e });
    assert.equal(r.calls.length, 0);
  } finally {
    r.restore();
  }
  const admin = (await login(e, "tristan@buttiscreen.fr", "atelier")).json;
  assert.equal(admin.admin, true);
  const client = (await login(e, "client@example.com")).json;
  assert.equal((await call("/admin/projet", { token: client.session, body: { email: "client@example.com", etat: "montage" }, e })).status, 401);
  const save = await call("/admin/projet", {
    token: admin.session,
    body: { email: "Client@Example.com", titre: "Film de marque", etat: "montage", delai: "2026-11-15", facture: "data:application/pdf;base64,JVBERi0=", factureNom: "facture.pdf" },
    e,
  });
  assert.equal(save.status, 200);
  const me = await (await call("/moi", { method: "GET", token: client.session, e })).json();
  assert.equal(me.projet.titre, "Film de marque");
  assert.equal(me.projet.etat, "montage");
  assert.equal(me.projet.factureNom, "facture.pdf");
  assert.match(me.projet.facture, /^data:application\/pdf/);
  const list = await (await call("/admin/projets", { method: "GET", token: admin.session, e })).json();
  assert.equal(list.projets.length, 1);
  assert.equal(list.projets[0].email, "client@example.com");
  assert.equal((await call("/admin/projets", { method: "GET", token: client.session, e })).status, 401);
});

test("atelier : état, facture et adresse invalides refusés ; champs absents conservés", async () => {
  const e = env();
  const admin = (await login(e, "tristan@buttiscreen.fr", "atelier")).json;
  const post = (body) => call("/admin/projet", { token: admin.session, body, e });
  assert.equal((await post({ email: "c@x.fr", etat: "inconnu" })).status, 422);
  assert.equal((await post({ email: "pas-un-mail" })).status, 422);
  assert.equal((await post({ email: "c@x.fr", facture: "data:text/html;base64,AAAA" })).status, 422);
  await post({ email: "c@x.fr", titre: "Clip", etat: "montage" });
  await post({ email: "c@x.fr", delai: "2026-12-01" });
  const client = (await login(e, "c@x.fr")).json;
  const me = await (await call("/moi", { method: "GET", token: client.session, e })).json();
  assert.equal(me.projet.titre, "Clip");
  assert.equal(me.projet.etat, "montage");
  assert.equal(me.projet.delai, "2026-12-01");
});

test("/moi : renvoie le dernier brief de l'adresse", async () => {
  const e = env();
  const r = mockResend();
  try {
    await call("/", {
      body: { nom: "Camille Durand", email: "camille@example.com", projet: "Clip", message: "Un clip de trois minutes.", website: "", t: Date.now() - 10_000 },
      e,
    });
  } finally {
    r.restore();
  }
  const { json } = await login(e, "camille@example.com");
  const me = await (await call("/moi", { method: "GET", token: json.session, e })).json();
  assert.equal(me.brief.projet, "Clip");
  assert.match(me.brief.message, /clip de trois minutes/);
});

test("sans KV BRIEFS : connexion silencieuse, aucun envoi", async () => {
  const e = { ...env(), BRIEFS: undefined };
  const r = mockResend();
  try {
    const res = await call("/auth/demande", { body: demande("a@b.fr"), e });
    assert.equal(res.status, 200);
    assert.equal(r.calls.length, 0);
  } finally {
    r.restore();
  }
});

test("mail de connexion : lien vers la bonne page, adresse échappée", () => {
  const m = buildLoginMail("a@b.fr", "0".repeat(32), "atelier", {});
  assert.match(m.text, /atelier\.html#connexion=/);
  assert.match(m.html, /atelier\.html#connexion=/);
  assert.equal(m.subject.includes("\n"), false);
});

test("gestion : la session studio obtient le jeton de Make, un client non", async () => {
  const e = { ...env(), MAKE_PASSWORD: "secret-make" };
  const admin = (await login(e, "tristan@buttiscreen.fr", "gestion")).json;
  const client = (await login(e, "client@example.com")).json;
  assert.equal((await call("/admin/gestion", { token: client.session, body: {}, e })).status, 401);
  const original = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (url, init) => {
    seen.push({ url, body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ ok: true, token: "tok123" }), { status: 200 });
  };
  try {
    const res = await call("/admin/gestion", { token: admin.session, body: {}, e });
    assert.deepEqual(await res.json(), { ok: true, email: "tristan.buttig1@gmail.com", token: "tok123" });
    assert.match(seen[0].url, /hook\.eu1\.make\.com/);
    assert.equal(seen[0].body.action, "login");
    assert.equal(seen[0].body.password, "secret-make");
  } finally {
    globalThis.fetch = original;
  }
});

test("gestion : sans MAKE_PASSWORD, 503 ; refus de Make, 502 ; lien de gestion réservé au studio", async () => {
  const e = env();
  const admin = (await login(e, "tristan@buttiscreen.fr", "gestion")).json;
  assert.equal((await call("/admin/gestion", { token: admin.session, body: {}, e })).status, 503);
  const withPwd = { ...e, MAKE_PASSWORD: "x" };
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response('{"ok":false}', { status: 401 });
  try {
    assert.equal((await call("/admin/gestion", { token: admin.session, body: {}, e: withPwd })).status, 502);
  } finally {
    globalThis.fetch = original;
  }
  const r = mockResend();
  try {
    await call("/auth/demande", { body: demande("tiers@example.com", { page: "gestion" }), e });
    assert.equal(r.calls.length, 0);
    await call("/auth/demande", { body: demande("tristan@buttiscreen.fr", { page: "gestion" }), e, ip: "198.51.100.77" });
    assert.match(r.calls[0].body.text, /gestion\.html#connexion=/);
  } finally {
    r.restore();
  }
});

const quoteFetch = (answers) => {
  const original = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (url, init) => {
    seen.push({ url: String(url), body: JSON.parse(init.body) });
    return new Response(JSON.stringify(answers), { status: 200 });
  };
  return { seen, restore: () => (globalThis.fetch = original) };
};

test("devis : le client connecté reçoit son devis, Make reçoit l'adresse de sa session et le mot de passe", async () => {
  const e = { ...env(), MAKE_PASSWORD: "pw" };
  const client = (await login(e, "client@example.com")).json;
  const q = quoteFetch({ ok: true, url: "https://buy.stripe.com/x", montant: "450", etat: "brief", nom: "C", secret: "ne-doit-pas-sortir" });
  try {
    const res = await call("/moi/devis", { method: "GET", token: client.session, e });
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.url, "https://buy.stripe.com/x");
    assert.equal(body.montant, "450");
    assert.equal("secret" in body, false);
    assert.equal(q.seen[0].body.action, "payer");
    assert.equal(q.seen[0].body.email, "client@example.com");
    assert.equal(q.seen[0].body.password, "pw");
  } finally {
    q.restore();
  }
  assert.equal((await call("/moi/devis", { method: "GET", e })).status, 401);
});

test("devis : sans MAKE_PASSWORD, 503 ; refus de Make, 502", async () => {
  const e = env();
  const client = (await login(e, "client@example.com")).json;
  assert.equal((await call("/moi/devis", { method: "GET", token: client.session, e })).status, 503);
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response('{"ok":false}', { status: 200 });
  try {
    assert.equal((await call("/moi/devis", { method: "GET", token: client.session, e: { ...e, MAKE_PASSWORD: "pw" } })).status, 502);
  } finally {
    globalThis.fetch = original;
  }
});

test("devis du tunnel : l'identifiant du brief tient lieu de clé, un identifiant inconnu est refusé", async () => {
  const e = { ...env(), MAKE_PASSWORD: "pw" };
  const r = mockResend();
  let id;
  try {
    const res = await call("/tunnel", {
      body: { nom: "Camille Durand", email: "camille@example.com", projet: "Clip", message: "Un clip de trois minutes.", t: Date.now() - 10_000 },
      e,
    });
    id = (await res.json()).id;
    assert.match(id, /^[0-9a-f]{32}$/);
  } finally {
    r.restore();
  }
  const q = quoteFetch({ ok: true, url: "", montant: "", etat: "" });
  try {
    const res = await call(`/devis/${id}`, { method: "GET", e });
    assert.equal(res.status, 200);
    assert.equal(q.seen[0].body.email, "camille@example.com");
    assert.equal((await call(`/devis/${"0".repeat(32)}`, { method: "GET", e })).status, 404);
    assert.equal((await call("/devis/pas-un-id", { method: "GET", e })).status, 404);
    assert.equal((await call(`/devis/${id}`, { method: "GET", e, origin: "https://evil.example" })).status, 403);
  } finally {
    q.restore();
  }
});

test("rushes : l'espace d'envoi est demandé à Make pour l'adresse de la session, entrées nettoyées", async () => {
  const e = { ...env(), MAKE_PASSWORD: "pw" };
  const client = (await login(e, "client@example.com")).json;
  const q = quoteFetch({ ok: true, name: "c_rush_01_a.mov", type: "video/quicktime", parts: [{ url: "https://upload.example/1", size: 10 }], file: { data: { id: "f" } } });
  try {
    const res = await call("/moi/rushes", {
      token: client.session,
      body: { email: "autre@x.fr", nom: "Camille", slug: "camille", stem: "plan/../01\n", ext: ".mov", size: 10, type: "video/quicktime" },
      e,
    });
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.parts[0].url, "https://upload.example/1");
    const sent = q.seen[0].body;
    assert.equal(sent.action, "rushes");
    assert.equal(sent.email, "client@example.com"); // jamais l'adresse fournie par le navigateur
    assert.equal(sent.password, "pw");
    assert.equal(sent.slug, "camille");
    assert.equal(sent.stem.includes("/"), false);
    assert.equal(sent.size, "10");
  } finally {
    q.restore();
  }
});

test("rushes : sans session 401, entrée invalide 422, sans MAKE_PASSWORD 503, refus de Make renvoyé tel quel", async () => {
  const e = { ...env(), MAKE_PASSWORD: "pw" };
  const client = (await login(e, "client@example.com")).json;
  assert.equal((await call("/moi/rushes", { body: { stem: "a", size: 1 }, e })).status, 401);
  assert.equal((await call("/moi/rushes", { token: client.session, body: { stem: "a", size: 0 }, e })).status, 422);
  assert.equal((await call("/moi/rushes", { token: client.session, body: { stem: "", size: 5 }, e })).status, 422);
  assert.equal((await call("/moi/rushes", { token: client.session, body: { stem: "a", size: 5 }, e: { ...e, MAKE_PASSWORD: undefined } })).status, 503);
  const q = quoteFetch({ ok: false });
  try {
    const res = await call("/moi/rushes", { token: client.session, body: { stem: "a", ext: ".mov", size: 5 }, e });
    assert.deepEqual(await res.json(), { ok: false });
  } finally {
    q.restore();
  }
});

// Faux Resend + faux Make : `make` donne la réponse selon l'action ; tout est consigné.
const bothFetch = (make = {}) => {
  const original = globalThis.fetch;
  const resend = [];
  const made = [];
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    if (String(url).includes("resend.com")) {
      resend.push(body);
      return new Response("{}", { status: 200 });
    }
    made.push(body);
    const answer = make[body.action];
    return new Response(JSON.stringify(typeof answer === "function" ? answer(body) : answer ?? { ok: true }), { status: 200 });
  };
  return { resend, made, restore: () => (globalThis.fetch = original) };
};
const makeEnv = () => ({ ...env(), MAKE_PASSWORD: "pw" });

// Connexion complète sans remplacer le faux fetch en place (contrairement à login()).
async function loginKeep(f, e, email, page) {
  await call("/auth/demande", { body: demande(email, page ? { page } : {}), e, ip: "198.51.100." + Math.floor(Math.random() * 200) });
  const mail = [...f.resend].reverse().find((m) => /lien de connexion/.test(m.subject || ""));
  const res = await call("/auth/verification", { body: { token: tokenOf({ body: mail }) }, e });
  return res.json();
}

test("rendez-vous du tunnel : le Worker écrit la fiche chez Make avec le mot de passe", async () => {
  const e = makeEnv();
  const f = bothFetch();
  try {
    await call("/tunnel", {
      body: { nom: "Camille Durand", email: "Camille@Example.com", projet: "Clip", duree: "3 min", creneau: "mardi 10 h", message: "Un clip de trois minutes.", t: Date.now() - 10_000 },
      e,
    });
    const rdv = f.made.find((m) => m.action === "rdv");
    assert.equal(rdv.password, "pw");
    assert.equal(rdv.email, "Camille@Example.com");
    assert.equal(rdv.creneau, "mardi 10 h");
    assert.match(rdv.clef, /^rdv-camilleexamplecom-\d+$/);
  } finally {
    f.restore();
  }
  const g = bothFetch();
  try {
    await call("/tunnel", { body: { nom: "Camille Durand", email: "c@example.com", projet: "Clip", message: "Un clip de trois minutes.", t: Date.now() - 10_000 }, e: env(), ip: "198.51.100.1" });
    assert.equal(g.made.length, 0); // sans MAKE_PASSWORD, rien n'est écrit
  } finally {
    g.restore();
  }
});

test("suivi enregistré par le studio : la fiche commande part chez Make, statut close à la livraison", async () => {
  const e = makeEnv();
  const admin = (await login(e, "tristan@buttiscreen.fr", "atelier")).json;
  const f = bothFetch();
  try {
    await call("/admin/projet", { token: admin.session, body: { email: "c@x.fr", titre: "Film", etat: "montage", delai: "2026-12-01" }, e });
    await call("/admin/projet", { token: admin.session, body: { email: "c@x.fr", etat: "livraison" }, e });
    const fiches = f.made.filter((m) => m.action === "commande");
    assert.equal(fiches[0].clef, "cmd-cx" + "fr");
    assert.equal(fiches[0].etat, "montage");
    assert.equal(fiches[0].statut, "cours");
    assert.equal(fiches[0].nom, "Film");
    assert.equal(fiches[1].statut, "close");
    assert.equal(fiches[1].projet, "Film"); // le titre déjà connu est conservé
  } finally {
    f.restore();
  }
});

test("clôture à la main : statut close chez Make, conservé aux enregistrements suivants, annulable", async () => {
  const e = makeEnv();
  const admin = (await login(e, "tristan@buttiscreen.fr", "atelier")).json;
  const client = (await login(e, "c@x.fr")).json;
  const f = bothFetch();
  try {
    const post = (body) => call("/admin/projet", { token: admin.session, body: { email: "c@x.fr", ...body }, e });
    await post({ titre: "Film", etat: "montage" });
    await post({ clos: true });
    await post({ delai: "2026-12-01" }); // un enregistrement ordinaire ne rouvre pas le dossier
    const fiches = f.made.filter((m) => m.action === "commande");
    assert.deepEqual(fiches.map((m) => m.statut), ["cours", "close", "close"]);
    assert.equal(fiches[1].etat, "montage"); // l'état vu par le client ne bouge pas
    const list = await (await call("/admin/projets", { method: "GET", token: admin.session, e })).json();
    assert.equal(list.projets[0].clos, true);
    await post({ clos: false });
    assert.equal(f.made.filter((m) => m.action === "commande").at(-1).statut, "cours");
    assert.equal((await call("/admin/projet", { token: client.session, body: { email: "c@x.fr", clos: true }, e })).status, 401);
  } finally {
    f.restore();
  }
});

test("première connexion client : mail au studio, fiche créée seulement si la gestion ne la connaît pas", async () => {
  const e = makeEnv();
  const f = bothFetch({ login: { ok: true, token: "T" }, list: { ok: true, items: [] } });
  try {
    await loginKeep(f, e, "nouveau@example.com");
    assert.equal(f.resend.some((m) => /Nouveau compte client — nouveau@example\.com/.test(m.subject)), true);
    assert.deepEqual(f.made.map((m) => m.action), ["login", "list", "commande"]);
    assert.equal(f.made[2].etat, "brief");
    assert.equal(f.made[1].token, "T");
  } finally {
    f.restore();
  }
});

test("première connexion : fiche déjà connue de la gestion ou liste illisible, rien n'est écrasé ; pas de répétition", async () => {
  const e = makeEnv();
  const known = bothFetch({ login: { ok: true, token: "T" }, list: { ok: true, items: [{ kind: "commande", email: "Ancien@Example.com", etat: "montage" }] } });
  try {
    await loginKeep(known, e, "ancien@example.com");
    assert.equal(known.made.some((m) => m.action === "commande"), false);
  } finally {
    known.restore();
  }
  const broken = bothFetch({ login: { ok: true, token: "T" }, list: { ok: false } });
  try {
    await loginKeep(broken, e, "autre@example.com");
    assert.equal(broken.made.some((m) => m.action === "commande"), false);
  } finally {
    broken.restore();
  }
  const again = bothFetch({ login: { ok: true, token: "T" }, list: { ok: true, items: [] } });
  try {
    await loginKeep(again, e, "ancien@example.com");
    assert.equal(again.made.length, 0); // déjà accueilli
    assert.equal(again.resend.filter((m) => /Nouveau compte/.test(m.subject || "")).length, 0);
  } finally {
    again.restore();
  }
});

test("première connexion : suivi déjà créé par le studio, ou connexion du studio : aucune fiche", async () => {
  const e = makeEnv();
  const admin = (await login(e, "tristan@buttiscreen.fr", "atelier")).json;
  const f = bothFetch({ login: { ok: true, token: "T" }, list: { ok: true, items: [] } });
  try {
    await call("/admin/projet", { token: admin.session, body: { email: "suivi@example.com", titre: "Clip" }, e });
    f.made.length = 0;
    await loginKeep(f, e, "suivi@example.com");
    assert.equal(f.made.length, 0);
    await loginKeep(f, e, "tristan@buttiscreen.fr", "atelier");
    assert.equal(f.resend.some((m) => /Nouveau compte client — tristan/.test(m.subject || "")), false);
  } finally {
    f.restore();
  }
});
