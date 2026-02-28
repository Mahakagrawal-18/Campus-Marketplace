// ─────────────────────────────────────────────────────────────
//  api.js  —  Central config for Campus Exchange frontend
//  Change API_BASE here to update everywhere at once
// ─────────────────────────────────────────────────────────────

const API_BASE = "http://localhost:5000";

// ── Token helpers ────────────────────────────────────────────
function getToken() {
  return localStorage.getItem("ce_token");
}
function saveTokens(accessToken, refreshToken) {
  localStorage.setItem("ce_token", accessToken);
  if (refreshToken) localStorage.setItem("ce_refresh", refreshToken);
}
function saveUser(user) {
  localStorage.setItem("ce_user", JSON.stringify(user));
}
function getUser() {
  try { return JSON.parse(localStorage.getItem("ce_user")); } catch { return null; }
}
function clearAuth() {
  localStorage.removeItem("ce_token");
  localStorage.removeItem("ce_refresh");
  localStorage.removeItem("ce_user");
}
function isLoggedIn() {
  return !!getToken();
}

// ── Core fetch wrapper ───────────────────────────────────────
async function apiFetch(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  // Auto-refresh on 401
  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      headers["Authorization"] = `Bearer ${getToken()}`;
      return fetch(`${API_BASE}${path}`, { ...options, headers });
    } else {
      clearAuth();
      window.location.href = "login.html";
      return;
    }
  }
  return res;
}

async function tryRefresh() {
  const refresh = localStorage.getItem("ce_refresh");
  if (!refresh) return false;
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: refresh }),
    });
    const data = await res.json();
    if (data.success) { localStorage.setItem("ce_token", data.accessToken); return true; }
  } catch {}
  return false;
}

// ── Guard: redirect to login if not authenticated ────────────
function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = "login.html";
    return false;
  }
  return true;
}

// ── Navbar: update Login/Logout button based on auth state ───
function updateNavAuth() {
  const loginBtn  = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const user      = getUser();

  if (loginBtn)  loginBtn.style.display  = isLoggedIn() ? "none"  : "inline-block";
  if (logoutBtn) logoutBtn.style.display = isLoggedIn() ? "inline-block" : "none";

  // Show user name if a greeting element exists
  const greeting = document.getElementById("userGreeting");
  if (greeting && user) greeting.textContent = `Hi, ${user.name.split(" ")[0]}!`;
}

// ── Logout ───────────────────────────────────────────────────
async function logout() {
  try {
    await apiFetch("/api/auth/logout", { method: "POST" });
  } catch {}
  clearAuth();
  window.location.href = "login.html";
}

// ── Toast notification ───────────────────────────────────────
function showToast(message, type = "success") {
  let toast = document.getElementById("ce-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "ce-toast";
    toast.style.cssText = `
      position:fixed;bottom:24px;right:24px;padding:14px 22px;border-radius:10px;
      font-size:15px;font-weight:600;z-index:9999;opacity:0;
      transition:opacity 0.3s;max-width:340px;box-shadow:0 4px 20px rgba(0,0,0,0.15);
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.background = type === "success" ? "#22c55e" : type === "error" ? "#ef4444" : "#3b82f6";
  toast.style.color = "#fff";
  toast.style.opacity = "1";
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.opacity = "0"; }, 3500);
}
