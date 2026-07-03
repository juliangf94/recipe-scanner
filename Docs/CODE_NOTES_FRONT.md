# RecipeScanner — Explicación del Frontend

---

## ¿Por qué no usamos Jinja2?

El plan original era usar **Jinja2** — el motor de templates de Flask — para renderizar el HTML en el servidor. Esto implicaba rutas Flask adicionales (`/recipes`, `/login`, etc.) que devolvían HTML en vez de JSON.

Abandonamos Jinja2 por dos razones concretas que surgieron durante el desarrollo:

**1. Conflicto con flask_restx**

`flask_restx` genera Swagger automáticamente y toma control del objeto `Api` de Flask. Cuando intentamos agregar rutas Jinja2 al mismo tiempo, los namespaces y los blueprints de vistas entraban en conflicto en el sistema de rutas. Separar la API del frontend server-side requería arquitectura adicional que aumentaba la complejidad sin beneficio real para el proyecto.

**2. Objetivo de portabilidad mobile**

El proyecto tiene como objetivo futuro una app mobile (React Native o Flutter). Una API REST pura en Flask — sin ningún HTML servido desde el servidor — es el contrato correcto entre backend y cualquier cliente, ya sea un browser o una app nativa. Si el frontend fuera Jinja2, el backend quedaría acoplado al browser y tendríamos que reescribir el frontend completo para mobile.

Con HTML estático + JS puro:
```
Backend (Flask)  ──► JSON únicamente  ◄──  Cualquier cliente
                                             ├── Browser (HTML+JS)
                                             ├── iOS (Swift/React Native)
                                             └── Android (Kotlin/Flutter)
```

---

## Arquitectura del frontend

```
frontend/
├── account.html        ← Ajustes de cuenta: nombre, email, contraseña, avatar
├── dashboard.html      ← Lista de recetas con filtros y búsqueda
├── home.html           ← Resumen semanal de cocina y recetas top
├── index.html          ← Login
├── prices.html         ← Mis precios custom (tabla editable inline), tiendas, marcas
├── privacy.html        ← Política de privacidad
├── recipe.html         ← Detalle de receta, ingredientes, precios, pasos, galería de fotos
├── register.html       ← Registro
├── scan.html           ← Escanear PDF con IA (con modal anti-duplicados)
├── terms.html          ← Términos de uso
├── css/
│   └── style.css       ← Estilos globales (dark/light, WCAG AA)
└── js/
    ├── i18n.js         ← Sistema de traducción (EN/ES/FR) — se carga primero
    ├── api.js          ← Tokens JWT + fetch wrapper con auto-refresh — se carga segundo
    ├── auth.js         ← Login, registro, localStorage
    ├── home.js         ← Resumen semanal (cook log) y recetas top
    ├── dashboard.js    ← Dashboard de recetas con búsqueda y filtros
    ├── recipe.js       ← Detalle de receta, secciones, precios, fotos múltiples
    ├── prices.js       ← Tabla inline editable, stores, brands, ordenamiento
    └── scan.js         ← Carga de PDF, escaneo, modal duplicados, dismiss éxito
```

Cada HTML carga sus scripts en orden al final del `<body>`:
```html
<script src="js/i18n.js"></script>   <!-- primero: traducciones disponibles -->
<script src="js/api.js"></script>    <!-- segundo: funciones de red disponibles -->
<script src="js/dashboard.js"></script>  <!-- tercero: lógica de la página -->
```

No hay bundler (Webpack, Vite, etc.) ni framework (React, Vue). Es HTML + CSS + JS vanilla. Esto es intencional para el portfolio — cada línea es visible y explicable.

---

# Sesión 11 — Frontend · Arquitectura base

## `frontend/js/i18n.js`

Este archivo maneja el sistema de traducción completo de la app. Se carga antes que cualquier otro script para que las funciones `t()` y `tCat()` estén disponibles globalmente desde el primer momento.

### El objeto `TRANSLATIONS`

```javascript
const TRANSLATIONS = {
  en: {
    nav_home: 'Home',
    greeting: 'Hello, {name}! 👋',
    ...
  },
  es: {
    nav_home: 'Inicio',
    greeting: '¡Hola, {name}! 👋',
    ...
  }
};
```

Un objeto con dos claves (`en`, `es`). Cada clave es un objeto plano de key → string traducido. Todos los textos de la app están aquí — nada de texto hardcodeado en los HTML o JS (excepto placeholders temporales que `applyTranslations()` reemplaza al cargar).

### `getLang()` y `setLang()`

```javascript
function getLang() {
  return localStorage.getItem('lang') || 'en';
}

function setLang(lang) {
  localStorage.setItem('lang', lang);
  applyTranslations();
  document.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
}
```

El idioma elegido se guarda en `localStorage` — persiste entre sesiones. `setLang()` hace tres cosas:
1. Guarda el nuevo idioma en `localStorage`
2. Reaplica todas las traducciones en el DOM actual
3. Dispara el evento `langchange` para que los JS de cada página puedan reaccionar (por ejemplo, `dashboard.js` re-renderiza las tarjetas de recetas cuando cambia el idioma)

