# RecipeScanner — Stage 3: Technical Documentation

Proyecto portfolio — Holberton School RNCP 5 DWWM  
Fecha de entrega: finales de junio 2025

---

## 0. User Stories and Mockups

### User Stories (MoSCoW)

#### Must Have — MVP no funciona sin esto

| ID | Story |
|---|---|
| US-01 | As a user, I want to register an account so that I can save my recipes securely. |
| US-02 | As a user, I want to log in with my email and password so that I can access my personal recipes. |
| US-03 | As a user, I want to upload a PDF of a recipe so that the system extracts ingredients and steps automatically. |
| US-04 | As a user, I want to view a list of all my saved recipes so that I can find them easily. |
| US-05 | As a user, I want to view the full detail of a recipe (ingredients, quantities, steps) so that I can follow it. |
| US-06 | As a user, I want my session to be protected with a token so that other users cannot access my data. |

#### Should Have — Importante pero no bloquea el MVP

| ID | Story |
|---|---|
| US-07 | As a user, I want to see the estimated price of each ingredient so that I can plan my grocery budget. |
| US-08 | As a user, I want to edit a recipe after it has been scanned so that I can correct extraction errors. |
| US-09 | As a user, I want to delete a recipe I no longer need. |

#### Could Have — Deseable si hay tiempo

| ID | Story |
|---|---|
| US-10 | As a user, I want to search my recipes by title so that I can find them quickly. |
| US-11 | As a user, I want to see the total estimated cost of all ingredients in a recipe. |

#### Won't Have — Fuera del alcance del MVP

| ID | Story |
|---|---|
| US-12 | As a user, I want to share recipes with other users. |
| US-13 | As a user, I want to import recipes from a URL. |
| US-14 | As a user, I want to rate and comment on recipes. |

---

### Mockups — Main Screens

**Screen 1 — Login / Register**
```
┌────────────────────────────────────┐
│          RecipeScanner             │
│                                    │
│   Email: [____________________]    │
│   Password: [________________]     │
│                                    │
│   [    Log In    ]  [ Register ]   │
└────────────────────────────────────┘
```

**Screen 2 — Dashboard (My Recipes)**
```
┌────────────────────────────────────┐
│  RecipeScanner    [Upload PDF] [⎋] │
├────────────────────────────────────┤
│  My Recipes                        │
│                                    │
│  ┌──────────┐  ┌──────────┐        │
│  │ Tarta de │  │ Paella   │        │
│  │ manzana  │  │ Valenciana│       │
│  │ 4 serv.  │  │ 6 serv.  │        │
│  └──────────┘  └──────────┘        │
└────────────────────────────────────┘
```

**Screen 3 — Recipe Detail**
```
┌────────────────────────────────────┐
│  ← Back      Tarta de Manzana      │
├────────────────────────────────────┤
│  Servings: 4  |  Prep: 45 min      │
│                                    │
│  INGREDIENTS                       │
│  • 300g flour         ~€0.45       │
│  • 200g sugar         ~€0.30       │
│  • 3 apples           ~€1.20       │
│                                    │
│  STEPS                             │
│  1. Mix flour and butter...        │
│  2. Peel and slice apples...       │
└────────────────────────────────────┘
```

**Screen 4 — PDF Upload / Scan**
```
┌────────────────────────────────────┐
│  Upload Recipe PDF                 │
├────────────────────────────────────┤
│                                    │
│     [ Drag & drop PDF here ]       │
│          or  [Browse file]         │
│                                    │
│  Selected: receta_tarta.pdf ✓      │
│                                    │
│        [ Scan Recipe ]             │
│                                    │
│  ⟳ Extracting ingredients...      │
└────────────────────────────────────┘
```

---

## 1. System Architecture

### High-Level Diagram

```mermaid
flowchart TD
    Browser["🌐 Client (Browser)"]

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

1. El usuario hace una acción en el browser (login, upload PDF, ver receta).
2. El frontend Flask renderiza el template o redirige a la API.
3. La API (Blueprint) recibe la petición, valida el JWT, y delega a la Facade.
4. La Facade orquesta la lógica: llama al Repository para datos locales y a los
   servicios externos (Groq, Open Food Facts) cuando es necesario.
5. El Repository abstrae el storage — la Facade no sabe si habla con RAM o PostgreSQL.
6. La respuesta sube por las capas hasta el browser.

---

## 2. Components, Classes, and Database Design

### Backend Components

| Componente | Archivo | Responsabilidad |
|---|---|---|
| Application Factory | `app/__init__.py` | Crea e inicializa la app Flask |
| Config | `backend/config.py` | Configuración por entornos |
| Auth Blueprint | `api/v1/auth.py` | Endpoints de registro y login |
| Recipes Blueprint | `api/v1/recipes.py` | CRUD de recetas |
| Ingredients Blueprint | `api/v1/ingredients.py` | Consulta de ingredientes y precios |
| Scan Blueprint | `api/v1/scan.py` | Subida y procesamiento de PDFs |
| Facade | `services/facade.py` | Punto de entrada único para la lógica de negocio |
| Repository (ABC) | `persistence/repository.py` | Interfaz abstracta de acceso a datos |
| InMemoryStorage | `persistence/memory_storage.py` | Implementación en RAM (fase 1) |
| DbStorage | `persistence/db_storage.py` | Implementación SQLAlchemy (fase 2) |
| JWT Helper | `utils/jwt_helper.py` | Generación y verificación de tokens |
| Security | `utils/security.py` | Hash y verificación de contraseñas |

### Domain Models (Dataclasses)

```python
User
├── id: int
├── username: str
├── email: str
├── password_hash: str
└── created_at: datetime

