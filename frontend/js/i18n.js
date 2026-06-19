const TRANSLATIONS = {
  en: {
    // Sidebar nav
    nav_home: 'Home',
    nav_recipes: 'My Recipes',
    nav_scan: 'Scan Recipe',
    nav_prices: 'My Prices',
    nav_signout: 'Sign out',

    // Login
    signin_title: 'Welcome back',
    signin_sub: 'Sign in to access your saved recipes',
    label_email: 'Email',
    label_password: 'Password',
    forgot_pwd: 'Forgot your password?',
    btn_signin: 'Sign in',
    signing_in: 'Signing in…',
    no_account: "Don't have an account?",
    link_signup: 'Sign up for free',
    err_fill_fields: 'Please fill in all fields.',
    err_login_failed: 'Invalid email or password.',

    // Register
    signup_title: 'Create your account',
    signup_sub: 'Start scanning recipes and tracking costs',
    trust_free: '✅ Free',
    trust_nocard: '💳 No credit card',
    trust_secure: '🔒 Secure',
    label_firstname: 'First name',
    label_lastname: 'Last name',
    label_confirm: 'Confirm password',
    agree_terms_html: 'I agree to the <a href="#" onclick="return false;">Terms of Service</a> and <a href="#" onclick="return false;">Privacy Policy</a>',
    btn_create_account: 'Create account',
    creating_account: 'Creating account…',
    have_account: 'Already have an account?',
    link_signin: 'Sign in',
    err_pwd_match: 'Passwords do not match.',
    err_accept_terms: 'You must accept the Terms of Service.',
    err_register_failed: 'Registration failed.',

    // Dashboard
    greeting: 'Hello, {name}! 👋',
    recipes_0: 'No recipes yet. Start by scanning a PDF!',
    recipes_1: 'You have 1 recipe',
    recipes_n: 'You have {n} recipes',
    search_ph: 'Search recipes…',
    filter_all: 'All',
    btn_scan_recipe: '⚡ Scan a recipe',
    btn_manual: '+ Manual',
    err_load: 'Error loading recipes.',
    empty_recipes: 'No recipes yet. Scan a PDF or create one manually.',
    no_results: 'No recipes found. Try a different search or category.',
    card_view: 'View →',
    modal_new_recipe: 'New recipe',
    label_title_req: 'Title *',
    label_desc: 'Description',
    label_servings: 'Servings',
    label_prep: 'Prep time (min)',
    label_category: 'Category',
    btn_cancel: 'Cancel',
    btn_create_recipe: 'Create',
    ph_recipe_title: 'Apple pie',
    ph_desc: 'Short description…',
    ph_category: 'Pasta, Desserts, Meat…',
    err_title_req: 'Title is required.',
    err_create: 'Error creating recipe.',

    // Recipe detail
    change_photo: '📷 Change photo',
    add_photo: 'Add photo',
    badge_ai: '✨ AI scanned',
    min_prep: '{n} min prep',
    n_servings_1: '1 serving',
    n_servings_n: '{n} servings',
    btn_edit: '✏️ Edit',
    btn_delete: '🗑 Delete',
    section_ingredients: '🥕 Ingredients',
    ing_1: '1 ingredient',
    ing_n: '{n} ingredients',
    btn_add: '+ Add',
    section_steps: '📋 Steps',
    no_ingredients: 'No ingredients yet. Add the first one!',
    no_steps: 'No steps. Scan a PDF to extract steps automatically.',
    th_ingredient: 'Ingredient',
    th_qty: 'Qty',
    th_price: 'Price',
    est_cost: 'Estimated total cost',
    modal_edit_recipe: 'Edit recipe',
    modal_add_ing: 'Add ingredient',
    label_name_req: 'Name *',
    label_qty_req: 'Quantity *',
    label_unit_req: 'Unit *',
    ph_ing_name: 'Flour',
    btn_save: 'Save',
    err_save: 'Error saving.',
    confirm_del_recipe: 'Delete "{title}"?',
    confirm_del_ing: 'Delete this ingredient?',
    err_add_ing: 'Error adding ingredient.',

    // Manual price override
    modal_set_price: 'Set ingredient price',
    label_price_unit_req: 'Price per unit (€) *',
    src_manual: 'Manual',
    src_custom: 'My DB',
    src_off: 'OFF',
    src_fallback: 'Est.',
    btn_clear_price: 'Clear override',
    btn_save_price: 'Save price',
    btn_fetch_off: '🌐 Fetch from OFF',
    fetching_off: 'Searching…',
    err_price_set: 'Error setting price.',
    err_off_fetch: 'No price found on Open Food Facts.',

    // Prices page
    prices_title: 'My Prices',
    prices_sub: 'Set custom ingredient prices for accurate cost estimates',
    btn_add_price: '+ Add price',
    th_price_kg: 'Price / kg (€)',
    th_actions: 'Actions',
    no_prices: 'No custom prices yet. Add the first one!',
    modal_add_price: 'Add custom price',
    modal_edit_price: 'Edit price',
    label_ing_name_req2: 'Ingredient name *',
    label_price_kg_req: 'Price per kg (€) *',
    ph_price_ing: 'e.g. flour, tomatoes',
    ph_price_val: '1.50',
    err_price_conflict: 'A price for this ingredient already exists.',
    err_price_save: 'Error saving price.',
    err_price_del: 'Error deleting price.',
    confirm_del_price: 'Delete price for "{name}"?',
    btn_edit_price: '✏️ Edit',
    btn_del_price: '🗑 Delete',

    // Recipe sections
    section_no_section: 'General',
    section_new: 'Add section',
    section_add: 'Add section',
    section_new_name: 'New section…',
    section_new_name_prompt: 'Section name:',
    section_rename_prompt: 'New name for this section:',
    section_move: 'Move to section',
    section_created_hint: 'Section "{name}" ready. Use the ⠿ icon on any ingredient to move it here.',
    section_move_hint: 'Use the ⠿ icon on each ingredient to move it to a section.',

    // Sort
    sort_by: 'Sort by',
    sort_name_az: 'Name A→Z',
    sort_name_za: 'Name Z→A',
    sort_price_asc: 'Price low→high',
    sort_price_desc: 'Price high→low',
    sort_store: 'By store',
    sort_brand: 'By brand',

    // Stores + Brand
    th_store: 'Store',
    th_brand: 'Brand',
    label_brand: 'Brand',
    ph_brand: 'e.g. Hacendado',
    no_brand: 'Any brand',
    manage_brands: 'Manage brands',
    brands_title: 'My Brands',
    label_new_brand: 'New brand name',
    btn_add_brand: '+ Add brand',
    no_brands: 'No brands yet.',
    err_brand_create: 'Error creating brand.',
    err_brand_del: 'Error deleting brand.',
    confirm_del_brand: 'Delete brand "{name}"?',
    th_total: 'Total',
    th_price_per_kg: '€/kg',
    no_store: 'Any store',
    auto_cheapest: 'Auto (cheapest)',
    input_mode_qty: 'By amount',
    input_mode_kg: 'Per kg',
    label_bought_qty: 'Quantity bought',
    label_bought_unit: 'Unit',
    label_bought_price: 'Price paid (€)',
    price_preview: 'Calculated: {price} €/kg',
    label_store: 'Store',
    label_new_store: 'New store name',
    btn_add_store: '+ Add store',
    err_store_create: 'Error creating store.',
    manage_stores: 'Manage stores',
    stores_title: 'My Stores',
    no_stores: 'No stores yet.',
    confirm_del_store: 'Delete store "{name}"?',
    err_store_del: 'Error deleting store.',

    // Scan
    scan_title: 'Scan a Recipe',
    scan_sub: 'Extract ingredients and steps automatically with AI',
    how_add: 'How would you like to add it?',
    method_pdf: '📄 Upload PDF',
    method_type: '✏️ Type recipe',
    drop_title: 'Drop your PDF here',
    drop_or: 'or click to browse files',
    btn_browse: 'Browse files',
    ext_label: 'Extraction options',
    opt_ing: '🥕 Ingredients',
    opt_steps: '📋 Steps',
    opt_time: '⏱ Time',
    opt_servings: '🍽 Servings',
    btn_scan_ai: '⚡ Scan with AI',
    scanning_msg: 'AI is analyzing your recipe…',
    ai_powered: 'Powered by',
    ai_title: 'Groq + Llama AI',
    ai_desc: 'Ultra-fast extraction of ingredients, steps, cooking times, and servings from any recipe PDF.',
    ai_badge_speed: '⚡ <2s response',
    ai_badge_lang: '🌍 Multilingual',
    ai_badge_acc: '📊 High accuracy',
    last_scan: 'Last scan result',
    ai_extracted_tag: 'AI Extracted',
    tips_title: '💡 Tips for best results',
    tip_1: 'Use PDF files with clear text (not scanned images)',
    tip_2: 'One recipe per PDF works best',
    tip_3: 'Ingredient quantities should be clearly stated',
    err_only_pdf: 'Only PDF files are accepted.',
    err_scan: 'Error processing the PDF.',
    scan_ok: 'Recipe "{title}" created successfully! Redirecting…',
    res_recipe: 'Recipe',
    res_category: 'Category',
    res_ings: 'Ingredients extracted',
    res_steps: 'Steps extracted',
    res_ing_1: '1 ingredient',
    res_ing_n: '{n} ingredients',
    res_step_1: '1 step',
    res_step_n: '{n} steps',
  },

  es: {
    // Sidebar nav
    nav_home: 'Inicio',
    nav_recipes: 'Mis recetas',
    nav_scan: 'Escanear',
    nav_prices: 'Mis precios',
    nav_signout: 'Cerrar sesión',

    // Login
    signin_title: 'Bienvenido de vuelta',
    signin_sub: 'Iniciá sesión para acceder a tus recetas',
    label_email: 'Email',
    label_password: 'Contraseña',
    forgot_pwd: '¿Olvidaste tu contraseña?',
    btn_signin: 'Iniciar sesión',
    signing_in: 'Iniciando sesión…',
    no_account: '¿No tenés cuenta?',
    link_signup: 'Registrate gratis',
    err_fill_fields: 'Completá todos los campos.',
    err_login_failed: 'Email o contraseña incorrectos.',

    // Register
    signup_title: 'Crea tu cuenta',
    signup_sub: 'Empezá a escanear recetas y calcular costos',
    trust_free: '✅ Gratis',
    trust_nocard: '💳 Sin tarjeta',
    trust_secure: '🔒 Seguro',
    label_firstname: 'Nombre',
    label_lastname: 'Apellido',
    label_confirm: 'Confirmar contraseña',
    agree_terms_html: 'Acepto los <a href="#" onclick="return false;">Términos de servicio</a> y la <a href="#" onclick="return false;">Política de privacidad</a>',
    btn_create_account: 'Crear cuenta',
    creating_account: 'Creando cuenta…',
    have_account: '¿Ya tenés cuenta?',
    link_signin: 'Iniciar sesión',
    err_pwd_match: 'Las contraseñas no coinciden.',
    err_accept_terms: 'Debés aceptar los Términos de Servicio.',
    err_register_failed: 'Error al registrarse.',

    // Dashboard
    greeting: '¡Hola, {name}! 👋',
    recipes_0: '¡Todavía no tenés recetas. Empezá escaneando un PDF!',
    recipes_1: 'Tenés 1 receta',
    recipes_n: 'Tenés {n} recetas',
    search_ph: 'Buscar recetas…',
    filter_all: 'Todas',
    btn_scan_recipe: '⚡ Escanear receta',
    btn_manual: '+ Manual',
    err_load: 'Error al cargar recetas.',
    empty_recipes: 'Sin recetas todavía. Escaneá un PDF o creá una manualmente.',
    no_results: 'No se encontraron recetas. Probá otra búsqueda o categoría.',
    card_view: 'Ver →',
    modal_new_recipe: 'Nueva receta',
    label_title_req: 'Título *',
    label_desc: 'Descripción',
    label_servings: 'Porciones',
    label_prep: 'Tiempo prep. (min)',
    label_category: 'Categoría',
    btn_cancel: 'Cancelar',
    btn_create_recipe: 'Crear',
    ph_recipe_title: 'Tarta de manzana',
    ph_desc: 'Descripción breve…',
    ph_category: 'Pasta, Postres, Carne…',
    err_title_req: 'El título es obligatorio.',
    err_create: 'Error al crear receta.',

    // Recipe detail
    change_photo: '📷 Cambiar foto',
    add_photo: 'Agregar foto',
    badge_ai: '✨ IA escaneado',
    min_prep: '{n} min prep',
    n_servings_1: '1 porción',
    n_servings_n: '{n} porciones',
    btn_edit: '✏️ Editar',
    btn_delete: '🗑 Eliminar',
    section_ingredients: '🥕 Ingredientes',
    ing_1: '1 ingrediente',
    ing_n: '{n} ingredientes',
    btn_add: '+ Agregar',
    section_steps: '📋 Pasos',
    no_ingredients: 'Sin ingredientes todavía. ¡Agregá el primero!',
    no_steps: 'Sin pasos. Escaneá un PDF para extraer pasos automáticamente.',
    th_ingredient: 'Ingrediente',
    th_qty: 'Cant.',
    th_price: 'Precio',
    est_cost: 'Costo total estimado',
    modal_edit_recipe: 'Editar receta',
    modal_add_ing: 'Agregar ingrediente',
    label_name_req: 'Nombre *',
    label_qty_req: 'Cantidad *',
    label_unit_req: 'Unidad *',
    ph_ing_name: 'Harina',
    btn_save: 'Guardar',
    err_save: 'Error al guardar.',
    confirm_del_recipe: '¿Eliminar "{title}"?',
    confirm_del_ing: '¿Eliminar este ingrediente?',
    err_add_ing: 'Error al agregar ingrediente.',

    // Manual price override
    modal_set_price: 'Establecer precio del ingrediente',
    label_price_unit_req: 'Precio por unidad (€) *',
    src_manual: 'Manual',
    src_custom: 'Mi BD',
    src_off: 'OFF',
    src_fallback: 'Est.',
    btn_clear_price: 'Quitar override',
    btn_save_price: 'Guardar precio',
    btn_fetch_off: '🌐 Buscar en OFF',
    fetching_off: 'Buscando…',
    err_price_set: 'Error al establecer precio.',
    err_off_fetch: 'No se encontró precio en Open Food Facts.',

    // Prices page
    prices_title: 'Mis precios',
    prices_sub: 'Definí precios personalizados para calcular costos precisos',
    btn_add_price: '+ Agregar precio',
    th_price_kg: 'Precio / kg (€)',
    th_actions: 'Acciones',
    no_prices: 'Sin precios personalizados todavía. ¡Agregá el primero!',
    modal_add_price: 'Agregar precio',
    modal_edit_price: 'Editar precio',
    label_ing_name_req2: 'Nombre del ingrediente *',
    label_price_kg_req: 'Precio por kg (€) *',
    ph_price_ing: 'ej. harina, tomates',
    ph_price_val: '1.50',
    err_price_conflict: 'Ya existe un precio para este ingrediente.',
    err_price_save: 'Error al guardar el precio.',
    err_price_del: 'Error al eliminar el precio.',
    confirm_del_price: '¿Eliminar precio de "{name}"?',
    btn_edit_price: '✏️ Editar',
    btn_del_price: '🗑 Eliminar',

    // Recipe sections
    section_no_section: 'General',
    section_new: 'Agregar sección',
    section_add: 'Agregar sección',
    section_new_name: 'Nueva sección…',
    section_new_name_prompt: 'Nombre de la sección:',
    section_rename_prompt: 'Nuevo nombre para esta sección:',
    section_move: 'Mover a sección',
    section_created_hint: 'Sección "{name}" lista. Usá el ícono ⠿ en cualquier ingrediente para moverlo aquí.',
    section_move_hint: 'Usá el ícono ⠿ en cada ingrediente para moverlo a una sección.',

    // Sort
    sort_by: 'Ordenar por',
    sort_name_az: 'Nombre A→Z',
    sort_name_za: 'Nombre Z→A',
    sort_price_asc: 'Precio menor→mayor',
    sort_price_desc: 'Precio mayor→menor',
    sort_store: 'Por tienda',
    sort_brand: 'Por marca',

    // Stores + Brand
    th_store: 'Tienda',
    th_brand: 'Marca',
    label_brand: 'Marca',
    ph_brand: 'ej. Hacendado',
    no_brand: 'Cualquier marca',
    manage_brands: 'Gestionar marcas',
    brands_title: 'Mis Marcas',
    label_new_brand: 'Nombre de la nueva marca',
    btn_add_brand: '+ Agregar marca',
    no_brands: 'No hay marcas aún.',
    err_brand_create: 'Error al crear la marca.',
    err_brand_del: 'Error al eliminar la marca.',
    confirm_del_brand: '¿Eliminar marca "{name}"?',
    th_total: 'Total',
    th_price_per_kg: '€/kg',
    no_store: 'Cualquier tienda',
    auto_cheapest: 'Auto (más barato)',
    input_mode_qty: 'Por cantidad',
    input_mode_kg: 'Por kg',
    label_bought_qty: 'Cantidad comprada',
    label_bought_unit: 'Unidad',
    label_bought_price: 'Precio pagado (€)',
    price_preview: 'Calculado: {price} €/kg',
    label_store: 'Tienda',
    label_new_store: 'Nombre de la nueva tienda',
    btn_add_store: '+ Agregar tienda',
    err_store_create: 'Error al crear tienda.',
    manage_stores: 'Gestionar tiendas',
    stores_title: 'Mis tiendas',
    no_stores: 'Sin tiendas todavía.',
    confirm_del_store: '¿Eliminar tienda "{name}"?',
    err_store_del: 'Error al eliminar tienda.',

    // Scan
    scan_title: 'Escanear receta',
    scan_sub: 'Extraé ingredientes y pasos automáticamente con IA',
    how_add: '¿Cómo querés agregarlo?',
    method_pdf: '📄 Subir PDF',
    method_type: '✏️ Escribir receta',
    drop_title: 'Arrastrá tu PDF aquí',
    drop_or: 'o hacé clic para buscar archivos',
    btn_browse: 'Buscar archivos',
    ext_label: 'Opciones de extracción',
    opt_ing: '🥕 Ingredientes',
    opt_steps: '📋 Pasos',
    opt_time: '⏱ Tiempo',
    opt_servings: '🍽 Porciones',
    btn_scan_ai: '⚡ Escanear con IA',
    scanning_msg: 'La IA está analizando tu receta…',
    ai_powered: 'Impulsado por',
    ai_title: 'Groq + Llama IA',
    ai_desc: 'Extracción ultra-rápida de ingredientes, pasos, tiempos y porciones de cualquier PDF de receta.',
    ai_badge_speed: '⚡ <2s respuesta',
    ai_badge_lang: '🌍 Multilingüe',
    ai_badge_acc: '📊 Alta precisión',
    last_scan: 'Último resultado',
    ai_extracted_tag: 'Extraído con IA',
    tips_title: '💡 Consejos para mejores resultados',
    tip_1: 'Usá PDFs con texto claro (no imágenes escaneadas)',
    tip_2: 'Una receta por PDF funciona mejor',
    tip_3: 'Las cantidades deben estar claramente especificadas',
    err_only_pdf: 'Solo se aceptan archivos PDF.',
    err_scan: 'Error al procesar el PDF.',
    scan_ok: '¡Receta "{title}" creada correctamente! Redirigiendo…',
    res_recipe: 'Receta',
    res_category: 'Categoría',
    res_ings: 'Ingredientes extraídos',
    res_steps: 'Pasos extraídos',
    res_ing_1: '1 ingrediente',
    res_ing_n: '{n} ingredientes',
    res_step_1: '1 paso',
    res_step_n: '{n} pasos',
  }
};

