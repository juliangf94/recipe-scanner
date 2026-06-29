requireAuth();

const user = getUser();
let allRecipes = [];
let activeCategory = 'all';
let activeSort = 'az';
// ── Sidebar user info ─────────────────────────────────────────────────────────
if (user) {
  const initials = `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase();
  document.getElementById('user-firstname').textContent = user.first_name;
  document.getElementById('user-lastname').textContent = user.last_name;
  document.getElementById('greeting').textContent = tf('greeting', { name: user.first_name });
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

// ── Category banner colors ────────────────────────────────────────────────────
function bannerClass(category) {
  if (!category) return 'banner-default';
  const canonical = (CANONICAL_CAT[category.toLowerCase().trim()] || category).toLowerCase();
  const slug = canonical.replace(/\s+/g, '-');
  return `banner-${slug}`;
}

const CAT_EMOJIS = {
  pasta: '🍝', meat: '🥩', carne: '🥩', dessert: '🍰', postre: '🍰',
  desserts: '🍰', postres: '🍰', soup: '🍲', sopa: '🍲', salad: '🥗',
  ensalada: '🥗', pizza: '🍕', chicken: '🍗', pollo: '🍗', fish: '🐟',
  pescado: '🐟', rice: '🍚', arroz: '🍚', bread: '🍞', pan: '🍞',
  cake: '🎂', tarta: '🎂', breakfast: '🥞', desayuno: '🥞',
};

function cardEmoji(category) {
  if (!category) return '🍽️';
  return CAT_EMOJIS[category.toLowerCase()] || '🍴';
}

// ── Render cards ──────────────────────────────────────────────────────────────
function recipeCard(r) {
  const emoji = cardEmoji(r.category);
  const banner = bannerClass(r.category);
  const meta = [];
  if (r.prep_time_min) meta.push(`⏱ ${r.prep_time_min} min`);
  if (r.servings) meta.push(`🍽 ${r.servings}`);

  const catLabel = tCat(r.category);
  const localTitle = localizedField(r, 'title');
  const localDesc  = localizedField(r, 'description');
  const bannerContent = r.image_url
    ? `<img src="http://localhost:5000${r.image_url}" alt="${localTitle}" style="width:100%;height:100%;object-fit:cover;">
       ${r.category ? `<span class="cat-badge" style="position:absolute;top:0.5rem;left:0.5rem;">${catLabel}</span>` : ''}`
    : `${r.category ? `<span class="cat-badge">${catLabel}</span>` : ''}
       <span style="font-size:3rem;">${emoji}</span>`;

  return `
    <a class="recipe-card" href="recipe.html?id=${r.id}">
      <div class="card-banner ${banner}" style="${r.image_url ? 'position:relative;padding:0;overflow:hidden;' : ''}">
        ${bannerContent}
      </div>
      <div class="card-body">
        <div class="card-title">${localTitle}</div>
        ${localDesc ? `<p class="text-sm text-muted mt-1">${localDesc.slice(0, 60)}${localDesc.length > 60 ? '…' : ''}</p>` : ''}
        <div class="card-meta">${meta.map(m => `<span>${m}</span>`).join('')}</div>
        <div class="card-footer">
          <span class="view-btn">${t('card_view')}</span>
        </div>
      </div>
    </a>`;
}

// ── Category filter pills ─────────────────────────────────────────────────────
// activeCategory is the translated label (lowercased), e.g. "desserts"
// This lets "Postres" and "Desserts" collapse into a single pill in any language.

function buildCategories(recipes) {
  // labelMap: translatedLabel → { rawSet, count }
  const labelMap = new Map();
  recipes.forEach(r => {
    if (!r.category) return;
    const raw = r.category.trim();
    const label = tCat(raw).toLowerCase();
    if (!labelMap.has(label)) labelMap.set(label, { rawSet: new Set(), count: 0 });
    const entry = labelMap.get(label);
    entry.rawSet.add(raw.toLowerCase());
    entry.count++;
  });

  const bar = document.getElementById('filter-bar');
  bar.innerHTML = '';

  const allBtn = document.createElement('button');
  allBtn.className = `filter-pill${activeCategory === 'all' ? ' active' : ''}`;
  allBtn.dataset.cat = 'all';
  allBtn.innerHTML = `${t('filter_all')} <span class="pill-count">${recipes.length}</span>`;
  allBtn.onclick = () => setCategory('all', allBtn);
  bar.appendChild(allBtn);

  labelMap.forEach(({ rawSet, count }, label) => {
    const btn = document.createElement('button');
    btn.className = `filter-pill${activeCategory === label ? ' active' : ''}`;
    btn.dataset.cat = label;
    const rawCat = [...rawSet][0];
    const dotClass = bannerClass(rawCat);
    const display = tCat(rawCat) || label;
    const name = display.charAt(0).toUpperCase() + display.slice(1);
    btn.innerHTML = `<span class="cat-dot ${dotClass}"></span>${name} <span class="pill-count">${count}</span>`;
    btn.onclick = () => setCategory(label, btn);
    bar.appendChild(btn);
  });
}

function setCategory(cat, btn) {
  activeCategory = cat;
  document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderRecipes();
}

function filterRecipes() {
  renderRecipes();
}

function setSort(value) {
  activeSort = value;
  renderRecipes();
}

function sortedRecipes(list) {
  return [...list].sort((a, b) => {
    const titleA = localizedField(a, 'title').toLowerCase();
    const titleB = localizedField(b, 'title').toLowerCase();
    switch (activeSort) {
      case 'az': return titleA.localeCompare(titleB);
      case 'za': return titleB.localeCompare(titleA);
      case 'prep_asc':  return (a.prep_time_min || 0) - (b.prep_time_min || 0);
      case 'prep_desc': return (b.prep_time_min || 0) - (a.prep_time_min || 0);
      case 'srv_asc':   return (a.servings || 0) - (b.servings || 0);
      case 'srv_desc':  return (b.servings || 0) - (a.servings || 0);
      default: return 0;
    }
  });
}

function renderRecipes() {
  const search = (document.getElementById('search-input').value || '').toLowerCase();
  const filtered = allRecipes.filter(r => {
    const translatedCat = tCat(r.category || '').toLowerCase();
    const matchCat = activeCategory === 'all' || translatedCat === activeCategory;
    const matchSearch = !search ||
      localizedField(r, 'title').toLowerCase().includes(search) ||
      localizedField(r, 'description').toLowerCase().includes(search) ||
      tCat(r.category || '').toLowerCase().includes(search);
    return matchCat && matchSearch;
  });

  const sorted = sortedRecipes(filtered);

  const container = document.getElementById('recipes-container');
  if (sorted.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <p>${t('no_results')}</p>
      </div>`;
    return;
  }

  container.innerHTML = `<div class="recipe-grid">${sorted.map(recipeCard).join('')}</div>`;
}

