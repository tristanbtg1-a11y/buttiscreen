(() => {
  const DB = "buttiscreen.commande.v1";

  const ETATS = [
    { id: "brief", label: "Brief reçu" },
    { id: "preparation", label: "En préparation" },
    { id: "montage", label: "Montage" },
    { id: "etalonnage", label: "Étalonnage" },
    { id: "livraison", label: "Livraison" },
  ];

  const emptyProject = () => ({
    titre: "",
    etat: "brief",
    delai: "",
    factureNom: "",
    facture: "",
  });

  const read = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(DB) || "");
      return {
        comptes: parsed.comptes || {},
        projets: parsed.projets || {},
      };
    } catch {
      return { comptes: {}, projets: {} };
    }
  };

  const write = (db) => {
    localStorage.setItem(DB, JSON.stringify(db));
  };

  const emailOf = (value) => String(value || "").trim().toLowerCase();

  const validEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const sessionEmail = () => (window.ButtiAuth ? window.ButtiAuth.email() : "");

  const logout = () => {
    if (window.ButtiAuth) window.ButtiAuth.logout();
  };

  // Recopie le suivi du serveur dans le cache de l'appareil. L'état ne recule jamais : un paiement constaté ici
  // (Stripe, via Make) reste affiché tant que le studio n'a pas fait avancer le suivi.
  const mergeServer = (rawEmail, server) => {
    const email = emailOf(rawEmail);
    if (!validEmail(email) || !server) return;
    const db = read();
    const current = db.projets[email] || emptyProject();
    const rank = (id) => ETATS.findIndex((etat) => etat.id === id);
    db.projets[email] = {
      titre: String(server.titre || ""),
      etat: rank(server.etat) >= rank(current.etat) ? server.etat || "brief" : current.etat,
      delai: String(server.delai || ""),
      factureNom: String(server.factureNom || ""),
      facture: String(server.facture || ""),
    };
    write(db);
  };

  const projectFor = (email) => read().projets[emailOf(email)] || emptyProject();

  const saveProject = (rawEmail, project) => {
    const email = emailOf(rawEmail);
    if (!validEmail(email)) return { ok: false, error: "Indiquez un e-mail valide." };
    const db = read();
    const current = db.projets[email] || emptyProject();
    db.projets[email] = {
      titre: String(project.titre || "").trim(),
      etat: ETATS.some((etat) => etat.id === project.etat) ? project.etat : current.etat,
      delai: String(project.delai || ""),
      factureNom: project.factureNom ?? current.factureNom,
      facture: project.facture ?? current.facture,
    };
    write(db);
    return { ok: true, email, hasAccount: Boolean(db.comptes[email]) };
  };

  const setEtat = (rawEmail, etat) => {
    const email = emailOf(rawEmail);
    if (!validEmail(email) || !ETATS.some((item) => item.id === etat)) return { ok: false };
    const db = read();
    const current = db.projets[email] || emptyProject();
    db.projets[email] = { ...current, etat };
    write(db);
    return { ok: true, email, etat };
  };

  const listProjects = () => {
    const db = read();
    return Object.keys(db.projets)
      .sort()
      .map((email) => ({ email, ...db.projets[email], hasAccount: Boolean(db.comptes[email]) }));
  };

  const bindMenu = () => {
    const menu = document.getElementById("menu");
    const menuBtn = document.querySelector(".menu-btn");
    if (!menu || !menuBtn) return;
    const close = () => {
      menu.hidden = true;
      menuBtn.setAttribute("aria-expanded", "false");
      menuBtn.textContent = "Menu";
    };
    menuBtn.addEventListener("click", () => {
      const open = menu.hidden;
      menu.hidden = !open;
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
      menuBtn.textContent = open ? "Fermer" : "Menu";
      if (open) menu.querySelector("a")?.focus();
    });
    menu.addEventListener("click", (event) => {
      if (event.target.closest("a")) close();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !menu.hidden) {
        close();
        menuBtn.focus();
      }
    });
  };

  bindMenu();

  window.ButtiCommande = {
    ETATS,
    logout,
    sessionEmail,
    mergeServer,
    projectFor,
    saveProject,
    setEtat,
    listProjects,
    validEmail,
  };
})();
