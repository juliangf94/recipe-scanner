import json
import os
import uuid as _uuid
from flask import request, current_app
from flask_restx import Namespace, Resource, fields
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.facade import facade
from app import storage as _storage

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
    'title': fields.String(description='Recipe title (original)'),
    'description': fields.String(description='Recipe description (original)'),
    'title_en': fields.String(description='Title in English'),
    'title_es': fields.String(description='Title in Spanish'),
    'title_fr': fields.String(description='Title in French'),
    'description_en': fields.String(description='Description in English'),
    'description_es': fields.String(description='Description in Spanish'),
    'description_fr': fields.String(description='Description in French'),
    'servings': fields.Integer(description='Number of servings'),
    'prep_time_min': fields.Integer(description='Preparation time in minutes'),
    'category': fields.String(description='Recipe category'),
    'image_url': fields.String(description='Cover photo URL'),
})


@api.route('/')
class RecipeList(Resource):

    @jwt_required()
    @api.response(200, 'List of user recipes')
    def get(self):
        user_id = get_jwt_identity()
        recipes = facade.get_recipes_by_user(user_id)
        return [{'id': r.id,
                 'title': r.title,
                 'title_en': r.title_en or '', 'title_es': r.title_es or '', 'title_fr': r.title_fr or '',
                 'description': r.description,
                 'description_en': r.description_en or '', 'description_es': r.description_es or '', 'description_fr': r.description_fr or '',
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
        images = json.loads(recipe.images_json or '[]')
        if recipe.image_url and recipe.image_url not in images:
            images = [recipe.image_url] + images
        return {'id': recipe.id,
                'title': recipe.title,
                'title_en': recipe.title_en or '', 'title_es': recipe.title_es or '', 'title_fr': recipe.title_fr or '',
                'description': recipe.description,
                'description_en': recipe.description_en or '', 'description_es': recipe.description_es or '', 'description_fr': recipe.description_fr or '',
                'servings': recipe.servings,
                'prep_time_min': recipe.prep_time_min, 'category': recipe.category,
                'user_id': recipe.user_id, 'image_url': recipe.image_url,
                'images': images,
                'translation_status': recipe.translation_status or 'pending'}, 200

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


@api.route('/<string:recipe_id>/full')
class RecipeFull(Resource):

    @jwt_required()
    @api.response(200, 'Recipe with ingredients and steps')
    @api.response(403, 'Forbidden')
    @api.response(404, 'Recipe not found')
    def get(self, recipe_id):
        user_id = get_jwt_identity()
        recipe = facade.get_recipe(recipe_id)
        if not recipe:
            return {'error': 'Recipe not found'}, 404
        if recipe.user_id != user_id:
            return {'error': 'Forbidden'}, 403
        images = json.loads(recipe.images_json or '[]')
        if recipe.image_url and recipe.image_url not in images:
            images = [recipe.image_url] + images
        ingredients = facade.get_ingredients_by_recipe(recipe_id)
        steps = facade.get_steps_by_recipe(recipe_id)
        return {
            'recipe': {
                'id': recipe.id,
                'title': recipe.title,
                'title_en': recipe.title_en or '', 'title_es': recipe.title_es or '', 'title_fr': recipe.title_fr or '',
                'description': recipe.description,
                'description_en': recipe.description_en or '', 'description_es': recipe.description_es or '', 'description_fr': recipe.description_fr or '',
                'servings': recipe.servings, 'prep_time_min': recipe.prep_time_min,
                'category': recipe.category, 'user_id': recipe.user_id,
                'image_url': recipe.image_url, 'images': images,
                'translation_status': recipe.translation_status or 'pending',
                'section_meta': json.loads(recipe.section_meta or '{}')
            },
            'ingredients': [
                {'id': i.id, 'name': i.name,
                 'name_en': i.name_en or '', 'name_es': i.name_es or '', 'name_fr': i.name_fr or '',
                 'quantity': i.quantity, 'unit': i.unit,
                 'order_num': i.order_num, 'section': i.section or '',
                 'recipe_id': i.recipe_id}
                for i in ingredients
            ],
            'steps': [
                {'id': s.id, 'order_num': s.order_num,
                 'description': s.description,
                 'description_en': s.description_en or '', 'description_es': s.description_es or '', 'description_fr': s.description_fr or '',
                 'recipe_id': s.recipe_id}
                for s in steps
            ]
        }, 200


@api.route('/<string:recipe_id>/translate')
class RecipeTranslate(Resource):

    @jwt_required()
    @api.response(200, 'Recipe translated')
    @api.response(403, 'Forbidden')
    @api.response(404, 'Recipe not found')
    def post(self, recipe_id):
        user_id = get_jwt_identity()
        recipe = facade.get_recipe(recipe_id)
        if not recipe:
            return {'error': 'Recipe not found'}, 404
        if recipe.user_id != user_id:
            return {'error': 'Forbidden'}, 403
        ingredients = facade.get_ingredients_by_recipe(recipe_id)
        steps = facade.get_steps_by_recipe(recipe_id)
        try:
            facade._translate_recipe(recipe, ingredients, steps)
        except Exception:
            return {'error': 'Translation failed'}, 500
        return {'translation_status': recipe.translation_status or 'done'}, 200


@api.route('/<string:recipe_id>/cook')
class RecipeCook(Resource):

    @jwt_required()
    @api.response(201, 'Cook logged')
    @api.response(403, 'Forbidden')
    @api.response(404, 'Recipe not found')
    def post(self, recipe_id):
        user_id = get_jwt_identity()
        recipe = facade.get_recipe(recipe_id)
        if not recipe:
            return {'error': 'Recipe not found'}, 404
        if recipe.user_id != user_id:
            return {'error': 'Forbidden'}, 403
        entry = facade.log_cook(recipe_id, user_id)
        return {'id': entry.id, 'cooked_at': entry.cooked_at.isoformat()}, 201


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
                 'description': s.description,
                 'description_en': s.description_en or '',
                 'description_es': s.description_es or '',
                 'description_fr': s.description_fr or ''} for s in steps_sorted], 200

    @jwt_required()
    @api.response(201, 'Step created')
    @api.response(403, 'Forbidden')
    @api.response(404, 'Recipe not found')
    def post(self, recipe_id):
        user_id = get_jwt_identity()
        recipe = facade.get_recipe(recipe_id)
        if not recipe:
            return {'error': 'Recipe not found'}, 404
        if recipe.user_id != user_id:
            return {'error': 'Forbidden'}, 403
        data = request.get_json() or {}
        description = (data.get('description') or '').strip()
        if not description:
            return {'error': 'Description required'}, 400
        existing = facade.get_steps_by_recipe(recipe_id)
        auto_num = max((s.order_num for s in existing), default=0) + 1
        order_num = int(data['order_num']) if data.get('order_num') else auto_num
        step = facade.add_step(recipe_id=recipe_id, order_num=order_num, description=description)
        facade._translate_step(step)
        return {'id': step.id, 'order_num': step.order_num,
                'description': step.description,
                'description_en': step.description_en or '',
                'description_es': step.description_es or '',
                'description_fr': step.description_fr or ''}, 201


