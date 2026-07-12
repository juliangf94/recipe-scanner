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
    ├── theme.js        ← Toggle de modo oscuro — aplica `data-theme` en `<html>` y persiste en `localStorage`
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

### `tSection(sec: string): string`
Traduce nombres de secciones culinarias al idioma activo usando el diccionario estático `SECTION_MAP`.

**Por qué existe**: Los nombres de sección (masa, relleno, decoración, etc.) se guardan en la DB en el idioma original del usuario. Para mostrarlos traducidos sin modificar la DB ni llamar a una API, se usa un diccionario de ~20 términos comunes en pastelería.

**Comportamiento**:
- Busca `sec.toLowerCase().trim()` en `SECTION_MAP`.
- Si encuentra entrada, retorna `entry[lang]` para el idioma activo.
- Si no encuentra o `entry[lang]` no existe, retorna el string original sin cambios (nunca rompe el display).

**Ejemplo**:
```js
// Usuario en idioma EN, sección guardada en DB como "masa"
tSection('masa')  // → 'Dough'
tSection('masa')  // → 'Pâte' (si lang = 'fr')
tSection('relleno especial') // → 'relleno especial' (no está en diccionario)
```

**Términos incluidos**: masa, relleno, decoración, crema, glaseado, cobertura, bizcocho, base, almíbar, merengue, ganache, caramelo, salsa, masa de tarta, masa quebrada, masa hojaldrada, masa choux — con equivalentes en EN y FR.

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

---

### Warm-up ping a Render

```javascript
if (!IS_LOCAL) fetch(`${BASE_URL}/health`).catch(() => {});
```

Render (free tier) duerme el servidor después de inactividad. Esta línea dispara un request silencioso a `/health` apenas carga cualquier página — sin esperar la respuesta (`fire-and-forget`). Así el servidor ya está despierto cuando el usuario hace su primer request real. Solo se ejecuta en producción (`!IS_LOCAL`).

---

### Resolución de URLs de imágenes

```javascript
function resolveImgUrl(url) {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('//')) return url;
  return `${SERVER_URL}${url}`;
}
```

En la app hay exactamente dos tipos de imágenes: **foto de perfil del usuario** y **fotos de recetas** (portada y galería). Ambas pasan por `resolveImgUrl()` antes de ponerse en un `<img src="...">`.

Esas imágenes pueden estar en dos lugares dependiendo del entorno:
- **Supabase Storage** (producción) → URL absoluta que empieza con `https://` — se devuelve tal cual
- **Disco local del servidor** (desarrollo local, cuando Supabase no está configurado) → ruta relativa como `/static/uploads/recipes/foto.jpg` — se le agrega la URL base del servidor para construir la URL completa: `https://recipe-scanner-kfnm.onrender.com/static/uploads/recipes/foto.jpg`

Esto permite que el código del frontend sea el mismo sin importar dónde esté guardada la imagen, y si la URL del servidor cambia solo hay que actualizarla en un lugar.

---

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

---

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

---

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

---

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

---

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

---

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

---

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

---

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

---

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

#### Cierre de modales con Escape
Un único listener `keydown` en el documento cierra cualquiera de los 7 modales de la página si está abierto:
- `edit-modal` (editar receta)
- `price-modal` (precio de ingrediente)
- `step-add-modal` / `step-edit-modal` (pasos)
- `ing-modal` / `ing-edit-modal` (ingredientes)
- `confirm-delete-modal` (confirmación de eliminación)

El listener verifica `classList.contains('open')` antes de llamar a la función de cierre correspondiente, por lo que es seguro que corra aunque ningún modal esté abierto.

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

#### Cierre de modales con Escape
```js
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (document.getElementById('stores-modal').classList.contains('open')) closeStoresModal();
  if (document.getElementById('brands-modal').classList.contains('open')) closeBrandsModal();
});
```
Cierra el modal activo al presionar Escape. Complementa el cierre por click fuera del modal (click-outside) que ya existía.

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

