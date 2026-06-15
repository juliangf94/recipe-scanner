from flask_restx import Namespace, Resource, fields
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.facade import facade

api = Namespace('ingredients', description='Ingredient management')

ingredient_model = api.model('Ingredient', {
    'name': fields.String(required=True, description='Ingredient name'),
    'quantity': fields.String(required=True, description='Amount (e.g. "200", "1/2")'),
    'unit': fields.String(required=True, description='Unit of measure (e.g. "g", "ml", "cup")')
})

ingredient_update_model = api.model('IngredientUpdate', {
    'name': fields.String(description='Ingredient name'),
    'quantity': fields.String(description='Amount'),
    'unit': fields.String(description='Unit of measure')
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
        return [{'id': i.id, 'name': i.name, 'quantity': i.quantity,
                 'unit': i.unit, 'recipe_id': i.recipe_id} for i in ingredients], 200
    # POST
    @jwt_required()
    @api.expect(ingredient_model, validate=True)
    @api.response(201, 'Ingredient added')
    @api.response(404, 'Recipe not found')
    def post(self, recipe_id):
        if not facade.get_recipe(recipe_id):
            return {'error': 'Recipe not found'}, 404
        data = api.payload
        ingredient = facade.add_ingredient(
            recipe_id=recipe_id,
            name=data['name'],
            quantity=data['quantity'],
            unit=data['unit']
        )
        return {'id': ingredient.id, 'name': ingredient.name,
                'quantity': ingredient.quantity, 'unit': ingredient.unit,
                'recipe_id': ingredient.recipe_id}, 201


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
                'recipe_id': ingredient.recipe_id}, 200
    # PUT
    @jwt_required()
    @api.expect(ingredient_update_model)
    @api.response(200, 'Ingredient updated')
    @api.response(404, 'Ingredient not found')
    def put(self, recipe_id, ingredient_id):
        ingredient = facade.get_ingredient(ingredient_id)
        if not ingredient or ingredient.recipe_id != recipe_id:
            return {'error': 'Ingredient not found'}, 404
        updated = facade.update_ingredient(ingredient_id, **api.payload)
        return {'id': updated.id, 'name': updated.name,
                'quantity': updated.quantity, 'unit': updated.unit}, 200
    # DELETE
    @jwt_required()
    @api.response(204, 'Ingredient deleted')
    @api.response(404, 'Ingredient not found')
    def delete(self, recipe_id, ingredient_id):
        ingredient = facade.get_ingredient(ingredient_id)
        if not ingredient or ingredient.recipe_id != recipe_id:
            return {'error': 'Ingredient not found'}, 404
        facade.delete_ingredient(ingredient_id)
        return '', 204
