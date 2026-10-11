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
  };

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => showMode(button.dataset.mode));
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const email = String(data.get("email") || "");
    const password = String(data.get("motdepasse") || "");
    const confirm = String(data.get("confirmation") || "");
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
