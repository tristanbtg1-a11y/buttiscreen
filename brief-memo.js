(() => {
  const KEY = "buttiscreen.brief.v1";
  const KEEP = 5;
  const API = "https://buttiscreen-contact.tristan-buttig1.workers.dev";

  const emailOf = (value) => String(value || "").trim().toLowerCase();
  const clip = (value, max) => String(value ?? "").trim().slice(0, max);

  const read = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) || "");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  };

  // Garde sur l'appareil une copie du brief envoyé, pour l'afficher dans Mon compte.
  const save = (brief) => {
    try {
      const email = emailOf(brief && brief.email);
      if (!email) return false;
      const all = read();
      const list = Array.isArray(all[email]) ? all[email] : [];
      const when = new Date(brief.cree);
      const cree = Number.isNaN(when.getTime()) ? new Date().toISOString() : when.toISOString();
      const message = clip(brief.message, 6000);
      if (list.some((item) => item.cree === cree && item.message === message)) return true;
      list.unshift({
        cree,
        nom: clip(brief.nom, 120),
        email,
        projet: clip(brief.projet, 60),
        duree: clip(brief.duree, 60),
        diffusion: clip(brief.diffusion, 120),
        creneau: clip(brief.creneau, 120),
        message,
      });
      all[email] = list.slice(0, KEEP);
      localStorage.setItem(KEY, JSON.stringify(all));
      return true;
    } catch {
      return false;
    }
  };

  const latestFor = (email) => {
    const list = read()[emailOf(email)];
    return Array.isArray(list) && list.length ? list[0] : null;
  };

  const countFor = (email) => {
    const list = read()[emailOf(email)];
    return Array.isArray(list) ? list.length : 0;
  };

  const call = async (path, init) => {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 12000);
    try {
      return await fetch(API + path, { ...init, signal: ctrl.signal });
    } finally {
      window.clearTimeout(timer);
    }
  };

  // Lit le brief gardé côté serveur grâce au lien personnel reçu par e-mail.
  const fetchById = async (id) => {
    try {
      const res = await call(`/brief/${encodeURIComponent(id)}`);
      if (res.status === 404) return { ok: false, gone: true };
      if (!res.ok) return { ok: false };
      const json = await res.json();
      return json && json.brief ? { ok: true, brief: json.brief } : { ok: false };
    } catch {
      return { ok: false };
    }
  };

  // Demande l'envoi des liens personnels à l'adresse indiquée (la réponse ne dit jamais si elle est connue).
  const requestLink = async (email, since) => {
    try {
      const res = await call("/lien", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, website: "", t: since }),
      });
      return res.ok;
    } catch {
      return false;
    }
  };

  window.ButtiBrief = { save, latestFor, countFor, fetchById, requestLink };
})();
