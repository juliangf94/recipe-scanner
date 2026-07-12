# RecipeScanner — Sprint Plan

Holberton School — RNCP 5 DWWM Portfolio Project
Solo project — Julian Gonzalez

---

## Roles

| Role | Assigned to |
|---|---|
| Project Manager (PM) | Julian Gonzalez |
| Source Control Manager (SCM) | Julian Gonzalez |
| Quality Assurance (QA) | Julian Gonzalez |
| Developer | Julian Gonzalez |

---

## MoSCoW Prioritization

| Priority | Feature |
|---|---|
| Must Have | User registration and login (JWT) |
| Must Have | PDF upload and AI extraction (Groq) |
| Must Have | Save and view recipes (CRUD) |
| Must Have | Per-user data isolation (JWT auth on all routes) |
| Should Have | Ingredient price estimates (Open Food Facts) |
| Should Have | Edit and delete recipes |
| Could Have | Recipe search by title |
| Could Have | Total cost calculation per recipe |
| Could Have | Modo oscuro completo ✅ |
| Could Have | Color por sección de ingredientes ✅ |
| Won't Have | Recipe sharing between users |
| Won't Have | Import recipes from URL |
| Won't Have | Ratings and comments |

---

## Sprint Overview

| Sprint | Duration | Sessions | Goal |
|---|---|---|---|
| Sprint 1 | Week 1 | 1–2 | Flask running + 5 domain models defined |
| Sprint 2 | Week 2 | 3–4 | Repository CRUD in memory + JWT auth |
| Sprint 3 | Week 3–4 | 5–6 | Facade + recipe API + PDF scan with Groq |
| Sprint 4 | Week 5 | 7–8 | Ingredient prices + SQLAlchemy swap |
| Sprint 5 | Week 6 | 9 | Jinja2 frontend — full MVP functional |

---

## Sprint 1 — Foundation ✅ COMPLETE

**Goal:** Flask application running on localhost:5000 with all 5 domain models defined as Python dataclasses.

**Sesiones:** 1 y 2 → ver explicación detallada en `CODE_NOTES_BACK.md` (Sesión 1 · Sesión 2)

**Duration:** Week 1

| Task | File | Priority | Status |
|---|---|---|---|
| Flask app factory | `app/__init__.py` | Must Have | Done |
| Environment config | `config.py` | Must Have | Done |
| Entry point | `run.py` | Must Have | Done |
| Git setup + GitHub | `.gitignore`, `.env` | Must Have | Done |
| User model | `models/user.py` | Must Have | Done |
| Recipe model | `models/recipe.py` | Must Have | Done |
| Ingredient model | `models/ingredient.py` | Must Have | Done |
| Step model | `models/step.py` | Must Have | Done |
| PdfScan model | `models/pdf_scan.py` | Must Have | Done |

**Definition of Done:**
- `python run.py` starts Flask on port 5000 with no errors
- All 5 dataclasses instantiate correctly in a Python shell
- Code committed to `develop` on GitHub

---

## Sprint 2 — Data Layer + Authentication ✅ COMPLETE (except unit tests)

**Goal:** Full CRUD operations working in memory and users can register and log in with JWT.

**Sesiones:** 3 y 4 → ver explicación detallada en `CODE_NOTES_BACK.md` (Sesión 3 · Sesión 4)

**Duration:** Week 2

| Task | File | Priority | Status |
|---|---|---|---|
| BaseRepository ABC + InMemoryStorage | `persistence/repository.py` | Must Have | Done |
| Password hashing | `utils/security.py` | Must Have | Done |
| ~~JWT helper manual~~ → flask_jwt_extended | ~~`utils/jwt_helper.py`~~ | Must Have | Removed |
| Auth endpoints (flask_restx Namespace) | `api/v1/auth.py` | Must Have | Done |
| Postman collection | `tests/postman/` | Must Have | Done |
| Unit tests — models | `tests/test_models.py` | Must Have | Pending |
| Unit tests — repository | `tests/test_repository.py` | Must Have | Pending |

**Architectural changes from original plan:**
- `InMemoryStorage` vive en `repository.py` (mismo archivo que `BaseRepository`) — no en `memory_storage.py`
- `jwt_helper.py` eliminado — `flask_jwt_extended` provee `@jwt_required()`, `create_access_token` y `get_jwt_identity()` directamente
- `auth.py` usa `flask_restx` (Namespace + Resource) en lugar de Blueprint puro — genera Swagger automático en `/api/docs`
- `flask-restx==1.3.0` y `Flask-JWT-Extended==4.6.0` agregados a `requirements.txt`

