import fitz
import json
import os
import requests
from groq import Groq
from app.persistence.repository import InMemoryStorage
from app.models.user import User
from app.models.recipe import Recipe
from app.models.ingredient import Ingredient
from app.models.step import Step
from app.models.pdf_scan import PdfScan
from app.models.custom_price import CustomPrice
from app.utils.security import hash_password


OFF_SEARCH_URL = "https://world.openfoodfacts.org/cgi/search.pl"

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
        self._users = InMemoryStorage()
        self._recipes = InMemoryStorage()
        self._ingredients = InMemoryStorage()
        self._steps = InMemoryStorage()
        self._custom_prices = InMemoryStorage()

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
            category=data.get('category', '')
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

    # --- Custom Prices --- api/v1/costs.py ---

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

    # --- Costs (Open Food Facts) --- api/v1/costs.py ---

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


facade = RecipeScannerFacade()
