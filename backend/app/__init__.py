import os
from flask import Flask
from config import config


def create_app(config_name=None):
    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'default')

    app = Flask(__name__)
    app.config.from_object(config[config_name])

    # Initialize extensions here (Phase 8 — SQLAlchemy)

    # Register blueprints here (Phases 4-6 — auth, recipes, scan)

    return app
