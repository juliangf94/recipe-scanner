# RecipeScanner — Diario de desarrollo

Proyecto portfolio para Holberton School — RNCP 5 DWWM  
Fecha de entrega: finales de junio 2025

---

## Stack técnico

| Capa | Tecnología | Justificación |
|---|---|---|
| Backend framework | Flask 3.x | Microframework Python: simple, explícito, ideal para APIs REST |
| ORM | SQLAlchemy 2.x | Abstracción de SQL, soporta SQLite y PostgreSQL sin cambiar código |
| Autenticación | flask_jwt_extended + bcrypt | JWT = stateless (sin sesiones en servidor); bcrypt = hash lento por diseño |
| PDF parsing | PyMuPDF | Binding C de MuPDF, muy rápido para extraer texto |
| IA | Groq API (LLaMA 3.3-70b) | Inferencia ultrarrápida, modelo open-source potente |
| API externa | Open Food Facts | Base de datos de alimentos abierta y gratuita |
| BDD desarrollo | SQLite | Sin servidor, archivo local, ideal para desarrollo |
| BDD producción | PostgreSQL | Robusto, concurrente, estándar en producción |
| API docs | flask_restx (Swagger UI) | Documentación automática en `/api/docs`, preparado para app móvil |
| Frontend | HTML + JS estático | Desacoplado del backend, consume la misma API REST que consumiría una app móvil |

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

**Groq API con LLaMA 3.3-70b — IA**
Elegimos Groq sobre OpenAI por dos razones principales. Primero, Groq ofrece
inferencia ultrarrápida gracias a su hardware especializado LPU — los tiempos de
respuesta son notablemente menores que OpenAI para el mismo modelo. Segundo, LLaMA
3.3-70b es un modelo open-source de Meta, lo que significa que no hay dependencia
de un proveedor propietario. Para nuestro caso de uso — extraer ingredientes,
cantidades y pasos de un texto de receta — un modelo de 70 mil millones de parámetros
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
├── DEVLOG.md
├── CODE_NOTES_BACK.md          # Explicaciones de código línea a línea — backend (Sesiones 1–10)
├── CODE_NOTES_FRONT.md         # Explicaciones de código línea a línea — frontend (Sesión 11+)
├── WORKFLOW.md                 # Flujo de trabajo y plan de sesiones
├── STAGE3.md                   # Documentación técnica para Holberton
├── class_Diagram.png
├── backend/
│   ├── run.py                      # Punto de entrada — llama a create_app()
│   ├── config.py                   # Configuración por entornos (Dev/Prod)
│   ├── requirements.txt
│   ├── .env                        # Variables de entorno (nunca va a GitHub)
│   ├── .gitignore
│   ├── scripts/                    # Scripts auxiliares (migraciones, seeds, etc.)
│   └── app/                        # Paquete principal de la aplicación
│       ├── __init__.py             # Application factory (create_app)
│       ├── api/
│       │   └── v1/                 # API REST (JSON) — Swagger en /api/docs
│       │       ├── auth.py
│       │       ├── recipes.py
│       │       ├── ingredients.py
│       │       ├── scan.py
│       │       └── costs.py
│       ├── views/                  # Blueprints HTML (Jinja2) — Sesión 11
│       │   ├── auth.py
│       │   └── recipes.py
│       ├── templates/              # Plantillas Jinja2
│       │   ├── base.html
│       │   ├── auth/
│       │   │   ├── login.html
│       │   │   └── register.html
│       │   ├── recipes/
│       │   │   ├── list.html
│       │   │   ├── detail.html
│       │   │   └── form.html
│       │   └── scan/
│       │       └── upload.html
│       ├── static/
│       │   └── css/
│       │       └── style.css
│       ├── models/
│       │   ├── user.py             # db.Model — SQLAlchemy
│       │   ├── recipe.py
│       │   ├── ingredient.py
│       │   ├── step.py
│       │   ├── pdf_scan.py
│       │   └── custom_price.py
│       ├── extensions.py           # db = SQLAlchemy() — evita imports circulares
│       ├── services/
│       │   └── facade.py
│       ├── utils/
│       │   └── security.py         # hash_password + check_password (bcrypt)
│       └── persistence/
│           ├── repository.py       # BaseRepository (ABC) + InMemoryStorage
│           └── db_storage.py       # DbStorage — SQLAlchemy session
```

---

## Modelo de datos

```
User (UUID)       Recipe (UUID)       Ingredient (UUID)     Step (UUID)     PdfScan (UUID)
──────────────    ───────────────     ─────────────────     ───────────     ──────────────
id: str PK        id: str PK          id: str PK            id: str PK      id: str PK
first_name: str   user_id: str FK     recipe_id: str FK     recipe_id FK    recipe_id FK
last_name: str    title: str          name: str             order_num: int  filename: str
email: str        description: str    quantity: str         description:str status: str
password_hash:str servings: int       unit: str             duration_min:int scanned_at:str
                  prep_time_min: int  off_product_id: str
                  category: str       estimated_cost: float
                                      cost_is_manual: bool
```

**Nota sobre los tipos:**
- `id` es `str` (UUID) en todos los modelos — más seguro que `int` (previene enumeración de IDs)
- `quantity` es `str` — Groq puede retornar "al gusto", "una pizca", valores no numéricos
- No hay `username` — el email es el identificador único de login
- No hay `created_at` en los modelos Phase 1 — se agrega con SQLAlchemy en Sesión 8

Relaciones:
- `User` 1 → 0..* `Recipe`  (owns)
- `Recipe` 1 → 0..* `Ingredient`  (contains)
- `Recipe` 1 → 0..* `Step`  (includes)
- `Recipe` 1 → 0..* `PdfScan`  (generated from)

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

### Fase 9 — Frontend 🔄

- [ ] `app/views/auth.py` + templates login/register
- [ ] `app/views/recipes.py` + templates list/detail/form
- [ ] `app/templates/base.html`
- [ ] `app/static/css/style.css`

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
    i18n.js           ← traducciones ES/EN
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

### Decisión 12 — Fuzzy matching de nombres de ingredientes

La receta extraída por IA puede escribir "huevo" y el usuario tiene guardado "huevos".
La búsqueda exact-match fallaría. Solución en 3 pasos:

```python
# 1. Exact match
exact = [cp for cp in all_user if cp.ingredient_name == name_lower]
if exact: return exact

# 2. Word-prefix (con padding de espacio para evitar "sal" → "salsa")
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
- `huevo` ↔ `huevos` → paso 3
- `harina` ↔ `harina 0000` → paso 2

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
