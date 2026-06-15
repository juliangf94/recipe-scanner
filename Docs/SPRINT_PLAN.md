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

**Sesiones:** 1 y 2 → ver explicación detallada en `CODE_NOTES.md` (Sesión 1 · Sesión 2)

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

**Sesiones:** 3 y 4 → ver explicación detallada en `CODE_NOTES.md` (Sesión 3 · Sesión 4)

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

**Sesiones:** 5, 6, 7 y 8 → ver explicación detallada en `CODE_NOTES.md` (Sesión 5 · Sesión 6 · Sesión 7 · Sesión 8)

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

## Sprint 4 — Prices + Database 🔄 IN PROGRESS

**Goal:** Ingredient prices fetched from Open Food Facts and full swap from InMemoryStorage to SQLAlchemy.

**Sesiones:** 9 y 10 → ver explicación detallada en `CODE_NOTES.md` (Sesión 9 · Sesión 10)

**Duration:** Week 5

| Task | File | Priority | Status |
|---|---|---|---|
| Open Food Facts integration — facade | `services/facade.py` | Should Have | ✅ Done |
| Endpoint `GET /recipes/<id>/cost` | `api/v1/costs.py` | Should Have | ✅ Done |
| Modelo `CustomPrice` | `models/custom_price.py` | Should Have | ✅ Done |
| Custom Prices CRUD — facade | `services/facade.py` | Should Have | ✅ Done |
| Custom Prices endpoints (GET/POST/PUT/DELETE) | `api/v1/costs.py` | Should Have | ✅ Done |
| Registrar namespace costs | `app/__init__.py` | Should Have | ✅ Done |
| Postman — 116 tests pasando | `tests/postman/` | Should Have | ✅ Done |
| DbStorage with SQLAlchemy | `persistence/db_storage.py` | Must Have | Pending |
| SQLAlchemy models | `models/*.py` updated | Must Have | Pending |
| Config update for DB | `config.py` | Must Have | Pending |
| Swap InMemoryStorage → DbStorage | `app/__init__.py` | Must Have | Pending |
| Integration tests — DB | `tests/test_db.py` | Must Have | Pending |

**Architectural note:**
- Open Food Facts no tiene datos de precios confiables para ingredientes crudos.
  Se usa la API para identificar el producto y su categoría, y se aplica una tabla
  de precios promedio (`FALLBACK_PRICES`) como estrategia de estimación.
- El endpoint de costos va en un archivo separado `api/v1/costs.py` para mantener
  la separación de responsabilidades.
- SQLAlchemy se desarrolla en rama `feature/sqlalchemy` (Sesión 10).

**Definition of Done:**
- `GET /api/v1/recipes/<id>/cost` devuelve precio estimado por ingrediente + total
- Precio se calcula con Open Food Facts + tabla de fallback
- Todos los tests de Postman existentes siguen pasando
- Data persists after server restart (SQLite dev database)
- Branch `feature/sqlalchemy` merged into `develop`

---

## Sprint 5 — Frontend

**Goal:** Functional Jinja2 frontend covering all user stories.

**Duration:** Week 6

| Task | File | Priority | Status |
|---|---|---|---|
| Base template + layout | `templates/base.html` | Must Have | Pending |
| Login + register pages | `templates/auth/` | Must Have | Pending |
| Recipe list (dashboard) | `templates/recipes/list.html` | Must Have | Pending |
| Recipe detail page | `templates/recipes/detail.html` | Must Have | Pending |
| PDF upload page | `templates/scan/upload.html` | Must Have | Pending |
| Static CSS | `static/css/style.css` | Must Have | Pending |
| End-to-end manual test | Full user flow | Must Have | Pending |
| Deploy to production | Render / Railway | Should Have | Pending |

**Definition of Done:**
- Full user flow works in the browser: register → login → upload PDF → view recipe with prices
- Application deployed and accessible via public URL
- README updated with production URL
- Final merge `develop` → `main`

---

## Metrics

| Metric | Target |
|---|---|
| Test coverage | 70%+ on models, persistence, services |
| Bugs at sprint end | 0 critical, under 3 minor |
| Commits per sprint | Minimum 5 meaningful commits |
| Branches | All work on `develop`, swap isolated to `feature/sqlalchemy` |

---

## QA Test Plan Summary

| Layer | Type | Tool |
|---|---|---|
| Models | Unit test | pytest |
| Repository | Unit test | pytest |
| Facade | Integration test | pytest |
| API endpoints | Integration test | pytest + Flask test client |
| External APIs | Mock | pytest + unittest.mock |
| Full user flow | Manual | Browser |
