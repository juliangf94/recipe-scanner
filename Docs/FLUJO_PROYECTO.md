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
│  ├── DbStorage (SQLAlchemy) → base de datos                 │
│  ├── Groq API → extracción de recetas desde PDF             │
│  ├── Open Food Facts → precios de ingredientes              │
│  ├── DeepL/MyMemory API → traducciones EN/ES/FR             │
│  └── Supabase Storage → fotos de recetas y avatares         │
└──────────┬──────────────┬──────────────┬────────────────────┘
           │              │              │
           ▼              ▼              ▼
      SQLAlchemy         Groq API           Open Food Facts
      (Supabase PG)   (llama-3.3-70b-versatile)   (precios)
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
  section_meta      # JSON con metadata por sección (color). Default: '{}'

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

### ¿Con qué se comunica la Facade?

Esta pregunta es clave para entender el patrón:

```
PREGUNTA:  ¿la Facade se comunica con la API o con los modelos?
RESPUESTA: Ninguna de las dos.

La Facade se comunica con DbStorage.
DbStorage es el que crea e interactúa con las instancias de los modelos SQLAlchemy.

El flujo correcto es:
  API → llama métodos de Facade → Facade crea objetos modelo → Facade llama DbStorage → DbStorage hace db.session.add() / commit()

La API NO toca DbStorage directamente.
La Facade NO toca db.session directamente (salvo casos puntuales como CookLog).
Los modelos (User, Recipe, etc.) son solo clases de datos — no tienen lógica propia.
```

Ejemplo concreto con `register_user`:
```python
# En auth.py (API):
user = facade.register_user(first_name, last_name, email, password)
# La API no sabe cómo se guarda — solo llama a Facade.

# En facade.py (Facade):
def register_user(self, first_name, last_name, email, password):
    user = User(...)              # crea instancia del modelo
    user.password_hash = hash_password(password)
    return self._users.save(user) # delega a DbStorage

# En db_storage.py (DbStorage):
def save(self, obj):
    db.session.add(obj)
    db.session.commit()
    return obj
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
  ├── _call_groq()          → envía el texto a Groq (llama-3.3-70b-versatile)
  │                           recibe JSON: {title, ingredients, steps}
  │
  ├── create_recipe()       → guarda la receta
  ├── add_ingredient() x N  → guarda cada ingrediente
  ├── add_step() x N        → guarda cada paso
  │
  └── _translate_recipe()   → traduce title/ingredients/steps a EN/ES/FR
                               usando DeepL (si hay API key) o MyMemory API (fallback gratuito)
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

// Wrapper de fetch con JWT automático, auto-refresh y timeout
async function apiFetch(path, options) {
  // 1. Agrega el header Authorization: Bearer <token>
  // 2. Si el servidor devuelve 401, intenta renovar el token con /auth/refresh
  // 3. Si el refresh funciona, reintenta el request original
  // 4. Si el refresh falla → redirige al login
  // 5. Internamente usa _fetchWithTimeout (AbortController, 25 s) para
  //    evitar que un cold start de Render deje el request colgado indefinidamente
}
```

### i18n — sistema de traducciones EN/ES/FR

```javascript
// i18n.js carga primero en todas las páginas
const LANGS = { es: {...}, en: {...}, fr: {...} };

// t('nav_home') devuelve "Inicio" / "Home" / "Accueil"
// según el idioma seleccionado guardado en localStorage
```

### home.js — cache TTL y resiliencia frente a cold starts

`home.html` muestra el resumen semanal de cocina. Para evitar llamadas innecesarias a la API en cada visita, `home.js` implementa un cache en `localStorage` con TTL de 5 minutos:

```
Al cargar home.html:
  1. ¿Existe cache en localStorage con clave 'rs_home_summary_v1'?
     ├── No  → llamar GET /summary
     └── Sí  → ¿antigüedad < 5 min (SUMMARY_TTL_MS)?
               ├── Sí (fresco)   → renderizar desde cache, SIN llamar a la API
               └── No (expirado) → llamar GET /summary
  2. Si se llama a la API:
     ├── Éxito → guardar {data, ts} en localStorage, renderizar
     └── Error (AbortError / red) → mostrar mensaje data-i18n="err_load"
```

