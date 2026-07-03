# RecipeScanner — Diario de desarrollo

Proyecto portfolio para Holberton School — RNCP 5 DWWM  
Fecha de entrega: finales de junio 2026

---

## Stack técnico

| Capa | Tecnología | Justificación |
|---|---|---|
| Backend framework | Flask 3.x | Microframework Python: simple, explícito, ideal para APIs REST |
| ORM | SQLAlchemy 2.x | Abstracción de SQL, soporta SQLite y PostgreSQL sin cambiar código |
| Autenticación | flask_jwt_extended + bcrypt | JWT = stateless (sin sesiones en servidor); bcrypt = hash lento por diseño |
| PDF parsing | PyMuPDF | Binding C de MuPDF, muy rápido para extraer texto |
| IA | Groq API (Qwen 3.6-27b) | Inferencia ultrarrápida, modelo open-source potente |
| API externa | Open Food Facts | Base de datos de alimentos abierta y gratuita |
| BDD desarrollo | SQLite | Sin servidor, archivo local, ideal para desarrollo |
| BDD producción | PostgreSQL | Robusto, concurrente, estándar en producción |
| API docs | flask_restx (Swagger UI) | Documentación automática en `/api/docs`, preparado para app móvil |
| Frontend | HTML + JS estático | Sin build step, sin framework reactivo — justificado en Decisión 18; la misma API sirve a cualquier cliente futuro |
| Tests unitarios / integración | pytest + pytest-flask | Test client Flask con SQLite en memoria — 100 tests, 0 failures |
| Tests end-to-end | Newman + Postman | 331 assertions contra el servidor en vivo — 109 requests, 0 failures |
| Variables de entorno | python-dotenv | Carga `.env` en desarrollo; en producción las claves van directo al servidor |
| Containerización | Docker (multi-stage) | Stage dev con hot reload, stage production con gunicorn + usuario no-root |
| Deploy backend | Render (Docker) | Free tier, auto-deploy desde GitHub, soporte Docker nativo |
| Deploy frontend | Netlify | Free tier, deploy de estáticos desde GitHub, auto-deploy |

### Justificación detallada de cada tecnología

**Flask 3.x — Backend framework**
Elegimos Flask sobre Django y FastAPI porque es un microframework que nos da control
total sobre cada decisión técnica. Django hace demasiado automáticamente — para el
RNCP necesitamos poder explicar cada componente. FastAPI es excelente pero está
orientado a APIs puras sin frontend integrado. Flask nos permite construir tanto la
API REST como el frontend con Jinja2 desde el mismo proyecto, con una curva de
aprendizaje apropiada para el tiempo disponible.

**SQLAlchemy 2.x — ORM**
Elegimos SQLAlchemy en lugar de escribir SQL directo porque nos permite cambiar de
SQLite en desarrollo a PostgreSQL en producción modificando solo una línea en
`config.py`. Los modelos son clases Python legibles y mantenibles. Además usa
consultas parametrizadas por defecto, lo que previene inyección SQL automáticamente.
Es el ORM más usado en el ecosistema Python fuera de Django.

**flask_jwt_extended + bcrypt — Autenticación**
Son dos herramientas con roles distintos pero complementarios. `flask_jwt_extended`
maneja la autenticación stateless — el servidor no guarda sesiones, el token contiene
el `user_id` firmado con `JWT_SECRET_KEY`. Provee `@jwt_required()`,
`create_access_token()` y `get_jwt_identity()` listos para usar, sin necesidad de
escribir la lógica de encode/decode manualmente (que era el enfoque PyJWT directo,
descartado por ser más código sin beneficio real). bcrypt maneja el almacenamiento
seguro de contraseñas — es lento por diseño, lo que hace que los ataques de fuerza
bruta sean computacionalmente muy costosos. Incluye un salt aleatorio que previene
ataques con tablas precomputadas.

**PyMuPDF — PDF parsing**
Es un binding Python de la librería C MuPDF, lo que lo hace significativamente más
rápido que alternativas puras en Python como PyPDF2 o pdfplumber. Para un proyecto
que procesa PDFs subidos por usuarios, la velocidad de extracción de texto es crítica.
Además maneja correctamente PDFs complejos con múltiples formatos de encoding.

**Groq API con Qwen 3.6-27b — IA**
Elegimos Groq sobre OpenAI por dos razones principales. Primero, Groq ofrece
inferencia ultrarrápida gracias a su hardware especializado LPU — los tiempos de
respuesta son notablemente menores que OpenAI para el mismo modelo. Segundo,
el proyecto comenzó con LLaMA 3.3-70b (Meta, open-source) y migró a Qwen 3.6-27b
(Alibaba, open-source) en julio 2026 cuando Groq deprecó LLaMA 3.3. Ambos modelos
son open-source — sin dependencia de un proveedor propietario. Para nuestro caso
de uso — extraer ingredientes, cantidades y pasos de un texto de receta — Qwen 3.6-27b
es más que suficiente y el costo es mínimo comparado con GPT-4.

**Open Food Facts — API externa**
Es la única base de datos de productos alimenticios verdaderamente abierta y gratuita,
con más de 3 millones de productos incluyendo productos franceses y europeos. Las APIs
de supermercados como Carrefour o Leclerc son cerradas o requieren acuerdos comerciales.
Open Food Facts no requiere autenticación para consultas básicas, tiene documentación
clara, y su licencia open data nos permite usarla libremente en un proyecto educativo.

