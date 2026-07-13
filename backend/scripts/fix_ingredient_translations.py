"""
Fix ingredients already stored with wrong translations (e.g. honey → cariño).

Scans every ingredient whose name (case-insensitive) exists in
INGREDIENT_TRANSLATIONS and re-applies the correct EN/ES/FR values.
The original name column is never touched.

Usage:
    cd backend
    python scripts/fix_ingredient_translations.py          # dry run (shows what would change)
    python scripts/fix_ingredient_translations.py --apply  # writes to DB
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app import create_app
from app.extensions import db
from app.models.ingredient import Ingredient
from app.services.facade import INGREDIENT_TRANSLATIONS

DRY_RUN = '--apply' not in sys.argv

app = create_app()

with app.app_context():
    ingredients = Ingredient.query.all()
    fixed = 0

    for ing in ingredients:
        key = (ing.name or '').strip().lower()
        entry = INGREDIENT_TRANSLATIONS.get(key)
        if not entry:
            continue

        changed = []
        for col in ('en', 'es', 'fr'):
            current = getattr(ing, f'name_{col}', None)
            correct = entry[col]
            if current != correct:
                changed.append(f'  name_{col}: "{current}" → "{correct}"')
                if not DRY_RUN:
                    setattr(ing, f'name_{col}', correct)

        if changed:
            print(f'[{"DRY" if DRY_RUN else "FIX"}] "{ing.name}" (id={ing.id})')
            for line in changed:
                print(line)
            fixed += 1

    if not DRY_RUN and fixed:
        db.session.commit()

    mode = 'Would fix' if DRY_RUN else 'Fixed'
    print(f'\n{mode} {fixed} ingredient(s).')
    if DRY_RUN and fixed:
        print('Run with --apply to persist changes.')