### `t(key)` — traducción simple

```javascript
function t(key) {
  const lang = getLang();
  return (TRANSLATIONS[lang] && TRANSLATIONS[lang][key]) || TRANSLATIONS.en[key] || key;
}
```

Cascada de fallback:
1. Intenta el idioma actual
2. Si no existe, usa inglés
3. Si tampoco existe en inglés, devuelve la key como texto (evita `undefined` visible)

### `tf(key, vars)` — traducción con variables

```javascript
function tf(key, vars) {
  let str = t(key);
  for (const [k, v] of Object.entries(vars)) {
    str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  }
  return str;
}
```

Para strings con variables: `tf('greeting', { name: 'Julian' })` → `"¡Hola, Julian! 👋"`. El `replace` usa `RegExp` para reemplazar `{name}` globalmente (flag `'g'`) por si la misma variable aparece más de una vez.

### `tCat(category)` — traducción de categorías

```javascript
const CAT_MAP = {
  en: { 'postres': 'Desserts', 'carne': 'Meat', ... },
  es: { 'desserts': 'Postres', 'meat': 'Carne', ... }
};

function tCat(category) {
  if (!category) return category;
  const lang = getLang();
  const map = CAT_MAP[lang];
  return (map && map[category.toLowerCase()]) || category;
}
```

Las categorías se guardan en la DB en el idioma en que el usuario las ingresó. `tCat()` las traduce al idioma activo. Si no hay traducción definida, devuelve el valor original sin modificar.

**Problema que resuelve:** Si hay recetas con `"Postres"` (ES) y `"Desserts"` (EN), ambas deben aparecer bajo el mismo filtro. El dashboard usa `tCat()` para deduplicar los pills de categoría por label traducido.

### `titleCase(str)` — normalización de categorías

```javascript
function titleCase(str) {
  if (!str) return '';
  return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}
```

Convierte cualquier capitalización a Title Case: `"main course"` → `"Main Course"`, `"DESSERTS"` → `"Desserts"`. Se aplica antes de enviar una categoría al backend, garantizando consistencia sin depender únicamente de la normalización del servidor.

### `applyTranslations()` — actualización del DOM

```javascript
function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === getLang());
  });
}
```

Recorre todos los elementos del DOM con atributos `data-i18n`, `data-i18n-placeholder`, etc. y reemplaza su contenido con la traducción correspondiente. Los HTML pueden tener texto de placeholder en inglés que se sobreescribe al cargar:

```html
<span data-i18n="nav_home">Home</span>
```

Al cambiar de idioma, `applyTranslations()` convierte `"Home"` → `"Inicio"` sin recargar la página.

---

## `frontend/js/api.js`

El módulo central que maneja todos los requests HTTP y el ciclo de vida de los tokens JWT.

### Detección de entorno y URL base

```javascript
const IS_LOCAL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const BASE_URL = IS_LOCAL
  ? 'http://localhost:5000/api/v1'
  : 'https://recipe-scanner-kfnm.onrender.com/api/v1';
```

El frontend detecta automáticamente si está corriendo en local o en producción mirando el hostname del browser. Así no hay que cambiar ninguna URL al hacer deploy — el mismo código funciona en ambos entornos.

### Warm-up ping a Render

```javascript
if (!IS_LOCAL) fetch(`${BASE_URL}/health`).catch(() => {});
```

Render (free tier) duerme el servidor después de inactividad. Esta línea dispara un request silencioso a `/health` apenas carga cualquier página — sin esperar la respuesta (`fire-and-forget`). Así el servidor ya está despierto cuando el usuario hace su primer request real. Solo se ejecuta en producción (`!IS_LOCAL`).

### Resolución de URLs de imágenes

```javascript
function resolveImgUrl(url) {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('//')) return url;
  return `${SERVER_URL}${url}`;
}
```

Las imágenes pueden estar en dos lugares:
- **Supabase Storage** → URL absoluta que empieza con `https://` — se devuelve tal cual
- **Disco local del servidor** → ruta relativa como `/static/uploads/recipes/foto.jpg` — se le agrega la URL base del servidor

Esto permite que el código del frontend sea el mismo sin importar dónde esté guardada la imagen.

### Almacenamiento del usuario en localStorage

```javascript
function getUser() {
  const u = localStorage.getItem('user');
  return u ? JSON.parse(u) : null;
}

function setUser(user) {
  localStorage.setItem('user', JSON.stringify(user));
}
```

El objeto del usuario (nombre, email, avatar) se guarda en `localStorage` para mostrarlo en el sidebar sin hacer un request al servidor en cada página. Se actualiza cuando el usuario cambia su avatar o sus datos en la cuenta.

### Almacenamiento de tokens

