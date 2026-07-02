requireAuth();

const user = getUser();

function setAvatarDisplay(avatarUrl, initials) {
  const sidebar = document.getElementById('user-avatar');
  const large = document.getElementById('account-avatar');
  const img = avatarUrl
    ? `<img src="${BASE_URL.replace('/api/v1', '')}${avatarUrl}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
    : `<span>${initials}</span>`;
  if (sidebar) sidebar.innerHTML = img;
  if (large)   large.innerHTML   = img;
  document.getElementById('account-initials')?.remove();
}

if (user) {
  const initials = `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase();
  document.getElementById('user-firstname').textContent  = user.first_name;
  document.getElementById('user-lastname').textContent   = user.last_name;
  document.getElementById('account-fullname').textContent = `${user.first_name} ${user.last_name}`;
  document.getElementById('account-email').textContent   = user.email || '—';
  setAvatarDisplay(user.avatar_url, initials);
}

async function uploadAvatar(event) {
  const file = event.target.files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('file', file);
  const res = await apiUpload('/auth/me/avatar', fd);
  if (!res || !res.ok) return;
  const u = getUser();
  u.avatar_url = res.data.avatar_url;
  setUser(u);
  const initials = `${u.first_name?.[0] || ''}${u.last_name?.[0] || ''}`.toUpperCase();
  setAvatarDisplay(res.data.avatar_url, initials);
}

function logout() {
  clearTokens();
  window.location.href = 'index.html';
}

function openDeleteConfirm() {
  document.getElementById('confirm-overlay').classList.add('open');
}

function closeDeleteConfirm() {
  document.getElementById('confirm-overlay').classList.remove('open');
}

async function deleteAccount() {
  const res = await apiFetch('/auth/me', { method: 'DELETE' });
  if (res && !res.ok) return;
  clearTokens();
  window.location.href = 'index.html';
}
