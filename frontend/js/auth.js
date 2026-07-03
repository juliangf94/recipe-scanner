if (getToken()) window.location.href = 'dashboard.html';

function togglePwd(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🙈';
  } else {
    input.type = 'password';
    btn.textContent = '👁';
  }
}

function showError(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.style.display = '';
}

// ── Login ─────────────────────────────────────────────────────────────────────
async function handleLogin(event) {
  event.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  document.getElementById('login-error').style.display = 'none';

  if (!email || !password) return showError('login-error', t('err_fill_fields'));

  const btn = document.getElementById('login-btn');
  btn.disabled = true;
  btn.textContent = t('signing_in');

  const res = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });

  btn.disabled = false;
  btn.textContent = t('btn_signin');

  if (!res || !res.ok) return showError('login-error', res?.data?.error || t('err_login_failed'));

  setTokens(res.data.access_token, res.data.refresh_token);
  setUser(res.data.user);
  window.location.href = 'dashboard.html';
}

// ── Register ──────────────────────────────────────────────────────────────────
async function handleRegister(event) {
  if (!event) return;
  event.preventDefault();

  const first_name = document.getElementById('reg-first')?.value.trim();
  const last_name = document.getElementById('reg-last')?.value.trim();
  const email = document.getElementById('reg-email')?.value.trim();
  const password = document.getElementById('reg-password')?.value;
  const confirm = document.getElementById('reg-confirm')?.value;
  const terms = document.getElementById('reg-terms')?.checked;

  document.getElementById('register-error').style.display = 'none';

  if (!first_name || !last_name || !email || !password)
    return showError('register-error', t('err_fill_fields'));

  if (password !== confirm)
    return showError('register-error', t('err_pwd_match'));

  if (!terms)
    return showError('register-error', t('err_accept_terms'));

  const btn = document.getElementById('register-btn');
  btn.disabled = true;
  btn.textContent = t('creating_account');

  const res = await apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ first_name, last_name, email, password })
  });

  btn.disabled = false;
  btn.textContent = t('btn_create_account');

  if (!res || !res.ok) return showError('register-error', res?.data?.error || t('err_register_failed'));

  const loginRes = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });

  if (loginRes && loginRes.ok) {
    setTokens(loginRes.data.access_token, loginRes.data.refresh_token);
    setUser(loginRes.data.user);
    window.location.href = 'dashboard.html';
  } else {
    window.location.href = 'index.html';
  }
}
