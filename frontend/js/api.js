const IS_LOCAL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const BASE_URL = IS_LOCAL
  ? 'http://localhost:5000/api/v1'
  : 'https://recipe-scanner-kfnm.onrender.com/api/v1';

// ── Token storage ─────────────────────────────────────────────────────────────
function getAccessToken()  { return localStorage.getItem('access_token'); }
function getRefreshToken() { return localStorage.getItem('refresh_token'); }

function setTokens(accessToken, refreshToken) {
  localStorage.setItem('access_token', accessToken);
  if (refreshToken) localStorage.setItem('refresh_token', refreshToken);
}

function clearTokens() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
}

// Legacy key migration — users logged in before this change had 'token' in localStorage
(function migrateLegacyToken() {
  const old = localStorage.getItem('token');
  if (old && !getAccessToken()) {
    localStorage.setItem('access_token', old);
    localStorage.removeItem('token');
  }
})();

// ── User storage ──────────────────────────────────────────────────────────────
function getUser() {
  const u = localStorage.getItem('user');
  return u ? JSON.parse(u) : null;
}

function setUser(user) {
  localStorage.setItem('user', JSON.stringify(user));
}

// ── JWT decode (no library needed — JWT payload is just base64) ───────────────
function parseJwt(token) {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload));
  } catch { return null; }
}

function isTokenExpired(token) {
  const payload = parseJwt(token);
  if (!payload || !payload.exp) return true;
  // 10-second buffer to avoid edge-case races
  return payload.exp * 1000 < Date.now() + 10_000;
}

// ── Auth guard ────────────────────────────────────────────────────────────────
function requireAuth() {
  const access = getAccessToken();
  const refresh = getRefreshToken();

  if (!access && !refresh) {
    window.location.href = 'index.html';
    return;
  }

  // If access token is expired but refresh is still valid, let the first
  // request trigger the silent refresh. No redirect needed.
  if (!access && refresh) return;
  if (access && isTokenExpired(access) && !refresh) {
    clearTokens();
    window.location.href = 'index.html';
  }
}

function removeToken() { clearTokens(); }

// ── Silent token refresh ──────────────────────────────────────────────────────
let _refreshPromise = null; // prevents parallel refresh calls

async function refreshAccessToken() {
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;

    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${refreshToken}` }
    });

    if (res.ok) {
      const data = await res.json();
      setTokens(data.access_token, null);
      return true;
    }

    // Refresh token also expired → force login
    clearTokens();
    window.location.href = 'index.html';
    return false;
  })();

  _refreshPromise.finally(() => { _refreshPromise = null; });
  return _refreshPromise;
}

// ── Main fetch wrapper ────────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  // Proactively refresh if access token is about to expire
  const access = getAccessToken();
  if (access && isTokenExpired(access)) {
    const ok = await refreshAccessToken();
    if (!ok) return;
  }

  const token = getAccessToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  // 401 → try one silent refresh, then retry
  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) return;

    const retryToken = getAccessToken();
    const retryHeaders = { 'Content-Type': 'application/json', ...options.headers };
    if (retryToken) retryHeaders['Authorization'] = `Bearer ${retryToken}`;

    const retryRes = await fetch(`${BASE_URL}${path}`, { ...options, headers: retryHeaders });
    if (retryRes.status === 401) {
      clearTokens();
      window.location.href = 'index.html';
      return;
    }
    if (retryRes.status === 204) return null;
    return retryRes.json().then(data => ({ ok: retryRes.ok, status: retryRes.status, data }));
  }

  if (res.status === 204) return null;
  return res.json().then(data => ({ ok: res.ok, status: res.status, data }));
}

// ── File upload wrapper ───────────────────────────────────────────────────────
async function apiUpload(path, formData) {
  const access = getAccessToken();
  if (access && isTokenExpired(access)) await refreshAccessToken();

  const token = getAccessToken();
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { method: 'POST', headers, body: formData });

  if (res.status === 401) {
    clearTokens();
    window.location.href = 'index.html';
    return;
  }
  if (res.status === 204) return null;
  return res.json().then(data => ({ ok: res.ok, status: res.status, data }));
}

// ── User dropdown menu ────────────────────────────────────────────────────────
function toggleUserMenu(e) {
  e.stopPropagation();
  document.getElementById('user-dropdown').classList.toggle('open');
}
document.addEventListener('click', () => {
  document.getElementById('user-dropdown')?.classList.remove('open');
});
