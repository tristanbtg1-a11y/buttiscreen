// Tests du Worker d'envoi du brief, avec un Resend simulé.
// Lancer : node --test worker/contact.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import worker, { validate, buildMail, buildConfirmation } from "./contact.js";

const ORIGIN = "https://buttiscreen.fr";
const ENV = { RESEND_API_KEY: "re_test", MAIL_TO: "contact@buttiscreen.fr", MAIL_FROM: "Buttiscreen <brief@buttiscreen.fr>" };

const brief = (over = {}) => ({
  nom: "Camille Durand",
  email: "camille@example.com",
  projet: "Clip",
  message: "Un clip de trois minutes, tourné en deux jours.",
  website: "",
  t: Date.now() - 10_000,
  ...over,
});

const post = (body, { origin = ORIGIN, env = ENV, raw } = {}) =>
  worker.fetch(
    new Request("https://worker.example/", {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: raw ?? JSON.stringify(body),
    }),
    env
  );

function mockResend(status = 200) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    const code = Array.isArray(status) ? status[Math.min(calls.length - 1, status.length - 1)] : status;
    return new Response("{}", { status: code });
  };
  return { calls, restore: () => (globalThis.fetch = original) };
}

test("envoi normal : un appel à Resend, réponse ok", async () => {
  const resend = mockResend();
  try {
    const res = await post(brief());
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
    assert.equal(resend.calls.length, 1);
    assert.equal(resend.calls[0].url, "https://api.resend.com/emails");
    assert.equal(resend.calls[0].init.headers.authorization, "Bearer re_test");
    assert.equal(resend.calls[0].body.reply_to, "camille@example.com");
    assert.deepEqual(resend.calls[0].body.to, ["contact@buttiscreen.fr"]);
    assert.equal(res.headers.get("access-control-allow-origin"), ORIGIN);
  } finally {
    resend.restore();
  }
});

test("champ piège rempli : succès apparent, aucun envoi", async () => {
  const resend = mockResend();
  try {
    const res = await post(brief({ website: "http://spam.example" }));
    assert.equal(res.status, 200);
    assert.equal(resend.calls.length, 0);
  } finally {
    resend.restore();
  }
});

test("envoi trop rapide : aucun envoi", async () => {
  const resend = mockResend();
  try {
    const res = await post(brief({ t: Date.now() - 300 }));
    assert.equal(res.status, 200);
    assert.equal(resend.calls.length, 0);
  } finally {
    resend.restore();
  }
});

test("horodatage absent ou invalide : traité comme un robot", () => {
  assert.equal(validate(brief({ t: undefined })).bot, true);
  assert.equal(validate(brief({ t: "abc" })).bot, true);
});

test("e-mail invalide : 422 avec le champ en cause", async () => {
  const resend = mockResend();
  try {
    const res = await post(brief({ email: "pas-un-email" }));
    assert.equal(res.status, 422);
    const json = await res.json();
    assert.ok(json.fields.email);
    assert.equal(resend.calls.length, 0);
  } finally {
    resend.restore();
  }
});

test("type de projet inconnu et message trop court : 422", async () => {
  const res = await post(brief({ projet: "Autre chose", message: "court" }));
  assert.equal(res.status, 422);
  const json = await res.json();
  assert.ok(json.fields.projet && json.fields.message);
});

test("origine étrangère : 403, aucun envoi", async () => {
  const resend = mockResend();
  try {
    const res = await post(brief(), { origin: "https://evil.example" });
    assert.equal(res.status, 403);
    assert.equal(resend.calls.length, 0);
  } finally {
    resend.restore();
  }
});

test("ALLOWED_ORIGINS permet un test local", async () => {
  const resend = mockResend();
  try {
    const res = await post(brief(), { origin: "http://localhost:4173", env: { ...ENV, ALLOWED_ORIGINS: "http://localhost:4173" } });
    assert.equal(res.status, 200);
    assert.equal(resend.calls.length, 1);
  } finally {
    resend.restore();
  }
});

test("panne Resend : 502", async () => {
  const resend = mockResend(500);
  try {
    const res = await post(brief());
    assert.equal(res.status, 502);
    assert.deepEqual(await res.json(), { error: "send" });
  } finally {
    resend.restore();
  }
});

test("clé absente : 500 sans appel à Resend", async () => {
  const resend = mockResend();
  try {
    const res = await post(brief(), { env: { ...ENV, RESEND_API_KEY: "" } });
    assert.equal(res.status, 500);
    assert.equal(resend.calls.length, 0);
  } finally {
    resend.restore();
  }
});

test("JSON invalide : 400 ; corps trop gros : 413", async () => {
  assert.equal((await post(null, { raw: "{pas du json" })).status, 400);
  assert.equal((await post(null, { raw: JSON.stringify({ message: "x".repeat(21_000) }) })).status, 413);
});

