from flask_restx import Namespace, Resource, fields
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.facade import facade

api = Namespace('costs', description='Recipe cost estimation and custom ingredient prices')

# Units that need /1000 conversion (stored per kg, qty in grams/ml)
_G_UNITS = {'g', 'gr', 'gram', 'grams', 'gramo', 'gramos', 'ml', 'milliliter', 'milliliters'}
# Units stored as-is (qty in kg/l)
_KG_UNITS = {'kg', 'kilogram', 'kilograms', 'kilo', 'kilos', 'l', 'liter', 'liters', 'litro', 'litros'}
# Spoon units → ml equivalent
_SPOON_ML = {
    'cdta': 5, 'cdtas': 5, 'tsp': 5, 'teaspoon': 5, 'teaspoons': 5,
    'cucharadita': 5, 'cucharaditas': 5,
    'cda': 15, 'cdas': 15, 'tbsp': 15, 'tablespoon': 15, 'tablespoons': 15,
    'cucharada': 15, 'cucharadas': 15,
}


def _calc_price_per_kg(qty, unit, price_paid):
    """Convert a purchase (qty, unit, price_paid) into a normalized price per kg/unit."""
    u = unit.lower().strip()
    if u in _KG_UNITS:
        return round(price_paid / qty, 4) if qty else 0
    elif u in _G_UNITS:
        return round((price_paid / qty) * 1000, 4) if qty else 0
    elif u in _SPOON_ML:
        ml = _SPOON_ML[u] * qty
        return round((price_paid / ml) * 1000, 4) if ml else 0
    else:
        # Non-weight unit (unidad, pieza…): store as price per unit
        return round(price_paid / qty, 4) if qty else 0


price_model = api.model('Price', {
    'ingredient_name': fields.String(required=True),
    'store_id': fields.String(description='Store ID (optional)'),
    'brand_id': fields.String(description='Brand ID (optional)'),
    'price_per_kg': fields.Float(description='Direct price per kg/unit'),
    'bought_qty': fields.Float(description='Quantity purchased'),
    'bought_unit': fields.String(description='Unit of purchased quantity'),
    'bought_price': fields.Float(description='Price paid for that quantity'),
})

price_update_model = api.model('PriceUpdate', {
    'ingredient_name': fields.String(description='Ingredient name'),
    'store_id': fields.String(description='Store ID'),
    'brand_id': fields.String(description='Brand ID'),
    'price_per_kg': fields.Float(description='Direct price per kg/unit'),
    'bought_qty': fields.Float(description='Quantity purchased'),
    'bought_unit': fields.String(description='Unit'),
    'bought_price': fields.Float(description='Price paid'),
})

manual_price_model = api.model('ManualPrice', {
    'price_per_kg': fields.Float(required=True, description='Manual price override (per unit)')
})


@api.route('/cook-log/week')
class WeekCookLog(Resource):

    @jwt_required()
    @api.response(200, 'Recipe IDs cooked this week')
    def get(self):
        user_id = get_jwt_identity()
        return {'recipe_ids': facade.get_week_cooked_recipe_ids(user_id)}, 200


