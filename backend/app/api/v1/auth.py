from flask_restx import Namespace, Resource, fields
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from app.services.facade import facade
from app.utils.security import check_password, hash_password

api = Namespace('auth', description='Authentication operations')

register_model = api.model('Register', {
    'first_name': fields.String(required=True, description='First name'),
    'last_name': fields.String(required=True, description='Last name'),
    'email': fields.String(required=True, description='User email'),
    'password': fields.String(required=True, description='User password')
})

login_model = api.model('Login', {
    'email': fields.String(required=True, description='User email'),
    'password': fields.String(required=True, description='User password')
})

user_update_model = api.model('UserUpdate', {
    'first_name': fields.String(description='First name'),
    'last_name': fields.String(description='Last name'),
    'email': fields.String(description='Email address'),
    'password': fields.String(description='New password')
})


@api.route('/register')
class Register(Resource):
    @api.expect(register_model, validate=True)
    @api.response(201, 'User created successfully')
    @api.response(400, 'Email already registered')
    def post(self):
        data = api.payload

        if facade.get_user_by_email(data['email']):
            return {'error': 'Email already registered'}, 400

        user = facade.register_user(
            first_name=data['first_name'],
            last_name=data['last_name'],
            email=data['email'],
            password=data['password']
        )
        return {'message': 'User created successfully', 'user_id': user.id}, 201


@api.route('/login')
class Login(Resource):
    @api.expect(login_model, validate=True)
    @api.response(200, 'Login successful')
    @api.response(401, 'Invalid credentials')
    def post(self):
        data = api.payload

        user = facade.get_user_by_email(data['email'])
        if not user or not check_password(data['password'], user.password_hash):
            return {'error': 'Invalid credentials'}, 401

        token = create_access_token(identity=user.id)
        return {'token': token, 'user': {
            'id': user.id,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'email': user.email
        }}, 200


@api.route('/me')
class Me(Resource):
    @jwt_required()
    @api.response(200, 'Current user data')
    @api.response(404, 'User not found')
    def get(self):
        user_id = get_jwt_identity()
        user = facade.get_user_by_id(user_id)
        if not user:
            return {'error': 'User not found'}, 404
        return {
            'id': user.id,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'email': user.email
        }, 200

    @jwt_required()
    @api.expect(user_update_model)
    @api.response(200, 'User updated')
    @api.response(400, 'Email already in use')
    @api.response(404, 'User not found')
    def put(self):
        user_id = get_jwt_identity()
        data = dict(api.payload)

        if 'email' in data:
            existing = facade.get_user_by_email(data['email'])
            if existing and existing.id != user_id:
                return {'error': 'Email already in use'}, 400

        if 'password' in data:
            data['password_hash'] = hash_password(data.pop('password'))

        user = facade.update_user(user_id, **data)
        if not user:
            return {'error': 'User not found'}, 404
        return {
            'id': user.id,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'email': user.email
        }, 200

    @jwt_required()
    @api.response(204, 'Account deleted')
    @api.response(404, 'User not found')
    def delete(self):
        user_id = get_jwt_identity()
        if not facade.get_user_by_id(user_id):
            return {'error': 'User not found'}, 404
        facade.delete_user(user_id)
        return '', 204
