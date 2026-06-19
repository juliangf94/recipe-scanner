requireAuth();

const params = new URLSearchParams(window.location.search);
const recipeId = params.get('id');
if (!recipeId) window.location.href = 'dashboard.html';

let currentRecipe = null;
let currentIngredients = [];
let currentSteps = [];
let currentCostData = null;
let currentPriceIngId = null;
let allStores = [];
let allBrands = [];
let priceModalMode = 'qty';

// Unit sets for €/kg calculation (mirrors backend)
const _G_UNITS = new Set(['g', 'gr', 'gram', 'grams', 'gramo', 'gramos', 'ml', 'milliliter', 'milliliters']);
const _KG_UNITS = new Set(['kg', 'kilogram', 'kilograms', 'kilo', 'kilos', 'l', 'liter', 'liters', 'litro', 'litros']);

function calcPricePerKg(qty, unit, pricePaid) {
  if (!qty || !pricePaid) return null;
  const u = unit.toLowerCase().trim();
  if (_KG_UNITS.has(u)) return pricePaid / qty;
  if (_G_UNITS.has(u)) return (pricePaid / qty) * 1000;
  return pricePaid / qty;
}

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
    el.innerHTML = `<img src="http://localhost:5000${avatarUrl}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"><div class="avatar-overlay">📷</div>`;
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

async function uploadRecipeImage(event) {
  const file = event.target.files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('file', file);
  const res = await apiUpload(`/recipes/${recipeId}/image`, fd);
  if (!res || !res.ok) return;
  currentRecipe.image_url = res.data.image_url;
  renderRecipeHeader(currentRecipe);
}

// ── Load page ─────────────────────────────────────────────────────────────────
async function loadPage() {
  const [recipeRes, ingRes, stepsRes, storesRes, brandsRes] = await Promise.all([
    apiFetch(`/recipes/${recipeId}`),
    apiFetch(`/recipes/${recipeId}/ingredients`),
    apiFetch(`/recipes/${recipeId}/steps`),
    apiFetch('/stores'),
    apiFetch('/brands')
  ]);

  if (!recipeRes || !recipeRes.ok) {
    window.location.href = 'dashboard.html';
    return;
  }

  currentRecipe = recipeRes.data;
  currentIngredients = ingRes && ingRes.ok ? ingRes.data : [];
  currentSteps = stepsRes && stepsRes.ok ? stepsRes.data : [];
  allStores = storesRes && storesRes.ok ? storesRes.data : [];
  allBrands = brandsRes && brandsRes.ok ? brandsRes.data : [];

  document.title = `RecipeScanner — ${currentRecipe.title}`;
  renderPage(currentRecipe, currentIngredients, currentSteps);
  loadCost();
}

function storeNameById(id) {
  if (!id) return '';
  const s = allStores.find(s => s.id === id);
  return s ? s.name : '';
}

function buildStoreOptions(selectedId) {
  const autoOpt = `<option value="">${t('auto_cheapest')}</option>`;
  const storeOpts = allStores.map(s =>
    `<option value="${s.id}"${s.id === selectedId ? ' selected' : ''}>${s.name}</option>`
  ).join('');
  return autoOpt + storeOpts;
}

function buildBrandOptions(selectedId) {
  const autoOpt = `<option value="">${t('no_brand')}</option>`;
  const brandOpts = allBrands.map(b =>
    `<option value="${b.id}"${b.id === selectedId ? ' selected' : ''}>${b.name}</option>`
  ).join('');
  return autoOpt + brandOpts;
}