@api.route('/summary')
class CostSummary(Resource):

    @jwt_required()
    @api.response(200, 'Cost summary')
    def get(self):
        user_id = get_jwt_identity()
        recipes = facade.get_recipes_by_user(user_id)

        recipe_costs = []
        ing_totals = {}

        for recipe in recipes:
            cost_data = facade.get_recipe_cost(recipe.id, user_id)
            total = cost_data['total_estimated_cost']
            recipe_costs.append({
                'id': recipe.id,
                'title': recipe.title,
                'title_en': recipe.title_en or '',
                'title_es': recipe.title_es or '',
                'title_fr': recipe.title_fr or '',
                'image_url': recipe.image_url,
                'category': recipe.category,
                'cost': total,
                'ingredient_count': len(cost_data['ingredients']),
            })
            for ing in cost_data['ingredients']:
                if ing['estimated_price'] > 0:
                    key = ing['name'].lower().strip()
                    if key not in ing_totals:
                        ing_totals[key] = {
                            'name': ing['name'],
                            'name_en': ing.get('name_en', ''),
                            'name_es': ing.get('name_es', ''),
                            'name_fr': ing.get('name_fr', ''),
                            'total': 0.0,
                            'recipe_id': recipe.id,
                            'recipe_title': recipe.title,
                            'recipe_title_en': recipe.title_en or '',
                            'recipe_title_es': recipe.title_es or '',
                            'recipe_title_fr': recipe.title_fr or '',
                            '_max': 0.0,
                        }
                    ing_totals[key]['total'] = round(ing_totals[key]['total'] + ing['estimated_price'], 2)
                    if ing['estimated_price'] > ing_totals[key]['_max']:
                        ing_totals[key]['_max'] = ing['estimated_price']
                        ing_totals[key]['recipe_id'] = recipe.id
                        ing_totals[key]['recipe_title'] = recipe.title
                        ing_totals[key]['recipe_title_en'] = recipe.title_en or ''
                        ing_totals[key]['recipe_title_es'] = recipe.title_es or ''
                        ing_totals[key]['recipe_title_fr'] = recipe.title_fr or ''

        recipe_costs.sort(key=lambda r: r['cost'], reverse=True)
        top_ings_raw = sorted(ing_totals.values(), key=lambda x: x['total'], reverse=True)[:5]
        top_ings = [{k: v for k, v in ing.items() if k != '_max'} for ing in top_ings_raw]

        week_cooks = facade.get_week_cook_count(user_id)

        return {
            'total_cost': round(sum(r['cost'] for r in recipe_costs), 2),
            'recipe_count': len(recipe_costs),
            'recipes': recipe_costs[:5],
            'top_ingredients': top_ings,
            'week_cooks': week_cooks,
        }, 200


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
        stores_map = {s.id: s.name for s in facade.get_stores(user_id)}
        brands_map = {b.id: b.name for b in facade.get_brands(user_id)}
        return [{
            'id': cp.id,
            'ingredient_name': cp.ingredient_name,
            'price_per_kg': cp.price_per_kg,
            'store_id': cp.store_id,
            'store_name': stores_map.get(cp.store_id, ''),
            'brand_id': cp.brand_id,
            'brand_name': brands_map.get(cp.brand_id, ''),
            'bought_qty': cp.bought_qty,
            'bought_unit': cp.bought_unit,
            'bought_price': cp.bought_price
        } for cp in prices], 200

    @jwt_required()
    @api.expect(price_model, validate=True)
    @api.response(201, 'Custom price created')
    @api.response(400, 'Missing price data')
    @api.response(409, 'Price for this ingredient+store already exists')
    def post(self):
        user_id = get_jwt_identity()
        data = api.payload
        name = data['ingredient_name']
        store_id = data.get('store_id') or None
        brand_id = data.get('brand_id') or None
        bought_qty = data.get('bought_qty')
        bought_unit = data.get('bought_unit')
        bought_price = data.get('bought_price')

        if bought_qty and bought_unit and bought_price:
            price_per_kg = _calc_price_per_kg(bought_qty, bought_unit, bought_price)
        elif data.get('price_per_kg') is not None:
            price_per_kg = data['price_per_kg']
        else:
            return {'error': 'Provide price_per_kg or bought_qty+bought_unit+bought_price'}, 400

        # Uniqueness: ingredient_name + store_id + brand_id
        existing = facade.get_custom_price_by_store_and_brand(user_id, name, store_id, brand_id)
        if existing:
            return {'error': 'Price for this ingredient+store+brand already exists. Use PUT to update.'}, 409

        cp = facade.create_custom_price(user_id, name, price_per_kg,
                                         store_id, brand_id, bought_qty, bought_unit, bought_price)
        stores_map = {s.id: s.name for s in facade.get_stores(user_id)}
        brands_map = {b.id: b.name for b in facade.get_brands(user_id)}
        return {
            'id': cp.id, 'ingredient_name': cp.ingredient_name,
            'price_per_kg': cp.price_per_kg, 'store_id': cp.store_id,
            'store_name': stores_map.get(cp.store_id, ''),
            'brand_id': cp.brand_id, 'brand_name': brands_map.get(cp.brand_id, ''),
            'bought_qty': cp.bought_qty, 'bought_unit': cp.bought_unit,
            'bought_price': cp.bought_price
        }, 201


