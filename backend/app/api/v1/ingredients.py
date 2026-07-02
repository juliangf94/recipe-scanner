from flask import request
from flask_restx import Namespace, Resource, fields
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.facade import facade

api = Namespace('ingredients', description='Ingredient management')

ingredient_model = api.model('Ingredient', {
    'name': fields.String(required=True, description='Ingredient name'),
    'quantity': fields.String(required=True, description='Amount (e.g. "200", "1/2")'),
    'unit': fields.String(required=True, description='Unit of measure (e.g. "g", "ml", "cup")'),
    'section': fields.String(description='Recipe section (e.g. "Masa", "Relleno")')
})

ingredient_update_model = api.model('IngredientUpdate', {
    'name': fields.String(description='Ingredient name'),
    'quantity': fields.String(description='Amount'),
    'unit': fields.String(description='Unit of measure'),
    'preferred_store_id': fields.String(description='Preferred store ID for price lookup'),
    'preferred_brand_id': fields.String(description='Preferred brand ID for price lookup'),
    'section': fields.String(description='Recipe section name')
})


@api.route('/recipes/<string:recipe_id>/ingredients')
class IngredientList(Resource):
    # GET
    @jwt_required()
    @api.response(200, 'List of ingredients for the recipe')
    @api.response(404, 'Recipe not found')
    def get(self, recipe_id):
        if not facade.get_recipe(recipe_id):
            return {'error': 'Recipe not found'}, 404
        ingredients = facade.get_ingredients_by_recipe(recipe_id)
        return [{'id': i.id, 'name': i.name,
                 'name_en': i.name_en or '', 'name_es': i.name_es or '', 'name_fr': i.name_fr or '',
                 'quantity': i.quantity, 'unit': i.unit, 'recipe_id': i.recipe_id,
                 'preferred_store_id': i.preferred_store_id,
                 'preferred_brand_id': i.preferred_brand_id,
                 'section': i.section or ''} for i in ingredients], 200
    # POST
    @jwt_required()
    @api.expect(ingredient_model, validate=True)
    @api.response(201, 'Ingredient added')
    @api.response(403, 'Forbidden')
    @api.response(404, 'Recipe not found')
    def post(self, recipe_id):
        user_id = get_jwt_identity()
        recipe = facade.get_recipe(recipe_id)
        if not recipe:
            return {'error': 'Recipe not found'}, 404
        if recipe.user_id != user_id:
            return {'error': 'Forbidden'}, 403
        data = api.payload
        ingredient = facade.add_ingredient(
            recipe_id=recipe_id,
            name=data['name'],
            quantity=data['quantity'],
            unit=data['unit']
        )
        return {'id': ingredient.id, 'name': ingredient.name,
                'quantity': ingredient.quantity, 'unit': ingredient.unit,
                'recipe_id': ingredient.recipe_id,
                'preferred_store_id': ingredient.preferred_store_id,
                'preferred_brand_id': ingredient.preferred_brand_id,
                'section': ingredient.section or ''}, 201


@api.route('/recipes/<string:recipe_id>/ingredients/<string:ingredient_id>')
class IngredientDetail(Resource):
    # GET ID
    @jwt_required()
    @api.response(200, 'Ingredient found')
    @api.response(404, 'Ingredient not found')
    def get(self, recipe_id, ingredient_id):
        ingredient = facade.get_ingredient(ingredient_id)
        if not ingredient or ingredient.recipe_id != recipe_id:
            return {'error': 'Ingredient not found'}, 404
        return {'id': ingredient.id, 'name': ingredient.name,
                'quantity': ingredient.quantity, 'unit': ingredient.unit,
                'recipe_id': ingredient.recipe_id,
                'preferred_store_id': ingredient.preferred_store_id,
                'preferred_brand_id': ingredient.preferred_brand_id,
                'section': ingredient.section or ''}, 200
    # PUT
    @jwt_required()
    @api.expect(ingredient_update_model)
    @api.response(200, 'Ingredient updated')
    @api.response(403, 'Forbidden')
    @api.response(404, 'Ingredient not found')
    def put(self, recipe_id, ingredient_id):
        user_id = get_jwt_identity()
        ingredient = facade.get_ingredient(ingredient_id)
        if not ingredient or ingredient.recipe_id != recipe_id:
            return {'error': 'Ingredient not found'}, 404
        recipe = facade.get_recipe(recipe_id)
        if recipe.user_id != user_id:
            return {'error': 'Forbidden'}, 403
        updated = facade.update_ingredient(ingredient_id, **api.payload)
        return {'id': updated.id, 'name': updated.name,
                'name_en': updated.name_en or '', 'name_es': updated.name_es or '', 'name_fr': updated.name_fr or '',
                'quantity': updated.quantity, 'unit': updated.unit,
                'preferred_store_id': updated.preferred_store_id,
                'preferred_brand_id': updated.preferred_brand_id,
                'section': updated.section or ''}, 200
    # DELETE
    @jwt_required()
    @api.response(204, 'Ingredient deleted')
    @api.response(403, 'Forbidden')
    @api.response(404, 'Ingredient not found')
    def delete(self, recipe_id, ingredient_id):
        user_id = get_jwt_identity()
        ingredient = facade.get_ingredient(ingredient_id)
        if not ingredient or ingredient.recipe_id != recipe_id:
            return {'error': 'Ingredient not found'}, 404
        recipe = facade.get_recipe(recipe_id)
        if recipe.user_id != user_id:
            return {'error': 'Forbidden'}, 403
        facade.delete_ingredient(ingredient_id)
        return '', 204


@api.route('/recipes/<string:recipe_id>/ingredients/reorder')
class IngredientReorder(Resource):

    @jwt_required()
    @api.response(200, 'Order updated')
    @api.response(403, 'Forbidden')
    @api.response(404, 'Recipe not found')
    def post(self, recipe_id):
        user_id = get_jwt_identity()
        recipe = facade.get_recipe(recipe_id)
        if not recipe:
            return {'error': 'Recipe not found'}, 404
        if recipe.user_id != user_id:
            return {'error': 'Forbidden'}, 403
        updates = (request.get_json() or {}).get('updates', [])
        for upd in updates:
            facade.update_ingredient(upd['id'], section=upd.get('section', ''), order_num=upd.get('order_num', 0))
        return {}, 200

