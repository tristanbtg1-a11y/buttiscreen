// Cloudflare Worker : reçoit le brief du formulaire de l'accueil et l'envoie par Resend.
// Variables : RESEND_API_KEY (secret), MAIL_TO, MAIL_FROM, ALLOWED_ORIGINS (facultatif, séparées par des virgules).

const MAX = { nom: 120, email: 254, projet: 60, message: 6000 };
const PROJETS = ["Spot / publicité", "Clip", "Film / documentaire", "Réseaux sociaux", "Étalonnage seul", "Autre"];
const MIN_FILL_MS = 2500;

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

export default {
  async fetch(request, env) {
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
    return reply({ ok: true }, 200, allowed);
  },
};
