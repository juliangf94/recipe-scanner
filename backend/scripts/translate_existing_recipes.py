"""
Translate existing recipes that have no translations yet.
Run once: python scripts/translate_existing_recipes.py

Finds all recipes where translation_status = 'none' or 'pending',
calls DeepL (with LibreTranslate fallback), and updates the DB.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app import create_app
from app.extensions import db
from app.models.recipe import Recipe
from app.models.ingredient import Ingredient
from app.models.step import Step
from app.services.facade import facade

app = create_app()

with app.app_context():
    recipes = Recipe.query.filter(
        Recipe.translation_status.in_(['none', 'pending'])
    ).all()

    if not recipes:
        print('No recipes need translation.')
        sys.exit(0)

    print(f'Found {len(recipes)} recipe(s) to translate...\n')

    for recipe in recipes:
        ingredients = Ingredient.query.filter_by(recipe_id=recipe.id).all()
        steps = (Step.query
                 .filter_by(recipe_id=recipe.id)
                 .order_by(Step.order_num)
                 .all())

        try:
            facade._translate_recipe(recipe, ingredients, steps)
            print(f'  [{recipe.translation_status}] {recipe.title} — provider: {recipe.translation_provider}')
        except Exception as e:
            print(f'  [ERROR] {recipe.title}: {e}')

    print('\nDone.')
