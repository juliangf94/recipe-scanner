from app.extensions import db
from app.persistence.repository import BaseRepository


class DbStorage(BaseRepository):

    def __init__(self, model):
        self.model = model

    def get_all(self):
        return self.model.query.all()

    def get_by_id(self, obj_id):
        return db.session.get(self.model, obj_id)

    def get_by_attribute(self, attr_name, attr_value):
        return self.model.query.filter_by(**{attr_name: attr_value}).first()

    def filter_by(self, **kwargs):
        return self.model.query.filter_by(**kwargs).all()

    def save(self, obj):
        db.session.add(obj)
        db.session.commit()
        return obj

    def update(self, obj):
        db.session.commit()
        return obj

    def delete(self, obj_id):
        obj = self.get_by_id(obj_id)
        if obj:
            db.session.delete(obj)
            db.session.commit()