**SQLite en desarrollo / PostgreSQL en producción — Base de datos**
SQLite no requiere instalar ningún servidor — la base de datos es un archivo local.
Esto acelera enormemente el setup inicial y el desarrollo. El tradeoff es que no
soporta accesos concurrentes múltiples, lo que no es un problema en desarrollo donde
solo trabaja un desarrollador. PostgreSQL en producción es robusto, soporta
concurrencia real, tiene soporte nativo en plataformas de hosting como Render o
Railway, y es el estándar de la industria para aplicaciones web. Gracias a
SQLAlchemy, el cambio entre ambos es transparente para el código.

---

## Arquitectura de carpetas

```
recipe_Scanner/
├── Docs/
│   ├── DEVLOG.md
│   ├── CODE_NOTES_BACK.md      # Explicaciones de código línea a línea — backend
│   ├── CODE_NOTES_FRONT.md     # Explicaciones de código línea a línea — frontend
│   ├── WORKFLOW.md             # Flujo de trabajo y plan de sesiones
│   ├── SPRINT_PLAN.md          # Plan de sprints MoSCoW
│   └── STAGE3.md               # Documentación técnica para Holberton
├── backend/
│   ├── run.py                      # Punto de entrada — llama a create_app()
│   ├── config.py                   # Configuración por entornos (Dev/Prod/Test)
│   ├── requirements.txt
│   ├── .env                        # Variables de entorno (nunca va a GitHub)
│   ├── scripts/                    # Scripts auxiliares (migraciones, seeds)
│   └── app/
│       ├── __init__.py             # Application factory (create_app)
│       ├── extensions.py           # db = SQLAlchemy() — evita imports circulares
│       ├── api/
│       │   └── v1/
│       │       ├── auth.py         # Register, Login, Refresh, GET/PUT/DELETE /me
│       │       ├── recipes.py      # CRUD recetas + cook log
│       │       ├── ingredients.py  # CRUD ingredientes por receta
│       │       ├── scan.py         # Upload PDF → Groq → receta
│       │       ├── costs.py        # /cost, /prices CRUD, manual price, OFF price
│       │       ├── stores.py       # CRUD tiendas del usuario
│       │       └── brands.py       # CRUD marcas del usuario
│       ├── models/
│       │   ├── user.py
│       │   ├── recipe.py           # +title_en/es/fr, image_url, category
│       │   ├── ingredient.py       # +name_en/es/fr, preferred_store_id, preferred_brand_id, manual_price, section
│       │   ├── step.py             # +description_en/es/fr
│       │   ├── pdf_scan.py
│       │   ├── custom_price.py     # +store_id, brand_id, bought_qty/unit/price
│       │   ├── store.py
│       │   ├── brand.py
│       │   └── cook_log.py         # Registro de cocinadas por receta
│       ├── services/
│       │   └── facade.py           # Lógica de negocio completa
│       ├── utils/
│       │   └── security.py
│       ├── persistence/
│       │   ├── repository.py
│       │   └── db_storage.py
│       └── static/
│           └── uploads/
│               ├── avatars/        # Fotos de perfil (excluidas del repo)
│               └── recipes/        # Imágenes de recetas (excluidas del repo)
├── frontend/
│   ├── index.html              # Login
│   ├── register.html
│   ├── home.html               # Resumen de costos y recetas top
│   ├── dashboard.html          # Lista de recetas con filtros y búsqueda
│   ├── recipe.html             # Detalle: ingredientes, costos, pasos
│   ├── scan.html               # Upload PDF con IA
│   ├── prices.html             # Mis precios (CRUD custom prices)
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── i18n.js             # Traducciones EN/ES/FR
│       ├── api.js              # JWT + fetch wrapper con auto-refresh
│       ├── auth.js
│       ├── home.js
│       ├── dashboard.js
│       ├── recipe.js
│       ├── scan.js
│       └── prices.js
└── tests/
    ├── conftest.py
    ├── test_api.py             # 66 tests pytest
    └── postman/
        └── RecipeScanner_collection.json  # 109 requests, 331 assertions
```

---

## Modelo de datos

```
User (UUID)         Recipe (UUID)          Ingredient (UUID)          Step (UUID)
──────────────      ───────────────        ─────────────────          ───────────
id: str PK          id: str PK             id: str PK                 id: str PK
first_name: str     user_id: str FK        recipe_id: str FK          recipe_id FK
last_name: str      title: str             name: str                  order_num: int
email: str          title_en: str          name_en: str               description: str
password_hash: str  title_es: str          name_es: str               description_en: str
avatar_url: str     title_fr: str          name_fr: str               description_es: str
                    description: str       quantity: str              description_fr: str
                    servings: int          unit: str                  duration_min: int
                    prep_time_min: int     off_product_id: str
                    category: str          estimated_cost: float
                    image_url: str         cost_is_manual: bool
                                           manual_price: float
                                           price_source: str
                                           section: str
                                           preferred_store_id: FK
                                           preferred_brand_id: FK

PdfScan (UUID)      CustomPrice (UUID)     Store (UUID)               Brand (UUID)
──────────────      ──────────────────     ────────────               ────────────
id: str PK          id: str PK             id: str PK                 id: str PK
recipe_id FK        user_id: str FK        user_id: str FK            user_id: str FK
filename: str       ingredient_name: str   name: str                  name: str
status: str         store_id: FK
scanned_at: str     brand_id: FK           CookLog (UUID)
                    bought_qty: float      ──────────────
                    bought_unit: str       id: str PK
                    bought_price: float    recipe_id: FK
                    notes: str             user_id: str FK
                                           cooked_at: str
```