// ── Load ──────────────────────────────────────────────────────────────────────
async function loadRecipes() {
  const res = await apiFetch('/recipes/');
  const container = document.getElementById('recipes-container');

  if (!res || !res.ok) {
    container.innerHTML = `<p class="text-muted">${t('err_load')}</p>`;
    return;
  }

  allRecipes = res.data;
  const count = allRecipes.length;

  document.getElementById('recipe-count-label').textContent =
    count === 0 ? t('recipes_0') :
    count === 1 ? t('recipes_1') :
    tf('recipes_n', { n: count });

  document.getElementById('recipe-badge').textContent = count;

  buildCategories(allRecipes);

  if (count === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🍽️</div>
        <p>${t('empty_recipes')}</p>
        <a href="scan.html" class="btn btn-orange">⚡ ${t('btn_scan_recipe')}</a>
      </div>`;
    return;
  }

  renderRecipes();
}

// ── Create modal ──────────────────────────────────────────────────────────────
function openCreateModal() {
  document.getElementById('create-modal').classList.add('open');
  document.getElementById('c-title').focus();
}

function closeCreateModal() {
  document.getElementById('create-modal').classList.remove('open');
  document.getElementById('create-error').style.display = 'none';
  ['c-title', 'c-desc', 'c-category'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('c-servings').value = 0;
  document.getElementById('c-prep').value = 0;
}

async function createRecipe() {
  const title = document.getElementById('c-title').value.trim();
  document.getElementById('create-error').style.display = 'none';

  if (!title) {
    const el = document.getElementById('create-error');
    el.textContent = t('err_title_req');
    el.style.display = '';
    return;
  }

  const res = await apiFetch('/recipes/', {
    method: 'POST',
    body: JSON.stringify({
      title,
      description: document.getElementById('c-desc').value.trim(),
      servings: parseInt(document.getElementById('c-servings').value) || 0,
      prep_time_min: parseInt(document.getElementById('c-prep').value) || 0,
      category: titleCase(document.getElementById('c-category').value.trim())
    })
  });

  if (!res || !res.ok) {
    const el = document.getElementById('create-error');
    el.textContent = res?.data?.error || t('err_create');
    el.style.display = '';
    return;
  }

  closeCreateModal();
  window.location.href = `recipe.html?id=${res.data.id}`;
}

function logout() {
  removeToken();
  window.location.href = 'index.html';
}

document.getElementById('create-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeCreateModal();
});

document.addEventListener('langchange', () => {
  const u = getUser();
  if (u) {
    document.getElementById('greeting').textContent = tf('greeting', { name: u.first_name });
  }
  const count = allRecipes.length;
  document.getElementById('recipe-count-label').textContent =
    count === 0 ? t('recipes_0') :
    count === 1 ? t('recipes_1') :
    tf('recipes_n', { n: count });
  buildCategories(allRecipes);
  renderRecipes();
});

loadRecipes();
