from app.extensions import db
import uuid


class Step(db.Model):
    __tablename__ = 'steps'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    order_num = db.Column(db.Integer, nullable=False)
    description = db.Column(db.Text, nullable=False)
    recipe_id = db.Column(db.String(36), db.ForeignKey('recipes.id'), nullable=False)
    duration_min = db.Column(db.Integer, default=0)
