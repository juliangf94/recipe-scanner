# RecipeScanner — Explicación del código línea a línea

> **Referencia cruzada con SPRINT_PLAN.md**
>
> | Sesiones | Sprint | Estado |
> |---|---|---|
> | Sesión 1–2 | Sprint 1 — Foundation | ✅ Completo |
> | Sesión 3–4 | Sprint 2 — Data Layer + Auth | ✅ Completo |
> | Sesión 5–6 | Sprint 3 — Business Logic + PDF Scan | 🔄 En progreso |
> | Sesión 7–8 | Sprint 4 — Precios + SQLAlchemy | ⏳ Pendiente |
> | Sesión 9 | Sprint 5 — Frontend Jinja2 | ⏳ Pendiente |
>
> Cada sesión = una unidad de trabajo de 2–3 horas. Cada sprint = 1–2 sesiones con un objetivo entregable.

---

# Sesión 1 — Sprint 1 · Estructura base (`app/__init__.py` + `config.py` + `run.py`)

---

## `backend/app/__init__.py`

### ¿Qué es Flask y por qué lo usamos?

Flask es un **microframework web para Python**
("Micro" no significa que sea limitado — significa que el núcleo es mínimo y deliberadamente simple).  
Flask solo incluye lo esencial: 

- Un servidor HTTP, 
- Un sistema de rutas 
- Un motor de templates (Jinja2)

Todo lo demás (base de datos, autenticación, validación)
se agrega según las necesidades del proyecto.

**¿Por qué Flask y no Django o FastAPI?**

| Framework | Por qué no lo elegimos |
|---|---|
| Django | Incluye ORM, admin, formularios, autenticación — todo preconfigurado. Para aprender es difícil saber qué hace qué. Curva de aprendizaje alta para un proyecto de 2 meses. |
| FastAPI | Moderno y muy rápido, pero orientado a APIs puras. No integra Jinja2 de forma nativa, lo que complica el frontend server-side que queremos en la Sesión 9. |
| Flask | Control total sobre cada decisión. Jinja2 integrado. Fácil de entender cada línea. Ideal para explicar al jury exactamente qué hace cada componente. |

**¿Qué hace Flask en este proyecto?**
1. Recibe las peticiones HTTP del browser.
2. Enruta cada petición al Blueprint correcto (`/auth`, `/recipes`, `/scan`).
3. Renderiza los templates Jinja2 para el frontend.
4. Devuelve respuestas JSON para los endpoints de la API.

---

Este archivo es el corazón de la aplicación. Al estar en `app/__init__.py`, Python
lo ejecuta automáticamente cuando se importa el paquete `app`. Contiene la función
`create_app()` que construye, configura y retorna la instancia de Flask.

**¿Por qué aquí y no en otro archivo?**
Cuando en `run.py` escribimos `from app import create_app`, Python busca esa función
en `app/__init__.py`. Es el punto de entrada del paquete.

**Lo que hace `create_app` paso a paso (estado actual — Sesión 5):**
1. Crea la instancia de Flask
2. Carga la configuración según el entorno (development, testing, production)
3. Inicializa JWTManager — gestión de tokens JWT para autenticación
4. Define el esquema de seguridad para Swagger UI — activa el botón "Authorize"
5. Inicializa flask_restx Api — genera automáticamente Swagger UI en `/api/docs`
6. Registra los Namespaces — auth en `/api/v1/auth`, recipes en `/api/v1/recipes`
7. Retorna la app lista para usarse

```python
import os
from flask import Flask
from flask_restx import Api
from flask_jwt_extended import JWTManager
from config import config


def create_app(config_name=None):
    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'default')

    app = Flask(__name__)
    app.config.from_object(config[config_name])

    JWTManager(app)

    authorizations = {
        'Bearer Auth': {
            'type': 'apiKey',
            'in': 'header',
            'name': 'Authorization',
            'description': "Type in the *'Value'* input box below: **'Bearer <JWT>'**, where JWT is the token"
        }
    }

    api = Api(
        app,
        doc='/api/docs',
        title='RecipeScanner API',
        version='1.0',
        description='API for scanning and managing recipes',
        security='Bearer Auth',
        authorizations=authorizations
    )

    # Initialize extensions here (Phase 8 — SQLAlchemy)

    from app.api.v1.auth import api as auth_ns
    from app.api.v1.recipes import api as recipes_ns

    api.add_namespace(auth_ns, path='/api/v1/auth')
    api.add_namespace(recipes_ns, path='/api/v1/recipes')

    return app
```

**Explicación línea por línea:**

```python
import os
```
Módulo estándar de Python para leer variables del sistema operativo.
Lo necesitamos para leer `FLASK_ENV` desde el `.env`.

```python
from flask import Flask
```
Importa la clase `Flask`. Todo empieza acá — sin esto no hay app.

```python
from flask_restx import Api
```
Importa la clase `Api` de flask_restx. Esta clase envuelve toda la aplicación y activa:
- El registro de Namespaces (equivalente a Blueprints pero con metadata de API)
- La generación automática de Swagger UI en la ruta que le indiquemos (`/api/docs`)
- La validación automática de payloads con los modelos que definamos

```python
from flask_jwt_extended import JWTManager
```
Importa la clase `JWTManager`. Esta extensión registra los handlers de JWT en Flask:
- Sabe cómo verificar tokens en los endpoints con `@jwt_required()`
- Sabe cómo extraer el identity con `get_jwt_identity()`
- Maneja automáticamente los errores 401 (token inválido o expirado)

```python
from config import config
```
Importa el diccionario `config` de `config.py`. Ese diccionario mapea strings
como `'development'` a clases como `DevelopmentConfig`. Sin esta línea no podemos
cargar la configuración correcta según el entorno.

```python
def create_app(config_name=None):
```
Define la función factory.
El parámetro `config_name` tiene valor por defecto `None`
porque no queremos hardcodear el entorno aquí — lo vamos a leer del `.env`.

```python
    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'default')
```
Si nadie pasó un `config_name` explícito, intentamos leerlo de la variable de entorno `FLASK_ENV`.
Si tampoco está definida en el `.env`, usamos `'default'` que apunta a `DevelopmentConfig`.
Esto permite que `run.py` no tenga el entorno hardcodeado — simplemente llama `create_app()` y la función lo resuelve sola.

```python
    app = Flask(__name__)
```
Crea la instancia de Flask.
- `__name__` es una variable especial de Python que contiene el nombre del módulo actual (`app`).
- Flask lo usa para saber dónde buscar templates y archivos estáticos relativos a este paquete.

```python
    app.config.from_object(config[config_name])
```
- `config[config_name]` accede al diccionario y obtiene la clase correcta, por ejemplo `DevelopmentConfig`.
- `app.config.from_object()` lee todos los atributos de esa clase (SECRET_KEY, JWT_SECRET_KEY, SQLALCHEMY_DATABASE_URI, etc.) y los carga en la configuración de Flask.
- A partir de acá, cualquier parte del código puede leer `current_app.config['SECRET_KEY']` y obtener el valor correcto.

```python
    JWTManager(app)
```
Inicializa flask_jwt_extended con la app de Flask. A partir de este momento:
- `JWT_SECRET_KEY` (ya en la config) se usa para firmar y verificar tokens
- Los decoradores `@jwt_required()` funcionan en cualquier endpoint
- Los errores 401 se manejan automáticamente

No hace falta guardar la instancia en una variable — el efecto es el registro en la app.

```python
    authorizations = {
        'Bearer Auth': {
            'type': 'apiKey',
            'in': 'header',
            'name': 'Authorization',
            'description': "..."
        }
    }
```
Define el esquema de seguridad que Swagger UI mostrará en el botón **Authorize**:
- `'type': 'apiKey'` — le dice a Swagger que el token se envía como una clave de API, no como OAuth. Es la forma estándar de documentar JWT en Swagger/OpenAPI.
- `'in': 'header'` — el token va en el encabezado HTTP, no en la URL ni en el body.
- `'name': 'Authorization'` — nombre exacto del header que Flask espera. Cuando hacemos una petición autenticada, Flask recibe `Authorization: Bearer <token>`.
- La `description` es el texto que ve el usuario dentro del popup de Swagger cuando hace click en Authorize — le explica que tiene que escribir `Bearer <token>`.

Sin este dict, Swagger UI no muestra el candado ni el botón Authorize — los endpoints protegidos con `@jwt_required()` no se pueden testear desde la UI.

```python
    api = Api(
        app,
        doc='/api/docs',
        title='RecipeScanner API',
        version='1.0',
        description='API for scanning and managing recipes',
        security='Bearer Auth',
        authorizations=authorizations
    )
```
Inicializa flask_restx con la app y configura la UI de Swagger:
- `doc='/api/docs'` — ruta donde se sirve la interfaz Swagger UI
- `title` y `version` aparecen en la cabecera de la documentación
- `description` aparece como subtítulo
- `security='Bearer Auth'` — le dice a Swagger que **todos** los endpoints usan el esquema `'Bearer Auth'` por defecto. El nombre debe coincidir exactamente con la clave del dict `authorizations`.
- `authorizations=authorizations` — pasa el dict con la definición del esquema de seguridad.

A diferencia de JWTManager, **sí** guardamos la instancia en `api` porque la necesitamos inmediatamente para registrar los Namespaces.

```python
    from app.api.v1.auth import api as auth_ns
    api.add_namespace(auth_ns, path='/api/v1/auth')
```
Importa el Namespace de autenticación y lo registra en la app bajo la ruta `/api/v1/auth`.
El import está dentro de la función (no en el top del archivo) para evitar **circular imports** —
`auth.py` importa `facade`, `facade` importa modelos, los modelos no importan `__init__.py`,
pero si el import fuera al inicio del archivo podría haber conflictos de orden de carga.

```python
    from app.api.v1.recipes import api as recipes_ns
    api.add_namespace(recipes_ns, path='/api/v1/recipes')
```
Mismo patrón para el Namespace de recetas. Cada `add_namespace` registra todas las rutas
definidas con `@api.route(...)` dentro de ese archivo bajo el prefijo indicado.

```python
    return app
```
Retorna la instancia de Flask completamente configurada.
`run.py` va a recibir esta instancia y la va a usar para levantar el servidor.

---

### ¿Qué es `FLASK_ENV`?

`FLASK_ENV` es una variable de entorno que le dice a Flask en qué modo está corriendo.
Se define en el archivo `.env`:

```
FLASK_ENV=development
```

Cuando `create_app()` se ejecuta sin argumentos, lee esa variable y carga la configuración correspondiente:

```python
config_name = os.environ.get('FLASK_ENV', 'default')
# lee el .env → encuentra 'development' → carga DevelopmentConfig
```

**Sin `FLASK_ENV` habría que hardcodear el entorno en `run.py`:**
```python
app = create_app('development')  # ❌ hardcodeado
```

**Con `FLASK_ENV` en el `.env`:**
```python
app = create_app()  # ✅ lo resuelve solo leyendo el entorno
```

**La ventaja real aparece en producción:**
El servidor (Render, Railway) tiene `FLASK_ENV=production` definida como variable de entorno del servidor. 
La app carga `ProductionConfig` automáticamente, sin que el código sepa dónde está corriendo.

```
Desarrollo  → .env tiene FLASK_ENV=development   → carga DevelopmentConfig
Producción  → servidor tiene FLASK_ENV=production → carga ProductionConfig
Tests       → test pasa 'testing' explícitamente  → carga TestingConfig
```

---

## `backend/config.py`

```python
import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()
```

- `import os` — módulo estándar de Python para leer variables del sistema operativo.
- `load_dotenv()` — lee el archivo `.env` del proyecto y carga cada variable dentro de `os.environ`. 
  + Sin esta línea, `os.environ.get('SECRET_KEY')` devolvería `None` en desarrollo porque la variable no está exportada en el shell.

```python
class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-key-change-in-production')
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'dev-jwt-key-not-for-production')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=1)
```

- `Config` es la clase base. Todo lo que esté acá es compartido por los tres entornos.
- `SECRET_KEY` — clave usada internamente por Flask para firmar cookies y sesiones.
- `JWT_SECRET_KEY` — clave separada usada exclusivamente para firmar los tokens JWT.
  + Tener dos claves distintas es más seguro: rotar una no afecta a la otra.
- Ambas usan `os.environ.get(nombre, fallback)` — en producción deben estar definidas
  en el servidor; el fallback es solo para desarrollo.
- `SQLALCHEMY_TRACK_MODIFICATIONS = False` — desactiva una feature de Flask-SQLAlchemy que emite señales cada vez que se modifica un objeto.
  + No la usamos y consume memoria innecesariamente.
  + Flask muestra un warning si no se desactiva explícitamente.
  + Se define solo aquí en la clase base — las subclases lo heredan sin repetirlo.
- `JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=1)` — tiempo de vida del token JWT.
  + Por defecto flask_jwt_extended usa 15 minutos, lo cual es demasiado corto para hacer tests en Swagger UI tranquilamente.
  + `timedelta` viene del módulo estándar `datetime` de Python — representa una duración, no un momento en el tiempo.
  + `timedelta(hours=1)` → el token expira 1 hora después de haber sido creado.
  + En producción podría reducirse a 15-30 minutos por seguridad, pero para el MVP 1 hora es un balance razonable.

```python
class DevelopmentConfig(Config):
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///instance/development.db'
```

- Hereda todo de `Config` y solo sobreescribe lo que cambia.
- `DEBUG = True` — activa el modo debug de Flask: recarga automática al guardar   archivos y muestra errores detallados en el browser.
- `instance/development.db` — `instance/` es una carpeta especial de Flask pensada  para archivos que no van a Git: 
  + bases de datos locales, 
  + archivos de configuración con secretos, 
  + uploads. 
  + Se agrega al `.gitignore` automáticamente.

```python
class TestingConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
```

- `sqlite:///:memory:` — base de datos en RAM. 
  + Se crea al iniciar los tests y desaparece al terminar. 
  + Cada test arranca con una base limpia.

```python
class ProductionConfig(Config):
    DEBUG = False
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL')
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY')
```

- `DEBUG = False` — en producción nunca se muestran errores detallados al usuario  (expondrían información interna de la app).
- `DATABASE_URL` debe estar definida en el servidor de producción (Render, Railway, etc.). 
  + Su valor será algo como: `postgresql://usuario:password@host:5432/nombre_db`
- `JWT_SECRET_KEY` se sobreescribe aquí **sin fallback** — si la variable no está  definida en el servidor, vale `None` y la app falla al arrancar. 
    + Es deliberado: mejor fallar visiblemente al iniciar que correr en producción con una clave débil.

```python
config = {
    'development': DevelopmentConfig,
    'testing':     TestingConfig,
    'production':  ProductionConfig,
    'default':     DevelopmentConfig
}
```

- Diccionario que mapea nombres de entorno a clases. Permite que `create_app`   reciba un string como `'development'` y cargue la clase correcta sin usar `if/elif`. 
La clave `'default'` asegura que si no se especifica entorno, siempre se usa `DevelopmentConfig`.

---

## `backend/run.py`

Este archivo es el **punto de entrada** de la aplicación. 
Es el único archivo que ejecutamos directamente con `python run.py`. 
Su responsabilidad es mínima: crear la instancia de la app usando la factory y arrancar el servidor de desarrollo.

**¿Por qué existe run.py y no ponemos esto en app/__init__.py?**
Separar el punto de entrada de la lógica de construcción de la app permite que los  **tests**, el servidor de producción (**gunicorn**) y el **servidor de desarrollo** usen `create_app()` de maneras distintas sin interferirse entre sí. 
Gunicorn, por ejemplo, importa `app` desde `run.py` directamente sin llamar a `app.run()`.

```python
from app import create_app

app = create_app()

if __name__ == '__main__':
    app.run()
```

**Explicación línea por línea:**

```python
from app import create_app
```
Importa la función factory desde el paquete `app/`. 
Python ejecuta `app/__init__.py` y encuentra `create_app` ahí. 
Sin este import no podemos construir la app.

```python
app = create_app()
```
Llama a la factory sin argumentos. 
Internamente, `create_app` lee la variable `FLASK_ENV` del `.env` (gracias a `load_dotenv()` en `config.py`) y carga `DevelopmentConfig`. 
El resultado es una instancia de Flask completamente configurada con `SECRET_KEY`, `JWT_SECRET_KEY`, `SQLALCHEMY_DATABASE_URI`, etc.

```python
if __name__ == '__main__':
```
Bloque de guarda estándar de Python. 
`__name__` vale `'__main__'` solo cuando el archivo se ejecuta directamente (`python run.py`). 
Si otro módulo importa `run`, este bloque no se ejecuta. 
Esto permite que gunicorn (servidor de producción) importe `app` desde `run.py` sin iniciar el servidor de desarrollo.

```python
    app.run()
```
Inicia el servidor de desarrollo de Flask. 
Sin argumentos usa los valores por defecto: `host='127.0.0.1'` y `port=5000`. 
El servidor queda escuchando en `http://localhost:5000`.

---

### ¿Cómo arrancar el servidor?

Desde la carpeta `backend/` con el entorno virtual activo:

```bash
python run.py
```

Flask debería mostrar:
```
 * Running on http://127.0.0.1:5000
 * Debug mode: on
```

El modo debug está activo porque `DevelopmentConfig` tiene `DEBUG = True`.
Esto significa que Flask recarga el servidor automáticamente cuando guardas cambios en cualquier archivo Python.

---
---
---

# Sesión 2 — Sprint 1 · Modelos (`backend/app/models/`)

Los modelos son **dataclasses de Python puro**, sin SQLAlchemy todavía. 
Esto nos permite definir y probar la lógica de negocio completa antes de introducir una base de datos. 
En la Sesión 8, el swap a SQLAlchemy solo toca la capa de persistencia — los modelos no cambian.

**Nota — actualización tras revisar los mockups del diseño:**
Los campos de cada modelo se ajustaron para coincidir exactamente con la UI diseñada (formulario de registro, pantalla de detalle de receta, dashboard, pantalla de escaneo). 
Ver imágenes de referencia del proyecto.

**¿Qué es `dataclasses`?**
`dataclasses` es un módulo estándar de Python (incluido desde Python 3.7) que
permite crear clases pensadas para almacenar datos de forma simple. Sin él,
para crear una clase `User` necesitarías escribir manualmente el `__init__`,
el `__repr__` y el `__eq__`. Con `@dataclass`, Python los genera solo.

**Comparación — sin vs con `@dataclass`:**

Sin `@dataclass`:
```python
class User:
    def __init__(self, first_name, last_name, email, password_hash):
        self.first_name = first_name
        self.last_name = last_name
        self.email = email
        self.password_hash = password_hash

    def __repr__(self):
        return f"User(email={self.email})"

    def __eq__(self, other):
        return self.email == other.email
```