**Nota sobre los tipos:**
- `id` es `str` (UUID) en todos los modelos — más seguro que `int` (previene enumeración de IDs)
- `quantity` es `str` — Groq puede retornar "al gusto", "una pizca", valores no numéricos
- No hay `username` — el email es el identificador único de login
- `name_en/es/fr`, `title_en/es/fr`, `description_en/es/fr` — campos de traducción para i18n EN/ES/FR

Relaciones:
- `User` 1 → 0..* `Recipe`  (owns)
- `User` 1 → 0..* `Store`, `Brand`, `CustomPrice`  (owns)
- `Recipe` 1 → 0..* `Ingredient`, `Step`, `PdfScan`, `CookLog`
- `CustomPrice` → FK a `Store`, `Brand` (opcionales)
- `Ingredient` → FK a `Store`, `Brand` (preferred_store_id, preferred_brand_id)

---

## Progreso

### Fase 1 — Fundamentos del backend ✅

- [x] Estructura de carpetas + `__init__.py`
- [x] `backend/requirements.txt`
- [x] `backend/config.py`
- [x] `backend/.env` + `backend/.gitignore`
- [x] `backend/app/__init__.py` (application factory con flask_restx + JWTManager)
- [x] `backend/run.py` (punto de entrada)

### Fase 2 — Modelos del dominio (sin base de datos) ✅

- [x] `app/models/user.py`
- [x] `app/models/recipe.py`
- [x] `app/models/ingredient.py`
- [x] `app/models/step.py`
- [x] `app/models/pdf_scan.py`

### Fase 3 — Capa de persistencia en memoria (Repository Pattern) ✅

- [x] `app/persistence/repository.py` — BaseRepository (ABC) + InMemoryStorage en un solo archivo

### Fase 4 — Autenticación ✅

- [x] `app/utils/security.py` (bcrypt)
- [x] `app/api/v1/auth.py` (register + login con flask_restx)
- [x] `tests/postman/` (Postman collection para QA)

### Fase 5 — Facade y API ✅

- [x] `app/services/facade.py`
- [x] `app/api/v1/recipes.py`
- [x] `app/api/v1/ingredients.py`

### Fase 6 — Integración IA ✅

- [x] `app/api/v1/scan.py` + Groq en facade

### Fase 7 — Open Food Facts + Precios custom ✅

- [x] Open Food Facts + FALLBACK_PRICES en facade
- [x] `models/custom_price.py`
- [x] `api/v1/costs.py` — GET /recipes/<id>/cost + CRUD /prices

### Fase 8 — Swap a SQLAlchemy ✅

- [x] `app/extensions.py` — instancia db sin imports circulares
- [x] `app/persistence/db_storage.py` — DbStorage con SQLAlchemy session
- [x] Todos los modelos migrados de `@dataclass` a `db.Model`
- [x] `config.py` — path absoluto SQLite con `basedir`
- [x] `app/__init__.py` — `db.init_app` + `db.create_all`
- [x] Fix seguridad ingredientes: ownership check en POST/PUT/DELETE
- [x] 144 assertions Postman pasando (82 requests)

### Fase 9 — Frontend ✅

- [x] Frontend estático HTML + JS (Jinja2 descartado — ver CODE_NOTES_FRONT.md)
- [x] `frontend/index.html` + `frontend/register.html` + `frontend/js/auth.js`
- [x] `frontend/dashboard.html` + `frontend/js/dashboard.js`
- [x] `frontend/recipe.html` + `frontend/js/recipe.js`
- [x] `frontend/scan.html` + `frontend/js/scan.js`
- [x] `frontend/prices.html` + `frontend/js/prices.js`
- [x] `frontend/home.html` + `frontend/js/home.js` (resumen de costos)
- [x] `frontend/css/style.css` + accesibilidad WCAG (contraste AA)

---

## Workflow de dependencias

```bash
# Instalás una librería
pip install flask

# Actualizás el requirements
pip freeze > requirements.txt
```

### Problema encontrado — versiones incompatibles con Python 3.8

Al intentar instalar las dependencias con versiones fijas obtuvimos este error:

```
ERROR: Could not find a version that satisfies the requirement Flask==3.1.0
ERROR: Could not find a version that satisfies the requirement PyJWT==2.10.1
```

**Causa:** el entorno de desarrollo corre Python 3.8.10 (versión del sistema WSL).
Las versiones escritas a mano eran más nuevas de lo que Python 3.8 soporta.

**Solución aplicada:**
1. Actualizar pip: `pip install --upgrade pip`
2. Escribir el `requirements.txt` sin versiones fijas
3. Dejar que pip instale las versiones compatibles más recientes
4. Capturar las versiones exactas con `pip freeze > requirements.txt`

**Versiones finales instaladas:**

