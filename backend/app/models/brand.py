from app.extensions import db
import uuid


class Brand(db.Model):
    __tablename__ = 'brands'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    ingredient_name = db.Column(db.String(100), nullable=True)
