# RecipeScanner — Documentación de Deploy

---

## Arquitectura de producción

```
Usuario (browser / móvil)
        │
        ▼
┌─────────────────────┐        ┌──────────────────────────────┐
│  Netlify             │        │  Render (Free tier)          │
│  recipes-scanner     │──────▶│  recipe-scanner-kfnm         │
│  .netlify.app        │  API  │  .onrender.com               │
│                      │  REST │                              │
│  frontend/           │       │  backend/ (Docker)           │
│  HTML + CSS + JS     │       │  gunicorn + Flask            │
└─────────────────────┘        └──────────┬───────────────────┘
                                           │
                                           ▼
                                ┌─────────────────────┐
                                │  Base de datos       │
                                │  SQLite (actual)     │
                                │  PostgreSQL (futuro) │
                                └─────────────────────┘
```

**URLs de producción:**
- Frontend: https://recipes-scanner.netlify.app
- API / Swagger: https://recipe-scanner-kfnm.onrender.com/api/docs
- GitHub: https://github.com/juliangf94/recipe-scanner (branch `develop`)

---

## Docker

### Por qué Docker

Containerizar el backend garantiza que el entorno de producción en Render sea idéntico al de desarrollo local — misma versión de Python, mismas dependencias, mismo sistema operativo base.

Para el portfolio demuestra conocimiento de DevOps: no solo "funciona en mi máquina", sino que está empaquetado y deployable en cualquier servidor.

### Estructura multi-stage

El `Dockerfile` tiene dos stages para separar desarrollo de producción:

```dockerfile
# Stage dev — para docker compose local
FROM python:3.12-slim AS dev
CMD ["python", "run.py"]       # Flask dev server con hot reload

# Stage production — para Render
FROM python:3.12-slim AS production
USER appuser                   # usuario no-root (seguridad)
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "run:app"]
```

| Aspecto | Dev | Production |
|---|---|---|
| Servidor | Flask dev server | Gunicorn (WSGI) |
| Usuario | root | appuser (UID 1001) |
| Hot reload | ✅ (bind mount) | ❌ |
| Workers | 1 | 2 |

### Diferencia entre Flask dev server y Gunicorn

**Flask dev server** (`python run.py`): servidor de un solo hilo, pensado para desarrollo. Muestra errores en detalle, reinicia automáticamente al cambiar código. No apto para producción — no maneja múltiples requests simultáneos.

**Gunicorn**: servidor WSGI de producción. Lanza múltiples workers (procesos) que atienden requests en paralelo. Es el estándar para deployar apps Flask/Django en producción.

### Usuario no-root en Docker

Por seguridad, el stage production crea un usuario `appuser` (UID 1001) y corre el proceso como ese usuario en lugar de root. Si el contenedor fuera comprometido, el atacante tendría permisos limitados.

### docker-compose.yml (desarrollo local)

```bash
# Levantar backend en localhost:5000 con hot reload
docker compose up --build

# Reconstruir si cambiaste requirements.txt
docker compose up --build

# Parar
docker compose down
```

El bind mount `./backend:/app` sincroniza el código local con el contenedor — no hace falta rebuildar al cambiar código Python.

---

## Backend — Render

### Configuración del servicio

| Campo | Valor |
|---|---|
| Runtime | Docker |
| Docker target | `production` |
| Branch | `develop` |
| Root directory | `backend` |
| Instance type | Free |

### Variables de entorno en Render

| Variable | Descripción |
|---|---|
| `FLASK_ENV` | `production` |
| `SECRET_KEY` | Clave aleatoria generada con `secrets.token_hex(32)` |
| `JWT_SECRET_KEY` | Clave aleatoria separada para JWT |
| `GROQ_API_KEY` | API key de console.groq.com |
| `DATABASE_URL` | URL de base de datos (ver sección Base de datos) |

### Comportamiento del free tier

- El contenedor se **apaga automáticamente** después de 15 minutos de inactividad.
- El primer request después del apagado tarda **hasta 50 segundos** (cold start).
- El filesystem **no es persistente** — si se usa SQLite, los datos se pierden al reiniciar.
- Para datos persistentes → usar PostgreSQL externo (ver sección Base de datos).