function buildRecipeHeaderHtml(recipe) {
  const badges = [
    recipe.category ? `<span class="badge badge-cat">${recipe.category}</span>` : '',
    currentSteps.length > 0 ? `<span class="badge badge-ai">${t('badge_ai')}</span>` : '',
  ].filter(Boolean).join('');

  const meta = [];
  if (recipe.prep_time_min) meta.push(`⏱ ${tf('min_prep', { n: recipe.prep_time_min })}`);
  if (recipe.servings) meta.push(
    recipe.servings === 1 ? `🍽 ${t('n_servings_1')}` : `🍽 ${tf('n_servings_n', { n: recipe.servings })}`
  );

  const photoHtml = recipe.image_url
    ? `<div class="recipe-header-photo" onclick="document.getElementById('recipe-img-input').click()">
        <img src="http://localhost:5000${recipe.image_url}" alt="${recipe.title}">
        <div class="recipe-header-photo-overlay">${t('change_photo')}</div>
      </div>`
    : `<div class="recipe-header-photo recipe-header-photo-empty" onclick="document.getElementById('recipe-img-input').click()">
        <span style="font-size:2.2rem;">📷</span>
        <span style="font-size:0.88rem; color:var(--text-muted);">${t('add_photo')}</span>
      </div>`;

  return `<div class="recipe-header-grid">
      <div>
        <h1>${recipe.title}</h1>
        ${badges ? `<div class="badge-row">${badges}</div>` : ''}
        ${meta.length ? `<div class="detail-meta">${meta.map(m => `<span>${m}</span>`).join('')}</div>` : ''}
        ${recipe.description ? `<p class="text-muted text-sm" style="margin-top:0.5rem;">${recipe.description}</p>` : ''}
        <div class="detail-actions" style="margin-top:1.2rem;">
          <button class="btn btn-edit btn-sm" onclick="openEditModal()">${t('btn_edit')}</button>
          <button class="btn btn-danger btn-sm" onclick="deleteRecipe()">${t('btn_delete')}</button>
        </div>
      </div>
      ${photoHtml}
    </div>`;
}

function renderRecipeHeader(recipe) {
  const grid = document.querySelector('.recipe-header-grid');
  if (grid) grid.outerHTML = buildRecipeHeaderHtml(recipe);
}

function renderPage(recipe, ingredients, steps) {
  const ingCount = ingredients.length === 1 ? t('ing_1') : tf('ing_n', { n: ingredients.length });

  document.getElementById('main-content').innerHTML = `
    ${buildRecipeHeaderHtml(recipe)}

    <div class="detail-grid">
      <div class="section-card">
        <div class="section-card-header">
          <div>
            <h3>${t('section_ingredients')}</h3>
            <p class="section-hint" id="ing-count">${ingCount}</p>
          </div>
          <button class="btn btn-outline btn-sm" onclick="openIngModal()">${t('btn_add')}</button>
        </div>
        <div id="ingredients-section">
          ${renderIngredientsTable(ingredients)}
        </div>
        <div class="cost-footer" id="cost-footer" style="display:none">
          <span>${t('est_cost')}</span>
          <span id="cost-total">€0.00</span>
        </div>
      </div>

      <div class="section-card">
        <div class="section-card-header">
          <h3>${t('section_steps')}</h3>
        </div>
        <div id="steps-section">
          ${renderSteps(steps)}
        </div>
      </div>
    </div>`;

  ['edit-modal', 'ing-modal', 'price-modal'].forEach(id => {
    document.getElementById(id).addEventListener('click', e => {
      if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
    });
  });
}

// ── Section helpers ───────────────────────────────────────────────────────────
function getSections(ingredients) {
  const seen = new Set();
  const order = [];
  ingredients.forEach(i => {
    const s = i.section || '';
    if (!seen.has(s)) { seen.add(s); order.push(s); }
  });
  return order;
}

function allSectionNames(ingredients) {
  return [...new Set(ingredients.map(i => i.section || ''))];
}

