requireAuth();

let allPrices = [];
let allStores = [];
let allBrands = [];

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
    const _avSrc = resolveImgUrl(avatarUrl);
    el.innerHTML = `<img src="${_avSrc}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
  } else {
    el.innerHTML = `<span id="avatar-initials">${initials}</span>`;
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
  const u = (unit || '').toLowerCase().trim();
  if (KG_UNITS.has(u)) return pricePaid / qty;
  if (G_UNITS.has(u)) return (pricePaid / qty) * 1000;
  return pricePaid / qty;
}

// ── Select option builders ────────────────────────────────────────────────────
const UNITS = ['g', 'kg', 'ml', 'l', 'unidad', 'pieza'];

function storeOptions(selectedId) {
  const blank = `<option value="">${t('no_store')}</option>`;
  return blank + allStores.map(s =>
    `<option value="${s.id}"${s.id === selectedId ? ' selected' : ''}>${s.name}</option>`
  ).join('');
}

// Normalize: lowercase, no accents — mirrors backend _norm()
function normIng(s) {
  return (s || '').toLowerCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function stripPlural(s) {
  if (s.endsWith('es') && s.length > 4) return s.slice(0, -2);
  if (s.endsWith('s') && s.length > 3) return s.slice(0, -1);
  return s;
}

function brandMatchesIngredient(brand, ingName) {
  if (!brand.ingredient_name) return true;  // generic → always show
  const bn = normIng(brand.ingredient_name);
  const ing = normIng(ingName);
  if (!ing) return true;  // row has no ingredient yet → show all
  if (bn === ing) return true;
  if ((ing + ' ').startsWith(bn + ' ') || (bn + ' ').startsWith(ing + ' ')) return true;
  if (stripPlural(bn) === stripPlural(ing)) return true;
  return false;
}

function brandOptions(selectedId, ingName) {
  const visible = allBrands.filter(b => brandMatchesIngredient(b, ingName));
  const blank = `<option value="">${t('no_brand')}</option>`;
  return blank + visible.map(b =>
    `<option value="${b.id}"${b.id === selectedId ? ' selected' : ''}>${b.name}</option>`
  ).join('');
}

function unitOptions(selected) {
  return UNITS.map(u =>
    `<option value="${u}"${u === selected ? ' selected' : ''}>${u}</option>`
  ).join('');
}

// ── Stores ────────────────────────────────────────────────────────────────────
async function loadStores() {
  const res = await apiFetch('/stores');
  allStores = (res && res.ok) ? res.data : [];
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
  const btn = document.querySelector('#stores-modal .btn-orange');
  btn.disabled = true;
  try {
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
    renderStoresList();
    applySortAndRender();
  } finally {
    btn.disabled = false;
  }
}

function deleteStore(storeId, storeName) {
  showConfirmModal(tf('confirm_del_store', { name: storeName }), '', async () => {
    const res = await apiFetch(`/stores/${storeId}`, { method: 'DELETE' });
    if (res !== null && res !== undefined && !res.ok) {
      showError(t('err_store_del'));
      return;
    }
    allStores = allStores.filter(s => s.id !== storeId);
    renderStoresList();
    applySortAndRender();
  });
}

// ── Brands ────────────────────────────────────────────────────────────────────
async function loadBrands() {
  const res = await apiFetch('/brands');
  allBrands = (res && res.ok) ? res.data : [];
}

function renderBrandsList() {
  const el = document.getElementById('brands-list');
  if (!el) return;
  if (allBrands.length === 0) {
    el.innerHTML = `<p class="text-muted">${t('no_brands')}</p>`;
    return;
  }
  el.innerHTML = allBrands.map(b => `
    <div id="brow-${b.id}" style="display:flex;align-items:center;gap:0.4rem;padding:0.4rem 0;border-bottom:1px solid var(--border);">
      <span class="brand-name-area" style="flex:1;display:flex;align-items:center;gap:0.3rem;flex-wrap:wrap;">
        <span style="font-weight:500;">${b.name}</span>
        ${b.ingredient_name ? `<span style="font-size:0.78rem;color:var(--text-muted);">(${tf('brand_for', { ing: b.ingredient_name })})</span>` : ''}
        <button onclick="startEditBrandIng('${b.id}')" style="background:none;border:none;cursor:pointer;font-size:0.8rem;color:var(--text-muted);padding:0;" title="${t('ph_brand_ing')}">✏️</button>
      </span>
      <button class="btn btn-danger btn-sm" onclick="deleteBrand('${b.id}','${b.name.replace(/'/g, '\\\'')}')">${t('btn_del_price')}</button>
    </div>`).join('');
}

function startEditBrandIng(brandId) {
  const row = document.getElementById('brow-' + brandId);
  if (!row) return;
  const area = row.querySelector('.brand-name-area');
  const brand = allBrands.find(b => b.id === brandId);
  const safeName = brand ? brand.name : '';
  const current = brand ? (brand.ingredient_name || '') : '';
  area.innerHTML = `
    <span style="font-weight:500;">${safeName}</span>
    <input id="bing-input-${brandId}" type="text" value="${current}"
      placeholder="${t('ph_brand_ing')}"
      style="font-size:0.82rem;padding:0.15rem 0.3rem;width:130px;border:1px solid var(--border);border-radius:4px;"
      onkeydown="if(event.key==='Enter')saveBrandIng('${brandId}');if(event.key==='Escape')renderBrandsList()">
    <button onclick="saveBrandIng('${brandId}')" style="background:none;border:none;cursor:pointer;color:green;font-size:1rem;padding:0 0.15rem;" title="Guardar">✓</button>
    <button onclick="renderBrandsList()" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:1rem;padding:0 0.15rem;" title="Cancelar">✕</button>`;
  document.getElementById('bing-input-' + brandId)?.focus();
}