Con `@dataclass`:
```python
@dataclass
class User:
    first_name: str
    last_name: str
    email: str
    password_hash: str
```

Ambos son equivalentes. `@dataclass` genera los tres métodos automáticamente
leyendo los campos declarados con anotaciones de tipo (`first_name: str`, etc.).

**¿Qué significa `@dataclass`?**
El símbolo `@` indica un **decorador** — una función que envuelve a otra función
o clase y modifica su comportamiento. `@dataclass` es un decorador que toma la
clase `User` y le añade `__init__`, `__repr__` y `__eq__` antes de que Python
la cargue en memoria. No cambia la lógica — solo reduce el código repetitivo.

**¿Por qué `dataclasses` y no clases normales?**
`@dataclass` genera automáticamente `__init__`, `__repr__` y `__eq__` basándose en los campos declarados. 
Escribir menos código repetitivo y el comportamiento es predecible y testeable.

**¿Por qué UUID como id?**
UUID (Universally Unique Identifier) genera un string único garantizado sin necesitar una base de datos. 
En memoria, dos objetos creados al mismo tiempo nunca tendrán el mismo `id`. 
Cuando pasemos a SQLAlchemy, el id seguirá siendo un string UUID — no hay que cambiar nada en los modelos.

**Patrón de campos:**
- Los campos **sin default** van primero (son obligatorios al crear el objeto).
- Los campos **con default simple** van después (`category`, `status`, etc.).
- El campo `id` va al final con `default_factory` — se genera solo si no se
  pasa uno explícito. Esto permite recrear objetos desde la base de datos
  pasando el id existente.

---

## `backend/app/models/user.py`

```python
from dataclasses import dataclass, field
import uuid


@dataclass
class User:
    first_name: str
    last_name: str
    email: str
    password_hash: str
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
```

**Explicación línea por línea:**

```python
from dataclasses import dataclass, field
```
Importa dos cosas del módulo `dataclasses`:
- `dataclass` — el decorador que genera `__init__`, `__repr__` y `__eq__` automáticamente.
- `field` — función que permite configurar comportamiento especial en un campo,
  como `default_factory` para generar el `id` dinámicamente en cada instancia.

```python
import uuid
```
Módulo estándar de Python para generar UUIDs. Un UUID es un string de 36
caracteres como `'a3f1c2d4-7b8e-4c1a-9f2d-3e5b6c7d8e9f'` — único garantizado
sin necesitar una base de datos.

```python
@dataclass
class User:
```
El decorador `@dataclass` analiza los campos declarados con anotaciones de tipo
(`first_name: str`, etc.) y genera automáticamente:
- `__init__` — para crear instancias: `User('Julian', 'Gonzalez', 'j@mail.com', 'hash')`
- `__repr__` — para mostrar el objeto: `User(first_name='Julian', ...)`
- `__eq__` — para comparar dos objetos campo por campo

```python
    first_name: str
    last_name: str
    email: str
    password_hash: str
```
Campos **obligatorios** — deben pasarse al crear el objeto. 
- El tipo (`str`) es solo una anotación, Python no lo valida en runtime, pero documenta qué se espera en cada campo y lo usa `@dataclass` para generar el `__init__`.
- `password_hash` almacena el resultado de bcrypt — nunca la contraseña en texto plano.

```python
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
```
Campo **opcional** con valor por defecto generado. 
- `field(default_factory=...)` indica que el valor se genera llamando a la función `lambda` cada vez que se crea un `User` nuevo. 
- `uuid.uuid4()` genera un UUID aleatorio y `str()` lo convierte a string. 
- La `lambda:` 
  + es necesaria porque sin ella Python ejecutaría `uuid.uuid4()` una sola vez al cargar el módulo y todos los objetos compartirían el mismo id.

**Campos:**

- `first_name` / `last_name` — separados porque el formulario de registro los pide por separado y el dashboard los muestra combinados ("JULIAN GONZALEZ", iniciales "JG").
- `email` — identificador único de login.
- `password_hash` — hash de bcrypt. Nunca la contraseña en texto plano.
- `id` — UUID generado automáticamente.

---

## `backend/app/models/recipe.py`

```python
from dataclasses import dataclass, field
import uuid


@dataclass
class Recipe:
    title: str
    user_id: str
    description: str = ''
    servings: int = 0
    prep_time_min: int = 0
    category: str = ''
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
```

**Campos:**

- `title` — nombre de la receta. Obligatorio.
- `user_id` — UUID del usuario propietario. FK → User en SQLAlchemy (Sesión 8).
- `description` — descripción opcional. Default vacío porque Groq puede no
  extraerla del PDF.
- `servings` — número de porciones. Mostrado en el detalle de receta.
- `prep_time_min` — tiempo de preparación en minutos. Mostrado en el detalle.
- `category` — categoría de la receta (`'Pasta'`, `'Meat'`, `'Dessert'`, etc.).
  Usada para los filtros del dashboard.
- `id` — UUID generado automáticamente.

---

## `backend/app/models/ingredient.py`

```python
from dataclasses import dataclass, field
import uuid


@dataclass
class Ingredient:
    name: str
    quantity: str
    unit: str
    recipe_id: str
    off_product_id: str = ''
    estimated_cost: float = 0.0
    cost_is_manual: bool = False
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
```

**Campos:**

- `name` — nombre del ingrediente.
- `quantity` — cantidad como string. 
  + Se mantiene `str` (no `float`) porque Groq puede devolver valores como `"al gusto"` o `"una pizca"` que no se pueden convertir a número sin romper el flujo.
- `unit` — unidad de medida: `"g"`, `"ml"`, `"unit"`, `"tbsp"`, etc.
- `recipe_id` — UUID de la receta a la que pertenece.
- `off_product_id` — ID del producto en Open Food Facts. 
  + Vacío hasta que se consulte la API. 
  + Permite evitar consultas repetidas al mismo ingrediente.
- `estimated_cost` — precio estimado en euros, obtenido de Open Food Facts.
  + Default `0.0`. 
  + Si `cost_is_manual` es True, este valor fue editado por el usuario y no se sobreescribe en futuras consultas a la API.
- `cost_is_manual` — flag que indica si el precio fue editado manualmente.
  + La UI muestra "Prices fetched from Open Food Facts — tap to edit". 
  + Cuando el usuario edita el precio, este flag se activa y la API externa deja de sobreescribirlo.
- `id` — UUID generado automáticamente.

---

## `backend/app/models/step.py`

```python
from dataclasses import dataclass, field
import uuid


@dataclass
class Step:
    order_num: int
    description: str
    recipe_id: str
    duration_min: int = 0
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
```

**Campos:**

- `order_num` — posición del paso (1, 2, 3...). `int` porque los pasos se ordenan numéricamente para mostrarlos en secuencia. Se llama `order_num` y no `order` porque `order` es una palabra reservada en SQL — usar `order` como nombre de columna requeriría escaparlo en cada query.
- `description` — texto del paso.
- `recipe_id` — UUID de la receta a la que pertenece.
- `duration_min` — duración estimada en minutos. Mostrada como badge en la UI ("30 min", "10 min"). Default `0` cuando Groq no extrae la duración.
- `id` — UUID generado automáticamente.

---

## `backend/app/models/pdf_scan.py`

```python
from dataclasses import dataclass, field
import uuid


@dataclass
class PdfScan:
    filename: str
    recipe_id: str
    status: str = 'pending'
    scanned_at: str = ''
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
```

**Campos:**

- `filename` — nombre original del archivo PDF subido.
- `recipe_id` — UUID de la receta generada a partir de este escaneo.
- `status` — estado del procesamiento: `'pending'`, `'processing'`, `'done'`,
  `'error'`. 
  + Default `'pending'` porque al crear el objeto el PDF todavía no fue procesado.
- `scanned_at` — timestamp de cuándo se completó el escaneo. 
  + Se guarda como string ISO (`'2025-05-10T14:30:00'`) para evitar depender de `datetime` en la fase de memoria. 
  + En SQLAlchemy (Sesión 8) se convertirá a `DateTime`.
- `id` — UUID generado automáticamente.

---

## Resumen de campos por modelo

| Modelo | Campos obligatorios | Campos con default |
|---|---|---|
| `User` | `first_name`, `last_name`, `email`, `password_hash` | `id` (UUID) |
| `Recipe` | `title`, `user_id` | `description=''`, `servings=0`, `prep_time_min=0`, `category=''`, `id` (UUID) |
| `Ingredient` | `name`, `quantity`, `unit`, `recipe_id` | `off_product_id=''`, `estimated_cost=0.0`, `cost_is_manual=False`, `id` (UUID) |
| `Step` | `order_num`, `description`, `recipe_id` | `duration_min=0`, `id` (UUID) |
| `PdfScan` | `filename`, `recipe_id` | `status='pending'`, `scanned_at=''`, `id` (UUID) |

---
---
---

# Sesión 3 — Sprint 2 · Repository Pattern (`backend/app/persistence/repository.py`)

## ¿Qué es el Repository Pattern?

El **Repository Pattern** es un patrón de diseño que separa la lógica de negocio del acceso a datos. 
En lugar de que la Facade llame directamente a la base de datos, llama a un repositorio que se encarga de guardar y recuperar objetos.

**Ventaja clave — intercambiabilidad:**
La Facade no sabe si los datos están en **RAM**, en **SQLite** o en **PostgreSQL**. 
Solo conoce la interfaz del repositorio. 
Esto permite que en la Sesión 8 cambiemos `InMemoryStorage` por `SQLAlchemyRepository` sin tocar una sola línea de la Facade ni de la API.

```
Sesión 3-7:  Facade → InMemoryStorage (RAM)
Sesión 8:    Facade → SQLAlchemyRepository  ← solo cambia esta línea
```

**¿Por qué todo en un solo archivo?**
A diferencia de tener `repository.py` y `memory_storage.py` separados, ponemos todo en `repository.py`. 
Es la misma decisión que tomamos en HBnB — más simple de navegar, y todas las implementaciones del patrón viven juntas. 
-   `memory_storage.py` queda vacío y se puede eliminar.

**¿Qué es una ABC (Abstract Base Class)?**
Una ABC es una clase que define una interfaz — declara qué métodos deben existir
sin implementarlos. 
Cualquier clase que herede de ella está obligada a implementar esos métodos. 
Si no lo hace, Python lanza un error al instanciarla.

Es el equivalente a un contrato: `InMemoryStorage` y `SQLAlchemyRepository`
firman ese contrato cuando heredan de `BaseRepository`.

---

## `backend/app/persistence/repository.py`

```python
from abc import ABC, abstractmethod


class BaseRepository(ABC):

    @abstractmethod
    def get_all(self):
        pass

    @abstractmethod
    def get_by_id(self, obj_id):
        pass

    @abstractmethod
    def get_by_attribute(self, attr_name, attr_value):
        pass

    @abstractmethod
    def save(self, obj):
        pass

    @abstractmethod
    def update(self, obj):
        pass

    @abstractmethod
    def delete(self, obj_id):
        pass


class InMemoryStorage(BaseRepository):

    def __init__(self):
        self._storage = {}

    def get_all(self):
        return list(self._storage.values())

    def get_by_id(self, obj_id):
        return self._storage.get(obj_id)

    def get_by_attribute(self, attr_name, attr_value):
        return next(
            (obj for obj in self._storage.values()
             if getattr(obj, attr_name) == attr_value),
            None
        )

    def save(self, obj):
        self._storage[obj.id] = obj
        return obj

    def update(self, obj):
        self._storage[obj.id] = obj
        return obj

    def delete(self, obj_id):
        self._storage.pop(obj_id, None)


# SQLAlchemyRepository — Session 8
```

**Explicación línea por línea:**

```python
from abc import ABC, abstractmethod
```
Importa del módulo estándar `abc`:
- `ABC` — convierte la clase en abstracta, no se puede instanciar directamente.
- `abstractmethod` — decorador que obliga a las subclases a implementar el método.
  + Si no lo hacen, Python lanza `TypeError` al intentar instanciarlas.

```python
class BaseRepository(ABC):
```
Define el contrato. 
No se puede hacer `BaseRepository()` — solo sirve como interfaz que `InMemoryStorage` y `SQLAlchemyRepository` deben cumplir.

**Los 6 métodos abstractos:**
- `get_all()` — retorna todos los objetos almacenados
- `get_by_id(obj_id)` — retorna un objeto por UUID, o `None` si no existe
- `get_by_attribute(attr_name, attr_value)` — busca un objeto por cualquier campo
- `save(obj)` — guarda un objeto nuevo, retorna el objeto
- `update(obj)` — actualiza un objeto existente, retorna el objeto
- `delete(obj_id)` — elimina un objeto por UUID

```python
class InMemoryStorage(BaseRepository):
```
Implementación concreta que usa RAM. 
Hereda de `BaseRepository` e implementa los 6 métodos. 
Al no ser abstracta, puede instanciarse.

```python
    def __init__(self):
        self._storage = {}
```
-   Diccionario `{ uuid: objeto }`. 
-   El `_` indica que es privado — solo la clase lo usa directamente. 

Ejemplo de contenido:
```python
{
  'a3f1c2d4-...': User(first_name='Julian', ...),
  'b7e2f3a1-...': User(first_name='Maria', ...)
}
```
---
```python
    def get_by_attribute(self, attr_name, attr_value):
        return next(
            (obj for obj in self._storage.values()
             if getattr(obj, attr_name) == attr_value),
            None
        )
```
Método genérico para buscar por cualquier campo sin necesitar métodos específicos como `get_by_email`. 
-   `getattr(obj, attr_name)` lee dinámicamente el atributo con ese nombre del objeto. 
-   `next(..., None)` retorna el primer resultado o `None` si no encuentra ninguno. Ejemplos de uso:
```python
storage.get_by_attribute('email', 'julian@test.com')
storage.get_by_attribute('recipe_id', 'a3f1-...')
```
---
```python
    def save(self, obj):
        self._storage[obj.id] = obj
        return obj

    def update(self, obj):
        self._storage[obj.id] = obj
        return obj
```
En memoria ambos son idénticos — sobreescriben la clave con el objeto.
La distinción es semántica y se vuelve real en `SQLAlchemyRepository`:
-   `save` hace `INSERT`, 
-   `update` hace `UPDATE`.

```python
    def delete(self, obj_id):
        self._storage.pop(obj_id, None)
```
`pop(key, None)` elimina la clave si existe, no hace nada si no existe.

---

### ¿Por qué una instancia por entidad?

La Facade tendrá una instancia de `InMemoryStorage` por cada tipo de objeto:

```python
self._users       = InMemoryStorage()
self._recipes     = InMemoryStorage()
self._ingredients = InMemoryStorage()
self._steps       = InMemoryStorage()
self._pdf_scans   = InMemoryStorage()
```

Cada instancia tiene su propio `_storage` dict independiente — espeja la estructura de la base de datos (una tabla por entidad).
En la Sesión 8, cada `InMemoryStorage()` se reemplaza por `SQLAlchemyRepository(ModelClass)`.

---
---
---

# Sesión 4 — Sprint 2 · Autenticación (`utils/security.py` + `api/v1/auth.py`)
## Decisiones técnicas de esta sesión

**`flask_jwt_extended` en lugar de `PyJWT` manual**

- Usamos `flask_jwt_extended` — la misma librería que en HBnB. 
- Proporciona el decorador `@jwt_required()` y las funciones `create_access_token` / `get_jwt_identity` que ya conocemos. 
- Hacerlo manual con `PyJWT` requeriría escribir las funciones de encode/decode nosotros, más código sin beneficio real.

**`utils/security.py` sigue siendo necesario**
Aunque `flask_jwt_extended` maneja los tokens, bcrypt (hash de contraseñas) no está incluido. 
-   `security.py` tendrá dos funciones simples: 
    +   `hash_password`
    +   `check_password`
-   Son funciones puras — sin estado, sin dependencias de Flask.

### **¿Por qué un archivo separado y no dentro del modelo `User`?**

En HBnB el hash se hacía directamente en el `__init__` del modelo `User`:

```python
# HBnB — el modelo hacía el hash
class User(BaseModel):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if 'password' in kwargs:
            self.password = bcrypt.hashpw(
                kwargs['password'].encode('utf-8'), bcrypt.gensalt()
            ).decode('utf-8')
```

En RecipeScanner no podemos hacer eso porque **nuestros modelos son `@dataclass`** — son contenedores de datos puros sin métodos ni lógica. 
No tienen un `__init__` donde insertar lógica de hash.

Pero más allá de eso, separar el hash en `security.py` es mejor diseño porque **separa responsabilidades**: el modelo solo almacena datos, `security.py` es el único lugar que sabe cómo se procesan las contraseñas. 
Si mañana se cambia bcrypt por argon2, solo se modifica ese archivo — sin tocar modelos ni endpoints.

```
HBnB:          User.__init__() → hace el hash → guarda en self.password
RecipeScanner: auth.py → security.hash_password() → Facade → User (recibe el hash ya procesado)
```

#### **No hay `utils/jwt_helper.py`**
Estaba planificado originalmente, pero `flask_jwt_extended` lo reemplaza por completo.
No tiene sentido crear un archivo que solo envuelva funciones que ya existen en la librería.

#### **`flask_restx` en lugar de Blueprint puro**
Usamos `flask_restx` porque el objetivo es convertir **RecipeScanner** en una app móvil.
Un cliente móvil es un consumidor externo de la API que necesita documentación Swagger.
Además agrega validación automática de input con `api.model()`. 
**Ver decisión #8 en DEVLOG.md.**

####    **`JWT_SECRET_KEY` en `config.py`**
`flask_jwt_extended` lee automáticamente `JWT_SECRET_KEY` de la configuración de Flask. 
Ya lo tenemos definido en `config.py` — no hay que configurar nada adicional.

---

## `backend/app/utils/security.py`

```python
import bcrypt


def hash_password(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def check_password(password, hashed):
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
```

### **Explicación línea por línea:**

```python
import bcrypt
```
Librería de hashing diseñada específicamente para contraseñas. 
A diferencia de SHA-256 o MD5, bcrypt es **lento por diseño** — incluye un factor de costo configurable que hace que calcular el hash tome tiempo. 
Esto hace que los ataques de fuerza bruta sean impracticables.

```python
def hash_password(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
```
- `bcrypt.hashpw(password_bytes, salt)` — función principal de bcrypt. 
    +   Toma la contraseña en bytes y un salt, aplica el algoritmo bcrypt (que es intencionalmente lento y computacionalmente costoso), y devuelve el hash final en bytes. 
    +    El resultado incluye el salt embebido, el factor de costo y el hash — todo en una sola string.
- `password.encode('utf-8')` — bcrypt trabaja con bytes, no con strings.
    +   `encode` convierte el string a bytes.
