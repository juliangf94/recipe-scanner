# RecipeScanner — Flujo del proyecto de A a Z

Documento de estudio para la presentación al profesor.
No explica línea a línea — explica QUÉ hace cada parte y POR QUÉ existe.

---

## Índice de documentación

| Tema | Documento | Sección |
|---|---|---|
| Decisiones técnicas | `DEVLOG.md` | "Decisiones técnicas documentadas" |
| Modelos de datos | `DEVLOG.md` | "Modelo de datos" |
| Fuzzy matching + `_norm` | `DEVLOG.md` | "Decisión 12" |
| Stores y Brands | `DEVLOG.md` | "Decisión 10" |
| Resolución de precio 4 casos | `DEVLOG.md` | "Decisión 11" |
| Frontend estático vs Jinja2 | `DEVLOG.md` | "Decisión 9" |
| Repository Pattern explicado | `CODE_NOTES_BACK.md` | "Sesión 3" |
| Facade explicada línea a línea | `CODE_NOTES_BACK.md` | "Sesión 5" |
| Groq / PDF scan explicado | `CODE_NOTES_BACK.md` | "Sesión 6" |
| Open Food Facts + precios | `CODE_NOTES_BACK.md` | "Sesión 9" |
| Fuzzy matching código | `CODE_NOTES_BACK.md` | "Sesión 14" |
| `_norm` + Option A código | `CODE_NOTES_BACK.md` | "Sesión 14" |
| Frontend arquitectura | `CODE_NOTES_FRONT.md` | "Arquitectura del frontend" |
| i18n (EN/ES/FR) | `CODE_NOTES_FRONT.md` | "Sesión 11" |
| Docker + Deploy | `DEPLOY.md` | completo |
| Plan de sprints | `SPRINT_PLAN.md` | completo |

---

## Flujo completo — de A a Z

```
┌─────────────────────────────────────────────────────────────┐
│  USUARIO                                                    │
│  Abre el navegador en recipes-scanner.netlify.app           │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTML + JS estático (Netlify)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND  (frontend/)                                      │
│  index.html → register.html → dashboard.html               │
│  recipe.html / scan.html / prices.html / home.html         │
│                                                             │
│  api.js hace fetch() a la API con JWT en el header          │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTP REST (JSON)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  API  (backend/app/api/v1/)                                 │
│  auth.py / recipes.py / ingredients.py / scan.py            │
│  costs.py / stores.py / brands.py                          │
│                                                             │
│  Valida JWT → delega a la Facade                            │
└─────────────────────────┬───────────────────────────────────┘
                          │ llamadas Python
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  FACADE  (backend/app/services/facade.py)                   │
│  Toda la lógica de negocio en un solo lugar                 │
│                                                             │
│  ├── Repositorios → base de datos                           │
│  ├── Groq API → extracción de recetas desde PDF             │
│  ├── Open Food Facts → precios de ingredientes              │
│  └── DeepL/LibreTranslate → traducciones EN/ES/FR           │
└──────────┬──────────────┬──────────────┬────────────────────┘
           │              │              │
           ▼              ▼              ▼
      SQLAlchemy       Groq API      Open Food Facts
      (SQLite/PG)    (Qwen 3.6-27b)   (precios)
```

---

## 1. Los Modelos — qué datos guarda la app

Los modelos son clases Python que representan las tablas de la base de datos.
Cada modelo es un `db.Model` de SQLAlchemy — no escribís SQL, trabajás con objetos.

```
User ──────────────────────────────────────────────────────────
  id (UUID)         email          password_hash
  first_name        last_name      avatar_url

Recipe ────────────────────────────────────────────────────────
  id (UUID)         user_id (FK→User)    title / title_en/es/fr
  description       servings             prep_time_min
  category          image_url

Ingredient ────────────────────────────────────────────────────
  id (UUID)         recipe_id (FK→Recipe)
  name              name_en / name_es / name_fr
  quantity          unit
  estimated_cost    cost_is_manual
  manual_price      price_source ('custom'|'off'|'fallback'|'manual')
  section           preferred_store_id (FK→Store)
                    preferred_brand_id (FK→Brand)

Step ──────────────────────────────────────────────────────────
  id (UUID)         recipe_id (FK→Recipe)
  order_num         description / description_en/es/fr
  duration_min

Store / Brand ─────────────────────────────────────────────────
  id (UUID)         user_id (FK→User)     name

CustomPrice ───────────────────────────────────────────────────
  id (UUID)         user_id (FK→User)
  ingredient_name   store_id (FK→Store)   brand_id (FK→Brand)
  bought_qty        bought_unit           bought_price

CookLog ───────────────────────────────────────────────────────
  id (UUID)         recipe_id (FK→Recipe)
  user_id (FK→User) cooked_at
```