**Definition of Done:**
- `POST /api/v1/auth/register` creates a user with hashed password
- `POST /api/v1/auth/login` returns a valid JWT token
- CRUD operations on InMemoryStorage pass all unit tests
- Tests run with `pytest backend/` — no failures

---

## Sprint 3 — Business Logic + PDF Scan ✅ COMPLETE

**Goal:** Full recipe CRUD through the Facade and PDF scanning working with Groq API.

**Sesiones:** 5, 6, 7 y 8 → ver explicación detallada en `CODE_NOTES_BACK.md` (Sesión 5 · Sesión 6 · Sesión 7 · Sesión 8)

**Duration:** Weeks 3–4

| Task | File | Priority | Status |
|---|---|---|---|
| Facade service | `services/facade.py` | Must Have | Done |
| Recipe endpoints | `api/v1/recipes.py` | Must Have | Done |
| Ingredient endpoints | `api/v1/ingredients.py` | Should Have | Done |
| PDF scan endpoint | `api/v1/scan.py` | Must Have | Done |
| Groq integration in Facade | `services/facade.py` | Must Have | Done |
| Register all namespaces | `app/__init__.py` | Must Have | Done |
| CRUD completo en auth (GET/PUT/DELETE /me) | `api/v1/auth.py` | Must Have | Done |
| Ownership check en recetas (403) | `api/v1/recipes.py` | Must Have | Done |
| Validación automática con validate=True | todos los endpoints | Must Have | Done |
| Colección Postman — 89 assertions | `tests/postman/` | Must Have | Done |

**Definition of Done:**
- Authenticated user can create, read, update, delete recipes
- Uploading a real PDF returns a structured recipe (title, ingredients, steps)
- User cannot access another user's recipe (403 response verified)
- All endpoints tested with Flask test client

---

## Sprint 4 — Prices + Database ✅ COMPLETE

**Goal:** Ingredient prices fetched from Open Food Facts and full swap from InMemoryStorage to SQLAlchemy.

**Sesiones:** 9 y 10 → ver explicación detallada en `CODE_NOTES_BACK.md` (Sesión 9 · Sesión 10)

**Duration:** Week 5

| Task | File | Priority | Status |
|---|---|---|---|
| Open Food Facts integration — facade | `services/facade.py` | Should Have | ✅ Done |
| Endpoint `GET /recipes/<id>/cost` | `api/v1/costs.py` | Should Have | ✅ Done |
| Modelo `CustomPrice` | `models/custom_price.py` | Should Have | ✅ Done |
| Custom Prices CRUD — facade | `services/facade.py` | Should Have | ✅ Done |
| Custom Prices endpoints (GET/POST/PUT/DELETE) | `api/v1/costs.py` | Should Have | ✅ Done |
| Registrar namespace costs | `app/__init__.py` | Should Have | ✅ Done |
| `extensions.py` para evitar imports circulares | `app/extensions.py` | Must Have | ✅ Done |
| `DbStorage` con SQLAlchemy | `persistence/db_storage.py` | Must Have | ✅ Done |
| Modelos migrados a `db.Model` | `models/*.py` | Must Have | ✅ Done |
| Config con path absoluto SQLite | `config.py` | Must Have | ✅ Done |
| Swap InMemoryStorage → DbStorage en facade | `services/facade.py` | Must Have | ✅ Done |
| `db.init_app` + `db.create_all` en factory | `app/__init__.py` | Must Have | ✅ Done |
| Fix de seguridad: ownership check en ingredientes | `api/v1/ingredients.py` | Must Have | ✅ Done |
| Postman — 144 assertions, 82 requests pasando | `tests/postman/` | Must Have | ✅ Done |
| Branch `feature/sqlalchemy` mergeada a `develop` | git | Must Have | ✅ Done |

**Architectural note:**
- Open Food Facts no tiene datos de precios confiables para ingredientes crudos.
  Se usa la API para identificar el producto y su categoría, y se aplica una tabla
  de precios promedio (`FALLBACK_PRICES`) como estrategia de estimación.
- El endpoint de costos va en un archivo separado `api/v1/costs.py` para mantener
  la separación de responsabilidades.