El cache se invalida automáticamente desde `prices.js` cada vez que el usuario muta sus precios custom (crear, editar o eliminar un precio). Así, si el costo de una receta cambia por un precio nuevo, el próximo acceso a `home.html` obtiene datos frescos del backend.

```
prices.js
  saveRowEdit()  ─┐
  saveNewRow()   ─┼─► invalidateHomeCache() → localStorage.removeItem('rs_home_summary_v1')
  deletePrice()  ─┘
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
        │   Prompt enviado a llama-3.3-70b-versatile (Groq):
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
        └── _translate_recipe()  [hilo daemon — corre en segundo plano, no bloquea la respuesta]
            Traduce title, ingredients y steps a EN/ES/FR
            usando DeepL (si hay API key) o MyMemory API (fallback gratuito, 500k chars/día)
            Las 3 traducciones (EN/ES/FR) corren en paralelo con ThreadPoolExecutor
            → guarda en name_en, name_es, name_fr, title_en, title_es, etc.
            IMPORTANTE: la respuesta HTTP se retorna ANTES de que la traducción termine.
            Las traducciones aparecen al refrescar la receta unos segundos después.
        │
        ▼
Retorna recipe_id INMEDIATAMENTE (antes de que termine la traducción)
→ frontend muestra mensaje de éxito con botón "Ver receta" (scan.html)
  El usuario puede cerrar el mensaje con la X o hacer click en "Ver receta"
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
  1. Convierte quantity+unit a kg según la unidad:
     - Si la unidad es g, gr, gram, grams, ml, millilitro, millilitros
       → aplica qty / 1000 antes de multiplicar por price_per_kg
       Ejemplo: 500g × €10.49/kg = (500/1000) × €10.49 = €5.25
     - Si la unidad es kg, l, litro, liter → usa qty directamente
     - Otras unidades (unidades, tazas, etc.) → usa qty directamente (estimado)
  2. Llama a _resolve_price(ing, user_id)
     → devuelve (precio_por_kg, fuente, tienda_id, bought_unit)
     El 4º valor bought_unit es la unidad con que fue guardado el precio en DB.
  3. Detecta unit_warning:
     → True si la unidad del ingrediente NO es pesable (g/kg/ml/l)
        Y el precio fue guardado con unidad pesable (g/kg/ml/l)
     → Si unit_warning = True: el campo `cost` es None, el frontend muestra ?
  4. costo_ingrediente = precio_por_kg × cantidad_normalizada (solo si !unit_warning)
        │
        ▼
Retorna:
  {
    "ingredients": [
      {"name": "harina", "cost": 0.15, "source": "custom", "store": "Carrefour", "unit_warning": false},
      {"name": "azúcar", "cost": 0.08, "source": "fallback", "unit_warning": false},
      {"name": "huevos", "cost": null, "source": "custom", "unit_warning": true}  // ⚠️ precio en €/kg pero ingrediente en "unidades"
    ],
    "total": 2.23
  }
```

---

## 9. Supabase Storage — fotos persistentes

Render tiene un filesystem efímero: si el contenedor se reinicia, los archivos subidos se pierden. Para persistir fotos de recetas y avatares usamos Supabase Storage.

```
Usuario sube foto (avatar o foto de receta)
        │
        ▼
POST /api/v1/auth/me/avatar   (o POST /api/v1/recipes/<id>/images)
        │
        ▼
backend/app/storage.py
  ├── upload_file(bytes, path, content_type)
  │     └── Supabase REST API → guarda en bucket "recipes" o "avatars"
  │         retorna URL pública permanente (https://xxx.supabase.co/...)
  │
  └── Si Supabase falla → fallback local a /static/uploads/
        (relativa → el frontend llama resolveImgUrl() para construir la URL completa)

La URL se guarda en:
  - User.avatar_url     (para avatares)
  - Recipe.images_json  (array JSON de URLs para múltiples fotos de receta)
```