async function saveBrandIng(brandId) {
  const input = document.getElementById('bing-input-' + brandId);
  const ingName = (input?.value || '').trim().toLowerCase() || null;
  const res = await apiFetch(`/brands/${brandId}`, {
    method: 'PATCH',
    body: JSON.stringify({ ingredient_name: ingName })
  });
  if (res && res.ok) {
    const idx = allBrands.findIndex(b => b.id === brandId);
    if (idx !== -1) allBrands[idx] = res.data;
    renderBrandsList();
    applySortAndRender();
  }
}

function openBrandsModal() {
  document.getElementById('brands-error').style.display = 'none';
  document.getElementById('new-brand-name').value = '';
  if (document.getElementById('new-brand-ing')) document.getElementById('new-brand-ing').value = '';
  renderBrandsList();
  document.getElementById('brands-modal').classList.add('open');
}

function closeBrandsModal() {
  document.getElementById('brands-modal').classList.remove('open');
}

async function createBrand() {
  const name = document.getElementById('new-brand-name').value.trim();
  const ingName = (document.getElementById('new-brand-ing')?.value || '').trim().toLowerCase() || null;
  const errEl = document.getElementById('brands-error');
  errEl.style.display = 'none';
  if (!name) return;
  const btn = document.querySelector('#brands-modal .btn-orange');
  btn.disabled = true;
  try {
    const res = await apiFetch('/brands', {
      method: 'POST',
      body: JSON.stringify({ name, ingredient_name: ingName })
    });
    if (!res || !res.ok) {
      errEl.textContent = t('err_brand_create');
      errEl.style.display = '';
      return;
    }
    document.getElementById('new-brand-name').value = '';
    if (document.getElementById('new-brand-ing')) document.getElementById('new-brand-ing').value = '';
    if (!allBrands.find(b => b.id === res.data.id)) {
      allBrands.push(res.data);
    }
    renderBrandsList();
    applySortAndRender();
  } finally {
    btn.disabled = false;
  }
}

