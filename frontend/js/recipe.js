requireAuth();

const params = new URLSearchParams(window.location.search);
const recipeId = params.get('id');
if (!recipeId) window.location.href = 'dashboard.html';

let currentRecipe = null;
let currentIngredients = [];
let currentSteps = [];
let currentCostData = null;
let localSections = [];
let currentPriceIngId = null;
let allStores = [];
let allBrands = [];
let allPrices = [];
let priceModalMode = 'qty';
let currentMultiplier = 1;

// Unit sets for €/kg calculation (mirrors backend)
const _G_UNITS  = new Set(['g', 'gr', 'gram', 'grams', 'gramo', 'gramos', 'ml', 'milliliter', 'milliliters']);
const _KG_UNITS = new Set(['kg', 'kilogram', 'kilograms', 'kilo', 'kilos', 'l', 'liter', 'liters', 'litro', 'litros']);
const _SPOON_ML = {
  'cdta': 5, 'cdtas': 5, 'tsp': 5, 'teaspoon': 5, 'teaspoons': 5,
  'cucharadita': 5, 'cucharaditas': 5,
  'cda': 15, 'cdas': 15, 'tbsp': 15, 'tablespoon': 15, 'tablespoons': 15,
  'cucharada': 15, 'cucharadas': 15,
};

