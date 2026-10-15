(() => {
  const HOOK = "https://hook.eu1.make.com/q9filj9cvcdae4534x28xxztxeynrqd3";
  const SESSION = "buttiscreen.gestion.v1";
  const ETATS = {
    brief: "Brief reçu",
    preparation: "En préparation",
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
      montant: row.montant || "",
      lien: row.lien || "",
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

  const stripeUrl = (value) => {
    try {
      const url = new URL(String(value || ""));
      return (
        url.protocol === "https:" &&
        (url.hostname === "buy.stripe.com" || url.hostname === "checkout.stripe.com")
      );
    } catch {
      return false;
    }
  };

  const formatEuros = (value) => {
    const number = Number(String(value || "").replace(",", "."));
    if (!Number.isFinite(number) || number <= 0) return "";
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(number);
  };

  const payBox = (item, pay) => {
    const known = formatEuros(pay && pay.montant);
    const open = stripeUrl(pay && pay.lien)
      ? `<a href="${esc(pay.lien)}" target="_blank" rel="noopener noreferrer">Ouvrir le lien</a>`
      : "";
    return `
      <form class="gestion-pay">
        ${pay && pay.etat ? line("État", ETATS[pay.etat] || pay.etat) : ""}
        ${known ? `<p class="gestion-meta">Devis : ${esc(known)}${open ? ` · ${open}` : ""}</p>` : ""}
        <label>Montant (€)
          <input name="montant" type="text" inputmode="decimal" autocomplete="off" placeholder="1500" />
        </label>
        <button class="btn" type="submit">Créer le lien Stripe</button>
        <p class="gestion-meta" data-pay-status hidden></p>
        <input type="hidden" name="client" value="${esc(item.email)}" />
        <input type="hidden" name="nom" value="${esc(item.nom)}" />
        <input type="hidden" name="projet" value="${esc(item.projet)}" />
      </form>
    `;
  };

  const cardRdv = (item, pay) => `
    <article class="gestion-card">
      <h3>${esc(item.nom || item.email || "Rendez-vous")}</h3>
      ${line("E-mail", item.email)}
      ${line("Projet", item.projet)}
      ${line("Durée", item.duree)}
      ${line("Diffusion", item.diffusion)}
      ${line("Créneau", String(item.creneau || "").replace(/\s*\([^)]*\)\s*$/, ""))}
      ${line("Reçu", when(item.cree))}
      ${item.message ? `<p class="gestion-note">${esc(item.message)}</p>` : ""}
      ${payBox(item, pay)}
    </article>
  `;

  const cardCommande = (item, pay) => `
    <article class="gestion-card">
      <p class="gestion-pill${item.statut === "close" ? " is-close" : ""}">${item.statut === "close" ? "Close" : "En cours"}</p>
      <h3>${esc(item.projet || item.nom || item.email || "Commande")}</h3>
      ${line("Client", item.nom && item.nom !== item.projet ? item.nom : "")}
      ${line("E-mail", item.email)}
      ${line("État", ETATS[item.etat] || item.etat)}
      ${line("Délai", item.delai)}
      ${line("Mise à jour", when(item.cree))}
      ${payBox(item, pay)}
    </article>
  `;

  const paint = (items) => {
    const byDate = (a, b) => String(b.cree).localeCompare(String(a.cree));
    const payments = new Map(
      items
        .filter((item) => item.kind === "paiement" && item.email)
        .map((item) => [item.email.toLowerCase(), item])
    );
    const withPay = (item) => payments.get(String(item.email || "").toLowerCase());
    const rdv = items.filter((item) => item.kind === "rdv").sort(byDate);
    const cours = items.filter((item) => item.kind === "commande" && item.statut !== "close").sort(byDate);
    const closes = items.filter((item) => item.kind === "commande" && item.statut === "close").sort(byDate);
    const fill = (id, rows, html, empty) => {
      const node = document.getElementById(id);
      node.innerHTML = rows.length ? rows.map(html).join("") : `<p class="gestion-meta">${empty}</p>`;
    };
    fill("rdv-list", rdv, (item) => cardRdv(item, withPay(item)), "Aucun rendez-vous.");
    fill("cours-list", cours, (item) => cardCommande(item, withPay(item)), "Aucune commande en cours.");
    fill("closes-list", closes, (item) => cardCommande(item, withPay(item)), "Aucune commande close.");
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

  const centsOf = (raw) => {
    const text = String(raw || "").trim().replace(/\s/g, "").replace(",", ".");
    if (!/^\d+(\.\d{1,2})?$/.test(text)) return 0;
    const cents = Math.round(Number(text) * 100);
    if (!Number.isSafeInteger(cents) || cents < 100 || cents > 10000000) return 0;
    return cents;
  };

  board.addEventListener("submit", async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.classList.contains("gestion-pay")) return;
    event.preventDefault();
    const saved = session();
    const status = form.querySelector("[data-pay-status]");
    const button = form.querySelector("button");
    const data = new FormData(form);
    const cents = centsOf(data.get("montant"));
    const client = String(data.get("client") || "").trim().toLowerCase();
    const showStatus = (message) => {
      if (!status) return;
      status.hidden = !message;
      status.textContent = message || "";
    };
    if (!saved?.email || !saved?.password) {
      showStatus("Rouvrez la session du studio.");
      return;
    }
    if (stripeUrl(form.querySelector("a")?.href)) {
      showStatus("Le lien Stripe est déjà prêt.");
      return;
    }
    if (!client.includes("@") || !cents) {
      showStatus("Indiquez un montant en euros, au moins 1 €.");
      return;
    }
    button.disabled = true;
    showStatus("Création du lien Stripe…");
    try {
      const response = await fetch(HOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "lien",
          email: saved.email,
          password: saved.password,
          client,
          nom: String(data.get("nom") || ""),
          projet: String(data.get("projet") || ""),
          slug: client.replace(/[^a-z0-9]/g, ""),
          centimes: String(cents),
          montant: (cents / 100).toFixed(2),
          cree: new Date().toISOString(),
        }),
      });
      const payload = await response.json().catch(() => null);
      if (response.status === 401 || !payload || payload.ok === false) {
        showStatus("Le lien Stripe n’a pas pu être créé.");
        return;
      }
      if (stripeUrl(payload.url)) {
        await load(saved.email, saved.password, true);
        return;
      }
      showStatus("Le montant est enregistré. Le lien Stripe n’est pas encore ouvert.");
      await load(saved.email, saved.password, true);
    } catch {
      showStatus("Le studio ne répond pas. Réessayez dans un instant.");
    } finally {
      if (button.isConnected) button.disabled = false;
    }
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