```javascript
function getAccessToken()  { return localStorage.getItem('access_token'); }
function getRefreshToken() { return localStorage.getItem('refresh_token'); }

function setTokens(accessToken, refreshToken) {
  localStorage.setItem('access_token', accessToken);
  if (refreshToken) localStorage.setItem('refresh_token', refreshToken);
}

function clearTokens() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
}
```

Se usan dos funciones separadas para leer (`get`) y una sola para escribir (`setTokens`). `setTokens` acepta `null` como segundo argumento para poder actualizar solo el access token durante el refresh sin borrar el refresh token.

`clearTokens()` borra los tres items de localStorage — tokens y datos del usuario — en una sola operación atómica.

### Migración automática del token viejo

```javascript
(function migrateLegacyToken() {
  const old = localStorage.getItem('token');
  if (old && !getAccessToken()) {
    localStorage.setItem('access_token', old);
    localStorage.removeItem('token');
  }
})();
```

Este bloque se ejecuta inmediatamente al cargar el archivo (IIFE — Immediately Invoked Function Expression). Los usuarios que tenían sesión activa con el sistema anterior (clave `'token'`) no son forzados a volver a hacer login — el token viejo se migra automáticamente a la nueva clave `'access_token'`.

### Decodificación del JWT sin librería

```javascript
function parseJwt(token) {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload));
  } catch { return null; }
}

function isTokenExpired(token) {
  const payload = parseJwt(token);
  if (!payload || !payload.exp) return true;
  return payload.exp * 1000 < Date.now() + 10_000;
}
```

Un JWT tiene tres partes separadas por `.`: `header.payload.signature`. Solo necesitamos el payload.

`atob()` decodifica base64. El JWT usa base64url (reemplaza `-` por `+` y `_` por `/`) — el `replace` hace esa conversión antes de decodificar.

`payload.exp` es un timestamp Unix en **segundos** — se multiplica por 1000 para comparar con `Date.now()` que devuelve milisegundos. El buffer de 10 segundos evita que un token válido se considere expirado a último momento (race condition entre la verificación y el envío del request).

### `requireAuth()` — guardia de navegación

```javascript
function requireAuth() {
  const access  = getAccessToken();
  const refresh = getRefreshToken();

  if (!access && !refresh) {
    window.location.href = 'index.html';
    return;
  }
  if (access && isTokenExpired(access) && !refresh) {
    clearTokens();
    window.location.href = 'index.html';
  }
}
```

Se llama al inicio de cada página protegida. La lógica:
- Sin ningún token → login
- Access expirado pero con refresh → deja pasar (el primer request hará el refresh)
- Access expirado sin refresh → limpia y redirige al login

### Refresh silencioso con `_refreshPromise`

```javascript
let _refreshPromise = null;

async function refreshAccessToken() {
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;

    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${refreshToken}` }
    });

    if (res.ok) {
      const data = await res.json();
      setTokens(data.access_token, null);
      return true;
    }

    clearTokens();
    window.location.href = 'index.html';
    return false;
  })();

  _refreshPromise.finally(() => { _refreshPromise = null; });
  return _refreshPromise;
}
```

`_refreshPromise` resuelve el problema de las llamadas paralelas: si la página hace 5 requests simultáneos y el access token está expirado, sin esta variable se harían 5 llamadas a `/auth/refresh` al mismo tiempo. Con `_refreshPromise`, el primer request inicia el refresh y los otros 4 esperan la misma Promise. Cuando resuelve, todos usan el mismo nuevo token.

### `apiFetch()` — wrapper principal

```javascript
async function apiFetch(path, options = {}) {
  // 1. Refresh proactivo si el token está por vencer
  const access = getAccessToken();
  if (access && isTokenExpired(access)) {
    const ok = await refreshAccessToken();
    if (!ok) return;
  }

  // 2. Request normal con el token actualizado
  const token = getAccessToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  // 3. Si el servidor responde 401, intenta un refresh reactivo y reintenta
  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) return;

    // Retry del request original
    const retryToken = getAccessToken();
    const retryHeaders = { 'Content-Type': 'application/json', ...options.headers };
    if (retryToken) retryHeaders['Authorization'] = `Bearer ${retryToken}`;

    const retryRes = await fetch(`${BASE_URL}${path}`, { ...options, headers: retryHeaders });
    if (retryRes.status === 401) { clearTokens(); window.location.href = 'index.html'; return; }
    if (retryRes.status === 204) return null;
    return retryRes.json().then(data => ({ ok: retryRes.ok, status: retryRes.status, data }));
  }

  if (res.status === 204) return { ok: true, status: 204, data: null };
  return res.json().then(data => ({ ok: res.ok, status: res.status, data }));
}
```

Dos estrategias de refresh:
- **Proactivo** — antes del request, si `isTokenExpired()` devuelve true
- **Reactivo** — después del request, si el servidor devuelve 401 (el token puede haber expirado justo entre el chequeo y el envío)

Todos los JS de la app usan `apiFetch()` en lugar de `fetch()` directamente. Así la lógica de tokens está en un solo lugar.

### `apiUpload()` — subida de archivos

```javascript
async function apiUpload(path, formData) {
  const token = getAccessToken();
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { method: 'POST', headers, body: formData });
  ...
}
```

Es una versión de `apiFetch()` especializada para subir archivos (imágenes de recetas, avatares). Las diferencias clave con `apiFetch()`:

- **No agrega `Content-Type: application/json`** — cuando se envía un `FormData`, el browser establece automáticamente `Content-Type: multipart/form-data` con el `boundary` correcto. Si se forzara `application/json`, el servidor no podría leer el archivo.
- **Siempre usa `POST`** — la subida de archivos es siempre una creación, nunca una edición parcial.
- **No tiene refresh proactivo complejo** — si el token expiró, redirige al login directamente.

---

## `frontend/js/auth.js`

Maneja login y registro. Dos funciones principales: `handleLogin()` y `handleRegister()`.

### Login

```javascript
async function handleLogin(event) {
  event.preventDefault();
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  const res = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });

  if (!res || !res.ok) return showError('login-error', res?.data?.error || t('err_login_failed'));

  setTokens(res.data.access_token, res.data.refresh_token);
  setUser(res.data.user);
  window.location.href = 'dashboard.html';
}
```

`event.preventDefault()` — evita que el formulario HTML recargue la página (comportamiento default de `<form>`). Se usan los campos `access_token` y `refresh_token` de la respuesta — el backend ya no devuelve `token` genérico.

### Registro con auto-login

```javascript
// Después de registrar exitosamente, hace login automático
const loginRes = await apiFetch('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email, password })
});

