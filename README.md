# RecipeScanner

A full-stack web application that extracts recipes from PDF files using AI, saves them to a database, and estimates ingredient prices via Open Food Facts.

Built as a portfolio project for Holberton School — RNCP 5 DWWM certification.

---

## Features

- Upload a PDF recipe and extract ingredients and steps automatically using Groq API (LLaMA 3.3-70b)
- User authentication with JWT tokens and bcrypt password hashing
- Save, view, edit, and delete recipes
- Estimate ingredient prices via Open Food Facts API
- Secure per-user data isolation — users can only access their own recipes

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3, Flask 3.x |
| Authentication | PyJWT + bcrypt |
| PDF Extraction | PyMuPDF |
| AI / NLP | Groq API — LLaMA 3.3-70b |
| Ingredient Prices | Open Food Facts API |
| Database | SQLite (dev) → PostgreSQL (prod) |
| ORM | SQLAlchemy 2.x |
| Frontend | Jinja2 + HTML/CSS/JS |

---

## Application Architecture

```mermaid
flowchart TD
    Browser["Client (Browser)"]

    subgraph Frontend["Frontend — Flask / Jinja2"]
        FE["Templates + Static (CSS/JS)"]
    end

    subgraph Backend["Backend — Flask API"]
        API["Blueprints /api/v1/\nauth · recipes · ingredients · scan"]
    end

    subgraph Services["Services"]
        Facade["Facade\n(business logic)"]
    end

    subgraph Persistence["Persistence — Repository Pattern"]
        Repo["BaseRepository\n(ABC interface)"]
        Mem["InMemoryStorage\n(Phase 1 — dicts)"]
        DB["DbStorage\n(Phase 2 — SQLAlchemy)"]
    end

    subgraph External["External Services"]
        Groq["Groq API\nLLaMA 3.3-70b"]
        OFF["Open Food Facts API"]
    end

    subgraph Database["Database"]
        SQLite["SQLite (dev)"]
        PG["PostgreSQL (prod)"]
    end

    Browser -->|HTTP| FE
    FE -->|HTTP /api/v1/| API
    API --> Facade
    Facade --> Repo
    Facade -->|PDF text + prompt| Groq
    Facade -->|ingredient name| OFF
    Repo --> Mem
    Repo --> DB
    DB --> SQLite
    DB --> PG
```

### Data Flow

1. User performs an action in the browser (login, upload PDF, view recipe).
2. Flask renders the template or routes the request to the API.
3. The API Blueprint receives the request, validates the JWT, and delegates to the Facade.
4. The Facade orchestrates the logic: calls the Repository for local data and external services (Groq, Open Food Facts) when needed.
5. The Repository abstracts the storage layer — the Facade does not know whether it is talking to RAM or PostgreSQL.
6. The response travels back up through the layers to the browser.

---

## Database Diagram

```mermaid
classDiagram
    class User {
        +String id
        +String email
        +String password_hash
    }

    class Recipe {
        +String id
        +String user_id
        +String title
    }

    class Ingredient {
        +String id
        +String recipe_id
        +String name
        +String quantity
        +String unit
    }

    class Step {
        +String id
        +String recipe_id
        +int order
        +String description
    }

    class PdfScan {
        +String id
        +String recipe_id
        +String filename
        +String status
    }

    class BaseRepository {
        <<abstract>>
        +get_all()*
        +get_by_id(id)*
        +save(obj)*
        +update(obj)*
        +delete(id)*
    }

    class InMemoryStorage {
        -dict _storage
        +get_all()
        +get_by_id(id)
        +save(obj)
        +update(obj)
        +delete(id)
    }

    class DbStorage {
        -Session _session
        +get_all()
        +get_by_id(id)
        +save(obj)
        +update(obj)
        +delete(id)
    }

    class Facade {
        -BaseRepository _repository
        +register_user(email, password)
        +login(email, password)
        +get_recipes(user_id)
        +get_recipe(id, user_id)
        +create_recipe(data, user_id)
        +update_recipe(id, data, user_id)
        +delete_recipe(id, user_id)
        +scan_pdf(file, user_id)
        +get_ingredient_prices(recipe_id)
    }

    User "1" --> "0..*" Recipe : owns
    Recipe "1" --> "0..*" Ingredient : contains
    Recipe "1" --> "0..*" Step : includes
    Recipe "1" --> "0..*" PdfScan : generated from

    InMemoryStorage --|> BaseRepository : implements
    DbStorage --|> BaseRepository : implements
    Facade --> BaseRepository : uses
```

