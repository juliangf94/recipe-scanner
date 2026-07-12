from flask_restx import Namespace, Resource, fields
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.facade import facade

api = Namespace('brands', description='Brand management')

brand_model = api.model('Brand', {
    'name': fields.String(required=True, description='Brand name'),
    'ingredient_name': fields.String(description='Ingredient this brand is for (optional — leave empty for generic brands)')
})


@api.route('')
class BrandList(Resource):

    @jwt_required()
    @api.response(200, 'List of brands')
    def get(self):
        user_id = get_jwt_identity()
        brands = facade.get_brands(user_id)
        return [{'id': b.id, 'name': b.name, 'ingredient_name': b.ingredient_name} for b in brands], 200

    @jwt_required()
    @api.expect(brand_model, validate=True)
    @api.response(200, 'Brand already exists — returned existing')
    @api.response(201, 'Brand created')
    def post(self):
        user_id = get_jwt_identity()
        name = api.payload['name'].strip()
        ingredient_name = (api.payload.get('ingredient_name') or '').strip().lower() or None
        existing = facade.get_brand_by_name_and_ingredient(user_id, name, ingredient_name)
        if existing:
            return {'id': existing.id, 'name': existing.name, 'ingredient_name': existing.ingredient_name}, 200
        brand = facade.create_brand(user_id, name, ingredient_name=ingredient_name)
        return {'id': brand.id, 'name': brand.name, 'ingredient_name': brand.ingredient_name}, 201


brand_patch_model = api.model('BrandPatch', {
    'ingredient_name': fields.String(description='Ingredient to associate (null to make generic)')
})


@api.route('/<string:brand_id>')
class BrandDetail(Resource):

    @jwt_required()
    @api.expect(brand_patch_model)
    @api.response(200, 'Brand updated')
    @api.response(404, 'Brand not found')
    def patch(self, brand_id):
        user_id = get_jwt_identity()
        ingredient_name = (api.payload.get('ingredient_name') or '').strip().lower() or None
        brand = facade.update_brand_ingredient(brand_id, user_id, ingredient_name)
        if not brand:
            return {'error': 'Brand not found'}, 404
        return {'id': brand.id, 'name': brand.name, 'ingredient_name': brand.ingredient_name}, 200

    @jwt_required()
    @api.response(204, 'Brand deleted')
    @api.response(404, 'Brand not found')
    def delete(self, brand_id):
        user_id = get_jwt_identity()
        if not facade.delete_brand(brand_id, user_id):
            return {'error': 'Brand not found'}, 404
        return '', 204