function renderIngredientsTable(ingredients) {
  if (ingredients.length === 0) {
    return `<div style="padding:1.5rem 1.2rem; text-align:center; color:var(--text-muted); font-size:0.85rem;">
      ${t('no_ingredients')}
    </div>`;
  }

  const sections = getSections(ingredients);
  const thead = `
    <thead><tr>
      <th style="width:24px;"></th>
      <th>${t('th_ingredient')}</th>
      <th>${t('th_qty')}</th>
      <th>${t('th_store')}</th>
      ${allBrands.length > 0 ? `<th>${t('th_brand')}</th>` : ''}
      <th>${t('th_price_per_kg')}</th>
      <th>${t('th_total')}</th>
      <th></th>
    </tr></thead>`;

  const blocks = sections.map(sec => {
    const group = ingredients.filter(i => (i.section || '') === sec);
    const headerRow = `
      <tr class="section-header-row">
        <td colspan="7">
          <div class="section-header-cell">
            <span class="section-title" onclick="renameSection('${sec.replace(/'/g, "\\'")}', this)">${sec || t('section_no_section')}</span>
            <button class="btn-add-section-ing" onclick="promptAddSection()" title="${t('section_add')}">+ ${t('section_add')}</button>
          </div>
        </td>
      </tr>`;

    const rows = group.map(i => renderIngRow(i, sections)).join('');
    return headerRow + rows;
  }).join('');

  const addSectionRow = `
    <tr class="section-add-row">
      <td colspan="7">
        <button class="btn-add-section" onclick="addSection()">+ ${t('section_new')}</button>
      </td>
    </tr>`;

  return `
    <table class="ing-table ing-table-wide">
      ${thead}
      <tbody>${blocks}${addSectionRow}</tbody>
    </table>`;
}

