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
    image_url = db.Column(db.String(500), nullable=True)

    title_en = db.Column(db.String(200), default='')
    title_es = db.Column(db.String(200), default='')
    title_fr = db.Column(db.String(200), default='')
    description_en = db.Column(db.Text, default='')
    description_es = db.Column(db.Text, default='')
    description_fr = db.Column(db.Text, default='')

    translation_provider = db.Column(db.String(20), default='none')
    translation_status = db.Column(db.String(20), default='none')
    images_json = db.Column(db.Text, default='[]')
