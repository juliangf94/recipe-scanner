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
let allPrices = [];
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
  const [recipeRes, ingRes, stepsRes, storesRes, brandsRes, pricesRes] = await Promise.all([
    apiFetch(`/recipes/${recipeId}`),
    apiFetch(`/recipes/${recipeId}/ingredients`),
    apiFetch(`/recipes/${recipeId}/steps`),
    apiFetch('/stores'),
    apiFetch('/brands'),
    apiFetch('/prices')
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
  allPrices = pricesRes && pricesRes.ok ? pricesRes.data : [];

  document.title = `RecipeScanner — ${localizedField(currentRecipe, 'title')}`;
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

function buildBrandOptions(selectedId, ingName) {
  const autoOpt = `<option value="">${t('no_brand')}</option>`;
  let brands = allBrands;

  if (ingName && allPrices.length > 0) {
    const needle = ingName.toLowerCase().trim();
    const relatedIds = new Set(
      allPrices
        .filter(p => p.ingredient_name.toLowerCase().trim() === needle && p.brand_id)
        .map(p => p.brand_id)
    );
    if (relatedIds.size > 0) {
      brands = allBrands.filter(b => relatedIds.has(b.id));
    }
  }

  const brandOpts = brands.map(b =>
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
        <img src="http://localhost:5000${recipe.image_url}" alt="${localizedField(recipe, 'title')}">
        <div class="recipe-header-photo-overlay">${t('change_photo')}</div>
      </div>`
    : `<div class="recipe-header-photo recipe-header-photo-empty" onclick="document.getElementById('recipe-img-input').click()">
        <span style="font-size:2.2rem;">📷</span>
        <span style="font-size:0.88rem; color:var(--text-muted);">${t('add_photo')}</span>
      </div>`;

  return `<div class="recipe-header-grid">
      <div>
        <a href="dashboard.html" class="back-link">← ${t('nav_recipes')}</a>
        <h1>${localizedField(recipe, 'title')}</h1>
        ${badges ? `<div class="badge-row">${badges}</div>` : ''}
        ${meta.length ? `<div class="detail-meta">${meta.map(m => `<span>${m}</span>`).join('')}</div>` : ''}
        ${recipe.description ? `<p class="text-muted text-sm" style="margin-top:0.5rem;">${localizedField(recipe, 'description')}</p>` : ''}
        <div class="detail-actions" style="margin-top:1.2rem;">
          <button class="btn btn-edit btn-sm" onclick="openEditModal()">${t('btn_edit')}</button>
          <button class="btn btn-danger btn-sm" onclick="deleteRecipe()">${t('btn_delete')}</button>
          ${recipe.translation_status !== 'done'
            ? `<button class="btn btn-outline btn-sm" id="translate-btn" onclick="translateRecipe()">${t('btn_translate')}</button>`
            : ''}
        </div>
        <div id="translate-status" style="display:none;font-size:0.85rem;margin-top:0.5rem;"></div>
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
          <button class="btn btn-outline btn-sm" onclick="openAddStepModal()">${t('btn_add_step')}</button>
        </div>
        <div id="steps-section">
          ${renderSteps(steps)}
        </div>
      </div>
    </div>`;

  ['edit-modal', 'ing-modal', 'price-modal', 'step-add-modal', 'step-edit-modal'].forEach(id => {
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
      <th class="col-del"></th>
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
    <div class="ing-table-wrap">
      <table class="ing-table ing-table-wide">
        ${thead}
        <tbody>${blocks}${addSectionRow}</tbody>
      </table>
    </div>`;
}

function ingDisplayName(ing) {
  const lang = getLang();
  const entry = ING_MAP[(ing.name || '').toLowerCase().trim()];
  if (entry && entry[lang]) return entry[lang];
  return localizedField(ing, 'name');
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
         ${buildBrandOptions(i.preferred_brand_id || null, i.name)}
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
      <td class="ing-name">${ingDisplayName(i)}</td>
      <td class="col-qty">${i.quantity} ${tUnit(i.unit)}</td>
      <td class="col-store">${storeSelect}</td>
      ${brandSelectCell}
      <td class="col-price-kg price-clickable" data-ing-id="${i.id}" data-col="pkg"
          onclick="openPriceModal('${i.id}', '${safeName}')">—</td>
      <td class="col-total" data-ing-id="${i.id}" data-col="total">—</td>
      <td class="col-del">
        <div class="col-del-inner">
          <button class="edit-btn" onclick="openEditIngModal('${i.id}')">✎</button>
          <button class="del-btn" onclick="deleteIngredient('${i.id}')">✕</button>
        </div>
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
    <li class="step-item" draggable="true"
        ondragstart="stepDragStart(event,'${s.id}')"
        ondragover="stepDragOver(event)"
        ondragleave="stepDragLeave(event)"
        ondrop="stepDrop(event,'${s.id}')"
        ondragend="stepDragEnd(event)">
      <div class="step-drag-handle" title="${t('section_move')}">⠿</div>
      <div class="step-num">${i + 1}</div>
      <div class="step-content">
        <p class="step-desc">${localizedField(s, 'description') || s}</p>
        ${s.duration_min ? `<span class="step-duration">⏱ ${s.duration_min} min</span>` : ''}
      </div>
      <div class="step-actions">
        <button class="edit-btn" onclick="openEditStepModal('${s.id}')">✎</button>
        <button class="del-btn" onclick="deleteStep('${s.id}')">✕</button>
      </div>
    </li>`).join('');

  return `<ul class="steps-list">${items}</ul>`;
}

// ── Step drag-and-drop ─────────────────────────────────────────────────────────
let _dragSrcStepId = null;

function stepDragStart(e, stepId) {
  _dragSrcStepId = stepId;
  e.dataTransfer.effectAllowed = 'move';
  e.currentTarget.classList.add('dragging');
}

function stepDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('drag-over');
}

function stepDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

function stepDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.step-item').forEach(el => el.classList.remove('drag-over'));
}

async function stepDrop(e, targetStepId) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if (!_dragSrcStepId || _dragSrcStepId === targetStepId) return;

  const srcIdx = currentSteps.findIndex(s => s.id === _dragSrcStepId);
  const tgtIdx = currentSteps.findIndex(s => s.id === targetStepId);
  if (srcIdx === -1 || tgtIdx === -1) return;

  const [moved] = currentSteps.splice(srcIdx, 1);
  currentSteps.splice(tgtIdx, 0, moved);
  currentSteps.forEach((s, i) => { s.order_num = i + 1; });

  document.getElementById('steps-section').innerHTML = renderSteps(currentSteps);

  await Promise.all(currentSteps.map(s =>
    apiFetch(`/recipes/${recipeId}/steps/${s.id}`, {
      method: 'PUT',
      body: JSON.stringify({ order_num: s.order_num })
    })
  ));
  _dragSrcStepId = null;
}

// ── Step CRUD ──────────────────────────────────────────────────────────────────

function openAddStepModal() {
  document.getElementById('step-add-num').value = currentSteps.length + 1;
  document.getElementById('step-add-desc').value = '';
  document.getElementById('step-add-error').style.display = 'none';
  document.getElementById('step-add-modal').classList.add('open');
  setTimeout(() => document.getElementById('step-add-desc').focus(), 50);
}
function closeAddStepModal() {
  document.getElementById('step-add-modal').classList.remove('open');
}
async function saveNewStep() {
  const desc = document.getElementById('step-add-desc').value.trim();
  const numVal = parseInt(document.getElementById('step-add-num').value, 10);
  const err = document.getElementById('step-add-error');
  if (!desc) { err.textContent = t('err_step_empty'); err.style.display = ''; return; }
  err.style.display = 'none';
  const orderNum = isNaN(numVal) || numVal < 1 ? currentSteps.length + 1 : numVal;
  const res = await apiFetch(`/recipes/${recipeId}/steps`, {
    method: 'POST', body: JSON.stringify({ description: desc, order_num: orderNum })
  });
  if (!res || !res.ok) { err.textContent = t('err_save'); err.style.display = ''; return; }
  currentSteps = [...currentSteps, res.data];
  currentSteps.sort((a, b) => a.order_num - b.order_num);
  closeAddStepModal();
  document.getElementById('steps-section').innerHTML = renderSteps(currentSteps);
}

function openEditStepModal(stepId) {
  const step = currentSteps.find(s => s.id === stepId);
  if (!step) return;
  document.getElementById('step-edit-id').value = stepId;
  document.getElementById('step-edit-num').value = step.order_num;
  document.getElementById('step-edit-desc').value = step.description;
  document.getElementById('step-edit-error').style.display = 'none';
  document.getElementById('step-edit-modal').classList.add('open');
  setTimeout(() => document.getElementById('step-edit-desc').focus(), 50);
}
function closeEditStepModal() {
  document.getElementById('step-edit-modal').classList.remove('open');
}
async function saveEditStep() {
  const stepId = document.getElementById('step-edit-id').value;
  const desc = document.getElementById('step-edit-desc').value.trim();
  const numVal = parseInt(document.getElementById('step-edit-num').value, 10);
  const err = document.getElementById('step-edit-error');
  if (!desc) { err.textContent = t('err_step_empty'); err.style.display = ''; return; }
  err.style.display = 'none';
  const body = { description: desc };
  if (!isNaN(numVal) && numVal >= 1) body.order_num = numVal;
  const res = await apiFetch(`/recipes/${recipeId}/steps/${stepId}`, {
    method: 'PUT', body: JSON.stringify(body)
  });
  if (!res || !res.ok) { err.textContent = t('err_save'); err.style.display = ''; return; }
  currentSteps = currentSteps.map(s => s.id === stepId ? res.data : s);
  currentSteps.sort((a, b) => a.order_num - b.order_num);
  closeEditStepModal();
  document.getElementById('steps-section').innerHTML = renderSteps(currentSteps);
}

function deleteStep(stepId) {
  showConfirmDelete(
    t('confirm_del_step'),
    t('confirm_del_step_desc'),
    async () => {
      const res = await apiFetch(`/recipes/${recipeId}/steps/${stepId}`, { method: 'DELETE' });
      if (!res || !res.ok) return;
      currentSteps = currentSteps.filter(s => s.id !== stepId);
      document.getElementById('steps-section').innerHTML = renderSteps(currentSteps);
    }
  );
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
  const lang = getLang();
  const localTitle = localizedField(currentRecipe, 'title');
  const localDesc  = localizedField(currentRecipe, 'description');

  document.getElementById('e-title').value    = localTitle;
  document.getElementById('e-desc').value     = localDesc;
  document.getElementById('e-servings').value = currentRecipe.servings || 0;
  document.getElementById('e-prep').value     = currentRecipe.prep_time_min || 0;
  document.getElementById('e-category').value = currentRecipe.category || '';

  // Show which language is being edited
  document.getElementById('e-lang-badge').textContent = lang.toUpperCase();

  // Show original title if a different language is active
  const origEl = document.getElementById('e-title-original');
  if (localTitle !== currentRecipe.title) {
    origEl.textContent = `Original: ${currentRecipe.title}`;
    origEl.style.display = '';
  } else {
    origEl.style.display = 'none';
  }

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

  const lang = getLang();
  const description = document.getElementById('e-desc').value.trim();
  const res = await apiFetch(`/recipes/${recipeId}`, {
    method: 'PUT',
    body: JSON.stringify({
      [`title_${lang}`]: title,
      [`description_${lang}`]: description,
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

function deleteRecipe() {
  showConfirmDelete(
    tf('confirm_del_recipe', { title: currentRecipe.title }),
    t('confirm_del_recipe_desc'),
    async () => {
      await apiFetch(`/recipes/${recipeId}`, { method: 'DELETE' });
      window.location.href = 'dashboard.html';
    }
  );
}

// ── Translate ────────────────────────────────────────────────────────────────
async function translateRecipe() {
  const btn = document.getElementById('translate-btn');
  const status = document.getElementById('translate-status');
  if (!btn) return;
  btn.disabled = true;
  btn.textContent = t('btn_translating');
  status.style.display = 'none';

  let res;
  try {
    res = await apiFetch(`/recipes/${recipeId}/translate`, { method: 'POST' });
  } catch (_) {
    res = null;
  }

  if (!res || !res.ok) {
    btn.disabled = false;
    btn.textContent = t('btn_translate');
    status.textContent = t('translate_fail');
    status.style.display = '';
    return;
  }

  currentRecipe.translation_status = 'done';
  btn.remove();
  status.textContent = t('translate_done');
  status.style.display = '';

  const [ingRes, stepRes] = await Promise.all([
    apiFetch(`/recipes/${recipeId}/ingredients`),
    apiFetch(`/recipes/${recipeId}/steps`)
  ]);
  if (ingRes?.ok) {
    currentIngredients = ingRes.data;
    document.getElementById('ingredients-section').innerHTML = renderIngredientsTable(currentIngredients);
  }
  if (stepRes?.ok) {
    currentSteps = stepRes.data;
    document.getElementById('steps-section').innerHTML = renderSteps(currentSteps);
  }
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

function openEditIngModal(ingId) {
  const ing = currentIngredients.find(i => i.id === ingId);
  if (!ing) return;
  document.getElementById('ing-edit-id').value = ing.id;
  document.getElementById('ing-edit-name').value = ing.name;
  document.getElementById('ing-edit-qty').value = ing.quantity;
  document.getElementById('ing-edit-unit').value = ing.unit;
  document.getElementById('ing-edit-error').style.display = 'none';
  document.getElementById('ing-edit-modal').classList.add('open');
  document.getElementById('ing-edit-name').focus();
}

function closeEditIngModal() {
  document.getElementById('ing-edit-modal').classList.remove('open');
  document.getElementById('ing-edit-error').style.display = 'none';
}

async function saveEditIng() {
  const ingId = document.getElementById('ing-edit-id').value;
  const name  = document.getElementById('ing-edit-name').value.trim();
  const quantity = document.getElementById('ing-edit-qty').value.trim();
  const unit  = document.getElementById('ing-edit-unit').value.trim();
  document.getElementById('ing-edit-error').style.display = 'none';

  if (!name || !quantity || !unit) {
    const el = document.getElementById('ing-edit-error');
    el.textContent = t('err_fill_fields');
    el.style.display = '';
    return;
  }

  const res = await apiFetch(`/recipes/${recipeId}/ingredients/${ingId}`, {
    method: 'PUT',
    body: JSON.stringify({ name, quantity, unit })
  });

  if (!res || !res.ok) {
    const el = document.getElementById('ing-edit-error');
    el.textContent = res?.data?.error || t('err_save');
    el.style.display = '';
    return;
  }

  closeEditIngModal();
  const ingRes = await apiFetch(`/recipes/${recipeId}/ingredients`);
  if (ingRes && ingRes.ok) {
    currentIngredients = ingRes.data;
    document.getElementById('ingredients-section').innerHTML = renderIngredientsTable(ingRes.data);
    loadCost();
  }
}

function deleteIngredient(ingId) {
  showConfirmDelete(
    t('confirm_del_ing'),
    t('confirm_del_ing_desc'),
    async () => {
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
  );
}

function logout() { removeToken(); window.location.href = 'index.html'; }

// ── Confirm delete modal ──────────────────────────────────────────────────────
let _confirmDeleteCallback = null;

function showConfirmDelete(title, desc, callback) {
  document.getElementById('confirm-delete-title').textContent = title;
  document.getElementById('confirm-delete-desc').textContent = desc;
  document.getElementById('confirm-delete-btn').textContent = t('btn_delete');
  document.getElementById('confirm-delete-btn').onclick = () => {
    closeConfirmDelete();
    callback();
  };
  document.getElementById('confirm-delete-modal').classList.add('open');
}

function closeConfirmDelete() {
  document.getElementById('confirm-delete-modal').classList.remove('open');
}

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

document.getElementById('ing-edit-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeEditIngModal();
});

