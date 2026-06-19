from flask_restx import Namespace, Resource, fields
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.facade import facade

api = Namespace('brands', description='Brand management')

brand_model = api.model('Brand', {
    'name': fields.String(required=True, description='Brand name')
})


@api.route('')
class BrandList(Resource):

    @jwt_required()
    @api.response(200, 'List of brands')
    def get(self):
        user_id = get_jwt_identity()
        brands = facade.get_brands(user_id)
        return [{'id': b.id, 'name': b.name} for b in brands], 200

    @jwt_required()
    @api.expect(brand_model, validate=True)
    @api.response(200, 'Brand already exists — returned existing')
    @api.response(201, 'Brand created')
    def post(self):
        user_id = get_jwt_identity()
        name = api.payload['name'].strip()
        existing = facade.get_brand_by_name(user_id, name)
        if existing:
            return {'id': existing.id, 'name': existing.name}, 200
        brand = facade.create_brand(user_id, name)
        return {'id': brand.id, 'name': brand.name}, 201


@api.route('/<string:brand_id>')
class BrandDetail(Resource):

    @jwt_required()
    @api.response(204, 'Brand deleted')
    @api.response(404, 'Brand not found')
    def delete(self, brand_id):
        user_id = get_jwt_identity()
        if not facade.delete_brand(brand_id, user_id):
            return {'error': 'Brand not found'}, 404
        return '', 204