## `frontend/js/theme.js` — Modo oscuro

**Ubicación**: `frontend/js/theme.js`  
**Cuándo se carga**: En el `<head>` de cada página HTML, de forma **síncrona** y **antes** de otros scripts. Esto es intencional: si se cargara después, el navegador pintaría la página con el tema por defecto antes de aplicar el guardado, causando un flash de tema incorrecto (FOUC — Flash of Unstyled Content).

#### Clave de `localStorage`
```
rs-theme → 'light' | 'dark'
```

#### Función `applyTheme(theme)`
Aplica el tema al documento:
1. Establece `document.documentElement.setAttribute('data-theme', theme)` — el selector `[data-theme="dark"]` en `style.css` activa todas las variables oscuras.
2. Actualiza el texto/title de todos los botones `.theme-toggle` en la página (☀ / 🌙).

#### Función `toggleTheme()` (global)
Llamada por `onclick="toggleTheme()"` en el botón `.theme-toggle` del sidebar. Lee el tema actual de `data-theme`, lo invierte, lo guarda en `localStorage` y llama a `applyTheme()`.

#### Variables CSS del modo oscuro
Definidas en `style.css` bajo `[data-theme="dark"]`:

| Variable | Valor claro | Valor oscuro |
|---|---|---|
| `--bg` | `#f8f9fa` | `#0f1117` |
| `--sidebar-bg` | `#1a1f2e` | `#161922` |
| `--card-bg` | `#ffffff` | `#1e2130` |
| `--text` | `#1a1a2e` | `#e2e8f0` |
| `--text-muted` | `#6c757d` | `#94a3b8` |
| `--border` | `#e9ecef` | `#2d3748` |

#### Inicialización
Al cargar el script, lee `localStorage.getItem('rs-theme')` y aplica el tema guardado (o `'light'` por defecto) antes de que el DOM esté completo.

---

## `frontend/css/style.css` — Ajustes de layout

#### Ajustes de layout (actualizados — Sprint 11)
- **Sidebar**: `--sidebar-width: 220px` (reducido desde 260px para dar más espacio al contenido)
- **Grid de detalle de receta**: `.detail-grid { grid-template-columns: 3fr 2fr; gap: 0.75rem }` — revertido a `3fr 2fr` para dar más espacio relativo a la columna de pasos. El gap se redujo de `1.5rem` a `0.75rem` para compactar el espacio horizontal.
- **App layout**: `.app-layout { padding: 2rem 1rem }` (antes `2rem 1.75rem`) — más espacio de contenido en pantallas medianas
- **Step item**: `.step-item { padding: 0.75rem 0.75rem; gap: 0.6rem }` (antes `1rem 1.2rem` / `1rem`) — tarjetas de paso más compactas
- **Section card header**: `.section-card-header { padding: 0.75rem 0.75rem }` (antes `0.9rem 1.2rem`) — consistencia con step-item

#### Historial de cambios en `detail-grid`
| Sprint | Valor | Motivo |
|---|---|---|
| Sprint 11 inicial | `3fr 2fr` | Valor original |
| Sprint 11 (Fase 11) | `5fr 2fr` | Más espacio a ingredientes |
| Sprint 11 (Fase 12) | `3fr 2fr` | Reequilibrio — pasos necesitan más espacio relativo |

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

---

# Sprint 11 (Fase 12) — Nuevas funciones en prices.js, recipe.js e i18n.js

---

## `frontend/js/i18n.js` — Nuevas keys (Sprint 11)

Se agregaron dos nuevas claves al objeto `TRANSLATIONS` en los tres idiomas:

### `brand_for_prefix`
Prefijo que aparece al mostrar el ingrediente asociado a una marca en la lista agrupada.

| Idioma | Valor |
|---|---|
| EN | `'for'` |
| ES | `'para'` |
| FR | `'pour'` |