- `bcrypt.gensalt()` — genera un **salt** aleatorio.
    +   Un salt es una cadena de caracteres aleatorios que se agrega a la contraseña **antes** de hashearla.
    +   Sin salt: `hash("password123")` siempre produce el mismo resultado → un atacante puede precomputar una tabla de hashes de contraseñas comunes (llamada *rainbow table*) y compararla contra tu base de datos.
    +   Con salt: `hash("password123" + "xK9$mQ")` produce un resultado distinto cada vez → las rainbow tables no sirven porque habría que precomputar una tabla diferente para cada salt posible.
    +   El salt **no es secreto** — se guarda junto al hash en la base de datos. Su propósito no es ocultar el salt sino hacer que cada hash sea único e impracticable de precomputar.
    +   El hash final que guarda bcrypt tiene este formato: `$2b$12$<22 caracteres de salt><31 caracteres de hash>` — todo en una sola string.
- `.decode('utf-8')` — convierte el resultado de bytes a string para guardarlo en el modelo `User`.

```
hash_password("password123")

  "password123"
       │
       ▼
  .encode('utf-8')
       │
       ▼
  b"password123"  ──┐
                    │
  bcrypt.gensalt()  │   genera salt aleatorio, ej: b"$2b$12$xK9mQpLzR..."
       │            │
       ▼            │
  salt ────────────►  bcrypt.hashpw(password_bytes, salt)
                              │
                              ▼
                    b"$2b$12$xK9mQpLzR...<hash>"  (bytes)
                              │
                              ▼
                         .decode('utf-8')
                              │
                              ▼
              "$2b$12$xK9mQpLzR...<hash>"  ← se guarda en User.password_hash
```

```python
def check_password(password, hashed):
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
```
- Recibe la contraseña en texto plano y el hash guardado en la base de datos.
- `bcrypt.checkpw` extrae el salt del hash, lo aplica a la contraseña y compara.
  Retorna `True` si coinciden, `False` si no.
- No hay que extraer el salt manualmente — bcrypt lo hace internamente.

```
check_password("password123", "$2b$12$xK9mQpLzR...<hash>")

  "password123"                    "$2b$12$xK9mQpLzR...<hash>"
       │                                      │
       ▼                                      ▼
  .encode('utf-8')                     .encode('utf-8')
       │                                      │
       ▼                                      ▼
  b"password123"              b"$2b$12$xK9mQpLzR...<hash>"
       │                                      │
       └──────────────┬───────────────────────┘
                      ▼
            bcrypt.checkpw(password_bytes, hashed_bytes)
                      │
                      │  extrae el salt del hash guardado
                      │  aplica ese mismo salt a "password123"
                      │  compara el resultado con el hash guardado
                      │
                      ▼
               True  ─── contraseña correcta → login OK
               False ─── contraseña incorrecta → 401
```

---

## `backend/app/utils/__init__.py`

Vacío. Solo existe para que Python reconozca `utils/` como paquete y permita
`from app.utils.security import hash_password`.

---

## `backend/app/api/v1/auth.py`

Usamos `flask_restx` — mismo patrón que HBnB. 
Ventajas: 
-   Swagger automático en `/api/docs`
-   Validación de input con `api.model()`
-   Preparado para una futura app móvil

```python
from flask_restx import Namespace, Resource, fields
from flask_jwt_extended import create_access_token
from app.services.facade import facade
from app.utils.security import check_password

api = Namespace('auth', description='Authentication operations')

register_model = api.model('Register', {
    'first_name': fields.String(required=True, description='First name'),
    'last_name': fields.String(required=True, description='Last name'),
    'email': fields.String(required=True, description='User email'),
    'password': fields.String(required=True, description='User password')
})

login_model = api.model('Login', {
    'email': fields.String(required=True, description='User email'),
    'password': fields.String(required=True, description='User password')
})


@api.route('/register')
class Register(Resource):
    @api.expect(register_model)
    @api.response(201, 'User created successfully')
    @api.response(400, 'Email already registered')
    def post(self):
        data = api.payload

        if facade.get_user_by_email(data['email']):
            return {'error': 'Email already registered'}, 400

        user = facade.register_user(
            first_name=data['first_name'],
            last_name=data['last_name'],
            email=data['email'],
            password=data['password']
        )
        return {'message': 'User created successfully', 'user_id': user.id}, 201


@api.route('/login')
class Login(Resource):
    @api.expect(login_model)
    @api.response(200, 'Login successful')
    @api.response(401, 'Invalid credentials')
    def post(self):
        data = api.payload

        user = facade.get_user_by_email(data['email'])
        if not user or not check_password(data['password'], user.password_hash):
            return {'error': 'Invalid credentials'}, 401

        token = create_access_token(identity=user.id)
        return {'token': token, 'user': {
            'id': user.id,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'email': user.email
        }}, 200
```

### **Explicación línea por línea:**

```python
from flask_restx import Namespace, Resource, fields
```
- `Namespace` — equivalente al `Blueprint` de Flask pero para **flask_restx**.
  + Agrupa endpoints relacionados y aparece como sección en Swagger.
- `Resource` — clase base para cada endpoint. 
    +   Los métodos `get`, `post`, `put`, `delete` mapean directamente a los verbos HTTP.
- `fields` — tipos de datos para definir los modelos de input/output que aparecen en la documentación Swagger.

```python
api = Namespace('auth', description='Authentication operations')
```
Crea el **Namespace**. 
Se registrará en `create_app()` con `api.add_namespace(auth_ns, path='/api/v1/auth')`.

```python
register_model = api.model('Register', {
    'first_name': fields.String(required=True, ...),
    ...
})
```
Define el esquema del body esperado. 
`flask_restx` usa esto para:
1. Mostrar el formato en Swagger UI
2. Validar automáticamente que los campos `required=True` estén presentes

#### Clase Register
```python
@api.route('/register')
class Register(Resource):
```
El decorador `@api.route` asocia la clase al endpoint. 
Cada método HTTP se define como un método de la clase: `def post(self)` maneja `POST /register`.

```python
    @api.expect(register_model)
```
Le dice a flask_restx qué modelo espera en el body. 
Aparece en Swagger como el esquema de input y valida que los campos required estén presentes.

```python
        data = api.payload
```
Equivalente a `request.get_json()` en Blueprint puro. 
`api.payload` lee el body JSON de la petición. 
Más limpio que acceder a `request` directamente.

```python
        if facade.get_user_by_email(data['email']):
            return {'error': 'Email already registered'}, 400
```
Retorna un dict + código de estado — la sintaxis de flask_restx. 
No necesita `jsonify()` porque flask_restx serializa el dict automáticamente.

```python
        token = create_access_token(identity=user.id)
```
`identity` es el dato que se guarda en el token y que recuperamos después con `get_jwt_identity()`. Usamos `user.id` (UUID string).

---

#### Clase `Login`

```python
@api.route('/login')
class Login(Resource):
```
Asocia la clase al endpoint `POST /api/v1/auth/login`.
Mismo patrón que `Register` — método `post(self)` maneja el verbo HTTP POST.

```python
    @api.expect(login_model)
    @api.response(200, 'Login successful')
    @api.response(401, 'Invalid credentials')
```
- `@api.expect(login_model)` — valida que el body tenga `email` y `password`.
  Si falta alguno, flask_restx responde 400 automáticamente antes de llegar al código.
- `@api.response(200, ...)` y `@api.response(401, ...)` — documentan en Swagger
  qué códigos de estado puede devolver este endpoint y qué significan.

```python
        data = api.payload
```
Lee el body JSON de la petición. Equivalente a `request.get_json()`.

```python
        user = facade.get_user_by_email(data['email'])
```
Busca en el almacenamiento si existe un usuario con ese email.
Retorna el objeto `User` si lo encuentra, `None` si no existe.
La Facade encapsula esta consulta — el endpoint no sabe si los datos vienen de memoria o de una base de datos.

```python
        if not user or not check_password(data['password'], user.password_hash):
            return {'error': 'Invalid credentials'}, 401
```
Dos condiciones en una sola línea:
- `not user` — el email no existe en el sistema.
- `not check_password(...)` — el email existe pero la contraseña es incorrecta.

Ambos casos retornan el **mismo error** (`'Invalid credentials'`) — no se le
dice al atacante si el email existe o no. Si dijéramos `'Email not found'` cuando
el email no existe, estaríamos confirmando qué emails están registrados.

```python
        token = create_access_token(identity=user.id)
```
Genera un token JWT firmado con `JWT_SECRET_KEY`.
- `identity=user.id` — el UUID del usuario queda embebido en el token.
- En cualquier endpoint protegido, `get_jwt_identity()` extrae ese UUID para saber qué usuario está haciendo la petición.
- El token tiene una fecha de expiración — por defecto 15 minutos en flask_jwt_extended.
    +   Configurable con `JWT_ACCESS_TOKEN_EXPIRES` en `config.py`.

```python
        return {'token': token, 'user': {
            'id': user.id,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'email': user.email
        }}, 200
```
Retorna el token + datos básicos del usuario. 
Puntos importantes:
- `password_hash` **no se incluye** — nunca se devuelve al cliente.
- El cliente guarda el `token` y lo envía en cada petición siguiente en el header `Authorization: Bearer <token>`.
- El `user` en la respuesta es para que el frontend pueda mostrar el nombre del usuario sin necesidad de hacer otra petición.

#### Clase `Me` — `GET /api/v1/auth/me`

Endpoint para obtener los datos del usuario actualmente autenticado.

```python
@api.route('/me')
class Me(Resource):
    @jwt_required()
    @api.response(200, 'Current user data')
    @api.response(404, 'User not found')
    def get(self):
        user_id = get_jwt_identity()
        user = facade.get_user_by_id(user_id)
        if not user:
            return {'error': 'User not found'}, 404
        return {
            'id': user.id,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'email': user.email
        }, 200
```

**¿Por qué necesitamos este endpoint?**

Cuando el usuario hace login, el servidor devuelve un token JWT. Ese token **no contiene los datos del usuario en texto plano visible** — solo tiene un `user_id` encriptado en el payload.

El frontend necesita saber quién está logueado para:
- Mostrar el nombre en la navbar: *"Bienvenido, Julian"*
- Verificar que el token sigue siendo válido (si el token expiró, este endpoint devuelve 401)
- Acceder al perfil sin guardar datos sensibles en el cliente

Sin `GET /me`, el frontend tendría que guardar el nombre y email en `localStorage` después del login — lo cual es menos seguro y puede quedar desactualizado.

**Flujo completo:**

```
POST /auth/login → recibe token
         ↓
GET /auth/me (Authorization: Bearer <token>)
         ↓
flask_jwt_extended decodifica el token → extrae user_id
         ↓
facade.get_user_by_id(user_id) → busca el User en storage
         ↓
{ id, first_name, last_name, email }  ← nunca password_hash
```

**Diferencia con el response del login:**

`POST /login` también devuelve datos del usuario, pero solo una vez (en el momento del login).
`GET /me` es reutilizable en cualquier momento — el frontend puede llamarlo al cargar la página para restaurar el estado de sesión sin hacer login de nuevo.

**Imports agregados:**

```python
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
```

`jwt_required` y `get_jwt_identity` ya los teníamos en otros endpoints — se agregan a la línea existente del import en `auth.py`.

---

## `backend/app/__init__.py` actualizado

`app/__init__.py` ya está actualizado para usar `Api` de flask_restx:

```python
import os
from flask import Flask
from flask_restx import Api
from flask_jwt_extended import JWTManager
from config import config


def create_app(config_name=None):
    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'default')

    app = Flask(__name__)
    app.config.from_object(config[config_name])

    JWTManager(app)

    api = Api(
        app,
        doc='/api/docs',
        title='RecipeScanner API',
        version='1.0',
        description='API for scanning and managing recipes'
    )

    # Initialize extensions here (Phase 8 — SQLAlchemy)

    # Register namespaces here (Phases 4-6 — auth, recipes, scan)
    from app.api.v1.auth import api as auth_ns
    api.add_namespace(auth_ns, path='/api/v1/auth')

    return app
```

- `Api(app, doc='/api/docs')` — inicializa flask_restx y expone Swagger UI en `http://localhost:5000/api/docs`.
- `JWTManager(app)` — inicializa flask_jwt_extended para que `@jwt_required()` funcione.
- `api.add_namespace(auth_ns, path='/api/v1/auth')` — registra el Namespace con el prefijo de URL.

---
---
---

# Sesión 5 — Sprint 3 · Facade + API de Recetas (`services/facade.py` + `api/v1/recipes.py`)
## ¿Qué es la Facade?

El **Facade Pattern** (Patrón Fachada) es un punto de entrada único para toda la lógica de negocio. 
Los endpoints de la API nunca tocan el repositorio directamente — siempre pasan por la Facade.

```
auth.py  ──┐
           │
recipes.py ──► RecipeScannerFacade ──► InMemoryStorage (users)
           │                      ──► InMemoryStorage (recipes)
scan.py  ──┘                      ──► InMemoryStorage (ingredients)
                                  ──► InMemoryStorage (steps)
```

**¿Por qué este patrón?**
- Un solo lugar para cambiar cuando se swapea a **SQLAlchemy** en la Sesión 8.
- Los endpoints no saben si los datos vienen de memoria o de base de datos.
- Si la lógica de negocio cambia (ej: validar que una receta tenga al menos un ingrediente), se modifica en la Facade — sin tocar los endpoints.

**¿Cómo se comparó en HBnB?**
En HBnB también usamos Facade. 
La diferencia es que RecipeScanner tiene un solo `facade` instanciado al final del archivo — una instancia compartida por toda la app.

---

## `backend/app/services/facade.py`

```python
from app.persistence.repository import InMemoryStorage
from app.models.user import User
from app.models.recipe import Recipe
from app.models.ingredient import Ingredient
from app.models.step import Step
from app.utils.security import hash_password


class RecipeScannerFacade:

    def __init__(self):
        self._users = InMemoryStorage()
        self._recipes = InMemoryStorage()
        self._ingredients = InMemoryStorage()
        self._steps = InMemoryStorage()

    # --- Users ---

    def register_user(self, first_name, last_name, email, password):
        user = User(
            first_name=first_name,
            last_name=last_name,
            email=email,
            password_hash=hash_password(password)
        )
        return self._users.save(user)

    def get_user_by_email(self, email):
        return self._users.get_by_attribute('email', email)

    def get_user_by_id(self, user_id):
        return self._users.get_by_id(user_id)

    # --- Recipes ---

    def create_recipe(self, user_id, title, description='',
                      servings=0, prep_time_min=0, category=''):
        recipe = Recipe(
            title=title,
            user_id=user_id,
            description=description,
            servings=servings,
            prep_time_min=prep_time_min,
            category=category
        )
        return self._recipes.save(recipe)

    def get_recipe(self, recipe_id):
        return self._recipes.get_by_id(recipe_id)

    def get_recipes_by_user(self, user_id):
        return [r for r in self._recipes.get_all() if r.user_id == user_id]

    def update_recipe(self, recipe_id, **kwargs):
        recipe = self._recipes.get_by_id(recipe_id)
        if not recipe:
            return None
        for key, value in kwargs.items():
            if hasattr(recipe, key):
                setattr(recipe, key, value)
        return self._recipes.update(recipe)

    def delete_recipe(self, recipe_id):
        self._recipes.delete(recipe_id)

    # --- Ingredients ---

    def add_ingredient(self, recipe_id, name, quantity, unit):
        ingredient = Ingredient(
            name=name,
            quantity=quantity,
            unit=unit,
            recipe_id=recipe_id
        )
        return self._ingredients.save(ingredient)

    def get_ingredients_by_recipe(self, recipe_id):
        return [i for i in self._ingredients.get_all() if i.recipe_id == recipe_id]

    def update_ingredient(self, ingredient_id, **kwargs):
        ingredient = self._ingredients.get_by_id(ingredient_id)
        if not ingredient:
            return None
        for key, value in kwargs.items():
            if hasattr(ingredient, key):
                setattr(ingredient, key, value)
        return self._ingredients.update(ingredient)

    def delete_ingredient(self, ingredient_id):
        self._ingredients.delete(ingredient_id)


facade = RecipeScannerFacade()
```

**Explicación línea por línea:**

```python
from app.persistence.repository import InMemoryStorage
```
Importa la implementación en memoria del repositorio. 
En la Sesión 8 este import cambiará a `SQLAlchemyRepository` — sin tocar ningún otro archivo.

```python
from app.utils.security import hash_password
```
La Facade es responsable de hashear la contraseña antes de crear el usuario.
El endpoint solo pasa la contraseña en texto plano — no sabe nada de **bcrypt**.

```python
    def __init__(self):
        self._users = InMemoryStorage()
        self._recipes = InMemoryStorage()
        self._ingredients = InMemoryStorage()
        self._steps = InMemoryStorage()
```
Cuatro repositorios independientes — uno por entidad. 
El underscore `_` indica que son atributos privados: solo la Facade los usa, nadie externo accede a ellos.

### register_user()
```python
    def register_user(self, first_name, last_name, email, password):
        user = User(
            ...
            password_hash=hash_password(password)
        )
        return self._users.save(user)
```
-   Crea el objeto `User` con la contraseña ya hasheada. 
-   El modelo `User` recibe `password_hash` — nunca recibe la contraseña en texto plano. 
-   `save()` lo guarda en el diccionario `_storage` del repositorio y retorna el mismo objeto.

### get_recipes_by_user()
```python
    def get_recipes_by_user(self, user_id):
        return [r for r in self._recipes.get_all() if r.user_id == user_id]
```
-   List comprehension que filtra todas las recetas por `user_id`. 
-   Cada usuario solo ve sus propias recetas. 
-   En la Sesión 8 esto se reemplazará por una consulta SQL con `WHERE user_id = :id` — más eficiente para grandes volúmenes de datos.

### update_recipe()
```python
    def update_recipe(self, recipe_id, **kwargs):
        recipe = self._recipes.get_by_id(recipe_id)
        if not recipe:
            return None
        for key, value in kwargs.items():
            if hasattr(recipe, key):
                setattr(recipe, key, value)
        return self._recipes.update(recipe)
```
- `**kwargs` — acepta cualquier combinación de campos a actualizar (título, descripción, etc.).
    +   El endpoint puede enviar solo los campos que cambiaron.
- `hasattr(recipe, key)` — protección: ignora campos que no existen en el modelo, para que nadie pueda inyectar atributos arbitrarios.
- `setattr(recipe, key, value)` — modifica el atributo del objeto dinámicamente.

### Instance Facade
```python
facade = RecipeScannerFacade()
```
-   Instancia única creada al final del archivo. 
-   Todos los endpoints importan este mismo objeto: `from app.services.facade import facade`. 
-   Como `InMemoryStorage` usa un diccionario en memoria, esta instancia compartida es el "almacenamiento" durante toda la vida del servidor.

---

## `backend/app/api/v1/recipes.py`

