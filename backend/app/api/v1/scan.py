from flask import request
from flask_restx import Namespace, Resource
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.facade import facade

api = Namespace('scan', description='PDF recipe scanning')


@api.route('/')
class ScanPdf(Resource):

    @jwt_required()
    @api.response(201, 'Recipe extracted and saved')
    @api.response(400, 'No file or invalid file')
    @api.response(500, 'Extraction failed')
    def post(self):
        user_id = get_jwt_identity()

        if 'file' not in request.files:
            return {'error': 'No file provided'}, 400

        file = request.files['file']

        if file.filename == '':
            return {'error': 'No file selected'}, 400

        if not file.filename.lower().endswith('.pdf'):
            return {'error': 'File must be a PDF'}, 400

        file_bytes = file.read()
        force = request.args.get('force') == 'true'

        result, error_code = facade.scan_pdf(
            user_id=user_id,
            file_bytes=file_bytes,
            filename=file.filename,
            force=force
        )

        if result is None:
            if error_code == 'no_text':
                return {'error_code': 'scan_no_text'}, 422
            if isinstance(error_code, tuple) and error_code[0] == 'duplicate':
                _, existing_id, title = error_code
                return {'error_code': 'duplicate', 'existing_id': existing_id, 'title': title}, 409
            return {'error_code': 'scan_ai_failed'}, 500

        recipe, ingredients, steps = result

        return {
            'recipe': {
                'id': recipe.id,
                'title': recipe.title,
                'title_en': recipe.title_en,
                'title_es': recipe.title_es,
                'title_fr': recipe.title_fr,
                'description': recipe.description,
                'description_en': recipe.description_en,
                'description_es': recipe.description_es,
                'description_fr': recipe.description_fr,
                'servings': recipe.servings,
                'prep_time_min': recipe.prep_time_min,
                'category': recipe.category
            },
            'ingredients': [
                {'id': i.id, 'name': i.name,
                 'name_en': i.name_en, 'name_es': i.name_es, 'name_fr': i.name_fr,
                 'quantity': i.quantity, 'unit': i.unit}
                for i in ingredients
            ],
            'steps': [
                {'id': s.id, 'order_num': s.order_num,
                 'description': s.description,
                 'description_en': s.description_en,
                 'description_es': s.description_es,
                 'description_fr': s.description_fr}
                for s in steps
            ]
        }, 201