### Deploy automático

Cada push a `develop` en GitHub dispara un redeploy automático en Render.
También se puede forzar manualmente con el botón **Manual Deploy**.

### Troubleshooting — errores encontrados durante el deploy

**Error 1: `pkg_resources==0.0.0`**
```
ERROR: No matching distribution found for pkg_resources==0.0.0
```
`pkg_resources` no es un paquete real de PyPI — es un artefacto que aparece en el output de `pip freeze` en Python 3.8 pero no existe como paquete instalable.

**Fix:** eliminar `pkg_resources==0.0.0` de `requirements.txt`.

---

**Error 2: `SQLALCHEMY_DATABASE_URI` not set**
```
RuntimeError: Either 'SQLALCHEMY_DATABASE_URI' or 'SQLALCHEMY_BINDS' must be set.
```
`ProductionConfig` tenía `SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL')` que retorna `None` si la variable no está seteada. SQLAlchemy rechaza `None`.

**Fix en `config.py`:**
```python
SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
    'sqlite:////app/instance/production.db'
```
Fallback a SQLite local si no hay `DATABASE_URL` configurada.

También se agregó la creación del directorio `instance/` en el `Dockerfile`:
```dockerfile
RUN mkdir -p app/static/uploads/avatars app/static/uploads/recipes instance \
 && chown -R appuser:appgroup app/static/uploads instance
```

---

## Frontend — Netlify

### Configuración del proyecto

| Campo | Valor |
|---|---|
| Git provider | GitHub — `juliangf94/recipe-scanner` |
| Branch | `develop` |
| Base directory | `frontend` |
| Build command | *(vacío — no hay build process)* |
| Publish directory | `frontend` |

### Por qué no hay build command

El frontend es HTML + CSS + JS vanilla puro — no usa React, Vue, ni ningún bundler (Webpack, Vite). Netlify sirve los archivos estáticos directamente sin compilar nada.

### Deploy automático

Cada push a `develop` dispara un redeploy automático en Netlify.

### Detección de entorno en `api.js`

Para que el frontend apunte al backend correcto según el entorno:

```javascript
const IS_LOCAL = window.location.hostname === 'localhost'
              || window.location.hostname === '127.0.0.1';
const BASE_URL = IS_LOCAL
  ? 'http://localhost:5000/api/v1'
  : 'https://recipe-scanner-kfnm.onrender.com/api/v1';
```

En desarrollo local apunta a `localhost:5000`. En Netlify (producción) apunta al backend de Render.

---

## Base de datos

### Estado actual — SQLite

El backend usa SQLite como fallback cuando `DATABASE_URL` no está configurada:
```
/app/instance/production.db
```

**Limitación:** en el free tier de Render el filesystem no es persistente. Si el contenedor se reinicia (automático tras 15 min de inactividad), los datos se pierden.

**Apropiado para:** demos cortas, presentación al jury.
**No apropiado para:** uso real desde el celular, datos que deben persistir.

### Próximo paso — PostgreSQL con Supabase

Para datos persistentes sin costo permanente, migrar a Supabase (PostgreSQL gratuito sin límite de tiempo):

1. Crear cuenta en supabase.com (login con GitHub)
2. Nuevo proyecto → región EU West → anotar contraseña
3. Settings → Database → Connection string → URI → copiar
4. En Render → Environment → `DATABASE_URL` = *(URL de Supabase)*
5. Render reinicia automáticamente con PostgreSQL

El código no cambia — SQLAlchemy detecta el tipo de base de datos por la URL:
- `sqlite:///...` → SQLite
- `postgresql://...` → PostgreSQL

---

## Resumen del proceso de deploy completo

```
1. Código en GitHub (branch develop)
        │
        ├── Render detecta push → build Docker (production stage)
        │     ├── pip install -r requirements.txt
        │     ├── mkdir instance/ uploads/
        │     └── gunicorn --bind 0.0.0.0:5000 --workers 2 run:app
        │
        └── Netlify detecta push → publica frontend/
              └── sirve archivos estáticos directamente
```
