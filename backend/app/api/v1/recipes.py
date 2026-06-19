import os
from flask import request, current_app
from flask_restx import Namespace, Resource, fields
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.facade import facade

ALLOWED_IMAGE_EXTS = {'jpg', 'jpeg', 'png', 'webp'}

api = Namespace('recipes', description='Recipe management')

recipe_model = api.model('Recipe', {
    'title': fields.String(required=True, description='Recipe title'),
    'description': fields.String(description='Recipe description'),
    'servings': fields.Integer(description='Number of servings'),
    'prep_time_min': fields.Integer(description='Preparation time in minutes'),
    'category': fields.String(description='Recipe category')
})

recipe_update_model = api.model('RecipeUpdate', {
    'title': fields.String(description='Recipe title'),
    'description': fields.String(description='Recipe description'),
    'servings': fields.Integer(description='Number of servings'),
    'prep_time_min': fields.Integer(description='Preparation time in minutes'),
    'category': fields.String(description='Recipe category')
})


@api.route('/')
class RecipeList(Resource):

    @jwt_required()
    @api.response(200, 'List of user recipes')
    def get(self):
        user_id = get_jwt_identity()
        recipes = facade.get_recipes_by_user(user_id)
        return [{'id': r.id, 'title': r.title, 'description': r.description,
                 'servings': r.servings, 'prep_time_min': r.prep_time_min,
                 'category': r.category, 'user_id': r.user_id,
                 'image_url': r.image_url}
                for r in recipes], 200

    @jwt_required()
    @api.expect(recipe_model, validate=True)
    @api.response(201, 'Recipe created')
    def post(self):
        user_id = get_jwt_identity()
        data = api.payload
        recipe = facade.create_recipe(
            user_id=user_id,
            title=data['title'],
            description=data.get('description', ''),
            servings=data.get('servings', 0),
            prep_time_min=data.get('prep_time_min', 0),
            category=data.get('category', '')
        )
        return {'id': recipe.id, 'title': recipe.title,
                'user_id': recipe.user_id}, 201


@api.route('/<string:recipe_id>')
class RecipeDetail(Resource):

    @jwt_required()
    @api.response(200, 'Recipe found')
    @api.response(403, 'Forbidden')
    @api.response(404, 'Recipe not found')
    def get(self, recipe_id):
        user_id = get_jwt_identity()
        recipe = facade.get_recipe(recipe_id)
        if not recipe:
            return {'error': 'Recipe not found'}, 404
        if recipe.user_id != user_id:
            return {'error': 'Forbidden'}, 403
        return {'id': recipe.id, 'title': recipe.title,
                'description': recipe.description, 'servings': recipe.servings,
                'prep_time_min': recipe.prep_time_min, 'category': recipe.category,
                'user_id': recipe.user_id, 'image_url': recipe.image_url}, 200

    @jwt_required()
    @api.expect(recipe_update_model)
    @api.response(200, 'Recipe updated')
    @api.response(403, 'Forbidden')
    @api.response(404, 'Recipe not found')
    def put(self, recipe_id):
        user_id = get_jwt_identity()
        recipe = facade.get_recipe(recipe_id)
        if not recipe:
            return {'error': 'Recipe not found'}, 404
        if recipe.user_id != user_id:
            return {'error': 'Forbidden'}, 403
        updated = facade.update_recipe(recipe_id, **api.payload)
        return {'id': updated.id, 'title': updated.title,
                'description': updated.description, 'servings': updated.servings,
                'prep_time_min': updated.prep_time_min,
                'category': updated.category}, 200

    @jwt_required()
    @api.response(204, 'Recipe deleted')
    @api.response(403, 'Forbidden')
    @api.response(404, 'Recipe not found')
    def delete(self, recipe_id):
        user_id = get_jwt_identity()
        recipe = facade.get_recipe(recipe_id)
        if not recipe:
            return {'error': 'Recipe not found'}, 404
        if recipe.user_id != user_id:
            return {'error': 'Forbidden'}, 403
        facade.delete_recipe(recipe_id)
        return '', 204


@api.route('/<string:recipe_id>/steps')
class RecipeSteps(Resource):

    @jwt_required()
    @api.response(200, 'Steps list')
    @api.response(404, 'Recipe not found')
    def get(self, recipe_id):
        recipe = facade.get_recipe(recipe_id)
        if not recipe:
            return {'error': 'Recipe not found'}, 404
        steps = facade.get_steps_by_recipe(recipe_id)
        steps_sorted = sorted(steps, key=lambda s: s.order_num)
        return [{'id': s.id, 'order_num': s.order_num,
                 'description': s.description} for s in steps_sorted], 200


@api.route('/<string:recipe_id>/image')
class RecipeImage(Resource):

    @jwt_required()
    @api.response(200, 'Image uploaded')
    @api.response(400, 'Invalid file')
    @api.response(403, 'Forbidden')
    @api.response(404, 'Recipe not found')
    def post(self, recipe_id):
        user_id = get_jwt_identity()
        recipe = facade.get_recipe(recipe_id)
        if not recipe:
            return {'error': 'Recipe not found'}, 404
        if recipe.user_id != user_id:
            return {'error': 'Forbidden'}, 403
        if 'file' not in request.files:
            return {'error': 'No file provided'}, 400

        file = request.files['file']
        if not file.filename:
            return {'error': 'No file selected'}, 400

        ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
        if ext not in ALLOWED_IMAGE_EXTS:
            return {'error': 'Only JPG, PNG or WebP files are accepted'}, 400

        uploads_dir = os.path.join(current_app.static_folder, 'uploads', 'recipes')
        # Remove previous image for this recipe (any extension)
        for old_ext in ALLOWED_IMAGE_EXTS:
            old_path = os.path.join(uploads_dir, f'{recipe_id}.{old_ext}')
            if os.path.exists(old_path):
                os.remove(old_path)

        filename = f'{recipe_id}.{ext}'
        file.save(os.path.join(uploads_dir, filename))

        image_url = f'/static/uploads/recipes/{filename}'
        facade.update_recipe(recipe_id, image_url=image_url)
        return {'image_url': image_url}, 200
