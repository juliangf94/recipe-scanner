import uuid
import pytest
from app.models.user import User
from app.models.recipe import Recipe
from app.models.ingredient import Ingredient
from app.models.step import Step
from app.models.pdf_scan import PdfScan


class TestUser:

    def test_required_fields(self):
        user = User(first_name='Ana', last_name='García',
                    email='ana@test.com', password_hash='hashed')
        assert user.first_name == 'Ana'
        assert user.last_name == 'García'
        assert user.email == 'ana@test.com'
        assert user.password_hash == 'hashed'

    def test_id_is_auto_generated(self):
        user = User(first_name='Ana', last_name='García',
                    email='ana@test.com', password_hash='hashed')
        assert user.id is not None
        uuid.UUID(user.id)

    def test_two_users_have_different_ids(self):
        u1 = User(first_name='Ana', last_name='G', email='a@test.com', password_hash='h')
        u2 = User(first_name='Bob', last_name='S', email='b@test.com', password_hash='h')
        assert u1.id != u2.id


class TestRecipe:

    def test_required_fields(self):
        recipe = Recipe(title='Tarta de manzana', user_id='user-123')
        assert recipe.title == 'Tarta de manzana'
        assert recipe.user_id == 'user-123'

    def test_default_values(self):
        recipe = Recipe(title='Tarta', user_id='user-123')
        assert recipe.description == ''
        assert recipe.servings == 0
        assert recipe.prep_time_min == 0
        assert recipe.category == ''

    def test_id_is_auto_generated(self):
        recipe = Recipe(title='Tarta', user_id='user-123')
        uuid.UUID(recipe.id)

    def test_two_recipes_have_different_ids(self):
        r1 = Recipe(title='Tarta', user_id='u1')
        r2 = Recipe(title='Pizza', user_id='u1')
        assert r1.id != r2.id


class TestIngredient:

    def test_required_fields(self):
        ing = Ingredient(name='Harina', quantity='200', unit='g', recipe_id='recipe-123')
        assert ing.name == 'Harina'
        assert ing.quantity == '200'
        assert ing.unit == 'g'
        assert ing.recipe_id == 'recipe-123'

    def test_default_values(self):
        ing = Ingredient(name='Harina', quantity='200', unit='g', recipe_id='r1')
        assert ing.off_product_id == ''
        assert ing.estimated_cost == 0.0
        assert ing.cost_is_manual is False

    def test_id_is_auto_generated(self):
        ing = Ingredient(name='Harina', quantity='200', unit='g', recipe_id='r1')
        uuid.UUID(ing.id)


class TestStep:

    def test_required_fields(self):
        step = Step(order_num=1, description='Mezclar harina', recipe_id='recipe-123')
        assert step.order_num == 1
        assert step.description == 'Mezclar harina'
        assert step.recipe_id == 'recipe-123'

    def test_default_values(self):
        step = Step(order_num=1, description='Mezclar', recipe_id='r1')
        assert step.duration_min == 0

    def test_id_is_auto_generated(self):
        step = Step(order_num=1, description='Mezclar', recipe_id='r1')
        uuid.UUID(step.id)


class TestPdfScan:

    def test_required_fields(self):
        scan = PdfScan(filename='recipe.pdf', recipe_id='recipe-123')
        assert scan.filename == 'recipe.pdf'
        assert scan.recipe_id == 'recipe-123'

    def test_default_values(self):
        scan = PdfScan(filename='recipe.pdf', recipe_id='r1')
        assert scan.status == 'pending'
        assert scan.scanned_at == ''

    def test_id_is_auto_generated(self):
        scan = PdfScan(filename='recipe.pdf', recipe_id='r1')
        uuid.UUID(scan.id)
