requireAuth();

let allPrices = [];
let allStores = [];
let allBrands = [];
let editingPriceId = null;
let addMode = 'qty';
let editMode = 'qty';

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
    el.innerHTML = `<img src="${resolveImgUrl(avatarUrl)}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
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

// ── €/kg calculator ───────────────────────────────────────────────────────────
const G_UNITS = new Set(['g', 'gr', 'gram', 'grams', 'gramo', 'gramos', 'ml', 'milliliter', 'milliliters']);
const KG_UNITS = new Set(['kg', 'kilogram', 'kilograms', 'kilo', 'kilos', 'l', 'liter', 'liters', 'litro', 'litros']);

function calcPricePerKg(qty, unit, pricePaid) {
  if (!qty || !pricePaid) return null;
  const u = unit.toLowerCase().trim();
  if (KG_UNITS.has(u)) return pricePaid / qty;
  if (G_UNITS.has(u)) return (pricePaid / qty) * 1000;
  return pricePaid / qty;
}

// ── Stores ────────────────────────────────────────────────────────────────────
async function loadStores() {
  const res = await apiFetch('/stores');
  allStores = (res && res.ok) ? res.data : [];
  rebuildStoreDropdowns();
}

// ── Brands ────────────────────────────────────────────────────────────────────
async function loadBrands() {
  const res = await apiFetch('/brands');
  allBrands = (res && res.ok) ? res.data : [];
  rebuildBrandDropdowns();
}

function rebuildBrandDropdowns() {
  const noBrandOpt = `<option value="">${t('no_brand')}</option>`;
  const opts = noBrandOpt + allBrands.map(b =>
    `<option value="${b.id}">${b.name}</option>`
  ).join('');
  document.getElementById('add-brand').innerHTML = opts;
  document.getElementById('edit-brand').innerHTML = opts;
  renderBrandsList();
}

function renderBrandsList() {
  const el = document.getElementById('brands-list');
  if (!el) return;
  if (allBrands.length === 0) {
    el.innerHTML = `<p class="text-muted">${t('no_brands')}</p>`;
    return;
  }
  el.innerHTML = allBrands.map(b => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:0.4rem 0;border-bottom:1px solid var(--border);">
      <span>${b.name}</span>
      <button class="btn btn-danger btn-sm" onclick="deleteBrand('${b.id}','${b.name.replace(/'/g, '\\\'')}')">${t('btn_del_price')}</button>
    </div>`).join('');
}

function openBrandsModal() {
  document.getElementById('brands-error').style.display = 'none';
  document.getElementById('new-brand-name').value = '';
  renderBrandsList();
  document.getElementById('brands-modal').classList.add('open');
}

function closeBrandsModal() {
  document.getElementById('brands-modal').classList.remove('open');
}

async function createBrand() {
  const name = document.getElementById('new-brand-name').value.trim();
  const errEl = document.getElementById('brands-error');
  errEl.style.display = 'none';
  if (!name) return;
  const res = await apiFetch('/brands', {
    method: 'POST',
    body: JSON.stringify({ name })
  });
  if (!res || !res.ok) {
    errEl.textContent = t('err_brand_create');
    errEl.style.display = '';
    return;
  }
  document.getElementById('new-brand-name').value = '';
  if (!allBrands.find(b => b.id === res.data.id)) {
    allBrands.push(res.data);
  }
  rebuildBrandDropdowns();
}

function deleteBrand(brandId, brandName) {
  showConfirmModal(tf('confirm_del_brand', { name: brandName }), '', async () => {
    const res = await apiFetch(`/brands/${brandId}`, { method: 'DELETE' });
    if (res !== null && res !== undefined && !res.ok) {
      showError(t('err_brand_del'));
      return;
    }
    allBrands = allBrands.filter(b => b.id !== brandId);
    rebuildBrandDropdowns();
  });
}

function rebuildStoreDropdowns() {
  const noStoreOpt = `<option value="">${t('no_store')}</option>`;
  const opts = noStoreOpt + allStores.map(s =>
    `<option value="${s.id}">${s.name}</option>`
  ).join('');
  document.getElementById('add-store').innerHTML = opts;
  document.getElementById('edit-store').innerHTML = opts;
  renderStoresList();
}