```python
from flask_restx import Namespace, Resource, fields
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.facade import facade

api = Namespace('recipes', description='Recipe management')

recipe_model = api.model('Recipe', {
    'title': fields.String(required=True, description='Recipe title'),
    'description': fields.String(description='Recipe description'),
    'servings': fields.Integer(description='Number of servings'),
    'prep_time_min': fields.Integer(description='Preparation time in minutes'),
    'category': fields.String(description='Recipe category')
})

recipe_update_model = api.model('RecipeUpdate', {
    'title': fields.String(description='Recipe title'),
    'description': fields.String(description='Recipe description'),
    'servings': fields.Integer(description='Number of servings'),
    'prep_time_min': fields.Integer(description='Preparation time in minutes'),
    'category': fields.String(description='Recipe category')
})


@api.route('/')
class RecipeList(Resource):

    @jwt_required()
    @api.response(200, 'List of user recipes')
    def get(self):
        user_id = get_jwt_identity()
        recipes = facade.get_recipes_by_user(user_id)
        return [{'id': r.id, 'title': r.title, 'description': r.description,
                 'servings': r.servings, 'prep_time_min': r.prep_time_min,
                 'category': r.category, 'user_id': r.user_id}
                for r in recipes], 200

    @jwt_required()
    @api.expect(recipe_model)
    @api.response(201, 'Recipe created')
    def post(self):
        user_id = get_jwt_identity()
        data = api.payload
        recipe = facade.create_recipe(
            user_id=user_id,
            title=data['title'],
            description=data.get('description', ''),
            servings=data.get('servings', 0),
            prep_time_min=data.get('prep_time_min', 0),
            category=data.get('category', '')
        )
        return {'id': recipe.id, 'title': recipe.title,
                'user_id': recipe.user_id}, 201


@api.route('/<string:recipe_id>')
class RecipeDetail(Resource):

    @jwt_required()
    @api.response(200, 'Recipe found')
    @api.response(404, 'Recipe not found')
    def get(self, recipe_id):
        recipe = facade.get_recipe(recipe_id)
        if not recipe:
            return {'error': 'Recipe not found'}, 404
        return {'id': recipe.id, 'title': recipe.title,
                'description': recipe.description, 'servings': recipe.servings,
                'prep_time_min': recipe.prep_time_min, 'category': recipe.category,
                'user_id': recipe.user_id}, 200

    @jwt_required()
    @api.expect(recipe_update_model)
    @api.response(200, 'Recipe updated')
    @api.response(404, 'Recipe not found')
    def put(self, recipe_id):
        recipe = facade.update_recipe(recipe_id, **api.payload)
        if not recipe:
            return {'error': 'Recipe not found'}, 404
        return {'id': recipe.id, 'title': recipe.title,
                'description': recipe.description, 'servings': recipe.servings,
                'prep_time_min': recipe.prep_time_min,
                'category': recipe.category}, 200

    @jwt_required()
    @api.response(204, 'Recipe deleted')
    @api.response(404, 'Recipe not found')
    def delete(self, recipe_id):
        if not facade.get_recipe(recipe_id):
            return {'error': 'Recipe not found'}, 404
        facade.delete_recipe(recipe_id)
        return '', 204
```

### **Explicación línea por línea:**
#### Import
```python
from flask_jwt_extended import jwt_required, get_jwt_identity
```
- `@jwt_required()`
    +   decorador que protege un endpoint. 
    +   Si la petición no trae un token JWT válido en el header `Authorization: Bearer <token>`, devuelve 401 automáticamente antes de ejecutar el método.
- `get_jwt_identity()`
    +   Dentro de un endpoint protegido, extrae el `user_id` que guardamos en el token al hacer login. 
    +   Así sabemos qué usuario está pidiendo.

#### Modelos
```python
recipe_model = api.model('Recipe', { ... })
recipe_update_model = api.model('RecipeUpdate', { ... })
```
Dos modelos separados porque la lógica de validación es distinta:
- `recipe_model` — para crear: `title` es `required=True`.
- `recipe_update_model` — para actualizar: 
    +   Ningún campo es obligatorio
    +   El usuario puede enviar solo los campos que quiere cambiar

#### Ruta `/`
```python
@api.route('/')
class RecipeList(Resource):
```
Maneja la colección completa: 
-   `GET /api/v1/recipes/` lista 
-   `POST /api/v1/recipes/` crea
-   El slash final es importante — **flask_restx** diferencia `/recipes` de `/recipes/`.

##### GET
```python
    @jwt_required()
    def get(self):
        user_id = get_jwt_identity()
        recipes = facade.get_recipes_by_user(user_id)
```
-   `@jwt_required()` va antes de `@api.response` — se ejecuta primero.
    +   Si el token no es válido, la petición no llega al cuerpo del método.
-   `get_jwt_identity()` retorna el `user_id` embebido en el token — el usuario solo ve sus propias recetas.

##### POST
```python
    @jwt_required()
    @api.expect(recipe_model)
    @api.response(201, 'Recipe created')
    def post(self):
        user_id = get_jwt_identity()
        data = api.payload
        recipe = facade.create_recipe(
            user_id=user_id,
            title=data['title'],
            description=data.get('description', ''),
            servings=data.get('servings', 0),
            prep_time_min=data.get('prep_time_min', 0),
            category=data.get('category', '')
        )
        return {'id': recipe.id, 'title': recipe.title,
                'user_id': recipe.user_id}, 201
```
-   `@jwt_required()` — igual que en `get`: si no hay token válido, la petición se rechaza antes de ejecutar el método.
-   `@api.expect(recipe_model)`
    +   Valida que el body JSON contenga `title` (único campo `required=True`).
    +   Si falta, **flask_restx** devuelve 400 automáticamente sin llegar al código.
    +   También genera el formulario de input en Swagger UI para que cualquier cliente sepa exactamente qué enviar.
-   `user_id = get_jwt_identity()`
    +   Extraemos el `user_id` del token para asociar la nueva receta al usuario autenticado. 
    +   El cliente no envía su `user_id` en el body — se lee del token.
    +   Esto evita que un usuario pueda crear recetas a nombre de otro.
-   `data = api.payload` — lee el body JSON de la petición.
-   `data['title']` vs `data.get('description', '')`
    +   `title` usa acceso directo porque es `required=True` en `recipe_model` (si falta, flask_restx ya lo rechazó antes).
    +   Los demás usan `.get(campo, default)` porque son opcionales — si el cliente no los envía, se usa el valor por defecto.
-   `facade.create_recipe(user_id=user_id, ...)`
    +   La Facade crea el objeto `Recipe` con un UUID nuevo y lo guarda en `_recipes`.
    +   El endpoint no toca el modelo directamente.
-   `return {'id': recipe.id, 'title': recipe.title, 'user_id': recipe.user_id}, 201` 
    +   Respuesta mínima con los datos esenciales de la receta creada. 
    +   El 201 (Created) es el código estándar para recursos creados exitosamente. 
    +   No se devuelve todo el objeto para mantener la respuesta ligera.

#### Ruta `/<string:recipe_id>`
```python
@api.route('/<string:recipe_id>')
class RecipeDetail(Resource):
```
-   Los `< >` definen un **segmento dinámico** de la URL. 
    +   Todo lo que esté entre las llaves angulares se captura de la URL real y se convierte en una variable.
-   `string:` es el **tipo del conversor** 
    +   Le dice a Flask que el segmento puede ser cualquier texto (letras, números, guiones). 
    +   Es el tipo apropiado para nuestros UUIDs como `"3f8a1c2d-..."`
    +   Otros conversores posibles: 
        *   `int:` (solo números), 
        *   `float:`, 
        *   `path:` (texto con barras). 
    +   Usamos `string:` porque UUID no es un entero.
-   `recipe_id` es el **nombre de la variable** — Flask extrae ese valor de la URL y lo pasa automáticamente como argumento a cada método de la clase:
    ```
    GET /api/v1/recipes/3f8a1c2d-...
                        ↑
                        Flask extrae esto → recipe_id = "3f8a1c2d-..."
                        → se lo pasa a def get(self, recipe_id)
    ```
-   Todos los métodos de `RecipeDetail` reciben `recipe_id` como parámetro: 
    +   `def get(self, recipe_id)`
    +   `def put(self, recipe_id)`
    +   `def delete(self, recipe_id)`
-   La ruta completa resultante es `/api/v1/recipes/<recipe_id>` porque el namespace se registró con `path='/api/v1/recipes'` en `__init__.py`.

##### PUT
```python
    def put(self, recipe_id):
        recipe = facade.update_recipe(recipe_id, **api.payload)
```
-   `**api.payload` desempaqueta el dict del body como argumentos con nombre.
-   Si el cliente envía `{"title": "Nueva tarta", "servings": 6}`, esto equivale a llamar `facade.update_recipe(recipe_id, title="Nueva tarta", servings=6)`.

##### DELETE
```python
    def delete(self, recipe_id):
        if not facade.get_recipe(recipe_id):
            return {'error': 'Recipe not found'}, 404
        facade.delete_recipe(recipe_id)
        return '', 204
```
-   El **204 (No Content)** es el código estándar para `DELETE` exitoso — indica que la operación se completó pero no hay body en la respuesta. 
-   Se retorna `''` (string vacío) porque Flask necesita algo para la respuesta aunque esté vacía.

---

## Estado al cerrar la Sesión 5

`recipes.py` escrito y namespace registrado en `create_app()`. ✅
`auth.py` y `facade.py` completos. ✅
`__init__.py` actualizado con Swagger Authorize button y JWT de 1 hora. ✅

---
---
---

# Sesión 6 — Sprint 3 · Ingredientes + Scan PDF (`api/v1/ingredients.py` + `api/v1/scan.py` + Groq)

---

## `backend/app/api/v1/ingredients.py`
### ¿Por qué existe este archivo?

Los ingredientes son recursos anidados bajo una receta — cada ingrediente pertenece a exactamente una receta a través de `recipe_id`. 
Separamos la gestión de ingredientes en su propio archivo para:
- Mantener cada **Namespace** enfocado en un solo recurso (Single Responsibility)
- Poder testear ingredientes de forma independiente
- Evitar que `recipes.py` crezca demasiado

**Relación de recursos:**
```
/api/v1/recipes/<recipe_id>/ingredients        → lista de ingredientes de esa receta
/api/v1/recipes/<recipe_id>/ingredients/<id>   → ingrediente específico
```

Los ingredientes viven bajo la URL de su receta porque semánticamente un ingrediente sin receta no tiene sentido.

---
---

### Código completo

```python
from flask_restx import Namespace, Resource, fields
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.facade import facade

api = Namespace('ingredients', description='Ingredient management')

ingredient_model = api.model('Ingredient', {
    'name': fields.String(required=True, description='Ingredient name'),
    'quantity': fields.String(required=True, description='Amount (e.g. "200", "1/2")'),
    'unit': fields.String(required=True, description='Unit of measure (e.g. "g", "ml", "cup")')
})

ingredient_update_model = api.model('IngredientUpdate', {
    'name': fields.String(description='Ingredient name'),
    'quantity': fields.String(description='Amount'),
    'unit': fields.String(description='Unit of measure')
})


@api.route('/recipes/<string:recipe_id>/ingredients')
class IngredientList(Resource):

    @jwt_required()
    @api.response(200, 'List of ingredients for the recipe')
    @api.response(404, 'Recipe not found')
    def get(self, recipe_id):
        if not facade.get_recipe(recipe_id):
            return {'error': 'Recipe not found'}, 404
        ingredients = facade.get_ingredients_by_recipe(recipe_id)
        return [{'id': i.id, 'name': i.name, 'quantity': i.quantity,
                 'unit': i.unit, 'recipe_id': i.recipe_id} for i in ingredients], 200

    @jwt_required()
    @api.expect(ingredient_model)
    @api.response(201, 'Ingredient added')
    @api.response(404, 'Recipe not found')
    def post(self, recipe_id):
        if not facade.get_recipe(recipe_id):
            return {'error': 'Recipe not found'}, 404
        data = api.payload
        ingredient = facade.add_ingredient(
            recipe_id=recipe_id,
            name=data['name'],
            quantity=data['quantity'],
            unit=data['unit']
        )
        return {'id': ingredient.id, 'name': ingredient.name,
                'quantity': ingredient.quantity, 'unit': ingredient.unit,
                'recipe_id': ingredient.recipe_id}, 201


@api.route('/recipes/<string:recipe_id>/ingredients/<string:ingredient_id>')
class IngredientDetail(Resource):

    @jwt_required()
    @api.response(200, 'Ingredient found')
    @api.response(404, 'Ingredient not found')
    def get(self, recipe_id, ingredient_id):
        ingredient = facade.get_ingredient(ingredient_id)
        if not ingredient or ingredient.recipe_id != recipe_id:
            return {'error': 'Ingredient not found'}, 404
        return {'id': ingredient.id, 'name': ingredient.name,
                'quantity': ingredient.quantity, 'unit': ingredient.unit,
                'recipe_id': ingredient.recipe_id}, 200

    @jwt_required()
    @api.expect(ingredient_update_model)
    @api.response(200, 'Ingredient updated')
    @api.response(404, 'Ingredient not found')
    def put(self, recipe_id, ingredient_id):
        ingredient = facade.get_ingredient(ingredient_id)
        if not ingredient or ingredient.recipe_id != recipe_id:
            return {'error': 'Ingredient not found'}, 404
        updated = facade.update_ingredient(ingredient_id, **api.payload)
        return {'id': updated.id, 'name': updated.name,
                'quantity': updated.quantity, 'unit': updated.unit}, 200

    @jwt_required()
    @api.response(204, 'Ingredient deleted')
    @api.response(404, 'Ingredient not found')
    def delete(self, recipe_id, ingredient_id):
        ingredient = facade.get_ingredient(ingredient_id)
        if not ingredient or ingredient.recipe_id != recipe_id:
            return {'error': 'Ingredient not found'}, 404
        facade.delete_ingredient(ingredient_id)
        return '', 204
```

---

### Explicación línea por línea
#### Import
```python
from flask_restx import Namespace, Resource, fields
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.facade import facade
```
Mismas importaciones que `recipes.py` — `Namespace` agrupa las rutas, `Resource` define las clases con los métodos HTTP, `fields` define los modelos de validación, `facade` es el singleton con la lógica de negocio.

```python
api = Namespace('ingredients', description='Ingredient management')
```
Crea el **Namespace**. 
El string `'ingredients'` es solo el nombre interno para **flask_restx** — la ruta real viene de `api.add_namespace(ingredients_ns, path='/api/v1/ingredients')` en `__init__.py`.

---

####    Models
```python
ingredient_model = api.model('Ingredient', {
    'name': fields.String(required=True, ...),
    'quantity': fields.String(required=True, ...),
    'unit': fields.String(required=True, ...)
})
```
Modelo para el **body del POST** — los tres campos son obligatorios al crear un ingrediente.

`quantity` es `String` (no `Float`) porque las cantidades de cocina son a veces fracciones como `"1/2"` o rangos como `"2-3"` — un número flotante perdería esa información.

```python
ingredient_update_model = api.model('IngredientUpdate', {
    'name': fields.String(...),
    'quantity': fields.String(...),
    'unit': fields.String(...)
})
```
Modelo para el **body del PUT** — todos los campos son opcionales porque un PATCH parcial es válido (cambiar solo el `unit` sin tocar `name` ni `quantity`).

---

####    Ruta `/recipes/<string:recipe_id>/ingredients`
##### `class IngredientList` — `GET` (listar ingredientes)

```python
@api.route('/recipes/<string:recipe_id>/ingredients')
class IngredientList(Resource):
```
-   La ruta incluye `recipe_id` porque los ingredientes son recursos anidados. 
-   Flask extrae el `recipe_id` de la URL y lo pasa como parámetro al método.

```python
    @jwt_required()
    @api.response(200, 'List of ingredients for the recipe')
    @api.response(404, 'Recipe not found')
    def get(self, recipe_id):
        if not facade.get_recipe(recipe_id):
            return {'error': 'Recipe not found'}, 404
        ingredients = facade.get_ingredients_by_recipe(recipe_id)
        return [{'id': i.id, 'name': i.name, 'quantity': i.quantity,
                 'unit': i.unit, 'recipe_id': i.recipe_id} for i in ingredients], 200
```
- Primero verifica que la receta existe. Si no existe, retorna **404** antes de buscar ingredientes.
- `facade.get_ingredients_by_recipe(recipe_id)` devuelve una lista de objetos `Ingredient`.
- La list comprehension convierte cada objeto a un diccionario serializable como **JSON**.
- Si la receta existe pero no tiene ingredientes, retorna `[]` con status **200** — lista vacía es una respuesta válida.

---

#### `class IngredientList` — `POST` (crear ingrediente)

```python
    @jwt_required()
    @api.expect(ingredient_model)
    @api.response(201, 'Ingredient added')
    @api.response(404, 'Recipe not found')
    def post(self, recipe_id):
        if not facade.get_recipe(recipe_id):
            return {'error': 'Recipe not found'}, 404
        data = api.payload
        ingredient = facade.add_ingredient(
            recipe_id=recipe_id,
            name=data['name'],
            quantity=data['quantity'],
            unit=data['unit']
        )
        return {'id': ingredient.id, 'name': ingredient.name,
                'quantity': ingredient.quantity, 'unit': ingredient.unit,
                'recipe_id': ingredient.recipe_id}, 201
```
- Verifica la receta antes de crear el ingrediente — no tiene sentido agregar un ingrediente a una receta que no existe.
- `api.payload` contiene el body JSON parseado y validado contra `ingredient_model`.
- `facade.add_ingredient` crea el objeto `Ingredient` con un UUID nuevo y lo guarda en `_ingredients`.
- Retorna **201** con los datos del ingrediente creado, incluyendo su `id` generado.

---

#### `class IngredientDetail` — `GET`, `PUT`, `DELETE`

```python
@api.route('/recipes/<string:recipe_id>/ingredients/<string:ingredient_id>')
class IngredientDetail(Resource):
```
Dos parámetros de URL: 
-   `recipe_id`
-   `ingredient_id` 

Flask los pasa a cada método como argumentos.

```python
    def get(self, recipe_id, ingredient_id):
        ingredient = facade.get_ingredient(ingredient_id)
        if not ingredient or ingredient.recipe_id != recipe_id:
            return {'error': 'Ingredient not found'}, 404
```
La condición `ingredient.recipe_id != recipe_id` es importante: 
-   verifica que el ingrediente pertenece a esa receta específica. 
    +   Sin eso, alguien podría acceder a ingredientes de otra receta pasando un `ingredient_id` válido pero de otra receta.