**resolveImgUrl() en el frontend:**
```javascript
function resolveImgUrl(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url;   // Supabase: URL absoluta → usar tal cual
  return SERVER_URL + url;                  // fallback local: /static/... → backend URL
}
```

---

## 10. Preguntas frecuentes del profesor

**¿La Facade se comunica con la API o con los modelos?**
Ninguna de las dos directamente. La **API** llama métodos de la Facade. La Facade crea instancias de modelos (User, Recipe, etc.) y las pasa a **DbStorage**. DbStorage es quien llama `db.session.add()` y `db.session.commit()`.
```
API → Facade → DbStorage → db.session (SQLAlchemy ORM)
```
Los modelos son clases pasivas de datos — no tienen lógica de persistencia propia.

**¿Qué pasa cuando un usuario se registra, paso a paso?**
```
1. Frontend envía POST /api/v1/auth/register {first_name, last_name, email, password}
2. auth.py (Resource): valida que el email no existe → llama facade.register_user()
3. facade.register_user(): crea User(first_name, last_name, email, password_hash=hash_password(password))
4. hash_password(): llama bcrypt.generate_password_hash() → hash seguro con salt
5. self._users.save(user) → DbStorage.save(): db.session.add(user) + db.session.commit()
6. Retorna {user_id, message: "User created successfully"} con HTTP 201
7. Frontend (auth.js): hace auto-login (POST /auth/login) y redirige al dashboard
```

**¿Por qué Flask y no Django?**
Flask da control total — cada componente (JWT, ORM, Swagger) lo elegimos e integramos nosotros. Con Django el framework toma esas decisiones. Para el jury es mejor poder explicar cada línea.

**¿Por qué Groq y no OpenAI?**
Groq tiene un tier gratuito generoso y hardware LPU especializado para LLMs — es significativamente más rápido que OpenAI. El modelo usado es `llama-3.3-70b-versatile` (Meta, open-source), con `llama-4-scout` como fallback para procesamiento de imágenes.

**¿Por qué JWT y no sesiones?**
JWT es stateless — el servidor no guarda nada. Cualquier instancia del servidor puede verificar el token. Es el estándar para APIs REST y es compatible con apps móviles futuras.

**¿Por qué Repository Pattern?**
Para desacoplar la lógica de negocio de la base de datos. Los tests usan `InMemoryStorage` (rápido, sin BD real). En producción se usa `DbStorage` (SQLAlchemy). La Facade no sabe la diferencia.

**¿Por qué frontend estático y no Jinja2?**
El frontend desacoplado consume la misma API REST que consumiría una app móvil React Native en el futuro. Si hubiéramos usado Jinja2, el frontend estaría atado al servidor Flask.

**¿Por qué Docker?**
Garantiza que el entorno de producción sea idéntico al de desarrollo. "Funciona en mi máquina" deja de ser un problema. Es el estándar en la industria para deployar aplicaciones.

**¿Por qué MyMemory y no DeepL para traducciones?**
DeepL es el primario — si `DEEPL_API_KEY` está configurada, se usa DeepL (calidad superior). MyMemory es el fallback gratuito — no requiere API key, permite 500k chars/día con email registrado. En producción sin clave DeepL, MyMemory traduce correctamente los ingredientes y pasos.

**¿Por qué Supabase Storage y no guardar en el servidor?**
Render tiene filesystem efímero — al reiniciar el contenedor (después de 15 min de inactividad), todos los archivos subidos se pierden. Supabase Storage es persistente, gratuito hasta 1GB, y retorna URLs públicas permanentes. El código tiene fallback local si Supabase falla.

**¿Cómo se aseguran que un usuario no accede a datos de otro?**
Cada endpoint verifica `recipe.user_id == get_jwt_identity()`. Si no coincide, devuelve 403. Hay tests específicos para esto: `test_get_other_user_recipe_returns_403`.

**¿Cómo funciona la tabla de precios editable (Excel-style)?**
En lugar de modales para agregar/editar precios, la página `prices.html` muestra una tabla donde cada celda es un `<input>` o `<select>` editable directamente. El guardado automático ocurre cuando el foco sale de la fila (`onfocusout`). La fila vacía al final crea un nuevo precio al completar el campo de ingrediente. El indicador €/kg se recalcula en tiempo real con cada tecla.