**Por qué UUID y no números enteros como IDs:**
Con `id=1, 2, 3...` cualquiera puede adivinar que existe el usuario 2 y probar acceder a sus recetas. Con UUID (`3f8a1c2d-7b4e-...`) es imposible adivinar el ID de otro usuario.

---

## 2. El Repository Pattern — cómo se habla con la base de datos

En lugar de escribir SQL directo en el código, toda la app pasa por una interfaz abstracta.

```
                ┌──────────────────────┐
                │  BaseRepository      │  ← interfaz abstracta (ABC)
                │  (ABC)               │
                │  + get_all()         │
                │  + get_by_id()       │
                │  + save()            │
                │  + update()          │
                │  + delete()          │
                └──────────┬───────────┘
                           │ implementan
              ┌────────────┴────────────┐
              ▼                         ▼
   InMemoryStorage              DbStorage
   (diccionarios Python)        (SQLAlchemy → SQLite/PostgreSQL)
   Fase 1 — tests y desarrollo  Fase 2 — producción
```

**Por qué existe esta capa:**
- Los tests corren contra `InMemoryStorage` — rápidos, sin base de datos real
- La Facade no sabe si habla con SQLite o PostgreSQL — solo llama `save()`, `get_all()`, etc.
- Cambiar de SQLite a PostgreSQL = cambiar una línea en `config.py`

---

## 3. La Facade — el corazón del proyecto

La Facade es **el único punto de entrada para toda la lógica de negocio**.
La API no toca la base de datos directamente — siempre pasa por la Facade.

```python
facade = RecipeScannerFacade()  # instancia única, creada al iniciar la app
```

### Grupos de funciones en la Facade

**Usuarios:**
- `register_user()` → hashea la contraseña con bcrypt, guarda el usuario
- `get_user_by_email()` → busca usuario para el login
- `update_user()` → actualiza nombre, email o contraseña
- `delete_user()` → borra el usuario y todos sus datos

**Recetas:**
- `create_recipe()` → crea la receta, normaliza la categoría
- `get_recipes_by_user()` → lista solo las recetas del usuario (aislamiento)
- `update_recipe()` → edita campos con `**kwargs` (solo los que se pasan)
- `delete_recipe()` → borra receta + ingredientes + pasos + scans

**Ingredientes:**
- `add_ingredient()` → agrega ingrediente, llama automáticamente a `_translate_ingredient()`
- `update_ingredient()` → edita campos, recalcula precio si cambia el nombre

**PDF Scan — flujo completo:**
```
scan_pdf()
  │
  ├── _extract_pdf_text()   → PyMuPDF extrae el texto del PDF
  │
  ├── _call_groq()          → envía el texto a Groq (Qwen 3.6-27b)
  │                           recibe JSON: {title, ingredients, steps}
  │
  ├── create_recipe()       → guarda la receta
  ├── add_ingredient() x N  → guarda cada ingrediente
  ├── add_step() x N        → guarda cada paso
  │
  └── _translate_recipe()   → traduce title/ingredients/steps a EN/ES/FR
                               usando DeepL o LibreTranslate
```

**Precios — flujo completo:**
```
get_recipe_cost()
  │
  └── para cada ingrediente → _resolve_price()
        │
        ├── 1. manual_price?  → devuelve el precio manual del usuario
        │
        ├── 2. custom prices? → busca en la BD del usuario con prioridad:
        │     ├── tienda + marca coinciden → más barato
        │     ├── solo tienda coincide     → más barato en esa tienda
        │     ├── solo marca coincide      → más barato de esa marca
        │     └── ninguno                 → el más barato global
        │
        ├── 3. OFF cache?     → precio ya traído de Open Food Facts
        │
        └── 4. FALLBACK_PRICES → tabla de precios aproximados en €/kg
                                  (última opción si todo lo demás falla)
```