| Librería | Versión |
|---|---|
| Flask | 3.0.3 |
| Flask-SQLAlchemy | 3.1.1 |
| SQLAlchemy | 2.0.49 |
| PyJWT | 2.9.0 |
| bcrypt | 5.0.0 |
| PyMuPDF | 1.24.11 |
| groq | 0.33.0 |
| python-dotenv | 1.0.1 |
| requests | 2.32.4 |

**Nota:** Python 3.8 es la versión del sistema WSL. En producción se usará Python 3.12.

---

## Decisiones técnicas documentadas

### 1. Repository Pattern (Patrón Repositorio)

**Decisión:** La capa de acceso a datos se implementa detrás de una interfaz abstracta.
Toda la lógica de negocio habla solo con esa interfaz, nunca directamente con la BD.

```
API → Facade → BaseRepository (ABC) → InMemoryStorage / DbStorage
```

**Por qué:**
- **SRP:** cada capa tiene una única razón para cambiar.
- **Testabilidad:** los tests corren contra `InMemoryStorage` sin base de datos real.
- **Intercambiabilidad:** swap a SQLAlchemy sin modificar una línea de la API.
- **DIP:** los módulos de alto nivel dependen de abstracciones, no de implementaciones.

---

### 2. In-Memory Storage primero

**Decisión:** Toda la app corre primero con diccionarios Python. Se migra a SQLAlchemy
solo una vez que la lógica está completamente validada.

**Por qué:**
- Arranque inmediato sin configurar base de datos.
- Los errores de diseño se detectan antes de tener un esquema SQL que migrar.
- Reduce la complejidad en cada etapa: primero lógica, después persistencia.

---

### 3. Application Factory Pattern (`create_app`)

**Decisión:** La app Flask se instancia dentro de una función, no en el módulo global.

**Por qué:**
- Permite crear instancias con distintas configuraciones (dev, prod, test).
- Evita imports circulares.
- Es el patrón recomendado por la documentación oficial de Flask.

---

### 4. SQLAlchemy como ORM

**Por qué:**
- Cambiar de SQLite a PostgreSQL requiere modificar solo la URI en `config.py`.
- Los modelos son clases Python legibles, no strings SQL dispersos.
- Consultas parametrizadas por defecto → previene inyección SQL.

---

### 5. JWT para autenticación

**Por qué:**
- **Stateless:** el servidor no guarda sesiones. El token contiene el `user_id` firmado.
- **Escalable:** cualquier instancia del servidor puede verificar el token.
- **Estándar:** JWT es el mecanismo más usado en APIs REST.

**Flujo:**
1. Login con email + contraseña.
2. Servidor emite token firmado con `JWT_SECRET_KEY`.
3. Cliente envía `Authorization: Bearer <token>` en cada petición.
4. Servidor verifica la firma → extrae `user_id`.

---

### 6. bcrypt para contraseñas

**Por qué:**
- Algoritmo lento por diseño → ataques de fuerza bruta computacionalmente costosos.
- Incluye salt aleatorio → previene ataques con rainbow tables.
- MD5 y SHA-256 son demasiado rápidos para contraseñas.

---

### 7. Archivos `__init__.py` en cada carpeta

**Por qué:**
Python solo puede importar código de una carpeta si tiene `__init__.py`.
Sin él, `from app.models.user import User` lanza `ModuleNotFoundError`.

```python
from app.models.user import User   # ✅ con __init__.py
from app.models.user import User   # ❌ sin __init__.py → ModuleNotFoundError
```

---

### 8. Blueprint puro vs flask_restx (Swagger) — por qué elegimos flask_restx

**Decisión final:** `flask_restx` para todos los endpoints de la API.

**¿Qué es flask_restx?**
Una extensión de Flask que reemplaza `Blueprint` con `Namespace` y `Resource`.
Agrega automáticamente documentación Swagger UI (interfaz visual interactiva) y
validación de input con `api.model()`. Se accede en `http://localhost:5000/api/docs`.

**Por qué elegimos flask_restx y no Blueprint puro:**

1. **App móvil futura.** El objetivo es transformar RecipeScanner en una app
   móvil (React Native o Flutter). Un cliente móvil es un consumidor externo de
   la API que necesita documentación clara de todos los endpoints, tipos de datos
   y respuestas posibles. Swagger genera esa documentación automáticamente.

2. **Testing visual inmediato.** Swagger UI permite probar todos los endpoints
   desde el navegador sin Postman. Es especialmente útil durante el desarrollo
   del backend antes de tener frontend.

3. **Validación automática de input.** `@api.expect(model)` valida el body de
   la petición antes de que llegue al código. Con Blueprint había que hacerlo
   manualmente con `if not data or not data.get('campo')`.

4. **Estándar en la industria.** OpenAPI/Swagger es el estándar para documentar
   APIs REST en entornos profesionales. Tenerlo desde el inicio demuestra buenas
   prácticas al jury.

**¿Qué cambia respecto a Blueprint puro?**

| Aspecto | Blueprint puro | flask_restx |
|---|---|---|
| Crear rutas | `Blueprint('auth', __name__)` | `Namespace('auth', description='...')` |
| Definir endpoint | función con `@auth_bp.route('/login')` | clase `Login(Resource)` con `def post(self)` |
| Documentación | manual (README) | automática en `/api/docs` |
| Validación input | `if not data.get('campo')` manual | `api.model()` + `@api.expect()` |
| Registrar en app | `app.register_blueprint(bp, url_prefix=...)` | `api.add_namespace(ns, path=...)` |