**¿Por qué `section_meta` es una columna TEXT con JSON y no una tabla separada?**
Las secciones son dinámicas y en pequeña cantidad por receta. Una tabla separada requeriría un JOIN extra sin beneficio real dado el volumen de datos.

**¿Por qué la traducción corre en un hilo separado?**
Render tiene un límite de 30s por request. La traducción puede tardar 5–15s. Sin el hilo, el usuario veía un error de conexión aunque la receta se había creado. El hilo daemon retorna la respuesta HTTP inmediatamente.

**¿Por qué el modo oscuro usa `localStorage` y no solo `prefers-color-scheme`?**
La media query responde al SO, no al usuario. Con `localStorage` el usuario puede elegir un tema distinto al del sistema. `theme.js` se carga en `<head>` para evitar FOUC.

**¿Qué significa `unit_warning` en el cálculo de costos?**
Cuando el usuario guardó un precio de "huevos" como €3.50/kg pero el ingrediente en la
receta está en "unidades" (3 huevos), el precio por kg no se puede aplicar directamente.
El backend detecta esta incompatibilidad comparando la unidad del ingrediente con la unidad
con que fue guardado el precio (`bought_unit`). Si son incompatibles, activa `unit_warning: true`.
El frontend muestra ⚠️ en la columna de €/kg y ? en el total — el usuario sabe que el precio
es orientativo y debería editar el ingrediente o el precio para hacerlos compatibles.

**¿Por qué una marca puede tener múltiples ingredientes?**
En la realidad, el usuario compra varios ingredientes en la misma tienda/marca. Por ejemplo,
"Carrefour" puede tener precios para harina, azúcar, manteca, etc. Con el modelo anterior
(una fila por marca), el usuario tenía que crear "Carrefour" una sola vez y luego asociar
ingredientes por separado. Con el nuevo modelo (una fila por nombre+ingrediente), el modal
de creación de marcas permite agregar varios ingredientes a la vez usando chips, y la lista
los muestra agrupados por nombre de marca con ingredientes como sublista.

**¿Cómo funciona la deduplicación de marcas?**
`POST /brands` verifica que no exista ya la combinación `(user_id, nombre, ingredient_name_normalizado)`.
- Crear "Lidl" para "harina" → OK
- Crear "Lidl" para "azúcar" → OK (distinto ingrediente)
- Crear "Lidl" para "harina" de nuevo → 409 Conflict (ya existe esa combinación exacta)
La normalización usa `_norm()` para ser insensible a acentos.

**¿Por qué `home.html` no llama a la API en cada visita?**
`home.js` guarda el resultado de `/summary` en `localStorage` con un timestamp. Al cargar la página, si el cache tiene menos de 5 minutos de antigüedad (`SUMMARY_TTL_MS`), se renderiza directamente desde el cache sin hacer ningún request. Solo cuando el cache expiró o fue invalidado se llama a la API. Esto reduce la carga en el backend de Render y mejora la velocidad de carga percibida.

**¿Qué pasa si el backend tarda demasiado en responder (cold start)?**
Todos los `fetch()` dentro de `apiFetch` usan `_fetchWithTimeout` con un límite de 25 segundos (implementado con `AbortController`). Si el servidor no responde en ese tiempo, se lanza un `AbortError`. Los llamadores que necesitan manejar este caso (como `home.js`) envuelven `apiFetch` en `try/catch` y muestran un mensaje de error traducido (`data-i18n="err_load"`) en lugar de un spinner infinito.

**¿Cuándo se invalida el cache de home?**
Cada vez que el usuario muta sus precios custom desde `prices.html` — crear, editar o eliminar un precio — `prices.js` llama a `invalidateHomeCache()`, que elimina la clave `rs_home_summary_v1` de `localStorage`. El próximo acceso a `home.html` obtendrá datos frescos del backend, reflejando los nuevos precios en el resumen semanal.
