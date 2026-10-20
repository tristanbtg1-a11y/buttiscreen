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

  const signIn = async (email, password) => {
    const response = await fetch(HOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "login", email, password }),
    });
    const data = await response.json().catch(() => null);
    if (response.status === 401 || data?.ok === false) {
      return { ok: false, error: "E-mail ou mot de passe incorrect." };
    }
    if (!response.ok || !data?.token) {
      return { ok: false, error: "Le studio ne répond pas. Réessayez dans un instant." };
    }
    return { ok: true, token: String(data.token) };
  };

  const ask = async (token) => {
    const response = await fetch(HOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "list", token }),
    });
    const text = await response.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
    if (response.status === 401 || data?.ok === false) {
      return { ok: false, error: "Session expirée. Reconnectez-vous." };
    }
    if (!response.ok || !data) {
      return { ok: false, error: "Le studio ne répond pas. Réessayez dans un instant." };
    }
    return { ok: true, items: readItems(data) };
  };

  const RANK = ["brief", "preparation", "montage", "etalonnage", "livraison"];

  // État enregistré sur le serveur (atelier ou gestion), lu avec la session studio quand elle est ouverte.
  const serverEtat = {};
  const loadServerEtat = async () => {
    if (!window.ButtiAuth?.isAdmin()) return;
    const result = await window.ButtiAuth.listProjects();
    ((result.json && result.json.projets) || []).forEach((p) => {
      serverEtat[p.email] = p.etat;
    });
  };

  const shownEtat = (email, remote) => {
    const local = window.ButtiCommande?.projectFor(email)?.etat || "";
    const server = serverEtat[String(email || "").trim().toLowerCase()] || "";
    return [remote, local, server].reduce(
      (best, value) => (RANK.indexOf(value) > RANK.indexOf(best) ? value : best),
      ""
    ) || remote || local;
  };

  const stateButton = (email) =>
    String(email || "").includes("@")
      ? `<button class="btn ghost" type="button" data-etat="${esc(email)}">État de la commande</button>`
      : "";

  const chatButton = (email) =>
    String(email || "").includes("@")
      ? `<button class="btn ghost" type="button" data-chat="${esc(email)}">Conversation</button>`
      : "";

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
      ${chatButton(item.email)}
    </article>
  `;

  const cardCommande = (item, pay, withState) => {
    const etat = shownEtat(item.email, item.etat);
    return `
    <article class="gestion-card">
      <p class="gestion-pill${etat === "livraison" || item.statut === "close" ? " is-close" : ""}">${etat === "livraison" || item.statut === "close" ? "Close" : "En cours"}</p>
      <h3>${esc(item.projet || item.nom || item.email || "Commande")}</h3>
      ${line("Client", item.nom && item.nom !== item.projet ? item.nom : "")}
      ${line("E-mail", item.email)}
      ${line("État", ETATS[etat] || etat)}
      ${line("Délai", item.delai)}
      ${line("Mise à jour", when(item.cree))}
      ${payBox(item, pay)}
      ${withState ? stateButton(item.email) : ""}
      ${chatButton(item.email)}
    </article>
  `;
  };

  let listedItems = [];

  const paint = (items) => {
    listedItems = items;
    const byDate = (a, b) => String(b.cree).localeCompare(String(a.cree));
    const payments = new Map(
      items
        .filter((item) => item.kind === "paiement" && item.email)
        .map((item) => [item.email.toLowerCase(), item])
    );
    const withPay = (item) => payments.get(String(item.email || "").toLowerCase());
    const rdv = items.filter((item) => item.kind === "rdv").sort(byDate);
    const isClose = (item) => item.statut === "close" || shownEtat(item.email, item.etat) === "livraison";
    const commandes = items.filter((item) => item.kind === "commande");
    const cours = commandes.filter((item) => !isClose(item)).sort(byDate);
    const closes = commandes.filter(isClose).sort(byDate);
    const fill = (id, rows, html, empty) => {
      const node = document.getElementById(id);
      node.innerHTML = rows.length ? rows.map(html).join("") : `<p class="gestion-meta">${empty}</p>`;
    };
    fill("rdv-list", rdv, (item) => cardRdv(item, withPay(item)), "Aucun rendez-vous.");
    fill("cours-list", cours, (item) => cardCommande(item, withPay(item), true), "Aucune commande en cours.");
    fill("closes-list", closes, (item) => cardCommande(item, withPay(item), false), "Aucune commande close.");
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

  const load = async (current, remember) => {
    submit.disabled = true;
    showError("");
    try {
      const [result] = await Promise.all([ask(current.token), loadServerEtat()]);
      if (!result.ok) {
        sessionStorage.removeItem(SESSION);
        showError(result.error);
        gate.hidden = false;
        board.hidden = true;
        return;
      }
      if (remember) sessionStorage.setItem(SESSION, JSON.stringify(current));
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
    submit.disabled = true;
    showError("");
    signIn(email, password)
      .then((result) => {
        form.reset();
        if (!result.ok) {
          showError(result.error);
          submit.disabled = false;
          return;
        }
        submit.disabled = false;
        return load({ email, token: result.token }, true);
      })
      .catch(() => {
        showError("Le studio ne répond pas. Réessayez dans un instant.");
        submit.disabled = false;
      });
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
    if (!saved?.token) {
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
          token: saved.token,
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
        await load(saved, true);
        return;
      }
      showStatus("Le montant est enregistré. Le lien Stripe n’est pas encore ouvert.");
      await load(saved, true);
    } catch {
      showStatus("Le studio ne répond pas. Réessayez dans un instant.");
    } finally {
      if (button.isConnected) button.disabled = false;
    }
  });

  document.getElementById("refresh")?.addEventListener("click", () => {
    const saved = session();
    if (saved?.token) load(saved, true);
  });

  document.getElementById("logout")?.addEventListener("click", () => {
    const saved = session();
    if (saved?.token) {
      fetch(HOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout", token: saved.token }),
      }).catch(() => {});
    }
    sessionStorage.removeItem(SESSION);
    form.reset();
    gate.hidden = false;
    board.hidden = true;
    showError("");
    document.getElementById("gestion-chat")?.close();
  });

  const archive = window.ButtiConversation;
  const chatDialog = document.getElementById("gestion-chat");
  const chatLog = document.getElementById("gestion-chat-log");
  const chatEmpty = document.getElementById("gestion-chat-empty");
  const chatWho = document.getElementById("gestion-chat-who");
  const chatStatus = document.getElementById("gestion-chat-status");
  const chatForm = document.getElementById("gestion-chat-form");
  let chatEmail = "";
  const chatWhen = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Paris",
    }).format(date);
  };
  const paintChat = () => {
    if (!chatLog || !chatEmpty || !archive) return;
    const rows = archive.readThread(chatEmail);
    chatLog.innerHTML = "";
    rows.forEach((row) => {
      const item = document.createElement("li");
      if (row.from === "studio") item.classList.add("is-studio");
      const who = document.createElement("strong");
      const time = document.createElement("time");
      const text = document.createElement("p");
      who.textContent = row.from === "studio" ? "Studio" : "Client";
      time.dateTime = row.cree;
      time.textContent = chatWhen(row.cree);
      text.textContent = row.texte;
      item.append(who, time, text);
      chatLog.append(item);
    });
    chatEmpty.hidden = rows.length > 0;
    chatLog.hidden = rows.length === 0;
    if (chatWho) chatWho.textContent = chatEmail;
    chatLog.scrollTop = chatLog.scrollHeight;
  };
  const openChat = (email) => {
    chatEmail = String(email || "").trim().toLowerCase();
    if (!chatEmail || !chatDialog) return;
    if (chatStatus) chatStatus.textContent = "";
    paintChat();
    if (!chatDialog.open) chatDialog.showModal();
    document.getElementById("gestion-chat-text")?.focus();
  };
  if (archive && chatDialog) {
    board.addEventListener("click", (event) => {
      const button = event.target.closest("[data-chat]");
      if (!button) return;
      openChat(button.dataset.chat);
    });
    document.getElementById("gestion-chat-close")?.addEventListener("click", () => chatDialog.close());
    chatDialog.addEventListener("click", (event) => {
      if (event.target === chatDialog) chatDialog.close();
    });
    chatDialog.addEventListener("close", () => {
      const opener = board.querySelector(`[data-chat="${chatEmail}"]`);
      opener?.focus();
    });
    chatForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      const field = document.getElementById("gestion-chat-text");
      const savedRow = archive.append(chatEmail, "studio", field.value);
      if (!savedRow) {
        if (chatStatus) chatStatus.textContent = "Écrivez un message.";
        return;
      }
      field.value = "";
      if (chatStatus) chatStatus.textContent = "Message envoyé.";
      paintChat();
    });
    window.addEventListener("storage", (event) => {
      if (event.key === "buttiscreen.conversation.v1" && chatDialog.open) paintChat();
    });
  }

  const etatDialog = document.getElementById("etat-dialog");
  const etatWho = document.getElementById("etat-who");
  const etatStatus = document.getElementById("etat-status");
  let etatEmail = "";
  const markEtat = () => {
    const current = window.ButtiCommande?.projectFor(etatEmail)?.etat || "";
    etatDialog?.querySelectorAll("[data-set-etat]").forEach((button) => {
      button.setAttribute("aria-pressed", button.dataset.setEtat === current ? "true" : "false");
    });
  };
  const openEtat = (email) => {
    etatEmail = String(email || "").trim().toLowerCase();
    if (!etatEmail || !etatDialog) return;
    if (etatWho) etatWho.textContent = etatEmail;
    if (etatStatus) etatStatus.textContent = "";
    markEtat();
    if (!etatDialog.open) etatDialog.showModal();
  };
  const STUDIO_MAIL = "tristan@buttiscreen.fr";

  const askStudioLink = () => {
    if (!etatStatus) return;
    etatStatus.textContent = `Pour que le client voie l’état, ouvrez la session studio : un lien part vers ${STUDIO_MAIL}. `;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn ghost";
    button.textContent = "Recevoir le lien";
    button.addEventListener("click", async () => {
      button.disabled = true;
      const result = await window.ButtiAuth.requestLink(STUDIO_MAIL, "atelier");
      etatStatus.textContent = result.ok
        ? `Lien envoyé à ${STUDIO_MAIL}. Cliquez dessus, puis revenez ici et choisissez l’état.`
        : "L’envoi n’a pas abouti. Réessayez dans un instant.";
    });
    etatStatus.append(button);
  };

  // Le serveur d'abord : c'est lui que lit Mon compte. L'état local ne suit qu'après son accord.
  const saveEtat = async (etat) => {
    if (!window.ButtiAuth?.isAdmin()) {
      askStudioLink();
      return;
    }
    if (etatStatus) etatStatus.textContent = "Enregistrement…";
    const result = await window.ButtiAuth.saveProject({ email: etatEmail, etat });
    if (result.status === 401) {
      await window.ButtiAuth.logout();
      askStudioLink();
      return;
    }
    if (!(result.status === 200 && result.json && result.json.ok)) {
      if (etatStatus) etatStatus.textContent = "L’état n’a pas été enregistré. Réessayez dans un instant.";
      return;
    }
    serverEtat[etatEmail] = etat;
    window.ButtiCommande.setEtat(etatEmail, etat);
    markEtat();
    if (etatStatus) etatStatus.textContent = `Mon compte affiche maintenant ${ETATS[etat]}, sur tous les appareils du client.`;
    if (listedItems.length) paint(listedItems);
  };

  if (etatDialog && window.ButtiCommande?.setEtat) {
    board.addEventListener("click", (event) => {
      const button = event.target.closest("[data-etat]");
      if (!button) return;
      openEtat(button.dataset.etat);
    });
    document.getElementById("etat-close")?.addEventListener("click", () => etatDialog.close());
    etatDialog.addEventListener("click", (event) => {
      const choice = event.target.closest("[data-set-etat]");
      if (choice) {
        const etat = choice.dataset.setEtat;
        saveEtat(etat);
        return;
      }
      if (event.target === etatDialog) etatDialog.close();
    });
    etatDialog.addEventListener("close", () => {
      board.querySelector(`[data-etat="${etatEmail}"]`)?.focus();
    });
  }

  const saved = session();
  if (saved?.token) load(saved, false);
})();