**Fuzzy matching — cómo "harina" encuentra "Harina 0000":**
Antes de buscar en la BD de precios, `get_custom_prices_for_ingredient()` hace 3 intentos:
```
1. Exact match:   "harina" == "harina"         → ✅ directo
2. Word-prefix:   "harina 0000".startswith("harina ") → ✅ coincide
3. Plural/sing:   "huevos" → "huev" == "huevo" → "huev" → ✅ coincide
```

Y antes de todo eso, `_norm()` elimina acentos:
```
_norm("Azúcar en polvo") → "azucar en polvo"
_norm("azucar")          → "azucar"
→ coinciden ✅
```

**Option A — búsqueda multilingüe:**
Si el PDF estaba en francés, el ingrediente puede llamarse "sucre en poudre" pero el precio guardado es "azucar". La Facade busca en TODOS los idiomas del ingrediente:
```
candidates = {"sucre en poudre", "azucar en polvo", "sugar powder"}
             ↑ name               ↑ name_es            ↑ name_en
→ "azucar en polvo" → _norm → word-prefix → encuentra "azucar" ✅
```

---

## 4. La API — cómo el frontend habla con el backend

Cada archivo en `api/v1/` es un **Namespace** de flask-restx (equivalente a un grupo de endpoints).

```
/api/v1/auth/         → auth.py
/api/v1/recipes/      → recipes.py
/api/v1/             → ingredients.py, costs.py
/api/v1/scan/         → scan.py
/api/v1/stores/       → stores.py
/api/v1/brands/       → brands.py
```

### Flujo de un request típico

```
GET /api/v1/recipes/  (con header Authorization: Bearer <token>)
        │
        ▼
  @jwt_required()     → flask-jwt-extended verifica la firma del token
        │               extrae user_id del payload
        ▼
  user_id = get_jwt_identity()
        │
        ▼
  recipes = facade.get_recipes_by_user(user_id)
        │
        ▼
  return [{...}, {...}], 200
```

### Por qué @jwt_required() y no sesiones

Con sesiones, el servidor guarda en memoria "el usuario X está logueado". Con JWT:
- El token contiene el `user_id` firmado con `JWT_SECRET_KEY`
- El servidor NO guarda nada — verifica la firma y extrae el `user_id`
- Si alguien modifica el token, la firma no coincide → rechazado

---

## 5. El Frontend — cómo se conecta con la API

El frontend es HTML + CSS + JS puro, sin framework. Cada página tiene su propio archivo JS.

```
index.html      ← login
register.html   ← registro
dashboard.html  ← lista de recetas
recipe.html     ← detalle: ingredientes, costos, pasos
scan.html       ← subir PDF
prices.html     ← mis precios custom
home.html       ← resumen de costos
```

### api.js — el archivo más importante del frontend

Centraliza TODAS las llamadas HTTP. Cada página importa este archivo y usa `apiFetch()`.

```javascript
// Detecta si estamos en local o en producción
const BASE_URL = IS_LOCAL
  ? 'http://localhost:5000/api/v1'
  : 'https://recipe-scanner-kfnm.onrender.com/api/v1';

// Wrapper de fetch con JWT automático y auto-refresh
async function apiFetch(path, options) {
  // 1. Agrega el header Authorization: Bearer <token>
  // 2. Si el servidor devuelve 401, intenta renovar el token con /auth/refresh
  // 3. Si el refresh funciona, reintenta el request original
  // 4. Si el refresh falla → redirige al login
}
```

### i18n — sistema de traducciones EN/ES/FR

```javascript
// i18n.js carga primero en todas las páginas
const LANGS = { es: {...}, en: {...}, fr: {...} };

// t('nav_home') devuelve "Inicio" / "Home" / "Accueil"
// según el idioma seleccionado guardado en localStorage
```

---

## 6. La autenticación — cómo funciona el JWT

