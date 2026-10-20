// Cloudflare Worker : reçoit le brief du formulaire de l'accueil et l'envoie par Resend.
// Variables : RESEND_API_KEY (secret), MAIL_TO, MAIL_FROM, ALLOWED_ORIGINS (facultatif, séparées par des virgules).
// Accusé de réception au visiteur : actif seulement si le KV « RATE » est lié (limite par adresse et par IP).
// REPLY_DELAY règle le délai annoncé, CONFIRMATION="off" coupe l'accusé.

const MAX = { nom: 120, email: 254, projet: 60, message: 6000 };
const PROJETS = ["Spot / publicité", "Clip", "Film / documentaire", "Réseaux sociaux", "Étalonnage seul", "Autre"];
const MIN_FILL_MS = 2500;
const DEFAULT_DELAY = "48 heures ouvrées";
const SITE = "https://buttiscreen.fr";
const PER_IP_PER_HOUR = 5;

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

export function buildConfirmation(data, env) {
  const { nom, email, projet, message } = data;
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
    "",
    message,
    "",
    "Pour le compléter (références, rushes, date de livraison), répondez simplement à ce message.",
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
    `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 12px">${row("Projet", esc(projet))}${row("E-mail", esc(email))}</table>` +
    `<div style="margin:0 0 24px;padding:14px 16px;background:#f6f5f9;border-left:3px solid #d9d4e6;font-size:15px;line-height:1.6;white-space:pre-wrap">${esc(message)}</div>` +
    `<p style="margin:0 0 28px;font-size:15px;line-height:1.6">Pour le compléter (références, rushes, date de livraison), répondez simplement à ce message.</p>` +
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

async function sendConfirmation(env, data, ip) {
  try {
    if (!(await allowConfirmation(env, data.email, ip))) return false;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify(buildConfirmation(data, env)),
    });
    return res.ok;
  } catch {
    return false; // l'accusé ne doit jamais faire échouer le brief
  }
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
          "access-control-allow-methods": "POST, OPTIONS",
          "access-control-allow-headers": "content-type",
          "access-control-max-age": "86400",
          vary: "Origin",
        },
      });
    }
    if (request.method !== "POST") return reply({ error: "method" }, 405, allowed);
    if (!allowed) return reply({ error: "origin" }, 403, "");
    if (!env.RESEND_API_KEY) return reply({ error: "config" }, 500, allowed);

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

    const confirmation = sendConfirmation(env, v.data, request.headers.get("cf-connecting-ip"));
    if (ctx && ctx.waitUntil) ctx.waitUntil(confirmation);
    else await confirmation;
    return reply({ ok: true }, 200, allowed);
  },
};