function getLang() {
  return localStorage.getItem('lang') || 'en';
}

function t(key) {
  const lang = getLang();
  return (TRANSLATIONS[lang] && TRANSLATIONS[lang][key]) || TRANSLATIONS.en[key] || key;
}

function tf(key, vars) {
  let str = t(key);
  for (const [k, v] of Object.entries(vars)) {
    str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  }
  return str;
}

// ── Category name translation map ─────────────────────────────────────────────
const CAT_MAP = {
  en: {
    'postres': 'Desserts', 'postre': 'Dessert',
    'carne': 'Meat', 'carnes': 'Meat',
    'pasta': 'Pasta', 'pastas': 'Pasta',
    'pollo': 'Chicken',
    'pescado': 'Fish', 'mariscos': 'Seafood',
    'sopa': 'Soup', 'sopas': 'Soups',
    'ensalada': 'Salad', 'ensaladas': 'Salads',
    'desayuno': 'Breakfast',
    'arroz': 'Rice',
    'pan': 'Bread', 'panaderia': 'Bakery',
    'tarta': 'Cake', 'torta': 'Cake', 'tortas': 'Cakes',
    'vegano': 'Vegan', 'vegetariano': 'Vegetarian',
    'aperitivo': 'Appetizer', 'aperitivos': 'Appetizers',
    'bebida': 'Drink', 'bebidas': 'Drinks',
    'sandwich': 'Sandwich',
  },
  es: {
    'desserts': 'Postres', 'dessert': 'Postre',
    'meat': 'Carne',
    'pasta': 'Pasta',
    'chicken': 'Pollo',
    'fish': 'Pescado', 'seafood': 'Mariscos',
    'soup': 'Sopa', 'soups': 'Sopas',
    'salad': 'Ensalada', 'salads': 'Ensaladas',
    'breakfast': 'Desayuno',
    'rice': 'Arroz',
    'bread': 'Pan', 'bakery': 'Panadería',
    'cake': 'Torta', 'cakes': 'Tortas',
    'vegan': 'Vegano', 'vegetarian': 'Vegetariano',
    'appetizer': 'Aperitivo', 'appetizers': 'Aperitivos',
    'drink': 'Bebida', 'drinks': 'Bebidas',
    'sandwich': 'Sandwich',
  }
};

function tCat(category) {
  if (!category) return category;
  const lang = getLang();
  const map = CAT_MAP[lang];
  return (map && map[category.toLowerCase()]) || category;
}

function titleCase(str) {
  if (!str) return '';
  return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function setLang(lang) {
  localStorage.setItem('lang', lang);
  applyTranslations();
  document.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
}

function applyTranslations() {
  const lang = getLang();

  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });

  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    el.innerHTML = t(el.dataset.i18nHtml);
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });

  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
}

document.addEventListener('DOMContentLoaded', applyTranslations);
