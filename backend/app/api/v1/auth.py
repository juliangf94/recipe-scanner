import os
from flask import request, current_app
from flask_restx import Namespace, Resource, fields
from flask_jwt_extended import (create_access_token, create_refresh_token,
                                jwt_required, get_jwt_identity)
from app.services.facade import facade
from app.utils.security import check_password, hash_password
from app import storage as _storage

ALLOWED_IMAGE_EXTS = {'jpg', 'jpeg', 'png', 'webp'}

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

        access_token = create_access_token(identity=user.id)
        refresh_token = create_refresh_token(identity=user.id)
        return {
            'access_token': access_token,
            'refresh_token': refresh_token,
            'user': {
                'id': user.id,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'email': user.email,
                'avatar_url': user.avatar_url
            }
        }, 200


@api.route('/refresh')
class Refresh(Resource):
    @jwt_required(refresh=True)
    @api.response(200, 'New access token issued')
    @api.response(401, 'Invalid or expired refresh token')
    def post(self):
        user_id = get_jwt_identity()
        access_token = create_access_token(identity=user_id)
        return {'access_token': access_token}, 200


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
            'email': user.email,
            'avatar_url': user.avatar_url
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
            'email': user.email,
            'avatar_url': user.avatar_url
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


@api.route('/me/avatar')
class UserAvatar(Resource):

    @jwt_required()
    @api.response(200, 'Avatar uploaded')
    @api.response(400, 'Invalid file')
    def post(self):
        user_id = get_jwt_identity()
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
        avatar_path = f'avatars/{user_id}.{ext}'

        # Delete old avatars from Supabase
        for old_ext in ALLOWED_IMAGE_EXTS:
            _storage.delete_file(f'avatars/{user_id}.{old_ext}')

        avatar_url = _storage.upload_file(file_bytes, avatar_path, content_type)
        if not avatar_url:
            # Fallback: local filesystem
            uploads_dir = os.path.join(current_app.static_folder, 'uploads', 'avatars')
            os.makedirs(uploads_dir, exist_ok=True)
            for old_ext in ALLOWED_IMAGE_EXTS:
                old_path = os.path.join(uploads_dir, f'{user_id}.{old_ext}')
                if os.path.exists(old_path):
                    os.remove(old_path)
            with open(os.path.join(uploads_dir, f'{user_id}.{ext}'), 'wb') as fp:
                fp.write(file_bytes)
            avatar_url = f'/static/uploads/avatars/{user_id}.{ext}'

        facade.update_user(user_id, avatar_url=avatar_url)
        return {'avatar_url': avatar_url}, 200
