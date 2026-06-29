from app.extensions import db
import uuid


class Ingredient(db.Model):
    __tablename__ = 'ingredients'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(100), nullable=False)
    quantity = db.Column(db.String(50), default='')
    unit = db.Column(db.String(30), default='')
    recipe_id = db.Column(db.String(36), db.ForeignKey('recipes.id'), nullable=False)
    off_product_id = db.Column(db.String(100), default='')
    estimated_cost = db.Column(db.Float, default=0.0)
    cost_is_manual = db.Column(db.Boolean, default=False)
    manual_price = db.Column(db.Float, nullable=True)
    price_source = db.Column(db.String(20), nullable=True)
    preferred_store_id = db.Column(db.String(36), nullable=True)
    preferred_brand_id = db.Column(db.String(36), nullable=True)
    section = db.Column(db.String(100), nullable=True)

    name_en = db.Column(db.String(100), default='')
    name_es = db.Column(db.String(100), default='')
    name_fr = db.Column(db.String(100), default='')