Uso: `"Carrefour — for: harina, azúcar"` (EN) / `"Carrefour — para: harina, azúcar"` (ES)

### `warn_unit_mismatch`
Mensaje del tooltip que aparece cuando `unit_warning = true` en el cálculo de costos.
Indica al usuario que el ingrediente está en unidades no pesables pero el precio fue guardado
en €/kg, lo que hace que el cálculo sea orientativo.

---

## `frontend/js/prices.js` — Sistema de marcas multi-ingrediente (Sprint 11)

### Variable global `brandIngChips`

```javascript
let brandIngChips = [];
```

Acumula los ingredientes seleccionados en el modal de creación de marca antes de guardar.
Se resetea a `[]` cada vez que se abre el modal (`openBrandsModal()`).

### `addBrandIngChip()`

Lee el valor del `<input>` de ingrediente en el modal, lo agrega a `brandIngChips` si no está vacío ni duplicado, limpia el campo, y llama a `renderBrandIngChips()`.

```javascript
function addBrandIngChip() {
  const val = document.getElementById('brand-ing-input').value.trim();
  if (!val || brandIngChips.includes(val)) return;
  brandIngChips.push(val);
  document.getElementById('brand-ing-input').value = '';
  renderBrandIngChips();
}
```

### `removeBrandIngChip(val)`

Elimina un chip específico del array `brandIngChips` y re-renderiza.

```javascript
function removeBrandIngChip(val) {
  brandIngChips = brandIngChips.filter(c => c !== val);
  renderBrandIngChips();
}
```

### `renderBrandIngChips()`

Re-dibuja la lista visual de chips en el DOM del modal. Cada chip tiene un botón × que llama a `removeBrandIngChip(val)`.

```javascript
function renderBrandIngChips() {
  const container = document.getElementById('brand-ing-chips');
  container.innerHTML = brandIngChips.map(c =>
    `<span class="chip">${c} <button onclick="removeBrandIngChip('${c}')">×</button></span>`
  ).join('');
}
```

### `createBrand()` — iteración sobre chips

En lugar de crear un solo registro, `createBrand()` itera sobre `brandIngChips` y hace un `POST /brands` por cada ingrediente:

```javascript
async function createBrand() {
  const name = document.getElementById('brand-name-input').value.trim();
  if (!name || brandIngChips.length === 0) return;

  for (const ing of brandIngChips) {
    await apiFetch('/brands', {
      method: 'POST',
      body: JSON.stringify({ name, ingredient_name: ing })
    });
  }
  brandIngChips = [];
  closeBrandsModal();
  await loadBrands();
  renderBrandsList();
}
```

### `renderBrandsList()` — agrupación por nombre

Agrupa los registros de marcas por nombre y renderiza:
- Un encabezado de marca con botón "Eliminar marca" (`deleteBrandGroup`)
- La lista de ingredientes asociados, separados por comas, cada uno con su botón × (`deleteBrandEntry`)
- Un botón "+" inline para agregar nuevos ingredientes sin abrir el modal principal

```javascript
function renderBrandsList() {
  // Agrupar allBrands por nombre
  const grouped = {};
  for (const b of allBrands) {
    if (!grouped[b.name]) grouped[b.name] = [];
    grouped[b.name].push(b);
  }
  // Renderizar un bloque por nombre de marca
  container.innerHTML = Object.entries(grouped).map(([name, entries]) => `
    <div class="brand-group">
      <span class="brand-name">${name}</span>
      <span class="brand-ings">
        ${entries.map(e => `
          ${e.ingredient_name}
          <button onclick="deleteBrandEntry('${e.id}')">×</button>
        `).join(', ')}
      </span>
      <button onclick="startAddBrandIng('${entries[0].id}')">+</button>
      <button onclick="deleteBrandGroup('${name}')">Eliminar marca</button>
    </div>
  `).join('');
}
```

### `startAddBrandIng(brandId)`

Inserta una fila temporal inline en la lista para agregar un ingrediente a una marca existente.
No abre el modal principal — edición in-place.