- SQLAlchemy se desarrolló en rama `feature/sqlalchemy` (Sesión 10) y se mergeó a `develop`.
- Se descubrió y corrigió un bug de seguridad: `ingredients.py` POST/PUT/DELETE no verificaba
  ownership de la receta — cualquier usuario autenticado podía modificar ingredientes ajenos.

**Definition of Done:**
- ✅ `GET /api/v1/recipes/<id>/cost` devuelve precio estimado por ingrediente + total
- ✅ Precio se calcula con Open Food Facts + tabla de fallback + precios custom por usuario
- ✅ Todos los tests de Postman pasan (144 assertions, 0 failures)
- ✅ Datos persisten tras restart del servidor (SQLite — 6 tablas creadas)
- ✅ Branch `feature/sqlalchemy` mergeada a `develop` y pusheada a GitHub

---

## Sprint 5 — Frontend ✅ COMPLETE

**Goal:** Functional frontend covering all user stories.

**Architectural decision:** Jinja2 descartado en favor de frontend estático HTML + JS puro.
Justificación completa en `CODE_NOTES_FRONT.md` (Decisión Arquitectural — Sesión 11).

**Sesiones:** 11 y 12 → ver explicación detallada en `CODE_NOTES_FRONT.md`

**Duration:** Weeks 6–7

| Task | File | Priority | Status |
|---|---|---|---|
| Decisión arquitectural: HTML estático vs Jinja2 | `CODE_NOTES_FRONT.md` | Must Have | ✅ Done |
| Login page | `frontend/index.html` + `js/auth.js` | Must Have | ✅ Done |
| Register page | `frontend/register.html` | Must Have | ✅ Done |
| Dashboard (recipe list + search) | `frontend/dashboard.html` + `js/dashboard.js` | Must Have | ✅ Done |
| Recipe detail (ingredientes, costos, secciones) | `frontend/recipe.html` + `js/recipe.js` | Must Have | ✅ Done |
| PDF scan page | `frontend/scan.html` + `js/scan.js` | Must Have | ✅ Done |
| My Prices — custom prices CRUD | `frontend/prices.html` + `js/prices.js` | Should Have | ✅ Done |
| Stores y Brands como entidades gestionadas | `api/v1/stores.py`, `api/v1/brands.py` | Should Have | ✅ Done |
| i18n EN/ES/FR | `frontend/js/i18n.js` | Could Have | ✅ Done |
| Centralización HTTP + JWT | `frontend/js/api.js` | Must Have | ✅ Done |
| Store + Brand por ingrediente en receta | `js/recipe.js` | Should Have | ✅ Done |
| Resolución de precio 4 casos | `services/facade.py` | Should Have | ✅ Done |
| Fuzzy matching de nombres de ingredientes | `services/facade.py` | Should Have | ✅ Done |
| Avatar + imagen de receta | `api/v1/auth.py`, `api/v1/recipes.py` | Could Have | ✅ Done |
| CSS responsive — dark/light mode | `frontend/css/style.css` | Must Have | ✅ Done |
| Fix seguridad: ownership check en GET recipe | `api/v1/recipes.py` | Must Have | ✅ Done |
| Tests — models, repository, API (66 tests) | `tests/` | Must Have | ✅ Done |
| End-to-end manual test | Full user flow en navegador | Must Have | ✅ Done |
| Deploy to production | Render / Railway | Should Have | Pending |

**Architectural notes:**
- Jinja2 descartado: el frontend estático consume la API REST igual que lo haría una app móvil futura.
  Esta decisión mantiene el backend como API pura y el frontend desacoplado.
- `Store` y `Brand` son entidades gestionadas (no campos de texto libre) para evitar errores de ortografía
  y permitir filtrado/ordenamiento consistente.
- La resolución de precio sigue 4 casos en orden de preferencia:
  `store+brand > store > brand > más barato global`
- Fuzzy matching: exact → word-prefix (con padding de espacio) → singular/plural en español.
- Se descubrió y corrigió bug de seguridad: `GET /recipes/<id>` no verificaba ownership —
  cualquier usuario autenticado podía leer recetas ajenas conociendo el ID.

**Definition of Done:**
- ✅ Full user flow funciona en el navegador: register → login → scan PDF → ver receta con precios
- ✅ Precios custom con stores y brands funcionan end-to-end
- ✅ 100 tests pasan: `pytest tests/` — 0 failures (66 API + 34 models/repository)
- ✅ Todo commiteado en `develop`
- ⏳ Deploy a producción (Render/Railway) — pendiente para Sprint 6
- ⏳ Merge `develop` → `main` — pendiente tras deploy

