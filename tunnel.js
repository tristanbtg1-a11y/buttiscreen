(() => {
  const MAILHOOK = "4wxc1v3zhi3323lkdnpej56j5havqk2g@hook.eu1.make.com";
  const WEBHOOK = "https://hook.eu1.make.com/q9filj9cvcdae4534x28xxztxeynrqd3";
  const STUDIO = "contact@buttiscreen.fr";
  const store = {
    nom: "",
    email: "",
    projet: "",
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

  const lookupPay = async () => {
    const pay = document.getElementById("pay");
    const status = document.getElementById("pay-status");
    const email = String(store.email || sessionStorage.getItem("buttiscreen.commande.session") || "")
      .trim()
      .toLowerCase();
    if (!pay) return;
    if (!email) {
      if (status) status.textContent = "Le lien Stripe arrive avec le devis chiffré.";
      return;
    }
    try {
      const response = await fetch(WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "payer", email }),
      });
      const data = await response.json().catch(() => null);
      const amount = formatEuros(data && data.montant);
      if (stripeUrl(data && data.url)) {
        pay.href = data.url;
        pay.classList.remove("is-wait");
        pay.removeAttribute("aria-disabled");
        if (status) status.textContent = amount ? `Devis ${amount}. Le règlement s’ouvre sur Stripe.` : "Le devis est prêt.";
        return;
      }
      if (status) {
        status.textContent = amount
          ? `Devis ${amount}. Le lien Stripe arrive avec le devis chiffré.`
          : "Le lien Stripe arrive avec le devis chiffré.";
      }
    } catch {
      if (status) status.textContent = "Le lien Stripe arrive avec le devis chiffré.";
    }
  };

  const show = (step) => {
    panes.forEach((pane) => {
      pane.hidden = pane.id !== `pane-${step}`;
    });
    tabs.forEach((tab) => {
      const on = tab.dataset.step === step;
      tab.classList.toggle("is-active", on);
      tab.setAttribute("aria-selected", on ? "true" : "false");
    });
    if (step === "reglement") lookupPay();
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => show(tab.dataset.step));
  });
  document.querySelectorAll("[data-goto]").forEach((button) => {
    button.addEventListener("click", () => show(button.dataset.goto));
  });

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
    store.duree = String(data.get("duree") || "").trim();
    store.diffusion = String(data.get("diffusion") || "").trim();
    store.message = String(data.get("message") || "").trim();
    const okNom = store.nom.length >= 2;
    const okMail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(store.email);
    const okProjet = store.projet.length > 0;
    const okMessage = store.message.length >= 8;
    setError("err-nom", okNom ? "" : "Indiquez votre nom.");
    setError("err-email", okMail ? "" : "Indiquez un e-mail valide.");
    setError("err-projet", okProjet ? "" : "Choisissez un type de projet.");
    setError("err-message", okMessage ? "" : "Écrivez le brief, quelques mots suffisent.");
    if (okNom && okMail && okProjet && okMessage) show("rdv");
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
      `Projet : ${store.projet}`,
      `Durée : ${store.duree || "—"}`,
      `Diffusion : ${store.diffusion || "—"}`,
      `Créneau proposé : ${store.creneau}`,
      "",
      store.message,
    ].join("\n");

  document.getElementById("send-brief")?.addEventListener("click", async () => {
    const status = document.getElementById("send-status");
    const slug = String(store.email || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    window.ButtiBrief?.save(store);
    const payload = {
      ...store,
      studio: "BUTTISCREEN",
      fuseau: "Europe/Paris",
      action: "rdv",
      cree: new Date().toISOString(),
      clef: `rdv-${slug}-${Date.now()}`,
    };
    fetch("https://buttiscreen-contact.tristan-buttig1.workers.dev/tunnel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...store, website: "", t: Date.now() - 5000 }),
    }).catch(() => {});
    try {
      await fetch(WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      /* La messagerie reste le chemin sûr. */
    }
    const href = `mailto:${MAILHOOK}?cc=${encodeURIComponent(STUDIO)}&subject=${encodeURIComponent("Brief BUTTISCREEN")}&body=${encodeURIComponent(bodyOf())}`;
    if (status) status.textContent = "Le message s’ouvre dans votre messagerie, vers le studio.";
    window.location.href = href;
    show("reglement");
  });

  document.getElementById("pay")?.addEventListener("click", (event) => {
    const pay = document.getElementById("pay");
    if (stripeUrl(pay?.getAttribute("href"))) return;
    event.preventDefault();
    const status = document.getElementById("pay-status");
    if (status) status.textContent = "Le devis se charge. Réappuyez dans un instant.";
    lookupPay();
  });
})();
