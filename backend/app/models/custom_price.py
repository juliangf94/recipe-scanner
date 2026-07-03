from app.extensions import db
import uuid


class CustomPrice(db.Model):
    __tablename__ = 'custom_prices'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    ingredient_name = db.Column(db.String(100), nullable=False)
    price_per_kg = db.Column(db.Float, nullable=False)
    store_id = db.Column(db.String(36), db.ForeignKey('stores.id'), nullable=True)
    brand_id = db.Column(db.String(36), db.ForeignKey('brands.id'), nullable=True)
    bought_qty = db.Column(db.Float, nullable=True)
    bought_unit = db.Column(db.String(30), nullable=True)
    bought_price = db.Column(db.Float, nullable=True)
