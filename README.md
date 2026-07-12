# RecipeScanner

A full-stack web application that extracts recipes from PDF files using AI, saves them to a database, and estimates ingredient prices via Open Food Facts.

Built as a portfolio project for Holberton School — RNCP 5 DWWM certification.

**Live demo:**
- Frontend: https://recipes-scanner.netlify.app
- API (Swagger): https://recipe-scanner-kfnm.onrender.com/api/docs

---

## Features

- Upload a PDF recipe and extract ingredients and steps automatically using Groq API (Llama 3.3-70b-versatile)
- User authentication with JWT access + refresh tokens, bcrypt password hashing
- Save, view, edit, and delete recipes with multilingual fields (EN/ES/FR)
- Estimate ingredient prices via Open Food Facts API + custom price database
- Custom prices linked to stores and brands with 4-case priority resolution
- Accent-insensitive multilingual ingredient matching (`_norm` + translation fields)
- Secure per-user data isolation — users can only access their own data
- Static HTML + JS frontend, fully decoupled from the backend API
- Containerized with Docker (multi-stage build: dev + production with gunicorn)
- Modo oscuro completo con toggle y persistencia en localStorage
- Color personalizable por sección de ingredientes
- Gestión de marcas multi-ingrediente: cada marca puede tener varios ingredientes, con chips de selección y eliminación individual por ingrediente
- Advertencia de incompatibilidad de unidades (`unit_warning`) cuando el ingrediente está en unidades no pesables pero el precio fue guardado en €/kg

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.12, Flask 3.x, flask-restx (Swagger) |
| Authentication | Flask-JWT-Extended (access + refresh tokens) + bcrypt |
| PDF Extraction | PyMuPDF (fitz) |
| AI / NLP | Groq API — Llama 3.3-70b-versatile (vision fallback: llama-4-scout) |
| Ingredient Prices | Open Food Facts API + FALLBACK_PRICES table |
| Database | SQLite (dev) / PostgreSQL (prod) |
| ORM | SQLAlchemy 2.x (Repository Pattern) |
| Frontend | HTML + CSS + JS vanilla (static, no framework) |
| Containerization | Docker (multi-stage) + Docker Compose |
| Deploy | Render (backend) + Netlify (frontend) |
| Tests | pytest (107 tests) + Newman (204 assertions) = 311 total |

---

## Architecture

```
Browser
  │
  ├── Netlify (frontend/)
  │     HTML + CSS + JS → fetch /api/v1/*
  │
  └── Render (backend/)  ← Docker (production stage)
        Flask API (flask-restx)
          │
          ├── Facade (business logic)
          │     ├── Repository Pattern → SQLAlchemy → SQLite/PostgreSQL
          │     ├── Groq API (Qwen 3.6-27b) → PDF text → structured JSON
          │     └── Open Food Facts API → ingredient price lookup
          │
          └── Swagger UI → /api/docs
```

---

## Local Setup

### Option A — Python (venv)

```bash
git clone https://github.com/juliangf94/recipe-scanner.git
cd recipe-scanner/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Create .env with your keys (see Environment Variables below)
cp .env.example .env

python run.py
# → http://localhost:5000/api/docs
```

### Option B — Docker Compose

```bash
git clone https://github.com/juliangf94/recipe-scanner.git
cd recipe-scanner

# Add your keys to backend/.env first
docker compose up --build
# → http://localhost:5000/api/docs
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `SECRET_KEY` | Flask session signing key |
| `JWT_SECRET_KEY` | JWT token signing key |
| `GROQ_API_KEY` | API key from console.groq.com |
| `FLASK_ENV` | `development` / `production` |
| `DATABASE_URL` | PostgreSQL URL (production) — defaults to SQLite if not set |

---

## API Endpoints

Base URL: `/api/v1` — Full interactive docs at `/api/docs`

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | `/auth/register` | Register new user | No |
| POST | `/auth/login` | Login, returns JWT + refresh token | No |
| POST | `/auth/refresh` | Renew access token | Yes (refresh) |
| GET/PUT/DELETE | `/auth/me` | View / update / delete account | Yes |
| GET/POST | `/recipes` | List / create recipes | Yes |
| GET/PUT/DELETE | `/recipes/<id>` | Recipe detail / edit / delete | Yes |
| GET/POST | `/recipes/<id>/ingredients` | List / add ingredients | Yes |
| PUT/DELETE | `/recipes/<id>/ingredients/<id>` | Edit / delete ingredient | Yes |
| POST | `/scan` | Upload PDF → extract recipe via Groq | Yes |
| GET | `/recipes/<id>/cost` | Calculate recipe cost | Yes |
| GET/POST/PUT/DELETE | `/prices` | Custom price CRUD | Yes |
| GET/POST/DELETE | `/stores` | Store management | Yes |
| GET/POST/DELETE | `/brands` | Brand management | Yes |

---

## Tests

```bash
cd recipe-scanner
source backend/venv/bin/activate
pytest tests/ -v
# 107 tests — 0 failures
```

---

## Branching Strategy

| Branch | Purpose |
|---|---|
| `main` | Production-ready code. Receives merges from `develop` at sprint end. |
| `develop` | Day-to-day development. Auto-deploys to Render + Netlify. |

---

## Author

**Julian GONZALEZ**
Holberton School — RNCP 5 DWWM
GitHub: [juliangf94](https://github.com/juliangf94)