La **lógica interna no cambia** — las llamadas a la Facade y las respuestas JSON
son idénticas. Solo cambia la "envoltura" de cada endpoint.

**¿Por qué no nos preocupa el DeprecationWarning de flask_restx con Flask 3.x?**
flask_restx 1.3.0 accede a `Flask.__version__`, que está deprecado en Flask 3.x.
Es un `DeprecationWarning` — solo un aviso, no rompe nada. La funcionalidad
completa sigue operativa. Para el MVP de fin de junio, este tradeoff es aceptable.
La comunidad de flask_restx ya tiene una solución en progreso.

**Herramienta de testing complementaria:** Postman — para guardar colecciones de
requests con JWT automático y exportar evidencia de QA para el jury (Stage 4).

---

### 9. Metodología de desarrollo — ¿Agile?

**Decisión:** Desarrollo iterativo estructurado con principios Agile, adaptado a proyecto individual.

**¿Qué se aplica de Agile?**
- **Desarrollo iterativo** — cada sesión entrega un incremento funcional del sistema.
- **Backlog definido** — `SPRINT_PLAN.md` lista todas las tareas organizadas por sesión.
- **Entregas incrementales** — al final de cada sesión existe algo que funciona y se puede probar.

**¿Qué no aplica (y por qué)?**
- Sin sprints de duración fija (2 semanas) — hay una fecha de entrega fija de fin de junio.
- Sin daily standups ni retrospectivas — es un proyecto individual.
- Sin user stories formales (`Como usuario quiero...`) — el scope está definido por los requisitos del RNCP.
- Sin velocity tracking ni story points — no hay equipo que estimar.

**Respuesta al jury si preguntan:**
> *"Adopté principios Agile como desarrollo iterativo y planificación por backlog, adaptados a un proyecto individual con fecha de entrega fija. Usar Scrum completo hubiera sido overhead innecesario para un equipo de una persona."*

---

### 10. Arquitectura en capas

| Carpeta | Responsabilidad |
|---|---|
| `api/` | Recibir HTTP, validar input, devolver JSON |
| `services/` | Lógica de negocio |
| `models/` | Entidades del dominio |
| `persistence/` | Acceso a datos |
| `utils/` | Helpers técnicos (JWT, hash) |

Cada capa solo conoce a la inmediatamente inferior → bajo acoplamiento.

---

## Conceptos fundamentales del entorno de desarrollo

### Entorno virtual

Instalación aislada de Python con sus propias librerías, separada del Python global.

```bash
python3 -m venv venv          # crear
source venv/bin/activate      # activar (Linux/Mac)
venv\Scripts\activate         # activar (Windows)
pip install -r requirements.txt
```

La carpeta `venv/` va en `.gitignore` — no se sube al repositorio.
El `requirements.txt` es lo que se comparte para que otros puedan replicar el entorno.

---

### `pip freeze` vs escribir a mano

`pip freeze` captura las versiones exactas instaladas en el entorno:

```bash
pip freeze > requirements.txt
```

Escribir versiones a mano es arriesgado — podés inventar una versión que no existe
o que no es compatible con tu Python. `pip freeze` siempre refleja la realidad.

---

### `create_app` — Application Factory

**Sin factory (problemático):**
```python
app = Flask(__name__)  # se crea al importar → config fija, imports circulares
```

**Con factory (correcto):**
```python
def create_app(config_name=None):
    app = Flask(__name__)
    app.config.from_object(config[config_name])
    return app
```

La app no existe hasta que se llama la función. Se puede crear con distintas configs.

---

### `config.py` — Configuración por entornos

Herencia de clases para no repetir código:

```
Config (base)
  ├── DevelopmentConfig  → DEBUG=True, SQLite local
  ├── TestingConfig      → TESTING=True, SQLite en RAM
  └── ProductionConfig   → DEBUG=False, PostgreSQL, sin fallbacks
```

---

### `SECRET_KEY` y `JWT_SECRET_KEY`

Dos claves separadas:
- `SECRET_KEY` — Flask la usa internamente para cookies y sesiones.
- `JWT_SECRET_KEY` — firma los tokens JWT. Si alguien la conoce puede generar
  tokens válidos y hacerse pasar por cualquier usuario.

Nunca en el código → siempre en variables de entorno.

---

### Variables de entorno vs credenciales en el código

```python
# ❌ malo — va a GitHub
SECRET_KEY = 'mi-clave-123'

# ✅ correcto — lee del sistema operativo
SECRET_KEY = os.environ.get('SECRET_KEY')
```

El `.env` almacena las claves en desarrollo y **nunca va a GitHub** (`.gitignore`).
En producción las claves se definen directamente en el servidor (Render, Railway).

Claves sensibles de este proyecto:
- `SECRET_KEY`
- `JWT_SECRET_KEY`
- `GROQ_API_KEY`
- `DATABASE_URL` (en producción)

---

### `FLASK_ENV`

Variable de entorno que determina qué configuración carga `create_app()`.

```
.env → FLASK_ENV=development  → DevelopmentConfig
servidor → FLASK_ENV=production → ProductionConfig
test explícito → create_app('testing') → TestingConfig
```

---

## Preguntas frecuentes del jury

### ¿Qué otras opciones existen aparte de Flask?

