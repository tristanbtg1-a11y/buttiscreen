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
