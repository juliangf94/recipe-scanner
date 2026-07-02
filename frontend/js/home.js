requireAuth();

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

function logout() {
  clearTokens();
  window.location.href = 'index.html';
}

// ── Category banner colors (same as dashboard) ────────────────────────────────
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

function bannerClass(category) {
  if (!category) return 'banner-0';
  const hash = [...category.toLowerCase()].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0);
  return `banner-${Math.abs(hash) % 6}`;
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderHome(data) {
  const totalHasPrices = data.total_cost > 0;
  const greetingName = user ? user.first_name : '';

  const heroHtml = `
    <div class="home-hero">
      <div class="home-hero-left">
        <p class="home-greeting">${tf('home_greeting', { name: greetingName })}</p>
        <p class="home-total-label">${t('home_total_label')}</p>
        <div class="home-total-amount ${totalHasPrices ? '' : 'home-total-muted'}">
          ${totalHasPrices ? `€${data.total_cost.toFixed(2)}` : '—'}
        </div>
        ${totalHasPrices
          ? `<p class="home-total-sub">${tf('home_total_sub', { n: data.recipe_count, i: countPricedIngs(data) })}</p>`
          : `<p class="home-total-sub home-no-prices">${t('home_no_prices')}</p>`
        }
      </div>
      <div class="home-quick-actions">
        <a href="scan.html" class="home-quick-btn">${t('home_quick_scan')}</a>
        <a href="dashboard.html" class="home-quick-btn home-quick-btn-outline">${t('home_quick_recipes')}</a>
        <a href="prices.html" class="home-quick-btn home-quick-btn-outline">${t('home_quick_prices')}</a>
      </div>
    </div>`;

  const topRecipesHtml = data.recipes.length === 0
    ? `<p class="text-muted text-sm">${t('home_no_data')}</p>`
    : data.recipes.map(r => {
        const title = localizedField(r, 'title');
        const emoji = cardEmoji(r.category);
        const bannerCls = bannerClass(r.category);
        const imgHtml = r.image_url
          ? `<img src="${resolveImgUrl(r.image_url)}" alt="${title}" style="width:100%;height:100%;object-fit:cover;">`
          : `<div class="home-recipe-banner ${bannerCls}" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:2.2rem;">${emoji}</div>`;

        return `
          <a href="recipe.html?id=${r.id}" class="home-recipe-card">
            <div class="home-recipe-img">${imgHtml}</div>
            <div class="home-recipe-info">
              <p class="home-recipe-title">${title}</p>
              <p class="home-recipe-cost">${r.cost > 0 ? `€${r.cost.toFixed(2)}` : '—'}</p>
            </div>
          </a>`;
      }).join('');

  const topIngsHtml = data.top_ingredients.length === 0
    ? `<p class="text-muted text-sm">${t('home_no_data')}</p>`
    : data.top_ingredients.map((ing, idx) => `
        <div class="home-ing-row">
          <span class="home-ing-rank">${idx + 1}</span>
          <span class="home-ing-name">${localizedField(ing, 'name') || tIng(ing.name)}</span>
          <a href="recipe.html?id=${ing.recipe_id}" class="home-ing-recipe">${localizedField(ing, 'recipe_title')}</a>
          <span class="home-ing-cost">€${ing.total.toFixed(2)}</span>
        </div>`).join('');

  document.getElementById('home-content').innerHTML = `
    ${heroHtml}
    <div class="home-sections">
      <div class="home-section-card">
        <h2 class="home-section-title">${t('home_top_recipes')}</h2>
        <div class="home-recipe-list">${topRecipesHtml}</div>
      </div>
      <div class="home-section-card">
        <h2 class="home-section-title">${t('home_top_ings')}</h2>
        <div class="home-ing-list">${topIngsHtml}</div>
      </div>
    </div>`;
}

function countPricedIngs(data) {
  return data.top_ingredients.length;
}

// ── Init ──────────────────────────────────────────────────────────────────────
let _summaryData = null;

document.addEventListener('langchange', () => {
  if (_summaryData) renderHome(_summaryData);
});

(async () => {
  const res = await apiFetch('/summary');
  if (!res || !res.ok) {
    document.getElementById('home-content').innerHTML =
      `<p class="text-muted">${t('err_load')}</p>`;
    return;
  }
  _summaryData = res.data;
  renderHome(_summaryData);
  applyTranslations();
})();
