from flask_restx import Namespace, Resource, fields
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.facade import facade

api = Namespace('stores', description='Supermarket store management')

store_model = api.model('Store', {
    'name': fields.String(required=True, description='Store name')
})


@api.route('')
class StoreList(Resource):

    @jwt_required()
    @api.response(200, 'List of stores')
    def get(self):
        user_id = get_jwt_identity()
        stores = facade.get_stores(user_id)
        return [{'id': s.id, 'name': s.name} for s in stores], 200

    @jwt_required()
    @api.expect(store_model, validate=True)
    @api.response(200, 'Store already exists — returned existing')
    @api.response(201, 'Store created')
    def post(self):
        user_id = get_jwt_identity()
        name = api.payload['name'].strip()
        existing = facade.get_store_by_name(user_id, name)
        if existing:
            return {'id': existing.id, 'name': existing.name}, 200
        store = facade.create_store(user_id, name)
        return {'id': store.id, 'name': store.name}, 201


@api.route('/<string:store_id>')
class StoreDetail(Resource):

    @jwt_required()
    @api.response(204, 'Store deleted')
    @api.response(404, 'Store not found')
    def delete(self, store_id):
        user_id = get_jwt_identity()
        if not facade.delete_store(store_id, user_id):
            return {'error': 'Store not found'}, 404
        return '', 204
