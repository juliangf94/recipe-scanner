# RecipeScanner — Diario de desarrollo

Proyecto portfolio para Holberton School — RNCP 5 DWWM  
Fecha de entrega: finales de junio 2025

---

## Stack técnico

| Capa | Tecnología | Justificación |
|---|---|---|
| Backend framework | Flask 3.x | Microframework Python: simple, explícito, ideal para APIs REST |
| ORM | SQLAlchemy 2.x | Abstracción de SQL, soporta SQLite y PostgreSQL sin cambiar código |
| Autenticación | PyJWT + bcrypt | JWT = stateless (sin sesiones en servidor); bcrypt = hash lento por diseño |
| PDF parsing | PyMuPDF | Binding C de MuPDF, muy rápido para extraer texto |
| IA | Groq API (LLaMA 3.3-70b) | Inferencia ultrarrápida, modelo open-source potente |
| API externa | Open Food Facts | Base de datos de alimentos abierta y gratuita |
| BDD desarrollo | SQLite | Sin servidor, archivo local, ideal para desarrollo |
| BDD producción | PostgreSQL | Robusto, concurrente, estándar en producción |
| Frontend | Por decidir (Jinja2 o React) | Ver sección Frontend en WORKFLOW.md |

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

**PyJWT + bcrypt — Autenticación**
Son dos herramientas con roles distintos pero complementarios. PyJWT maneja la
autenticación stateless — el servidor no guarda sesiones, el token contiene el
`user_id` firmado con la `SECRET_KEY`. Cualquier instancia del servidor puede
verificar el token sin consultar una base de datos de sesiones. bcrypt maneja el
almacenamiento seguro de contraseñas — es lento por diseño, lo que hace que los
ataques de fuerza bruta sean computacionalmente muy costosos. Incluye un salt
aleatorio que previene ataques con tablas precomputadas.

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
├── CODE_NOTES.md               # Explicaciones de código línea a línea
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
│       │   └── v1/                 # API versionada
│       │       ├── auth.py
│       │       ├── recipes.py
│       │       ├── ingredients.py
│       │       └── scan.py
│       ├── models/
│       │   ├── user.py
│       │   ├── recipe.py
│       │   ├── ingredient.py
│       │   ├── step.py
│       │   └── pdf_scan.py
│       ├── services/
│       │   └── facade.py
│       ├── utils/
│       │   ├── jwt_helper.py
│       │   └── security.py
│       └── persistence/
│           ├── repository.py
│           ├── memory_storage.py
│           └── db_storage.py
└── frontend/
    ├── templates/
    └── static/
        ├── css/
        └── js/
```

---

## Modelo de datos

```
User (int)      Recipe (int)      Ingredient        Step (int)      PdfScan
────────────    ─────────────     ──────────────    ──────────      ───────────────
id PK           id PK             id PK (int)       id PK           id PK (int)
username Str    user_id FK        recipe_id FK(int) recipe_id FK    recipe_id FK (int)
email Str       title Str         name Str          order_num int   filename Str
password_hash   description Str   quantity float    description Str status Str
created_at DT   servings int      unit Str                          scanned_at DT
                prep_time_min int off_product_id Str
                created_at DT
```

Relaciones:
- `User` 1 → 0..* `Recipe`  (owns)
- `Recipe` 1 → 0..* `Ingredient`  (contains)
- `Recipe` 1 → 0..* `Step`  (includes)
- `Recipe` 1 → 0..* `PdfScan`  (generated from)

---

## Progreso

### Fase 1 — Fundamentos del backend

- [x] Estructura de carpetas + `__init__.py`
- [x] `backend/requirements.txt`
- [x] `backend/config.py`
- [x] `backend/.env` + `backend/.gitignore`
- [ ] `backend/app/__init__.py` (application factory — `create_app`)
- [ ] `backend/run.py` (punto de entrada)

### Fase 2 — Modelos del dominio (sin base de datos)

- [ ] `app/models/user.py`
- [ ] `app/models/recipe.py`
- [ ] `app/models/ingredient.py`
- [ ] `app/models/step.py`
- [ ] `app/models/pdf_scan.py`

### Fase 3 — Capa de persistencia en memoria (Repository Pattern)

- [ ] `app/persistence/repository.py` — interfaz abstracta (ABC)
- [ ] `app/persistence/memory_storage.py` — implementación con diccionarios

### Fase 4 — Autenticación

- [ ] `app/utils/security.py` (bcrypt)
- [ ] `app/utils/jwt_helper.py` (PyJWT)
- [ ] `app/api/v1/auth.py` (register + login)

### Fase 5 — Facade y API

- [ ] `app/services/facade.py`
- [ ] `app/api/v1/recipes.py`
- [ ] `app/api/v1/ingredients.py`

### Fase 6 — Integración IA

- [ ] `app/api/v1/scan.py` + Groq en facade

### Fase 7 — Open Food Facts

- [ ] Open Food Facts en facade

### Fase 8 — Swap a SQLAlchemy

- [ ] `app/persistence/db_storage.py`
- [ ] Migraciones SQLite → PostgreSQL

### Fase 9 — Frontend

- [ ] A decidir según tiempo disponible (Jinja2 o React)

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

### 8. Blueprint puro vs flask_restx (Swagger)

**Decisión inicial:** Blueprint puro de Flask para los endpoints de la API.

**Por qué no flask_restx desde el principio:**
- Con frontend Jinja2 (server-side), no hay consumidor externo de la API que
  necesite leer documentación Swagger.
- Swagger es útil cuando tienes un frontend separado (React, app móvil) que
  necesita conocer tus endpoints independientemente del backend.
- Blueprint puro requiere menos dependencias y es más fácil de explicar línea
  a línea al jury.

**¿Cuándo tendría sentido agregar Swagger?**
Si en el futuro se desarrolla una aplicación móvil (React Native, Flutter),
`flask_restx` sería la librería a agregar. Los cambios serían:

| Qué cambia | Blueprint actual | Con flask_restx |
|---|---|---|
| Dependencia | ninguna extra | `pip install flask-restx` |
| Crear rutas | `Blueprint('auth', __name__)` | `Namespace('auth', description='...')` |
| Definir endpoint | `@auth_bp.route('/login')` | `class Login(Resource):` |
| Documentación | manual (README) | automática en `/api/docs` |
| Validación input | manual | `api.model()` + `@api.expect()` |

La **lógica interna no cambia** — las llamadas a la Facade y las respuestas JSON
son idénticas. Solo cambia la "envoltura" de cada endpoint.

**Herramienta de testing usada en su lugar:** Postman — permite guardar
colecciones de requests con JWT automático, validar respuestas y exportar
evidencia de QA para el jury. Es la herramienta que el Stage 4 menciona
explícitamente.

---

### 9. Arquitectura en capas

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
| Ideal para | APIs + Jinja2 | Proyectos grandes | APIs puras |
| Control técnico | Total | Limitado | Total |
