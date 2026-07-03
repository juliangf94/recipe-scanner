import os
from flask import Flask
from flask_restx import Api
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from config import config
from app.extensions import db




def create_app(config_name=None):
    """
    Application factory — builds and returns the configured Flask app.
    Reads FLASK_ENV to select development / testing / production config.
    Called by run.py for local dev, by gunicorn in production, and by
    pytest fixtures for testing — each gets its own isolated app instance.
    """
    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'default')

    app = Flask(__name__)
    app.config.from_object(config[config_name])

    JWTManager(app)
    CORS(app, resources={r"/api/*": {"origins": "*"}, r"/static/*": {"origins": "*"}})
    db.init_app(app)

    # Define the security scheme for Swagger UI
    authorizations = {
        'Bearer Auth': {
            'type': 'apiKey',
            'in': 'header',
            'name': 'Authorization',
            'description': "Type in the *'Value'* input box below: **'Bearer &lt;JWT&gt;'**, where JWT is the token"
        }
    }
    
    api = Api(
        app,
        doc='/api/docs',
        title='RecipeScanner API',
        version='1.0',
        description='API for scanning and managing recipes',
        security='Bearer Auth',
        authorizations=authorizations
    )
    # Initialize extensions here (Phase 8 — SQLAlchemy)

    # Namespaces are imported inside the factory to avoid circular imports:
    # each namespace module imports the facade, which imports models,
    # which need db — and db is only bound to the app after init_app() above.
    from app.api.v1.auth import api as auth_ns
    from app.api.v1.recipes import api as recipes_ns
    from app.api.v1.ingredients import api as ingredients_ns
    from app.api.v1.scan import api as scan_ns
    from app.api.v1.costs import api as costs_ns
    from app.api.v1.stores import api as stores_ns
    from app.api.v1.brands import api as brands_ns

    api.add_namespace(auth_ns, path='/api/v1/auth')
    api.add_namespace(recipes_ns, path='/api/v1/recipes')
    api.add_namespace(ingredients_ns, path='/api/v1')
    api.add_namespace(scan_ns, path='/api/v1/scan')
    api.add_namespace(costs_ns, path='/api/v1')
    api.add_namespace(stores_ns, path='/api/v1/stores')
    api.add_namespace(brands_ns, path='/api/v1/brands')

    # Health check — no auth required. Used by the frontend to warm up
    # the Render free-tier backend before the first real request.
    @app.route('/api/v1/health')
    def health():
        return {'status': 'ok'}, 200

    with app.app_context():
        from app.models.brand import Brand  # ensure table is registered before create_all
        db.create_all()
        # Add nullable columns to existing tables (safe ALTER TABLE — no-op if column already exists)
        from sqlalchemy import text
        for stmt in [
            'ALTER TABLE recipes ADD COLUMN image_url VARCHAR(500)',
            'ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500)',
            'ALTER TABLE ingredients ADD COLUMN manual_price REAL',
            'ALTER TABLE ingredients ADD COLUMN price_source VARCHAR(20)',
            'ALTER TABLE ingredients ADD COLUMN preferred_store_id VARCHAR(36)',
            'ALTER TABLE custom_prices ADD COLUMN store_id VARCHAR(36)',
            'ALTER TABLE custom_prices ADD COLUMN bought_qty REAL',
            'ALTER TABLE custom_prices ADD COLUMN bought_unit VARCHAR(30)',
            'ALTER TABLE custom_prices ADD COLUMN bought_price REAL',
            'ALTER TABLE ingredients ADD COLUMN section VARCHAR(100)',
            'ALTER TABLE custom_prices ADD COLUMN brand VARCHAR(100)',
            'ALTER TABLE custom_prices ADD COLUMN brand_id VARCHAR(36)',
            'ALTER TABLE ingredients ADD COLUMN preferred_brand_id VARCHAR(36)',
            'ALTER TABLE ingredients ADD COLUMN order_num INTEGER DEFAULT 0',
            "ALTER TABLE recipes ADD COLUMN images_json TEXT DEFAULT '[]'",
            'ALTER TABLE brands ADD COLUMN ingredient_name VARCHAR(100)',
        ]:
            try:
                db.session.execute(text(stmt))
                db.session.commit()
            except Exception:
                db.session.rollback()

        # Ensure upload directories exist
        for folder in ['recipes', 'avatars']:
            os.makedirs(os.path.join(app.static_folder, 'uploads', folder), exist_ok=True)

    return app