function calcPricePerKg(qty, unit, pricePaid) {
  if (!qty || !pricePaid) return null;
  const u = unit.toLowerCase().trim();
  if (_KG_UNITS.has(u)) return pricePaid / qty;
  if (_G_UNITS.has(u))  return (pricePaid / qty) * 1000;
  const spoonMl = _SPOON_ML[u];
  if (spoonMl) return (pricePaid / (qty * spoonMl)) * 1000;
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
    const _avSrc = resolveImgUrl(avatarUrl);
    el.innerHTML = `<img src="${_avSrc}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
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
  const files = Array.from(event.target.files);
  event.target.value = '';
  if (!files.length) return;
  for (const file of files) {
    const fd = new FormData();
    fd.append('file', file);
    const res = await apiUpload(`/recipes/${recipeId}/image`, fd);
    if (res && res.ok) {
      currentRecipe.image_url = res.data.image_url;
      currentRecipe.images = res.data.images || [res.data.image_url];
    }
  }
  renderRecipeHeader(currentRecipe);
}

async function setCoverPhoto(imageUrl) {
  if (imageUrl === currentRecipe.image_url) return;
  const res = await apiFetch(`/recipes/${recipeId}`, {
    method: 'PUT',
    body: JSON.stringify({ image_url: imageUrl })
  });
  if (res && res.ok) {
    currentRecipe.image_url = imageUrl;
    renderRecipeHeader(currentRecipe);
  }
}

async function deleteRecipePhoto(imageUrl) {
  showConfirmModal(t('btn_delete'), t('confirm_delete_photo'), async () => {
    const res = await apiFetch(`/recipes/${recipeId}/image`, {
      method: 'DELETE',
      body: JSON.stringify({ image_url: imageUrl })
    });
    if (res && res.ok) {
      currentRecipe.image_url = res.data.image_url || null;
      currentRecipe.images = res.data.images || [];
      renderRecipeHeader(currentRecipe);
    }
  });
}

// ── Load page ─────────────────────────────────────────────────────────────────
async function loadPage() {
  const [fullRes, storesRes, brandsRes, pricesRes] = await Promise.all([
    apiFetch(`/recipes/${recipeId}/full`),
    apiFetch('/stores'),
    apiFetch('/brands'),
    apiFetch('/prices')
  ]);

  if (!fullRes || !fullRes.ok) {
    window.location.href = 'dashboard.html';
    return;
  }

  currentRecipe = fullRes.data.recipe;
  currentIngredients = fullRes.data.ingredients || [];
  currentSteps = fullRes.data.steps || [];
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

function _normIng(s) {
  return (s || '').toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function buildBrandOptions(selectedId, ing) {
  const ingName = typeof ing === 'string' ? ing : ing.name;
  const autoOpt = `<option value="">${t('no_brand')}</option>`;

  // All language variants of this ingredient name to match against brand.ingredient_name
  const needles = new Set(
    [ingName, ing.name_en, ing.name_es, ing.name_fr]
      .filter(Boolean)
      .map(_normIng)
  );

  // Brands that have at least one ingredient-specific entry (same logic as prices.js)
  const brandsWithIng = new Set(
    allBrands.filter(b => b.ingredient_name).map(b => b.name.toLowerCase())
  );

  const brands = allBrands.filter(b => {
    if (!b.ingredient_name) {
      // Generic entry: only show if this brand has NO ingredient-specific entries at all
      return !brandsWithIng.has(b.name.toLowerCase());
    }
    const bn = _normIng(b.ingredient_name);
    return needles.has(bn) ||
      [...needles].some(n => (n + ' ').startsWith(bn + ' ') || (bn + ' ').startsWith(n + ' '));
  });

  const seen = new Map();
  for (const b of brands) {
    if (!seen.has(b.name) || b.id === selectedId) seen.set(b.name, b);
  }
  const brandOpts = [...seen.values()].map(b =>
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

  const images = recipe.images || (recipe.image_url ? [recipe.image_url] : []);

  const galleryHtml = images.length > 0
    ? `<div class="photo-gallery">
        ${images.map(url => `
          <div class="photo-thumb${url === recipe.image_url ? ' is-cover' : ''}" onclick="setCoverPhoto('${url.replace(/'/g, "\\'")}')">
            <img src="${resolveImgUrl(url)}" alt="">
            <button class="photo-thumb-delete" onclick="event.stopPropagation();deleteRecipePhoto('${url.replace(/'/g, "\\'")}')">✕</button>
          </div>`).join('')}
        <div class="photo-thumb-add" onclick="document.getElementById('recipe-img-input').click()" title="${t('add_photo')}">+</div>
      </div>`
    : '';

  const photoHtml = recipe.image_url
    ? `<div>
        <div class="recipe-header-photo" onclick="document.getElementById('recipe-img-input').click()">
          <img src="${resolveImgUrl(recipe.image_url)}" alt="${localizedField(recipe, 'title').replace(/"/g, '&quot;')}">
          <div class="recipe-header-photo-overlay">${t('change_photo')}</div>
        </div>
        ${galleryHtml}
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
        <div id="translate-status" style="margin-top:0.75rem;">${recipe.translation_status === 'done' ? `<span class="translate-done-badge">🌐 ${t('translate_done_short')}</span>` : ''}</div>
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
          <div class="multiplier-ctrl">
            <button class="mult-btn active" data-mult="1" onclick="setMultiplier(1)">×1</button>
            <button class="mult-btn" data-mult="2" onclick="setMultiplier(2)">×2</button>
            <button class="mult-btn" data-mult="3" onclick="setMultiplier(3)">×3</button>
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

  ['edit-modal', 'price-modal', 'step-add-modal', 'step-edit-modal'].forEach(id => {
    document.getElementById(id).addEventListener('click', e => {
      if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
    });
  });

  initSortable();
  makeDraggable('ing-modal');
}