function renderIngRow(i, sections) {
  const safeName = i.name.replace(/'/g, "\\'");
  const safeSection = (i.section || '').replace(/'/g, "\\'");

  const storeSelect = allStores.length > 0
    ? `<select class="store-select-inline" data-ing-id="${i.id}" data-sel="store"
           onchange="changeIngredientStore('${i.id}', this.value)">
         ${buildStoreOptions(i.preferred_store_id || null)}
       </select>`
    : `<span style="color:var(--text-muted);font-size:0.8rem;">—</span>`;

  const brandSelectCell = allBrands.length > 0
    ? `<td class="col-brand"><select class="store-select-inline" data-ing-id="${i.id}" data-sel="brand"
           onchange="changeIngredientBrand('${i.id}', this.value)">
         ${buildBrandOptions(i.preferred_brand_id || null)}
       </select></td>`
    : '';

  // Section picker options
  const sectionOpts = sections.map(s =>
    `<option value="${s.replace(/"/g, '&quot;')}"${s === (i.section || '') ? ' selected' : ''}>${s || t('section_no_section')}</option>`
  ).join('');

  return `
    <tr class="ing-row" data-ing-id="${i.id}">
      <td class="col-move">
        <div class="move-icon-wrap" title="${t('section_move')}">
          <span class="move-icon" onclick="toggleSectionPicker('${i.id}')">⠿</span>
          <div class="section-picker" id="sp-${i.id}" style="display:none;">
            <select onchange="moveToSection('${i.id}', this.value); this.closest('.section-picker').style.display='none'">
              ${sectionOpts}
              <option value="__new__">+ ${t('section_new_name')}</option>
            </select>
          </div>
        </div>
      </td>
      <td class="ing-name">${i.name}</td>
      <td class="col-qty">${i.quantity} ${i.unit}</td>
      <td class="col-store">${storeSelect}</td>
      ${brandSelectCell}
      <td class="col-price-kg price-clickable" data-ing-id="${i.id}" data-col="pkg"
          onclick="openPriceModal('${i.id}', '${safeName}')">—</td>
      <td class="col-total" data-ing-id="${i.id}" data-col="total">—</td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="deleteIngredient('${i.id}')" style="padding:2px 8px;">✕</button>
      </td>
    </tr>`;
}

// ── Section management ────────────────────────────────────────────────────────
function toggleSectionPicker(ingId) {
  // Close any other open pickers first
  document.querySelectorAll('.section-picker').forEach(el => {
    if (el.id !== `sp-${ingId}`) el.style.display = 'none';
  });
  const picker = document.getElementById(`sp-${ingId}`);
  if (picker) picker.style.display = picker.style.display === 'none' ? '' : 'none';
}

// Close pickers when clicking outside
document.addEventListener('click', e => {
  if (!e.target.closest('.move-icon-wrap')) {
    document.querySelectorAll('.section-picker').forEach(el => el.style.display = 'none');
  }
});

async function moveToSection(ingId, value) {
  let sectionName = value;
  if (value === '__new__') {
    sectionName = prompt(t('section_new_name_prompt'));
    if (!sectionName || !sectionName.trim()) return;
    sectionName = sectionName.trim();
  }
  const res = await apiFetch(`/recipes/${recipeId}/ingredients/${ingId}`, {
    method: 'PUT',
    body: JSON.stringify({ section: sectionName })
  });
  if (!res || !res.ok) return;
  const ing = currentIngredients.find(i => i.id === ingId);
  if (ing) ing.section = sectionName;
  document.getElementById('ingredients-section').innerHTML = renderIngredientsTable(currentIngredients);
  loadCost();
}

async function addSection() {
  const name = prompt(t('section_new_name_prompt'));
  if (!name || !name.trim()) return;
  // Sections only exist when an ingredient belongs to them — nothing to save yet
  // Just add a visual placeholder by assigning a dummy invisible ingredient? No.
  // Instead: ask user to pick which ingredient to put in new section, or just show the header.
  // Simplest: create the section by moving the first unsectioned ingredient there.
  // Better UX: tell user to use the ⠿ icon on any ingredient.
  alert(tf('section_created_hint', { name: name.trim() }));
}

function renameSection(oldName, el) {
  const newName = prompt(t('section_rename_prompt'), oldName);
  if (!newName || !newName.trim() || newName.trim() === oldName) return;
  const trimmed = newName.trim();
  // Update all ingredients in that section
  const targets = currentIngredients.filter(i => (i.section || '') === oldName);
  Promise.all(targets.map(i =>
    apiFetch(`/recipes/${recipeId}/ingredients/${i.id}`, {
      method: 'PUT',
      body: JSON.stringify({ section: trimmed })
    })
  )).then(() => {
    targets.forEach(i => i.section = trimmed);
    document.getElementById('ingredients-section').innerHTML = renderIngredientsTable(currentIngredients);
    loadCost();
  });
}

function promptAddSection() {
  alert(t('section_move_hint'));
}

function renderSteps(steps) {
  if (!steps || steps.length === 0) {
    return `<div style="padding:1.5rem 1.2rem; text-align:center; color:var(--text-muted); font-size:0.85rem;">
      ${t('no_steps')}
    </div>`;
  }

  const items = steps.map((s, i) => `
    <li class="step-item">
      <div class="step-num">${i + 1}</div>
      <div class="step-content">
        <p class="step-desc">${s.description || s}</p>
        ${s.duration_min ? `<span class="step-duration">⏱ ${s.duration_min} min</span>` : ''}
      </div>
    </li>`).join('');

  return `<ul class="steps-list">${items}</ul>`;
}

// ── Cost ──────────────────────────────────────────────────────────────────────
async function loadCost() {
  const res = await apiFetch(`/recipes/${recipeId}/cost`);
  if (!res || !res.ok) return;

  currentCostData = res.data;
  const c = currentCostData;

  if (c.total_estimated_cost != null) {
    document.getElementById('cost-footer').style.display = '';
    document.getElementById('cost-total').textContent = `€${c.total_estimated_cost.toFixed(2)}`;

    c.ingredients.forEach(i => {
      const src = i.source || 'fallback';
      const srcLabel = t(`src_${src}`);

      // €/kg column (clickable)
      const pkgCell = document.querySelector(`[data-ing-id="${i.ing_id}"][data-col="pkg"]`);
      if (pkgCell) {
        const pkg = i.price_per_kg != null ? `€${i.price_per_kg.toFixed(2)}` : '—';
        pkgCell.innerHTML = `<span class="price-badge price-badge-${src}">${srcLabel}</span> <span class="price-val-${src}">${pkg}</span>`;
      }

      // Total column (display only)
      const totalCell = document.querySelector(`[data-ing-id="${i.ing_id}"][data-col="total"]`);
      if (totalCell) {
        totalCell.textContent = `€${i.estimated_price.toFixed(2)}`;
      }

    });
  }
}

// ── Store picker per ingredient ───────────────────────────────────────────────
async function changeIngredientStore(ingId, storeId) {
  const sel = document.querySelector(`.store-select-inline[data-ing-id="${ingId}"][data-sel="store"]`);
  if (sel) sel.disabled = true;
  await apiFetch(`/recipes/${recipeId}/ingredients/${ingId}`, {
    method: 'PUT',
    body: JSON.stringify({ preferred_store_id: storeId || null })
  });
  const ing = currentIngredients.find(i => i.id === ingId);
  if (ing) ing.preferred_store_id = storeId || null;
  if (sel) sel.disabled = false;
  loadCost();
}

async function changeIngredientBrand(ingId, brandId) {
  const sel = document.querySelector(`.store-select-inline[data-ing-id="${ingId}"][data-sel="brand"]`);
  if (sel) sel.disabled = true;
  await apiFetch(`/recipes/${recipeId}/ingredients/${ingId}`, {
    method: 'PUT',
    body: JSON.stringify({ preferred_brand_id: brandId || null })
  });
  const ing = currentIngredients.find(i => i.id === ingId);
  if (ing) ing.preferred_brand_id = brandId || null;
  if (sel) sel.disabled = false;
  loadCost();
}

// ── Price modal: mode toggle ──────────────────────────────────────────────────
function setPriceMode(mode) {
  priceModalMode = mode;
  document.getElementById('pm-mode-qty').classList.toggle('active', mode === 'qty');
  document.getElementById('pm-mode-kg').classList.toggle('active', mode === 'kg');
  document.getElementById('pm-qty-fields').style.display = mode === 'qty' ? '' : 'none';
  document.getElementById('pm-kg-field').style.display = mode === 'kg' ? '' : 'none';
}

function updatePricePreview() {
  const qty = parseFloat(document.getElementById('pm-bought-qty').value.replace(',', '.'));
  const unit = document.getElementById('pm-bought-unit').value;
  const paid = parseFloat(document.getElementById('pm-bought-price').value.replace(',', '.'));
  const preview = document.getElementById('pm-price-preview');
  const result = calcPricePerKg(qty, unit, paid);
  if (result !== null && !isNaN(result)) {
    preview.textContent = tf('price_preview', { price: result.toFixed(2) });
    preview.style.display = '';
  } else {
    preview.style.display = 'none';
  }
}

// ── Manual price modal ────────────────────────────────────────────────────────
function openPriceModal(ingId, ingName) {
  currentPriceIngId = ingId;
  document.getElementById('price-modal-ing-name').textContent = ingName;
  document.getElementById('price-error').style.display = 'none';
  document.getElementById('pm-bought-qty').value = '';
  document.getElementById('pm-bought-price').value = '';
  document.getElementById('pm-price-preview').style.display = 'none';

  let isManual = false;
  if (currentCostData) {
    const found = currentCostData.ingredients.find(i => i.ing_id === ingId);
    if (found && found.source === 'manual') {
      isManual = true;
      // Pre-fill per-kg field with the current manual value
      document.getElementById('price-input').value = found.price_per_kg ?? '';
    } else {
      document.getElementById('price-input').value = '';
    }
  }

  document.getElementById('price-clear-btn').style.display = isManual ? '' : 'none';
  setPriceMode('qty');
  document.getElementById('price-modal').classList.add('open');
  document.getElementById('pm-bought-qty').focus();
}

function closePriceModal() {
  document.getElementById('price-modal').classList.remove('open');
  currentPriceIngId = null;
}

async function saveManualPrice() {
  const errEl = document.getElementById('price-error');
  errEl.style.display = 'none';

  let pricePerKg;

  if (priceModalMode === 'qty') {
    const qty = parseFloat(document.getElementById('pm-bought-qty').value.replace(',', '.'));
    const unit = document.getElementById('pm-bought-unit').value;
    const paid = parseFloat(document.getElementById('pm-bought-price').value.replace(',', '.'));
    if (isNaN(qty) || isNaN(paid) || qty <= 0 || paid <= 0) {
      errEl.textContent = t('err_fill_fields');
      errEl.style.display = '';
      return;
    }
    pricePerKg = calcPricePerKg(qty, unit, paid);
  } else {
    const raw = document.getElementById('price-input').value.replace(',', '.');
    pricePerKg = parseFloat(raw);
    if (isNaN(pricePerKg) || pricePerKg <= 0) {
      errEl.textContent = t('err_fill_fields');
      errEl.style.display = '';
      return;
    }
  }

  const res = await apiFetch(`/recipes/${recipeId}/ingredients/${currentPriceIngId}/price`, {
    method: 'PUT',
    body: JSON.stringify({ price_per_kg: pricePerKg })
  });

  if (!res || !res.ok) {
    errEl.textContent = t('err_price_set');
    errEl.style.display = '';
    return;
  }

  // Optimistic update on €/kg cell
  const pkgCell = document.querySelector(`[data-ing-id="${currentPriceIngId}"][data-col="pkg"]`);
  if (pkgCell) {
    pkgCell.innerHTML = `<span class="price-badge price-badge-manual">${t('src_manual')}</span> <span class="price-val-manual">€${pricePerKg.toFixed(2)}</span>`;
  }

  closePriceModal();
  loadCost();
}

async function clearManualPrice() {
  const res = await apiFetch(`/recipes/${recipeId}/ingredients/${currentPriceIngId}/price`, {
    method: 'DELETE'
  });
  if (!res || !res.ok) return;
  closePriceModal();
  loadCost();
}

async function fetchOffPrice() {
  const btn = document.getElementById('off-fetch-btn');
  btn.textContent = t('fetching_off');
  btn.disabled = true;

  const res = await apiFetch(`/recipes/${recipeId}/ingredients/${currentPriceIngId}/off-price`);

  btn.textContent = t('btn_fetch_off');
  btn.disabled = false;

  if (!res || !res.ok || !res.data.price_per_kg) {
    document.getElementById('price-error').textContent = t('err_off_fetch');
    document.getElementById('price-error').style.display = '';
    return;
  }

  // Pre-fill the per-kg field and switch to that mode
  setPriceMode('kg');
  document.getElementById('price-input').value = res.data.price_per_kg;
  document.getElementById('price-error').style.display = 'none';
}

// ── Edit recipe ───────────────────────────────────────────────────────────────
function openEditModal() {
  document.getElementById('e-title').value = currentRecipe.title;
  document.getElementById('e-desc').value = currentRecipe.description || '';
  document.getElementById('e-servings').value = currentRecipe.servings || 0;
  document.getElementById('e-prep').value = currentRecipe.prep_time_min || 0;
  document.getElementById('e-category').value = currentRecipe.category || '';
  document.getElementById('edit-modal').classList.add('open');
}

function closeEditModal() {
  document.getElementById('edit-modal').classList.remove('open');
  document.getElementById('edit-error').style.display = 'none';
}

async function saveRecipe() {
  const title = document.getElementById('e-title').value.trim();
  document.getElementById('edit-error').style.display = 'none';
  if (!title) {
    const el = document.getElementById('edit-error');
    el.textContent = t('err_title_req');
    el.style.display = '';
    return;
  }

  const res = await apiFetch(`/recipes/${recipeId}`, {
    method: 'PUT',
    body: JSON.stringify({
      title,
      description: document.getElementById('e-desc').value.trim(),
      servings: parseInt(document.getElementById('e-servings').value) || 0,
      prep_time_min: parseInt(document.getElementById('e-prep').value) || 0,
      category: titleCase(document.getElementById('e-category').value.trim())
    })
  });

  if (!res || !res.ok) {
    const el = document.getElementById('edit-error');
    el.textContent = res?.data?.error || t('err_save');
    el.style.display = '';
    return;
  }

  currentRecipe.title = title;
  currentRecipe.description = document.getElementById('e-desc').value.trim();
  currentRecipe.servings = parseInt(document.getElementById('e-servings').value) || 0;
  currentRecipe.prep_time_min = parseInt(document.getElementById('e-prep').value) || 0;
  currentRecipe.category = titleCase(document.getElementById('e-category').value.trim());
  closeEditModal();
  renderRecipeHeader(currentRecipe);
}

async function deleteRecipe() {
  if (!confirm(tf('confirm_del_recipe', { title: currentRecipe.title }))) return;
  await apiFetch(`/recipes/${recipeId}`, { method: 'DELETE' });
  window.location.href = 'dashboard.html';
}

// ── Ingredients ───────────────────────────────────────────────────────────────
function openIngModal() {
  document.getElementById('ing-modal').classList.add('open');
  document.getElementById('ing-name').focus();
}

function closeIngModal() {
  document.getElementById('ing-modal').classList.remove('open');
  document.getElementById('ing-error').style.display = 'none';
  ['ing-name', 'ing-qty', 'ing-unit'].forEach(id => document.getElementById(id).value = '');
}

async function addIngredient() {
  const name = document.getElementById('ing-name').value.trim();
  const quantity = document.getElementById('ing-qty').value.trim();
  const unit = document.getElementById('ing-unit').value.trim();
  document.getElementById('ing-error').style.display = 'none';

  if (!name || !quantity || !unit) {
    const el = document.getElementById('ing-error');
    el.textContent = t('err_fill_fields');
    el.style.display = '';
    return;
  }

  const res = await apiFetch(`/recipes/${recipeId}/ingredients`, {
    method: 'POST',
    body: JSON.stringify({ name, quantity, unit })
  });

  if (!res || !res.ok) {
    const el = document.getElementById('ing-error');
    el.textContent = res?.data?.error || t('err_add_ing');
    el.style.display = '';
    return;
  }

  closeIngModal();
  const ingRes = await apiFetch(`/recipes/${recipeId}/ingredients`);
  if (ingRes && ingRes.ok) {
    currentIngredients = ingRes.data;
    document.getElementById('ingredients-section').innerHTML = renderIngredientsTable(ingRes.data);
    document.getElementById('ing-count').textContent =
      ingRes.data.length === 1 ? t('ing_1') : tf('ing_n', { n: ingRes.data.length });
    loadCost();
  }
}

async function deleteIngredient(ingId) {
  if (!confirm(t('confirm_del_ing'))) return;
  await apiFetch(`/recipes/${recipeId}/ingredients/${ingId}`, { method: 'DELETE' });
  const ingRes = await apiFetch(`/recipes/${recipeId}/ingredients`);
  if (ingRes && ingRes.ok) {
    currentIngredients = ingRes.data;
    document.getElementById('ingredients-section').innerHTML = renderIngredientsTable(ingRes.data);
    document.getElementById('ing-count').textContent =
      ingRes.data.length === 1 ? t('ing_1') : tf('ing_n', { n: ingRes.data.length });
    loadCost();
  }
}

function logout() { removeToken(); window.location.href = 'index.html'; }

// Live preview listeners for price modal
document.addEventListener('DOMContentLoaded', () => {
  ['pm-bought-qty', 'pm-bought-price'].forEach(id => {
    document.getElementById(id).addEventListener('input', updatePricePreview);
  });
  document.getElementById('pm-bought-unit').addEventListener('change', updatePricePreview);
});

document.addEventListener('langchange', () => {
  if (currentRecipe) {
    renderPage(currentRecipe, currentIngredients, currentSteps);
    loadCost();
  }
});

loadPage();