if (loginRes && loginRes.ok) {
  setTokens(loginRes.data.access_token, loginRes.data.refresh_token);
  setUser(loginRes.data.user);
  window.location.href = 'dashboard.html';
}
```

El registro no devuelve tokens — solo confirma que el usuario fue creado. Para evitar que el usuario tenga que hacer login después de registrarse, se hace un segundo request de login inmediatamente y se guarda la sesión.

---

## `frontend/js/dashboard.js`

Gestiona la pantalla principal: lista de recetas con búsqueda, filtros por categoría, y creación manual.

### Filtros de categoría — deduplicación por label traducido

```javascript
function buildCategories(recipes) {
  const labelMap = new Map();
  recipes.forEach(r => {
    if (!r.category) return;
    const raw   = r.category.trim();
    const label = tCat(raw).toLowerCase();
    if (!labelMap.has(label)) labelMap.set(label, new Set());
    labelMap.get(label).add(raw.toLowerCase());
  });
  // ...
}
```

`labelMap` agrupa los valores raw por su label traducido. Si hay recetas con `"Postres"` y `"Desserts"`, ambas mapean al label `"desserts"` en inglés → un solo pill en el filtro.

### Filtrado reactivo

```javascript
const filtered = allRecipes.filter(r => {
  const translatedCat = tCat(r.category || '').toLowerCase();
  const matchCat = activeCategory === 'all' || translatedCat === activeCategory;
  const matchSearch = !search ||
    r.title.toLowerCase().includes(search) ||
    tCat(r.category || '').toLowerCase().includes(search);
  return matchCat && matchSearch;
});
```

El filtro compara por label traducido (no por valor raw), por eso `"Postres"` y `"Desserts"` responden al mismo filtro. La búsqueda también usa `tCat()` — buscar "desserts" encuentra recetas con `"Postres"`.

---

## `frontend/js/recipe.js`

El JS más extenso. Maneja la vista de detalle de una receta: tabla de ingredientes con secciones, precios por tienda, modal de precio con modo "por cantidad", y pasos de preparación.

### Carga inicial paralela

```javascript
async function loadPage() {
  const [recipeRes, ingRes, stepsRes, storesRes] = await Promise.all([
    apiFetch(`/recipes/${recipeId}`),
    apiFetch(`/recipes/${recipeId}/ingredients`),
    apiFetch(`/recipes/${recipeId}/steps`),
    apiFetch('/stores')
  ]);
  // ...
}
```

`Promise.all()` hace los cuatro requests en paralelo — no espera a que termine uno para empezar el otro. En serie tardarían ~400ms; en paralelo tardan lo que tarde el más lento (~100ms). Los stores se cargan aquí también para tenerlos disponibles al renderizar la tabla de ingredientes.

### Tabla de ingredientes con secciones

```javascript
function renderIngredientsTable(ingredients) {
  const sections = getSections(ingredients); // orden de aparición de secciones
  // ...
  const blocks = sections.map(sec => {
    const group = ingredients.filter(i => (i.section || '') === sec);
    const headerRow = `<tr class="section-header-row">...</tr>`;
    const rows = group.map(i => renderIngRow(i, sections)).join('');
    return headerRow + rows;
  }).join('');
}
```

Los ingredientes sin sección tienen `section = ''` o `null` — ambos se normalizan a `''` con `(i.section || '')`. Aparecen bajo el header "General". Los grupos se renderizan en el orden en que aparecen por primera vez en el array — el orden de inserción se preserva.

### Mover ingrediente entre secciones

```javascript
async function moveToSection(ingId, value) {
  let sectionName = value;
  if (value === '__new__') {
    sectionName = prompt(t('section_new_name_prompt'));
    if (!sectionName || !sectionName.trim()) return;
    sectionName = sectionName.trim();
  }
  await apiFetch(`/recipes/${recipeId}/ingredients/${ingId}`, {
    method: 'PUT',
    body: JSON.stringify({ section: sectionName })
  });
  const ing = currentIngredients.find(i => i.id === ingId);
  if (ing) ing.section = sectionName;
  document.getElementById('ingredients-section').innerHTML =
    renderIngredientsTable(currentIngredients);
  loadCost();
}
```

La actualización es optimista: primero se actualiza `currentIngredients` en memoria y se re-renderiza la tabla. Luego el backend confirma el cambio. Si el request falla, la UI quedaría inconsistente — aceptable para uso personal.

### Modal de precio — modo dual

```javascript
function setPriceMode(mode) {
  priceModalMode = mode;
  document.getElementById('pm-mode-qty').classList.toggle('active', mode === 'qty');
  document.getElementById('pm-mode-kg').classList.toggle('active',  mode === 'kg');
  document.getElementById('pm-qty-fields').style.display = mode === 'qty' ? '' : 'none';
  document.getElementById('pm-kg-field').style.display   = mode === 'kg' ? '' : 'none';
}
```

El modal tiene dos modos:
- **Por cantidad** (`qty`): tres campos (cantidad, unidad, precio pagado) + preview del €/kg calculado
- **Por kg** (`kg`): un campo directo + botón "Fetch from OFF"

El toggle cambia la visibilidad de los grupos de campos y actualiza el estilo del botón activo. `priceModalMode` es una variable global del módulo que `saveManualPrice()` lee para saber cómo calcular el precio final.

### Cálculo €/kg client-side

```javascript
function calcPricePerKg(qty, unit, pricePaid) {
  if (!qty || !pricePaid) return null;
  const u = unit.toLowerCase().trim();
  if (_KG_UNITS.has(u)) return pricePaid / qty;
  if (_G_UNITS.has(u)) return (pricePaid / qty) * 1000;
  return pricePaid / qty;
}
```

El mismo cálculo existe en el backend (`_calc_price_per_kg`). Se duplica aquí para el **preview en vivo** — mostrar el resultado mientras el usuario escribe, sin hacer un request. El backend re-calcula al guardar para que sea la fuente de verdad.

### Dropdown de tienda por ingrediente

```javascript
async function changeIngredientStore(ingId, storeId) {
  await apiFetch(`/recipes/${recipeId}/ingredients/${ingId}`, {
    method: 'PUT',
    body: JSON.stringify({ preferred_store_id: storeId || null })
  });
  loadCost();
}
```

Cada fila de la tabla tiene su propio `<select>` con las tiendas del usuario. Al cambiar la tienda, se actualiza `preferred_store_id` en el backend y se recalcula el costo. El backend usa ese `preferred_store_id` en `_resolve_price` para buscar el precio de esa tienda primero.

---

## `frontend/js/prices.js`

Gestiona la página "My Prices": tabla editable inline estilo Excel con precios custom, ordenamiento, y modales para gestión de tiendas y marcas.

### Arquitectura: tabla inline en lugar de modales

A diferencia del sistema anterior (que usaba modales separados para agregar y editar), `prices.js` actual implementa una tabla donde cada celda es directamente editable — las celdas de datos son `<input>` y `<select>` que el usuario puede modificar sin abrir ningún modal.

### Carga en serie e inicialización

```javascript
async function init() {
  await Promise.all([loadStores(), loadBrands()]);  // en paralelo
  await loadPrices();                                // después: usa allStores y allBrands
}
```

### Construcción de la tabla

```javascript
function renderTable(prices) {
  wrap.innerHTML = `
    <table class="ing-table prices-inline-table">
      <thead>...</thead>
      <tbody>
        ${prices.map(p => buildPriceRow(p)).join('')}
        ${buildNewRow()}   <!-- fila vacía al final para crear nuevos precios -->
      </tbody>
    </table>`;
}