Recipe
├── id: int
├── user_id: int          # FK → User
├── title: str
├── description: str
├── servings: int
├── prep_time_min: int
└── created_at: datetime

Ingredient
├── id: int
├── recipe_id: int        # FK → Recipe
├── name: str
├── quantity: float
├── unit: str
└── off_product_id: str   # ID en Open Food Facts (puede ser None)

Step
├── id: int
├── recipe_id: int        # FK → Recipe
├── order_num: int
└── description: str

PdfScan
├── id: int
├── recipe_id: int        # FK → Recipe
├── filename: str
├── status: str           # 'pending' | 'processing' | 'done' | 'error'
└── scanned_at: datetime
```

### Class Diagram

```mermaid
classDiagram
    class User {
        +int id
        +String username
        +String email
        +String password_hash
        +DateTime created_at
    }

    class Recipe {
        +int id
        +int user_id
        +String title
        +String description
        +int servings
        +int prep_time_min
        +DateTime created_at
    }

    class Ingredient {
        +int id
        +int recipe_id
        +String name
        +float quantity
        +String unit
        +String off_product_id
    }

    class Step {
        +int id
        +int recipe_id
        +int order_num
        +String description
    }

    class PdfScan {
        +int id
        +int recipe_id
        +String filename
        +String status
        +DateTime scanned_at
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
        +register_user(username, email, password)
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

## 3. High-Level Sequence Diagrams

### Diagrama 1 — Registro de usuario (US-01)

```mermaid
sequenceDiagram
    participant B as Browser
    participant F as Frontend
    participant A as API /auth/register
    participant Fa as Facade
    participant R as Repository

    B->>F: POST /register (form data)
    F->>A: POST /api/v1/auth/register
    A->>Fa: register(username, email, password)
    Fa->>R: get_by_email(email)
    R-->>Fa: None (email not taken)
    Fa->>Fa: hash_password(password)
    Fa->>R: save(user)
    R-->>Fa: user
    Fa-->>A: user created
    A-->>F: 201 Created
    F-->>B: redirect → /login
```

### Diagrama 2 — Subida de PDF y extracción de receta (US-03)

```mermaid
sequenceDiagram
    participant B as Browser
    participant F as Frontend
    participant A as API /scan
    participant Fa as Facade
    participant P as PyMuPDF
    participant G as Groq API
    participant R as Repository

    B->>F: Upload PDF file
    F->>A: POST /api/v1/scan (multipart/form-data)
    A->>Fa: scan_pdf(file, user_id)
    Fa->>P: extract_text(pdf_bytes)
    P-->>Fa: raw text
    Fa->>G: chat/completions (text + prompt)
    G-->>Fa: JSON (title, ingredients, steps)
    Fa->>R: save(recipe + ingredients + steps)
    R-->>Fa: recipe
    Fa-->>A: recipe_id
    A-->>F: 201 Created {recipe_id}
    F-->>B: redirect → /recipes/{id}
```

### Diagrama 3 — Ver receta con precios (US-07)

```mermaid
sequenceDiagram
    participant B as Browser
    participant F as Frontend
    participant A as API /recipes/id
    participant Fa as Facade
    participant R as Repository
    participant O as Open Food Facts API

    B->>F: GET /recipes/1
    F->>A: GET /api/v1/recipes/1
    A->>Fa: get_recipe(id, user_id)
    Fa->>R: find_by_id(id)
    R-->>Fa: recipe + ingredients + steps
    loop for each ingredient
        Fa->>O: GET /search?q=ingredient_name
        O-->>Fa: product data + price estimate
    end
    Fa-->>A: recipe with prices
    A-->>F: 200 OK {recipe + ingredients + prices}
    F-->>B: render recipe_detail.html
```

---

## 4. External and Internal APIs

### External APIs

#### Groq API (LLaMA 3.3-70b)

- **URL base:** `https://api.groq.com/openai/v1/chat/completions`
- **Auth:** `Authorization: Bearer <GROQ_API_KEY>`
- **Por qué:** inferencia ultrarrápida con hardware LPU especializado. LLaMA 3.3-70b
  es open-source de Meta — sin dependencia de proveedor propietario. Costo mínimo
  frente a GPT-4 para el mismo caso de uso.
- **Uso en el proyecto:** se le envía el texto extraído del PDF y se le pide que
  devuelva un JSON estructurado con título, ingredientes (nombre, cantidad, unidad)
  y pasos ordenados.

**Ejemplo de request:**
```json
{
  "model": "llama-3.3-70b-versatile",
  "messages": [
    {
      "role": "user",
      "content": "Extract the recipe from this text and return JSON with: title, ingredients (name, quantity, unit), steps (order, description).\n\nText: ..."
    }
  ],
  "response_format": { "type": "json_object" }
}
```

**Ejemplo de response:**
```json
{
  "title": "Tarta de manzana",
  "ingredients": [
    { "name": "harina", "quantity": 300, "unit": "g" },
    { "name": "azúcar", "quantity": 200, "unit": "g" }
  ],
  "steps": [
    { "order": 1, "description": "Mezclar harina y mantequilla..." },
    { "order": 2, "description": "Pelar y cortar las manzanas..." }
  ]
}
```

---

#### Open Food Facts API

- **URL base:** `https://world.openfoodfacts.org/api/v2`
- **Auth:** No requiere autenticación para consultas básicas.
- **Por qué:** única base de datos de alimentos verdaderamente abierta y gratuita,
  con más de 3 millones de productos incluyendo productos europeos y franceses.
  Licencia open data compatible con proyectos educativos.
- **Uso en el proyecto:** búsqueda de productos por nombre de ingrediente para obtener
  el `off_product_id` y datos de precio estimado.

**Endpoint usado:**
```
GET https://world.openfoodfacts.org/cgi/search.pl
  ?search_terms=harina
  &search_simple=1
  &action=process
  &json=1
  &page_size=1
```

**Ejemplo de response (simplificado):**
```json
{
  "products": [
    {
      "id": "3017620422003",
      "product_name": "Harina de trigo",
      "nutriments": { "energy-kcal_100g": 340 }
    }
  ]
}
```

---

### Internal API Endpoints

Base URL: `/api/v1`  
Autenticación: `Authorization: Bearer <JWT_TOKEN>` (excepto register y login)  
Formato: JSON

#### Auth

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | `/auth/register` | Registrar nuevo usuario | No |
| POST | `/auth/login` | Login, retorna JWT | No |

**POST /auth/register**
```
Input:
{
  "username": "julian",
  "email": "julian@example.com",
  "password": "securepassword123"
}

Output 201:
{
  "message": "User created successfully",
  "user_id": 1
}

Output 400:
{ "error": "Email already registered" }
```

**POST /auth/login**
```
Input:
{ "email": "julian@example.com", "password": "securepassword123" }

Output 200:
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { "id": 1, "username": "julian", "email": "julian@example.com" }
}

Output 401:
{ "error": "Invalid credentials" }
```

---

#### Recipes

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/recipes` | Listar todas las recetas del usuario | Yes |
| POST | `/recipes` | Crear receta manualmente | Yes |
| GET | `/recipes/<id>` | Ver detalle de una receta | Yes |
| PUT | `/recipes/<id>` | Editar una receta | Yes |
| DELETE | `/recipes/<id>` | Eliminar una receta | Yes |

**GET /recipes**
```
Output 200:
[
  {
    "id": 1,
    "title": "Tarta de manzana",
    "description": "Receta clásica francesa",
    "servings": 4,
    "prep_time_min": 45,
    "created_at": "2025-05-10T14:30:00"
  }
]
```

**GET /recipes/<id>**
```
Output 200:
{
  "id": 1,
  "title": "Tarta de manzana",
  "description": "Receta clásica francesa",
  "servings": 4,
  "prep_time_min": 45,
  "ingredients": [
    { "id": 1, "name": "harina", "quantity": 300.0, "unit": "g", "price": 0.45 }
  ],
  "steps": [
    { "id": 1, "order_num": 1, "description": "Mezclar harina y mantequilla" }
  ]
}

Output 403:
{ "error": "Access denied" }

Output 404:
{ "error": "Recipe not found" }
```

---

#### Scan

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | `/scan` | Subir PDF y extraer receta | Yes |

**POST /scan**
```
Input: multipart/form-data
  file: <PDF file>

Output 201:
{
  "message": "Recipe extracted successfully",
  "recipe_id": 5
}

Output 400:
{ "error": "Invalid file type. Only PDF allowed." }

Output 422:
{ "error": "Could not extract recipe from PDF" }
```

---

#### Ingredients

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/recipes/<id>/ingredients` | Listar ingredientes con precios OFF | Yes |

**GET /recipes/<id>/ingredients**
```
Output 200:
[
  {
    "id": 1,
    "name": "harina",
    "quantity": 300.0,
    "unit": "g",
    "off_product_id": "3017620422003",
    "estimated_price": 0.45
  }
]
```

---

## 5. SCM and QA Strategies

### Source Control Management (SCM)

**Herramienta:** Git + GitHub

**Branching strategy:**
```
main
  └── develop
        ├── feature/auth
        ├── feature/models
        ├── feature/repository
        ├── feature/facade
        ├── feature/scan-pdf
        └── feature/frontend
```

| Branch | Propósito |
|---|---|
| `main` | Código listo para producción. Solo recibe merges de `develop` tras revisión. |
| `develop` | Rama de integración. Código estable pero en desarrollo activo. |
| `feature/*` | Una rama por funcionalidad. Se crea desde `develop` y se mergea a `develop`. |

**Reglas:**
- Nunca hacer commits directamente en `main`.
- Cada feature branch cubre una fase del DEVLOG (Fase 2, Fase 3, etc.).
- Commits con mensajes descriptivos: `feat: add User dataclass`, `fix: jwt expiration bug`.
- Pull Request requerido antes de mergear a `develop`.

**Convención de commits (Conventional Commits):**
```
feat:     nueva funcionalidad
fix:      corrección de bug
docs:     cambios en documentación
refactor: refactorización sin cambio de comportamiento
test:     añadir o modificar tests
chore:    tareas de mantenimiento (deps, config)
```

**.gitignore — archivos que nunca van al repositorio:**
```
venv/
.env
__pycache__/
*.db
instance/
*.pyc
.DS_Store
```

---

### Quality Assurance (QA)

**Estrategia de testing por capas:**

| Capa | Tipo de test | Herramienta | Qué verifica |
|---|---|---|---|
| Models | Unit test | `pytest` | Creación correcta de objetos, valores por defecto |
| Repository | Unit test | `pytest` | CRUD contra InMemoryStorage |
| Facade | Integration test | `pytest` | Lógica de negocio con repo en memoria |
| API endpoints | Integration test | `pytest` + `Flask test client` | Respuestas HTTP, autenticación JWT |
| PDF extraction | Manual + mock | `pytest` + PDF de prueba | Extracción correcta de texto |
| Open Food Facts | Mock | `pytest` + `unittest.mock` | Respuesta simulada de la API externa |

**Herramientas:**
- `pytest` — framework de tests para Python
- `Flask test client` — cliente HTTP integrado en Flask para testear endpoints sin levantar servidor
- `unittest.mock` — para simular respuestas de APIs externas (Groq, Open Food Facts)

**Cobertura mínima esperada:** 70% del código de `models/`, `persistence/` y `services/`.

**Pipeline de QA:**

```
1. Desarrollador escribe código en feature branch
2. Corre tests localmente: pytest backend/
3. Hace pull request a develop
4. Revisión manual del código
5. Merge a develop si tests pasan
6. Merge a main solo cuando el feature está completo y validado
```

**Tests manuales para el flujo crítico:**
- Subir un PDF de receta real → verificar extracción correcta
- Registrar usuario → login → ver recetas → precio de ingredientes
- Intentar acceder a receta de otro usuario → verificar que retorna 403

---

## 6. Technical Justifications

**Resumen:**

| Decisión | Alternativas consideradas | Por qué se eligió |
|---|---|---|
| Flask | Django, FastAPI | Control total, Jinja2 integrado, curva de aprendizaje baja |
| SQLAlchemy | SQL directo, Django ORM | Portabilidad SQLite→PostgreSQL, prevención SQL injection |
| Repository Pattern | Acceso directo a BD | Testabilidad, intercambiabilidad, bajo acoplamiento |
| In-memory first | SQLAlchemy desde el inicio | Validar lógica sin complejidad de BD, desarrollo más rápido |
| JWT | Sessions, OAuth | Stateless, escalable, estándar REST |
| bcrypt | MD5, SHA-256 | Lento por diseño, incluye salt, resistente a fuerza bruta |
| Groq + LLaMA 3.3-70b | OpenAI GPT-4 | Más rápido (LPU), open-source, menor costo |
| Open Food Facts | APIs de supermercados | Abierta, gratuita, sin acuerdo comercial, 3M+ productos |
| Jinja2 | React, Vue | Un solo servidor, tiempo de desarrollo menor, sin API desacoplada |
