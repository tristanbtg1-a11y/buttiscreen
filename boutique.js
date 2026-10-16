(() => {
  const KEY = "buttiscreen.panier.v1";
  const NOTE = "buttiscreen.panier.note";

  // Extraits Mixkit, Stock Video Free License : usage commercial, sans attribution.
  const PRODUCTS = [
    {
      id: "spot",
      nom: "Spot",
      duree: "15 à 30 secondes",
      cadre: "16:9 et 9:16",
      accroche: "Une idée, une durée courte, une chute qui reste.",
      tone: "ember",
      video: "media/produits/spot.mp4",
      extrait: "media/produits/extraits/spot.mov",
      paragraphes: [
        "Le spot part d’un message et d’un temps de lecture. On cherche le plan qui porte l’idée, puis on retire tout ce qui la retarde.",
        "Le montage se fait en une ou deux versions utiles. Quand les rushes le permettent, l’image, les titres et le niveau sonore suivent dans la même passe.",
        "Le tarif s’écrit après le brief : durée, nombre de versions, et cadres demandés.",
      ],
      inclus: ["Dérushage ciblé", "Montage et rythme", "Passe image et son", "Master nommé, prêt à diffuser"],
    },
    {
      id: "clip",
      nom: "Clip",
      duree: "Durée du morceau",
      cadre: "16:9, scope, 9:16",
      accroche: "Le montage suit la musique, pas l’inverse.",
      tone: "neon",
      video: "media/produits/clip.mp4",
      extrait: "media/produits/extraits/clip.mov",
      paragraphes: [
        "Le clip se coupe sur le morceau. On cherche les accents, les respirations, et les plans qui méritent de revenir.",
        "Plusieurs lectures sont possibles : une version principale, puis les cadres utiles pour la sortie. On ne multiplie pas les versions pour le plaisir.",
        "Le devis dépend de la durée du morceau, de la quantité de rushes, et des effets ou titres demandés.",
      ],
      inclus: ["Montage sur la musique", "Structure et retours", "Titres si le clip en a besoin", "Fichiers de diffusion"],
    },
    {
      id: "marque",
      nom: "Film de marque",
      duree: "45 secondes à 3 minutes",
      cadre: "16:9 et déclinaisons",
      accroche: "Le récit d’une société, tenu du début à la fin.",
      tone: "paper",
      video: "media/produits/marque.mp4",
      extrait: "media/produits/extraits/marque.mov",
      paragraphes: [
        "Un film de marque a besoin d’une voix, d’un rythme, et d’une fin. On construit la structure avant de peaufiner les plans.",
        "Interviews, images de lieu, archives : tout passe par le même dérushage. On garde ce qui dit quelque chose, on laisse le reste.",
        "Le tarif suit la durée finale, le nombre d’interviews, et les sorties demandées en plus du master.",
      ],
      inclus: ["Structure narrative", "Montage des interviews et des images", "Habillage sobre", "Master et une déclinaison"],
    },
    {
      id: "reseaux",
      nom: "Formats réseaux",
      duree: "6 à 60 secondes",
      cadre: "9:16, 1:1, 4:5",
      accroche: "Le même film, recadré pour là où il sera vu.",
      tone: "ember",
      video: "media/produits/reseaux.mp4",
      extrait: "media/produits/extraits/reseaux.mov",
      paragraphes: [
        "Un format réseau n’est pas un 16:9 rogné au hasard. On recompose le cadre, le rythme, et parfois le début, pour une lecture verticale.",
        "Le travail peut partir d’un film déjà monté, ou de rushes prévus pour le téléphone. Chaque cadre est une sortie nommée.",
        "Le devis dépend du nombre de formats et de la quantité de retouches de montage, pas seulement du recadrage.",
      ],
      inclus: ["Recadrage composé", "Rythme adapté à la durée", "Titres lisibles sur le téléphone", "Fichiers nommés par réseau"],
    },
    {
      id: "montage",
      nom: "Montage",
      duree: "Selon le film",
      cadre: "Cadre du tournage",
      accroche: "Structure, rythme, et seulement les versions qui aident à choisir.",
      tone: "neon",
      video: "media/produits/montage.mp4",
      extrait: "media/produits/extraits/montage.mov",
      paragraphes: [
        "Le montage seul, quand l’image et le son finaux sont prévus ailleurs. On livre une timeline qui tient, avec les versions utiles.",
        "Les retours se font sur un lien de revue. On intègre ce qui change le film, pas une liste de micro-coupes sans fin.",
        "Le tarif dépend de la durée, du volume de rushes, et du nombre d’allers-retours prévus.",
      ],
      inclus: ["Dérushage", "Première structure", "Versions de travail", "Export de revue"],
    },
    {
      id: "etalonnage",
      nom: "Étalonnage",
      duree: "Selon le montage",
      cadre: "Le cadre du master",
      accroche: "Peau, nuit, jour : une image continue d’un plan à l’autre.",
      tone: "paper",
      video: "media/produits/etalonnage.mp4",
      extrait: "media/produits/extraits/etalonnage.mov",
      paragraphes: [
        "L’étalonnage part d’un montage verrouillé. On aligne les plans, puis on cherche le contraste et la couleur qui appartiennent au film.",
        "Scène par scène, sans effet qui date dans six mois. Les références se discutent au début, pas à la dernière passe.",
        "Le devis suit le nombre de plans, la durée, et le type de rushes : log, rec.709, ou mélange des deux.",
      ],
      inclus: ["Balance des plans", "Look de l’ensemble", "Une passe de retours", "Master étalonné"],
    },
    {
      id: "habillage",
      nom: "Habillage et son",
      duree: "Selon le montage",
      cadre: "Le cadre du film",
      accroche: "Titres, cartons, sync et un niveau prêt à diffuser.",
      tone: "ember",
      video: "media/produits/habillage.mp4",
      extrait: "media/produits/extraits/habillage.mov",
      paragraphes: [
        "L’habillage reste au service du film. Titres, cartons, noms : lisibles, placés, et retirés dès qu’ils gênent.",
        "Côté son : sync, niveaux, et un mix simple de diffusion. Pas un studio sonore complet, une passe qui rend le film publiable.",
        "Le tarif dépend du nombre d’écrans, de la complexité des titres, et de l’état du son à l’arrivée.",
      ],
      inclus: ["Titres et cartons", "Sync", "Niveaux de diffusion", "Export avec habillage"],
    },
    {
      id: "declinaisons",
      nom: "Déclinaisons",
      duree: "Le film déjà monté",
      cadre: "16:9, 9:16, 1:1, 4:5, 2.39",
      accroche: "Plusieurs cadres, des fichiers nommés, prêts à partir.",
      tone: "neon",
      video: "media/produits/declinaisons.mp4",
      extrait: "media/produits/extraits/declinaisons.mov",
      paragraphes: [
        "Les déclinaisons partent d’un master validé. Chaque format est recomposé : on ne se contente pas d’un crop automatique.",
        "Masters ProRes ou H.264, fichiers nommés, prêts à poster ou à envoyer à un diffuseur.",
        "Le devis se calcule au nombre de cadres et aux retouches de montage que le nouveau cadre impose.",
      ],
      inclus: ["Recadrages composés", "Masters et fichiers légers", "Nommage clair", "Vérification des safe zones"],
    },
    {
      id: "longue",
      nom: "Durée longue",
      duree: "Au-delà de 10 minutes",
      cadre: "16:9 ou scope",
      accroche: "Garder la durée quand elle dit quelque chose.",
      tone: "paper",
      video: "media/produits/longue.mp4",
      extrait: "media/produits/extraits/longue.mov",
      paragraphes: [
        "Documentaire, récit, captation : la durée longue demande une structure avant les finitions. On regarde tout, puis on décide de ce qui reste.",
        "Le travail se découpe en étapes visibles : dérushage, première structure, montage, image et son, sorties. On peut s’arrêter plus tôt si le film est déjà là.",
        "Aucun tarif n’est affiché. La durée, le nombre d’interviews et le calendrier fixent le devis.",
      ],
      inclus: ["Dérushage complet", "Structure en chapitres", "Montage et retours", "Master de la durée retenue"],
    },
  ];

  const byId = (id) => PRODUCTS.find((product) => product.id === id);

  const read = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) || "[]");
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item) => item && byId(item.id) && item.qty > 0);
    } catch {
      return [];
    }
  };

  const remember = (items) => {
    const note = items
      .map((item) => {
        const product = byId(item.id);
        return product ? `${product.nom} × ${item.qty}` : "";
      })
      .filter(Boolean)
      .join(", ");
    if (note) sessionStorage.setItem(NOTE, `Produits dans le panier : ${note}. Tarifs sur devis.`);
    else sessionStorage.removeItem(NOTE);
  };

  const write = (items, bump) => {
    localStorage.setItem(KEY, JSON.stringify(items));
    remember(items);
    paintBadge(bump);
  };

  const add = (id) => {
    if (!byId(id)) return;
    const items = read();
    const found = items.find((item) => item.id === id);
    if (found) found.qty += 1;
    else items.push({ id, qty: 1 });
    write(items, true);
  };

  const setQty = (id, qty) => {
    const before = read().reduce((sum, item) => sum + item.qty, 0);
    const items = read()
      .map((item) => (item.id === id ? { ...item, qty } : item))
      .filter((item) => item.qty > 0);
    const after = items.reduce((sum, item) => sum + item.qty, 0);
    write(items, after > before);
  };

  const paintBadge = (bump) => {
    const total = read().reduce((sum, item) => sum + item.qty, 0);
    document.querySelectorAll("[data-cart-count]").forEach((node) => {
      node.textContent = String(total);
      node.hidden = total === 0;
    });
    document.querySelectorAll(".cart-link").forEach((link) => {
      link.setAttribute("aria-label", total ? `Mon panier, ${total}` : "Mon panier");
      if (!bump) return;
      link.classList.remove("is-bump");
      void link.offsetWidth;
      link.classList.add("is-bump");
      window.setTimeout(() => link.classList.remove("is-bump"), 700);
    });
  };

  const announce = (message) => {
    let live = document.getElementById("cart-live");
    if (!live) {
      live = document.createElement("p");
      live.id = "cart-live";
      live.className = "sr-only";
      live.setAttribute("aria-live", "polite");
      document.body.append(live);
    }
    live.textContent = message;
  };

  const motionOk = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const still = (product, large) => {
    const frame = document.createElement(large ? "div" : "a");
    frame.className = `product-still tone-${product.tone}${large ? " is-large" : ""}`;
    if (!large) {
      frame.href = `produit.html?id=${product.id}`;
      frame.setAttribute("aria-label", product.nom);
    }
    if (product.video) {
      const video = document.createElement("video");
      video.className = "product-film";
      video.src = large ? product.video : product.extrait || product.video;
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.loop = !large;
      video.setAttribute("muted", "");
      video.setAttribute("playsinline", "");
      video.preload = large || motionOk ? "auto" : "none";
      video.tabIndex = -1;
      if (large) video.setAttribute("aria-label", product.nom);
      else video.setAttribute("aria-hidden", "true");
      frame.append(video);
      if (large) bindFilm(frame, video);
      else bindHover(frame, video);
    }
    const index = document.createElement("span");
    index.textContent = String(PRODUCTS.indexOf(product) + 1).padStart(2, "0");
    const ratio = document.createElement("span");
    ratio.textContent = product.cadre;
    frame.append(index, ratio);
    return frame;
  };

  const bindHover = (frame, video) => {
    if (!motionOk) return;
    const start = () => {
      video.currentTime = 0;
      video.play().catch(() => {});
    };
    frame.addEventListener("pointerenter", (event) => {
      if (event.pointerType && event.pointerType !== "mouse") return;
      if (video.readyState >= 2) start();
      else video.addEventListener("canplay", start, { once: true });
    });
    frame.addEventListener("pointerleave", () => {
      video.pause();
      video.currentTime = 0;
    });
  };

  const bindFilm = (frame, video) => {
    video.controls = true;
    if (!motionOk) return;
    video.autoplay = true;
    let held = false;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const visible = entry.intersectionRatio >= 0.45;
        if (visible) {
          if (!held) return;
          held = false;
          video.play().catch(() => {});
          return;
        }
        if (video.paused) return;
        held = true;
        video.pause();
      });
    }, { threshold: [0, 0.45, 1] });
    observer.observe(frame);
    video.play().catch(() => {});
  };

  const addButton = (id) => {
    const button = document.createElement("button");
    button.className = "btn";
    button.type = "button";
    button.dataset.add = id;
    button.textContent = "Ajouter au panier";
    return button;
  };

  const renderShop = () => {
    const grid = document.getElementById("shop-grid");
    if (!grid) return;
    grid.replaceChildren();
    PRODUCTS.forEach((product) => {
      const card = document.createElement("article");
      card.className = "product";
      const body = document.createElement("div");
      body.className = "product-body";
      const title = document.createElement("h2");
      const titleLink = document.createElement("a");
      titleLink.href = `produit.html?id=${product.id}`;
      titleLink.textContent = product.nom;
      title.append(titleLink);
      const copy = document.createElement("p");
      copy.textContent = product.accroche;
      const price = document.createElement("p");
      price.className = "product-price";
      price.textContent = "Sur devis";
      const actions = document.createElement("div");
      actions.className = "product-actions";
      const view = document.createElement("a");
      view.className = "btn ghost";
      view.href = `produit.html?id=${product.id}`;
      view.textContent = "Voir le produit";
      actions.append(addButton(product.id), view);
      body.append(title, copy, price, actions);
      card.append(still(product), body);
      grid.append(card);
    });
  };

  const renderProduct = () => {
    const root = document.getElementById("product-root");
    if (!root) return;
    const id = new URLSearchParams(location.search).get("id");
    const product = byId(id);
    root.replaceChildren();
    const back = document.createElement("a");
    back.className = "product-back";
    back.href = "produits.html";
    back.textContent = "Produits";
    if (!product) {
      const title = document.createElement("h1");
      title.className = "order-title";
      title.textContent = "Produit introuvable.";
      const copy = document.createElement("p");
      copy.className = "lede";
      copy.textContent = "Ce film n’est pas dans la boutique.";
      root.append(back, title, copy);
      return;
    }
    document.title = `${product.nom} — BUTTISCREEN`;
    const kicker = document.createElement("p");
    kicker.className = "kicker";
    kicker.textContent = `${product.duree} · ${product.cadre}`;
    const title = document.createElement("h1");
    title.className = "order-title";
    title.append(document.createTextNode(product.nom), Object.assign(document.createElement("span"), { className: "dot", textContent: "." }));
    const price = document.createElement("p");
    price.className = "product-price";
    price.textContent = "Sur devis";
    const copy = document.createElement("div");
    copy.className = "product-copy";
    product.paragraphes.forEach((paragraph) => {
      const p = document.createElement("p");
      p.textContent = paragraph;
      copy.append(p);
    });
    const list = document.createElement("ul");
    list.className = "product-inclus";
    product.inclus.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      list.append(li);
    });
    const buy = document.createElement("div");
    buy.className = "product-buy";
    const buyNote = document.createElement("p");
    buyNote.textContent = "Tarif sur devis, après lecture du projet.";
    buy.append(buyNote, addButton(product.id));
    root.append(back, still(product, true), kicker, title, price, copy, list, buy);
  };

  const renderCart = () => {
    const root = document.getElementById("cart-root");
    if (!root) return;
    const items = read();
    root.replaceChildren();
    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "lede";
      empty.textContent = "Le panier est vide.";
      const link = document.createElement("a");
      link.className = "btn";
      link.href = "produits.html";
      link.textContent = "Voir les produits";
      root.append(empty, link);
      return;
    }
    const list = document.createElement("div");
    list.className = "cart-list";
    items.forEach((item) => {
      const product = byId(item.id);
      const row = document.createElement("article");
      row.className = "cart-row";
      const name = document.createElement("div");
      const title = document.createElement("h2");
      const titleLink = document.createElement("a");
      titleLink.href = `produit.html?id=${product.id}`;
      titleLink.textContent = product.nom;
      title.append(titleLink);
      const meta = document.createElement("p");
      meta.textContent = "Sur devis";
      name.append(title, meta);
      const qty = document.createElement("div");
      qty.className = "qty";
      const minus = document.createElement("button");
      minus.type = "button";
      minus.dataset.qty = "-1";
      minus.dataset.id = product.id;
      minus.setAttribute("aria-label", `Retirer un ${product.nom}`);
      minus.textContent = "−";
      const count = document.createElement("span");
      count.textContent = String(item.qty);
      const plus = document.createElement("button");
      plus.type = "button";
      plus.dataset.qty = "1";
      plus.dataset.id = product.id;
      plus.setAttribute("aria-label", `Ajouter un ${product.nom}`);
      plus.textContent = "+";
      qty.append(minus, count, plus);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "cart-remove";
      remove.dataset.remove = product.id;
      remove.textContent = "Retirer";
      row.append(name, qty, remove);
      list.append(row);
    });
    const foot = document.createElement("div");
    foot.className = "cart-foot";
    const note = document.createElement("p");
    note.textContent = "Tarifs sur devis. Le panier reste dans ce navigateur.";
    const devis = document.createElement("a");
    devis.className = "btn";
    devis.href = "tunnel.html";
    devis.textContent = "Demander un devis";
    foot.append(note, devis);
    root.append(list, foot);
  };

  document.addEventListener("click", (event) => {
    const addTarget = event.target.closest("[data-add]");
    if (addTarget) {
      const product = byId(addTarget.dataset.add);
      add(addTarget.dataset.add);
      addTarget.textContent = "Ajouté";
      window.setTimeout(() => {
        addTarget.textContent = "Ajouter au panier";
      }, 1200);
      if (product) announce(`${product.nom} ajouté au panier.`);
      renderCart();
      return;
    }
    const qtyTarget = event.target.closest("[data-qty]");
    if (qtyTarget) {
      const items = read();
      const current = items.find((item) => item.id === qtyTarget.dataset.id);
      if (current) setQty(current.id, Math.max(1, current.qty + Number(qtyTarget.dataset.qty)));
      renderCart();
      return;
    }
    const removeTarget = event.target.closest("[data-remove]");
    if (removeTarget) {
      setQty(removeTarget.dataset.remove, 0);
      renderCart();
    }
  });

  const bindMenu = () => {
    const menu = document.getElementById("menu");
    const menuBtn = document.querySelector(".menu-btn");
    if (!menu || !menuBtn || menuBtn.dataset.bound) return;
    menuBtn.dataset.bound = "1";
    const close = () => {
      menu.hidden = true;
      menuBtn.setAttribute("aria-expanded", "false");
      menuBtn.textContent = "Menu";
      document.body.classList.remove("menu-open");
    };
    menuBtn.addEventListener("click", () => {
      const open = menu.hidden;
      menu.hidden = !open;
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
      menuBtn.textContent = open ? "Fermer" : "Menu";
      document.body.classList.toggle("menu-open", open);
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

  paintBadge();
  renderShop();
  renderProduct();
  renderCart();
  if (document.body.hasAttribute("data-shop")) bindMenu();
})();
