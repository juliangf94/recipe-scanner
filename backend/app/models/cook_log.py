from app.extensions import db
import uuid
from datetime import datetime


class CookLog(db.Model):
    __tablename__ = 'cook_log'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    recipe_id = db.Column(db.String(36), db.ForeignKey('recipes.id'), nullable=False)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    cooked_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