**Django** — framework full, todo incluido. Demasiado grande para este proyecto:
obliga a usar su ORM y su estructura. Con Django el jury no puede evaluar si
entendés las decisiones técnicas porque el framework las toma por vos.

**FastAPI** — moderno, rápido, asíncrono. Excelente para APIs puras, pero requiere
separar completamente el frontend del backend. Curva de aprendizaje más pronunciada.

**Flask** — microframework, control total, Jinja2 integrado, curva baja.
Podemos explicar cada línea porque nosotros integramos cada componente manualmente.

| | Flask | Django | FastAPI |
|---|---|---|---|
| Tamaño | Micro | Full | Micro/Medio |
| Flexibilidad | Alta | Baja | Alta |
| Curva de aprendizaje | Baja | Media | Media |
| Ideal para | APIs + frontend estático | Proyectos grandes | APIs puras |
| Control técnico | Total | Limitado | Total |

---

## Decisiones técnicas — Sprint 5 (Frontend)

### Decisión 9 — Frontend estático vs Jinja2

El plan original preveía usar Jinja2 para el frontend (server-side rendering dentro de Flask).
Durante el Sprint 5 se tomó la decisión de usar HTML + JS estático puro consumiendo la API REST.

**Problema con Jinja2:**
- El frontend Jinja2 estaría acoplado al backend: cambiar de servidor invalida el frontend.
- Una app móvil futura tendría que duplicar toda la lógica de presentación.
- Flask entraría en conflicto al servir tanto la API REST (JSON) como las vistas HTML desde las mismas rutas.

**Solución — Frontend estático:**
```
frontend/
  index.html          ← login
  register.html
  dashboard.html      ← lista de recetas
  recipe.html         ← detalle con precios
  scan.html           ← subida de PDF
  prices.html         ← precios personalizados
  css/style.css
  js/
    api.js            ← fetch wrapper + JWT
    auth.js           ← login/logout/localStorage
    i18n.js           ← traducciones EN/ES/FR
    dashboard.js
    recipe.js
    scan.js
    prices.js
```

El backend queda como API pura. El frontend consume los mismos endpoints que consumiría React, Vue, o una app móvil React Native.

---

### Decisión 10 — Stores y Brands como entidades gestionadas

Los precios custom inicialmente tenían `store` y `brand` como campos de texto libre.

**Problema:** el mismo supermercado podía estar escrito "Intermarche", "Intermarché", "intermarché" — tres entradas distintas que no se podían comparar.

**Solución:** `Store` y `Brand` son modelos SQLAlchemy independientes con FK en `CustomPrice` e `Ingredient`.

```python
class Store(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)

class Brand(db.Model):  # idéntica estructura
    ...
```

`Ingredient` tiene `preferred_store_id` y `preferred_brand_id` para elegir en qué tienda/marca buscar el precio de ese ingrediente en la receta.

---

### Decisión 11 — Resolución de precio en 4 casos

Cuando se calcula el costo de un ingrediente, la lógica de prioridad es:

```
1. store + brand coinciden → precio más barato de esa combinación
2. solo store coincide    → precio más barato en esa tienda
3. solo brand coincide    → precio más barato de esa marca
4. ninguno                → precio más barato entre todos los precios del usuario
```

Si el usuario no tiene ningún precio custom → se usa Open Food Facts + tabla FALLBACK_PRICES.

---

### Decisión 12 — Fuzzy matching de nombres de ingredientes (multilingüe)

La receta extraída por IA puede escribir "huevo" y el usuario tiene guardado "huevos".
Además, la IA puede usar un idioma distinto al que el usuario guardó el precio (ej: IA
devuelve "sucre en poudre" en francés, usuario guardó "azucar" en español sin acento).

**Solución en 4 capas:**

**Capa A — Normalización Unicode (`_norm`):**
Antes de cualquier comparación, se eliminan acentos con `unicodedata.normalize('NFD')`:
```python
@staticmethod
def _norm(s):
    s = s.lower().strip()
    return ''.join(c for c in unicodedata.normalize('NFD', s)
                   if unicodedata.category(c) != 'Mn')
# _norm("Azúcar en polvo") == "azucar en polvo"  ✓
# _norm("sucre")           == "sucre"             ✓
```
Todos los nombres se almacenan ya normalizados (`create_custom_price` aplica `_norm`).

**Capa B — Búsqueda por candidatos multilingüe (Option A):**
`_resolve_price()` intenta matching en todos los idiomas disponibles del ingrediente:
```python
candidates = {name_lower}
for attr in ('name_en', 'name_es', 'name_fr'):
    val = (getattr(ing, attr, None) or '').lower().strip()
    if val:
        candidates.add(val)
# Si ing.name="sucre en poudre", ing.name_es="Azúcar en polvo"
# candidates = {"sucre en poudre", "azucar en polvo"}
# "azucar en polvo" → word-prefix → encuentra "azucar" guardado ✓
```

**Capa C — Matching en 3 pasos (por cada candidato):**
```python
# 1. Exact match
exact = [cp for cp in all_user if cp.ingredient_name == name_lower]
if exact: return exact

# 2. Word-prefix (padding para evitar "sal" → "salsa")
prefix = [cp for cp in all_user
          if (name_lower + ' ').startswith(cp.ingredient_name + ' ')
          or (cp.ingredient_name + ' ').startswith(name_lower + ' ')]
if prefix: return prefix

# 3. Singular/plural en español (strip de -s, -es)
norm = _strip_plural(name_lower)
plural = [cp for cp in all_user if _strip_plural(cp.ingredient_name) == norm]
if plural: return plural
```