### `saveAddBrandIng(brandName)`

Lee el valor de la fila temporal y hace `POST /brands` con `{name: brandName, ingredient_name: value}`.
Tras guardar, recarga la lista y elimina la fila temporal.

### `deleteBrandEntry(brandId)`

Elimina un único registro de marca (un ingrediente de una marca) via `DELETE /brands/<brandId>`.
No pide confirmación — la acción es pequeña e individual.

```javascript
async function deleteBrandEntry(brandId) {
  await apiFetch(`/brands/${brandId}`, { method: 'DELETE' });
  allBrands = allBrands.filter(b => b.id !== brandId);
  renderBrandsList();
}
```

### `deleteBrandGroup(brandName)`

Elimina TODOS los registros de una marca (todos los ingredientes) con confirmación previa.
Filtra `allBrands` por nombre y hace un `DELETE` por cada entrada.

```javascript
async function deleteBrandGroup(brandName) {
  if (!confirm(`¿Eliminar todos los registros de "${brandName}"?`)) return;
  const entries = allBrands.filter(b => b.name === brandName);
  for (const b of entries) {
    await apiFetch(`/brands/${b.id}`, { method: 'DELETE' });
  }
  allBrands = allBrands.filter(b => b.name !== brandName);
  renderBrandsList();
}
```

La función anterior `deleteBrand()` fue reemplazada por `deleteBrandGroup()`.

---

## `frontend/js/recipe.js` — price-clickable y unit_warning (Sprint 11)

### `renderIngRow()` — celda qty con `price-clickable`

La celda `col-qty` (que muestra cantidad y unidad del ingrediente) ahora tiene:
- Clase CSS `price-clickable` — aplica cursor pointer y underline sutil
- `onclick` que llama `openEditIngModal(ingId)` con foco directo en el campo de cantidad

```javascript
function renderIngRow(ing) {
  // ...
  const qtyCell = `
    <td class="col-qty price-clickable"
        onclick="openEditIngModal('${ing.id}', 'quantity')">
      ${ing.quantity} ${ing.unit}
    </td>`;
  // ...
}
```

El parámetro `'quantity'` le indica a `openEditIngModal()` que debe hacer `.focus()` en el
campo de cantidad cuando abre el modal — permite editar la cantidad sin navegar los campos del formulario.

**Por qué:** antes el usuario tenía que hacer click en el botón ✏️ de la fila, abrir el modal,
y luego hacer click en el campo de cantidad. Con `price-clickable`, un solo click en la
cantidad ya lo lleva directamente al campo correcto.

### `loadCost()` — campo `unit_warning` del backend

El endpoint `GET /recipes/<id>/cost` ahora incluye el campo `unit_warning: boolean` por ingrediente.

**Lógica de renderizado:**

```javascript
function renderCostRow(i) {
  const ppkgCell = i.unit_warning
    ? `<td class="col-ppkg">
         ⚠️ <span class="tooltip" title="${t('warn_unit_mismatch')}">?</span>
       </td>`
    : `<td class="col-ppkg">${i.price_per_kg ? '€' + i.price_per_kg.toFixed(2) : '—'}</td>`;

  const totalCell = i.unit_warning
    ? `<td class="col-total">?</td>`
    : `<td class="col-total">${i.cost != null ? '€' + i.cost.toFixed(2) : '—'}</td>`;

  return ppkgCell + totalCell;
}
```

**Por qué `unit_warning` en el backend y no `_PIECE_UNITS` en el frontend:**
El listado de unidades "no pesables" estaba hardcodeado en `recipe.js` como `_PIECE_UNITS`.
Moverlo al backend centraliza la lógica — si se agrega una nueva unidad, solo se modifica
`facade.py`, no el frontend. Además, el backend tiene acceso a `bought_unit` (la unidad
con que fue guardado el precio) mientras que el frontend solo conoce la unidad del ingrediente.
