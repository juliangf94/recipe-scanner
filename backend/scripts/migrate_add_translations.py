"""
Migration: add translation columns (EN/ES/FR) to recipes, ingredients, steps.
Run once: python scripts/migrate_add_translations.py
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'instance', 'development.db')

MIGRATIONS = [
    # recipes
    "ALTER TABLE recipes ADD COLUMN title_en VARCHAR(200) DEFAULT ''",
    "ALTER TABLE recipes ADD COLUMN title_es VARCHAR(200) DEFAULT ''",
    "ALTER TABLE recipes ADD COLUMN title_fr VARCHAR(200) DEFAULT ''",
    "ALTER TABLE recipes ADD COLUMN description_en TEXT DEFAULT ''",
    "ALTER TABLE recipes ADD COLUMN description_es TEXT DEFAULT ''",
    "ALTER TABLE recipes ADD COLUMN description_fr TEXT DEFAULT ''",
    # ingredients
    "ALTER TABLE ingredients ADD COLUMN name_en VARCHAR(100) DEFAULT ''",
    "ALTER TABLE ingredients ADD COLUMN name_es VARCHAR(100) DEFAULT ''",
    "ALTER TABLE ingredients ADD COLUMN name_fr VARCHAR(100) DEFAULT ''",
    # steps
    "ALTER TABLE steps ADD COLUMN description_en TEXT DEFAULT ''",
    "ALTER TABLE steps ADD COLUMN description_es TEXT DEFAULT ''",
    "ALTER TABLE steps ADD COLUMN description_fr TEXT DEFAULT ''",
    # translation tracking
    "ALTER TABLE recipes ADD COLUMN translation_provider VARCHAR(20) DEFAULT 'none'",
    "ALTER TABLE recipes ADD COLUMN translation_status VARCHAR(20) DEFAULT 'none'",
]

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

for sql in MIGRATIONS:
    col = sql.split('ADD COLUMN ')[1].split(' ')[0]
    try:
        cursor.execute(sql)
        print(f'  + {col}')
    except sqlite3.OperationalError as e:
        if 'duplicate column name' in str(e):
            print(f'  = {col} already exists, skipping')
        else:
            raise

conn.commit()
conn.close()
print('Migration complete.')
