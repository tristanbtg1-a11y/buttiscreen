(() => {
  const store = window.ButtiCommande;
  const auth = document.getElementById("auth");
  const board = document.getElementById("board");
  const form = document.getElementById("compte");
  const studio = document.getElementById("studio-field");
  const status = document.getElementById("compte-status");
  const submit = document.getElementById("compte-submit");
  const formError = document.getElementById("compte-error");
  const live = document.getElementById("compte-live");

  const OWNER = "tristan.buttig1@gmail.com";

  const setStatus = (message) => {
    if (status) status.textContent = message;
  };

  const setError = (message) => {
    formError.hidden = !message;
    formError.textContent = message || "";
    live.textContent = message || "";
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
  let receipt = null;

  const isPaid = (data) => RANK.indexOf(data && data.etat) > 0;

  const dateLong = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Europe/Paris",
    }).format(date);
  };

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
      const answer = await window.ButtiAuth.devis();
      const data = answer.status === 200 ? answer.json : null;
      const amount = formatEuros(data && data.montant);
      receipt = data;
      paintSlip(data);
      if (data && data.etat) applyEtat(email, data.etat);
      if (isPaid(data)) {
        paintPayment();
        return;
      }
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

  const esc = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const orderLines = (detail, projet) => {
    const source = String(detail || "").trim();
    const parts = source
      ? source.split(",").map((part) => part.trim()).filter(Boolean)
      : [];
    const lines = parts.map((part) => {
      const match = part.match(/^(.+?)\s*[×x]\s*(\d+)$/i);
      if (!match) return { nom: part, qte: 1 };
      return { nom: match[1].trim(), qte: Number(match[2]) || 1 };
    });
    if (lines.length) return lines;
    if (projet) return [{ nom: projet, qte: 1 }];
    return [];
  };

  const orderReference = (nom, date) => {
    const parsed = new Date(date);
    const when = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    const parts = new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris",
      month: "2-digit",
      year: "2-digit",
    }).formatToParts(when);
    const month = (parts.find((part) => part.type === "month") || {}).value || "01";
    const year = (parts.find((part) => part.type === "year") || {}).value || "00";
    const name = String(nom || "client").replace(/"/g, "").trim() || "client";
    return `01"${name}"dev1${month}${year}`;
  };

  const paintSlip = (data) => {
    const slip = document.getElementById("order-slip");
    const list = document.getElementById("order-lines");
    const facts = document.getElementById("order-facts");
    const ref = document.getElementById("order-ref");
    if (!slip || !list || !facts || !ref) return;
    const montant = Number(String((data && data.montant) || "").replace(",", "."));
    const lines = orderLines(data && data.detail, data && data.projet);
    if (!lines.length && !(montant > 0)) {
      slip.hidden = true;
      return;
    }
    const date = new Date(data && data.cree);
    const dateLabel = Number.isNaN(date.getTime())
      ? ""
      : new Intl.DateTimeFormat("fr-FR", {
          day: "numeric",
          month: "long",
          year: "numeric",
          timeZone: "Europe/Paris",
        }).format(date);
    const price = formatEuros(montant);
    const rows = [];
    if (dateLabel) rows.push(["Date", dateLabel]);
    if (price) rows.push(["Prix unitaire", price], ["Total", price]);
    ref.textContent = orderReference(data && data.nom, data && data.cree);
    list.innerHTML = lines
      .map((line) => `<li><span>${esc(line.nom)}</span><span>× ${esc(line.qte)}</span></li>`)
      .join("");
    facts.innerHTML = rows
      .map(
        ([label, value]) =>
          `<div class="${label === "Total" ? "is-total" : ""}"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`
      )
      .join("");
    slip.hidden = false;
  };

  const briefNote = (kept) => {
    const note = document.getElementById("brief-note");
    if (!note) return;
    note.innerHTML = kept
      ? "Ce brief est conservé 90 jours par le studio. Pour le compléter, répondez à l’accusé de réception ou écrivez à <a href=\"mailto:contact@buttiscreen.fr\">contact@buttiscreen.fr</a>."
      : "Une copie de ce brief reste dans ce navigateur. Pour le compléter, répondez à l’accusé de réception ou écrivez à <a href=\"mailto:contact@buttiscreen.fr\">contact@buttiscreen.fr</a>.";
  };

  const requestBtn = document.getElementById("brief-request");
  const briefStatus = document.getElementById("brief-status");
  const pageOpened = Date.now() - 4000;

  // Connecté sans brief sur cet appareil : proposer le lien par e-mail.
  const paintBrief = (email) => {
    const card = document.getElementById("brief-card");
    if (!card) return;
    const brief = window.ButtiBrief && window.ButtiBrief.latestFor(email);
    if (brief) {
      showBrief(brief, false);
      return;
    }
    document.getElementById("brief-card-title").textContent = "Votre brief";
    document.getElementById("brief-facts").innerHTML = "";
    document.getElementById("brief-message").textContent = "";
    briefNote(false);
    const note = document.getElementById("brief-note");
    if (note) note.textContent = "Votre brief n’est pas affiché sur cet appareil. Recevez son lien personnel par e-mail pour le retrouver.";
    if (requestBtn) {
      requestBtn.hidden = false;
      requestBtn.dataset.email = email;
    }
    card.hidden = false;
  };

  const showBrief = (brief, kept) => {
    const card = document.getElementById("brief-card");
    if (!card) return;
    if (requestBtn) requestBtn.hidden = true;
    if (briefStatus) briefStatus.textContent = "";
    briefNote(kept);
    const rows = [["Projet", brief.projet]];
    if (brief.duree) rows.push(["Durée", brief.duree]);
    if (brief.diffusion) rows.push(["Diffusion", brief.diffusion]);
    if (brief.creneau) rows.push(["Créneau", brief.creneau]);
    const sent = dateLong(brief.cree);
    if (sent) rows.push(["Envoyé le", sent]);
    document.getElementById("brief-card-title").textContent = brief.nom ? `Brief de ${brief.nom}` : "Brief envoyé";
    document.getElementById("brief-facts").innerHTML = rows
      .filter(([, value]) => value)
      .map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`)
      .join("");
    document.getElementById("brief-message").textContent = brief.message || "";
    card.hidden = false;
  };

  const sendLink = async (email, statusEl) => {
    const ok = await (window.ButtiBrief ? window.ButtiBrief.requestLink(email, pageOpened) : false);
    if (statusEl) {
      statusEl.textContent = ok
        ? "Si un brief existe pour cette adresse, un e-mail vient de partir. Pensez à regarder vos courriers indésirables."
        : "L’envoi n’a pas abouti. Réessayez dans un instant, ou écrivez à contact@buttiscreen.fr.";
    }
  };

  requestBtn?.addEventListener("click", async () => {
    requestBtn.disabled = true;
    await sendLink(requestBtn.dataset.email || "", briefStatus);
    requestBtn.disabled = false;
  });

  // Lien personnel de l'accusé de réception : le brief s'affiche sur n'importe quel appareil, sans connexion.
  const openFromLink = async () => {
    const login = location.hash.match(/^#connexion=([0-9a-f]{32})$/);
    if (login) {
      history.replaceState(null, "", location.pathname + location.search);
      setStatus("Connexion en cours…");
      const result = await window.ButtiAuth.verify(login[1]);
      if (!result.ok) {
        setStatus(
          result.offline
            ? "Connexion impossible pour le moment. Réessayez dans un instant."
            : "Ce lien a expiré ou a déjà servi. Saisissez votre e-mail pour en recevoir un nouveau."
        );
        return;
      }
      await enter(result.email);
      return;
    }
    const match = location.hash.match(/^#brief=([0-9a-f]{32})$/);
    if (!match || !window.ButtiBrief) return;
    history.replaceState(null, "", location.pathname + location.search);
    const result = await window.ButtiBrief.fetchById(match[1]);
    const status = document.getElementById("brief-find-status");
    if (result.ok) {
      window.ButtiBrief.save(result.brief);
      showBrief(result.brief, true);
    } else if (status) {
      status.textContent = result.gone
        ? "Ce lien a expiré ou n’existe plus. Saisissez votre e-mail pour en recevoir un nouveau."
        : "Le brief ne se charge pas pour le moment. Réessayez dans un instant.";
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

  const RANK = ["brief", "preparation", "montage", "etalonnage", "livraison"];

  const applyEtat = (email, etat) => {
    if (!RANK.includes(etat)) return;
    const project = store.projectFor(email);
    if (RANK.indexOf(etat) <= RANK.indexOf(project.etat || "brief")) return;
    store.setEtat(email, etat); // cache de l'appareil seulement : la fiche de la gestion est écrite par le Worker
    render(email, true);
  };

  const paintPayment = () => {
    const pay = document.getElementById("pay");
    const note = document.getElementById("pay-note");
    const invoice = document.getElementById("invoice");
    const invoiceNote = document.getElementById("invoice-note");
    const project = store.projectFor(payEmail || store.sessionEmail());
    const paid = isPaid(receipt);
    if (pay) {
      pay.hidden = paid;
      if (paid) {
        pay.removeAttribute("href");
        pay.setAttribute("aria-disabled", "true");
        pay.classList.add("is-wait");
      }
    }
    if (note && paid) {
      const when = dateLong(receipt.regle) || dateLong(receipt.cree);
      note.textContent = when ? `Devis réglé le ${when}.` : "Devis réglé.";
      note.classList.add("is-paid");
    }
    const ready = Boolean(project.facture) || paid;
    if (invoice) invoice.disabled = !ready;
    if (invoiceNote) invoiceNote.hidden = ready;
    syncRushes();
    syncFinalPay();
  };

  const finalPayUrl = () => {
    const url = (receipt && (receipt.url || receipt.lien)) || "";
    return stripeUrl(url) ? url : "";
  };

  const syncFinalPay = () => {
    const button = document.getElementById("final-pay");
    if (!button) return;
    const project = store.projectFor(payEmail || store.sessionEmail());
    button.hidden = project.etat !== "livraison";
  };

  const paintFinalPay = () => {
    const lines = document.getElementById("final-pay-lines");
    const amount = document.getElementById("final-pay-amount");
    const go = document.getElementById("final-pay-go");
    const wait = document.getElementById("final-pay-wait");
    if (!lines || !amount || !go || !wait) return;
    const project = store.projectFor(payEmail || store.sessionEmail());
    const rows = orderLines(receipt && receipt.detail, (receipt && receipt.projet) || project.titre);
    const price = formatEuros(receipt && receipt.montant);
    lines.innerHTML = rows
      .map((line) => `<li><span>${esc(line.nom)}</span><span>× ${esc(line.qte)}</span></li>`)
      .join("");
    amount.textContent = price ? `À régler ${price}` : "Tarif à confirmer";
    const url = finalPayUrl();
    if (url) {
      go.href = url;
      go.hidden = false;
      wait.hidden = true;
    } else {
      go.removeAttribute("href");
      go.hidden = true;
      wait.hidden = false;
    }
  };

  const rushSlug = (value) =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 24);

  const rushParts = (original) => {
    const ext = (String(original).match(/(\.[a-z0-9]{1,8})$/i) || [""])[0].toLowerCase();
    const stem =
      String(original)
        .replace(/\.[^.]+$/, "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40) || "fichier";
    return { stem, ext };
  };

  const rushType = (file, ext) => {
    const given = String(file.type || "").split(";")[0].trim().toLowerCase();
    if (/^[\w.+-]+\/[\w.+-]+$/.test(given)) return given;
    const known = {
      ".mov": "video/quicktime",
      ".mp4": "video/mp4",
      ".m4v": "video/mp4",
      ".mxf": "application/mxf",
      ".wav": "audio/wav",
      ".aif": "audio/aiff",
      ".aiff": "audio/aiff",
      ".mp3": "audio/mpeg",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
      ".txt": "text/plain",
    };
    return known[ext] || "application/octet-stream";
  };

  const FILES_KEY = "buttiscreen.fichiers.v1";

  const fileKey = (email) => String(email || "").trim().toLowerCase();

  const readFiles = (email) => {
    try {
      const all = JSON.parse(localStorage.getItem(FILES_KEY) || "{}");
      const list = all[fileKey(email)];
      return Array.isArray(list)
        ? list.filter((name) => typeof name === "string" && name.trim() && !/^https?:/i.test(name))
        : [];
    } catch {
      return [];
    }
  };

  const rememberFile = (email, name) => {
    const clean = String(name || "").trim();
    const key = fileKey(email);
    if (!key || !clean || /^https?:/i.test(clean)) return;
    let all = {};
    try {
      all = JSON.parse(localStorage.getItem(FILES_KEY) || "{}");
    } catch {
      all = {};
    }
    const list = Array.isArray(all[key]) ? all[key].filter((item) => item !== clean) : [];
    list.push(clean);
    all[key] = list.slice(-200);
    localStorage.setItem(FILES_KEY, JSON.stringify(all));
  };

  const paintLibrary = () => {
    const list = document.getElementById("rush-library-list");
    const empty = document.getElementById("rush-library-empty");
    const box = document.getElementById("rush-box");
    if (!list || !empty || !box) return;
    const files = readFiles(box.dataset.email || store.sessionEmail());
    list.innerHTML = "";
    files.forEach((name) => {
      const item = document.createElement("li");
      item.textContent = name;
      list.append(item);
    });
    empty.hidden = files.length > 0;
    list.hidden = files.length === 0;
  };

  const syncRushes = () => {
    const box = document.getElementById("rush-box");
    if (!box) return;
    const email = payEmail || store.sessionEmail();
    const project = store.projectFor(email);
    const etat = (receipt && receipt.etat) || project.etat;
    box.hidden = etat !== "preparation";
    box.dataset.email = email || "";
    box.dataset.nom = (receipt && receipt.nom) || "";
  };

  const sendRush = async (file, name, state, slug) => {
    const email = document.getElementById("rush-box").dataset.email || store.sessionEmail();
    const { stem, ext } = rushParts(file.name);
    const type = rushType(file, ext);
    state.textContent = "Envoi";
    let data = null;
    try {
      const answer = await window.ButtiAuth.rushes({
        nom: document.getElementById("rush-box").dataset.nom || "",
        slug,
        stem,
        ext,
        size: file.size,
        type,
      });
      data = answer.json;
    } catch {
      state.textContent = "Échec";
      return false;
    }
    const fileInfo = data && (data.file && (data.file.data || data.file));
    const parts = (fileInfo && fileInfo.upload_urls) || (data && data.parts) || [];
    if (!data || !data.ok || !parts.length) {
      state.textContent = "Échec";
      return false;
    }
    if (fileInfo && fileInfo.name) name.textContent = fileInfo.name;
    else if (data.name) name.textContent = data.name;
    const contentType = (fileInfo && fileInfo.media_type) || data.type || type;
    let offset = 0;
    for (const part of parts) {
      const length = Number(part.size) || file.size - offset;
      const chunk = file.slice(offset, offset + length);
      offset += length;
      try {
        const put = await fetch(part.url, {
          method: "PUT",
          headers: {
            "Content-Type": contentType,
            "x-amz-acl": "private",
          },
          body: chunk,
        });
        if (!put.ok) {
          state.textContent = "Échec";
          return false;
        }
      } catch {
        state.textContent = "Échec";
        return false;
      }
    }
    state.textContent = "Envoyé";
    rememberFile(email, name.textContent);
    if (document.getElementById("rush-library-dialog")?.open) paintLibrary();
    return true;
  };

  const takeRushes = async (files) => {
    const list = document.getElementById("rush-list");
    const note = document.getElementById("rush-note");
    const box = document.getElementById("rush-box");
    const incoming = [...(files || [])].filter((file) => file && file.size > 0);
    if (!incoming.length || !list || !box) return;
    const email = box.dataset.email || store.sessionEmail();
    const slug = rushSlug(box.dataset.nom) || rushSlug(String(email).split("@")[0]) || "client";
    if (note) note.textContent = "Envoi en cours.";
    let sent = 0;
    for (const file of incoming) {
      const item = document.createElement("li");
      const name = document.createElement("strong");
      const state = document.createElement("span");
      const { stem, ext } = rushParts(file.name);
      name.textContent = `${slug}_rush_${stem}${ext}`;
      state.textContent = "Envoi";
      item.append(name, state);
      list.prepend(item);
      if (await sendRush(file, name, state, slug)) sent += 1;
    }
    if (note) {
      note.textContent =
        sent === incoming.length
          ? sent > 1
            ? `${sent} fichiers envoyés dans clients / ${slug} / rushes.`
            : `Fichier envoyé dans clients / ${slug} / rushes.`
          : "Une partie des fichiers n'a pas été envoyée. Réessayez.";
    }
  };

  const render = (email, quiet) => {
    const gestionBtn = document.getElementById("gestion-open");
    if (gestionBtn) gestionBtn.hidden = email !== OWNER;
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
    paintPayment();
    paintBrief(email);
    auth.hidden = true;
    board.hidden = false;
    if (!quiet) {
      board.focus();
      lookupPay(email);
      watchPayment(email);
    }
  };

  const watchPayment = (email) => {
    let tries = 0;
    const fromStripe = document.referrer.includes("stripe.com");
    const timer = setInterval(() => {
      tries += 1;
      const project = store.projectFor(email);
      if ((project.etat && project.etat !== "brief") || tries > (fromStripe ? 8 : 2)) {
        clearInterval(timer);
        return;
      }
      lookupPay(email);
    }, 2000);
  };

  const leave = () => {
    form.reset();
    if (studio) studio.hidden = true;
    submit.textContent = "Recevoir mon lien de connexion";
    board.hidden = true;
    auth.hidden = false;
  };

  // Affiche le compte tout de suite depuis l'appareil, puis le remet à jour depuis le serveur.
  const enter = async (email) => {
    render(email);
    const data = await window.ButtiAuth.me();
    if (data.expired) {
      leave();
      setStatus("Votre session a expiré. Saisissez votre e-mail pour recevoir un nouveau lien.");
      return;
    }
    if (!data.ok) return;
    store.mergeServer(data.email, data.projet);
    if (data.brief && window.ButtiBrief) window.ButtiBrief.save(data.brief);
    render(data.email, true);
  };

  // L'accès studio (mot de passe, vers la gestion) reste à part : par défaut, toute adresse reçoit un lien.
  document.getElementById("studio-toggle")?.addEventListener("click", () => {
    studio.hidden = !studio.hidden;
    submit.textContent = studio.hidden ? "Recevoir mon lien de connexion" : "Entrer";
    setError("");
    if (!studio.hidden) form.querySelector('[name="motdepasse"]').focus();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const email = String(data.get("email") || "").trim().toLowerCase();
    const password = String(data.get("motdepasse") || "");
    if (!store.validEmail(email)) {
      setError("Indiquez une adresse e-mail valide.");
      return;
    }
    if (!studio.hidden) {
      if (email !== OWNER) {
        setError("Cet accès est réservé au studio.");
        return;
      }
      submit.disabled = true;
      setError("");
      try {
        const response = await fetch(HOOK, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "login", email, password }),
        });
        const payload = await response.json().catch(() => null);
        if (response.ok && payload && payload.ok !== false && payload.token) {
          sessionStorage.setItem(
            "buttiscreen.gestion.v1",
            JSON.stringify({ email, token: String(payload.token) }),
          );
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
    submit.disabled = true;
    setError("");
    const result = await window.ButtiAuth.requestLink(email);
    submit.disabled = false;
    if (!result.ok) {
      setError(
        result.limited
          ? "Trop de demandes. Réessayez dans une heure."
          : "L’envoi n’a pas abouti. Réessayez dans un instant, ou écrivez à contact@buttiscreen.fr."
      );
      return;
    }
    setStatus(
      "Si cette adresse est la vôtre, un e-mail de connexion vient de partir. Il est valable 15 minutes. Pensez à regarder vos courriers indésirables."
    );
  });

  // La gestion a sa propre page : la connexion y passe par le lien studio.
  document.getElementById("gestion-open")?.addEventListener("click", () => {
    window.location.href = "gestion.html";
  });

  document.getElementById("logout").addEventListener("click", async () => {
    await window.ButtiAuth.logout();
    leave();
    setStatus("Vous êtes déconnecté. Le lien de connexion est valable 15 minutes et ne sert qu’une fois.");
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

  const pdfLiteral = (value) => {
    const text = String(value ?? "")
      .replace(/\u202f|\u00a0/g, " ")
      .replace(/€/g, "EUR")
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/—/g, "-")
      .replace(/×/g, "x");
    let out = "";
    for (const char of text) {
      const code = char.charCodeAt(0);
      if (char === "\\") out += "\\\\";
      else if (char === "(" || char === ")") out += `\\${char}`;
      else if (code >= 32 && code <= 126) out += char;
      else if (code >= 160 && code <= 255) out += `\\${code.toString(8).padStart(3, "0")}`;
      else out += " ";
    }
    return out;
  };

  const buildInvoicePdf = (data, email) => {
    const when = dateLong(data.regle) || dateLong(data.cree);
    const ref = orderReference(data.nom, data.regle || data.cree);
    const lines = orderLines(data.detail, data.projet);
    const price = formatEuros(data.montant) || "0,00 EUR";
    const ops = ["0 826 595 8 re 1 0.478 0.102 rg f"];
    let y = 786;
    const write = (font, size, x, value, color = "0 0 0") => {
      ops.push(`BT ${color} rg /${font} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${pdfLiteral(value)}) Tj ET`);
    };
    const down = (amount) => {
      y -= amount;
    };
    write("F2", 22, 48, "BUTTISCREEN");
    down(28);
    write("F1", 11, 48, "Studio de montage vid\u00e9o");
    down(16);
    write("F1", 11, 48, "contact@buttiscreen.fr");
    down(28);
    write("F2", 16, 48, "FACTURE");
    down(24);
    write("F2", 14, 48, ref);
    down(22);
    write("F1", 12, 48, when ? `Devis r\u00e9gl\u00e9 le ${when}` : "Devis r\u00e9gl\u00e9");
    down(32);
    write("F1", 10, 48, "CLIENT", "0.4 0.4 0.4");
    down(16);
    write("F2", 13, 48, data.nom || "Client");
    down(18);
    write("F1", 12, 48, email);
    down(28);
    if (data.projet) {
      write("F1", 10, 48, "PROJET", "0.4 0.4 0.4");
      down(16);
      write("F1", 12, 48, data.projet);
      down(28);
    }
    ops.push(`48 ${y + 8} 499 0.4 re 0.85 0.85 0.85 rg f`);
    write("F1", 10, 48, "D\u00c9SIGNATION", "0.4 0.4 0.4");
    write("F1", 10, 470, "QT\u00c9", "0.4 0.4 0.4");
    down(22);
    lines.forEach((line) => {
      write("F1", 12, 48, line.nom);
      write("F1", 12, 470, String(line.qte));
      down(20);
    });
    down(8);
    ops.push(`48 ${y + 10} 499 0.4 re 0.85 0.85 0.85 rg f`);
    write("F1", 12, 48, "Prix unitaire");
    write("F1", 12, 430, price);
    down(22);
    write("F2", 14, 48, "Total", "1 0.478 0.102");
    write("F2", 14, 430, price, "1 0.478 0.102");
    down(36);
    write("F1", 12, 48, "Facture acquitt\u00e9e.");
    down(28);
    write("F1", 9, 48, "Document \u00e9mis par buttiscreen.fr apr\u00e8s r\u00e8glement du devis.", "0.4 0.4 0.4");
    const stream = ops.join("\n");
    const objects = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>",
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    ];
    let body = "%PDF-1.4\n";
    const offsets = [0];
    objects.forEach((object, index) => {
      offsets.push(body.length);
      body += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });
    const xref = body.length;
    body += `xref\n0 ${objects.length + 1}\n`;
    body += "0000000000 65535 f \n";
    offsets.slice(1).forEach((offset) => {
      body += `${String(offset).padStart(10, "0")} 00000 n \n`;
    });
    body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return body;
  };

  const saveFile = (href, name) => {
    const link = document.createElement("a");
    link.href = href;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
  };

  document.getElementById("invoice").addEventListener("click", () => {
    const email = store.sessionEmail();
    const project = store.projectFor(email);
    if (project.facture) {
      saveFile(project.facture, project.factureNom || "facture-buttiscreen.pdf");
      return;
    }
    if (!isPaid(receipt)) return;
    const ref = orderReference(receipt.nom, receipt.regle || receipt.cree).replace(/[^\w.-]+/g, "");
    const pdf = buildInvoicePdf(receipt, email);
    const url = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
    saveFile(url, `facture-${ref || "buttiscreen"}.pdf`);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  });

  const rushDrop = document.getElementById("rush-drop");
  const rushInput = document.getElementById("rush-files");
  if (rushDrop && rushInput) {
    ["dragenter", "dragover"].forEach((type) => {
      rushDrop.addEventListener(type, (event) => {
        event.preventDefault();
        rushDrop.classList.add("is-over");
      });
    });
    rushDrop.addEventListener("dragleave", (event) => {
      if (!rushDrop.contains(event.relatedTarget)) rushDrop.classList.remove("is-over");
    });
    rushDrop.addEventListener("drop", (event) => {
      event.preventDefault();
      rushDrop.classList.remove("is-over");
      takeRushes(event.dataTransfer && event.dataTransfer.files);
    });
    rushInput.addEventListener("change", () => {
      takeRushes(rushInput.files);
      rushInput.value = "";
    });
  }

  const rushLibrary = document.getElementById("rush-library");
  const rushDialog = document.getElementById("rush-library-dialog");
  const rushLibraryClose = document.getElementById("rush-library-close");
  if (rushLibrary && rushDialog) {
    rushLibrary.addEventListener("click", () => {
      paintLibrary();
      if (!rushDialog.open) rushDialog.showModal();
    });
    rushLibraryClose?.addEventListener("click", () => rushDialog.close());
    rushDialog.addEventListener("click", (event) => {
      if (event.target === rushDialog) rushDialog.close();
    });
    rushDialog.addEventListener("close", () => rushLibrary.focus());
  }

  const archive = window.ButtiConversation;
  const chatOpen = document.getElementById("chat-open");
  const chatDialog = document.getElementById("chat-dialog");
  const chatClose = document.getElementById("chat-close");
  const chatForm = document.getElementById("chat-form");
  const chatLog = document.getElementById("chat-log");
  const chatEmpty = document.getElementById("chat-empty");
  const chatStatus = document.getElementById("chat-status");
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
    if (!chatLog || !chatEmpty) return;
    const rows = archive ? archive.readThread(store.sessionEmail()) : [];
    chatLog.innerHTML = "";
    rows.forEach((row) => {
      const item = document.createElement("li");
      if (row.from === "studio") item.classList.add("is-studio");
      const who = document.createElement("strong");
      const time = document.createElement("time");
      const text = document.createElement("p");
      who.textContent = row.from === "studio" ? "Studio" : "Vous";
      time.dateTime = row.cree;
      time.textContent = chatWhen(row.cree);
      text.textContent = row.texte;
      item.append(who, time, text);
      chatLog.append(item);
    });
    chatEmpty.hidden = rows.length > 0;
    chatLog.hidden = rows.length === 0;
    chatLog.scrollTop = chatLog.scrollHeight;
  };
  if (chatOpen && chatDialog && archive) {
    chatOpen.addEventListener("click", () => {
      if (chatStatus) chatStatus.textContent = "";
      paintChat();
      if (!chatDialog.open) chatDialog.showModal();
    });
    chatClose?.addEventListener("click", () => chatDialog.close());
    chatDialog.addEventListener("click", (event) => {
      if (event.target === chatDialog) chatDialog.close();
    });
    chatDialog.addEventListener("close", () => chatOpen.focus());
    chatForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      const field = document.getElementById("chat-text");
      const saved = archive.append(store.sessionEmail(), "client", field.value);
      if (!saved) {
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

  const finalPay = document.getElementById("final-pay");
  const finalDialog = document.getElementById("final-pay-dialog");
  if (finalPay && finalDialog) {
    finalPay.addEventListener("click", () => {
      paintFinalPay();
      if (!finalDialog.open) finalDialog.showModal();
    });
    document.getElementById("final-pay-close")?.addEventListener("click", () => finalDialog.close());
    finalDialog.addEventListener("click", (event) => {
      if (event.target === finalDialog) finalDialog.close();
    });
    finalDialog.addEventListener("close", () => finalPay.focus());
  }

  window.addEventListener("storage", (event) => {
    if (event.key !== "buttiscreen.commande.v1" || board.hidden) return;
    const email = store.sessionEmail();
    if (email) render(email, true);
  });

  const open = store.sessionEmail();
  if (open) enter(open);
  openFromLink();
})();