function renderStoresList() {
  const el = document.getElementById('stores-list');
  if (!el) return;
  if (allStores.length === 0) {
    el.innerHTML = `<p class="text-muted">${t('no_stores')}</p>`;
    return;
  }
  el.innerHTML = allStores.map(s => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:0.4rem 0;border-bottom:1px solid var(--border);">
      <span>${s.name}</span>
      <button class="btn btn-danger btn-sm" onclick="deleteStore('${s.id}','${s.name.replace(/'/g, '\\\'')}')">${t('btn_del_price')}</button>
    </div>`).join('');
}

function openStoresModal() {
  document.getElementById('stores-error').style.display = 'none';
  document.getElementById('new-store-name').value = '';
  renderStoresList();
  document.getElementById('stores-modal').classList.add('open');
}

function closeStoresModal() {
  document.getElementById('stores-modal').classList.remove('open');
}

async function createStore() {
  const name = document.getElementById('new-store-name').value.trim();
  const errEl = document.getElementById('stores-error');
  errEl.style.display = 'none';
  if (!name) return;
  const res = await apiFetch('/stores', {
    method: 'POST',
    body: JSON.stringify({ name })
  });
  if (!res || !res.ok) {
    errEl.textContent = t('err_store_create');
    errEl.style.display = '';
    return;
  }
  document.getElementById('new-store-name').value = '';
  if (!allStores.find(s => s.id === res.data.id)) {
    allStores.push(res.data);
  }
  rebuildStoreDropdowns();
}

function deleteStore(storeId, storeName) {
  showConfirmModal(tf('confirm_del_store', { name: storeName }), '', async () => {
    const res = await apiFetch(`/stores/${storeId}`, { method: 'DELETE' });
    if (res !== null && res !== undefined && !res.ok) {
      showError(t('err_store_del'));
      return;
    }
    allStores = allStores.filter(s => s.id !== storeId);
    rebuildStoreDropdowns();
  });
}

// ── Entry mode toggle ─────────────────────────────────────────────────────────
function setAddMode(mode) {
  addMode = mode;
  document.getElementById('add-mode-qty').classList.toggle('active', mode === 'qty');
  document.getElementById('add-mode-kg').classList.toggle('active', mode === 'kg');
  document.getElementById('add-qty-fields').style.display = mode === 'qty' ? '' : 'none';
  document.getElementById('add-kg-field').style.display = mode === 'kg' ? '' : 'none';
}

function setEditMode(mode) {
  editMode = mode;
  document.getElementById('edit-mode-qty').classList.toggle('active', mode === 'qty');
  document.getElementById('edit-mode-kg').classList.toggle('active', mode === 'kg');
  document.getElementById('edit-qty-fields').style.display = mode === 'qty' ? '' : 'none';
  document.getElementById('edit-kg-field').style.display = mode === 'kg' ? '' : 'none';
}

// Live preview of calculated €/kg
function updateAddPreview() {
  const qty = parseFloat(document.getElementById('add-bought-qty').value.replace(',', '.'));
  const unit = document.getElementById('add-bought-unit').value;
  const price = parseFloat(document.getElementById('add-bought-price').value.replace(',', '.'));
  const preview = document.getElementById('add-price-preview');
  const result = calcPricePerKg(qty, unit, price);
  if (result !== null && !isNaN(result)) {
    preview.textContent = tf('price_preview', { price: result.toFixed(2) });
    preview.style.display = '';
  } else {
    preview.style.display = 'none';
  }
}

function updateEditPreview() {
  const qty = parseFloat(document.getElementById('edit-bought-qty').value.replace(',', '.'));
  const unit = document.getElementById('edit-bought-unit').value;
  const price = parseFloat(document.getElementById('edit-bought-price').value.replace(',', '.'));
  const preview = document.getElementById('edit-price-preview');
  const result = calcPricePerKg(qty, unit, price);
  if (result !== null && !isNaN(result)) {
    preview.textContent = tf('price_preview', { price: result.toFixed(2) });
    preview.style.display = '';
  } else {
    preview.style.display = 'none';
  }
}

// ── Sort ──────────────────────────────────────────────────────────────────────
function sortedPrices(prices) {
  const mode = document.getElementById('sort-select')?.value || 'name-asc';
  const copy = [...prices];
  switch (mode) {
    case 'name-asc':
      return copy.sort((a, b) => a.ingredient_name.localeCompare(b.ingredient_name));
    case 'name-desc':
      return copy.sort((a, b) => b.ingredient_name.localeCompare(a.ingredient_name));
    case 'price-asc':
      return copy.sort((a, b) => a.price_per_kg - b.price_per_kg);
    case 'price-desc':
      return copy.sort((a, b) => b.price_per_kg - a.price_per_kg);
    case 'store':
      return copy.sort((a, b) => {
        const sa = (a.store_name || '').toLowerCase();
        const sb = (b.store_name || '').toLowerCase();
        if (sa !== sb) return sa.localeCompare(sb);
        return a.ingredient_name.localeCompare(b.ingredient_name);
      });
    case 'brand':
      return copy.sort((a, b) => {
        const ba = (a.brand_name || '').toLowerCase();
        const bb = (b.brand_name || '').toLowerCase();
        if (ba !== bb) return ba.localeCompare(bb);
        return a.ingredient_name.localeCompare(b.ingredient_name);
      });
    default:
      return copy;
  }
}

function applySortAndRender() {
  renderTable(sortedPrices(allPrices));
}

// ── Render table ──────────────────────────────────────────────────────────────
function storeNameById(id) {
  if (!id) return '—';
  const s = allStores.find(s => s.id === id);
  return s ? s.name : '—';
}

function renderTable(prices) {
  const wrap = document.getElementById('prices-table-wrap');

  if (prices.length === 0) {
    wrap.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🏷</div>
        <p>${t('no_prices')}</p>
      </div>`;
    return;
  }

  const rows = prices.map(p => {
    const storeName = p.store_name || storeNameById(p.store_id) || '—';
    const brandBadge = p.brand_name
      ? `<span class="brand-badge">${p.brand_name}</span>`
      : `<span class="text-muted" style="font-size:0.8rem;">—</span>`;
    const boughtInfo = (p.bought_qty && p.bought_unit && p.bought_price)
      ? `<span class="text-muted" style="font-size:0.78rem;">${p.bought_qty} ${p.bought_unit} · €${p.bought_price}</span>`
      : '';
    return `
    <tr>
      <td class="ing-name">${tIng(p.ingredient_name)}</td>
      <td>${storeName}</td>
      <td>${brandBadge}</td>
      <td>€${p.price_per_kg.toFixed(2)}<br>${boughtInfo}</td>
      <td>
        <div style="display:flex;gap:0.4rem;">
          <button class="btn btn-edit btn-sm" onclick="openEditModal('${p.id}')">${t('btn_edit_price')}</button>
          <button class="btn btn-danger btn-sm" onclick="deletePrice('${p.id}','${p.ingredient_name.replace(/'/g, '\\\'')}')">${t('btn_del_price')}</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  wrap.innerHTML = `
    <table class="ing-table">
      <thead><tr>
        <th>${t('th_ingredient')}</th>
        <th>${t('th_store')}</th>
        <th>${t('th_brand')}</th>
        <th>${t('th_price_kg')}</th>
        <th>${t('th_actions')}</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ── Load ──────────────────────────────────────────────────────────────────────
async function loadPrices() {
  const res = await apiFetch('/prices');
  if (!res || !res.ok) {
    document.getElementById('prices-table-wrap').innerHTML =
      `<p class="text-muted" style="padding:1rem;">${t('err_load')}</p>`;
    return;
  }
  allPrices = res.data;
  applySortAndRender();
}

// ── Add modal ─────────────────────────────────────────────────────────────────
function openAddModal() {
  document.getElementById('add-name').value = '';
  document.getElementById('add-brand').value = '';
  document.getElementById('add-bought-qty').value = '';
  document.getElementById('add-bought-price').value = '';
  document.getElementById('add-price-kg').value = '';
  document.getElementById('add-price-preview').style.display = 'none';
  document.getElementById('add-error').style.display = 'none';
  document.getElementById('add-store').value = '';
  setAddMode('qty');
  document.getElementById('add-modal').classList.add('open');
  document.getElementById('add-name').focus();
}

function closeAddModal() {
  document.getElementById('add-modal').classList.remove('open');
}

async function saveAdd() {
  const name = document.getElementById('add-name').value.trim().toLowerCase();
  const storeId = document.getElementById('add-store').value || null;
  const errEl = document.getElementById('add-error');
  errEl.style.display = 'none';

  if (!name) {
    errEl.textContent = t('err_fill_fields');
    errEl.style.display = '';
    return;
  }

  const brandId = document.getElementById('add-brand').value || null;
  let body = { ingredient_name: name, store_id: storeId, brand_id: brandId };

  if (addMode === 'qty') {
    const qty = parseFloat(document.getElementById('add-bought-qty').value.replace(',', '.'));
    const unit = document.getElementById('add-bought-unit').value;
    const pricePaid = parseFloat(document.getElementById('add-bought-price').value.replace(',', '.'));
    if (isNaN(qty) || isNaN(pricePaid) || qty <= 0 || pricePaid <= 0) {
      errEl.textContent = t('err_fill_fields');
      errEl.style.display = '';
      return;
    }
    body.bought_qty = qty;
    body.bought_unit = unit;
    body.bought_price = pricePaid;
  } else {
    const priceKg = parseFloat(document.getElementById('add-price-kg').value.replace(',', '.'));
    if (isNaN(priceKg) || priceKg < 0) {
      errEl.textContent = t('err_fill_fields');
      errEl.style.display = '';
      return;
    }
    body.price_per_kg = priceKg;
  }

  const res = await apiFetch('/prices', {
    method: 'POST',
    body: JSON.stringify(body)
  });

  if (!res || !res.ok) {
    errEl.textContent = res?.data?.error || (res?.status === 409 ? t('err_price_conflict') : t('err_price_save'));
    errEl.style.display = '';
    return;
  }

  closeAddModal();
  showSuccess(t('btn_save'));
  await loadPrices();
}

// ── Edit modal ────────────────────────────────────────────────────────────────
function openEditModal(priceId) {
  const p = allPrices.find(x => x.id === priceId);
  if (!p) return;
  editingPriceId = priceId;
  document.getElementById('edit-name').value = p.ingredient_name;
  document.getElementById('edit-price-preview').style.display = 'none';
  document.getElementById('edit-error').style.display = 'none';

  document.getElementById('edit-store').value = p.store_id || '';
  document.getElementById('edit-brand').value = p.brand_id || '';

  if (p.bought_qty && p.bought_unit && p.bought_price) {
    setEditMode('qty');
    document.getElementById('edit-bought-qty').value = p.bought_qty;
    document.getElementById('edit-bought-unit').value = p.bought_unit;
    document.getElementById('edit-bought-price').value = p.bought_price;
    updateEditPreview();
  } else {
    setEditMode('kg');
    document.getElementById('edit-price-kg').value = p.price_per_kg;
  }

  document.getElementById('edit-modal').classList.add('open');
}

function closeEditModal() {
  document.getElementById('edit-modal').classList.remove('open');
  editingPriceId = null;
}

async function saveEdit() {
  const storeId = document.getElementById('edit-store').value || null;
  const brandId = document.getElementById('edit-brand').value || null;
  const errEl = document.getElementById('edit-error');
  errEl.style.display = 'none';

  let body = { store_id: storeId, brand_id: brandId };

  if (editMode === 'qty') {
    const qty = parseFloat(document.getElementById('edit-bought-qty').value.replace(',', '.'));
    const unit = document.getElementById('edit-bought-unit').value;
    const pricePaid = parseFloat(document.getElementById('edit-bought-price').value.replace(',', '.'));
    if (isNaN(qty) || isNaN(pricePaid) || qty <= 0 || pricePaid <= 0) {
      errEl.textContent = t('err_fill_fields');
      errEl.style.display = '';
      return;
    }
    body.bought_qty = qty;
    body.bought_unit = unit;
    body.bought_price = pricePaid;
  } else {
    const priceKg = parseFloat(document.getElementById('edit-price-kg').value.replace(',', '.'));
    if (isNaN(priceKg) || priceKg < 0) {
      errEl.textContent = t('err_fill_fields');
      errEl.style.display = '';
      return;
    }
    body.price_per_kg = priceKg;
  }

  const res = await apiFetch(`/prices/${editingPriceId}`, {
    method: 'PUT',
    body: JSON.stringify(body)
  });

  if (!res || !res.ok) {
    errEl.textContent = res?.data?.error || t('err_price_save');
    errEl.style.display = '';
    return;
  }

  closeEditModal();
  showSuccess(t('btn_save'));
  await loadPrices();
}

// ── Delete ────────────────────────────────────────────────────────────────────
function deletePrice(priceId, name) {
  showConfirmModal(tf('confirm_del_price', { name }), '', async () => {
    const res = await apiFetch(`/prices/${priceId}`, { method: 'DELETE' });
    if (res !== null && res !== undefined && !res.ok) {
      showError(t('err_price_del'));
      return;
    }
    showSuccess(t('btn_del_price'));
    await loadPrices();
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function showSuccess(msg) {
  const el = document.getElementById('prices-success');
  el.textContent = msg;
  el.style.display = '';
  setTimeout(() => { el.style.display = 'none'; }, 2500);
}

function showError(msg) {
  const el = document.getElementById('prices-error');
  el.textContent = msg;
  el.style.display = '';
  setTimeout(() => { el.style.display = 'none'; }, 3000);
}

function logout() { removeToken(); window.location.href = 'index.html'; }

// ── Modal close on backdrop click ─────────────────────────────────────────────
document.getElementById('add-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeAddModal();
});
document.getElementById('edit-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeEditModal();
});
document.getElementById('stores-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeStoresModal();
});
document.getElementById('brands-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeBrandsModal();
});

// Live preview listeners
['add-bought-qty', 'add-bought-price'].forEach(id => {
  document.getElementById(id).addEventListener('input', updateAddPreview);
});
document.getElementById('add-bought-unit').addEventListener('change', updateAddPreview);
['edit-bought-qty', 'edit-bought-price'].forEach(id => {
  document.getElementById(id).addEventListener('input', updateEditPreview);
});
document.getElementById('edit-bought-unit').addEventListener('change', updateEditPreview);

document.addEventListener('langchange', () => {
  rebuildStoreDropdowns();
  rebuildBrandDropdowns();
  applySortAndRender();
});

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  await loadStores();
  await loadBrands();
  await loadPrices();
}

init();
