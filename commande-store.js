(() => {
  const DB = "buttiscreen.commande.v1";
  const SESSION = "buttiscreen.commande.session";
  const GATE = "buttiscreen.atelier.v1";
  const GATE_SESSION = "buttiscreen.atelier.session";

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

  const bytesToB64 = (bytes) => btoa(String.fromCharCode(...bytes));

  const b64ToBytes = (value) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

  const hashPassword = async (password, saltBytes) => {
    const salt = saltBytes || crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations: 120000, hash: "SHA-256" },
      key,
      256
    );
    return { salt: bytesToB64(salt), hash: bytesToB64(new Uint8Array(bits)) };
  };

  const verify = async (password, salt, hash) => {
    const next = await hashPassword(password, b64ToBytes(salt));
    return next.hash === hash;
  };

  const validEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const HOOK = "https://hook.eu1.make.com/q9filj9cvcdae4534x28xxztxeynrqd3";

  const pushCommande = (email, project) => {
    const etat = project.etat || "brief";
    const slug = email.replace(/[^a-z0-9]/g, "");
    const payload = {
      action: "commande",
      clef: `cmd-${slug}`,
      email,
      nom: project.titre || email,
      projet: project.titre || "",
      etat,
      statut: etat === "livraison" ? "close" : "cours",
      delai: project.delai || "",
      message: "",
      cree: new Date().toISOString(),
    };
    fetch(HOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {});
  };

  const createAccount = async (rawEmail, password) => {
    const email = emailOf(rawEmail);
    if (!validEmail(email)) return { ok: false, error: "Indiquez un e-mail valide." };
    if (password.length < 8) return { ok: false, error: "Huit caractères minimum." };
    const db = read();
    if (db.comptes[email]) return { ok: false, error: "Un compte existe déjà avec cet e-mail." };
    db.comptes[email] = await hashPassword(password);
    if (!db.projets[email]) db.projets[email] = emptyProject();
    write(db);
    sessionStorage.setItem(SESSION, email);
    pushCommande(email, db.projets[email]);
    return { ok: true, email };
  };

  const login = async (rawEmail, password) => {
    const email = emailOf(rawEmail);
    const account = read().comptes[email];
    if (!account || !(await verify(password, account.salt, account.hash))) {
      return { ok: false, error: "E-mail ou mot de passe incorrect." };
    }
    sessionStorage.setItem(SESSION, email);
    return { ok: true, email };
  };

  const sessionEmail = () => {
    const email = sessionStorage.getItem(SESSION) || "";
    return read().comptes[email] ? email : "";
  };

  const logout = () => sessionStorage.removeItem(SESSION);

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
    pushCommande(email, db.projets[email]);
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

  const atelierReady = () => Boolean(localStorage.getItem(GATE));

  const setAtelierPassword = async (password) => {
    if (password.length < 8) return { ok: false, error: "Huit caractères minimum." };
    localStorage.setItem(GATE, JSON.stringify(await hashPassword(password)));
    sessionStorage.setItem(GATE_SESSION, "1");
    return { ok: true };
  };

  const unlockAtelier = async (password) => {
    const gate = JSON.parse(localStorage.getItem(GATE) || "null");
    if (!gate || !(await verify(password, gate.salt, gate.hash))) {
      return { ok: false, error: "Mot de passe incorrect." };
    }
    sessionStorage.setItem(GATE_SESSION, "1");
    return { ok: true };
  };

  const atelierOpen = () => sessionStorage.getItem(GATE_SESSION) === "1" && atelierReady();

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
    createAccount,
    login,
    logout,
    sessionEmail,
    projectFor,
    saveProject,
    setEtat,
    listProjects,
    atelierReady,
    setAtelierPassword,
    unlockAtelier,
    atelierOpen,
    validEmail,
  };
})();
