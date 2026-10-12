(() => {
  const HOOK = "https://hook.eu1.make.com/q9filj9cvcdae4534x28xxztxeynrqd3";
  const SESSION = "buttiscreen.gestion.v1";
  const ETATS = {
    brief: "Brief reçu",
    preparation: "Préparation",
    montage: "Montage",
    etalonnage: "Étalonnage",
    livraison: "Livraison",
  };

  const gate = document.getElementById("gate");
  const board = document.getElementById("board");
  const form = document.getElementById("gate-form");
  const error = document.getElementById("gate-error");
  const submit = document.getElementById("gate-submit");

  const esc = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const when = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value || "";
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Paris",
    }).format(date);
  };

  const normalize = (item) => {
    const row = item && item.data && (item.data.kind || item.data.email) ? item.data : item || {};
    return {
      kind: row.kind || "",
      email: row.email || "",
      nom: row.nom || "",
      projet: row.projet || "",
      creneau: row.creneau || "",
      message: row.message || "",
      etat: row.etat || "",
      statut: row.statut || "",
      delai: row.delai || "",
      duree: row.duree || "",
      diffusion: row.diffusion || "",
      cree: row.cree || "",
    };
  };

  const readItems = (data) => {
    if (Array.isArray(data)) return data.map(normalize);
    let raw = data?.items ?? data?.array ?? [];
    if (typeof raw === "string") {
      try {
        raw = JSON.parse(raw);
      } catch {
        raw = [];
      }
    }
    if (raw && !Array.isArray(raw) && (raw.kind || raw.email)) raw = [raw];
    return (Array.isArray(raw) ? raw : []).map(normalize);
  };

  const ask = async (email, password) => {
    const response = await fetch(HOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "list", email, password }),
    });
    const text = await response.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
    if (response.status === 401 || data?.ok === false) {
      return { ok: false, error: "E-mail ou mot de passe incorrect." };
    }
    if (!response.ok || !data) {
      return { ok: false, error: "Le studio ne répond pas. Réessayez dans un instant." };
    }
    return { ok: true, items: readItems(data) };
  };

  const line = (label, value) =>
    value ? `<p class="gestion-meta">${esc(label)} : ${esc(value)}</p>` : "";

  const cardRdv = (item) => `
    <article class="gestion-card">
      <h3>${esc(item.nom || item.email || "Rendez-vous")}</h3>
      ${line("E-mail", item.email)}
      ${line("Projet", item.projet)}
      ${line("Durée", item.duree)}
      ${line("Diffusion", item.diffusion)}
      ${line("Créneau", String(item.creneau || "").replace(/\s*\([^)]*\)\s*$/, ""))}
      ${line("Reçu", when(item.cree))}
      ${item.message ? `<p class="gestion-note">${esc(item.message)}</p>` : ""}
    </article>
  `;

  const cardCommande = (item) => `
    <article class="gestion-card">
      <p class="gestion-pill${item.statut === "close" ? " is-close" : ""}">${item.statut === "close" ? "Close" : "En cours"}</p>
      <h3>${esc(item.projet || item.nom || item.email || "Commande")}</h3>
      ${line("Client", item.nom && item.nom !== item.projet ? item.nom : "")}
      ${line("E-mail", item.email)}
      ${line("État", ETATS[item.etat] || item.etat)}
      ${line("Délai", item.delai)}
      ${line("Mise à jour", when(item.cree))}
    </article>
  `;

  const paint = (items) => {
    const byDate = (a, b) => String(b.cree).localeCompare(String(a.cree));
    const rdv = items.filter((item) => item.kind === "rdv").sort(byDate);
    const cours = items.filter((item) => item.kind === "commande" && item.statut !== "close").sort(byDate);
    const closes = items.filter((item) => item.kind === "commande" && item.statut === "close").sort(byDate);
    const fill = (id, rows, html, empty) => {
      const node = document.getElementById(id);
      node.innerHTML = rows.length ? rows.map(html).join("") : `<p class="gestion-meta">${empty}</p>`;
    };
    fill("rdv-list", rdv, cardRdv, "Aucun rendez-vous.");
    fill("cours-list", cours, cardCommande, "Aucune commande en cours.");
    fill("closes-list", closes, cardCommande, "Aucune commande close.");
  };

  const showError = (message) => {
    error.hidden = !message;
    error.textContent = message || "";
  };

  const openBoard = (items) => {
    paint(items);
    gate.hidden = true;
    board.hidden = false;
    board.focus();
  };

  const session = () => {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION) || "null");
    } catch {
      return null;
    }
  };

  const load = async (email, password, remember) => {
    submit.disabled = true;
    showError("");
    try {
      const result = await ask(email, password);
      if (!result.ok) {
        sessionStorage.removeItem(SESSION);
        showError(result.error);
        gate.hidden = false;
        board.hidden = true;
        return;
      }
      if (remember) sessionStorage.setItem(SESSION, JSON.stringify({ email, password }));
      openBoard(result.items);
    } catch {
      showError("Le studio ne répond pas. Réessayez dans un instant.");
    } finally {
      submit.disabled = false;
    }
  };

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const email = String(new FormData(form).get("email") || "").trim().toLowerCase();
    const password = String(new FormData(form).get("motdepasse") || "");
    load(email, password, true);
  });

  document.getElementById("refresh")?.addEventListener("click", () => {
    const saved = session();
    if (saved?.email && saved?.password) load(saved.email, saved.password, true);
  });

  document.getElementById("logout")?.addEventListener("click", () => {
    sessionStorage.removeItem(SESSION);
    form.reset();
    gate.hidden = false;
    board.hidden = true;
    showError("");
  });

  const saved = session();
  if (saved?.email && saved?.password) load(saved.email, saved.password, false);
})();