// ── Section helpers ───────────────────────────────────────────────────────────
function getSections(ingredients) {
  const seen = new Set();
  const order = [];
  ingredients.forEach(i => {
    const s = i.section || '';
    if (!seen.has(s)) { seen.add(s); order.push(s); }
  });
  localSections.forEach(s => {
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

  const sectionMeta = (currentRecipe && currentRecipe.section_meta) || {};

  const tbodies = sections.map(sec => {
    const secAttr = sec.replace(/"/g, '&quot;');
    const group = ingredients.filter(i => (i.section || '') === sec);
    const color = (sectionMeta[sec] && sectionMeta[sec].color) || '';
    const cellStyle = color ? ` style="background:${color}4D; border-left:4px solid ${color}; padding-left:calc(1.2rem - 4px);"` : '';
    const swatchStyle = color ? ` style="background:${color}; border-color:transparent;"` : '';
    const colorBtn = sec
      ? `<button class="btn-section-color" title="Color de sección" onclick="openSectionColorPicker('${sec.replace(/'/g, "\\'")}', this)"${swatchStyle}></button>`
      : '';
    const headerRow = `
      <tr class="section-header-row">
        <td colspan="7"${cellStyle}>
          <div class="section-header-cell">
            <span class="section-drag-handle" title="${t('section_drag')}">⠿</span>
            <span class="section-title" onclick="renameSection('${sec.replace(/'/g, "\\'")}', this)">${tSection(sec) || t('section_no_section')}</span>
            ${colorBtn}
            <button class="btn-add-section-ing" onclick="promptAddSection()" title="${t('section_add')}">+ ${t('section_add')}</button>
          </div>
        </td>
      </tr>`;

    const rows = group.length > 0
      ? group.map(i => renderIngRow(i, sections)).join('')
      : `<tr class="section-empty-row"><td colspan="7" style="padding:0.75rem 1.2rem;color:var(--text-muted);font-size:0.85rem;font-style:italic;">${t('section_empty_hint')}</td></tr>`;

    return `<tbody class="section-body" data-section="${secAttr}">${headerRow}${rows}</tbody>`;
  }).join('');

  const addSectionRow = `
    <tbody>
      <tr class="section-add-row">
        <td colspan="7">
          <button class="btn-add-section" onclick="addSection()">+ ${t('section_new')}</button>
        </td>
      </tr>
    </tbody>`;

  return `
    <div class="ing-table-wrap">
      <table class="ing-table ing-table-wide" id="ing-table">
        ${thead}
        ${tbodies}
        ${addSectionRow}
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
           aria-label="Tienda para ${i.name}"
           onchange="changeIngredientStore('${i.id}', this.value)">
         ${buildStoreOptions(i.preferred_store_id || null)}
       </select>`
    : `<span style="color:var(--text-muted);font-size:0.8rem;">—</span>`;

  const brandSelectCell = allBrands.length > 0
    ? `<td class="col-brand"><select class="store-select-inline" data-ing-id="${i.id}" data-sel="brand"
           aria-label="Marca para ${i.name}"
           onchange="changeIngredientBrand('${i.id}', this.value)">
         ${buildBrandOptions(i.preferred_brand_id || null, i)}
       </select></td>`
    : '';

  // Section picker options
  const sectionOpts = sections.map(s =>
    `<option value="${s.replace(/"/g, '&quot;')}"${s === (i.section || '') ? ' selected' : ''}>${tSection(s) || t('section_no_section')}</option>`
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
      <td class="ing-name price-clickable" onclick="openEditIngModal('${i.id}')">${ingDisplayName(i)}</td>
      <td class="col-qty price-clickable" onclick="openEditIngModal('${i.id}'); setTimeout(()=>{const f=document.getElementById('ing-edit-qty');if(f){f.select();}},150)">${_fmtMult(i.quantity)} ${tUnit(i.unit)}</td>
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

function moveToSection(ingId, value) {
  if (value === '__new__') {
    showPrompt(t('section_new_name_prompt'), '', async (sectionName) => {
      const res = await apiFetch(`/recipes/${recipeId}/ingredients/${ingId}`, {
        method: 'PUT',
        body: JSON.stringify({ section: sectionName })
      });
      if (!res || !res.ok) return;
      const ing = currentIngredients.find(i => i.id === ingId);
      if (ing) ing.section = sectionName;
      setIngredients(currentIngredients);
      loadCost();
    });
    return;
  }
  apiFetch(`/recipes/${recipeId}/ingredients/${ingId}`, {
    method: 'PUT',
    body: JSON.stringify({ section: value })
  }).then(res => {
    if (!res || !res.ok) return;
    const ing = currentIngredients.find(i => i.id === ingId);
    if (ing) ing.section = value;
    setIngredients(currentIngredients);
  });
}

function addSection() {
  showPrompt(t('section_new_name_prompt'), '', (name) => {
    if (!localSections.includes(name) && !currentIngredients.some(i => (i.section || '') === name)) {
      localSections.push(name);
    }
    setIngredients(currentIngredients);
  });
}

function renameSection(oldName) {
  showPrompt(t('section_rename_prompt'), oldName, async (trimmed) => {
    if (trimmed === oldName) return;
    const targets = currentIngredients.filter(i => (i.section || '') === oldName);
    await Promise.all(targets.map(i =>
      apiFetch(`/recipes/${recipeId}/ingredients/${i.id}`, {
        method: 'PUT',
        body: JSON.stringify({ section: trimmed })
      })
    ));
    targets.forEach(i => i.section = trimmed);
    setIngredients(currentIngredients);
  });
}

function promptAddSection() {
  showAlert(t('section_move_hint'));
}

function openSectionColorPicker(sectionName, btn) {
  const input = document.createElement('input');
  input.type = 'color';
  const currentColor = (currentRecipe.section_meta && currentRecipe.section_meta[sectionName] && currentRecipe.section_meta[sectionName].color) || '#f39c12';
  input.value = currentColor;
  input.style.position = 'fixed';
  input.style.opacity = '0';
  input.style.pointerEvents = 'none';
  document.body.appendChild(input);
  input.click();
  input.addEventListener('change', async () => {
    const color = input.value;
    document.body.removeChild(input);
    const res = await apiFetch(`/recipes/${recipeId}/sections/${encodeURIComponent(sectionName)}/color`, {
      method: 'PATCH',
      body: JSON.stringify({ color })
    });
    if (res && res.ok) {
      if (!currentRecipe.section_meta) currentRecipe.section_meta = {};
      if (!currentRecipe.section_meta[sectionName]) currentRecipe.section_meta[sectionName] = {};
      currentRecipe.section_meta[sectionName].color = color;
      setIngredients(currentIngredients);
    }
  });
  input.addEventListener('cancel', () => {
    if (document.body.contains(input)) document.body.removeChild(input);
  });
}

function parseBold(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
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
        <p class="step-desc">${parseBold(localizedField(s, 'description') || '')}</p>
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
  const btn = document.querySelector('#step-add-modal .btn-orange');
  btn.disabled = true;
  try {
    const orderNum = isNaN(numVal) || numVal < 1 ? currentSteps.length + 1 : numVal;
    const res = await apiFetch(`/recipes/${recipeId}/steps`, {
      method: 'POST', body: JSON.stringify({ description: desc, order_num: orderNum })
    });
    if (!res || !res.ok) { err.textContent = t('err_save'); err.style.display = ''; return; }
    currentSteps = [...currentSteps, res.data];
    currentSteps.sort((a, b) => a.order_num - b.order_num);
    closeAddStepModal();
    document.getElementById('steps-section').innerHTML = renderSteps(currentSteps);
  } finally {
    btn.disabled = false;
  }
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
  const btn = document.querySelector('#step-edit-modal .btn-orange');
  btn.disabled = true;
  try {
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
  } finally {
    btn.disabled = false;
  }
}

function deleteStep(stepId) {
  showConfirmDelete(
    t('confirm_del_step'),
    t('confirm_del_step_desc'),
    async () => {
      const res = await apiFetch(`/recipes/${recipeId}/steps/${stepId}`, { method: 'DELETE' });
      if (res && !res.ok) return;  // null = 204 success; only bail on explicit error
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
      const unitMismatch = !!i.unit_warning;

      // €/kg column (clickable)
      const pkgCell = document.querySelector(`[data-ing-id="${i.ing_id}"][data-col="pkg"]`);
      if (pkgCell) {
        const pkg = i.price_per_kg != null ? `€${i.price_per_kg.toFixed(2)}` : '—';
        const warn = unitMismatch ? ` <span title="${t('warn_unit_mismatch')}" style="cursor:help;">⚠️</span>` : '';
        pkgCell.innerHTML = `<span class="price-badge price-badge-${src}">${srcLabel}</span> <span class="price-val-${src}">${pkg}</span>${warn}`;
      }

      // Total column (display only)
      const totalCell = document.querySelector(`[data-ing-id="${i.ing_id}"][data-col="total"]`);
      if (totalCell) {
        totalCell.textContent = unitMismatch ? '?' : `€${i.estimated_price.toFixed(2)}`;
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
  if (res && !res.ok) return;  // null = 204 success; only bail on explicit error
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
  fillCategorySelect('e-category', normalizeCatToCanonical(currentRecipe.category));

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
      category: document.getElementById('e-category').value || null
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
  currentRecipe.category = document.getElementById('e-category').value || null;
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

// ── Auto-scroll while dragging ────────────────────────────────────────────────
let _dragClientY = -1;
let _autoScrollRaf = null;

function _trackDragY(e) { _dragClientY = e.clientY; }

function _pageScrollLoop() {
  if (_dragClientY >= 0) {
    const THRESHOLD = 100;
    const MAX_SPEED = 18;
    const y = _dragClientY;
    const h = window.innerHeight;
    if (y < THRESHOLD) {
      window.scrollBy(0, -MAX_SPEED * (1 - y / THRESHOLD));
    } else if (y > h - THRESHOLD) {
      window.scrollBy(0, MAX_SPEED * (1 - (h - y) / THRESHOLD));
    }
  }
  _autoScrollRaf = requestAnimationFrame(_pageScrollLoop);
}

function startPageAutoScroll(sortableEvt) {
  _dragClientY = sortableEvt.originalEvent?.clientY ?? -1;
  window.addEventListener('pointermove', _trackDragY);
  _autoScrollRaf = requestAnimationFrame(_pageScrollLoop);
}

function stopPageAutoScroll() {
  window.removeEventListener('pointermove', _trackDragY);
  if (_autoScrollRaf) { cancelAnimationFrame(_autoScrollRaf); _autoScrollRaf = null; }
  _dragClientY = -1;
}

// ── Sortable drag & drop ──────────────────────────────────────────────────────
function initSortable() {
  const table = document.getElementById('ing-table');
  if (table) {
    new Sortable(table, {
      animation: 150,
      handle: '.section-drag-handle',
      draggable: '.section-body',
      ghostClass: 'section-body-ghost',
      chosenClass: 'section-body-chosen',
      onStart: startPageAutoScroll,
      onEnd(e) { stopPageAutoScroll(); saveSectionOrder(e); },
    });
  }

  document.querySelectorAll('#ing-table .section-body').forEach(tbody => {
    new Sortable(tbody, {
      group: 'ingredients',
      animation: 150,
      handle: '.move-icon',
      filter: '.section-header-row, .section-empty-row',
      draggable: '.ing-row',
      ghostClass: 'ing-row-ghost',
      chosenClass: 'ing-row-chosen',
      emptyInsertThreshold: 48,
      onStart: startPageAutoScroll,
      onEnd(e) { stopPageAutoScroll(); saveIngredientOrder(e); },
    });
  });
}

async function saveSectionOrder() {
  const updates = [];
  let order = 0;
  document.querySelectorAll('#ing-table .section-body').forEach(tbody => {
    const section = tbody.dataset.section || '';
    tbody.querySelectorAll('.ing-row').forEach(row => {
      updates.push({ id: row.dataset.ingId, section, order_num: order++ });
    });
  });
  if (updates.length === 0) return;
  await apiFetch(`/recipes/${recipeId}/ingredients/reorder`, {
    method: 'POST',
    body: JSON.stringify({ updates })
  });
}

async function saveIngredientOrder() {
  const updates = [];
  document.querySelectorAll('#ing-table .section-body').forEach(tbody => {
    const section = tbody.dataset.section || '';
    tbody.querySelectorAll('.ing-row').forEach((row, idx) => {
      const id = row.dataset.ingId;
      updates.push({ id, section, order_num: idx });
      const ing = currentIngredients.find(i => i.id === id);
      if (ing) { ing.section = section; ing.order_num = idx; }
    });
  });
  await apiFetch(`/recipes/${recipeId}/ingredients/reorder`, {
    method: 'POST',
    body: JSON.stringify({ updates })
  });
  loadCost();
}

function setIngredients(ings) {
  currentIngredients = ings;
  document.getElementById('ingredients-section').innerHTML = renderIngredientsTable(ings);
  initSortable();
  loadCost();
}

function _fmtMult(qty) {
  if (currentMultiplier === 1) return qty;
  const n = parseFloat(qty);
  if (isNaN(n)) return qty;
  const r = n * currentMultiplier;
  return Number.isInteger(r) ? r : parseFloat(r.toFixed(2));
}

function setMultiplier(n) {
  currentMultiplier = n;
  document.querySelectorAll('.mult-btn').forEach(b =>
    b.classList.toggle('active', parseInt(b.dataset.mult) === n)
  );
  document.getElementById('ingredients-section').innerHTML = renderIngredientsTable(currentIngredients);
  initSortable();
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
  status.innerHTML = `<span class="translate-done-badge">🌐 ${t('translate_done_short')}</span>`;

  const [ingRes, stepRes] = await Promise.all([
    apiFetch(`/recipes/${recipeId}/ingredients`),
    apiFetch(`/recipes/${recipeId}/steps`)
  ]);
  if (ingRes?.ok) setIngredients(ingRes.data);
  if (stepRes?.ok) {
    currentSteps = stepRes.data;
    document.getElementById('steps-section').innerHTML = renderSteps(currentSteps);
  }
}

// ── Ingredients ───────────────────────────────────────────────────────────────
function openIngModal() {
  const sections = getSections(currentIngredients).filter(s => s !== '');
  const select = document.getElementById('ing-section');
  select.innerHTML = `<option value="">${t('section_no_section')}</option>` +
    sections.map(s => `<option value="${s.replace(/"/g, '&quot;')}">${s}</option>`).join('');
  document.getElementById('ing-section-group').style.display = sections.length > 0 ? '' : 'none';
  document.getElementById('ing-modal').classList.add('open');
  setTimeout(() => document.getElementById('ing-name').focus(), 50);
}

function closeIngModal() {
  const overlay = document.getElementById('ing-modal');
  overlay.classList.remove('open');
  overlay.dispatchEvent(new Event('modal-reset'));
  document.getElementById('ing-error').style.display = 'none';
  ['ing-name', 'ing-qty', 'ing-unit'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('ing-section').value = '';
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

  const btn = document.querySelector('#ing-modal .btn-orange');
  btn.disabled = true;
  try {
    const section = document.getElementById('ing-section')?.value || '';
    const res = await apiFetch(`/recipes/${recipeId}/ingredients`, {
      method: 'POST',
      body: JSON.stringify({ name, quantity, unit, section })
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
      setIngredients(ingRes.data);
      document.getElementById('ing-count').textContent =
        ingRes.data.length === 1 ? t('ing_1') : tf('ing_n', { n: ingRes.data.length });
    }
  } finally {
    btn.disabled = false;
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

  const btn = document.querySelector('#ing-edit-modal .btn-orange');
  btn.disabled = true;
  try {
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
    if (ingRes && ingRes.ok) setIngredients(ingRes.data);
  } finally {
    btn.disabled = false;
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
    setIngredients(ingRes.data);
    document.getElementById('ing-count').textContent =
      ingRes.data.length === 1 ? t('ing_1') : tf('ing_n', { n: ingRes.data.length });
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

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const modals = [
    { id: 'edit-modal',          close: closeEditModal },
    { id: 'price-modal',         close: closePriceModal },
    { id: 'step-add-modal',      close: closeAddStepModal },
    { id: 'step-edit-modal',     close: closeEditStepModal },
    { id: 'ing-modal',           close: closeIngModal },
    { id: 'ing-edit-modal',      close: closeEditIngModal },
    { id: 'confirm-delete-modal',close: closeConfirmDelete },
  ];
  modals.forEach(({ id, close }) => {
    const el = document.getElementById(id);
    if (el && el.classList.contains('open')) close();
  });
});