@api.route('/<string:recipe_id>/steps/<string:step_id>')
class RecipeStep(Resource):

    @jwt_required()
    @api.response(200, 'Step updated')
    @api.response(403, 'Forbidden')
    @api.response(404, 'Step not found')
    def put(self, recipe_id, step_id):
        user_id = get_jwt_identity()
        recipe = facade.get_recipe(recipe_id)
        if not recipe:
            return {'error': 'Recipe not found'}, 404
        if recipe.user_id != user_id:
            return {'error': 'Forbidden'}, 403
        data = request.get_json() or {}
        updated = facade.update_step(step_id, **data)
        if not updated:
            return {'error': 'Step not found'}, 404
        return {'id': updated.id, 'order_num': updated.order_num,
                'description': updated.description,
                'description_en': updated.description_en or '',
                'description_es': updated.description_es or '',
                'description_fr': updated.description_fr or ''}, 200

    @jwt_required()
    @api.response(204, 'Step deleted')
    @api.response(403, 'Forbidden')
    @api.response(404, 'Step not found')
    def delete(self, recipe_id, step_id):
        user_id = get_jwt_identity()
        recipe = facade.get_recipe(recipe_id)
        if not recipe:
            return {'error': 'Recipe not found'}, 404
        if recipe.user_id != user_id:
            return {'error': 'Forbidden'}, 403
        facade.delete_step(step_id)
        return '', 204


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

        file_bytes = file.read()
        content_type = 'image/jpeg' if ext == 'jpg' else f'image/{ext}'
        filename = f'{recipe_id}_{_uuid.uuid4().hex[:8]}.{ext}'

        image_url = _storage.upload_file(file_bytes, filename, content_type)
        if not image_url:
            uploads_dir = os.path.join(current_app.static_folder, 'uploads', 'recipes')
            os.makedirs(uploads_dir, exist_ok=True)
            with open(os.path.join(uploads_dir, filename), 'wb') as fp:
                fp.write(file_bytes)
            image_url = f'/static/uploads/recipes/{filename}'

        images = json.loads(recipe.images_json or '[]')
        images.append(image_url)
        cover = recipe.image_url or image_url
        facade.update_recipe(recipe_id, image_url=cover, images_json=json.dumps(images))
        return {'image_url': cover, 'images': images}, 200

    @jwt_required()
    @api.response(200, 'Image deleted')
    @api.response(403, 'Forbidden')
    @api.response(404, 'Recipe not found')
    def delete(self, recipe_id):
        user_id = get_jwt_identity()
        recipe = facade.get_recipe(recipe_id)
        if not recipe:
            return {'error': 'Recipe not found'}, 404
        if recipe.user_id != user_id:
            return {'error': 'Forbidden'}, 403

        data = request.get_json() or {}
        image_url = data.get('image_url', '')
        if not image_url:
            return {'error': 'image_url required'}, 400

        images = json.loads(recipe.images_json or '[]')
        images = [u for u in images if u != image_url]

        # Delete from Supabase Storage (no-op if not configured or not a Supabase URL)
        _storage.delete_file(_storage.path_from_url(image_url))
        # Also clean up old local file if it was stored on disk
        if image_url.startswith('/static/uploads/recipes/'):
            local_name = image_url.replace('/static/uploads/recipes/', '')
            local_path = os.path.join(current_app.static_folder, 'uploads', 'recipes', local_name)
            if os.path.exists(local_path):
                os.remove(local_path)

        new_cover = images[0] if images else None
        cover = recipe.image_url if recipe.image_url != image_url else new_cover
        facade.update_recipe(recipe_id, image_url=cover, images_json=json.dumps(images))
        return {'image_url': cover, 'images': images}, 200


section_color_model = api.model('SectionColor', {
    'color': fields.String(required=True, description='Hex color e.g. #f39c12')
})


@api.route('/<string:recipe_id>/sections/<string:section_name>/color')
class RecipeSectionColor(Resource):

    @jwt_required()
    @api.expect(section_color_model, validate=True)
    @api.response(200, 'Section color updated')
    @api.response(403, 'Forbidden')
    @api.response(404, 'Recipe not found')
    def patch(self, recipe_id, section_name):
        user_id = get_jwt_identity()
        recipe = facade.get_recipe(recipe_id)
        if not recipe:
            return {'error': 'Recipe not found'}, 404
        if recipe.user_id != user_id:
            return {'error': 'Forbidden'}, 403
        color = (api.payload.get('color') or '').strip()
        if not color:
            return {'error': 'color required'}, 400
        facade.set_section_color(recipe_id, section_name, color)
        return {'section': section_name, 'color': color}, 200