```python
    def put(self, recipe_id, ingredient_id):
        ingredient = facade.get_ingredient(ingredient_id)
        if not ingredient or ingredient.recipe_id != recipe_id:
            return {'error': 'Ingredient not found'}, 404
        updated = facade.update_ingredient(ingredient_id, **api.payload)
        return {'id': updated.id, 'name': updated.name,
                'quantity': updated.quantity, 'unit': updated.unit}, 200
```
- Misma verificación de pertenencia antes de actualizar.
- `**api.payload` desempaqueta el dict del body como kwargs — `update_ingredient` usa `setattr` en un loop para aplicar solo los campos que vinieron en el body (los que no vienen quedan igual).

```python
    def delete(self, recipe_id, ingredient_id):
        ingredient = facade.get_ingredient(ingredient_id)
        if not ingredient or ingredient.recipe_id != recipe_id:
            return {'error': 'Ingredient not found'}, 404
        facade.delete_ingredient(ingredient_id)
        return '', 204
```
- **204 (No Content)** es el código estándar para **DELETE** exitoso.
- `''` como body vacío es necesario porque Flask requiere siempre un valor de retorno.

---

### Agregar `get_ingredient` al Facade

-   `ingredients.py` llama a `facade.get_ingredient(ingredient_id)`:
    +   Un método que busca un ingrediente por su ID. 
-   Este método hay que añadirlo a `facade.py`:

```python
def get_ingredient(self, ingredient_id):
    return self._ingredients.get_by_id(ingredient_id)
```

Y registrar el namespace en `app/__init__.py`:

```python
from app.api.v1.ingredients import api as ingredients_ns
api.add_namespace(ingredients_ns, path='/api/v1')
```

**Nota sobre el path:** se usa `/api/v1` (no `/api/v1/ingredients`) porque las rutas ya incluyen `/recipes/<id>/ingredients` — si se pusiera el prefijo `/api/v1/ingredients` las URLs quedarían mal duplicadas.

---
---
---

## Tests — Sprint 2 Backlog · Unit Tests (`tests/test_models.py` + `tests/test_repository.py`)

> Estos tests cubren código del Sprint 2 (modelos y repository) pero se escriben ahora porque los modelos y el repository ya están estables y no cambian hasta el swap de SQLAlchemy (Sesión 8).

### ¿Por qué `conftest.py`?

Los tests están en `tests/` pero el código está en `backend/`. Python no sabe dónde buscar `app.models.user` si `backend/` no está en el path. `conftest.py` es la solución.

**¿Por qué no lo importamos en los archivos de test?**

No hace falta — pytest lo ejecuta automáticamente por convención. Cualquier archivo llamado exactamente `conftest.py` es encontrado y ejecutado por pytest antes de correr los tests, sin que lo importes tú.

Cuando corres `pytest tests/test_models.py`, el orden de ejecución es:

```
pytest tests/test_models.py
   │
   ├── 1. Busca todos los conftest.py en el árbol de directorios
   │      (desde tests/ hacia arriba hasta la raíz del proyecto)
   │
   ├── 2. Ejecuta tests/conftest.py  ← sys.path.insert corre aquí
   │      ahora backend/ está en el path de Python
   │
   └── 3. Recién ahora corre test_models.py
              from app.models.user import User  ← ya funciona
```

Si renombraras `conftest.py` a cualquier otro nombre (`setup.py`, `path_config.py`), pytest no lo encontraría y los imports de `app.*` fallarían.

**Importante:** los errores de `app.models.*` que aparecen en VS Code son un problema separado — Pylance (el analizador de VS Code) nunca ejecuta `conftest.py` porque analiza el código sin correrlo. Por eso los tests pasan perfectamente pero el editor sigue subrayando en rojo. Para el editor existe `pyrightconfig.json`; para pytest existe `conftest.py`.

---

### `tests/conftest.py`

```python
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
```

**Explicación:**
- `os.path.dirname(__file__)` → ruta de la carpeta `tests/`
- `'..', 'backend'` → sube un nivel y entra a `backend/`
- `sys.path.insert(0, ...)` → agrega esa ruta al inicio del path de Python

Con esto, `from app.models.user import User` funciona desde cualquier test.

---

### `tests/test_models.py`

#### ¿Qué verificamos en los unit tests de modelos?

Cada test de modelo verifica tres cosas:
1. **Campos obligatorios** — se asignan correctamente al crear el objeto
2. **Valores por defecto** — los campos opcionales tienen su valor inicial correcto
3. **UUID automático** — el `id` se genera, es único, y tiene formato UUID válido

```python
import uuid
import pytest
from app.models.user import User
from app.models.recipe import Recipe
from app.models.ingredient import Ingredient
from app.models.step import Step
from app.models.pdf_scan import PdfScan


class TestUser:

    def test_required_fields(self):
        user = User(first_name='Ana', last_name='García',
                    email='ana@test.com', password_hash='hashed')
        assert user.first_name == 'Ana'
        assert user.last_name == 'García'
        assert user.email == 'ana@test.com'
        assert user.password_hash == 'hashed'

    def test_id_is_auto_generated(self):
        user = User(first_name='Ana', last_name='García',
                    email='ana@test.com', password_hash='hashed')
        assert user.id is not None
        uuid.UUID(user.id)  # lanza ValueError si no es un UUID válido

    def test_two_users_have_different_ids(self):
        u1 = User(first_name='Ana', last_name='G', email='a@test.com', password_hash='h')
        u2 = User(first_name='Bob', last_name='S', email='b@test.com', password_hash='h')
        assert u1.id != u2.id


class TestRecipe:

    def test_required_fields(self):
        recipe = Recipe(title='Tarta de manzana', user_id='user-123')
        assert recipe.title == 'Tarta de manzana'
        assert recipe.user_id == 'user-123'

    def test_default_values(self):
        recipe = Recipe(title='Tarta', user_id='user-123')
        assert recipe.description == ''
        assert recipe.servings == 0
        assert recipe.prep_time_min == 0
        assert recipe.category == ''

    def test_id_is_auto_generated(self):
        recipe = Recipe(title='Tarta', user_id='user-123')
        uuid.UUID(recipe.id)

    def test_two_recipes_have_different_ids(self):
        r1 = Recipe(title='Tarta', user_id='u1')
        r2 = Recipe(title='Pizza', user_id='u1')
        assert r1.id != r2.id


class TestIngredient:

    def test_required_fields(self):
        ing = Ingredient(name='Harina', quantity='200', unit='g', recipe_id='recipe-123')
        assert ing.name == 'Harina'
        assert ing.quantity == '200'
        assert ing.unit == 'g'
        assert ing.recipe_id == 'recipe-123'

    def test_default_values(self):
        ing = Ingredient(name='Harina', quantity='200', unit='g', recipe_id='r1')
        assert ing.off_product_id == ''
        assert ing.estimated_cost == 0.0
        assert ing.cost_is_manual is False

    def test_id_is_auto_generated(self):
        ing = Ingredient(name='Harina', quantity='200', unit='g', recipe_id='r1')
        uuid.UUID(ing.id)


class TestStep:

    def test_required_fields(self):
        step = Step(order_num=1, description='Mezclar harina', recipe_id='recipe-123')
        assert step.order_num == 1
        assert step.description == 'Mezclar harina'
        assert step.recipe_id == 'recipe-123'

    def test_default_values(self):
        step = Step(order_num=1, description='Mezclar', recipe_id='r1')
        assert step.duration_min == 0

    def test_id_is_auto_generated(self):
        step = Step(order_num=1, description='Mezclar', recipe_id='r1')
        uuid.UUID(step.id)


class TestPdfScan:

    def test_required_fields(self):
        scan = PdfScan(filename='recipe.pdf', recipe_id='recipe-123')
        assert scan.filename == 'recipe.pdf'
        assert scan.recipe_id == 'recipe-123'

    def test_default_values(self):
        scan = PdfScan(filename='recipe.pdf', recipe_id='r1')
        assert scan.status == 'pending'
        assert scan.scanned_at == ''

    def test_id_is_auto_generated(self):
        scan = PdfScan(filename='recipe.pdf', recipe_id='r1')
        uuid.UUID(scan.id)
```

**Explicación línea por línea de los patrones usados:**

```python
import uuid
```
Lo importamos para llamar a `uuid.UUID(string)` — si el string no tiene formato UUID válido, lanza un `ValueError` y el test falla automáticamente. Es una forma compacta de validar el formato sin escribir regex.

```python
uuid.UUID(user.id)  # lanza ValueError si no es un UUID válido
```
No guardamos el resultado — solo nos interesa que no lance excepción. Si el `id` es `None`, `''`, o cualquier string que no sea UUID, este test falla.

```python
assert u1.id != u2.id
```
Verifica que el `field(default_factory=lambda: str(uuid.uuid4()))` genera un valor nuevo cada vez, no el mismo valor para todas las instancias. Este bug es más común de lo que parece — si se usara `field(default=str(uuid.uuid4()))` (sin lambda), todos los objetos compartirían el mismo UUID.

---
---
---

### `tests/test_repository.py`

#### ¿Qué verificamos en los unit tests del repository?

Probamos cada método de `InMemoryStorage` de forma independiente, usando `User` como modelo de ejemplo (podría ser cualquier modelo con `id`).

```python
import pytest
from app.persistence.repository import InMemoryStorage
from app.models.user import User


@pytest.fixture
def storage():
    return InMemoryStorage()


@pytest.fixture
def sample_user():
    return User(first_name='Ana', last_name='García',
                email='ana@test.com', password_hash='hashed')


class TestInMemoryStorage:

    def test_save_returns_the_object(self, storage, sample_user):
        result = storage.save(sample_user)
        assert result is sample_user

    def test_save_stores_object_retrievable_by_id(self, storage, sample_user):
        storage.save(sample_user)
        assert storage.get_by_id(sample_user.id) is sample_user

    def test_get_by_id_returns_none_for_unknown_id(self, storage):
        assert storage.get_by_id('nonexistent-id') is None

    def test_get_all_returns_empty_list_when_empty(self, storage):
        assert storage.get_all() == []

    def test_get_all_returns_all_saved_objects(self, storage):
        u1 = User(first_name='Ana', last_name='G', email='a@test.com', password_hash='h')
        u2 = User(first_name='Bob', last_name='S', email='b@test.com', password_hash='h')
        storage.save(u1)
        storage.save(u2)
        result = storage.get_all()
        assert len(result) == 2
        assert u1 in result
        assert u2 in result

    def test_update_overwrites_existing_object(self, storage, sample_user):
        storage.save(sample_user)
        sample_user.first_name = 'Updated'
        storage.update(sample_user)
        assert storage.get_by_id(sample_user.id).first_name == 'Updated'

    def test_delete_removes_object(self, storage, sample_user):
        storage.save(sample_user)
        storage.delete(sample_user.id)
        assert storage.get_by_id(sample_user.id) is None

    def test_delete_nonexistent_id_does_not_raise(self, storage):
        storage.delete('nonexistent-id')

    def test_get_by_attribute_finds_matching_object(self, storage, sample_user):
        storage.save(sample_user)
        result = storage.get_by_attribute('email', 'ana@test.com')
        assert result is sample_user

    def test_get_by_attribute_returns_none_when_not_found(self, storage):
        result = storage.get_by_attribute('email', 'notfound@test.com')
        assert result is None
```

**Explicación de los patrones de pytest usados:**

```python
@pytest.fixture
def storage():
    return InMemoryStorage()
```
Un **fixture** es una función que pytest ejecuta antes de cada test y pasa el resultado como argumento. `storage` crea un `InMemoryStorage` fresco para cada test — sin esto, un test que guarda datos contaminaría el siguiente.

```python
@pytest.fixture
def sample_user():
    return User(first_name='Ana', ...)
```
Mismo patrón para el usuario de ejemplo. Cada test recibe su propia instancia nueva — los tests son independientes entre sí.

```python
def test_save_returns_the_object(self, storage, sample_user):
```
pytest inyecta `storage` y `sample_user` por nombre — los nombres de los parámetros deben coincidir exactamente con el nombre del fixture.

```python
assert result is sample_user
```
`is` verifica identidad de objeto (mismo objeto en memoria), no solo igualdad de valores. Confirma que `save()` retorna el mismo objeto que recibió, no una copia.

```python
def test_delete_nonexistent_id_does_not_raise(self, storage):
    storage.delete('nonexistent-id')
```
No tiene `assert` — si `delete()` lanzara una excepción, pytest la capturaría y marcaría el test como fallido. El hecho de que llegue al final sin excepción es la verificación.

---

### Cómo correr los tests

Desde la carpeta raíz del proyecto (`recipe_Scanner/`):

```bash
cd recipe_Scanner
pytest tests/test_models.py -v
pytest tests/test_repository.py -v
pytest tests/ -v          # todos los tests a la vez
```

La flag `-v` (verbose) muestra el nombre de cada test y si pasó ✅ o falló ❌.

---
---
---

# Sesión 6 (continuación) — Sprint 3 · PDF Scan + Groq (`api/v1/scan.py` + `services/facade.py`)

Esta es la parte más importante del proyecto. 
Todo lo anterior (modelos, repository, facade, auth, recipes, ingredients) fue infraestructura. 
**Esto es el feature central**: 
-   El usuario sube un PDF de receta
-   El sistema lo lee
-   Lo entiende 
-   Lo guarda automáticamente
## Explicación
### El flujo completo de una petición

```
Usuario sube un PDF
        │
        ▼
POST /api/v1/scan/
        │
        ▼
scan.py valida el archivo
  ├── ¿Tiene el campo 'file'?
  ├── ¿Tiene nombre?
  └── ¿Termina en .pdf?
        │
        ▼
facade.scan_pdf(user_id, file_bytes, filename)
        │
        ├── 1. PyMuPDF lee el PDF → extrae texto crudo
        │         "Tarta de manzana\n4 porciones\n300g harina..."
        │
        ├── 2. Groq recibe el texto → devuelve JSON estructurado
        │         {"title": "Tarta de manzana", "servings": 4,
        │          "ingredients": [...], "steps": [...]}
        │
        ├── 3. facade.create_recipe()    → guarda la receta
        ├── 4. facade.add_ingredient()   → guarda cada ingrediente
        └── 5. facade.add_step()         → guarda cada paso
                │
                ▼
        scan.py devuelve JSON con receta + ingredientes + pasos
        HTTP 201 Created
```

---

### ¿Qué es PyMuPDF y por qué se llama `fitz`?

PyMuPDF es una librería Python para leer y manipular archivos PDF. 
Pero cuando la importamos en el código escribimos `import fitz`, no `import pymupdf`. ¿Por qué?

El nombre `fitz` viene de la historia de la librería. 
**MuPDF** (el motor C que hace el trabajo real de leer PDFs) fue desarrollado por Artifex Software. 
El binding Python original se llamó `fitz` por Horst Fitz, el desarrollador que lo creó. 
Aunque el paquete en pip se llama `PyMuPDF`, el módulo Python mantiene el nombre histórico `fitz`.

**¿Qué hace PyMuPDF en este proyecto?**
Un PDF no es texto plano — es un formato binario complejo con páginas, fuentes, coordenadas de cada carácter, imágenes, metadatos. 
**PyMuPDF** actúa como intérprete: 
1.   Abre el binario del PDF 
2.   Extrae todo el texto legible.

```
PDF binario (bytes)  →  PyMuPDF  →  string de texto plano
"%PDF-1.4 ..."       →  fitz     →  "Tarta de manzana\n4 porciones\n..."
```

---

### ¿Qué es Groq?

Groq es una empresa que ofrece una API para ejecutar modelos de lenguaje (**LLMs**) con hardware especializado (**LPU — Language Processing Unit**). 
Su API es compatible con el formato de OpenAI, pero es significativamente más rápida y tiene un generoso tier gratuito.

#### **El modelo que usamos: LLaMA 3.3-70b-versatile**
**LLaMA** es una familia de modelos de lenguaje open-source creados por Meta (Facebook). 
`3.3` es la versión, `70b` significa 70 mil millones de parámetros (el tamaño del modelo), `versatile` indica que está optimizado para seguir instrucciones.

```
Nosotros enviamos:  "Aquí está el texto de una receta. Devuélveme un JSON con..."
LLaMA 3.3-70b:      Entiende el texto, extrae la estructura, devuelve JSON
```

#### **¿Por qué Groq y no OpenAI?**

| | Groq | OpenAI |
|---|---|---|
| Velocidad | Muy rápida (LPU) | Estándar (GPU) |
| Tier gratuito | Generoso (suficiente para este proyecto) | Muy limitado |
| Calidad | Excelente con LLaMA 3.3-70b | Excelente con GPT-4o |
| Precio | Bajo | Alto |

---

### ¿Qué es un multipart form upload?

Cuando un usuario sube un archivo desde un formulario HTML, el browser no envía el archivo como JSON. 
Lo envía como **multipart/form-data** — un formato especial que puede incluir tanto texto como datos binarios en la misma petición.

```
POST /api/v1/scan/
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary

------WebKitFormBoundary
Content-Disposition: form-data; name="file"; filename="receta.pdf"
Content-Type: application/pdf

<bytes binarios del PDF aquí>
------WebKitFormBoundary--
```

Flask parsea automáticamente este formato y pone los archivos en `request.files`, un diccionario donde la clave es el nombre del campo del formulario. 
`request.files['file']` devuelve un objeto `FileStorage` con el archivo listo para leer.

---

### ¿Qué es `temperature` en los LLMs?

Cuando llamamos a Groq usamos `temperature=0.1`. 
La temperatura controla qué tan "creativo" o "aleatorio" es el modelo.

```
temperature=0.0  →  el modelo siempre elige la respuesta más probable
                     determinista, repetible, muy poco creativo
temperature=0.1  →  casi determinista, con mínima variación
temperature=0.7  →  balance entre coherencia y creatividad (default)
temperature=1.0  →  muy creativo y variado, puede ser incoherente
temperature=2.0  →  caótico, respuestas muy impredecibles
```

Para este proyecto usamos `0.1` porque **queremos consistencia**, no creatividad. 
El modelo tiene que extraer datos de un texto — no inventar nada. 
Una temperatura baja garantiza que si le pasas el mismo PDF dos veces, obtienes prácticamente el mismo JSON.

---

### Prompt engineering: por qué el prompt importa

Un prompt es el mensaje que le enviamos al **LLM**. 
La calidad del prompt determina directamente la calidad de la respuesta. 
Para este proyecto necesitamos que el modelo devuelva JSON válido con una estructura específica — no texto libre.

### **Problema con los LLMs y JSON:**

Los **LLMs** a veces devuelven esto en lugar de JSON limpio:

Aquí está la receta extraída:

```json
{"title": "Tarta de manzana", ...}
```

Esto puede ser útil para humanos pero rompe `json.loads()`.


#### **Solución: instrucciones explícitas en el prompt:**

El prompt dice `return ONLY a valid JSON object... no explanation, no markdown`. 
Esto reduce significativamente (aunque no elimina al 100%) el riesgo de que el modelo añada texto extra alrededor del JSON.