---

## Sprint 6 — Hardening + Model Migration ✅ COMPLETE

**Goal:** Strengthen the codebase: expand test suite, migrate AI model, add multilingual price matching, and secure GitHub uploads.

**Decisiones técnicas:** ver `DEVLOG.md` → sección *"Decisiones técnicas documentadas"* (Decisiones 12–16: fuzzy matching, `_norm`, resolución de precio 4 casos, multilingüe, modelo Qwen)

**Duration:** Week 9

| Task | Priority | Status |
|---|---|---|
| Migrate Groq model: `llama-3.3-70b-versatile` → `qwen/qwen3.6-27b` | Must Have | ✅ Done |
| Multilingual price matching (`_norm` + Option A translation candidates) | Should Have | ✅ Done |
| Expand pytest suite: 38 → 66 tests (edge cases, 403/404/400, costs) | Must Have | ✅ Done |
| Expand Postman: 101 → 109 requests, 186 → 331 assertions | Should Have | ✅ Done |
| Fix user-uploaded images leaking to GitHub (.gitignore + .gitkeep) | Must Have | ✅ Done |
| Push corrected commits to `develop` on GitHub | Must Have | ✅ Done |
| Update all Docs to reflect current project state | Should Have | ✅ Done |

**Sprint 6 notes:**
- Groq deprecated `llama-3.3-70b-versatile`; migrated to `qwen/qwen3.6-27b` (Qwen 3.6 27B by Alibaba, free tier).
- `_norm()` strips Unicode diacritics so "azúcar" == "azucar" in all CustomPrice comparisons.
- Option A: `_resolve_price()` tries `name_en`, `name_es`, `name_fr` as additional search candidates,
  so a French AI response ("sucre en poudre") can match a Spanish stored price ("azucar").
- `TestCosts` class added: 5 tests covering auth, 403, manual price override, and cost endpoint structure.

---

## Sprint 7 — Deploy ✅ COMPLETE

**Goal:** Deploy backend y frontend a producción con Docker.

**Decisiones técnicas:** ver `DEPLOY.md` (arquitectura completa Render + Netlify + Docker) y `DEVLOG.md` → sección *"Decisiones técnicas — Sprint 5 (Frontend)"* (Decisión 9: HTML estático vs Jinja2)

**Duration:** Week 10

| Task | Priority | Status |
|---|---|---|
| Dockerfile multi-stage (dev + production) | Must Have | ✅ Done |
| docker-compose.yml para desarrollo local | Should Have | ✅ Done |
| Deploy backend en Render (Docker, free tier) | Must Have | ✅ Done |
| Variables de entorno de producción configuradas | Must Have | ✅ Done |
| Fix `pkg_resources==0.0.0` en requirements.txt | Must Have | ✅ Done |
| Fix `DATABASE_URL` fallback a SQLite en ProductionConfig | Must Have | ✅ Done |
| Deploy frontend en Netlify (estático, free tier) | Must Have | ✅ Done |
| `api.js` detección automática de entorno (localhost vs producción) | Must Have | ✅ Done |
| README actualizado con URLs de producción | Should Have | ✅ Done |
| Documentación de deploy en `Docs/DEPLOY.md` | Should Have | ✅ Done |

**URLs de producción:**
- Frontend: https://recipes-scanner.netlify.app
- API: https://recipe-scanner-kfnm.onrender.com/api/docs

**Definition of Done:**
- ✅ Frontend carga en Netlify y se puede registrar/login
- ✅ Backend responde en Render con todos los endpoints
- ✅ Auto-deploy activo: push a `develop` → redeploy automático en ambos servicios

**Próximo paso — Sprint 8:**
- Migrar base de datos a Supabase (PostgreSQL gratuito permanente) para persistencia real
- Merge `develop` → `main`

---

## Sprint 8 — Base de datos persistente ✅ COMPLETE

**Goal:** Reemplazar SQLite en producción por PostgreSQL con Supabase para persistencia real de datos.
Adicionalmente: Supabase Storage para fotos persistentes de recetas y avatares.

**Decisiones técnicas:** ver `DEVLOG.md` → sección *"Decisiones técnicas — Sprint 8-9 (Supabase + UX)"* y `DEPLOY.md` → sección *"Supabase"*

**Duration:** Week 11

