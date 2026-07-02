requireAuth();

let selectedFile = null;
let lastScanRecipe = null;
let lastScanData = null;
let lastScanSuccessId    = null;
let lastScanSuccessTitle = null;
let _duplicateExistingId = null;

function renderSuccessMessage(id, title) {
  const el = document.getElementById('upload-success');
  el.innerHTML = `${tf('scan_ok', { title })}
    <div style="margin-top:0.6rem;">
      <a href="recipe.html?id=${id}" class="btn btn-orange btn-sm">${t('btn_view_recipe')}</a>
    </div>`;
  el.style.display = '';
}

// ── Restore scan success after any page reload ────────────────────────────────
(function restoreScanSuccess() {
  const id    = sessionStorage.getItem('scan_success_id');
  const title = sessionStorage.getItem('scan_success_title');
  if (!id || !title) return;
  sessionStorage.removeItem('scan_success_id');
  sessionStorage.removeItem('scan_success_title');
  lastScanSuccessId    = id;
  lastScanSuccessTitle = title;
  renderSuccessMessage(id, title);
})();

// ── Sidebar user info ─────────────────────────────────────────────────────────
const user = getUser();
if (user) {
  const initials = `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase();
  document.getElementById('user-firstname').textContent = user.first_name;
  document.getElementById('user-lastname').textContent = user.last_name;
  setAvatarDisplay(user.avatar_url, initials);
}

function setAvatarDisplay(avatarUrl, initials) {
  const el = document.getElementById('user-avatar');
  if (avatarUrl) {
    el.innerHTML = `<img src="${resolveImgUrl(avatarUrl)}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"><div class="avatar-overlay">📷</div>`;
  } else {
    el.innerHTML = `<span id="avatar-initials">${initials}</span><div class="avatar-overlay">📷</div>`;
  }
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
  setAvatarDisplay(res.data.avatar_url, '');
}

// ── Method toggle ─────────────────────────────────────────────────────────────
function switchMethod(method) {
  document.getElementById('method-pdf').classList.toggle('active', method === 'pdf');
  document.getElementById('method-type').classList.toggle('active', method === 'type');
}

// ── Extraction option pills ───────────────────────────────────────────────────
document.querySelectorAll('.opt-pill').forEach(pill => {
  pill.addEventListener('click', () => pill.classList.toggle('active'));
});

// ── File input ────────────────────────────────────────────────────────────────
function onFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  selectedFile = file;
  const nameEl = document.getElementById('file-name');
  nameEl.textContent = `📄 ${file.name}`;
  nameEl.style.display = '';
  document.getElementById('scan-btn').disabled = false;
  document.getElementById('upload-error').style.display = 'none';
}

// ── Drag & drop ───────────────────────────────────────────────────────────────
const dropZone = document.getElementById('drop-zone');

dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));

dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type === 'application/pdf') {
    selectedFile = file;
    const nameEl = document.getElementById('file-name');
    nameEl.textContent = `📄 ${file.name}`;
    nameEl.style.display = '';
    document.getElementById('scan-btn').disabled = false;
  } else {
    const el = document.getElementById('upload-error');
    el.textContent = t('err_only_pdf');
    el.style.display = '';
  }
});

// ── Scan ──────────────────────────────────────────────────────────────────────
async function scanPdf() {
  if (!selectedFile) return;

  document.getElementById('upload-error').style.display = 'none';
  document.getElementById('upload-success').style.display = 'none';
  document.getElementById('scan-btn').style.display = 'none';
  document.getElementById('scanning').style.display = '';

  const formData = new FormData();
  formData.append('file', selectedFile);

  let res;
  try {
    res = await apiUpload('/scan/', formData);
  } catch (_) {
    res = null;
  }

  document.getElementById('scanning').style.display = 'none';
  document.getElementById('scan-btn').style.display = '';

  if (!res || !res.ok) {
    if (res?.status === 409 && res?.data?.error_code === 'duplicate') {
      _duplicateExistingId = res.data.existing_id;
      const desc = document.getElementById('duplicate-modal-desc');
      desc.textContent = tf('scan_dup_desc', { title: res.data.title });
      document.getElementById('duplicate-modal').classList.add('open');
      return;
    }
    const el = document.getElementById('upload-error');
    const code = res?.data?.error_code;
    el.textContent = code ? t('err_' + code) || t('err_scan') : t('err_scan');
    el.style.display = '';
    return;
  }

  const recipe = res.data.recipe;

  // Persist success so it survives any page reload triggered by the browser
  lastScanSuccessId    = recipe.id;
  lastScanSuccessTitle = recipe.title;
  sessionStorage.setItem('scan_success_id',    recipe.id);
  sessionStorage.setItem('scan_success_title', recipe.title);

  // Prevent a second scan from hiding this message
  selectedFile = null;
  document.getElementById('scan-btn').disabled = true;

  renderSuccessMessage(recipe.id, recipe.title);

  showLastScan(recipe, res.data);
}

function showLastScan(recipe, data) {
  lastScanRecipe = recipe;
  lastScanData = data;
  const card = document.getElementById('last-scan-card');
  const content = document.getElementById('scan-result-content');

  const ings = (data.ingredients || []).length;
  const steps = (data.steps || []).length;

  const ingText = ings === 1 ? t('res_ing_1') : tf('res_ing_n', { n: ings });
  const stepsText = steps === 1 ? t('res_step_1') : tf('res_step_n', { n: steps });

  content.innerHTML = `
    <div class="scan-result-row">
      <span class="scan-result-icon">📖</span>
      <div>
        <div class="scan-result-label">${t('res_recipe')}</div>
        <div class="scan-result-value">${recipe.title}</div>
      </div>
    </div>
    ${recipe.category ? `
    <div class="scan-result-row">
      <span class="scan-result-icon">🏷</span>
      <div>
        <div class="scan-result-label">${t('res_category')}</div>
        <div class="scan-result-value">${recipe.category}</div>
      </div>
    </div>` : ''}
    <div class="scan-result-row">
      <span class="scan-result-icon">🥕</span>
      <div>
        <div class="scan-result-label">${t('res_ings')}</div>
        <div class="scan-result-value">${ingText}</div>
      </div>
    </div>
    <div class="scan-result-row">
      <span class="scan-result-icon">📋</span>
      <div>
        <div class="scan-result-label">${t('res_steps')}</div>
        <div class="scan-result-value">${stepsText}</div>
      </div>
    </div>`;

  card.style.display = '';
}

function closeDuplicateModal() {
  document.getElementById('duplicate-modal').classList.remove('open');
}

function viewExistingRecipe() {
  if (_duplicateExistingId) window.location.href = `recipe.html?id=${_duplicateExistingId}`;
}

async function forceCreateRecipe() {
  closeDuplicateModal();
  if (!selectedFile) return;

  document.getElementById('upload-error').style.display = 'none';
  document.getElementById('upload-success').style.display = 'none';
  document.getElementById('scan-btn').style.display = 'none';
  document.getElementById('scanning').style.display = '';

  const formData = new FormData();
  formData.append('file', selectedFile);

  let res;
  try {
    res = await apiUpload('/scan/?force=true', formData);
  } catch (_) {
    res = null;
  }

  document.getElementById('scanning').style.display = 'none';
  document.getElementById('scan-btn').style.display = '';

  if (!res || !res.ok) {
    const el = document.getElementById('upload-error');
    el.textContent = t('err_scan');
    el.style.display = '';
    return;
  }

  const recipe = res.data.recipe;
  lastScanSuccessId = recipe.id;
  lastScanSuccessTitle = recipe.title;
  sessionStorage.setItem('scan_success_id', recipe.id);
  sessionStorage.setItem('scan_success_title', recipe.title);
  selectedFile = null;
  document.getElementById('scan-btn').disabled = true;
  renderSuccessMessage(recipe.id, recipe.title);
  showLastScan(recipe, res.data);
}

function logout() { removeToken(); window.location.href = 'index.html'; }

document.addEventListener('langchange', () => {
  if (lastScanSuccessId) {
    renderSuccessMessage(lastScanSuccessId, lastScanSuccessTitle);
  }
  if (lastScanRecipe && lastScanData) {
    showLastScan(lastScanRecipe, lastScanData);
  }
});
