// Cloudflare Worker : reçoit le brief du formulaire de l'accueil et l'envoie par Resend.
// Variables : RESEND_API_KEY (secret), MAIL_TO, MAIL_FROM, ALLOWED_ORIGINS (facultatif, séparées par des virgules).
// Accusé de réception au visiteur : actif seulement si le KV « RATE » est lié (limite par adresse et par IP).
// REPLY_DELAY règle le délai annoncé, CONFIRMATION="off" coupe l'accusé.
// Copie du brief consultable depuis n'importe quel appareil : KV « BRIEFS », 90 jours, accès par lien personnel.

import { handleAuth, pushRdv } from "./auth.js";

const MAX = { nom: 120, email: 254, projet: 60, message: 6000 };
const PROJETS = ["Spot / publicité", "Clip", "Film / documentaire", "Réseaux sociaux", "Étalonnage seul", "Autre"];
const MIN_FILL_MS = 2500;
const DEFAULT_DELAY = "48 heures ouvrées";
const SITE = "https://buttiscreen.fr";
const PER_IP_PER_HOUR = 5;
const BRIEF_TTL = 90 * 86400;
const ID_RE = /^[0-9a-f]{32}$/;

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const oneLine = (s) => String(s).replace(/[\r\n\t]+/g, " ").trim();

function origins(env) {
  const base = ["https://buttiscreen.fr", "https://www.buttiscreen.fr"];
  const extra = (env.ALLOWED_ORIGINS || "").split(",").map((o) => o.trim()).filter(Boolean);
  return [...base, ...extra];
}

function reply(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": origin || "null",
      vary: "Origin",
      "cache-control": "no-store",
    },
  });
}

export function validate(input, now = Date.now()) {
  const d = input && typeof input === "object" ? input : {};
  const nom = oneLine(d.nom ?? "");
  const email = oneLine(d.email ?? "");
  const projet = oneLine(d.projet ?? "");
  const message = String(d.message ?? "").trim();
  const errors = {};
  if (nom.length < 2 || nom.length > MAX.nom) errors.nom = "Indiquez votre nom.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > MAX.email) errors.email = "Indiquez un e-mail valide.";
  if (!PROJETS.includes(projet)) errors.projet = "Choisissez un type de projet.";
  if (message.length < 10 || message.length > MAX.message) errors.message = "Écrivez quelques lignes sur le film.";
  const bot = Boolean(d.website) || !(now - Number(d.t) >= MIN_FILL_MS);
  return { ok: !Object.keys(errors).length, bot, errors, data: { nom, email, projet, message } };
}

export function buildMail(data, env) {
  const { nom, email, projet, message } = data;
  return {
    from: env.MAIL_FROM || "Buttiscreen <brief@buttiscreen.fr>",
    to: [env.MAIL_TO || "contact@buttiscreen.fr"],
    reply_to: email,
    subject: `Brief — ${projet} — ${nom}`.slice(0, 200),
    text: `Nom : ${nom}\nE-mail : ${email}\nProjet : ${projet}\n\n${message}`,
    html:
      `<p><strong>Nom</strong> : ${esc(nom)}<br><strong>E-mail</strong> : ${esc(email)}<br>` +
      `<strong>Projet</strong> : ${esc(projet)}</p><p style="white-space:pre-wrap">${esc(message)}</p>`,
  };
}

