import fitz
import json
import os
import requests
from groq import Groq
from app.persistence.db_storage import DbStorage
from app.models.user import User
from app.models.recipe import Recipe
from app.models.ingredient import Ingredient
from app.models.step import Step
from app.models.pdf_scan import PdfScan
from app.models.custom_price import CustomPrice
from app.models.store import Store
from app.models.brand import Brand
from app.utils.security import hash_password


OFF_SEARCH_URL = "https://world.openfoodfacts.org/cgi/search.pl"
OFF_PRICES_URL = "https://prices.openfoodfacts.org/api/v1/prices"

FALLBACK_PRICES = {
    # Prices in EUR per kg — average French supermarket prices 2025
    'harina': 1.20,    'flour': 1.20,
    'azucar': 1.00,    'sugar': 1.00,
    'manteca': 9.00,   'butter': 9.00,
    'leche': 1.20,     'milk': 1.20,
    'huevo': 2.00,     'huevos': 2.00,    'egg': 2.00,    'eggs': 2.00,
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

GROQ_PROMPT = """You are a recipe extraction assistant. \
Extract the recipe from the following text and return ONLY a valid JSON \
object with this exact structure, no explanation, no markdown:

{
  "title": "recipe name",
  "description": "brief description",
  "servings": 4,
  "prep_time_min": 30,
  "category": "category (e.g. Desserts, Main course, Soup)",
  "ingredients": [
    {"name": "ingredient name", "quantity": "200", "unit": "g"}
  ],
  "steps": [
    {"order_num": 1, "description": "step description"}
  ]
}

Use empty string for missing text fields, 0 for missing numbers.
Recipe text:
"""


class RecipeScannerFacade:

    def __init__(self):
        self._users = DbStorage(User)
        self._recipes = DbStorage(Recipe)
        self._ingredients = DbStorage(Ingredient)
        self._steps = DbStorage(Step)
        self._custom_prices = DbStorage(CustomPrice)
        self._stores = DbStorage(Store)
        self._brands = DbStorage(Brand)

    # --- Users --- api/v1/auth.py ---

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

    # --- Recipes --- api/v1/recipes.py ---

    @staticmethod
    def _normalize_category(category):
        if not category:
            return ''
        return category.strip().title()

    def create_recipe(self, user_id, title, description='',
                      servings=0, prep_time_min=0, category=''):
        recipe = Recipe(
            title=title,
            user_id=user_id,
            description=description,
            servings=servings,
            prep_time_min=prep_time_min,
            category=self._normalize_category(category)
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
        if 'category' in kwargs:
            kwargs['category'] = self._normalize_category(kwargs['category'])
        for key, value in kwargs.items():
            if hasattr(recipe, key):
                setattr(recipe, key, value)
        return self._recipes.update(recipe)

    def delete_recipe(self, recipe_id):
        self._recipes.delete(recipe_id)

    # --- Ingredients --- api/v1/ingredients.py ---

    def add_ingredient(self, recipe_id, name, quantity, unit):
        ingredient = Ingredient(
            name=name,
            quantity=quantity,
            unit=unit,
            recipe_id=recipe_id
        )
        return self._ingredients.save(ingredient)

    def get_ingredient(self, ingredient_id):
        return self._ingredients.get_by_id(ingredient_id)

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

    # --- Steps --- api/v1/scan.py ---

    def add_step(self, recipe_id, order_num, description):
        step = Step(order_num=order_num, description=description, recipe_id=recipe_id)
        return self._steps.save(step)

    def get_steps_by_recipe(self, recipe_id):
        return [s for s in self._steps.get_all() if s.recipe_id == recipe_id]

    # --- Scan (PDF + Groq) --- api/v1/scan.py ---

    def scan_pdf(self, user_id, file_bytes, filename):
        text = self._extract_pdf_text(file_bytes)
        if not text.strip():
            return None

        data = self._call_groq(text)
        if data is None:
            return None

        recipe = self.create_recipe(
            user_id=user_id,
            title=data.get('title', 'Untitled'),
            description=data.get('description', ''),
            servings=data.get('servings', 0),
            prep_time_min=data.get('prep_time_min', 0),
            category=self._normalize_category(data.get('category', ''))
        )

        ingredients = []
        for item in data.get('ingredients', []):
            ing = self.add_ingredient(
                recipe_id=recipe.id,
                name=item.get('name', ''),
                quantity=str(item.get('quantity', '')),
                unit=item.get('unit', '')
            )
            ingredients.append(ing)

        steps = []
        for item in data.get('steps', []):
            step = self.add_step(
                recipe_id=recipe.id,
                order_num=item.get('order_num', 0),
                description=item.get('description', '')
            )
            steps.append(step)

        return recipe, ingredients, steps

    def _extract_pdf_text(self, file_bytes):
        doc = fitz.open(stream=file_bytes, filetype='pdf')
        text = ''
        for page in doc:
            text += page.get_text()
        doc.close()
        return text

    def _call_groq(self, text):
        client = Groq(api_key=os.environ.get('GROQ_API_KEY'))
        try:
            response = client.chat.completions.create(
                model='llama-3.3-70b-versatile',
                messages=[{'role': 'user', 'content': GROQ_PROMPT + text}],
                temperature=0.1
            )
            content = response.choices[0].message.content
            return json.loads(content)
        except Exception:
            return None

    # --- Stores --- api/v1/stores.py ---

    def get_stores(self, user_id):
        return [s for s in self._stores.get_all() if s.user_id == user_id]

    def get_store_by_name(self, user_id, name):
        name_lower = name.lower().strip()
        for s in self._stores.get_all():
            if s.user_id == user_id and s.name.lower() == name_lower:
                return s
        return None

    def create_store(self, user_id, name):
        store = Store(user_id=user_id, name=name.strip())
        return self._stores.save(store)

    def delete_store(self, store_id, user_id):
        store = self._stores.get_by_id(store_id)
        if not store or store.user_id != user_id:
            return False
        self._stores.delete(store_id)
        return True

    # --- Brands --- api/v1/brands.py ---

    def get_brands(self, user_id):
        return [b for b in self._brands.get_all() if b.user_id == user_id]

    def get_brand_by_name(self, user_id, name):
        name_lower = name.lower().strip()
        for b in self._brands.get_all():
            if b.user_id == user_id and b.name.lower() == name_lower:
                return b
        return None

    def get_brand_by_id(self, brand_id):
        return self._brands.get_by_id(brand_id)

    def create_brand(self, user_id, name):
        brand = Brand(user_id=user_id, name=name.strip())
        return self._brands.save(brand)

    def delete_brand(self, brand_id, user_id):
        brand = self._brands.get_by_id(brand_id)
        if not brand or brand.user_id != user_id:
            return False
        self._brands.delete(brand_id)
        return True

    # --- Custom Prices --- api/v1/costs.py ---

    def get_custom_prices(self, user_id):
        return [cp for cp in self._custom_prices.get_all() if cp.user_id == user_id]

    @staticmethod
    def _strip_plural(name):
        """Strip common Spanish/English plural endings for fuzzy matching."""
        if name.endswith('es') and len(name) > 4:
            return name[:-2]
        if name.endswith('s') and len(name) > 3:
            return name[:-1]
        return name

    def get_custom_prices_for_ingredient(self, user_id, ingredient_name):
        name_lower = ingredient_name.lower().strip()
        all_user = [cp for cp in self._custom_prices.get_all() if cp.user_id == user_id]

        # 1. Exact match
        exact = [cp for cp in all_user if cp.ingredient_name == name_lower]
        if exact:
            return exact

        # 2. Word-prefix match: "harina" matches "harina 0000" and vice-versa
        #    Uses ' ' padding so "sal" does NOT match "salsa"
        prefix = [cp for cp in all_user
                  if (name_lower + ' ').startswith(cp.ingredient_name + ' ')
                  or (cp.ingredient_name + ' ').startswith(name_lower + ' ')]
        if prefix:
            return prefix

        # 3. Singular/plural: "huevo" matches "huevos"
        norm = self._strip_plural(name_lower)
        plural = [cp for cp in all_user if self._strip_plural(cp.ingredient_name) == norm]
        if plural:
            return plural

        return []

    def get_custom_price(self, user_id, ingredient_name):
        """Returns cheapest custom price for an ingredient regardless of store."""
        prices = self.get_custom_prices_for_ingredient(user_id, ingredient_name)
        if not prices:
            return None
        return min(prices, key=lambda c: c.price_per_kg)

    def get_custom_price_by_store(self, user_id, ingredient_name, store_id):
        name_lower = ingredient_name.lower().strip()
        matches = [cp for cp in self._custom_prices.get_all()
                   if cp.user_id == user_id and cp.ingredient_name == name_lower
                   and cp.store_id == store_id]
        return min(matches, key=lambda c: c.price_per_kg) if matches else None

    def get_custom_price_by_store_and_brand(self, user_id, ingredient_name, store_id, brand_id):
        name_lower = ingredient_name.lower().strip()
        for cp in self._custom_prices.get_all():
            if (cp.user_id == user_id and cp.ingredient_name == name_lower
                    and cp.store_id == store_id and cp.brand_id == brand_id):
                return cp
        return None

    def get_custom_price_by_id(self, price_id):
        return self._custom_prices.get_by_id(price_id)

    def create_custom_price(self, user_id, ingredient_name, price_per_kg,
                             store_id=None, brand_id=None, bought_qty=None, bought_unit=None, bought_price=None):
        cp = CustomPrice(
            user_id=user_id,
            ingredient_name=ingredient_name.lower().strip(),
            price_per_kg=price_per_kg,
            store_id=store_id,
            brand_id=brand_id,
            bought_qty=bought_qty,
            bought_unit=bought_unit,
            bought_price=bought_price
        )
        return self._custom_prices.save(cp)

    def update_custom_price(self, price_id, price_per_kg,
                             store_id=None, brand_id=None, bought_qty=None, bought_unit=None, bought_price=None):
        cp = self._custom_prices.get_by_id(price_id)
        if not cp:
            return None
        cp.price_per_kg = price_per_kg
        if store_id is not None:
            cp.store_id = store_id
        cp.brand_id = brand_id  # always update (can be cleared to None)
        if bought_qty is not None:
            cp.bought_qty = bought_qty
        if bought_unit is not None:
            cp.bought_unit = bought_unit
        if bought_price is not None:
            cp.bought_price = bought_price
        return self._custom_prices.update(cp)

    def delete_custom_price_by_id(self, price_id, user_id):
        cp = self._custom_prices.get_by_id(price_id)
        if not cp or cp.user_id != user_id:
            return False
        self._custom_prices.delete(price_id)
        return True

    def set_ingredient_preferred_store(self, ing_id, store_id):
        ing = self._ingredients.get_by_id(ing_id)
        if not ing:
            return None
        ing.preferred_store_id = store_id
        return self._ingredients.update(ing)

    # --- Costs (Open Food Facts + custom DB + manual) --- api/v1/costs.py ---

    def get_recipe_cost(self, recipe_id, user_id):
        recipe = self.get_recipe(recipe_id)
        ingredients = self.get_ingredients_by_recipe(recipe_id)
        result = []
        total = 0.0

        for ing in ingredients:
            price_per_kg, source, store_id = self._resolve_price(ing, user_id)
            try:
                qty = float(ing.quantity)
            except (ValueError, TypeError):
                qty = 0.0
            if source == 'manual':
                estimated = round(qty * price_per_kg, 2)
            else:
                estimated = round(qty * (price_per_kg / 1000), 2)
            total += estimated
            result.append({
                'ing_id': ing.id,
                'name': ing.name,
                'quantity': ing.quantity,
                'unit': ing.unit,
                'price_per_kg': price_per_kg,
                'estimated_price': estimated,
                'source': source,
                'active_store_id': store_id,
                'preferred_store_id': ing.preferred_store_id,
                'preferred_brand_id': getattr(ing, 'preferred_brand_id', None)
            })

        return {
            'recipe_id': recipe_id,
            'recipe_title': recipe.title,
            'ingredients': result,
            'total_estimated_cost': round(total, 2),
            'currency': 'EUR'
        }

    def _resolve_price(self, ing, user_id=None):
        """Returns (price_per_kg, source, store_id)."""
        # 1. Manual override
        if ing.manual_price is not None:
            return ing.manual_price, 'manual', None

        name_lower = ing.name.lower().strip()

        # 2. Custom DB — 4-case priority: store+brand > store only > brand only > cheapest
        if user_id:
            customs = self.get_custom_prices_for_ingredient(user_id, name_lower)
            if customs:
                has_store = bool(ing.preferred_store_id)
                has_brand = bool(getattr(ing, 'preferred_brand_id', None))

                if has_store and has_brand:
                    match = [c for c in customs
                             if c.store_id == ing.preferred_store_id
                             and c.brand_id == ing.preferred_brand_id]
                    if match:
                        best = min(match, key=lambda c: c.price_per_kg)
                        return best.price_per_kg, 'custom', best.store_id

                if has_store:
                    at_store = [c for c in customs if c.store_id == ing.preferred_store_id]
                    if at_store:
                        best = min(at_store, key=lambda c: c.price_per_kg)
                        return best.price_per_kg, 'custom', best.store_id

                if has_brand:
                    at_brand = [c for c in customs if c.brand_id == ing.preferred_brand_id]
                    if at_brand:
                        best = min(at_brand, key=lambda c: c.price_per_kg)
                        return best.price_per_kg, 'custom', best.store_id

                best = min(customs, key=lambda c: c.price_per_kg)
                return best.price_per_kg, 'custom', best.store_id

        # 3. Cached OFF price
        if ing.price_source == 'off' and ing.estimated_cost and ing.estimated_cost > 0:
            return ing.estimated_cost, 'off', None

        # 4. Local fallback dict
        for key, price in FALLBACK_PRICES.items():
            if key in name_lower:
                return price, 'fallback', None

        return 5.00, 'fallback', None

    def fetch_and_cache_off_price(self, ing_id):
        """Calls OFF API, caches the result on the ingredient, returns (price, source) or None."""
        ing = self._ingredients.get_by_id(ing_id)
        if not ing:
            return None
        price = self._get_off_price(ing.name)
        if price:
            ing.estimated_cost = price
            ing.price_source = 'off'
            self._ingredients.update(ing)
            return price
        return None

    def _get_off_price(self, name):
        """Queries Open Food Facts → Open Prices for a real EUR/kg price."""
        try:
            search_res = requests.get(OFF_SEARCH_URL, params={
                'search_terms': name,
                'json': 1,
                'page_size': 1,
                'fields': 'code,product_name'
            }, timeout=5)
            products = search_res.json().get('products', [])
            if not products:
                return None

            code = products[0].get('code')
            if not code:
                return None

            prices_res = requests.get(OFF_PRICES_URL, params={
                'product_code': code,
                'currency': 'EUR',
                'price_per': 'KILOGRAM',
                'size': 10
            }, timeout=5)
            items = prices_res.json().get('items', [])
            if not items:
                return None

            values = [i['price'] for i in items if i.get('price') and i['price'] > 0]
            if not values:
                return None

            return round(sum(values) / len(values), 2)
        except Exception:
            return None

    def set_manual_price(self, ing_id, price):
        ing = self._ingredients.get_by_id(ing_id)
        if not ing:
            return None
        ing.manual_price = price
        ing.cost_is_manual = True
        return self._ingredients.update(ing)

    def clear_manual_price(self, ing_id):
        ing = self._ingredients.get_by_id(ing_id)
        if not ing:
            return None
        ing.manual_price = None
        ing.cost_is_manual = False
        return self._ingredients.update(ing)


facade = RecipeScannerFacade()