@api.route('/prices/<string:price_id>')
class PriceDetail(Resource):

    @jwt_required()
    @api.expect(price_update_model)
    @api.response(200, 'Custom price updated')
    @api.response(403, 'Forbidden')
    @api.response(404, 'Custom price not found')
    def put(self, price_id):
        user_id = get_jwt_identity()
        cp = facade.get_custom_price_by_id(price_id)
        if not cp or cp.user_id != user_id:
            return {'error': 'Custom price not found'}, 404
        data = api.payload
        bought_qty = data.get('bought_qty')
        bought_unit = data.get('bought_unit')
        bought_price = data.get('bought_price')
        brand_id = data.get('brand_id') or None
        if bought_qty and bought_unit and bought_price:
            price_per_kg = _calc_price_per_kg(bought_qty, bought_unit, bought_price)
        elif data.get('price_per_kg') is not None:
            price_per_kg = data['price_per_kg']
        else:
            price_per_kg = cp.price_per_kg
        updated = facade.update_custom_price(price_id, price_per_kg,
                                              data.get('store_id') or None, brand_id,
                                              bought_qty, bought_unit, bought_price,
                                              ingredient_name=data.get('ingredient_name') or None)
        stores_map = {s.id: s.name for s in facade.get_stores(user_id)}
        brands_map = {b.id: b.name for b in facade.get_brands(user_id)}
        return {
            'id': updated.id, 'ingredient_name': updated.ingredient_name,
            'price_per_kg': updated.price_per_kg, 'store_id': updated.store_id,
            'store_name': stores_map.get(updated.store_id, ''),
            'brand_id': updated.brand_id, 'brand_name': brands_map.get(updated.brand_id, ''),
            'bought_qty': updated.bought_qty, 'bought_unit': updated.bought_unit,
            'bought_price': updated.bought_price
        }, 200

    @jwt_required()
    @api.response(204, 'Custom price deleted')
    @api.response(404, 'Custom price not found')
    def delete(self, price_id):
        user_id = get_jwt_identity()
        if not facade.delete_custom_price_by_id(price_id, user_id):
            return {'error': 'Custom price not found'}, 404
        return '', 204


@api.route('/recipes/<string:recipe_id>/ingredients/<string:ingredient_id>/off-price')
class IngredientOFFPrice(Resource):

    @jwt_required()
    @api.response(200, 'OFF price fetched')
    @api.response(403, 'Forbidden')
    @api.response(404, 'No price found')
    def get(self, recipe_id, ingredient_id):
        user_id = get_jwt_identity()
        recipe = facade.get_recipe(recipe_id)
        if not recipe or recipe.user_id != user_id:
            return {'error': 'Forbidden'}, 403
        ing = facade.get_ingredient(ingredient_id)
        if not ing or ing.recipe_id != recipe_id:
            return {'error': 'Ingredient not found'}, 404
        price = facade.fetch_and_cache_off_price(ingredient_id)
        if price is None:
            return {'price_per_kg': None}, 404
        return {'price_per_kg': price, 'source': 'off'}, 200


@api.route('/recipes/<string:recipe_id>/ingredients/<string:ingredient_id>/price')
class IngredientManualPrice(Resource):

    @jwt_required()
    @api.expect(manual_price_model, validate=True)
    @api.response(200, 'Manual price set')
    @api.response(403, 'Forbidden')
    @api.response(404, 'Ingredient not found')
    def put(self, recipe_id, ingredient_id):
        user_id = get_jwt_identity()
        recipe = facade.get_recipe(recipe_id)
        if not recipe or recipe.user_id != user_id:
            return {'error': 'Forbidden'}, 403
        ing = facade.get_ingredient(ingredient_id)
        if not ing or ing.recipe_id != recipe_id:
            return {'error': 'Ingredient not found'}, 404
        facade.set_manual_price(ingredient_id, api.payload['price_per_kg'])
        return {'ingredient_id': ingredient_id, 'price_per_kg': api.payload['price_per_kg'], 'source': 'manual'}, 200

    @jwt_required()
    @api.response(200, 'Manual price cleared')
    @api.response(403, 'Forbidden')
    @api.response(404, 'Ingredient not found')
    def delete(self, recipe_id, ingredient_id):
        user_id = get_jwt_identity()
        recipe = facade.get_recipe(recipe_id)
        if not recipe or recipe.user_id != user_id:
            return {'error': 'Forbidden'}, 403
        ing = facade.get_ingredient(ingredient_id)
        if not ing or ing.recipe_id != recipe_id:
            return {'error': 'Ingredient not found'}, 404
        facade.clear_manual_price(ingredient_id)
        return {'ingredient_id': ingredient_id, 'source': None}, 200


@api.route('/recipes/<string:recipe_id>/ingredients/<string:ingredient_id>/store')
class IngredientPreferredStore(Resource):

    @jwt_required()
    @api.response(200, 'Preferred store updated')
    @api.response(403, 'Forbidden')
    def put(self, recipe_id, ingredient_id):
        user_id = get_jwt_identity()
        recipe = facade.get_recipe(recipe_id)
        if not recipe or recipe.user_id != user_id:
            return {'error': 'Forbidden'}, 403
        store_id = (api.payload or {}).get('store_id')
        facade.set_ingredient_preferred_store(ingredient_id, store_id)
        return {'ingredient_id': ingredient_id, 'preferred_store_id': store_id}, 200