export function buildConfirmation(data, env, id) {
  const { nom, email, projet, message } = data;
  const link = id ? `${SITE}/commande.html#brief=${id}` : "";
  const delay = oneLine(env.REPLY_DELAY || DEFAULT_DELAY);
  const contact = env.MAIL_TO || "contact@buttiscreen.fr";
  const text = [
    `Bonjour ${nom},`,
    "",
    "Nous avons bien reçu votre brief, merci de votre confiance.",
    `Nous le lisons avec attention et revenons vers vous personnellement sous ${delay}.`,
    "",
    "Votre brief",
    `Projet : ${projet}`,
    `E-mail : ${email}`,
    ...(data.duree ? [`Durée : ${data.duree}`] : []),
    ...(data.diffusion ? [`Diffusion : ${data.diffusion}`] : []),
    ...(data.creneau ? [`Créneau : ${data.creneau}`] : []),
    "",
    message,
    "",
    "Pour le compléter (références, rushes, date de livraison), répondez simplement à ce message.",
    ...(link ? ["", "Retrouvez votre brief depuis n'importe quel appareil : " + link] : []),
    "",
    "Ceci est un accusé de réception automatique. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message ou écrivez à " + contact + ".",
    "",
    "BUTTISCREEN · Studio de montage vidéo · Paris",
    SITE,
  ].join("\n");
  const row = (label, value) =>
    `<tr><td style="padding:6px 16px 6px 0;color:#7a7488;font-size:13px;vertical-align:top;white-space:nowrap">${label}</td>` +
    `<td style="padding:6px 0;color:#1b1826;font-size:15px;vertical-align:top">${value}</td></tr>`;
  const html =
    `<!doctype html><html lang="fr"><body style="margin:0;padding:0;background:#efedf3">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#efedf3"><tr><td align="center" style="padding:24px 12px">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff">` +
    `<tr><td style="background:#07060d;padding:20px 28px;border-bottom:3px solid #ff6a00">` +
    `<img src="${SITE}/logo-mail.png" width="44" height="44" alt="" style="display:inline-block;vertical-align:middle;border:0">` +
    `<span style="display:inline-block;vertical-align:middle;margin-left:14px;color:#f4f1fa;font:600 15px Helvetica,Arial,sans-serif;letter-spacing:3px">BUTTISCREEN</span></td></tr>` +
    `<tr><td style="padding:32px 28px 8px;font-family:Helvetica,Arial,sans-serif;color:#1b1826">` +
    `<p style="margin:0 0 18px;font-size:16px">Bonjour ${esc(nom)},</p>` +
    `<h1 style="margin:0 0 14px;font:600 22px Georgia,'Times New Roman',serif;color:#07060d">Votre brief est bien reçu.</h1>` +
    `<p style="margin:0 0 24px;font-size:15px;line-height:1.6">Nous le lisons avec attention et revenons vers vous personnellement sous ${esc(delay)}.</p>` +
    `<p style="margin:0 0 8px;font-size:11px;letter-spacing:2px;color:#ff6a00;font-weight:600">VOTRE BRIEF</p>` +
    `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 12px">${row("Projet", esc(projet))}${row("E-mail", esc(email))}${data.duree ? row("Durée", esc(data.duree)) : ""}${data.diffusion ? row("Diffusion", esc(data.diffusion)) : ""}${data.creneau ? row("Créneau", esc(data.creneau)) : ""}</table>` +
    `<div style="margin:0 0 24px;padding:14px 16px;background:#f6f5f9;border-left:3px solid #d9d4e6;font-size:15px;line-height:1.6;white-space:pre-wrap">${esc(message)}</div>` +
    `<p style="margin:0 0 20px;font-size:15px;line-height:1.6">Pour le compléter (références, rushes, date de livraison), répondez simplement à ce message.</p>` +
    (link
      ? `<p style="margin:0 0 28px"><a href="${esc(link)}" style="display:inline-block;padding:12px 22px;background:#ff6a00;color:#07060d;text-decoration:none;font:600 14px Helvetica,Arial,sans-serif">Retrouver mon brief</a></p>`
      : `<div style="height:8px"></div>`) +
    `</td></tr>` +
    `<tr><td style="padding:18px 28px 28px;border-top:1px solid #e6e2ef;font:12px/1.6 Helvetica,Arial,sans-serif;color:#7a7488">` +
    `Ceci est un accusé de réception automatique. Si vous n’êtes pas à l’origine de cette demande, ignorez ce message ou écrivez à ` +
    `<a href="mailto:${esc(contact)}" style="color:#7a7488">${esc(contact)}</a>.<br>` +
    `BUTTISCREEN · Studio de montage vidéo · Paris · <a href="${SITE}" style="color:#7a7488">buttiscreen.fr</a> · <a href="${SITE}/politique.html" style="color:#7a7488">Confidentialité</a>` +
    `</td></tr></table></td></tr></table></body></html>`;
  return {
    from: env.MAIL_FROM || "Buttiscreen <brief@buttiscreen.fr>",
    to: [email],
    reply_to: contact,
    subject: "Votre brief est bien reçu — BUTTISCREEN",
    text,
    html,
    headers: { "Auto-Submitted": "auto-replied" },
  };
}

async function sha256(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Sans KV lié, on n'envoie rien : un formulaire public ne doit pas pouvoir écrire à des tiers sans limite.
async function allowConfirmation(env, email, ip) {
  const kv = env.RATE;
  if (!kv || env.CONFIRMATION === "off") return false;
  const mailKey = `m:${await sha256(email.toLowerCase())}`;
  if (await kv.get(mailKey)) return false;
  const ipKey = `i:${ip || "inconnue"}:${Math.floor(Date.now() / 3_600_000)}`;
  const n = Number(await kv.get(ipKey)) || 0;
  if (n >= PER_IP_PER_HOUR) return false;
  await kv.put(ipKey, String(n + 1), { expirationTtl: 3600 });
  await kv.put(mailKey, "1", { expirationTtl: 86400 });
  return true;
}

async function sendConfirmation(env, data, ip, id) {
  try {
    if (!(await allowConfirmation(env, data.email, ip))) return false;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify(buildConfirmation(data, env, id)),
    });
    return res.ok;
  } catch {
    return false; // l'accusé ne doit jamais faire échouer le brief
  }
}

