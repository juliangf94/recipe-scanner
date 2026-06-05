# RecipeScanner — Explicación del código línea a línea

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

**Lo que hace `create_app` paso a paso:**
1. Crea la instancia de Flask
2. Carga la configuración según el entorno (development, testing, production)
3. Inicializa extensiones — vacío en esta fase, se completa en Fase 8 con SQLAlchemy
4. Registra los Blueprints — vacío en esta fase, se completa en Fases 4-6
5. Retorna la app lista para usarse

```python
import os
from flask import Flask
from config import config


def create_app(config_name=None):
    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'default')

    app = Flask(__name__)
    app.config.from_object(config[config_name])

    # Initialize extensions here (Phase 8 — SQLAlchemy)

    # Register blueprints here (Phases 4-6 — auth, recipes, scan)

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
Esto permite que `run.py` no tenga el entorno hardcodeado — implemente llama `create_app()` y la función lo resuelve sola.

```python
    app = Flask(__name__)
```
Crea la instancia de Flask. `__name__` es una variable especial de Python que contiene el nombre del módulo actual (`app`). 
Flask lo usa para saber dónde buscar templates y archivos estáticos relativos a este paquete.

```python
    app.config.from_object(config[config_name])
```
- `config[config_name]` accede al diccionario y obtiene la clase correcta, por ejemplo `DevelopmentConfig`. 
- `app.config.from_object()` lee todos los atributos de esa clase (SECRET_KEY, JWT_SECRET_KEY, SQLALCHEMY_DATABASE_URI, etc.) y los carga en la configuración de Flask. 
- A partir de acá, cualquier parte del código puede leer `current_app.config['SECRET_KEY']` y obtener el valor correcto.

```python
    # Initialize extensions here (Phase 8 — SQLAlchemy)
```
**Comentario marcador**:
En la Fase 8 agregaremos aquí `db.init_app(app)` para inicializar SQLAlchemy. 
Por ahora está vacío porque todavía no usamos base de datos.

```python
    # Register blueprints here (Phases 4-6 — auth, recipes, scan)
```
**Comentario marcador** 
En las Fases 4-6 registraremos aquí los Blueprints de Flask (auth, recipes, scan). 
Por ahora está vacío porque todavía no existen esas rutas.

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

## Sesión 2 — Modelos (`backend/app/models/`)

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

### `backend/app/models/user.py`

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

### `backend/app/models/recipe.py`

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

### `backend/app/models/ingredient.py`

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

### `backend/app/models/step.py`

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

### `backend/app/models/pdf_scan.py`

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

### Resumen de campos por modelo

| Modelo | Campos obligatorios | Campos con default |
|---|---|---|
| `User` | `first_name`, `last_name`, `email`, `password_hash` | `id` (UUID) |
| `Recipe` | `title`, `user_id` | `description=''`, `servings=0`, `prep_time_min=0`, `category=''`, `id` (UUID) |
| `Ingredient` | `name`, `quantity`, `unit`, `recipe_id` | `off_product_id=''`, `estimated_cost=0.0`, `cost_is_manual=False`, `id` (UUID) |
| `Step` | `order_num`, `description`, `recipe_id` | `duration_min=0`, `id` (UUID) |
| `PdfScan` | `filename`, `recipe_id` | `status='pending'`, `scanned_at=''`, `id` (UUID) |

---

## Sesión 3 — Repository Pattern (`backend/app/persistence/repository.py`)

### ¿Qué es el Repository Pattern?

El **Repository Pattern** es un patrón de diseño que separa la lógica de negocio
del acceso a datos. En lugar de que la Facade llame directamente a la base de
datos, llama a un repositorio que se encarga de guardar y recuperar objetos.

**Ventaja clave — intercambiabilidad:**
La Facade no sabe si los datos están en RAM, en SQLite o en PostgreSQL. Solo
conoce la interfaz del repositorio. Esto permite que en la Sesión 8 cambiemos
`InMemoryStorage` por `SQLAlchemyRepository` sin tocar una sola línea de la
Facade ni de la API.

```
Sesión 3-7:  Facade → InMemoryStorage (RAM)
Sesión 8:    Facade → SQLAlchemyRepository  ← solo cambia esta línea
```

**¿Por qué todo en un solo archivo?**
A diferencia de tener `repository.py` y `memory_storage.py` separados, ponemos
todo en `repository.py`. Es la misma decisión que tomamos en HBnB — más simple
de navegar, y todas las implementaciones del patrón viven juntas. `memory_storage.py`
queda vacío y se puede eliminar.

**¿Qué es una ABC (Abstract Base Class)?**
Una ABC es una clase que define una interfaz — declara qué métodos deben existir
sin implementarlos. Cualquier clase que herede de ella está obligada a
implementar esos métodos. Si no lo hace, Python lanza un error al instanciarla.

Es el equivalente a un contrato: `InMemoryStorage` y `SQLAlchemyRepository`
firman ese contrato cuando heredan de `BaseRepository`.

---

### `backend/app/persistence/repository.py`

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
  Si no lo hacen, Python lanza `TypeError` al intentar instanciarlas.

```python
class BaseRepository(ABC):
```
Define el contrato. No se puede hacer `BaseRepository()` — solo sirve como
interfaz que `InMemoryStorage` y `SQLAlchemyRepository` deben cumplir.

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
Implementación concreta que usa RAM. Hereda de `BaseRepository` e implementa
los 6 métodos. Al no ser abstracta, puede instanciarse.

```python
    def __init__(self):
        self._storage = {}
```
Diccionario `{ uuid: objeto }`. El `_` indica que es privado — solo la clase
lo usa directamente. Ejemplo de contenido:
```python
{
  'a3f1c2d4-...': User(first_name='Julian', ...),
  'b7e2f3a1-...': User(first_name='Maria', ...)
}
```

```python
    def get_by_attribute(self, attr_name, attr_value):
        return next(
            (obj for obj in self._storage.values()
             if getattr(obj, attr_name) == attr_value),
            None
        )
```
Método genérico para buscar por cualquier campo sin necesitar métodos
específicos como `get_by_email`. `getattr(obj, attr_name)` lee dinámicamente
el atributo con ese nombre del objeto. `next(..., None)` retorna el primer
resultado o `None` si no encuentra ninguno. Ejemplos de uso:
```python
storage.get_by_attribute('email', 'julian@test.com')
storage.get_by_attribute('recipe_id', 'a3f1-...')
```

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
`save` hace `INSERT`, `update` hace `UPDATE`.

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

Cada instancia tiene su propio `_storage` dict independiente — espeja la
estructura de la base de datos (una tabla por entidad). En la Sesión 8,
cada `InMemoryStorage()` se reemplaza por `SQLAlchemyRepository(ModelClass)`.