---

## Project Structure

```
recipe-scanner/
├── backend/
│   ├── app/
│   │   ├── __init__.py          # Application factory (create_app)
│   │   ├── api/v1/
│   │   │   ├── auth.py          # Register + Login endpoints
│   │   │   ├── recipes.py       # Recipe CRUD endpoints
│   │   │   ├── ingredients.py   # Ingredient price endpoints
│   │   │   └── scan.py          # PDF upload + extraction endpoint
│   │   ├── models/
│   │   │   ├── user.py
│   │   │   ├── recipe.py
│   │   │   ├── ingredient.py
│   │   │   ├── step.py
│   │   │   └── pdf_scan.py
│   │   ├── persistence/
│   │   │   ├── repository.py    # BaseRepository ABC
│   │   │   └── memory_storage.py
│   │   ├── services/
│   │   │   └── facade.py        # Business logic
│   │   └── utils/
│   │       ├── jwt_helper.py
│   │       └── security.py
│   ├── config.py                # Environment-based configuration
│   ├── run.py                   # Entry point
│   └── requirements.txt
└── frontend/                    # Jinja2 templates (Phase 9)
```

---

## API Endpoints

Base URL: `/api/v1`
Authentication: `Authorization: Bearer <JWT_TOKEN>` (except register and login)

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | `/auth/register` | Register a new user | No |
| POST | `/auth/login` | Login, returns JWT token | No |
| GET | `/recipes` | List all recipes for the logged-in user | Yes |
| POST | `/recipes` | Create a recipe manually | Yes |
| GET | `/recipes/<id>` | Get full recipe detail | Yes |
| PUT | `/recipes/<id>` | Update a recipe | Yes |
| DELETE | `/recipes/<id>` | Delete a recipe | Yes |
| POST | `/scan` | Upload PDF and extract recipe via Groq | Yes |
| GET | `/recipes/<id>/ingredients` | Get ingredients with price estimates | Yes |

---

## Local Setup

**Requirements:** Python 3.8+, pip

```bash
# Clone the repository
git clone https://github.com/juliangf94/recipe-scanner.git
cd recipe-scanner/backend

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate      # Linux/Mac
venv\Scripts\activate         # Windows

# Install dependencies
pip install -r requirements.txt

# Create .env file and add your keys
cp .env.example .env

# Run the development server
python run.py
```

The server will start at `http://localhost:5000`.

---

## Environment Variables

| Variable | Description |
|---|---|
| `SECRET_KEY` | Flask session signing key |
| `JWT_SECRET_KEY` | JWT token signing key |
| `GROQ_API_KEY` | API key from console.groq.com |
| `FLASK_ENV` | `development` / `production` |
| `DATABASE_URL` | PostgreSQL URL (production only) |

---

## Branching Strategy

| Branch | Purpose |
|---|---|
| `main` | Production-ready code only. Receives merges from `develop`. |
| `develop` | Day-to-day work. One commit per completed feature or file. |
| `feature/sqlalchemy` | Temporary branch — Session 8 only. Isolated because swapping the storage layer can break existing functionality. |

---

## Author

**Julian Garcia**
Holberton School — RNCP 5 DWWM
GitHub: [juliangf94](https://github.com/juliangf94)