const randomId = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
const clip = (v, n) => oneLine(v ?? "").slice(0, n);

async function bump(kv, key, limit, ttl) {
  const n = Number(await kv.get(key)) || 0;
  if (n >= limit) return false;
  await kv.put(key, String(n + 1), { expirationTtl: ttl });
  return true;
}

// Garde une copie du brief, 90 jours, sous un identifiant aléatoire (le lien envoyé par e-mail le contient).
async function storeBrief(env, data, source) {
  try {
    if (!env.BRIEFS) return null;
    const id = randomId();
    const email = data.email.toLowerCase();
    const record = {
      cree: new Date().toISOString(),
      nom: data.nom,
      email,
      projet: data.projet,
      duree: data.duree || "",
      diffusion: data.diffusion || "",
      creneau: data.creneau || "",
      message: data.message,
      source,
    };
    await env.BRIEFS.put(`b:${id}`, JSON.stringify(record), { expirationTtl: BRIEF_TTL });
    const indexKey = `e:${await sha256(email)}`;
    let ids = [];
    try {
      ids = JSON.parse((await env.BRIEFS.get(indexKey)) || "[]");
    } catch {}
    await env.BRIEFS.put(indexKey, JSON.stringify([id, ...ids].slice(0, 10)), { expirationTtl: BRIEF_TTL });
    return id;
  } catch {
    return null; // la copie ne doit jamais faire échouer le brief
  }
}

async function readBody(request) {
  const raw = await request.text();
  if (raw.length > 20000) return { tooBig: true };
  return { input: JSON.parse(raw) };
}

async function getBrief(env, id, ip, allowed) {
  if (!allowed) return reply({ error: "origin" }, 403, "");
  if (!env.BRIEFS || !ID_RE.test(id)) return reply({ error: "introuvable" }, 404, allowed);
  if (env.RATE && !(await bump(env.RATE, `g:${ip || "inconnue"}:${Math.floor(Date.now() / 3_600_000)}`, 60, 3600))) {
    return reply({ error: "limite" }, 429, allowed);
  }
  const raw = await env.BRIEFS.get(`b:${id}`);
  if (!raw) return reply({ error: "introuvable" }, 404, allowed);
  const b = JSON.parse(raw);
  return reply(
    { ok: true, brief: { cree: b.cree, nom: b.nom, email: b.email, projet: b.projet, duree: b.duree, diffusion: b.diffusion, creneau: b.creneau, message: b.message } },
    200,
    allowed
  );
}

// Brief du tunnel : copie seulement (le studio reçoit déjà ce brief par le tunnel), accusé si les limites le permettent.
async function handleTunnel(request, env, ctx, allowed) {
  let input;
  try {
    const body = await readBody(request);
    if (body.tooBig) return reply({ error: "size" }, 413, allowed);
    input = body.input;
  } catch {
    return reply({ error: "json" }, 400, allowed);
  }
  const d = input && typeof input === "object" ? input : {};
  const data = {
    nom: clip(d.nom, MAX.nom),
    email: clip(d.email, MAX.email),
    projet: clip(d.projet, MAX.projet),
    duree: clip(d.duree, 60),
    diffusion: clip(d.diffusion, 120),
    creneau: clip(d.creneau, 120),
    message: String(d.message ?? "").trim().slice(0, MAX.message),
  };
  const ip = request.headers.get("cf-connecting-ip");
  if (data.nom.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || !data.projet || data.message.length < 10) {
    return reply({ error: "validation" }, 422, allowed);
  }
  if (env.RATE && !(await bump(env.RATE, `t:${ip || "inconnue"}:${Math.floor(Date.now() / 3_600_000)}`, 10, 3600))) {
    return reply({ ok: true }, 200, allowed);
  }
  const id = await storeBrief(env, data, "tunnel");
  const both = Promise.all([sendConfirmation(env, data, ip, id), pushRdv(env, data)]);
  if (ctx && ctx.waitUntil) ctx.waitUntil(both);
  else await both;
  return reply(id ? { ok: true, id } : { ok: true }, 200, allowed);
}