```
1. Usuario hace login (email + contraseña)
        │
        ▼
2. Backend verifica contraseña con bcrypt
        │
        ▼
3. Backend genera dos tokens:
   - access_token  (dura 15 minutos) → para hacer requests
   - refresh_token (dura 30 días)    → para renovar el access_token
        │
        ▼
4. Frontend guarda ambos en localStorage
        │
        ▼
5. Cada request incluye: Authorization: Bearer <access_token>
        │
        ▼
6. Cuando el access_token expira (15 min):
   - api.js detecta el 401
   - Llama a POST /auth/refresh con el refresh_token
   - Obtiene un nuevo access_token
   - Reintenta el request original → el usuario no nota nada
```

---

## 7. El flujo del scan de PDF — de principio a fin

```
Usuario sube un PDF en scan.html
        │
        ▼
POST /api/v1/scan/  (multipart/form-data)
        │
        ▼
facade.scan_pdf(user_id, file_bytes, filename)
        │
        ├── PyMuPDF extrae el texto del PDF
        │   (solo texto seleccionable, no imágenes)
        │
        ├── _call_groq(text)
        │   Prompt enviado a Qwen 3.6-27b:
        │   "Extraé la receta de este texto y devolvé JSON con
        │    title, ingredients (name, quantity, unit), steps (order, description)"
        │
        │   Respuesta de Groq:
        │   { "title": "Tarta de manzana",
        │     "ingredients": [{"name": "harina", "quantity": "300", "unit": "g"}],
        │     "steps": [{"order": 1, "description": "Mezclar..."}] }
        │
        ├── Guarda receta + ingredientes + pasos en la BD
        │
        └── _translate_recipe()
            Traduce title, ingredients y steps a EN/ES/FR
            usando DeepL (si hay API key) o LibreTranslate (fallback)
            → guarda en name_en, name_es, name_fr, etc.
        │
        ▼
Retorna recipe_id → frontend redirige a recipe.html?id=<recipe_id>
```

---

## 8. El cálculo de costos — cómo se estima el precio de una receta

```
GET /api/v1/recipes/<id>/cost
        │
        ▼
facade.get_recipe_cost(recipe_id, user_id)
        │
        ▼
Para cada ingrediente:
  1. Convierte quantity+unit a kg
     (300g → 0.3kg, 2 unidades → estimado)
  2. Llama a _resolve_price(ing, user_id)
     → devuelve (precio_por_kg, fuente, tienda_id)
  3. costo_ingrediente = precio_por_kg × cantidad_en_kg
        │
        ▼
Retorna:
  {
    "ingredients": [
      {"name": "harina", "cost": 0.15, "source": "custom", "store": "Carrefour"},
      {"name": "azúcar", "cost": 0.08, "source": "fallback"}
    ],
    "total": 2.43
  }
```

---

## 9. Preguntas frecuentes del profesor

**¿Por qué Flask y no Django?**
Flask da control total — cada componente (JWT, ORM, Swagger) lo elegimos e integramos nosotros. Con Django el framework toma esas decisiones. Para el jury es mejor poder explicar cada línea.

**¿Por qué Groq y no OpenAI?**
Groq tiene un tier gratuito generoso y hardware LPU especializado para LLMs — es significativamente más rápido que OpenAI. El modelo Qwen 3.6-27b es open-source (Alibaba).

**¿Por qué JWT y no sesiones?**
JWT es stateless — el servidor no guarda nada. Cualquier instancia del servidor puede verificar el token. Es el estándar para APIs REST y es compatible con apps móviles futuras.

**¿Por qué Repository Pattern?**
Para desacoplar la lógica de negocio de la base de datos. Los tests usan `InMemoryStorage` (rápido, sin BD real). En producción se usa `DbStorage` (SQLAlchemy). La Facade no sabe la diferencia.

**¿Por qué frontend estático y no Jinja2?**
El frontend desacoplado consume la misma API REST que consumiría una app móvil React Native en el futuro. Si hubiéramos usado Jinja2, el frontend estaría atado al servidor Flask.

**¿Por qué Docker?**
Garantiza que el entorno de producción sea idéntico al de desarrollo. "Funciona en mi máquina" deja de ser un problema. Es el estándar en la industria para deployar aplicaciones.

**¿Cómo se aseguran que un usuario no accede a datos de otro?**
Cada endpoint verifica `recipe.user_id == get_jwt_identity()`. Si no coincide, devuelve 403. Hay tests específicos para esto: `test_get_other_user_recipe_returns_403`.
