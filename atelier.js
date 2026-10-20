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
  const clearFile = document.getElementById("clear-file");

  let keepFacture = null;

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
    await renderList();
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
    keepFacture = null;
    file.value = "";
    saved.hidden = true;
    formError.hidden = true;
    if (project.hasFacture) {
      saved.hidden = false;
      saved.textContent = `Facture en ligne : ${project.factureNom || "facture.pdf"}. Elle est conservée sauf si vous en choisissez une autre.`;
    }
    form.titre.focus();
  };

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

  file.addEventListener("change", () => {
    keepFacture = null;
  });

  clearFile.addEventListener("click", () => {
    keepFacture = { facture: "", factureNom: "" };
    file.value = "";
    saved.hidden = true;
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
    let facture = keepFacture;
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
    saved.textContent = ok ? "Suivi enregistré. Le client le voit en se connectant, sur n’importe quel appareil." : "";
    if (ok) {
      store.saveProject(body.email, { ...body, facture: undefined, factureNom: undefined }); // alimente aussi Make, comme avant
      await renderList();
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
