// Detects whether the app is running locally or in production,
// and sets the API base URL accordingly — no manual changes needed on deploy.
const IS_LOCAL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const BASE_URL = IS_LOCAL
  ? 'http://localhost:5000/api/v1'
  : 'https://recipe-scanner-kfnm.onrender.com/api/v1';
const SERVER_URL = BASE_URL.replace('/api/v1', '');

// Wake up Render free-tier backend on page load (fire-and-forget, no error shown)
if (!IS_LOCAL) fetch(`${BASE_URL}/health`).catch(() => {});

// Returns the full URL for an image regardless of where it is stored.
// Supabase images are already absolute URLs; local uploads are relative paths
// that need the server's base URL prepended.
function resolveImgUrl(url) {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('//')) return url;
  return `${SERVER_URL}${url}`;
}

// Converts a Supabase Storage URL to a resized thumbnail via the Supabase
// image transformation API. Used for recipe card thumbnails to reduce bandwidth.
function supabaseThumb(url, width = 200, quality = 80) {
  if (!url || !url.includes('supabase.co/storage/v1/object/public/')) return url;
  return url.replace('/object/public/', '/render/image/public/') + `?width=${width}&quality=${quality}`;
}

// ── Token storage ─────────────────────────────────────────────────────────────
// Tokens are stored in localStorage so they persist across page navigations
// without needing the server to maintain session state (stateless JWT).
function getAccessToken()  { return localStorage.getItem('access_token'); }
function getRefreshToken() { return localStorage.getItem('refresh_token'); }

// Writes tokens to localStorage. Passing null as refreshToken leaves the
// existing refresh token untouched — used during silent refresh.
function setTokens(accessToken, refreshToken) {
  localStorage.setItem('access_token', accessToken);
  if (refreshToken) localStorage.setItem('refresh_token', refreshToken);
}

// Removes all auth data from localStorage, effectively logging the user out.
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
// The user object (name, email, avatar) is cached in localStorage so the
// sidebar can display it instantly without an extra API request on every page.
function getUser() {
  const u = localStorage.getItem('user');
  return u ? JSON.parse(u) : null;
}

function setUser(user) {
  localStorage.setItem('user', JSON.stringify(user));
}

// ── JWT decode (no library needed — JWT payload is just base64) ───────────────
// Decodes the middle segment of a JWT to read its payload without verifying
// the signature (verification is the server's job, not the client's).
function parseJwt(token) {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload));
  } catch { return null; }
}

// Returns true if the token has expired or will expire within 10 seconds.
// The 10-second buffer avoids a race condition where the token is valid
// during the check but expires before the server receives the request.
function isTokenExpired(token) {
  const payload = parseJwt(token);
  if (!payload || !payload.exp) return true;
  // 10-second buffer to avoid edge-case races
  return payload.exp * 1000 < Date.now() + 10_000;
}

// ── Auth guard ────────────────────────────────────────────────────────────────
// Called at the top of every protected page. Redirects to login if the user
// has no valid session. If the access token is expired but a refresh token
// exists, it lets the page load — the first apiFetch() will renew it silently.
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
// _refreshPromise acts as a singleton lock: if two requests trigger a refresh
// at the same time, only one HTTP call is made and both callers await the same promise.
let _refreshPromise = null;

// Sends the refresh token to the server to obtain a new access token.
// If the refresh token is also expired, clears all tokens and redirects to login.
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
/**
 * Central HTTP client for all API calls.
 * - Attaches the JWT access token to every request automatically.
 * - Proactively refreshes the token if it is about to expire (15-min window).
 * - On a 401 response, attempts one silent refresh and retries the request.
 * - Returns null for 204 No Content responses (e.g. DELETE).
 * - Returns { ok, status, data } for all other responses.
 */
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
// Separate from apiFetch because file uploads use multipart/form-data instead
// of JSON. The Content-Type header must NOT be set manually — the browser sets
// it automatically with the correct boundary when sending a FormData object.
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

