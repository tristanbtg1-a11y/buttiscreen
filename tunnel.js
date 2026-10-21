(() => {
  const ENDPOINT = "https://buttiscreen-contact.tristan-buttig1.workers.dev/tunnel";
  const STUDIO = "contact@buttiscreen.fr";
  const opened = Date.now();
  const store = {
    nom: "",
    email: "",
    projet: "",
    telephone: "",
    duree: "",
    diffusion: "",
    message: "",
    creneau: "",
  };

  const note = sessionStorage.getItem("buttiscreen.panier.note");
  const messageField = document.querySelector('[name="message"]');
  if (note && messageField && !messageField.value) {
    store.message = note;
    messageField.value = note;
  }

  const menu = document.getElementById("menu");
  const menuBtn = document.querySelector(".menu-btn");
  menuBtn?.addEventListener("click", () => {
    const open = menu.hidden;
    menu.hidden = !open;
    menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    menuBtn.textContent = open ? "Fermer" : "Menu";
  });

  const panes = [...document.querySelectorAll(".tunnel-pane")];
  const tabs = [...document.querySelectorAll(".tunnel-track .clip")];

  const show = (step) => {
    panes.forEach((pane) => {
      pane.hidden = pane.id !== `pane-${step}`;
    });
    tabs.forEach((tab) => {
      const on = tab.dataset.step === step;
      tab.classList.toggle("is-active", on);
      tab.setAttribute("aria-selected", on ? "true" : "false");
    });
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => show(tab.dataset.step));
  });
  document.querySelectorAll("[data-goto]").forEach((button) => {
    button.addEventListener("click", () => show(button.dataset.goto));
  });

  // Facultatif : chiffres, espaces, + ( ) . - ; entre 8 et 15 chiffres. Le Worker applique la même règle.
  const validPhone = (value) => /^[+()\d\s.\-]{6,25}$/.test(value) && value.replace(/\D/g, "").length >= 8 && value.replace(/\D/g, "").length <= 15;

  const setError = (id, message) => {
    const node = document.getElementById(id);
    if (!node) return;
    node.hidden = !message;
    node.textContent = message || "";
  };

  const brief = document.getElementById("brief");
  brief?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(brief);
    store.nom = String(data.get("nom") || "").trim();
    store.email = String(data.get("email") || "").trim();
    store.projet = String(data.get("projet") || "").trim();
    store.telephone = String(data.get("telephone") || "").trim();
    store.duree = String(data.get("duree") || "").trim();
    store.diffusion = String(data.get("diffusion") || "").trim();
    store.message = String(data.get("message") || "").trim();
    const okNom = store.nom.length >= 2;
    const okMail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(store.email);
    const okTel = !store.telephone || validPhone(store.telephone);
    const okProjet = store.projet.length > 0;
    const okMessage = store.message.length >= 10;
    setError("err-nom", okNom ? "" : "Indiquez votre nom.");
    setError("err-email", okMail ? "" : "Indiquez un e-mail valide.");
    setError("err-telephone", okTel ? "" : "Indiquez un numéro valide ou laissez le champ vide.");
    setError("err-projet", okProjet ? "" : "Choisissez un type de projet.");
    setError("err-message", okMessage ? "" : "Écrivez le brief : quelques lignes suffisent (10 caractères au moins).");
    if (okNom && okMail && okTel && okProjet && okMessage) show("rdv");
  });

  const slots = document.getElementById("slots");
  const hours = ["10:00", "14:00", "16:30"];
  const formatter = new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Europe/Paris",
  });
  const day = new Date();
  day.setDate(day.getDate() + 1);
  let made = 0;
  while (made < 6) {
    const week = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Europe/Paris" }).format(day);
    if (week !== "Sat" && week !== "Sun") {
      hours.forEach((hour) => {
        const label = `${formatter.format(day)} · ${hour}`;
        const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}T${hour}`;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "slot";
        button.textContent = label;
        button.dataset.creneau = `${label} (${iso}, Europe/Paris)`;
        button.addEventListener("click", () => {
          store.creneau = button.dataset.creneau;
          slots.querySelectorAll(".slot").forEach((item) => item.classList.remove("is-active"));
          button.classList.add("is-active");
          setError("err-creneau", "");
        });
        slots?.append(button);
      });
      made += 1;
    }
    day.setDate(day.getDate() + 1);
  }

  const recap = document.getElementById("recap");
  const paintRecap = () => {
    const rows = [
      ["Nom", store.nom],
      ["E-mail", store.email],
      ["Téléphone", store.telephone || "—"],
      ["Projet", store.projet],
      ["Durée", store.duree || "—"],
      ["Diffusion", store.diffusion || "—"],
      ["Créneau", store.creneau],
      ["Brief", store.message],
    ];
    const escape = (value) =>
      String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);
    recap.innerHTML = rows
      .map(([key, value]) => `<div><dt>${key}</dt><dd>${escape(value)}</dd></div>`)
      .join("");
  };

  document.getElementById("to-devis")?.addEventListener("click", () => {
    if (!store.creneau) {
      setError("err-creneau", "Choisissez un créneau.");
      return;
    }
    paintRecap();
    show("devis");
  });

  const bodyOf = () =>
    [
      `Nom : ${store.nom}`,
      `E-mail : ${store.email}`,
      ...(store.telephone ? [`Téléphone : ${store.telephone}`] : []),
      `Projet : ${store.projet}`,
      `Durée : ${store.duree || "—"}`,
      `Diffusion : ${store.diffusion || "—"}`,
      `Créneau proposé : ${store.creneau}`,
      "",
      store.message,
    ].join("\n");

  const sendBtn = document.getElementById("send-brief");
  const sendStatus = document.getElementById("send-status");
  const sendFail = document.getElementById("send-fail");
  const sendMail = document.getElementById("send-mail");

  // L'envoi passe par le Worker, qui prévient le studio par e-mail et dans la gestion. Le message de réussite
  // n'apparaît que sur sa réponse ; en cas d'échec, un lien vers la messagerie reste en secours, sans s'ouvrir seul.
  sendBtn?.addEventListener("click", async () => {
    if (sendBtn.disabled) return;
    sendBtn.disabled = true;
    if (sendFail) sendFail.hidden = true;
    if (sendStatus) sendStatus.textContent = "Envoi au studio en cours…";
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 15000);
    let ok = false;
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...store, website: "", t: opened }),
        signal: ctrl.signal,
      });
      const json = await response.json().catch(() => null);
      ok = response.ok && Boolean(json && json.ok);
    } catch {
      ok = false;
    } finally {
      window.clearTimeout(timer);
    }
    if (ok) {
      window.ButtiBrief?.save(store);
      if (sendStatus) sendStatus.textContent = "";
      const tab = document.getElementById("tab-envoye");
      if (tab) tab.hidden = false;
      show("envoye");
      document.getElementById("pane-envoye")?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    sendBtn.disabled = false;
    if (sendStatus) sendStatus.textContent = "";
    if (sendMail) sendMail.href = `mailto:${STUDIO}?subject=${encodeURIComponent("Brief BUTTISCREEN")}&body=${encodeURIComponent(bodyOf())}`;
    if (sendFail) sendFail.hidden = false;
  });
})();
