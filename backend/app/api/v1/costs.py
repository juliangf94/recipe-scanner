from flask_restx import Namespace, Resource, fields
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.facade import facade

api = Namespace('costs', description='Recipe cost estimation and custom ingredient prices')

price_model = api.model('Price', {
    'ingredient_name': fields.String(required=True, description='Ingredient name'),
    'price_per_kg': fields.Float(required=True, description='Price in EUR per kg')
})

price_update_model = api.model('PriceUpdate', {
    'price_per_kg': fields.Float(required=True, description='New price in EUR per kg')
})


@api.route('/recipes/<string:recipe_id>/cost')
class RecipeCost(Resource):

    @jwt_required()
    @api.response(200, 'Cost estimated successfully')
    @api.response(403, 'Forbidden')
    @api.response(404, 'Recipe not found')
    def get(self, recipe_id):
        user_id = get_jwt_identity()
        recipe = facade.get_recipe(recipe_id)
        if not recipe:
            return {'error': 'Recipe not found'}, 404
        if recipe.user_id != user_id:
            return {'error': 'Forbidden'}, 403
        result = facade.get_recipe_cost(recipe_id, user_id)
        return result, 200


@api.route('/prices')
class PriceList(Resource):

    @jwt_required()
    @api.response(200, 'List of custom prices')
    def get(self):
        user_id = get_jwt_identity()
        prices = facade.get_custom_prices(user_id)
        return [{'id': cp.id, 'ingredient_name': cp.ingredient_name,
                 'price_per_kg': cp.price_per_kg} for cp in prices], 200

    @jwt_required()
    @api.expect(price_model, validate=True)
    @api.response(201, 'Custom price created')
    @api.response(409, 'Price for this ingredient already exists')
    def post(self):
        user_id = get_jwt_identity()
        data = api.payload
        existing = facade.get_custom_price(user_id, data['ingredient_name'])
        if existing:
            return {'error': 'Price for this ingredient already exists. Use PUT to update it.'}, 409
        cp = facade.create_custom_price(user_id, data['ingredient_name'], data['price_per_kg'])
        return {'id': cp.id, 'ingredient_name': cp.ingredient_name,
                'price_per_kg': cp.price_per_kg}, 201


@api.route('/prices/<string:ingredient_name>')
class PriceDetail(Resource):

    @jwt_required()
    @api.response(200, 'Custom price found')
    @api.response(404, 'Custom price not found')
    def get(self, ingredient_name):
        user_id = get_jwt_identity()
        cp = facade.get_custom_price(user_id, ingredient_name)
        if not cp:
            return {'error': 'Custom price not found'}, 404
        return {'id': cp.id, 'ingredient_name': cp.ingredient_name,
                'price_per_kg': cp.price_per_kg}, 200

    @jwt_required()
    @api.expect(price_update_model, validate=True)
    @api.response(200, 'Custom price updated')
    @api.response(404, 'Custom price not found')
    def put(self, ingredient_name):
        user_id = get_jwt_identity()
        cp = facade.update_custom_price(user_id, ingredient_name, api.payload['price_per_kg'])
        if not cp:
            return {'error': 'Custom price not found'}, 404
        return {'id': cp.id, 'ingredient_name': cp.ingredient_name,
                'price_per_kg': cp.price_per_kg}, 200

    @jwt_required()
    @api.response(204, 'Custom price deleted')
    @api.response(404, 'Custom price not found')
    def delete(self, ingredient_name):
        user_id = get_jwt_identity()
        if not facade.delete_custom_price(user_id, ingredient_name):
            return {'error': 'Custom price not found'}, 404
        return '', 204
