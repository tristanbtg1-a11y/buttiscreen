(() => {
  const store = window.ButtiCommande;
  const auth = document.getElementById("auth");
  const board = document.getElementById("board");
  const form = document.getElementById("compte");
  const modeButtons = [...document.querySelectorAll("[data-mode]")];
  const confirmField = document.getElementById("confirm-field");
  const submit = document.getElementById("compte-submit");
  const formError = document.getElementById("compte-error");
  const live = document.getElementById("compte-live");

  let mode = "connexion";

  const setError = (message) => {
    formError.hidden = !message;
    formError.textContent = message || "";
    live.textContent = message || "";
  };

  const showMode = (next) => {
    mode = next;
    modeButtons.forEach((button) => {
      const on = button.dataset.mode === next;
      button.classList.toggle("is-on", on);
      button.setAttribute("aria-selected", on ? "true" : "false");
    });
    confirmField.hidden = next !== "inscription";
    submit.textContent = next === "inscription" ? "Créer mon compte" : "Se connecter";
    form.querySelector('[name="motdepasse"]').autocomplete =
      next === "inscription" ? "new-password" : "current-password";
    setError("");
  };

  const HOOK = "https://hook.eu1.make.com/q9filj9cvcdae4534x28xxztxeynrqd3";

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

  let payEmail = "";

  const armPay = (pay, url) => {
    pay.href = url;
    pay.classList.remove("is-wait");
    pay.removeAttribute("aria-disabled");
  };

  const lookupPay = async (email) => {
    const pay = document.getElementById("pay");
    const note = document.getElementById("pay-note");
    if (!pay) return;
    payEmail = email;
    try {
      const response = await fetch(HOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "payer", email }),
      });
      const data = await response.json().catch(() => null);
      const amount = formatEuros(data && data.montant);
      if (stripeUrl(data && data.url)) {
        armPay(pay, data.url);
        if (note) note.textContent = amount ? `Devis ${amount}. Le règlement s’ouvre sur Stripe.` : "Le devis est prêt.";
        return;
      }
      if (note) {
        note.textContent = amount
          ? `Devis ${amount}. Le lien Stripe s’active quand il est prêt.`
          : "Le lien Stripe s’active quand le devis est prêt.";
      }
    } catch {
      if (note) note.textContent = "Le lien Stripe s’active quand le devis est prêt.";
    }
  };

  const formatDelai = (iso) => {
    if (!iso) return "À confirmer";
    const [year, month, day] = iso.split("-").map(Number);
    if (!year || !month || !day) return "À confirmer";
    return new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(year, month - 1, day));
  };

  const render = (email) => {
    const project = store.projectFor(email);
    const index = Math.max(
      0,
      store.ETATS.findIndex((etat) => etat.id === project.etat)
    );
    document.getElementById("board-email").textContent = email;
    document.getElementById("board-title").textContent = project.titre || "Votre projet";
    document.getElementById("board-delay").textContent = formatDelai(project.delai);
    const rail = document.getElementById("status-rail");
    rail.innerHTML = "";
    store.ETATS.forEach((etat, i) => {
      const item = document.createElement("li");
      item.textContent = etat.label;
      item.classList.toggle("is-done", i <= index);
      item.classList.toggle("is-on", i === index);
      if (i === index) item.setAttribute("aria-current", "step");
      rail.append(item);
    });
    const invoice = document.getElementById("invoice");
    const note = document.getElementById("invoice-note");
    const ready = Boolean(project.facture);
    invoice.disabled = !ready;
    note.hidden = ready;
    auth.hidden = true;
    board.hidden = false;
    board.focus();
    lookupPay(email);
  };

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => showMode(button.dataset.mode));
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const email = String(data.get("email") || "").trim().toLowerCase();
    const password = String(data.get("motdepasse") || "");
    const confirm = String(data.get("confirmation") || "");
    if (email === "tristan.buttig1@gmail.com") {
      if (mode === "inscription") {
        setError("Un compte existe déjà avec cet e-mail.");
        return;
      }
      submit.disabled = true;
      setError("");
      try {
        const response = await fetch("https://hook.eu1.make.com/q9filj9cvcdae4534x28xxztxeynrqd3", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "list", email, password }),
        });
        const payload = await response.json().catch(() => null);
        if (response.ok && payload && payload.ok !== false) {
          sessionStorage.setItem("buttiscreen.gestion.v1", JSON.stringify({ email, password }));
          window.location.href = "gestion.html";
          return;
        }
        setError("E-mail ou mot de passe incorrect.");
      } catch {
        setError("Le studio ne répond pas. Réessayez dans un instant.");
      } finally {
        submit.disabled = false;
      }
      return;
    }
    if (mode === "inscription" && password !== confirm) {
      setError("Les deux mots de passe diffèrent.");
      return;
    }
    const result =
      mode === "inscription"
        ? await store.createAccount(email, password)
        : await store.login(email, password);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError("");
    render(result.email);
  });

  document.getElementById("logout").addEventListener("click", () => {
    store.logout();
    form.reset();
    showMode("connexion");
    board.hidden = true;
    auth.hidden = false;
    document.getElementById("order-title").focus();
  });

  document.getElementById("pay").addEventListener("click", (event) => {
    const pay = document.getElementById("pay");
    if (stripeUrl(pay?.getAttribute("href"))) return;
    event.preventDefault();
    const note = document.getElementById("pay-note");
    if (note) note.textContent = "Le devis se charge. Réappuyez dans un instant.";
    if (payEmail) lookupPay(payEmail);
  });

  document.getElementById("invoice").addEventListener("click", () => {
    const email = store.sessionEmail();
    const project = store.projectFor(email);
    if (!project.facture) return;
    const link = document.createElement("a");
    link.href = project.facture;
    link.download = project.factureNom || "facture-buttiscreen.pdf";
    document.body.append(link);
    link.click();
    link.remove();
  });

  const open = store.sessionEmail();
  if (open) render(open);
  else showMode("connexion");
})();