Casos resueltos:
- `huevo` ↔ `huevos` → paso C3
- `harina` ↔ `harina 0000` → paso C2
- `sucre en poudre` ↔ `azucar` → name_es="Azúcar en polvo" → _norm → C2
- `azucar` ↔ `azúcar` → _norm elimina tilde → C1

---

### Decisión 13 — Optimización de re-renders en el frontend

El problema: al cambiar el store o brand de un ingrediente, `saveRecipe()` llamaba a `loadPage()` que recargaba todo el contenido desde cero (equivalente a navigation reload).

**Solución aplicada:**
- `buildRecipeHeaderHtml(recipe)` — genera solo el HTML del header
- `renderRecipeHeader(recipe)` — reemplaza solo el `.recipe-header-grid` con `outerHTML`
- `saveRecipe()` ahora actualiza `currentRecipe` en memoria y llama `renderRecipeHeader()` — la tabla de ingredientes no se toca
- `changeIngredientStore`/`changeIngredientBrand` solo llaman `loadCost()` que hace updates quirúrgicos célula por célula mediante `querySelector`
- Los dropdowns se deshabilitan durante la API call para evitar doble-click

---

### Bug de seguridad corregido en Sprint 5

`GET /api/v1/recipes/<recipe_id>` no verificaba ownership: cualquier usuario autenticado que conociera un UUID de receta ajena podía leerla (information disclosure).

**Fix aplicado en `recipes.py`:**
```python
def get(self, recipe_id):
    user_id = get_jwt_identity()        # ← agregado
    recipe = facade.get_recipe(recipe_id)
    if not recipe:
        return {'error': 'Recipe not found'}, 404
    if recipe.user_id != user_id:       # ← agregado
        return {'error': 'Forbidden'}, 403
    return {...}, 200
```

Este fix está cubierto por el test `test_get_other_user_recipe_returns_403` en `tests/test_api.py`.

---

## Decisiones técnicas — Sprint 8-9 (Supabase + UX)

### Decisión 14 — Supabase Storage para imágenes persistentes

**Problema:** Render tiene filesystem efímero — tras reiniciar el contenedor (15 min de inactividad), todas las imágenes subidas se pierden. Guardar en `/static/uploads/` no es viable en producción.

**Decisión:** Usar Supabase Storage (S3-compatible, gratuito hasta 1GB) para todos los archivos subidos por usuarios.

**Implementación:**

```python
# backend/app/storage.py
import os, requests

SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY', '')
BUCKET = 'recipes'

def upload_file(file_bytes, path, content_type):
    if not SUPABASE_URL or not SUPABASE_KEY:
        return None  # fallback al caller
    url = f'{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}'
    r = requests.put(url, data=file_bytes, headers={
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': content_type,
        'x-upsert': 'true'
    }, timeout=20)
    if r.ok:
        return f'{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{path}'
    return None

def delete_file(path):
    if not SUPABASE_URL or not SUPABASE_KEY:
        return
    requests.delete(
        f'{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}',
        headers={'Authorization': f'Bearer {SUPABASE_KEY}'},
        timeout=10
    )
```

Cada endpoint de upload (`/auth/me/avatar`, `/recipes/<id>/images`) intenta primero Supabase. Si retorna `None`, hace fallback al filesystem local con URL relativa `/static/uploads/...`.

**`resolveImgUrl()` en el frontend:**
```javascript
function resolveImgUrl(url) {
    if (!url) return null;
    if (url.startsWith('http')) return url;  // Supabase → URL absoluta ya lista
    return SERVER_URL + url;                 // fallback local → prefijamos backend URL
}
```

---

### Decisión 15 — DeepL como primario + MyMemory API como fallback de traducciones

**Decisión:** El sistema de traducción intenta DeepL primero (si `DEEPL_API_KEY` está configurada) y cae a MyMemory API si no hay clave o si falla.

**Por qué no solo MyMemory:**
- DeepL tiene mayor calidad, especialmente para textos culinarios con terminología específica.
- Si un usuario o el entorno tiene una clave DeepL, se usa automáticamente sin cambiar código.

**Por qué MyMemory como fallback:**
- No requiere API key — es completamente gratuito.
- 500k caracteres/día con email registrado (`chuliangf94@gmail.com` como `de` param).
- Cubre perfectamente el volumen de una app de recetas personales.

**Implementación paralela (3 idiomas simultáneos):**
```python
with ThreadPoolExecutor(max_workers=3) as executor:
    futures = {
        executor.submit(_batch_for_lang, lc): lc
        for lc in [('EN-US', 'en'), ('ES', 'es'), ('FR', 'fr')]
    }
```
Las 3 traducciones corren en paralelo para mantenerse dentro del límite de 30s de Render.

---

### Decisión 16 — Tabla de precios editable inline (Excel-style)

**Decisión:** Reemplazar el sistema de modales (Add modal + Edit modal) en `prices.html` por una tabla con celdas `<input>` y `<select>` editables directamente.

