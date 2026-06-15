from app.extensions import db
import uuid


class Recipe(db.Model):
    __tablename__ = 'recipes'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = db.Column(db.String(200), nullable=False)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    description = db.Column(db.Text, default='')
    servings = db.Column(db.Integer, default=0)
    prep_time_min = db.Column(db.Integer, default=0)
    category = db.Column(db.String(100), default='')
