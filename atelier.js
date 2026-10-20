(() => {
  const store = window.ButtiCommande;
  const gate = document.getElementById("atelier-gate");
  const desk = document.getElementById("atelier-desk");
  const gateForm = document.getElementById("atelier-gate-form");
  const gateError = document.getElementById("atelier-gate-error");
  const form = document.getElementById("atelier-form");
  const formError = document.getElementById("atelier-error");
  const saved = document.getElementById("atelier-saved");
  const list = document.getElementById("atelier-list");
  const etat = form.querySelector('[name="etat"]');
  const file = form.querySelector('[name="facture"]');
  const notifier = form.querySelector('[name="notifier"]');

  store.ETATS.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.label;
    etat.append(option);
  });

  const gateStatus = document.getElementById("atelier-gate-status");
  const auth = window.ButtiAuth;
  let projects = [];

  const showDesk = async () => {
    gate.hidden = true;
    desk.hidden = false;
    await Promise.all([renderList(), renderInvoices()]);
  };

  const showGate = (message) => {
    desk.hidden = true;
    gate.hidden = false;
    if (message) gateStatus.textContent = message;
  };

  const renderList = async () => {
    const result = await auth.listProjects();
    if (result.status === 401) {
      await auth.logout();
      showGate("La session a expiré. Recevez un nouveau lien.");
      return;
    }
    projects = (result.json && result.json.projets) || [];
    list.innerHTML = "";
    if (!projects.length) {
      const empty = document.createElement("p");
      empty.className = "fine";
      empty.textContent = "Aucune commande enregistrée. Saisissez l’e-mail d’un client pour créer son suivi.";
      list.append(empty);
      return;
    }
    projects.forEach((project) => {
      const button = document.createElement("button");
      button.type = "button";
      const title = project.titre || "Projet sans titre";
      button.textContent = `${project.email} — ${title}`;
      button.addEventListener("click", () => fill(project));
      list.append(button);
    });
  };

  // La facture déjà déposée n'est pas rechargée dans l'atelier : sans nouveau fichier, le serveur la conserve.
  const fill = (project) => {
    form.email.value = project.email;
    form.titre.value = project.titre || "";
    form.etat.value = project.etat || "brief";
    form.delai.value = project.delai || "";
    file.value = "";
    saved.hidden = true;
    formError.hidden = true;
    if (project.hasFacture) {
      saved.hidden = false;
      saved.textContent = `Dernière facture en ligne : ${project.factureNom || "facture.pdf"}. Elle reste dans l’historique ; une nouvelle facture s’y ajoute sans la remplacer.`;
    }
    form.titre.focus();
  };

  // Historique des factures : les plus récentes d'abord, filtrable, par pages de 50.
  const PAGE = 50;
  const factures = document.getElementById("factures");
  const facturesSummary = document.getElementById("factures-summary");
  const facturesList = document.getElementById("factures-list");
  const facturesEmpty = document.getElementById("factures-empty");
  const facturesMore = document.getElementById("factures-more");
  const facturesSearch = document.getElementById("factures-search");
  let invoices = [];
  let shown = PAGE;

  const invoiceDate = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "Europe/Paris" }).format(date);
  };

  const invoiceSize = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} Mo` : `${Math.max(1, Math.round(bytes / 1024))} Ko`);

  const saveInvoice = async (entry, button) => {
    button.disabled = true;
    const result = await auth.invoice(entry.id);
    button.disabled = false;
    if (result.status === 401) {
      await auth.logout();
      showGate("La session a expiré. Recevez un nouveau lien.");
      return;
    }
    if (!(result.json && result.json.ok && result.json.data)) {
      button.textContent = "Indisponible";
      return;
    }
    const link = document.createElement("a");
    link.href = result.json.data;
    link.download = result.json.nom || entry.nom || "facture.pdf";
    document.body.append(link);
    link.click();
    link.remove();
  };

  const paintInvoices = () => {
    const needle = facturesSearch.value.trim().toLowerCase();
    const rows = invoices.filter((entry) =>
      !needle || [entry.email, entry.titre, entry.nom].some((value) => String(value || "").toLowerCase().includes(needle))
    );
    facturesList.innerHTML = "";
    rows.slice(0, shown).forEach((entry) => {
      const item = document.createElement("li");
      const when = document.createElement("time");
      when.dateTime = entry.cree || "";
      when.textContent = invoiceDate(entry.cree);
      const who = document.createElement("span");
      who.className = "factures-who";
      const mail = document.createElement("strong");
      mail.textContent = entry.email;
      const project = document.createElement("small");
      project.textContent = entry.titre || "Projet sans titre";
      who.append(mail, project);
      const name = document.createElement("span");
      name.className = "factures-file";
      name.textContent = `${entry.nom} · ${invoiceSize(entry.taille)}`;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn ghost";
      button.textContent = "Télécharger";
      button.setAttribute("aria-label", `Télécharger ${entry.nom} (${entry.email})`);
      button.addEventListener("click", () => saveInvoice(entry, button));
      item.append(when, who, name, button);
      facturesList.append(item);
    });
    facturesMore.hidden = rows.length <= shown;
    facturesEmpty.hidden = rows.length > 0;
    facturesEmpty.textContent = invoices.length ? "Aucune facture ne correspond à cette recherche." : "Aucune facture déposée pour l’instant.";
  };

  const renderInvoices = async () => {
    const result = await auth.listInvoices();
    if (result.status === 401) {
      await auth.logout();
      showGate("La session a expiré. Recevez un nouveau lien.");
      return;
    }
    if (!(result.json && result.json.ok)) {
      facturesSummary.textContent = "Factures envoyées";
      facturesEmpty.hidden = false;
      facturesEmpty.textContent = "L’historique n’a pas pu être chargé. Réessayez dans un instant.";
      return;
    }
    invoices = result.json.factures || [];
    facturesSummary.textContent = `Factures envoyées (${invoices.length})`;
    shown = PAGE;
    paintInvoices();
  };

  facturesSearch.addEventListener("input", () => {
    shown = PAGE;
    paintInvoices();
  });
  facturesMore.addEventListener("click", () => {
    shown += PAGE;
    paintInvoices();
  });

  gateForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = String(new FormData(gateForm).get("email") || "").trim().toLowerCase();
    gateError.hidden = true;
    if (!store.validEmail(email)) {
      gateError.hidden = false;
      gateError.textContent = "Indiquez une adresse e-mail valide.";
      return;
    }
    const result = await auth.requestLink(email, "atelier");
    if (!result.ok) {
      gateError.hidden = false;
      gateError.textContent = "L’envoi n’a pas abouti. Réessayez dans un instant.";
      return;
    }
    gateStatus.textContent =
      "Si cette adresse est celle du studio, un lien de connexion vient de partir. Il est valable 15 minutes.";
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const chosen = file.files && file.files[0];
    if (chosen && chosen.type !== "application/pdf") {
      formError.hidden = false;
      formError.textContent = "La facture doit être un PDF.";
      return;
    }
    if (chosen && chosen.size > 2 * 1024 * 1024) {
      formError.hidden = false;
      formError.textContent = "Le PDF dépasse 2 Mo.";
      return;
    }
    let facture = null;
    if (chosen) {
      facture = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ facture: String(reader.result), factureNom: chosen.name });
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(chosen);
      });
    }
    const body = {
      email: String(data.get("email") || "").trim().toLowerCase(),
      titre: String(data.get("titre") || ""),
      etat: String(data.get("etat") || ""),
      delai: String(data.get("delai") || ""),
    };
    if (facture) {
      body.facture = facture.facture;
      body.factureNom = facture.factureNom;
      body.notifier = notifier.checked;
    }
    if (!store.validEmail(body.email)) {
      formError.hidden = false;
      formError.textContent = "Indiquez un e-mail valide.";
      return;
    }
    const result = await auth.saveProject(body);
    if (result.status === 401) {
      await auth.logout();
      showGate("La session a expiré. Recevez un nouveau lien.");
      return;
    }
    const ok = result.status === 200 && result.json && result.json.ok;
    formError.hidden = ok;
    formError.textContent = ok ? "" : "L’enregistrement n’a pas abouti. Réessayez dans un instant.";
    saved.hidden = !ok;
    if (ok) {
      const sent = Boolean(facture);
      const mail = !sent ? "" : result.json.mailed ? " Le client a reçu un e-mail." : notifier.checked ? " L’e-mail au client n’a pas pu partir." : "";
      saved.textContent = `${sent ? "Facture et suivi enregistrés." : "Suivi enregistré."} Le client le voit en se connectant, sur n’importe quel appareil.${mail}`;
      file.value = "";
      await Promise.all([renderList(), renderInvoices()]);
    } else {
      saved.textContent = "";
    }
  });

  const openFromLink = async () => {
    const match = location.hash.match(/^#connexion=([0-9a-f]{32})$/);
    if (!match) return;
    history.replaceState(null, "", location.pathname + location.search);
    gateStatus.textContent = "Connexion en cours…";
    const result = await auth.verify(match[1]);
    if (result.ok && result.admin) {
      await showDesk();
      return;
    }
    if (result.ok) await auth.logout();
    gateStatus.textContent = "Ce lien a expiré ou n’ouvre pas l’atelier. Recevez un nouveau lien.";
  };

  if (auth.isAdmin()) showDesk();
  openFromLink();
})();