Adicionalmente usamos `temperature=0.1` para que el modelo sea más estricto y siga mejor las instrucciones.

---

## Cambios en `facade.py` para la Sesión 6

`scan_pdf`, `_extract_pdf_text` y `_call_groq` viven en el facade porque contienen lógica de negocio. `scan.py` solo maneja la petición HTTP y delega todo el procesamiento aquí.

**Imports nuevos al inicio del archivo:**
```python
import fitz
import json
import os
from groq import Groq
from app.models.pdf_scan import PdfScan
```

**`GROQ_PROMPT`** — constante de módulo (fuera de la clase, entre los imports y `class RecipeScannerFacade`). Se define una sola vez a nivel de módulo para que `_call_groq` lo referencie sin repetirlo. Al estar fuera de la clase es fácil de encontrar y ajustar cuando se quiera afinar las instrucciones al modelo.

**Métodos nuevos bajo `# --- Steps ---`:**

```python
def add_step(self, recipe_id, order_num, description):
    step = Step(order_num=order_num, description=description, recipe_id=recipe_id)
    return self._steps.save(step)
```
- Mismo patrón que `add_ingredient` — crea el objeto `Step` con los datos del JSON de Groq y lo guarda en `_steps`.
- `order_num` es el número de orden que Groq extrajo del PDF. Sin él no sabríamos en qué secuencia mostrar los pasos.
- Lo llama `scan_pdf` en un loop, una vez por cada paso del JSON.

```python
def get_steps_by_recipe(self, recipe_id):
    return [s for s in self._steps.get_all() if s.recipe_id == recipe_id]
```
- List comprehension que filtra todos los steps del storage por `recipe_id` — mismo patrón que `get_ingredients_by_recipe`.
- Lo usará el frontend en la Sesión 9 para mostrar los pasos de una receta en orden.

---
### **Métodos nuevos bajo `# --- Scan (PDF + Groq) ---`:**
#### `scan_pdf(self, user_id, file_bytes, filename)`

```python
def scan_pdf(self, user_id, file_bytes, filename):
```
El método orquestador — coordina todos los pasos. Recibe:
- `user_id` — el dueño de la receta (viene del JWT en scan.py)
- `file_bytes` — el contenido binario del PDF (bytes leídos del archivo subido)
- `filename` — el nombre original del archivo (para mostrarlo si hace falta)

##### Texto del PDF
```python
    text = self._extract_pdf_text(file_bytes)
    if not text.strip():
        return None
```
-   Extrae el texto del PDF. 
-   Si el PDF está vacío o solo tiene imágenes (sin texto seleccionable), `text.strip()` devuelve `''` y retornamos `None` — no tiene sentido llamar a Groq sin contenido.

##### Llamar a Groq
```python
    data = self._call_groq(text)
    if data is None:
        return None
```
-   Llama a Groq. 
-   Si hubo algún error (API down, JSON inválido, timeout), `_call_groq` retorna `None` y propagamos ese `None` hacia arriba para que `scan.py` devuelva un 500.

##### Crea la receta
```python
    recipe = self.create_recipe(
        user_id=user_id,
        title=data.get('title', 'Untitled'),
        ...
    )
```
-   `data.get('title', 'Untitled')` usa el método `get` de los diccionarios Python. 
-   Si el JSON que devolvió Groq tiene la clave `'title'`, lo usa; si no la tiene (Groq a veces omite campos), usa el fallback `'Untitled'`. 
-   Esto es **defensive programming** — no asumimos que Groq siempre devuelve todos los campos.

##### Agrega los ingredientes
```python
    ingredients = []
    for item in data.get('ingredients', []):
        ing = self.add_ingredient(...)
        ingredients.append(ing)
```
-   `data.get('ingredients', [])` — si Groq no devolvió ingredientes, usamos lista vacía en lugar de romper con un `KeyError`.
-   El loop guarda cada ingrediente y acumula los objetos creados en la lista `ingredients`.

##### Steps
```python
steps = []
for item in data.get('steps', []):
    step = self.add_step(...)
    steps.append(step)
```
Misma logica.

##### Return
```python
    return recipe, ingredients, steps
```
-   Retorna una **tupla de tres elementos**. `scan.py` la desempaqueta con:
```python
recipe, ingredients, steps = result
```
-   Retornar una tupla es más simple que crear un objeto contenedor o un diccionario para este caso.

---

### Funciones auxiliares
#### `_extract_pdf_text(self, file_bytes)`