// ── Custom prompt modal ───────────────────────────────────────────────────────
// Replaces the browser's native prompt() with a styled modal that matches the
// app's design. Accepts a callback that receives the user's input on confirm.
function showPrompt(title, defaultValue, callback) {
  const modal = document.getElementById('shared-prompt-modal');
  const titleEl = document.getElementById('shared-prompt-title');
  const input = document.getElementById('shared-prompt-input');
  const confirmBtn = document.getElementById('shared-prompt-confirm');
  if (!modal) return;

  titleEl.textContent = title;
  input.value = defaultValue || '';
  modal.classList.add('open');
  setTimeout(() => { input.focus(); input.select(); }, 50);

  function submit() {
    const val = input.value.trim();
    if (!val) return;
    modal.classList.remove('open');
    confirmBtn.onclick = null;
    callback(val);
  }

  confirmBtn.onclick = submit;
  input.onkeydown = (e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') closePrompt(); };
  modal.onclick = (e) => { if (e.target === modal) closePrompt(); };
}

function closePrompt() {
  document.getElementById('shared-prompt-modal')?.classList.remove('open');
}

// ── Custom alert modal ────────────────────────────────────────────────────────
// Replaces the browser's native alert() with a styled modal.
function showAlert(message) {
  const modal = document.getElementById('shared-alert-modal');
  const msgEl = document.getElementById('shared-alert-message');
  if (!modal) return;
  msgEl.textContent = message;
  modal.classList.add('open');
  modal.onclick = (e) => { if (e.target === modal) closeAlert(); };
}

function closeAlert() {
  document.getElementById('shared-alert-modal')?.classList.remove('open');
}

// ── Custom confirm modal (shared) ─────────────────────────────────────────────
// Replaces the browser's native confirm() with a styled modal.
// Executes the callback only if the user clicks the confirm button.
function showConfirmModal(title, desc, callback) {
  const modal = document.getElementById('shared-confirm-modal');
  const titleEl = document.getElementById('shared-confirm-title');
  const descEl = document.getElementById('shared-confirm-desc');
  const confirmBtn = document.getElementById('shared-confirm-btn');
  if (!modal) return;

  titleEl.textContent = title;
  descEl.textContent = desc || '';
  confirmBtn.onclick = () => {
    modal.classList.remove('open');
    callback();
  };
  modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('open'); };
  modal.classList.add('open');
}

function closeSharedConfirm() {
  document.getElementById('shared-confirm-modal')?.classList.remove('open');
}

// ── Draggable modal ───────────────────────────────────────────────────────────
// Makes a modal window draggable by its handle element. Tracks mouse position
// as an offset from the modal's current translation to avoid jumps on drag start.
function makeDraggable(overlayId) {
  const overlay = document.getElementById(overlayId);
  if (!overlay) return;
  const modal = overlay.querySelector('.modal');
  const handle = modal?.querySelector('.modal-drag-handle');
  if (!modal || !handle) return;

  let active = false, ox = 0, oy = 0, tx = 0, ty = 0;

  handle.addEventListener('mousedown', e => {
    active = true;
    ox = e.clientX - tx;
    oy = e.clientY - ty;
    modal.style.transition = 'none';
    e.preventDefault();
  });

  window.addEventListener('mousemove', e => {
    if (!active) return;
    tx = e.clientX - ox;
    ty = e.clientY - oy;
    modal.style.transform = `translate(${tx}px, ${ty}px)`;
  });

  window.addEventListener('mouseup', () => { active = false; });

  // Resets position when the modal is closed and reopened.
  overlay.addEventListener('modal-reset', () => {
    modal.style.transform = '';
    tx = 0; ty = 0;
  });
}

// ── User dropdown menu ────────────────────────────────────────────────────────
// Toggles the user menu open/closed. The global click listener closes it
// automatically when the user clicks anywhere else on the page.
function toggleUserMenu(e) {
  e.stopPropagation();
  document.getElementById('user-dropdown').classList.toggle('open');
}
document.addEventListener('click', () => {
  document.getElementById('user-dropdown')?.classList.remove('open');
});
