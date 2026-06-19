import uuid
import pytest
from app.extensions import db
from app.models.user import User
from app.models.recipe import Recipe
from app.models.ingredient import Ingredient
from app.models.step import Step
from app.models.pdf_scan import PdfScan
from app.models.store import Store
from app.models.brand import Brand
from app.models.custom_price import CustomPrice


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_user(email='ana@test.com', **kwargs):
    defaults = dict(first_name='Ana', last_name='García',
                    email=email, password_hash='hashed')
    defaults.update(kwargs)
    u = User(**defaults)
    db.session.add(u)
    db.session.commit()
    return u


def make_recipe(user_id, title='Tarta de manzana', **kwargs):
    r = Recipe(title=title, user_id=user_id, **kwargs)
    db.session.add(r)
    db.session.commit()
    return r


# ── User ──────────────────────────────────────────────────────────────────────

class TestUser:

    def test_fields_persisted(self, app):
        with app.app_context():
            u = make_user()
            found = db.session.get(User, u.id)
            assert found.first_name == 'Ana'
            assert found.last_name == 'García'
            assert found.email == 'ana@test.com'
            assert found.password_hash == 'hashed'

    def test_id_is_uuid(self, app):
        with app.app_context():
            u = make_user()
            uuid.UUID(u.id)

    def test_two_users_have_different_ids(self, app):
        with app.app_context():
            u1 = make_user(email='a@test.com')
            u2 = make_user(email='b@test.com')
            assert u1.id != u2.id

    def test_avatar_url_nullable(self, app):
        with app.app_context():
            u = make_user()
            assert u.avatar_url is None


# ── Recipe ────────────────────────────────────────────────────────────────────

class TestRecipe:

    def test_fields_persisted(self, app):
        with app.app_context():
            u = make_user()
            r = make_recipe(u.id, title='Pizza', description='Classic pizza')
            found = db.session.get(Recipe, r.id)
            assert found.title == 'Pizza'
            assert found.user_id == u.id
            assert found.description == 'Classic pizza'

    def test_default_values(self, app):
        with app.app_context():
            u = make_user()
            r = make_recipe(u.id)
            assert r.servings == 0
            assert r.prep_time_min == 0
            assert r.category == ''
            assert r.image_url is None

    def test_id_is_uuid(self, app):
        with app.app_context():
            u = make_user()
            r = make_recipe(u.id)
            uuid.UUID(r.id)


# ── Ingredient ────────────────────────────────────────────────────────────────

class TestIngredient:

    def test_fields_persisted(self, app):
        with app.app_context():
            u = make_user()
            r = make_recipe(u.id)
            ing = Ingredient(name='Harina', quantity='200', unit='g', recipe_id=r.id)
            db.session.add(ing)
            db.session.commit()
            found = db.session.get(Ingredient, ing.id)
            assert found.name == 'Harina'
            assert found.quantity == '200'
            assert found.unit == 'g'
            assert found.recipe_id == r.id

    def test_optional_fields_nullable(self, app):
        with app.app_context():
            u = make_user()
            r = make_recipe(u.id)
            ing = Ingredient(name='Sal', quantity='1', unit='pizca', recipe_id=r.id)
            db.session.add(ing)
            db.session.commit()
            assert ing.preferred_store_id is None
            assert ing.preferred_brand_id is None
            assert ing.section is None


# ── Step ──────────────────────────────────────────────────────────────────────

class TestStep:

    def test_fields_persisted(self, app):
        with app.app_context():
            u = make_user()
            r = make_recipe(u.id)
            from app.models.step import Step
            step = Step(order_num=1, description='Mezclar harina', recipe_id=r.id)
            db.session.add(step)
            db.session.commit()
            found = db.session.get(Step, step.id)
            assert found.order_num == 1
            assert found.description == 'Mezclar harina'

    def test_default_duration(self, app):
        with app.app_context():
            u = make_user()
            r = make_recipe(u.id)
            from app.models.step import Step
            step = Step(order_num=1, description='Hornear', recipe_id=r.id)
            db.session.add(step)
            db.session.commit()
            assert step.duration_min == 0


# ── Store & Brand ─────────────────────────────────────────────────────────────

class TestStore:

    def test_store_creation(self, app):
        with app.app_context():
            u = make_user()
            store = Store(user_id=u.id, name='Intermarché')
            db.session.add(store)
            db.session.commit()
            found = db.session.get(Store, store.id)
            assert found.name == 'Intermarché'
            assert found.user_id == u.id

    def test_store_id_is_uuid(self, app):
        with app.app_context():
            u = make_user()
            store = Store(user_id=u.id, name='Carrefour')
            db.session.add(store)
            db.session.commit()
            uuid.UUID(store.id)


class TestBrand:

    def test_brand_creation(self, app):
        with app.app_context():
            u = make_user()
            brand = Brand(user_id=u.id, name='Hacendado')
            db.session.add(brand)
            db.session.commit()
            found = db.session.get(Brand, brand.id)
            assert found.name == 'Hacendado'

    def test_brand_id_is_uuid(self, app):
        with app.app_context():
            u = make_user()
            brand = Brand(user_id=u.id, name='Dia')
            db.session.add(brand)
            db.session.commit()
            uuid.UUID(brand.id)


# ── CustomPrice ───────────────────────────────────────────────────────────────

class TestCustomPrice:

    def test_custom_price_creation(self, app):
        with app.app_context():
            u = make_user()
            store = Store(user_id=u.id, name='Lidl')
            db.session.add(store)
            db.session.commit()
            cp = CustomPrice(
                user_id=u.id,
                ingredient_name='harina',
                price_per_kg=1.20,
                store_id=store.id
            )
            db.session.add(cp)
            db.session.commit()
            found = db.session.get(CustomPrice, cp.id)
            assert found.ingredient_name == 'harina'
            assert found.price_per_kg == 1.20
            assert found.store_id == store.id

    def test_brand_id_nullable(self, app):
        with app.app_context():
            u = make_user()
            cp = CustomPrice(user_id=u.id, ingredient_name='sal', price_per_kg=0.50)
            db.session.add(cp)
            db.session.commit()
            assert cp.brand_id is None