| Task | Priority | Status |
|---|---|---|
| Crear proyecto en Supabase (EU West) | Must Have | ✅ Done |
| Configurar `DATABASE_URL` en Render con URL de Supabase PostgreSQL | Must Have | ✅ Done |
| Verificar que los datos persisten tras reinicio del contenedor | Must Have | ✅ Done |
| `app/storage.py` — wrapper Supabase Storage (upload/delete/public_url) | Should Have | ✅ Done |
| Avatar upload endpoint `POST /api/v1/auth/me/avatar` | Should Have | ✅ Done |
| Recipe images: `POST /api/v1/recipes/<id>/images`, `DELETE /api/v1/recipes/<id>/images/<idx>` | Should Have | ✅ Done |
| `resolveImgUrl()` en frontend — URL Supabase absoluta vs relativa local | Should Have | ✅ Done |
| `__init__.py` safe `ALTER TABLE` para columnas nuevas (idempotente) | Must Have | ✅ Done |
| Merge `develop` → `main` | Should Have | Pending |

**Architectural notes:**
- Supabase Storage bucket `recipes` para fotos de recetas y `avatars` para fotos de perfil.
- `storage.py` tiene fallback automático al filesystem local si Supabase no responde.
- `Recipe.images_json` almacena un array JSON de URLs de imágenes (soporta múltiples fotos por receta).
- Las `ALTER TABLE` en `__init__.py` son idempotentes — usan `try/except` con `rollback()` para no fallar si la columna ya existe.

---

## Sprint 9 — UX mejorada + Traducciones ✅ COMPLETE

**Goal:** Mejorar la experiencia de usuario con la tabla de precios inline y mejorar las traducciones automáticas.

**Decisiones técnicas:** ver `DEVLOG.md` → sección *"Decisiones técnicas — Sprint 8-9 (Supabase + UX)"*

**Duration:** Week 12

| Task | Priority | Status |
|---|---|---|
| Tabla de precios editable inline (Excel-style) — reemplaza modales add/edit | Should Have | ✅ Done |
| `handleRowFocusOut()` — guardado automático al salir de la fila | Should Have | ✅ Done |
| Fila "new" al pie de la tabla para crear precios sin modal | Should Have | ✅ Done |
| `updateCalc()` — recálculo de €/kg en tiempo real con cada tecla | Should Have | ✅ Done |
| Traducción MyMemory como fallback de DeepL (paralelo con `ThreadPoolExecutor`) | Must Have | ✅ Done |
| Detección de idioma fuente con `langdetect` (fallback si DeepL no disponible) | Should Have | ✅ Done |
| Traducciones EN/ES/FR de pasos de receta (no solo ingredientes) | Must Have | ✅ Done |
| `dismissScanSuccess()` — botón X para cerrar el mensaje de scan exitoso | Could Have | ✅ Done |
| Prevención de duplicados en scan — modal de confirmación para recetas duplicadas | Should Have | ✅ Done |
| Cook log: `POST /recipes/<id>/cook` registra cocinada, conteo semanal en home | Could Have | ✅ Done |
| Home page (`home.html`) con resumen semanal de cocina | Could Have | ✅ Done |
| Múltiples fotos de receta — galería con imagen activa clickeable | Should Have | ✅ Done |
| i18n `th_unit` agregado (columna Unidad en tabla de precios) | Could Have | ✅ Done |

---

## Metrics

| Metric | Target | Actual |
|---|---|---|
| Test coverage | 70%+ on models, persistence, services | 132 tests pytest + 204 Newman assertions = 336 total ✅ |
| Bugs at sprint end | 0 critical, under 3 minor | 0 critical ✅ |
| Commits per sprint | Minimum 5 meaningful commits | ✅ |
| Branches | All work on `develop`, swap isolated to `feature/sqlalchemy` | ✅ |

---

## QA Test Plan Summary

| Layer | Type | Tool |
|---|---|---|
| Models | Unit test | pytest |
| Repository | Unit test | pytest |
| Facade | Integration test | pytest — `TestGetBrandByNameAndIngredient` (12 tests) |
| API endpoints | Integration test | pytest + Flask test client — `TestBrandsMultiIngredient` (7), `TestUnitWarning` (6) |
| External APIs | Mock | pytest + unittest.mock |
| Full user flow | Manual | Browser |