```python
def _extract_pdf_text(self, file_bytes):
```
-   El prefijo `_` indica que es un método **privado por convención** — no está pensado para llamarse desde afuera del facade, solo desde `scan_pdf`. 
-   Python no impone privacidad real (a diferencia de Java/C#), pero el `_` es la señal a otros desarrolladores de que este método es un detalle de implementación interno.

##### Abre el PDF
```python
    doc = fitz.open(stream=file_bytes, filetype='pdf')
```
-   Abre el PDF desde memoria. 
-   El parámetro `stream=file_bytes` le dice a fitz que el PDF está en un objeto `bytes` en RAM, no en un archivo en disco. 
-   `filetype='pdf'` es necesario cuando se abre desde stream (sin nombre de archivo, fitz no puede adivinar el tipo).

**¿Por qué en memoria y no en disco?**
Guardar el archivo en disco requeriría:
1. Elegir una ruta temporal
2. Escribir el archivo
3. Leerlo
4. Borrarlo después

Trabajar directo en memoria es más rápido, más limpio y no deja archivos huérfanos en el servidor si algo falla.

##### Itera en cada pagina
```python
    text = ''
    for page in doc:
        text += page.get_text()
```
-   Itera sobre cada página del PDF y concatena su texto. 
-   `page.get_text()` devuelve el texto de esa página como string, con `\n` entre líneas. 
-   Un PDF de 3 páginas hace 3 iteraciones.

##### Cierra el documento
```python
    doc.close()
    return text
```
-   Cerramos el documento explícitamente para liberar la memoria que PyMuPDF reservó internamente. 
-   Python tiene garbage collector pero para recursos externos (archivos, conexiones, documentos) es buena práctica cerrarlos explícitamente.

---

#### `_call_groq(self, text)`

```python
def _call_groq(self, text):
    client = Groq(api_key=os.environ.get('GROQ_API_KEY'))
```
-   Crea el cliente de Groq con la API key del `.env`. 
-   El cliente se crea en cada llamada (no se guarda como atributo del facade) porque las API keys pueden rotar y porque la conexión HTTP se gestiona internamente.
-   `os.environ.get('GROQ_API_KEY')` — en este punto `load_dotenv()` ya fue ejecutado por `config.py` cuando arrancó Flask, así que la variable ya está disponible en `os.environ`.

##### Response - Try/Except
```python
    try:
        response = client.chat.completions.create(
            model='llama-3.3-70b-versatile',
            messages=[{'role': 'user', 'content': GROQ_PROMPT + text}],
            temperature=0.1
        )
```
-   El `try/except` envuelve todo porque una llamada a una API externa puede fallar por múltiples razones: 
    +   Sin conexión a internet 
    +   API key inválida
    +   rate limit excedido
    +   Timeout
    +   Eel modelo no está disponible
-   Capturamos cualquier excepción con `except Exception` para no crashear el servidor.

-   `messages` es una lista de diccionarios con `role` y `content`. 
-   Esta es la estructura estándar de la **API de OpenAI** que Groq replica:
    + `'role': 'user'` — mensaje del usuario
    + `'role': 'assistant'` — respuesta del modelo
    + `'role': 'system'` — instrucciones de sistema (no usamos aquí, pusimos todo en el prompt del usuario)

-   `GROQ_PROMPT + text` concatena el prompt con el texto del PDF. 
    +   El modelo ve todo junto como un solo mensaje.

```python
        content = response.choices[0].message.content
```
La respuesta de Groq tiene esta estructura:
```
response
  └── choices (lista de posibles respuestas — normalmente solo 1)
        └── [0] (la primera y única)
              └── message
                    └── content (el string con el JSON)
```
-   `.choices[0]` porque la API puede generar múltiples alternativas si se configura `n > 1`. 
-   Nosotros siempre pedimos 1 (el default).

##### Return
```python
        return json.loads(content)
```
-   `json.loads(string)` parsea el string JSON y lo convierte a un diccionario Python. 
-   Si el modelo devolvió un JSON válido, esto funciona perfectamente. 
-   Si devolvió texto con markdown o texto extra alrededor del JSON, lanza una `json.JSONDecodeError`.

```python
    except Exception:
        return None
```
-   Captura cualquier excepción — tanto errores de red como errores de parseo JSON. 
-   Retornamos `None` y dejamos que `scan_pdf` propague ese `None` hacia scan.py, que lo convierte en un HTTP 500.

---

## `backend/app/api/v1/scan.py`

```python
from flask import request
from flask_restx import Namespace, Resource
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.facade import facade

api = Namespace('scan', description='PDF recipe scanning')


@api.route('/')
class ScanPdf(Resource):

    @jwt_required()
    @api.response(201, 'Recipe extracted and saved')
    @api.response(400, 'No file or invalid file')
    @api.response(500, 'Extraction failed')
    def post(self):
        user_id = get_jwt_identity()

        if 'file' not in request.files:
            return {'error': 'No file provided'}, 400

        file = request.files['file']

        if file.filename == '':
            return {'error': 'No file selected'}, 400

        if not file.filename.lower().endswith('.pdf'):
            return {'error': 'File must be a PDF'}, 400

        file_bytes = file.read()

        result = facade.scan_pdf(
            user_id=user_id,
            file_bytes=file_bytes,
            filename=file.filename
        )

        if result is None:
            return {'error': 'Could not extract recipe from PDF'}, 500

        recipe, ingredients, steps = result

        return {
            'recipe': {
                'id': recipe.id,
                'title': recipe.title,
                'description': recipe.description,
                'servings': recipe.servings,
                'prep_time_min': recipe.prep_time_min,
                'category': recipe.category
            },
            'ingredients': [
                {'id': i.id, 'name': i.name,
                 'quantity': i.quantity, 'unit': i.unit}
                for i in ingredients
            ],
            'steps': [
                {'id': s.id, 'order_num': s.order_num,
                 'description': s.description}
                for s in steps
            ]
        }, 201
```

### **Explicación línea por línea:**
#### Import
```python
from flask import request
```
-   `request` es el objeto global de Flask que representa la petición HTTP actual. 
-   A diferencia de los endpoints anteriores donde solo usábamos `api.payload` (JSON), aquí necesitamos `request.files` para acceder al archivo subido.

#### Namespace
```python
api = Namespace('scan', description='PDF recipe scanning')
```
El Namespace se registrará en `__init__.py` con `path='/api/v1/scan'`.

#### Archivo de la petición multipart
```python
        if 'file' not in request.files:
            return {'error': 'No file provided'}, 400
```
-   `request.files` es un diccionario con todos los archivos de la petición multipart. 
-   Si el cliente no envió ningún campo de archivo llamado `'file'`, retornamos 400 inmediatamente. 
-   Validar primero evita errores confusos más adelante.

#### Archivos vacios
```python
        file = request.files['file']

        if file.filename == '':
            return {'error': 'No file selected'}, 400
```
-   Es posible que el campo `'file'` exista pero esté vacío — esto pasa cuando el formulario HTML se envía sin seleccionar ningún archivo. 
-   `file.filename == ''` detecta ese caso.

#### Convertir a minúscula
```python
        if not file.filename.lower().endswith('.pdf'):
            return {'error': 'File must be a PDF'}, 400
```
-   `.lower()` convierte el nombre a minúsculas antes de verificar la extensión — así pasan igual los archivos: 
    +   `RECETA.PDF`
    +   `Receta.Pdf`
    +   `receta.pdf`  
-   Esta validación es básica (alguien podría renombrar un `.jpg` como `.pdf`) pero suficiente para el MVP.

#### Lee el contenido en bytes
```python
        file_bytes = file.read()
```
-   Lee todo el contenido del archivo en memoria como `bytes`. 
-   El objeto `FileStorage` de Flask actúa como un file-like object
-   `.read()` devuelve los bytes crudos del archivo. 
-   Después de este punto, `file_bytes` contiene el PDF completo en RAM.

#### Delegar proceso al facade
```python
        result = facade.scan_pdf(
            user_id=user_id,
            file_bytes=file_bytes,
            filename=file.filename
        )
```
-   Delegamos todo el procesamiento al facade. 
-   `scan.py` no sabe nada de PyMuPDF ni de Groq — solo recibe el archivo, valida lo básico y pasa el trabajo al facade.

#### Error de extracción
```python
        if result is None:
            return {'error': 'Could not extract recipe from PDF'}, 500
```
-   Si el facade retornó `None` (PDF vacío, error de Groq, JSON inválido), respondemos con 500. 
-   En producción podríamos distinguir entre un 400 (PDF sin texto) y un 500 (error de Groq), pero para el MVP un 500 genérico es suficiente.

#### Asignar variable
```python
        recipe, ingredients, steps = result
```
**Desempaquetado de tupla** — Python permite asignar múltiples variables de una tupla en una sola línea. 
Es equivalente a:
```python
recipe = result[0]
ingredients = result[1]
steps = result[2]
```

#### Return
```python
        return {
            'recipe': {...},
            'ingredients': [...],
            'steps': [...]
        }, 201
```
-   La respuesta incluye la receta completa con sus ingredientes y pasos en un solo JSON. 
-   Esto es más eficiente que obligar al cliente a hacer tres peticiones separadas para obtener la misma información.

---

### Registrar el namespace en `app/__init__.py`

```python
from app.api.v1.scan import api as scan_ns
api.add_namespace(scan_ns, path='/api/v1/scan')
```

---

# Sesión 7 — Sprint 3 · CRUD completo (`api/v1/auth.py` + `api/v1/recipes.py` + `services/facade.py`)

## Análisis de CRUD por endpoint

| Endpoint | GET | POST | PUT | DELETE |
|---|---|---|---|---|
| `/auth` | ✅ `/me` | ✅ `/register` `/login` | ✅ `/me` ← nuevo | ✅ `/me` ← nuevo |
| `/recipes` | ✅ lista + detalle | ✅ | ✅ + 403 ← corregido | ✅ + 403 ← corregido |
| `/ingredients` | ✅ lista + detalle | ✅ | ✅ | ✅ |

---

## `PUT /api/v1/auth/me` — Actualizar perfil

Permite al usuario autenticado actualizar su propio nombre, email o contraseña.

```python
user_update_model = api.model('UserUpdate', {
    'first_name': fields.String(description='First name'),
    'last_name': fields.String(description='Last name'),
    'email': fields.String(description='Email address'),
    'password': fields.String(description='New password')
})
```

Todos los campos son opcionales — el usuario puede cambiar solo lo que quiere.

```python
    def put(self):
        user_id = get_jwt_identity()
        data = dict(api.payload)

        if 'email' in data:
            existing = facade.get_user_by_email(data['email'])
            if existing and existing.id != user_id:
                return {'error': 'Email already in use'}, 400

        if 'password' in data:
            data['password_hash'] = hash_password(data.pop('password'))

        user = facade.update_user(user_id, **data)
```

**Puntos clave:**

1. `dict(api.payload)` — convierte el payload a un dict mutable. `api.payload` devuelve solo los campos que el usuario envió (no todos los del modelo), así que `update_user` solo actualiza los campos presentes.

2. Verificación de email único: si el usuario quiere cambiar su email, verificamos que ese email no esté en uso por **otra** cuenta. La condición `existing.id != user_id` permite que el usuario "cambie" al mismo email que ya tiene (sin error).

3. Traducción de contraseña: el usuario envía `password` (texto plano), pero el modelo `User` almacena `password_hash`. El endpoint transforma el campo antes de pasarlo al facade — `data.pop('password')` elimina la clave `password` y `data['password_hash']` agrega la versión hasheada.

```
usuario envía: { "password": "nueva123" }
              ↓
hash_password("nueva123") → "$2b$12$..."
              ↓
facade recibe: { "password_hash": "$2b$12$..." }
```

---

## `DELETE /api/v1/auth/me` — Eliminar cuenta

```python
    def delete(self):
        user_id = get_jwt_identity()
        if not facade.get_user_by_id(user_id):
            return {'error': 'User not found'}, 404
        facade.delete_user(user_id)
        return '', 204
```

Retorna `204 No Content` — el estándar REST para operaciones de borrado exitosas. Sin body en la respuesta porque ya no hay nada que devolver.

---

## Métodos nuevos en `facade.py`

```python
def update_user(self, user_id, **kwargs):
    user = self._users.get_by_id(user_id)
    if not user:
        return None
    for key, value in kwargs.items():
        if hasattr(user, key):
            setattr(user, key, value)
    return self._users.update(user)

def delete_user(self, user_id):
    self._users.delete(user_id)
```

Mismo patrón que `update_recipe` y `delete_recipe` — el facade delega al storage, no conoce la lógica de negocio. `**kwargs` permite actualizar cualquier combinación de campos sin necesitar un método diferente para cada caso.

---

## Corrección de ownership en `recipes.py`

**Problema:** `PUT` y `DELETE` en `/recipes/<recipe_id>` no verificaban que la receta perteneciera al usuario logueado. Cualquier usuario autenticado podía modificar o borrar la receta de otro.

**Corrección:**

```python
    def put(self, recipe_id):
        user_id = get_jwt_identity()
        recipe = facade.get_recipe(recipe_id)
        if not recipe:
            return {'error': 'Recipe not found'}, 404
        if recipe.user_id != user_id:
            return {'error': 'Forbidden'}, 403
        ...

    def delete(self, recipe_id):
        user_id = get_jwt_identity()
        recipe = facade.get_recipe(recipe_id)
        if not recipe:
            return {'error': 'Recipe not found'}, 404
        if recipe.user_id != user_id:
            return {'error': 'Forbidden'}, 403
        ...
```

**Códigos HTTP:**
- `404` — la receta no existe (no decimos si es del usuario o no — no le damos pistas al atacante)
- `403 Forbidden` — la receta existe pero no le pertenece al usuario logueado

El orden importa: primero verificamos que existe (404), después que pertenece al usuario (403). Si lo hiciéramos al revés, un atacante podría detectar si un ID de receta existe simplemente por el código de respuesta.

---

## Validación automática con `validate=True`

Durante los tests de Postman se detectó que enviar campos faltantes u obligatorios vacíos devolvía **500** en lugar de **400**. La causa: `@api.expect(model)` sin `validate=True` no valida — el código intentaba acceder a `data['email']` directamente y lanzaba `KeyError` → 500.

**Corrección aplicada en tres archivos:**

```python
# auth.py
@api.expect(register_model, validate=True)
@api.expect(login_model, validate=True)

# recipes.py
@api.expect(recipe_model, validate=True)

# ingredients.py
@api.expect(ingredient_model, validate=True)
```

Con `validate=True`, flask-restx intercepta la petición **antes** de que llegue al método, verifica que todos los campos `required=True` estén presentes, y devuelve automáticamente `400 Bad Request` con un mensaje descriptivo si algo falta. El código del endpoint no necesita manejar ese caso.

---

## Tabla CRUD completa al cierre del Sprint 3

| Endpoint | GET | POST | PUT | DELETE |
|---|---|---|---|---|
| `/api/v1/auth` | `GET /me` — perfil propio | `POST /register` · `POST /login` | `PUT /me` — actualizar perfil | `DELETE /me` — eliminar cuenta |
| `/api/v1/recipes` | `GET /` — mis recetas · `GET /<id>` | `POST /` — crear receta | `PUT /<id>` — actualizar (solo dueño) | `DELETE /<id>` — eliminar (solo dueño) |
| `/api/v1/recipes/<id>/ingredients` | `GET /` — listar · `GET /<id>` | `POST /` — agregar | `PUT /<id>` | `DELETE /<id>` |
| `/api/v1/scan` | — | `POST /` — subir PDF → Groq → receta | — | — |

---

# Sesión 8 — Sprint 3 · Tests Postman (`tests/postman/`)

## ¿Qué es Postman?

Postman es una herramienta para probar APIs HTTP. Permite enviar requests configurados (método, headers, body), ver las respuestas, y escribir **assertions automáticas** en JavaScript que verifican que la API se comporta como se espera.

En este proyecto se usa en lugar de (o además de) pytest para testear los endpoints desde fuera del código — simulando exactamente lo que haría un cliente real (frontend, app móvil).

---

## Estructura de la colección

La colección `tests/postman/RecipeScanner_collection.json` tiene 89 assertions distribuidas en 7 carpetas ejecutadas en orden:

| Carpeta | Requests | Qué verifica |
|---|---|---|
| `1 — Auth` | 10 | Register, login, GET/PUT/DELETE /me, edge cases de auth |
| `2 — Recipes` | 8 | CRUD completo + campos faltantes + IDs inexistentes |
| `3 — Ingredients` | 8 | CRUD completo + receta inexistente + update parcial |
| `4 — Scan` | 2 | Sin archivo → 400; PDF → manual |
| `7 — Cross-User Security` | 7 | User2 no puede modificar recetas de User1 → 403 |
| `5 — Cleanup` | 1 | Borrar receta de test al final |
| `6 — Security` | 3 | Sin token → 401, token inválido → 422, DELETE cuenta |

---

## Cómo importar y ejecutar la colección en Postman

### Paso 1 — Crear workspace

1. Click en el nombre del workspace (arriba izquierda) → **+ Create Workspace**
2. Nombre: `RecipeScanner`, tipo: **Personal** → **Blank workspace** → Create

### Paso 2 — Importar archivos

1. Click en **Import** (`Ctrl+O`) dentro del workspace nuevo
2. Seleccionar ambos archivos:
   - `tests/postman/RecipeScanner_collection.json`
   - `tests/postman/RecipeScanner_environment.json`
3. Click **Import**

### Paso 3 — Seleccionar el entorno

- Dropdown arriba a la derecha: seleccionar **RecipeScanner Dev**
- Sin entorno activo, las variables `{{base_url}}` y `{{token}}` no se resuelven

### Paso 4 — Levantar el servidor

```bash
cd recipe_Scanner/backend
source venv/bin/activate
python run.py
```

El servidor debe estar corriendo en `http://localhost:5000` antes de ejecutar los tests.

### Paso 5 — Ejecutar el Runner

1. Click en los tres puntitos de la colección **RecipeScanner API** → **Run collection**
2. Verificar que todas las carpetas estén seleccionadas
3. Click **Run RecipeScanner API**

El test `Login — success` guarda el JWT automáticamente en `{{token}}` usando:
```javascript
pm.environment.set('token', json.token);
```
Todos los requests protegidos usan ese token en el header `Authorization: Bearer {{token}}`.

> **Importante:** reiniciar el servidor antes de cada ejecución del Runner. La app usa `InMemoryStorage` — los datos se resetean al reiniciar, evitando conflictos de emails duplicados entre runs.

---

## Cómo testear el scan de PDF manualmente

El scan no puede automatizarse en el Runner porque requiere adjuntar un archivo. Se ejecuta de forma individual:

### Paso 1 — Tener el token activo

Correr el Runner completo (o ejecutar `Login — success` manualmente) para que `{{token}}` esté guardado en el entorno.

### Paso 2 — Abrir el request

En la colección: `4 — Scan` → click en **"Upload PDF — MANUAL"** para abrir el request (no Run).

### Paso 3 — Configurar el Working Directory de Postman

La primera vez, Postman puede mostrar un ícono de advertencia naranja en el archivo adjunto. Fix:

1. Click en el ícono de engranaje (Settings) → **General** → **Working Directory**
2. Cambiar la ruta a la carpeta donde está el PDF
3. Volver al request → quitar el archivo → **Select Files** → seleccionar el PDF desde esa carpeta

### Paso 4 — Adjuntar el PDF

- Tab **Body** → **form-data**
- Fila con key `file`, tipo `File` → **Select Files** → seleccionar el PDF de la receta

### Paso 5 — Enviar

Click **Send**. La respuesta esperada es `201` con:

```json
{
  "recipe": {
    "id": "uuid",
    "title": "Torta de Ricota Invertida",
    "description": "...",
    "servings": 8,
    "prep_time_min": 30,
    "category": "Postres"
  },
  "ingredients": [
    { "id": "uuid", "name": "Ricota", "quantity": "500", "unit": "g" }
  ],
  "steps": [
    { "id": "uuid", "order_num": 1, "description": "Precalentar el horno..." }
  ]
}
```

Groq (LLaMA 3.3-70b) extrae la receta del texto del PDF y devuelve JSON estructurado. El endpoint guarda automáticamente la receta, los ingredientes y los pasos en el storage del usuario logueado.

---

## Cierre del Sprint 3

**Sprint 3 — Business Logic + PDF Scan: ✅ COMPLETO**

| Tarea | Estado |
|---|---|
| Facade service (`services/facade.py`) | ✅ |
| Recipe endpoints (`api/v1/recipes.py`) | ✅ |
| Ingredient endpoints (`api/v1/ingredients.py`) | ✅ |
| PDF scan endpoint (`api/v1/scan.py`) | ✅ |
| Groq integration en Facade | ✅ |
| CRUD completo en auth (`GET/PUT/DELETE /me`) | ✅ |
| Validación automática con `validate=True` | ✅ |
| Ownership check en recetas (403) | ✅ |
| Colección Postman — 89 assertions | ✅ |
| Tests unitarios — modelos y repository | ✅ |

**Próximo: Sprint 4** — Precios con Open Food Facts + swap InMemoryStorage → SQLAlchemy.

---

# Sesión 9 — Sprint 4 · Precios con Open Food Facts (`api/v1/costs.py` + `services/facade.py`)

## ¿Qué es Open Food Facts?

Open Food Facts es una **base de datos abierta de productos alimenticios** mantenida por la comunidad, similar a Wikipedia pero para comida. 
Contiene información nutricional, ingredientes, categorías y marcas de millones de productos en todo el mundo.

-   **URL base de la API:** `https://world.openfoodfacts.org`
-   **Autenticación:** ninguna — es completamente pública y gratuita.
-   **Librería a usar:** `requests` — la librería estándar de Python para hacer llamadas HTTP.

### Lo que nos da Open Food Facts

| Dato | ¿Sirve para nosotros? |
|---|---|
| Nombre del producto | ✅ Para confirmar que encontramos el ingrediente |
| Categorías (tags) | ✅ Para inferir el tipo de ingrediente |
| Información nutricional | ✅ Dato extra para el futuro |
| **Precio** | ❌ Datos muy escasos — la mayoría de productos no tienen precio |

### Por qué Open Food Facts no tiene precios confiables

Open Food Facts es un proyecto de nutrición, no de precios. Los precios los carga la comunidad de forma voluntaria y cubren principalmente productos envasados de supermercados europeos. Para ingredientes crudos como "harina", "huevos" o "ricota", raramente hay datos de precio.

**Solución:** usar Open Food Facts para **identificar el producto y su categoría**, y aplicar nuestra propia tabla de precios promedio (`FALLBACK_PRICES`) según el tipo de ingrediente. Esto es honesto, siempre funciona, y demuestra integración con API externa.

---

## Por qué un endpoint separado (Opción B)

Se evaluaron dos diseños:

**Opción A — precio inline en el scan:**
Después de extraer la receta con Groq, llamar a Open Food Facts por cada ingrediente en el mismo request. Problema: si una receta tiene 10 ingredientes, son 10 llamadas HTTP adicionales en un request que ya tarda 2-3 segundos por Groq. Total: 10-15 segundos de espera.

**Opción B — endpoint separado `GET /recipes/<id>/cost` (elegida):**
El scan sigue siendo rápido. El usuario consulta el costo cuando lo necesita.

```
Opción A (descartada):
  POST /scan → Groq (3s) + OFF × 10 ingredientes (5s) = 8s de espera

Opción B (elegida):
  POST /scan → Groq (3s)         ← rápido
  GET /recipes/<id>/cost → OFF   ← bajo demanda, cuando el usuario lo pide
```

Además funciona para cualquier receta, no solo las escaneadas — si el usuario creó una receta manualmente también puede ver su costo estimado.

---

## Nueva dependencia: `requests`

```bash
pip install requests
```

`requests` es la librería HTTP más usada en Python para consumir APIs externas:

```python
import requests
response = requests.get(url, params={...}, timeout=5)
data = response.json()
```

- `params` — parámetros que se agregan a la URL como query string (`?key=value&...`)
- `timeout=5` — si la API no responde en 5 segundos, lanza una excepción. Sin timeout, el request puede colgar indefinidamente y bloquear el servidor Flask.
- `.json()` — parsea el body de la respuesta como JSON directamente.

Agregar a `requirements.txt` con `pip freeze > requirements.txt` después de instalar.

---

## Constantes del módulo en `facade.py`

Al igual que `GROQ_PROMPT`, las constantes de Open Food Facts se definen **antes de la clase**:

```python
OFF_SEARCH_URL = "https://world.openfoodfacts.org/cgi/search.pl"

FALLBACK_PRICES = {
    # Precios en EUR por kg — promedio supermercados Francia 2025
    'harina': 1.20,    'flour': 1.20,
    'azucar': 1.00,    'sugar': 1.00,
    'manteca': 9.00,   'butter': 9.00,
    'leche': 1.20,     'milk': 1.20,
    'huevo': 2.00,     'huevos': 2.00,    
    'egg': 2.00,       'eggs': 2.00,
    'ricota': 8.50,
    'queso': 12.00,    'cheese': 12.00,
    'sal': 0.50,       'salt': 0.50,
    'aceite': 4.00,    'oil': 4.00,
    'crema': 3.50,     'cream': 3.50,
    'limon': 2.50,     'lemon': 2.50,
    'naranja': 1.80,   'orange': 1.80,
    'vainilla': 30.00, 'vanilla': 30.00,
    'chocolate': 8.00, 'cacao': 10.00,
    'levadura': 8.00,  'yeast': 8.00,
    'nuez': 15.00,     'nuts': 15.00,
    'almendra': 20.00, 'almond': 20.00,
}
```

Nivel de módulo = se crea una sola vez cuando Python importa el archivo, no en cada llamada al método.

**FALLBACK_PRICES:** precios en **EUR por kg**, basados en precios promedio de supermercados franceses (Carrefour, Leclerc, Monoprix) en 2025. Son aproximaciones — el objetivo es dar una estimación razonable, no un precio exacto.

---

# Codigo Sprint 4

## `backend/app/models/custom_price.py`

```python
from dataclasses import dataclass, field
import uuid


@dataclass
class CustomPrice:
    user_id: str
    ingredient_name: str
    price_per_kg: float
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
```

### Lógica

#### Estructura del modelo
```py
@dataclass
class CustomPrice:
    user_id: str
    ingredient_name: str
    price_per_kg: float
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
```
-   Mismo patrón que todos los modelos del proyecto — `@dataclass` con `id` autogenerado
-   `user_id` — cada precio custom pertenece a un usuario específico
    +   Cuando migremos a SQLAlchemy, esto se convierte en una foreign key a la tabla `users`
-   `ingredient_name` — se guarda en minúsculas y sin espacios (la facade lo normaliza antes de crear)
-   `price_per_kg` — float en EUR, mismo sistema de unidades que `FALLBACK_PRICES`
-   No tiene `recipe_id` — el precio es global para el usuario, no está atado a una receta específica

---

## Nuevos métodos en `facade.py`

### `get_recipe_cost(recipe_id, user_id)` — método público

```python
def get_recipe_cost(self, recipe_id, user_id):
    recipe = self.get_recipe(recipe_id)
    ingredients = self.get_ingredients_by_recipe(recipe_id)
    result = []
    total = 0.0

    for ing in ingredients:
        price_per_kg = self._get_ingredient_price(ing.name, user_id)
        try:
            qty = float(ing.quantity)
        except (ValueError, TypeError):
            qty = 0.0
        estimated = round(qty * (price_per_kg / 1000), 2)
        total += estimated
        result.append({
            'name': ing.name,
            'quantity': ing.quantity,
            'unit': ing.unit,
            'price_per_kg': price_per_kg,
            'estimated_price': estimated
        })

    return {
        'recipe_id': recipe_id,
        'recipe_title': recipe.title,
        'ingredients': result,
        'total_estimated_cost': round(total, 2),
        'currency': 'EUR',
        'note': 'Estimated prices in EUR/kg. Source: Open Food Facts + average prices France.'
    }
```

#### Lógica
##### Objeto Recipe
```py
def get_recipe_cost(self, recipe_id, user_id):
    recipe = self.get_recipe(recipe_id)
```
-   Obtiene el objeto `Recipe` del storage usando el ID
-   Lo necesitamos para incluir el `recipe_title` en la respuesta
    +   Así el cliente sabe a qué receta corresponde el costo sin tener que hacer otra petición

##### Lista de ingredientes
```py
    ingredients = self.get_ingredients_by_recipe(recipe_id)
```
-   Obtiene la lista de todos los ingredientes asociados a esa receta
-   Este método filtra el storage completo buscando ingredientes cuyo `recipe_id` coincida
    +   Si la receta no tiene ingredientes, devuelve lista vacía y el total será 0

##### Acumuladores
```py
    result = []
    total = 0.0
```
-   `result` va a contener un dict por cada ingrediente con su precio calculado
-   `total` acumula la suma de todos los precios estimados
    +   Se inicializan vacíos/cero antes del loop

##### Loop por ingrediente
```py
    for ing in ingredients:
        price_per_kg = self._get_ingredient_price(ing.name, user_id)
```
-   Itera sobre cada ingrediente de la receta
-   `ing` es un objeto `Ingredient` con atributos `name`, `quantity`, `unit`, `recipe_id`, `id`
-   Pasa `user_id` al método privado para que pueda verificar precios custom del usuario
    +   Orden de lookup: precio custom → Open Food Facts → FALLBACK_PRICES → €5.00

##### Conversión de cantidad
```py
        try:
            qty = float(ing.quantity)
        except (ValueError, TypeError):
            qty = 0.0
```
-   `ing.quantity` es siempre un **string** porque lo guardamos así desde el modelo
    +   Permite valores como `"200"`, `"1/2"`, `"al gusto"`
-   `float("200")` → `200.0` ✅
-   `float("al gusto")` → `ValueError` → `qty = 0.0`
-   `float("1/2")` → `ValueError` → `qty = 0.0`
-   `float(None)` → `TypeError` → `qty = 0.0`
-   Si `qty = 0.0`, el ingrediente aparece en la respuesta con `estimated_price: 0.0`
    +   No se descarta, sigue en la lista pero no suma al total

##### Fórmula de precio
```py
        estimated = round(qty * (price_per_kg / 1000), 2)
        total += estimated
```
-   Primero convierte el precio de euros/kg a euros/gramo dividiendo por 1000
-   Después multiplica por la cantidad en gramos
    +   Ejemplo: 500g de ricota a €8.50/kg → `500 × (8.50 / 1000)` = `500 × 0.0085` = **€4.25**
-   `round(..., 2)` redondea a 2 decimales — resultado en euros con centavos
-   `total += estimated` acumula el precio de cada ingrediente; después del loop tiene la suma total

##### Construcción del resultado por ingrediente
```py
        result.append({
            'name': ing.name,
            'quantity': ing.quantity,
            'unit': ing.unit,
            'price_per_kg': price_per_kg,
            'estimated_price': estimated
        })
```
-   Agrega un dict a la lista `result` con los datos de este ingrediente
-   Incluye `price_per_kg` explícitamente para que el usuario pueda verificar de dónde viene el cálculo
    +   Transparencia total — el cliente puede mostrar "€8.50/kg" junto al precio estimado

##### Return final
```py
    return {
        'recipe_id': recipe_id,
        'recipe_title': recipe.title,
        'ingredients': result,
        'total_estimated_cost': round(total, 2),
        'currency': 'EUR',
        'note': 'Estimated prices in EUR/kg. Source: Open Food Facts + average prices France.'
    }
```
-   `recipe_id` + `recipe_title` — identifica la receta sin que el cliente necesite hacer otra petición
-   `ingredients` — lista con el precio por ingrediente
-   `total_estimated_cost` — `round(total, 2)` porque las sumas de floats acumulan errores de punto flotante
    +   Ejemplo: `4.25 + 0.24` puede dar `4.490000000001` sin el redondeo
-   `currency: 'EUR'` — explícito para que la UI pueda mostrar el símbolo correcto
-   `note` — en inglés, transparencia de que son estimaciones y no precios reales

---

### `_get_ingredient_price(name, user_id)` — método privado

```python
def _get_ingredient_price(self, name, user_id=None):
    name_lower = name.lower().strip()

    if user_id:
        custom = self.get_custom_price(user_id, name_lower)
        if custom:
            return custom.price_per_kg

    try:
        params = {
            'search_terms': name,
            'json': 1,
            'page_size': 1,
            'action': 'process',
            'fields': 'product_name,categories_tags'
        }
        response = requests.get(OFF_SEARCH_URL, params=params, timeout=5)
        products = response.json().get('products', [])

        if products:
            product = products[0]
            product_name = product.get('product_name', '').lower()
            categories = ' '.join(product.get('categories_tags', []))
            combined = f"{product_name} {categories}"
            for key, price in FALLBACK_PRICES.items():
                if key in combined:
                    return price
    except Exception:
        pass

    for key, price in FALLBACK_PRICES.items():
        if key in name_lower:
            return price

    return 5.00
```

#### Lógica
##### Precio custom del usuario
```py
def _get_ingredient_price(self, name, user_id=None):
    name_lower = name.lower().strip()

    if user_id:
        custom = self.get_custom_price(user_id, name_lower)
        if custom:
            return custom.price_per_kg
```
-   `user_id=None` — parámetro opcional para mantener compatibilidad si se llama sin usuario
-   Si el usuario tiene un precio personalizado para este ingrediente, lo usa directamente
    +   Tiene prioridad máxima — el precio custom siempre gana sobre OFF y FALLBACK_PRICES
-   `get_custom_price` busca en `_custom_prices` por `user_id` + `ingredient_name` normalizado

##### Normalización del nombre
```py
    name_lower = name.lower().strip()
```
-   Convierte el nombre a minúsculas y elimina espacios al inicio/final
    +   `"  Ricota Fresca  "` → `"ricota fresca"`
-   Necesario porque los ingredientes vienen de Groq con capitalización variable y posibles espacios

##### Llamada a Open Food Facts
```py
    try:
        params = {
            'search_terms': name,
            'json': 1,
            'page_size': 1,
            'action': 'process',
            'fields': 'product_name,categories_tags'
        }
        response = requests.get(OFF_SEARCH_URL, params=params, timeout=5)
```
-   Todo el bloque está dentro de un `try` porque es una llamada a red
    +   Puede fallar por timeout, DNS, error HTTP, respuesta inválida, o sin conexión
-   Parámetros del query:
    +   `search_terms` — el nombre del ingrediente a buscar
    +   `json: 1` — pide la respuesta en formato JSON (sin esto devuelve HTML)
    +   `page_size: 1` — solo necesitamos el primer resultado, no toda la lista
    +   `action: 'process'` — activa el endpoint de búsqueda de la API
    +   `fields` — pide solo `product_name` y `categories_tags`; sin esto OFF devuelve más de 100 campos por producto
-   `requests` convierte `params` en query string automáticamente
-   `timeout=5` — si la API no responde en 5 segundos, lanza `requests.exceptions.Timeout`

##### Extracción de productos
```py
        products = response.json().get('products', [])

        if products:
            product = products[0]
```
-   `response.json()` — parsea el body de la respuesta como dict Python
-   `.get('products', [])` — extrae la lista; si la clave no existe devuelve lista vacía en lugar de `KeyError`
-   `if products:` — verifica que OFF encontró al menos un producto
-   `products[0]` — toma el primer resultado, el más relevante según OFF

##### Búsqueda de precio en el producto OFF
```py
            product_name = product.get('product_name', '').lower()
            categories = ' '.join(product.get('categories_tags', []))
            combined = f"{product_name} {categories}"
            for key, price in FALLBACK_PRICES.items():
                if key in combined:
                    return price
```
-   `categories_tags` es una lista de tags, ej. `["en:flours", "en:cereals", "en:baking"]`
    +   Se une con espacios para poder buscar por substring en un solo string
-   `combined` concatena nombre y categorías: `"farine de blé t55 en:flours en:cereals-and-their-products"`
-   `"flour" in combined` → `True` → retorna `1.20` (€/kg) — el primer match gana

##### Manejo de errores de red
```py
    except Exception:
        pass
```
-   Captura cualquier excepción: timeout, error DNS, SSL, respuesta no-JSON, etc.
-   `pass` ignora el error y la ejecución continúa en el fallback de abajo

##### Fallback por nombre del ingrediente
```py
    for key, price in FALLBACK_PRICES.items():
        if key in name_lower:
            return price
```
-   Si OFF falló o no encontró match, busca directamente en el nombre del ingrediente
    +   `"ricota" in "ricota fresca"` → `True` → retorna `8.50`

##### Precio por defecto
```py
    return 5.00
```
-   Si nada matchea, €5.00/kg como fallback final
-   Nunca retorna `None` ni `0` — siempre hay un float para que la fórmula funcione

---

### Custom Prices — métodos CRUD

```python
def get_custom_prices(self, user_id):
    return [cp for cp in self._custom_prices.get_all() if cp.user_id == user_id]

def get_custom_price(self, user_id, ingredient_name):
    name_lower = ingredient_name.lower().strip()
    for cp in self._custom_prices.get_all():
        if cp.user_id == user_id and cp.ingredient_name == name_lower:
            return cp
    return None

def create_custom_price(self, user_id, ingredient_name, price_per_kg):
    cp = CustomPrice(
        user_id=user_id,
        ingredient_name=ingredient_name.lower().strip(),
        price_per_kg=price_per_kg
    )
    return self._custom_prices.save(cp)

def update_custom_price(self, user_id, ingredient_name, price_per_kg):
    cp = self.get_custom_price(user_id, ingredient_name)
    if not cp:
        return None
    cp.price_per_kg = price_per_kg
    return self._custom_prices.update(cp)

def delete_custom_price(self, user_id, ingredient_name):
    cp = self.get_custom_price(user_id, ingredient_name)
    if not cp:
        return False
    self._custom_prices.delete(cp.id)
    return True
```

### Lógica

#### `get_custom_prices` — listar todos
```py
def get_custom_prices(self, user_id):
    return [cp for cp in self._custom_prices.get_all() if cp.user_id == user_id]
```
-   Filtra el storage por `user_id` — cada usuario solo ve sus propios precios
-   Mismo patrón que `get_recipes_by_user` y `get_ingredients_by_recipe`

#### `get_custom_price` — buscar por nombre
```py
def get_custom_price(self, user_id, ingredient_name):
    name_lower = ingredient_name.lower().strip()
    for cp in self._custom_prices.get_all():
        if cp.user_id == user_id and cp.ingredient_name == name_lower:
            return cp
    return None
```
-   Busca por dos atributos a la vez (`user_id` + `ingredient_name`)
    +   `InMemoryStorage.get_by_attribute` solo filtra por uno, por eso iteramos manualmente
-   `name_lower` normaliza el input antes de comparar — `"Ricota"` matchea con `"ricota"` guardado

#### `create_custom_price` — crear
```py
def create_custom_price(self, user_id, ingredient_name, price_per_kg):
    cp = CustomPrice(
        user_id=user_id,
        ingredient_name=ingredient_name.lower().strip(),
        price_per_kg=price_per_kg
    )
    return self._custom_prices.save(cp)
```
-   Normaliza el nombre antes de guardarlo — siempre se almacena en minúsculas
    +   Garantiza que las búsquedas posteriores matcheen independientemente de la capitalización del input

#### `update_custom_price` — actualizar precio
```py
def update_custom_price(self, user_id, ingredient_name, price_per_kg):
    cp = self.get_custom_price(user_id, ingredient_name)
    if not cp:
        return None
    cp.price_per_kg = price_per_kg
    return self._custom_prices.update(cp)
```
-   Reutiliza `get_custom_price` para encontrar el objeto — no duplica la lógica de búsqueda
-   Si no existe, retorna `None` — el endpoint lo convierte en 404
-   Solo actualiza `price_per_kg` — el nombre del ingrediente es la clave y no cambia

#### `delete_custom_price` — eliminar
```py
def delete_custom_price(self, user_id, ingredient_name):
    cp = self.get_custom_price(user_id, ingredient_name)
    if not cp:
        return False
    self._custom_prices.delete(cp.id)
    return True
```
-   Retorna `bool` en lugar de `None` — el endpoint necesita saber si existía o no
    +   `True` → existía y se eliminó → 204
    +   `False` → no existía → 404
-   Después del delete el ingrediente vuelve a usar OFF + FALLBACK_PRICES en el próximo cálculo

---

## `backend/app/api/v1/costs.py`

```python
from flask_restx import Namespace, Resource, fields
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.facade import facade

api = Namespace('costs', description='Recipe cost estimation and custom ingredient prices')

price_model = api.model('Price', {
    'ingredient_name': fields.String(required=True, description='Ingredient name'),
    'price_per_kg': fields.Float(required=True, description='Price in EUR per kg')
})

price_update_model = api.model('PriceUpdate', {
    'price_per_kg': fields.Float(required=True, description='New price in EUR per kg')
})


@api.route('/recipes/<string:recipe_id>/cost')
class RecipeCost(Resource):

    @jwt_required()
    @api.response(200, 'Cost estimated successfully')
    @api.response(403, 'Forbidden')
    @api.response(404, 'Recipe not found')
    def get(self, recipe_id):
        user_id = get_jwt_identity()
        recipe = facade.get_recipe(recipe_id)
        if not recipe:
            return {'error': 'Recipe not found'}, 404
        if recipe.user_id != user_id:
            return {'error': 'Forbidden'}, 403
        result = facade.get_recipe_cost(recipe_id, user_id)
        return result, 200


@api.route('/prices')
class PriceList(Resource):

    @jwt_required()
    @api.response(200, 'List of custom prices')
    def get(self):
        user_id = get_jwt_identity()
        prices = facade.get_custom_prices(user_id)
        return [{'id': cp.id, 'ingredient_name': cp.ingredient_name,
                 'price_per_kg': cp.price_per_kg} for cp in prices], 200

    @jwt_required()
    @api.expect(price_model, validate=True)
    @api.response(201, 'Custom price created')
    @api.response(409, 'Price for this ingredient already exists')
    def post(self):
        user_id = get_jwt_identity()
        data = api.payload
        existing = facade.get_custom_price(user_id, data['ingredient_name'])
        if existing:
            return {'error': 'Price for this ingredient already exists. Use PUT to update it.'}, 409
        cp = facade.create_custom_price(user_id, data['ingredient_name'], data['price_per_kg'])
        return {'id': cp.id, 'ingredient_name': cp.ingredient_name,
                'price_per_kg': cp.price_per_kg}, 201


@api.route('/prices/<string:ingredient_name>')
class PriceDetail(Resource):

    @jwt_required()
    @api.response(200, 'Custom price found')
    @api.response(404, 'Custom price not found')
    def get(self, ingredient_name):
        user_id = get_jwt_identity()
        cp = facade.get_custom_price(user_id, ingredient_name)
        if not cp:
            return {'error': 'Custom price not found'}, 404
        return {'id': cp.id, 'ingredient_name': cp.ingredient_name,
                'price_per_kg': cp.price_per_kg}, 200

    @jwt_required()
    @api.expect(price_update_model, validate=True)
    @api.response(200, 'Custom price updated')
    @api.response(404, 'Custom price not found')
    def put(self, ingredient_name):
        user_id = get_jwt_identity()
        cp = facade.update_custom_price(user_id, ingredient_name, api.payload['price_per_kg'])
        if not cp:
            return {'error': 'Custom price not found'}, 404
        return {'id': cp.id, 'ingredient_name': cp.ingredient_name,
                'price_per_kg': cp.price_per_kg}, 200

    @jwt_required()
    @api.response(204, 'Custom price deleted')
    @api.response(404, 'Custom price not found')
    def delete(self, ingredient_name):
        user_id = get_jwt_identity()
        if not facade.delete_custom_price(user_id, ingredient_name):
            return {'error': 'Custom price not found'}, 404
        return '', 204
```

### Lógica

#### Imports y Namespace
```py
from flask_restx import Namespace, Resource
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.facade import facade

api = Namespace('costs', description='Recipe cost estimation via Open Food Facts')
```
-   Mismo patrón que `recipes.py` y `auth.py` — cada archivo define su propio `Namespace`
-   `jwt_required` y `get_jwt_identity` para proteger el endpoint y saber qué usuario pide el costo
-   `facade` es el singleton que tiene toda la lógica de negocio
-   El archivo está separado de `recipes.py` porque consulta una API externa y hace cálculos de estimación
    +   Si mañana cambiamos de Open Food Facts a otra fuente de precios, solo tocamos `costs.py`
    +   No hay riesgo de romper el CRUD de recetas

#### Modelos de precio
```py
price_model = api.model('Price', {
    'ingredient_name': fields.String(required=True, description='Ingredient name'),
    'price_per_kg': fields.Float(required=True, description='Price in EUR per kg')
})

price_update_model = api.model('PriceUpdate', {
    'price_per_kg': fields.Float(required=True, description='New price in EUR per kg')
})
```
-   `price_model` — para `POST /prices`, requiere nombre del ingrediente y precio
-   `price_update_model` — para `PUT /prices/<name>`, solo necesita el nuevo precio
    +   El nombre ya viene en la URL, no hace falta en el body

#### Ruta del endpoint
```py
@api.route('/recipes/<string:recipe_id>/cost')
class RecipeCost(Resource):
```
-   La ruta anida el costo bajo la receta porque el costo es información derivada de sus ingredientes
    +   Sigue convenciones REST donde los recursos secundarios se anidan bajo el recurso padre
-   La URL completa resulta `/api/v1/recipes/<recipe_id>/cost` porque en `__init__.py` se registra con `path='/api/v1'`

#### Método GET — verificación de acceso
```py
    @jwt_required()
    @api.response(200, 'Cost estimated successfully')
    @api.response(403, 'Forbidden — recipe belongs to another user')
    @api.response(404, 'Recipe not found')
    def get(self, recipe_id):
        user_id = get_jwt_identity()
        recipe = facade.get_recipe(recipe_id)
        if not recipe:
            return {'error': 'Recipe not found'}, 404
        if recipe.user_id != user_id:
            return {'error': 'Forbidden'}, 403
```
-   `@jwt_required()` — el endpoint es privado, solo usuarios autenticados pueden calcular costos
-   `get_jwt_identity()` — extrae el `user_id` del token para verificar propiedad
-   Primero verifica que la receta existe → 404 si no
-   Después verifica que le pertenece al usuario autenticado → 403 si no
    +   Mismo patrón de seguridad que el PUT y DELETE de `recipes.py`

#### Delegación a la facade y respuesta
```py
        result = facade.get_recipe_cost(recipe_id, user_id)
        return result, 200
```
-   Pasa `user_id` a la facade para que `_get_ingredient_price` pueda priorizar precios custom
-   `result` ya es un dict listo para serializar como JSON — flask_restx lo convierte automáticamente

#### `PriceList` — GET y POST en `/prices`
```py
@api.route('/prices')
class PriceList(Resource):

    def get(self):
        user_id = get_jwt_identity()
        prices = facade.get_custom_prices(user_id)
        return [{'id': cp.id, 'ingredient_name': cp.ingredient_name,
                 'price_per_kg': cp.price_per_kg} for cp in prices], 200

    def post(self):
        user_id = get_jwt_identity()
        data = api.payload
        existing = facade.get_custom_price(user_id, data['ingredient_name'])
        if existing:
            return {'error': 'Price for this ingredient already exists. Use PUT to update it.'}, 409
        cp = facade.create_custom_price(user_id, data['ingredient_name'], data['price_per_kg'])
        return {'id': cp.id, 'ingredient_name': cp.ingredient_name,
                'price_per_kg': cp.price_per_kg}, 201
```
-   `GET` lista todos los precios custom del usuario autenticado
    +   Cada usuario ve solo sus propios precios — `get_custom_prices` filtra por `user_id`
-   `POST` crea un nuevo precio custom
    +   Primero verifica que no exista ya uno para ese ingrediente → 409 si ya existe
    +   409 Conflict es el código correcto para "recurso duplicado" en REST
    +   Si no existe, lo crea y devuelve 201 Created

#### `PriceDetail` — GET, PUT y DELETE en `/prices/<name>`
```py
@api.route('/prices/<string:ingredient_name>')
class PriceDetail(Resource):

    def get(self, ingredient_name):
        user_id = get_jwt_identity()
        cp = facade.get_custom_price(user_id, ingredient_name)
        if not cp:
            return {'error': 'Custom price not found'}, 404
        return {'id': cp.id, 'ingredient_name': cp.ingredient_name,
                'price_per_kg': cp.price_per_kg}, 200

    def put(self, ingredient_name):
        user_id = get_jwt_identity()
        cp = facade.update_custom_price(user_id, ingredient_name, api.payload['price_per_kg'])
        if not cp:
            return {'error': 'Custom price not found'}, 404
        return {'id': cp.id, 'ingredient_name': cp.ingredient_name,
                'price_per_kg': cp.price_per_kg}, 200

    def delete(self, ingredient_name):
        user_id = get_jwt_identity()
        if not facade.delete_custom_price(user_id, ingredient_name):
            return {'error': 'Custom price not found'}, 404
        return '', 204
```
-   `<string:ingredient_name>` en la URL identifica el precio a operar
    +   La facade normaliza el nombre (`.lower().strip()`) antes de buscar
-   `GET` devuelve un precio custom específico — útil para verificar si ya existe
-   `PUT` actualiza el `price_per_kg` — el nombre del ingrediente no cambia
    +   `update_custom_price` devuelve `None` si no existe → 404
-   `DELETE` elimina el precio custom — a partir de ese momento el ingrediente vuelve a usar OFF + fallback
    +   `delete_custom_price` devuelve `False` si no existe → 404
    +   204 No Content es el código correcto para DELETE exitoso (sin body en la respuesta)

---

## Registro del namespace en `app/__init__.py`

```python
from app.api.v1.costs import api as costs_ns
api.add_namespace(costs_ns, path='/api/v1')
```

#### Lógica
```py
api.add_namespace(costs_ns, path='/api/v1')
```
-   `path='/api/v1'` y no `/api/v1/costs` porque la ruta completa ya está definida en el Namespace
    +   `'/api/v1'` + `'/recipes/<id>/cost'` = `/api/v1/recipes/<id>/cost`

---

## Respuesta del endpoint

```json
GET /api/v1/recipes/<id>/cost  →  200

{
  "recipe_id": "a2a1bb8e-...",
  "recipe_title": "Torta de Ricota Invertida",
  "ingredients": [
    {
      "name": "Ricota",
      "quantity": "500",
      "unit": "g",
      "price_per_kg": 8.50,
      "estimated_price": 4.25
    },
    {
      "name": "Harina",
      "quantity": "200",
      "unit": "g",
      "price_per_kg": 1.20,
      "estimated_price": 0.24
    }
  ],
  "total_estimated_cost": 4.49,
  "currency": "EUR",
  "note": "Estimated prices in EUR/kg. Source: Open Food Facts + average prices France."
}
```

---

## Casos especiales

| Caso | Comportamiento |
|---|---|
| Usuario tiene precio custom para un ingrediente | Usa ese precio, ignora OFF y FALLBACK_PRICES |
| `quantity = "al gusto"` | `float()` falla → qty = 0.0 → estimated_price = 0.0 |
| `quantity = "1/2"` | `float()` falla → qty = 0.0 (limitación actual) |
| Ingrediente no en FALLBACK_PRICES | Precio default: €5.00/kg |
| Open Food Facts timeout | Ignora OFF, usa fallback por nombre |
| Open Food Facts error HTTP | `except Exception` lo captura, usa fallback |
| Recipe sin ingredientes | `total_estimated_cost: 0.0`, lista vacía |
| Usuario intenta ver costo de receta ajena | 403 Forbidden |
| POST precio que ya existe | 409 Conflict — usar PUT para actualizar |
| DELETE precio que no existe | 404 Not Found |
