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
      const response = await fetch(HOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "payer", email }),
      });
      const data = await response.json().catch(() => null);
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
    store.saveProject(email, { ...project, etat });
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
  };

  const render = (email, quiet) => {
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

  const open = store.sessionEmail();
  if (open) render(open);
  else showMode("connexion");
})();