function buildPriceRow(p) {
  const ppkg = calcPricePerKg(p.bought_qty, p.bought_unit, p.bought_price) ?? p.price_per_kg;
  return `
    <tr class="price-row" data-id="${p.id}" onfocusout="handleRowFocusOut(event,'${p.id}')">
      <td class="cell-name">${tIng(p.ingredient_name)}</td>
      <td><select class="cell-sel store-cell" onchange="updateCalc(this)">
        ${storeOptions(p.store_id)}
      </select></td>
      <td><select class="cell-sel brand-cell" ...>${brandOptions(p.brand_id)}</select></td>
      <td><input class="cell-inp qty-cell" type="text" inputmode="decimal"
           value="${p.bought_qty || ''}" oninput="updateCalc(this)"></td>
      <td><select class="cell-sel unit-cell" ...>${unitOptions(p.bought_unit)}</select></td>
      <td><input class="cell-inp price-cell" type="text" inputmode="decimal"
           value="${priceVal}" oninput="updateCalc(this)"></td>
      <td class="ppkg-cell">${ppkg != null ? '€' + ppkg.toFixed(2) : '—'}</td>
      <td><button onclick="deletePrice('${p.id}',...)">...</button></td>
    </tr>`;
}
```

### `updateCalc()` — recálculo €/kg en tiempo real

```javascript
function updateCalc(el) {
  const row = el.closest('tr');
  const qty   = parseFloat((row.querySelector('.qty-cell')?.value  || '').replace(',', '.'));
  const unit  = row.querySelector('.unit-cell')?.value || 'g';
  const price = parseFloat((row.querySelector('.price-cell')?.value || '').replace(',', '.'));
  const ppkgCell = row.querySelector('.ppkg-cell');
  if (!isNaN(qty) && qty > 0 && !isNaN(price) && price > 0) {
    const ppkg = calcPricePerKg(qty, unit, price);
    ppkgCell.textContent = ppkg != null ? '€' + ppkg.toFixed(2) : '—';
  } else if (!isNaN(price) && price > 0) {
    ppkgCell.textContent = '€' + price.toFixed(2);  // precio directo €/kg
  } else {
    ppkgCell.textContent = '—';
  }
}
```

Se llama con `oninput` y `onchange` desde cualquier celda editable de la fila — la columna €/kg se actualiza con cada tecla.

### Guardado automático con `onfocusout`

```javascript
function handleRowFocusOut(event, priceId) {
  // focusout burbujea: si el foco va a otro elemento DENTRO de la fila → no guardar
  // (el usuario está tabulando entre celdas de la misma fila)
  if (event.currentTarget.contains(event.relatedTarget)) return;
  if (priceId === 'new') {
    saveNewRow(event.currentTarget);
  } else {
    saveRowEdit(priceId, event.currentTarget);
  }
}
```

`event.currentTarget` es el `<tr>`. `event.relatedTarget` es el elemento que recibe el foco a continuación. Si `relatedTarget` está DENTRO del `<tr>`, el usuario simplemente tabuló a la siguiente celda de la misma fila → no se guarda todavía. Si salió completamente de la fila → se guarda.

### Dual-mode del campo precio

```javascript
async function saveRowEdit(priceId, row) {
  const qty   = parseFloat(row.querySelector('.qty-cell')?.value.replace(',', '.'));
  const price = parseFloat(row.querySelector('.price-cell')?.value.replace(',', '.'));
  const hasQty = !isNaN(qty) && qty > 0;
  const hasPrice = !isNaN(price) && price > 0;
  if (!hasPrice) return; // sin precio → no guardar

  let body = { store_id: storeId, brand_id: brandId };
  if (hasQty) {
    // modo "por cantidad": guarda bought_qty/unit/price, calcula €/kg en el backend
    body.bought_qty = qty; body.bought_unit = unit; body.bought_price = price;
  } else {
    // modo directo: el valor en la celda precio YA es el €/kg
    body.price_per_kg = price;
  }
  await apiFetch(`/prices/${priceId}`, { method: 'PUT', body: JSON.stringify(body) });
}
```

### Ordenamiento client-side

```javascript
function sortedPrices(prices) {
  const mode = document.getElementById('sort-select')?.value || 'name-asc';
  const copy = [...prices]; // nunca mutar el array original
  switch (mode) {
    case 'name-asc':  return copy.sort((a, b) => a.ingredient_name.localeCompare(b.ingredient_name));
    case 'price-asc': return copy.sort((a, b) => a.price_per_kg - b.price_per_kg);
    case 'store':     return copy.sort((a, b) => {
      const sa = allStores.find(s => s.id === a.store_id)?.name || '';
      const sb = allStores.find(s => s.id === b.store_id)?.name || '';
      return sa !== sb ? sa.localeCompare(sb) : a.ingredient_name.localeCompare(b.ingredient_name);
    });
    // ...etc
  }
}
```

`[...prices]` crea una copia superficial — `Array.sort()` muta el original, lo que causaría re-renders incorrectos. `localeCompare()` respeta acentos y caracteres especiales (ñ, é).

---

## `frontend/js/i18n.js` — sistema de internacionalización completo

La app soporta inglés y español sin recargar la página. El cambio de idioma es instantáneo porque todos los strings ya están en memoria en `TRANSLATIONS`.

### Evento `langchange`

```javascript
document.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
```

Un `CustomEvent` es un evento personalizado que puede escuchar cualquier JS de la página. Cada página registra su propio listener:

```javascript
// En dashboard.js
document.addEventListener('langchange', () => {
  buildCategories(allRecipes); // re-renderiza los pills con el nuevo idioma
  renderRecipes();             // re-renderiza las tarjetas
});
```

Esto permite que el cambio de idioma actualice hasta los elementos generados dinámicamente por JavaScript (que no tienen `data-i18n` porque no existen en el HTML inicial).

---

## `frontend/js/scan.js`

Gestiona la página de escaneo de PDF. Es el punto de entrada donde el usuario sube una receta en formato PDF que el backend procesa con IA (Groq).

### Drag & drop vs. selector de archivo

```javascript
const dropZone = document.getElementById('drop-zone');

dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type === 'application/pdf') {
    selectedFile = file;
    // ...
  } else {
    // mostrar error
  }
});
```

`e.preventDefault()` en `dragover` es obligatorio — sin él, el browser intercepta el drop y lo abre directamente en la pestaña. `e.dataTransfer.files[0]` accede al archivo arrastrado. La validación `file.type === 'application/pdf'` es client-side y es orientativa — el backend tiene su propia validación con `allowed_extensions`.

La función `onFileSelect()` hace lo mismo pero para el `<input type="file">` del selector clásico. Los dos caminos de entrada convergen en `selectedFile`.

### Flujo del escaneo

```javascript
async function scanPdf() {
  const formData = new FormData();
  formData.append('file', selectedFile);

  // Oculta el botón, muestra spinner
  document.getElementById('scan-btn').style.display = 'none';
  document.getElementById('scanning').style.display = '';

  const res = await apiUpload('/scan/', formData);

  // Restaura botón, oculta spinner
  document.getElementById('scanning').style.display = 'none';
  document.getElementById('scan-btn').style.display = '';

  // Manejo de duplicado (409)
  if (res?.status === 409 && res?.data?.error_code === 'duplicate') {
    document.getElementById('duplicate-modal').classList.add('open');
    return;
  }

  if (!res || !res.ok) { /* error */ return; }

  const recipe = res.data.recipe;
  renderSuccessMessage(recipe.id, recipe.title);  // muestra cartel verde con botón
  showLastScan(recipe, res.data);                 // muestra resumen debajo del formulario
}
```

`apiUpload()` (en `api.js`) es distinto de `apiFetch()` porque no agrega `Content-Type: application/json` — con `FormData`, el browser establece automáticamente `Content-Type: multipart/form-data` con el boundary correcto.

Ya **no hay auto-redirect** — el usuario ve el mensaje de éxito con un botón "Ver receta" y una X para cerrar. El usuario decide cuándo navegar.

### Mensaje de éxito con X para cerrar

```javascript
function renderSuccessMessage(id, title) {
  const el = document.getElementById('upload-success');
  el.style.position = 'relative';
  el.innerHTML = `
    <button onclick="dismissScanSuccess()"
      style="position:absolute;top:0.35rem;right:0.5rem;background:none;border:none;
             font-size:1rem;cursor:pointer;opacity:0.55;" title="Cerrar">✕</button>
    ${tf('scan_ok', { title })}
    <div style="margin-top:0.6rem;">
      <a href="recipe.html?id=${id}" class="btn btn-orange btn-sm">${t('btn_view_recipe')}</a>
    </div>`;
  el.style.display = '';
}

