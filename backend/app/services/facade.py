from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta
import deepl
import fitz
import json
import logging
import os
import re
import requests
import unicodedata
import uuid
from groq import Groq
from app.persistence.db_storage import DbStorage
from app.models.user import User
from app.models.recipe import Recipe
from app.models.ingredient import Ingredient
from app.models.step import Step
from app.models.pdf_scan import PdfScan
from app.models.cook_log import CookLog
from app.extensions import db
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

GROQ_PROMPT = """You are a recipe extraction assistant.

Read the recipe text below and extract the information into a JSON object.
Return ONLY the JSON object — no markdown, no explanation, no extra text.

JSON fields:
- "title": the recipe name (string)
- "description": a short description (string, can be empty)
- "servings": number of servings (integer, 0 if not mentioned)
- "prep_time_min": preparation time in minutes (integer, 0 if not mentioned)
- "category": pick ONE from this list that best fits, or empty string if none fit:
  Desserts, Cake, Main Course, Meat, Pasta, Chicken, Fish, Seafood, Soup,
  Salad, Breakfast, Rice, Bread, Bakery, Vegan, Vegetarian, Appetizer,
  Drink, Sandwich, Snack
- "ingredients": array of objects, each with:
    "name" (string), "quantity" (string number), "unit" (string e.g. g, kg, ml, cup)
- "steps": array of objects, each with:
    "order_num" (integer starting at 1), "description" (string)

IMPORTANT: Extract real values from the recipe text. Do NOT use placeholder text.

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

    VALID_CATEGORIES = {
        'Desserts', 'Cake', 'Main Course', 'Meat', 'Pasta', 'Chicken', 'Fish',
        'Seafood', 'Soup', 'Salad', 'Breakfast', 'Rice', 'Bread', 'Bakery',
        'Vegan', 'Vegetarian', 'Appetizer', 'Drink', 'Sandwich', 'Snack'
    }

    @staticmethod
    def _normalize_category(category):
        if not category:
            return ''
        normalized = category.strip().title()
        return normalized if normalized in RecipeScannerFacade.VALID_CATEGORIES else ''

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
        db.session.query(PdfScan).filter(PdfScan.recipe_id == recipe_id).delete()
        db.session.query(CookLog).filter(CookLog.recipe_id == recipe_id).delete()
        for ing in self.get_ingredients_by_recipe(recipe_id):
            self._ingredients.delete(ing.id)
        for step in self.get_steps_by_recipe(recipe_id):
            self._steps.delete(step.id)
        db.session.commit()
        self._recipes.delete(recipe_id)

    # --- Ingredients --- api/v1/ingredients.py ---

    def _translate_ingredient(self, ingredient):
        """Translate a single ingredient name to EN/ES/FR and persist."""
        name = ingredient.name
        source_lang = self._detect_source_lang(name)
        for lang, col in [('EN-US', 'en'), ('ES', 'es'), ('FR', 'fr')]:
            translated, _ = self._translate_batch([name], lang, source_lang=source_lang)
            setattr(ingredient, f'name_{col}', translated[0] or name)
        self._ingredients.update(ingredient)

    def add_ingredient(self, recipe_id, name, quantity, unit, skip_translate=False, section=''):
        ingredient = Ingredient(
            name=name,
            quantity=quantity,
            unit=unit,
            recipe_id=recipe_id,
            section=section or None
        )
        saved = self._ingredients.save(ingredient)
        if not skip_translate:
            self._translate_ingredient(saved)
        return saved

    def get_ingredient(self, ingredient_id):
        return self._ingredients.get_by_id(ingredient_id)

    def get_ingredients_by_recipe(self, recipe_id):
        ings = [i for i in self._ingredients.get_all() if i.recipe_id == recipe_id]
        return sorted(ings, key=lambda i: (i.order_num or 0))

    def update_ingredient(self, ingredient_id, **kwargs):
        ingredient = self._ingredients.get_by_id(ingredient_id)
        if not ingredient:
            return None
        name_changed = 'name' in kwargs and kwargs['name'] != ingredient.name
        for key, value in kwargs.items():
            if hasattr(ingredient, key):
                setattr(ingredient, key, value)
        result = self._ingredients.update(ingredient)
        if name_changed:
            self._translate_ingredient(ingredient)
        return result

    def delete_ingredient(self, ingredient_id):
        self._ingredients.delete(ingredient_id)

    # --- Steps --- api/v1/scan.py ---

    def _translate_step(self, step):
        """Translate a single step description to EN/ES/FR and persist."""
        desc = step.description
        source_lang = self._detect_source_lang(desc)
        for lang, col in [('EN-US', 'en'), ('ES', 'es'), ('FR', 'fr')]:
            translated, _ = self._translate_batch([desc], lang, source_lang=source_lang)
            setattr(step, f'description_{col}', translated[0] or desc)
        self._steps.update(step)

    def add_step(self, recipe_id, order_num, description):
        step = Step(order_num=order_num, description=description, recipe_id=recipe_id)
        return self._steps.save(step)

    def get_steps_by_recipe(self, recipe_id):
        return [s for s in self._steps.get_all() if s.recipe_id == recipe_id]

    def update_step(self, step_id, **kwargs):
        step = self._steps.get_by_id(step_id)
        if not step:
            return None
        desc_changed = 'description' in kwargs and kwargs['description'] != step.description
        for key, value in kwargs.items():
            if hasattr(step, key):
                setattr(step, key, value)
        result = self._steps.update(step)
        if desc_changed:
            self._translate_step(step)
        return result

    def delete_step(self, step_id):
        self._steps.delete(step_id)

    # --- Translations --- deepl + libretranslate fallback ---

    # Maps DeepL lang codes to LibreTranslate lang codes
    _LIBRE_LANG = {'EN-US': 'en', 'ES': 'es', 'FR': 'fr'}

    def _detect_source_lang(self, text):
        """Detect the language of a text using DeepL. Returns e.g. 'ES', 'FR', 'EN'."""
        api_key = os.environ.get('DEEPL_API_KEY', '')
        if not api_key or api_key == 'your-deepl-api-key-here':
            return None
        try:
            translator = deepl.Translator(api_key)
            result = translator.translate_text(text[:300], target_lang='EN-US')
            return result.detected_source_lang.upper()
        except Exception as e:
            logging.warning('Language detection failed: %s', e)
            return None

    def _translate_batch(self, texts, target_lang, source_lang=None):
        """Translate with DeepL; falls back to LibreTranslate. Returns (results, provider).
        source_lang: explicit source language (e.g. 'ES') to prevent short-word misdetection."""
        api_key = os.environ.get('DEEPL_API_KEY', '')
        if api_key and api_key != 'your-deepl-api-key-here':
            try:
                translator = deepl.Translator(api_key)
                target_base = target_lang.split('-')[0].upper()
                if source_lang and source_lang.upper() == target_base:
                    return texts, 'original'
                results = translator.translate_text(
                    texts, target_lang=target_lang,
                    source_lang=source_lang or None
                )
                return [r.text for r in results], 'deepl'
            except Exception as e:
                logging.warning('DeepL failed (%s), trying LibreTranslate: %s', target_lang, e)

        results = self._translate_with_mymemory(texts, target_lang, source_lang=source_lang)
        any_translated = any(r != o for r, o in zip(results, texts))
        return results, 'mymemory' if any_translated else 'none'

    def _translate_with_mymemory(self, texts, target_lang, source_lang=None):
        """Fallback translation via MyMemory API (free, no key required). Runs in parallel."""
        lt_target = self._LIBRE_LANG.get(target_lang, target_lang.lower()[:2])

        if source_lang:
            lt_source = self._LIBRE_LANG.get(source_lang.upper(), source_lang.lower()[:2])
        else:
            try:
                from langdetect import detect
                sample = ' '.join(t for t in texts[:5] if t and t.strip())[:300]
                lt_source = detect(sample) if sample.strip() else 'fr'
            except Exception:
                lt_source = 'fr'

        if lt_source == lt_target:
            return texts

        langpair = f'{lt_source}|{lt_target}'

        def _translate_one(text):
            if not text or not text.strip():
                return text
            try:
                res = requests.get(
                    'https://api.mymemory.translated.net/get',
                    params={'q': text[:500], 'langpair': langpair},
                    timeout=5
                )
                if res.ok:
                    data = res.json()
                    if data.get('responseStatus') == 200:
                        result = data['responseData']['translatedText']
                        if 'QUERY LENGTH LIMIT' not in result and 'MYMEMORY WARNING' not in result:
                            return result
            except Exception as e:
                logging.error('MyMemory failed (%s): %s', langpair, e)
            return text

        results = list(texts)
        try:
            with ThreadPoolExecutor(max_workers=6) as executor:
                future_map = {executor.submit(_translate_one, t): i for i, t in enumerate(texts)}
                for future in as_completed(future_map, timeout=22):
                    idx = future_map[future]
                    try:
                        results[idx] = future.result()
                    except Exception:
                        pass
        except Exception:
            logging.warning('MyMemory: some translations timed out for %s', langpair)
        return results

    def _translate_recipe(self, recipe, ingredients, steps):
        """Populate *_en / *_es / *_fr columns on recipe, ingredients, and steps."""
        ing_names  = [i.name for i in ingredients]
        step_descs = [s.description for s in steps]
        meta       = [recipe.title, recipe.description or '']
        all_texts  = meta + ing_names + step_descs

        sample_parts = [recipe.title] + [i.name for i in ingredients[:6]]
        source_lang = self._detect_source_lang(' '.join(sample_parts))
        logging.info('Detected source language for "%s": %s', recipe.title, source_lang)

        used_provider = 'none'
        all_failed = True

        for lang, col in [('EN-US', 'en'), ('ES', 'es'), ('FR', 'fr')]:
            translated, provider = self._translate_batch(all_texts, lang, source_lang=source_lang)

            if provider in ('deepl', 'mymemory', 'libretranslate', 'original'):
                all_failed = False
                if provider not in ('original', 'none'):
                    used_provider = provider

            setattr(recipe, f'title_{col}', translated[0] or recipe.title)
            setattr(recipe, f'description_{col}', translated[1] or recipe.description or '')

            offset = 2
            for ing in ingredients:
                setattr(ing, f'name_{col}', translated[offset]); offset += 1

            for step in steps:
                setattr(step, f'description_{col}', translated[offset]); offset += 1

        recipe.translation_provider = used_provider
        recipe.translation_status = 'pending' if all_failed else 'done'

        self._recipes.update(recipe)
        for ing in ingredients:
            self._ingredients.update(ing)
        for step in steps:
            self._steps.update(step)

    # --- Scan (PDF + Groq) --- api/v1/scan.py ---

    def scan_pdf(self, user_id, file_bytes, filename, force=False):
        text = self._extract_pdf_text(file_bytes)
        if not text.strip():
            return None, 'no_text'

        data = self._call_groq(text)
        if data is None:
            return None, 'groq_failed'

        if not force:
            title = data.get('title', '').strip().lower()
            if title:
                existing = next(
                    (r for r in self.get_recipes_by_user(user_id)
                     if r.title.strip().lower() == title),
                    None
                )
                if existing:
                    return None, ('duplicate', existing.id, data.get('title', ''))

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
                unit=item.get('unit', ''),
                skip_translate=True
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

        return (recipe, ingredients, steps), None

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
            logging.info('PDF text sent to Groq (first 300 chars): %s', text[:300])
            response = client.chat.completions.create(
                model='llama-3.3-70b-versatile',
                messages=[{'role': 'user', 'content': GROQ_PROMPT + text}],
                temperature=0.1,
            )
            content = response.choices[0].message.content.strip()
            # Strip <think>…</think> blocks produced by Qwen3 reasoning mode
            content = re.sub(r'<think>.*?</think>', '', content, flags=re.DOTALL).strip()
            logging.info('Groq raw response (first 200 chars): %s', content[:200])

            # Strip markdown code fences (```json ... ```)
            content = re.sub(r'```(?:json)?\s*', '', content).strip()

            # Find the first { that looks like a real JSON object start (followed by whitespace then ")
            match = re.search(r'\{\s*"', content)
            if match is None:
                logging.error('No JSON object found in Groq response: %s', content[:500])
                return None
            start = match.start()
            depth = 0
            end = start
            for i, ch in enumerate(content[start:], start):
                if ch == '{':
                    depth += 1
                elif ch == '}':
                    depth -= 1
                    if depth == 0:
                        end = i
                        break
            try:
                return json.loads(content[start:end + 1])
            except json.JSONDecodeError as e:
                logging.error('Groq response was not valid JSON after extraction: %s', e)
                return None
        except Exception as e:
            logging.error('Groq API call failed: %s', e)
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

    @staticmethod
    def _norm(s):
        """Lowercase, strip whitespace, and remove diacritics for accent-insensitive matching."""
        s = s.lower().strip()
        return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')

    def get_custom_prices_for_ingredient(self, user_id, ingredient_name):
        name_n = self._norm(ingredient_name)
        all_user = [cp for cp in self._custom_prices.get_all() if cp.user_id == user_id]

        # 1. Exact match (accent-insensitive)
        exact = [cp for cp in all_user if self._norm(cp.ingredient_name) == name_n]
        if exact:
            return exact

        # 2. Word-prefix match (accent-insensitive): "azucar" matches "azúcar en polvo"
        #    Uses ' ' padding so "sal" does NOT match "salsa"
        prefix = [cp for cp in all_user
                  if (name_n + ' ').startswith(self._norm(cp.ingredient_name) + ' ')
                  or (self._norm(cp.ingredient_name) + ' ').startswith(name_n + ' ')]
        if prefix:
            return prefix

        # 3. Singular/plural: "huevo" matches "huevos"
        norm = self._strip_plural(name_n)
        plural = [cp for cp in all_user if self._strip_plural(self._norm(cp.ingredient_name)) == norm]
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
        name_n = self._norm(ingredient_name)
        matches = [cp for cp in self._custom_prices.get_all()
                   if cp.user_id == user_id and self._norm(cp.ingredient_name) == name_n
                   and cp.store_id == store_id]
        return min(matches, key=lambda c: c.price_per_kg) if matches else None

    def get_custom_price_by_store_and_brand(self, user_id, ingredient_name, store_id, brand_id):
        name_n = self._norm(ingredient_name)
        for cp in self._custom_prices.get_all():
            if (cp.user_id == user_id and self._norm(cp.ingredient_name) == name_n
                    and cp.store_id == store_id and cp.brand_id == brand_id):
                return cp
        return None

    def get_custom_price_by_id(self, price_id):
        return self._custom_prices.get_by_id(price_id)

    def create_custom_price(self, user_id, ingredient_name, price_per_kg,
                             store_id=None, brand_id=None, bought_qty=None, bought_unit=None, bought_price=None):
        cp = CustomPrice(
            user_id=user_id,
            ingredient_name=self._norm(ingredient_name),
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
                'name_en': ing.name_en or '',
                'name_es': ing.name_es or '',
                'name_fr': ing.name_fr or '',
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
            # Try primary name + all stored translations so that e.g. "farine de blé tendre"
            # automatically matches a CustomPrice saved as "harina" (via name_es).
            candidates = {name_lower}
            for attr in ('name_en', 'name_es', 'name_fr'):
                val = (getattr(ing, attr, None) or '').lower().strip()
                if val:
                    candidates.add(val)

            seen_ids = set()
            customs = []
            for candidate in candidates:
                for cp in self.get_custom_prices_for_ingredient(user_id, candidate):
                    if cp.id not in seen_ids:
                        seen_ids.add(cp.id)
                        customs.append(cp)

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

    # ── Cook log ──────────────────────────────────────────────────────────────

    def log_cook(self, recipe_id, user_id):
        entry = CookLog(
            id=str(uuid.uuid4()),
            recipe_id=recipe_id,
            user_id=user_id,
            cooked_at=datetime.utcnow(),
        )
        db.session.add(entry)
        db.session.commit()
        return entry

    def _week_start(self):
        today = datetime.utcnow()
        start = today - timedelta(days=today.weekday())
        return start.replace(hour=0, minute=0, second=0, microsecond=0)

    def get_week_cook_count(self, user_id):
        return (
            db.session.query(CookLog)
            .filter(CookLog.user_id == user_id, CookLog.cooked_at >= self._week_start())
            .count()
        )

    def get_week_cooked_recipe_ids(self, user_id):
        rows = (
            db.session.query(CookLog.recipe_id)
            .filter(CookLog.user_id == user_id, CookLog.cooked_at >= self._week_start())
            .all()
        )
        return list({row.recipe_id for row in rows})


facade = RecipeScannerFacade()