export function buildLinkMail(email, briefs, env) {
  const contact = env.MAIL_TO || "contact@buttiscreen.fr";
  const when = (iso) =>
    new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" }).format(new Date(iso));
  const lines = briefs.map((b) => `${when(b.cree)} · ${b.projet} : ${SITE}/commande.html#brief=${b.id}`);
  return {
    from: env.MAIL_FROM || "Buttiscreen <brief@buttiscreen.fr>",
    to: [email],
    reply_to: contact,
    subject: "Retrouver votre brief — BUTTISCREEN",
    text: ["Bonjour,", "", "Vous avez demandé à retrouver votre brief. Voici le lien personnel :", "", ...lines, "", "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.", "", "BUTTISCREEN · Studio de montage vidéo · Paris", SITE].join("\n"),
    html:
      `<p style="font:15px/1.6 Helvetica,Arial,sans-serif;color:#1b1826">Bonjour,<br><br>Vous avez demandé à retrouver votre brief. Voici le lien personnel :</p>` +
      briefs
        .map((b) => `<p style="margin:0 0 10px"><a href="${esc(SITE)}/commande.html#brief=${esc(b.id)}" style="display:inline-block;padding:12px 22px;background:#ff6a00;color:#07060d;text-decoration:none;font:600 14px Helvetica,Arial,sans-serif">${esc(when(b.cree))} · ${esc(b.projet)}</a></p>`)
        .join("") +
      `<p style="font:12px/1.6 Helvetica,Arial,sans-serif;color:#7a7488">Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.<br>BUTTISCREEN · Studio de montage vidéo · Paris · <a href="${esc(SITE)}" style="color:#7a7488">buttiscreen.fr</a></p>`,
    headers: { "Auto-Submitted": "auto-replied" },
  };
}

// « Retrouver mon brief » : renvoie les liens par e-mail, sans jamais révéler si l'adresse est connue.
async function handleLink(request, env, ctx, allowed) {
  let input;
  try {
    const body = await readBody(request);
    if (body.tooBig) return reply({ error: "size" }, 413, allowed);
    input = body.input;
  } catch {
    return reply({ error: "json" }, 400, allowed);
  }
  const d = input && typeof input === "object" ? input : {};
  const email = oneLine(d.email ?? "").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > MAX.email) return reply({ error: "validation" }, 422, allowed);
  const ok = reply({ ok: true }, 200, allowed);
  if (Boolean(d.website) || !(Date.now() - Number(d.t) >= MIN_FILL_MS)) return ok;
  if (!env.BRIEFS || !env.RATE) return ok;
  const ip = request.headers.get("cf-connecting-ip") || "inconnue";
  const hour = Math.floor(Date.now() / 3_600_000);
  if (!(await bump(env.RATE, `l:${ip}:${hour}`, 5, 3600))) return ok;
  const hash = await sha256(email);
  if (!(await bump(env.RATE, `lm:${hash}:${Math.floor(Date.now() / 86_400_000)}`, 3, 86400))) return ok;
  const task = (async () => {
    try {
      const ids = JSON.parse((await env.BRIEFS.get(`e:${hash}`)) || "[]").slice(0, 3);
      const briefs = [];
      for (const id of ids) {
        const raw = await env.BRIEFS.get(`b:${id}`);
        if (raw) briefs.push({ id, ...JSON.parse(raw) });
      }
      if (!briefs.length) return;
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
        body: JSON.stringify(buildLinkMail(email, briefs, env)),
      });
    } catch {}
  })();
  if (ctx && ctx.waitUntil) ctx.waitUntil(task);
  else await task;
  return ok;
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("origin") || "";
    const allowed = origins(env).includes(origin) ? origin : "";

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": allowed || "null",
          "access-control-allow-methods": "GET, POST, OPTIONS",
          "access-control-allow-headers": "content-type, authorization",
          "access-control-max-age": "86400",
          vary: "Origin",
        },
      });
    }
    const path = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
    const auth = await handleAuth(request, env, ctx, allowed, path, reply);
    if (auth) return auth;
    if (request.method === "GET" && path.startsWith("/brief/")) {
      return getBrief(env, path.slice("/brief/".length), request.headers.get("cf-connecting-ip"), allowed);
    }
    if (request.method !== "POST") return reply({ error: "method" }, 405, allowed);
    if (!allowed) return reply({ error: "origin" }, 403, "");
    if (!env.RESEND_API_KEY) return reply({ error: "config" }, 500, allowed);
    if (path === "/lien") return handleLink(request, env, ctx, allowed);
    if (path === "/tunnel") return handleTunnel(request, env, ctx, allowed);

    let input;
    try {
      const raw = await request.text();
      if (raw.length > 20000) return reply({ error: "size" }, 413, allowed);
      input = JSON.parse(raw);
    } catch {
      return reply({ error: "json" }, 400, allowed);
    }

    const v = validate(input);
    if (v.bot) return reply({ ok: true }, 200, allowed); // on ne renseigne pas les robots
    if (!v.ok) return reply({ error: "validation", fields: v.errors }, 422, allowed);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify(buildMail(v.data, env)),
    });
    if (!res.ok) return reply({ error: "send" }, 502, allowed);

    const id = await storeBrief(env, v.data, "site");
    const confirmation = sendConfirmation(env, v.data, request.headers.get("cf-connecting-ip"), id);
    if (ctx && ctx.waitUntil) ctx.waitUntil(confirmation);
    else await confirmation;
    return reply({ ok: true }, 200, allowed);
  },
};