function deleteBrand(brandId, brandName) {
  showConfirmModal(tf('confirm_del_brand', { name: brandName }), '', async () => {
    const res = await apiFetch(`/brands/${brandId}`, { method: 'DELETE' });
    if (res !== null && res !== undefined && !res.ok) {
      showError(t('err_brand_del'));
      return;
    }
    allBrands = allBrands.filter(b => b.id !== brandId);
    renderBrandsList();
    applySortAndRender();
  });
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

// ── Inline table ──────────────────────────────────────────────────────────────
function buildPriceRow(p) {
  const ppkg = calcPricePerKg(p.bought_qty, p.bought_unit, p.bought_price) ?? p.price_per_kg;
  const priceVal = p.bought_price != null ? p.bought_price : (p.price_per_kg != null ? p.price_per_kg : '');
  return `
    <tr class="price-row" data-id="${p.id}" onfocusout="handleRowFocusOut(event,'${p.id}')">
      <td class="cell-name">${tIng(p.ingredient_name)}</td>
      <td><select class="cell-sel store-cell" aria-label="${t('label_store')}" onchange="updateCalc(this)">${storeOptions(p.store_id)}</select></td>
      <td><select class="cell-sel brand-cell" aria-label="${t('manage_brands')}" onchange="updateCalc(this)">${brandOptions(p.brand_id, p.ingredient_name)}</select></td>
      <td><input class="cell-inp qty-cell" type="text" inputmode="decimal" value="${p.bought_qty || ''}" placeholder="—" oninput="updateCalc(this)"></td>
      <td><select class="cell-sel unit-cell" aria-label="${t('label_unit_req')}" onchange="updateCalc(this)">${unitOptions(p.bought_unit || 'g')}</select></td>
      <td><input class="cell-inp price-cell" type="text" inputmode="decimal" value="${priceVal}" placeholder="—" oninput="updateCalc(this)"></td>
      <td class="ppkg-cell">${ppkg != null ? '€' + ppkg.toFixed(2) : '—'}</td>
      <td><button class="btn btn-danger btn-sm" onclick="deletePrice('${p.id}','${p.ingredient_name.replace(/'/g, "\\'")}')">${t('btn_del_price')}</button></td>
    </tr>`;
}

function buildNewRow() {
  return `
    <tr class="price-row new-price-row" data-id="new" onfocusout="handleRowFocusOut(event,'new')">
      <td><input class="cell-inp ing-cell" type="text" placeholder="${t('ph_price_ing')}"
           oninput="refreshNewRowBrands(this)"></td>
      <td><select class="cell-sel store-cell" aria-label="${t('label_store')}" onchange="updateCalc(this)">${storeOptions(null)}</select></td>
      <td><select class="cell-sel brand-cell" aria-label="${t('manage_brands')}" onchange="updateCalc(this)">${brandOptions(null, '')}</select></td>
      <td><input class="cell-inp qty-cell" type="text" inputmode="decimal" placeholder="—" oninput="updateCalc(this)"></td>
      <td><select class="cell-sel unit-cell" aria-label="${t('label_unit_req')}" onchange="updateCalc(this)">${unitOptions('g')}</select></td>
      <td><input class="cell-inp price-cell" type="text" inputmode="decimal" placeholder="—" oninput="updateCalc(this)"></td>
      <td class="ppkg-cell">—</td>
      <td></td>
    </tr>`;
}

function refreshNewRowBrands(ingInput) {
  const row = ingInput.closest('tr');
  const sel = row.querySelector('.brand-cell');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = brandOptions(current, ingInput.value).replace('<select', '').replace('</select>', '');
  sel.value = current;  // preserve selection if still visible
}

function renderTable(prices) {
  const wrap = document.getElementById('prices-table-wrap');
  wrap.innerHTML = `
    <div style="overflow-x:auto;">
      <table class="ing-table prices-inline-table">
        <thead><tr>
          <th>${t('th_ingredient')}</th>
          <th>${t('th_store')}</th>
          <th>${t('th_brand')}</th>
          <th>${t('th_qty')}</th>
          <th>${t('th_unit')}</th>
          <th>${t('th_price')}</th>
          <th>${t('th_price_kg')}</th>
          <th></th>
        </tr></thead>
        <tbody>
          ${prices.map(p => buildPriceRow(p)).join('')}
          ${buildNewRow()}
        </tbody>
      </table>
    </div>`;
}

// ── Live €/kg preview ─────────────────────────────────────────────────────────
function updateCalc(el) {
  const row = el.closest('tr');
  const qty = parseFloat((row.querySelector('.qty-cell')?.value || '').replace(',', '.'));
  const unit = row.querySelector('.unit-cell')?.value || 'g';
  const price = parseFloat((row.querySelector('.price-cell')?.value || '').replace(',', '.'));
  const ppkgCell = row.querySelector('.ppkg-cell');
  if (!isNaN(qty) && qty > 0 && !isNaN(price) && price > 0) {
    const ppkg = calcPricePerKg(qty, unit, price);
    ppkgCell.textContent = ppkg != null ? '€' + ppkg.toFixed(2) : '—';
  } else if (!isNaN(price) && price > 0) {
    ppkgCell.textContent = '€' + price.toFixed(2);
  } else {
    ppkgCell.textContent = '—';
  }
}

// ── Auto-save on row blur ─────────────────────────────────────────────────────
function handleRowFocusOut(event, priceId) {
  if (event.currentTarget.contains(event.relatedTarget)) return;
  if (priceId === 'new') {
    saveNewRow(event.currentTarget);
  } else {
    saveRowEdit(priceId, event.currentTarget);
  }
}

async function saveRowEdit(priceId, row) {
  const storeId = row.querySelector('.store-cell')?.value || null;
  const brandId = row.querySelector('.brand-cell')?.value || null;
  const qty = parseFloat((row.querySelector('.qty-cell')?.value || '').replace(',', '.'));
  const unit = row.querySelector('.unit-cell')?.value || 'g';
  const price = parseFloat((row.querySelector('.price-cell')?.value || '').replace(',', '.'));
  const hasQty = !isNaN(qty) && qty > 0;
  const hasPrice = !isNaN(price) && price > 0;
  if (!hasPrice) return;

  let body = { store_id: storeId, brand_id: brandId };
  if (hasQty) {
    body.bought_qty = qty;
    body.bought_unit = unit;
    body.bought_price = price;
  } else {
    body.price_per_kg = price;
  }

  const res = await apiFetch(`/prices/${priceId}`, {
    method: 'PUT',
    body: JSON.stringify(body)
  });

  if (!res || !res.ok) {
    showError(res?.data?.error || t('err_price_save'));
    return;
  }

  const idx = allPrices.findIndex(x => x.id === priceId);
  if (idx !== -1) allPrices[idx] = { ...allPrices[idx], ...res.data };

  const ppkg = calcPricePerKg(res.data.bought_qty, res.data.bought_unit, res.data.bought_price) ?? res.data.price_per_kg;
  const ppkgCell = row.querySelector('.ppkg-cell');
  if (ppkgCell) ppkgCell.textContent = ppkg != null ? '€' + ppkg.toFixed(2) : '—';

  showSuccess(t('btn_save'));
}

async function saveNewRow(row) {
  const name = row.querySelector('.ing-cell')?.value?.trim().toLowerCase();
  if (!name) return;

  const storeId = row.querySelector('.store-cell')?.value || null;
  const brandId = row.querySelector('.brand-cell')?.value || null;
  const qty = parseFloat((row.querySelector('.qty-cell')?.value || '').replace(',', '.'));
  const unit = row.querySelector('.unit-cell')?.value || 'g';
  const price = parseFloat((row.querySelector('.price-cell')?.value || '').replace(',', '.'));
  const hasQty = !isNaN(qty) && qty > 0;
  const hasPrice = !isNaN(price) && price > 0;

  if (!hasPrice) {
    showError(t('err_fill_fields'));
    return;
  }

  let body = { ingredient_name: name, store_id: storeId, brand_id: brandId };
  if (hasQty) {
    body.bought_qty = qty;
    body.bought_unit = unit;
    body.bought_price = price;
  } else {
    body.price_per_kg = price;
  }

  const res = await apiFetch('/prices', {
    method: 'POST',
    body: JSON.stringify(body)
  });

  if (!res || !res.ok) {
    showError(res?.data?.error || (res?.status === 409 ? t('err_price_conflict') : t('err_price_save')));
    return;
  }

  showSuccess(t('btn_save'));
  await loadPrices();
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

document.getElementById('stores-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeStoresModal();
});
document.getElementById('brands-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeBrandsModal();
});

document.addEventListener('langchange', () => {
  renderStoresList();
  renderBrandsList();
  applySortAndRender();
});

async function init() {
  await loadStores();
  await loadBrands();
  await loadPrices();
}

init();