**Por qué:**
- El workflow de editar precios era tedioso: click botón → modal → completar campos → guardar → cerrar modal.
- Una tabla editable inline es significativamente más rápida y natural — se parece a Excel o Google Sheets.

**Cómo funciona el guardado automático:**
```javascript
// Cada <tr> tiene onfocusout al nivel de la fila
<tr onfocusout="handleRowFocusOut(event, '${p.id}')">
  <td><input class="qty-cell" ...></td>
  <td><select class="store-cell" ...></select></td>
  ...
</tr>

function handleRowFocusOut(event, priceId) {
  // Si el foco se va a otro elemento DENTRO de la fila → no guardar
  // (el usuario está tabulando entre celdas de la misma fila)
  if (event.currentTarget.contains(event.relatedTarget)) return;
  // Si el foco sale de la fila completamente → guardar
  if (priceId === 'new') saveNewRow(event.currentTarget);
  else saveRowEdit(priceId, event.currentTarget);
}
```

La fila vacía al pie de la tabla (`.new-price-row`) es siempre visible y crea un nuevo precio al completar el ingrediente y salir.

**Dual-mode de precio (en la misma celda):**
- Si la columna `Qty` tiene valor → interpreta `Price` como precio pagado por esa cantidad → calcula €/kg
- Si `Qty` está vacío → interpreta `Price` directamente como €/kg

---

### Decisión 17 — Cook Log y resumen semanal en Home

**Decisión:** Agregar un `CookLog` que registra cada vez que el usuario marca una receta como "cocinada", y mostrar un resumen semanal en `home.html`.

**Por qué:**
- Agrega valor real al producto — el usuario puede ver cuántas veces cocinó en la semana.
- `home.html` se convierte en el dashboard inicial con métricas útiles.

**Modelo:**
```python
class CookLog(db.Model):
    id = db.Column(db.String(36), primary_key=True)
    recipe_id = db.Column(db.String(36), db.ForeignKey('recipes.id'))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'))
    cooked_at = db.Column(db.DateTime)
```

**Facade:**
```python
def log_cook(self, recipe_id, user_id):  → registra una entrada
def get_week_cook_count(self, user_id):  → cuántas veces cocinó esta semana
def get_week_cooked_recipe_ids(user_id): → qué recetas cocinó esta semana
```

### Decisión 18 — Vanilla JS en lugar de React (o Vue/Svelte)

**Decisión:** El frontend se construyó con HTML + CSS + JavaScript puro, sin ningún framework reactivo.

**Por qué NO React:**

1. **Estado no compartido entre páginas** — cada página (`prices.js`, `home.js`, `scan.js`) es autocontenida. No existe un árbol de componentes profundo con estado global que justifique un framework reactivo.

2. **Sin build step** — con vanilla JS no hay Vite, webpack, ni transpilador. Se guarda el archivo y el cambio es inmediato. Para un proyecto de portfolio con iteraciones rápidas, esto es una ventaja real.

3. **Complejidad ya alta** — el stack ya incluye Flask, SQLAlchemy, Supabase, Groq API, DeepL, JWT y Docker. Agregar JSX + hooks + bundler habría sumado fricción sin resolver ningún problema concreto.

4. **API-first architecture** — el backend es una API REST pura. El frontend consume los mismos endpoints que consumiría una app móvil (React Native, Flutter) o cualquier otro cliente. Usar vanilla JS o React no cambia esa propiedad; la arquitectura ya está desacoplada.

5. **Mantenibilidad académica** — en una presentación técnica, vanilla JS es más fácil de explicar línea por línea que el ciclo de vida de componentes React.

**¿Cuándo tendría sentido migrar a React / Next.js?**

- Cuando haya estado complejo compartido entre muchas vistas simultáneas (ej. edición colaborativa en tiempo real).
- Cuando el número de páginas o componentes reutilizables supere ~10 y el copy-paste de HTML se vuelva insostenible.
- Si se construye una PWA o se integra con React Native para móvil — en ese caso Next.js + tRPC o una API REST compartida sería lo natural.

**Conclusión:** vanilla JS fue la decisión correcta para el alcance de este proyecto. La misma API REST que alimenta el frontend podría alimentar mañana un cliente React, Vue o móvil sin cambiar una sola línea del backend.

---

### Fase 10 — Supabase + UX mejorada ✅

- [x] `app/storage.py` — wrapper Supabase Storage
- [x] `POST /api/v1/auth/me/avatar` — upload avatar con fallback local
- [x] `POST /api/v1/recipes/<id>/images` + `DELETE` — galería multi-foto por receta
- [x] `Recipe.images_json` — columna TEXT con array JSON de URLs
- [x] `resolveImgUrl()` en todos los JS del frontend
- [x] Traducciones con DeepL (primario) + MyMemory API (fallback paralelo con ThreadPoolExecutor)
- [x] Detección de idioma fuente con `langdetect` (para evitar traducir al mismo idioma)
- [x] Pasos de receta traducidos en EN/ES/FR (no solo títulos e ingredientes)
- [x] `CookLog` model + Facade + endpoint `POST /recipes/<id>/cook`
- [x] `home.html` + `home.js` con resumen semanal
- [x] `prices.js` — tabla inline editable (reemplaza modales)
- [x] `scan.js` — botón X para cerrar éxito del scan + modal anti-duplicados
- [x] `__init__.py` — safe `ALTER TABLE` idempotente para columnas nuevas
