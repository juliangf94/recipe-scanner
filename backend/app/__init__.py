import os
from flask import Flask
from flask_restx import Api
from flask_jwt_extended import JWTManager
from config import config




def create_app(config_name=None):
    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'default')

    app = Flask(__name__)
    app.config.from_object(config[config_name])

    JWTManager(app)

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

    # Register namespaces here (Phases 4-6 — auth, recipes, scan)
    from app.api.v1.auth import api as auth_ns
    from app.api.v1.recipes import api as recipes_ns
    from app.api.v1.ingredients import api as ingredients_ns
    from app.api.v1.scan import api as scan_ns
    from app.api.v1.costs import api as costs_ns

    api.add_namespace(auth_ns, path='/api/v1/auth')
    api.add_namespace(recipes_ns, path='/api/v1/recipes')
    api.add_namespace(ingredients_ns, path='/api/v1')
    api.add_namespace(scan_ns, path='/api/v1/scan')
    api.add_namespace(costs_ns, path='/api/v1')

    return app