**Archivos de test:**
- `tests/test_api.py` — 79 tests (API endpoints + autenticación + costos + brands multi-ingrediente + unit_warning)
- `tests/test_facade.py` — 12 tests (unit tests directos de facade, especialmente `get_brand_by_name_and_ingredient`)
- `tests/test_models.py` — modelos SQLAlchemy
- `tests/test_repository.py` — InMemoryStorage CRUD
- `tests/postman/` — colección Newman, 204 assertions contra servidor en vivo

---

## Sprint 10 — UX avanzada + Correcciones técnicas

**Objetivo**: Corregir bugs críticos y agregar features de UX completadas fuera del plan original.

| # | Tarea | Prioridad | Estado |
|---|---|---|---|
| 1 | Background threading para `_translate_recipe` en `scan_pdf` | Alta | ✅ Done |
| 2 | Fix cálculo de costo: `qty / 1000` para unidades g/ml antes de `× price_per_kg` | Alta | ✅ Done |
| 3 | `section_meta TEXT` en Recipe + `set_section_color()` en facade + endpoint `PATCH /recipes/<id>/sections/<name>/color` + `<input type="color">` en frontend | Media | ✅ Done |
| 4 | Modo oscuro: `theme.js` + variables CSS `--bg/--card-bg/--text/--border` + toggle en sidebar + persistencia en `localStorage` clave `rs-theme` | Media | ✅ Done |
| 5 | Layout: sidebar `260px → 220px`, grid receta `3fr 2fr → 5fr 2fr` | Baja | ✅ Done |
| 6 | Escape para cerrar modales (`prices.js` y `recipe.js`) | Baja | ✅ Done |
| 7 | Fix dialecto en traducción: copiar texto fuente directamente sin enviar a DeepL | Alta | ✅ Done |
| 8 | `SECTION_MAP` + `tSection()` en `i18n.js` — traduce nombres de sección en tiempo real | Baja | ✅ Done |

**Resultado**: Todos los items completados. App estable y lista para presentación.

---

## Sprint 11 — Marcas multi-ingrediente + unit_warning + ajustes CSS

**Objetivo**: Mejorar la gestión de marcas (multi-ingrediente), agregar advertencia de unidades incompatibles, y refinar el layout visual.

| # | Tarea | Prioridad | Estado |
|---|---|---|---|
| 1 | `brandIngChips = []` + chip system en modal de marcas (`prices.js`) | Alta | ✅ Done |
| 2 | `createBrand()` itera chips y hace POST por ingrediente | Alta | ✅ Done |
| 3 | `renderBrandsList()` agrupa por nombre, lista ingredientes con × individual | Alta | ✅ Done |
| 4 | `startAddBrandIng` + `saveAddBrandIng` — agrega ingrediente inline a marca existente | Media | ✅ Done |
| 5 | `deleteBrandEntry` (un registro) + `deleteBrandGroup` (todos los de una marca) | Media | ✅ Done |
| 6 | `_resolve_price()` retorna 4 valores: `(price_per_kg, source, store_id, bought_unit)` | Alta | ✅ Done |
| 7 | `get_recipe_cost()` detecta `unit_warning` y lo agrega a cada item del resultado | Alta | ✅ Done |
| 8 | `renderIngRow()`: celda qty con `price-clickable` + onclick a `openEditIngModal()` | Media | ✅ Done |
| 9 | `loadCost()`: usa `i.unit_warning` del backend — elimina `_PIECE_UNITS` hardcodeado | Media | ✅ Done |
| 10 | Cuando `unit_warning = true`: ⚠️ en €/kg y `?` en TOTAL | Media | ✅ Done |
| 11 | `get_brand_by_name_and_ingredient()` en facade — deduplicación por (nombre, ingrediente) | Alta | ✅ Done |
| 12 | `POST /brands` usa nueva deduplicación — permite misma marca con distintos ingredientes | Alta | ✅ Done |
| 13 | i18n: keys `brand_for_prefix` y `warn_unit_mismatch` en EN/ES/FR | Baja | ✅ Done |
| 14 | CSS: `detail-grid` `5fr 2fr` → `3fr 2fr`, gap `1.5rem` → `0.75rem`, padding de `app-layout`, `step-item`, `section-card-header` | Baja | ✅ Done |
| 15 | `_G` y `_KG` sets movidos fuera del loop en facade (optimización) | Baja | ✅ Done |

**Resultado**: Marcas con soporte multi-ingrediente, advertencia de unidades incompatibles en costos, y layout más compacto.
