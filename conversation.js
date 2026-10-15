(() => {
  const KEY = "buttiscreen.conversation.v1";

  const emailOf = (value) => String(value || "").trim().toLowerCase();

  const valid = (row) =>
    row &&
    (row.from === "client" || row.from === "studio") &&
    typeof row.texte === "string" &&
    row.texte.trim() &&
    typeof row.cree === "string";

  const readAll = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) || "{}");
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  };

  const readThread = (email) => {
    const list = readAll()[emailOf(email)];
    return (Array.isArray(list) ? list.filter(valid) : []).sort((a, b) =>
      String(a.cree).localeCompare(String(b.cree))
    );
  };

  const append = (email, from, texte) => {
    const key = emailOf(email);
    const clean = String(texte || "").trim().slice(0, 2000);
    if (!key.includes("@") || (from !== "client" && from !== "studio") || !clean) return null;
    const all = readAll();
    const list = Array.isArray(all[key]) ? all[key].filter(valid) : [];
    const row = { from, texte: clean, cree: new Date().toISOString() };
    list.push(row);
    all[key] = list.slice(-200);
    localStorage.setItem(KEY, JSON.stringify(all));
    return row;
  };

  window.ButtiConversation = { readThread, append };
})();