function dismissScanSuccess() {
  document.getElementById('upload-success').style.display = 'none';
}
```

La X está posicionada absolutamente dentro del cartel. Si el usuario navega fuera de `scan.html` y vuelve, el cartel ya no está — es un elemento en el DOM de esa página, no se persiste en localStorage.

### Modal de duplicados

Si el backend detecta que ya existe una receta con el mismo título (HTTP 409), se muestra un modal con dos opciones:
- "Ver receta existente" → navega al ID existente
- "Crear de todas formas" → reenvía el mismo PDF con `?force=true`

### Resumen del resultado con i18n

```javascript
const ingText = ings === 1 ? t('res_ing_1') : tf('res_ing_n', { n: ings });
```

Singular/plural manejado con dos keys separadas en `TRANSLATIONS`: `res_ing_1` = `"1 ingredient"` y `res_ing_n` = `"{n} ingredients"`. Esto es más correcto que `"1 ingredient(s)"` y permite traducir correctamente al español donde la pluralización tiene reglas distintas.

### Persistencia para cambio de idioma

```javascript
let lastScanRecipe = null;
let lastScanData   = null;

document.addEventListener('langchange', () => {
  if (lastScanRecipe && lastScanData) {
    showLastScan(lastScanRecipe, lastScanData);
  }
});
```

El resultado del scan se guarda en variables del módulo. Si el usuario cambia de idioma justo después de escanear (antes de la redirección), el resumen se re-renderiza en el nuevo idioma usando los datos ya disponibles — sin hacer otro request al backend.

---

# Sesión 12 — Frontend · Tokens JWT y sistema de autenticación

## Problema que resuelve el sistema de refresh tokens

El access token dura 15 minutos. Sin refresh token, el usuario tiene que hacer login cada 15 minutos — inaceptable para una app de uso diario. Con refresh token (30 días), el usuario puede trabajar sin interrupciones: el access token se renueva automáticamente en silencio cada vez que está por vencer.

## Flujo completo de autenticación

```
USUARIO                  BROWSER (api.js)              BACKEND (Flask)
─────────────────────────────────────────────────────────────────────
Login con email/pwd ──► POST /auth/login ────────────► Verifica credenciales
                                                        Crea access_token (15 min)
                                                        Crea refresh_token (30 días)
                         ◄──────────────────────────── { access_token, refresh_token }
                         localStorage.setItem(...)

