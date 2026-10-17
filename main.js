(function () {
  const FPS = 25;
  const FRAMES_PER_SHOT = 50;
  const PROGRAM_SECONDS = 90;

  const header = document.getElementById("header");
  const menu = document.getElementById("menu");
  const menuBtn = document.querySelector(".menu-btn");
  const monitor = document.getElementById("monitor");
  const screen = document.getElementById("screen");
  const shots = monitor ? [...monitor.querySelectorAll(".shot")] : [];
  const loopFrames = shots.length * FRAMES_PER_SHOT;
  const playBtn = document.getElementById("play");
  const scrub = document.getElementById("scrub");
  const monitorTc = document.getElementById("monitor-tc");
  const shotLabel = document.getElementById("shot-label");
  const shotTc = document.getElementById("shot-tc");
  const recLabel = document.getElementById("rec-label");
  const pageTc = document.getElementById("page-tc");
  const playhead = document.getElementById("playhead");
  const clips = [...document.querySelectorAll(".clip")];
  const sections = clips
    .map((clip) => document.querySelector(clip.getAttribute("href")))
    .filter(Boolean);
  const dialog = document.getElementById("viewer");
  const showreel = document.getElementById("showreel");
  const cards = [...document.querySelectorAll(".card")];
  const form = document.getElementById("brief");
  const success = document.getElementById("form-success");
  const formStatus = document.getElementById("form-status");
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const pad = (n) => String(n).padStart(2, "0");

  function formatTimecode(totalFrames) {
    const frames = ((totalFrames % FPS) + FPS) % FPS;
    const totalSeconds = Math.floor(totalFrames / FPS);
    const s = ((totalSeconds % 60) + 60) % 60;
    const m = Math.floor(totalSeconds / 60) % 60;
    const h = Math.floor(totalSeconds / 3600);
    return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(frames)}`;
  }

  let frame = 0;
  let wantPlay = false;
  let onScreen = false;
  let pinned = false;
  let last = 0;
  let acc = 0;

  function playingNow() {
    return Boolean(
      wantPlay &&
        (onScreen || pinned) &&
        !document.hidden &&
        !(dialog && dialog.open) &&
        !(showreel && showreel.open) &&
        !document.querySelector("dialog.welcome[open]") &&
        !motion.matches
    );
  }

  function renderMonitor() {
    if (!shots.length) return;
    const index = Math.floor(frame / FRAMES_PER_SHOT) % shots.length;
    shots.forEach((shot, i) => shot.classList.toggle("is-on", i === index));
    const label = shots[index].dataset.label || "";
    if (shotLabel) shotLabel.textContent = label;
    const tc = formatTimecode(frame);
    if (monitorTc) monitorTc.textContent = tc;
    if (shotTc) shotTc.textContent = tc;
    if (scrub) {
      scrub.value = String(frame);
      scrub.setAttribute("aria-valuetext", tc);
    }
    const playing = playingNow();
    if (playBtn) {
      playBtn.textContent = playing ? "Pause" : "Lecture";
      playBtn.setAttribute("aria-pressed", playing ? "true" : "false");
      playBtn.setAttribute(
        "aria-label",
        `${playing ? "Mettre en pause" : "Lire"}, plan ${label}`
      );
    }
    if (recLabel) recLabel.textContent = playing ? "REC" : "STBY";
    if (monitor) monitor.classList.toggle("is-playing", playing);
  }

  function setFrame(next) {
    if (!loopFrames) return;
    frame = ((next % loopFrames) + loopFrames) % loopFrames;
    renderMonitor();
  }

  function togglePlay() {
    wantPlay = !wantPlay;
    pinned = wantPlay;
    last = performance.now();
    acc = 0;
    renderMonitor();
  }

  if (scrub) scrub.max = String(Math.max(loopFrames - 1, 0));

  if (monitor && shots.length) {
    wantPlay = !motion.matches;
    const observer = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        if (!onScreen) pinned = false;
        last = performance.now();
        renderMonitor();
      },
      { threshold: 0.12 }
    );
    observer.observe(monitor);

    document.addEventListener("visibilitychange", () => {
      last = performance.now();
      renderMonitor();
    });

    playBtn?.addEventListener("click", togglePlay);
    screen?.addEventListener("click", togglePlay);

    scrub?.addEventListener("input", () => {
      wantPlay = false;
      setFrame(Number(scrub.value));
    });

    monitor.addEventListener("keydown", (event) => {
      if (event.target === scrub) return;
      if (event.key === " " || event.code === "Space") {
        event.preventDefault();
        togglePlay();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        wantPlay = false;
        setFrame(frame + 1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        wantPlay = false;
        setFrame(frame - 1);
      }
    });

    function tick(now) {
      if (!last) last = now;
      if (playingNow()) {
        acc += now - last;
        const step = 1000 / FPS;
        const advance = Math.floor(acc / step);
        if (advance > 0) {
          acc -= advance * step;
          setFrame(frame + advance);
        }
      } else if (monitor && !monitor.classList.contains("is-playing") && wantPlay) {
        renderMonitor();
      }
      last = now;
      requestAnimationFrame(tick);
    }

    renderMonitor();
    requestAnimationFrame(tick);
  }

  function updateTimeline() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const progress = max <= 0 ? 0 : Math.min(1, Math.max(0, window.scrollY / max));
    if (pageTc) {
      pageTc.textContent = formatTimecode(Math.round(progress * PROGRAM_SECONDS * FPS));
    }
    if (playhead) playhead.style.left = `calc(${progress} * (100% - 2px))`;
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 8);

    const mark = window.innerHeight * 0.35;
    let active = 0;
    sections.forEach((section, index) => {
      if (section.getBoundingClientRect().top <= mark) active = index;
    });
    clips.forEach((clip, index) => clip.classList.toggle("is-active", index === active));
  }

  if (clips.length) {
    updateTimeline();
    window.addEventListener("scroll", () => requestAnimationFrame(updateTimeline), { passive: true });
    window.addEventListener("resize", updateTimeline);
  }

  function closeMenu() {
    if (!menu || !menuBtn || menu.hidden) return;
    menu.hidden = true;
    menuBtn.setAttribute("aria-expanded", "false");
    menuBtn.textContent = "Menu";
    document.body.classList.remove("menu-open");
  }

  function openMenu() {
    if (!menu || !menuBtn) return;
    menu.hidden = false;
    menuBtn.setAttribute("aria-expanded", "true");
    menuBtn.textContent = "Fermer";
    document.body.classList.add("menu-open");
    const first = menu.querySelector("a");
    first?.focus();
  }

  menuBtn?.addEventListener("click", () => {
    if (menu.hidden) openMenu();
    else {
      closeMenu();
      menuBtn.focus();
    }
  });

  menu?.addEventListener("click", (event) => {
    if (event.target.closest("a")) closeMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menu && !menu.hidden) {
      closeMenu();
      menuBtn?.focus();
    }
  });

  let currentCard = 0;

  function fillViewer(index) {
    const card = cards[index];
    if (!card || !dialog) return;
    currentCard = index;
    const title = card.querySelector("h3")?.textContent.trim() || "";
    const meta = card.querySelector(".meta span")?.textContent.trim() || "";
    const text = card.querySelector(".card-copy")?.textContent.trim() || "";
    const thumb = card.querySelector(".still video");
    document.getElementById("viewer-title").textContent = title;
    document.getElementById("viewer-meta").textContent = meta;
    document.getElementById("viewer-text").textContent = text;
    document.getElementById("viewer-count").textContent = `${pad(index + 1)} / ${pad(cards.length)}`;
    const still = document.getElementById("viewer-still");
    still.replaceChildren();
    if (thumb) {
      const video = document.createElement("video");
      video.poster = thumb.poster;
      video.muted = true;
      video.loop = true;
      video.controls = true;
      video.playsInline = true;
      video.preload = "metadata";
      video.setAttribute("aria-label", thumb.dataset.alt || title);
      video.src = thumb.dataset.full;
      still.appendChild(video);
      if (!motion.matches) video.play().catch(() => {});
    }
  }

  function openViewer(index) {
    fillViewer(index);
    if (!dialog.open) dialog.showModal();
    renderMonitor();
  }

  cards.forEach((card, index) => {
    card.querySelector(".card-open")?.addEventListener("click", () => openViewer(index));
    const preview = card.querySelector(".still video");
    if (!preview) return;
    const start = () => {
      if (!motion.matches) preview.play().catch(() => {});
    };
    const stop = () => {
      preview.pause();
      preview.currentTime = 0;
    };
    card.addEventListener("mouseenter", start);
    card.addEventListener("mouseleave", stop);
    card.addEventListener("focusin", start);
    card.addEventListener("focusout", stop);
  });

  document.getElementById("viewer-close")?.addEventListener("click", () => dialog.close());
  document.getElementById("viewer-next")?.addEventListener("click", () => {
    fillViewer((currentCard + 1) % cards.length);
  });
  document.getElementById("viewer-prev")?.addEventListener("click", () => {
    fillViewer((currentCard - 1 + cards.length) % cards.length);
  });

  dialog?.addEventListener("close", () => {
    document.getElementById("viewer-still")?.replaceChildren();
    renderMonitor();
    cards[currentCard]?.querySelector(".card-open")?.focus();
  });

  dialog?.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      fillViewer((currentCard + 1) % cards.length);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      fillViewer((currentCard - 1 + cards.length) % cards.length);
    }
  });

  document.getElementById("showreel-open")?.addEventListener("click", () => {
    const still = document.getElementById("showreel-still");
    const video = document.createElement("video");
    video.poster = "media/sequences/showreel-poster.jpg";
    video.controls = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.setAttribute("aria-label", "Showreel BUTTISCREEN, vingt-quatre secondes");
    video.src = "media/sequences/showreel.mp4";
    still.replaceChildren(video);
    showreel.showModal();
    renderMonitor();
    video.play().catch(() => {});
  });
  document.getElementById("showreel-close")?.addEventListener("click", () => showreel.close());
  showreel?.addEventListener("close", () => {
    document.getElementById("showreel-still")?.replaceChildren();
    renderMonitor();
    document.getElementById("showreel-open")?.focus();
  });

  const welcome = document.getElementById("welcome");
  if (welcome) {
    const WELCOME_KEY = "buttiscreen-welcome";
    const wVideo = document.getElementById("welcome-video");
    const wTc = document.getElementById("welcome-tc");
    const wSound = document.getElementById("welcome-sound");
    const reopen = document.getElementById("welcome-reopen");
    const seen = () => {
      try {
        return Boolean(localStorage.getItem(WELCOME_KEY));
      } catch (e) {
        return false;
      }
    };
    const remember = () => {
      try {
        localStorage.setItem(WELCOME_KEY, String(Date.now()));
      } catch (e) {}
    };
    const closeWelcome = () => welcome.close();

    wVideo.addEventListener("timeupdate", () => {
      wTc.textContent = formatTimecode(Math.floor(wVideo.currentTime * FPS));
    });
    wSound.addEventListener("click", () => {
      wVideo.muted = !wVideo.muted;
      wSound.textContent = wVideo.muted ? "Activer le son" : "Couper le son";
      wSound.setAttribute("aria-pressed", String(!wVideo.muted));
    });
    document.getElementById("welcome-x").addEventListener("click", closeWelcome);
    document.getElementById("welcome-close").addEventListener("click", closeWelcome);
    document.getElementById("welcome-cta").addEventListener("click", closeWelcome);
    welcome.addEventListener("click", (event) => {
      if (event.target === welcome) closeWelcome();
    });
    welcome.addEventListener("close", () => {
      wVideo.pause();
      wVideo.removeAttribute("src");
      wVideo.load();
      if (!welcome.dataset.fromButton) {
        reopen.classList.add("is-pulse");
        reopen.addEventListener("animationend", () => reopen.classList.remove("is-pulse"), { once: true });
      } else {
        reopen.focus();
      }
      delete welcome.dataset.fromButton;
    });
    reopen.addEventListener("click", () => {
      welcome.dataset.fromButton = "1";
      openWelcome();
    });

    const openWelcome = () => {
      if (welcome.open || dialog?.open || showreel?.open) return;
      wVideo.src = "media/sequences/showreel.mp4";
      welcome.showModal();
      remember();
      if (!motion.matches) wVideo.play().catch(() => {});
    };

    const slow = navigator.connection && (navigator.connection.saveData || /(^|-)2g$/.test(navigator.connection.effectiveType || ""));
    if (!seen() && !slow && !location.hash) setTimeout(openWelcome, 1800);
  }

  function setError(id, message) {
    const el = document.getElementById(id);
    if (!el) return;
    const control = el.closest(".field")?.querySelector("input, textarea, select");
    if (message) {
      el.hidden = false;
      el.textContent = message;
      control?.setAttribute("aria-invalid", "true");
      control?.setAttribute("aria-describedby", id);
    } else {
      el.hidden = true;
      el.textContent = "";
      control?.removeAttribute("aria-invalid");
      control?.removeAttribute("aria-describedby");
    }
  }

  function validate(data) {
    const nom = String(data.get("nom") || "").trim();
    const email = String(data.get("email") || "").trim();
    const projet = String(data.get("projet") || "").trim();
    const message = String(data.get("message") || "").trim();
    let ok = true;
    let first = null;

    const checks = [
      ["err-nom", nom.length >= 2, "Indiquez votre nom.", "nom"],
      ["err-email", /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), "Indiquez un e-mail valide.", "email"],
      ["err-projet", projet.length > 0, "Choisissez un type de projet.", "projet"],
      ["err-message", message.length >= 10, "Écrivez quelques lignes sur le film.", "message"],
    ];

    checks.forEach(([id, valid, text, name]) => {
      setError(id, valid ? "" : text);
      if (!valid && !first) first = form.elements[name];
      if (!valid) ok = false;
    });

    if (!ok) {
      if (formStatus) formStatus.textContent = "Le brief est incomplet.";
      first?.focus();
    }
    return ok;
  }

  function clearFieldError(event) {
    const name = event.target?.name;
    if (!name) return;
    setError(`err-${name}`, "");
  }

  form?.addEventListener("input", clearFieldError);
  form?.addEventListener("change", clearFieldError);

  const formStart = Date.now();
  const sendBtn = document.getElementById("send");
  const formFail = document.getElementById("form-fail");
  const successParts = {
    kicker: document.getElementById("success-kicker"),
    title: document.getElementById("success-title"),
    text: document.getElementById("success-text"),
  };
  const successMailto = successParts.text ? successParts.text.innerHTML : "";
  const successMailtoCopy = [successParts.kicker?.textContent, successParts.title?.textContent];

  function mailtoHref(data) {
    const body = [
      `Nom : ${String(data.get("nom")).trim()}`,
      `E-mail : ${String(data.get("email")).trim()}`,
      `Projet : ${String(data.get("projet")).trim()}`,
      "",
      String(data.get("message")).trim(),
    ].join("\n");
    return `mailto:contact@buttiscreen.fr?subject=${encodeURIComponent("Brief — BUTTISCREEN")}&body=${encodeURIComponent(body)}`;
  }

  let lastSent = false;

  function showSuccess(sent, href) {
    lastSent = sent;
    const edit = document.getElementById("edit-brief");
    if (edit) edit.textContent = sent ? "Envoyer un autre brief" : "Modifier";
    const reopen = document.getElementById("reopen-mail");
    if (successParts.kicker) {
      successParts.kicker.textContent = sent ? "Brief envoyé" : successMailtoCopy[0];
      successParts.title.textContent = sent ? "Merci, le brief est bien parti." : successMailtoCopy[1];
      successParts.text.innerHTML = sent
        ? "Il est arrivé chez nous. La réponse vous parvient par e-mail, à l’adresse indiquée."
        : successMailto;
    }
    if (reopen) {
      reopen.hidden = sent;
      if (href) reopen.href = href;
    }
    form.hidden = true;
    const note = document.querySelector(".brief-note");
    if (note) note.hidden = true;
    if (success) success.hidden = false;
    success?.scrollIntoView({ block: "center", behavior: motion.matches ? "auto" : "smooth" });
    if (formStatus) {
      formStatus.textContent = sent
        ? "Le brief est envoyé."
        : "Le brief est prêt. La messagerie va s’ouvrir.";
    }
  }

  async function sendBrief(endpoint, data) {
    const payload = {
      nom: String(data.get("nom") || ""),
      email: String(data.get("email") || ""),
      projet: String(data.get("projet") || ""),
      message: String(data.get("message") || ""),
      website: String(data.get("website") || ""),
      t: formStart,
    };
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      window.clearTimeout(timer);
    }
  }

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    if (formFail) formFail.hidden = true;
    if (!validate(data)) return;
    const href = mailtoHref(data);
    const endpoint = (form.dataset.endpoint || "").trim();

    if (!endpoint) {
      showSuccess(false, href);
      window.location.href = href;
      return;
    }

    const label = sendBtn ? sendBtn.textContent : "";
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.textContent = "Envoi en cours";
    }
    if (formStatus) formStatus.textContent = "Envoi du brief en cours.";
    const ok = await sendBrief(endpoint, data);
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.textContent = label;
    }
    if (ok) {
      showSuccess(true);
    } else {
      const fail = document.getElementById("fail-mail");
      if (fail) fail.href = href;
      if (formFail) formFail.hidden = false;
      if (formStatus) formStatus.textContent = "L’envoi n’a pas abouti.";
    }
  });

  document.getElementById("edit-brief")?.addEventListener("click", () => {
    if (success) success.hidden = true;
    document.querySelector(".brief-note")?.removeAttribute("hidden");
    if (form) {
      if (lastSent) form.reset();
      form.hidden = false;
      form.elements.nom?.focus();
    }
  });
  /* ===== ACCUEIL : le B devient le logo, boucle suspendue hors écran ===== */
  (function bMorph() {
    const b = document.querySelector(".b-morph");
    const hero = document.getElementById("titre");
    if (!b || !hero || !("IntersectionObserver" in window)) return;
    new IntersectionObserver((entries) => {
      b.style.animationPlayState = entries[entries.length - 1].isIntersecting ? "running" : "paused";
    }).observe(hero);

    /* Les 3 cycles terminés, le survol du B à la souris rejoue un cycle (rien sur écran tactile) */
    b.addEventListener("pointerenter", (e) => {
      if (e.pointerType !== "mouse") return;
      const anim = b.getAnimations().find((a) => a.animationName === "b-morph");
      if (!anim || motion.matches || anim.playState !== "finished") return;
      anim.effect.updateTiming({ delay: 0, iterations: 1 });
      anim.currentTime = 0;
      anim.play();
    });
  })();

  /* ===== ACCUEIL : apparition des blocs au défilement ===== */
  (function reveal() {
    const items = [...document.querySelectorAll("[data-reveal]")];
    if (!items.length || motion.matches || !("IntersectionObserver" in window)) return;
    document.documentElement.classList.add("has-reveal");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
    items.forEach((el) => {
      const sibs = el.parentElement ? [...el.parentElement.children].filter((c) => c.hasAttribute("data-reveal")) : [];
      el.style.setProperty("--d", `${Math.min(sibs.indexOf(el), 5) * 70}ms`);
      io.observe(el);
    });
  })();
})();