test("méthode GET : 405 ; préflight OPTIONS : 204 avec CORS", async () => {
  const get = await worker.fetch(new Request("https://worker.example/", { headers: { origin: ORIGIN } }), ENV);
  assert.equal(get.status, 405);
  const opt = await worker.fetch(new Request("https://worker.example/", { method: "OPTIONS", headers: { origin: ORIGIN } }), ENV);
  assert.equal(opt.status, 204);
  assert.equal(opt.headers.get("access-control-allow-origin"), ORIGIN);
});

test("contenu échappé dans le HTML, sauts de ligne neutralisés dans le sujet", () => {
  const v = validate(brief({ nom: "Eve\r\nBcc: x@y.z", message: '<script>alert("x")</script> et du texte' }));
  const mail = buildMail(v.data, ENV);
  assert.ok(!mail.html.includes("<script>"));
  assert.ok(mail.html.includes("&lt;script&gt;"));
  assert.ok(!/[\r\n]/.test(mail.subject));
});

// --- Accusé de réception au visiteur ---

const fakeKv = () => {
  const m = new Map();
  return { get: async (k) => m.get(k) ?? null, put: async (k, v) => void m.set(k, v), size: () => m.size };
};
const withKv = (over = {}) => ({ ...ENV, RATE: fakeKv(), ...over });
const postFrom = (body, env, ip = "203.0.113.7") =>
  worker.fetch(
    new Request("https://worker.example/", {
      method: "POST",
      headers: { origin: ORIGIN, "content-type": "application/json", "cf-connecting-ip": ip },
      body: JSON.stringify(body),
    }),
    env
  );

test("accusé : deuxième mail vers le visiteur, avec récapitulatif et réponse vers le studio", async () => {
  const resend = mockResend();
  try {
    const res = await postFrom(brief({ message: "Un clip <b>de</b> trois minutes." }), withKv());
    assert.equal(res.status, 200);
    assert.equal(resend.calls.length, 2);
    assert.deepEqual(resend.calls[0].body.to, ["contact@buttiscreen.fr"]);
    const ack = resend.calls[1].body;
    assert.deepEqual(ack.to, ["camille@example.com"]);
    assert.equal(ack.reply_to, "contact@buttiscreen.fr");
    assert.equal(ack.from, "Buttiscreen <brief@buttiscreen.fr>");
    assert.equal(ack.headers["Auto-Submitted"], "auto-replied");
    assert.ok(ack.text.includes("Projet : Clip") && ack.text.includes("sous 48 heures ouvrées"));
    assert.ok(ack.html.includes("Camille Durand") && ack.html.includes("&lt;b&gt;de&lt;/b&gt;"));
    assert.ok(!ack.html.includes("<b>de</b>"));
  } finally {
    resend.restore();
  }
});

test("accusé : sans KV lié, aucun accusé (le brief part quand même)", async () => {
  const resend = mockResend();
  try {
    const res = await postFrom(brief(), ENV);
    assert.equal(res.status, 200);
    assert.equal(resend.calls.length, 1);
  } finally {
    resend.restore();
  }
});

test("accusé : CONFIRMATION=off coupe l'accusé", async () => {
  const resend = mockResend();
  try {
    await postFrom(brief(), withKv({ CONFIRMATION: "off" }));
    assert.equal(resend.calls.length, 1);
  } finally {
    resend.restore();
  }
});

test("accusé : une seule fois par adresse et par jour, majuscules comprises", async () => {
  const resend = mockResend();
  const env = withKv();
  try {
    await postFrom(brief(), env);
    await postFrom(brief({ email: "CAMILLE@example.com" }), env);
    assert.equal(resend.calls.length, 3); // 2 briefs + 1 seul accusé
  } finally {
    resend.restore();
  }
});

test("accusé : au plus 5 par IP et par heure", async () => {
  const resend = mockResend();
  const env = withKv();
  try {
    for (let i = 0; i < 7; i++) await postFrom(brief({ email: `v${i}@example.com` }), env, "198.51.100.9");
    const acks = resend.calls.filter((c) => c.body.to[0] !== "contact@buttiscreen.fr");
    assert.equal(acks.length, 5);
  } finally {
    resend.restore();
  }
});

test("accusé : un échec de l'accusé ne fait pas échouer le brief", async () => {
  const resend = mockResend([200, 500]);
  try {
    const res = await postFrom(brief(), withKv());
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
    assert.equal(resend.calls.length, 2);
  } finally {
    resend.restore();
  }
});

test("accusé : pas d'accusé pour un robot ni pour un brief refusé", async () => {
  const resend = mockResend();
  try {
    await postFrom(brief({ website: "x" }), withKv());
    await postFrom(brief({ email: "pas-un-email" }), withKv());
    assert.equal(resend.calls.length, 0);
  } finally {
    resend.restore();
  }
});

test("accusé : délai réglable, sujet sans saut de ligne", () => {
  const v = validate(brief({ nom: "Eve\r\nBcc: x@y.z" }));
  const mail = buildConfirmation(v.data, { ...ENV, REPLY_DELAY: "24 heures ouvrées" });
  assert.ok(mail.text.includes("sous 24 heures ouvrées"));
  assert.ok(!/[\r\n]/.test(mail.subject));
  assert.ok(!mail.html.includes("\r"));
});
