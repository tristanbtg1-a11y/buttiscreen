(() => {
  const KEY = "buttiscreen.brief.v1";
  const KEEP = 5;

  const emailOf = (value) => String(value || "").trim().toLowerCase();
  const clip = (value, max) => String(value ?? "").trim().slice(0, max);

  const read = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) || "");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  };

  // Garde sur l'appareil une copie du brief envoyé, pour l'afficher dans Mon compte.
  const save = (brief) => {
    try {
      const email = emailOf(brief && brief.email);
      if (!email) return false;
      const all = read();
      const list = Array.isArray(all[email]) ? all[email] : [];
      list.unshift({
        cree: new Date().toISOString(),
        nom: clip(brief.nom, 120),
        email,
        projet: clip(brief.projet, 60),
        duree: clip(brief.duree, 60),
        diffusion: clip(brief.diffusion, 120),
        creneau: clip(brief.creneau, 120),
        message: clip(brief.message, 6000),
      });
      all[email] = list.slice(0, KEEP);
      localStorage.setItem(KEY, JSON.stringify(all));
      return true;
    } catch {
      return false;
    }
  };

  const latestFor = (email) => {
    const list = read()[emailOf(email)];
    return Array.isArray(list) && list.length ? list[0] : null;
  };

  const countFor = (email) => {
    const list = read()[emailOf(email)];
    return Array.isArray(list) ? list.length : 0;
  };

  window.ButtiBrief = { save, latestFor, countFor };
})();