[15 min después]
apiFetch('/recipes') ──► isTokenExpired(access) = true
                         refreshAccessToken() ────────► POST /auth/refresh
                                                         Header: Bearer <refresh_token>
                                                        @jwt_required(refresh=True)
                                                        Crea nuevo access_token
                         ◄──────────────────────────── { access_token }
                         localStorage update
                         ──► Request original con nuevo token
```

## Dos tokens — dos rutas — dos decoradores

```python
# Backend: access token normal
@api.route('/recipes')
class RecipeList(Resource):
    @jwt_required()           ← acepta access tokens
    def get(self): ...

# Backend: endpoint de refresh
@api.route('/refresh')
class Refresh(Resource):
    @jwt_required(refresh=True)   ← solo acepta refresh tokens
    def post(self): ...
```

`@jwt_required(refresh=True)` rechaza un access token enviado al endpoint de refresh (y viceversa). Los dos tipos de token son criptográficamente distintos — no son intercambiables.

## Configuración en `config.py`

```python
JWT_ACCESS_TOKEN_EXPIRES  = timedelta(minutes=15)
JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)
```

- **15 minutos** para el access token: si es robado, la ventana de uso es mínima
- **30 días** para el refresh token: sesión activa sin re-login durante un mes

La clave `JWT_SECRET_KEY` se lee de `.env` en producción — nunca hardcodeada, nunca va a GitHub.

## Por qué este método funciona para mobile

El patrón access + refresh token es stateless en el servidor — Flask no guarda nada en sesión. Esto significa:

- La misma API funciona para browser, iOS, Android, y React Native sin cambios
- No hay cookies — mobile no tiene el concepto de cookie de sesión HTTP
- El refresh token se guarda en `SecureStorage` en mobile (equivalente a `localStorage` pero con cifrado de sistema operativo)

Si en el futuro se construye la app mobile, la implementación de autenticación del backend ya está lista — solo cambia el cliente que consume la API.

## Logout

```javascript
function logout() { removeToken(); window.location.href = 'index.html'; }
```

`removeToken()` es un alias de `clearTokens()` — borra `access_token`, `refresh_token`, y `user` de `localStorage`. El backend no tiene un endpoint de logout porque los tokens son stateless. Si se quisiera invalidación inmediata (por ejemplo, en caso de compromiso de cuenta), habría que implementar una lista de tokens revocados en el backend — fuera del scope actual del proyecto.

---

# Sesión 13 — Frontend · Imágenes y helper `resolveImgUrl`

## `resolveImgUrl()` — URL de imagen desde Supabase o local

```javascript
function resolveImgUrl(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url;  // Supabase → URL absoluta lista para usar
  return SERVER_URL + url;                  // fallback local → /static/uploads/...
}
```

El backend puede guardar dos tipos de URL de imagen:
1. **Supabase** → URL absoluta `https://xxx.supabase.co/storage/v1/object/public/...`
2. **Fallback local** → URL relativa `/static/uploads/avatars/user-id.jpg`

`resolveImgUrl()` unifica los dos casos. Si la URL ya es absoluta (empieza con `http`), se usa directamente. Si es relativa, se le antepone `SERVER_URL` (la URL del backend: `https://recipe-scanner-kfnm.onrender.com`).

Esta función se usa en todos los JS que renderizan imágenes: `recipe.js`, `scan.js`, `prices.js`, etc.

## `tIng()` — traducción de ingredientes en el frontend

```javascript
function tIng(name, nameEn, nameEs, nameFr) {
  const lang = getLang();
  if (lang === 'en' && nameEn) return nameEn;
  if (lang === 'es' && nameEs) return nameEs;
  if (lang === 'fr' && nameFr) return nameFr;
  return name; // fallback al nombre original
}
```

Los ingredientes tienen columnas `name_en`, `name_es`, `name_fr` en la BD. `tIng()` selecciona la traducción correspondiente al idioma activo. Si la traducción no existe (puede fallar si el servicio de traducción no estuvo disponible), usa el nombre original.

## Soporte trilingüe EN/ES/FR completo

El sistema i18n soporta tres idiomas (no solo EN/ES). El objeto `TRANSLATIONS` en `i18n.js` tiene claves para los tres idiomas. Los botones de idioma en el sidebar son EN / ES / FR. Las traducciones del backend (ingredientes, pasos, título) también están en tres idiomas con columnas `_en`, `_es`, `_fr`.
