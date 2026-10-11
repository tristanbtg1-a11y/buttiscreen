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

  const showDesk = () => {
    gate.hidden = true;
    desk.hidden = false;
    renderList();
  };

  const renderList = () => {
    const projects = store.listProjects();
    list.innerHTML = "";
    if (!projects.length) {
      const empty = document.createElement("p");
      empty.className = "fine";
      empty.textContent = "Aucune commande enregistrée dans ce navigateur.";
      list.append(empty);
      return;
    }
    projects.forEach((project) => {
      const button = document.createElement("button");
      button.type = "button";
      const title = project.titre || "Projet sans titre";
      button.textContent = `${project.email} — ${title}`;
      button.addEventListener("click", () => fill(project.email));
      list.append(button);
    });
  };

  const fill = (email) => {
    const project = store.projectFor(email);
    form.email.value = email;
    form.titre.value = project.titre || "";
    form.etat.value = project.etat || "brief";
    form.delai.value = project.delai || "";
    keepFacture = project.facture
      ? { facture: project.facture, factureNom: project.factureNom }
      : null;
    file.value = "";
    saved.hidden = true;
    formError.hidden = true;
    form.titre.focus();
  };

  gateForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = String(new FormData(gateForm).get("motdepasse") || "");
    const result = store.atelierReady()
      ? await store.unlockAtelier(password)
      : await store.setAtelierPassword(password);
    gateError.hidden = result.ok;
    gateError.textContent = result.ok ? "" : result.error;
    if (result.ok) showDesk();
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
    const result = store.saveProject(String(data.get("email") || ""), {
      titre: data.get("titre"),
      etat: data.get("etat"),
      delai: data.get("delai"),
      facture: facture ? facture.facture : undefined,
      factureNom: facture ? facture.factureNom : undefined,
    });
    formError.hidden = result.ok;
    formError.textContent = result.ok ? "" : result.error;
    saved.hidden = !result.ok;
    saved.textContent = result.ok
      ? result.hasAccount
        ? "Suivi enregistré. Le client le voit en se connectant sur cet appareil."
        : "Suivi enregistré. Il s’affichera quand ce compte sera créé sur cet appareil."
      : "";
    if (result.ok) renderList();
  });

  if (store.atelierOpen()) showDesk();
  else {
    document.getElementById("gate-title").firstChild.textContent = store.atelierReady()
      ? "Ouvrir l’atelier"
      : "Protéger l’atelier";
    document.getElementById("gate-copy").textContent = store.atelierReady()
      ? "Le mot de passe choisi sur cet appareil."
      : "Choisissez un mot de passe. Il reste dans ce navigateur.";
    gateForm.querySelector("button").textContent = store.atelierReady() ? "Entrer" : "Enregistrer";
  }
})();
