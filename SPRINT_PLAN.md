# RecipeScanner — Sprint Plan

Holberton School — RNCP 5 DWWM Portfolio Project
Solo project — Julian Garcia

---

## Roles

| Role | Assigned to |
|---|---|
| Project Manager (PM) | Julian Garcia |
| Source Control Manager (SCM) | Julian Garcia |
| Quality Assurance (QA) | Julian Garcia |
| Developer | Julian Garcia |

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

## Sprint 1 — Foundation

**Goal:** Flask application running on localhost:5000 with all 5 domain models defined as Python dataclasses.

**Duration:** Week 1

| Task | File | Priority | Status |
|---|---|---|---|
| Flask app factory | `app/__init__.py` | Must Have | Done |
| Environment config | `config.py` | Must Have | Done |
| Entry point | `run.py` | Must Have | Done |
| Git setup + GitHub | `.gitignore`, `.env` | Must Have | Done |
| User model | `models/user.py` | Must Have | In Progress |
| Recipe model | `models/recipe.py` | Must Have | In Progress |
| Ingredient model | `models/ingredient.py` | Must Have | In Progress |
| Step model | `models/step.py` | Must Have | In Progress |
| PdfScan model | `models/pdf_scan.py` | Must Have | In Progress |

**Definition of Done:**
- `python run.py` starts Flask on port 5000 with no errors
- All 5 dataclasses instantiate correctly in a Python shell
- Code committed to `develop` on GitHub

---

## Sprint 2 — Data Layer + Authentication

**Goal:** Full CRUD operations working in memory and users can register and log in with JWT.

**Duration:** Week 2

| Task | File | Priority | Status |
|---|---|---|---|
| BaseRepository ABC | `persistence/repository.py` | Must Have | Pending |
| InMemoryStorage | `persistence/memory_storage.py` | Must Have | Pending |
| Password hashing | `utils/security.py` | Must Have | Pending |
| JWT generation + validation | `utils/jwt_helper.py` | Must Have | Pending |
| Auth endpoints | `api/v1/auth.py` | Must Have | Pending |
| Unit tests — models | `tests/test_models.py` | Must Have | Pending |
| Unit tests — repository | `tests/test_repository.py` | Must Have | Pending |

**Definition of Done:**
- `POST /auth/register` creates a user with hashed password
- `POST /auth/login` returns a valid JWT token
- CRUD operations on InMemoryStorage pass all unit tests
- Tests run with `pytest backend/` — no failures

---

## Sprint 3 — Business Logic + PDF Scan

**Goal:** Full recipe CRUD through the Facade and PDF scanning working with Groq API.

**Duration:** Weeks 3–4

| Task | File | Priority | Status |
|---|---|---|---|
| Facade service | `services/facade.py` | Must Have | Pending |
| Recipe endpoints | `api/v1/recipes.py` | Must Have | Pending |
| Ingredient endpoints | `api/v1/ingredients.py` | Should Have | Pending |
| PDF scan endpoint | `api/v1/scan.py` | Must Have | Pending |
| Groq integration in Facade | `services/facade.py` | Must Have | Pending |
| Integration tests — API | `tests/test_api.py` | Must Have | Pending |

**Definition of Done:**
- Authenticated user can create, read, update, delete recipes
- Uploading a real PDF returns a structured recipe (title, ingredients, steps)
- User cannot access another user's recipe (403 response verified)
- All endpoints tested with Flask test client

---

## Sprint 4 — Prices + Database

**Goal:** Ingredient prices fetched from Open Food Facts and full swap from InMemoryStorage to SQLAlchemy.

**Duration:** Week 5

| Task | File | Priority | Status |
|---|---|---|---|
| Open Food Facts integration | `services/facade.py` | Should Have | Pending |
| DbStorage with SQLAlchemy | `persistence/db_storage.py` | Must Have | Pending |
| SQLAlchemy models | `models/*.py` updated | Must Have | Pending |
| Config update for DB | `config.py` | Must Have | Pending |
| Swap InMemoryStorage → DbStorage | `app/__init__.py` | Must Have | Pending |
| Integration tests — DB | `tests/test_db.py` | Must Have | Pending |

**Definition of Done:**
- All existing tests pass after the SQLAlchemy swap
- Ingredient prices returned from Open Food Facts for each recipe
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
