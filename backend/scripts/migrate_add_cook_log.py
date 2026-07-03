"""
Migration: create cook_log table.
Run once: python scripts/migrate_add_cook_log.py
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'instance', 'development.db')

CREATE = """
CREATE TABLE IF NOT EXISTS cook_log (
    id          VARCHAR(36)  PRIMARY KEY,
    recipe_id   VARCHAR(36)  NOT NULL REFERENCES recipes(id),
    user_id     VARCHAR(36)  NOT NULL REFERENCES users(id),
    cooked_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
)
"""

conn = sqlite3.connect(DB_PATH)
try:
    conn.execute(CREATE)
    conn.commit()
    print('cook_log table created (or already existed).')
finally:
    conn.close()
