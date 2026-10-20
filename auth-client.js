(() => {
  const API = "https://buttiscreen-contact.tristan-buttig1.workers.dev";
  const KEY = "buttiscreen.session.v2";
  const OPENED = Date.now();

  const read = () => {
    try {
      const value = JSON.parse(localStorage.getItem(KEY) || "");
      return value && value.session && value.email ? value : null;
    } catch {
      return null;
    }
  };
  const write = (value) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(value));
    } catch {}
  };
  const clear = () => {
    try {
      localStorage.removeItem(KEY);
    } catch {}
  };

  const call = async (path, { method = "GET", body, auth } = {}) => {
    const headers = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (auth) headers.Authorization = `Bearer ${auth}`;
    try {
      const response = await fetch(API + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const json = await response.json().catch(() => null);
      return { status: response.status, json };
    } catch {
      return { status: 0, json: null };
    }
  };

  const requestLink = async (email, page) => {
    const wait = 2700 - (Date.now() - OPENED);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    const { status } = await call("/auth/demande", {
      method: "POST",
      body: { email, page: page || "commande", website: "", t: OPENED },
    });
    return status === 200 ? { ok: true } : { ok: false, limited: status === 429, offline: status === 0 };
  };

  const verify = async (token) => {
    const { status, json } = await call("/auth/verification", { method: "POST", body: { token } });
    if (status === 200 && json && json.session) {
      write({ session: json.session, email: json.email, admin: Boolean(json.admin) });
      return { ok: true, email: json.email, admin: Boolean(json.admin) };
    }
    return { ok: false, offline: status === 0, limited: status === 429 };
  };

  // Relit le compte sur le serveur. 401 : la session est périmée, on l'efface.
  const me = async () => {
    const current = read();
    if (!current) return { ok: false, expired: true };
    const { status, json } = await call("/moi", { auth: current.session });
    if (status === 200 && json && json.ok) return { ok: true, ...json };
    if (status === 401) {
      clear();
      return { ok: false, expired: true };
    }
    return { ok: false, offline: true };
  };

  const logout = async () => {
    const current = read();
    clear();
    if (current) await call("/auth/deconnexion", { method: "POST", body: {}, auth: current.session });
  };

  const adminCall = async (path, options) => {
    const current = read();
    if (!current || !current.admin) return { status: 401, json: null };
    return call(path, { ...options, auth: current.session });
  };

  window.ButtiAuth = {
    session: read,
    email: () => (read() ? read().email : ""),
    isAdmin: () => Boolean(read() && read().admin),
    requestLink,
    verify,
    me,
    logout,
    saveProject: (body) => adminCall("/admin/projet", { method: "POST", body }),
    listProjects: () => adminCall("/admin/projets"),
  };
})();
