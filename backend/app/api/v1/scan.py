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

        result = facade.scan_pdf(
            user_id=user_id,
            file_bytes=file_bytes,
            filename=file.filename
        )

        if result is None:
            return {'error': 'Could not extract recipe from PDF'}, 500

        recipe, ingredients, steps = result

        return {
            'recipe': {
                'id': recipe.id,
                'title': recipe.title,
                'description': recipe.description,
                'servings': recipe.servings,
                'prep_time_min': recipe.prep_time_min,
                'category': recipe.category
            },
            'ingredients': [
                {'id': i.id, 'name': i.name,
                 'quantity': i.quantity, 'unit': i.unit}
                for i in ingredients
            ],
            'steps': [
                {'id': s.id, 'order_num': s.order_num,
                 'description': s.description}
                for s in steps
            ]
        }, 201
