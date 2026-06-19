import json
import pytest


# ── Helpers ───────────────────────────────────────────────────────────────────

def post_json(client, url, data, token=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    return client.post(url, data=json.dumps(data), headers=headers,
                       follow_redirects=True)


def get_json(client, url, token=None):
    headers = {}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    return client.get(url, headers=headers, follow_redirects=True)


def put_json(client, url, data, token):
    return client.put(url,
                      data=json.dumps(data),
                      headers={'Content-Type': 'application/json',
                               'Authorization': f'Bearer {token}'})


def delete_json(client, url, token):
    return client.delete(url, headers={'Authorization': f'Bearer {token}'})


def register_and_login(client, email='test@test.com', password='Password1!'):
    post_json(client, '/api/v1/auth/register', {
        'first_name': 'Test', 'last_name': 'User',
        'email': email, 'password': password
    })
    res = post_json(client, '/api/v1/auth/login', {'email': email, 'password': password})
    return json.loads(res.data)['access_token']


# ── Auth ──────────────────────────────────────────────────────────────────────

class TestAuth:

    def test_register_success(self, client):
        res = post_json(client, '/api/v1/auth/register', {
            'first_name': 'Ana', 'last_name': 'García',
            'email': 'ana@test.com', 'password': 'Secret123!'
        })
        assert res.status_code == 201
        data = json.loads(res.data)
        assert 'user_id' in data
        assert 'password' not in data
        assert 'password_hash' not in data

    def test_register_duplicate_email_returns_400(self, client):
        payload = {'first_name': 'A', 'last_name': 'B',
                   'email': 'dup@test.com', 'password': 'Secret123!'}
        post_json(client, '/api/v1/auth/register', payload)
        res = post_json(client, '/api/v1/auth/register', payload)
        assert res.status_code == 400

    def test_login_success_returns_token(self, client):
        post_json(client, '/api/v1/auth/register', {
            'first_name': 'Bob', 'last_name': 'Smith',
            'email': 'bob@test.com', 'password': 'Pass1234!'
        })
        res = post_json(client, '/api/v1/auth/login',
                        {'email': 'bob@test.com', 'password': 'Pass1234!'})
        assert res.status_code == 200
        data = json.loads(res.data)
        assert 'access_token' in data

    def test_login_wrong_password_returns_401(self, client):
        post_json(client, '/api/v1/auth/register', {
            'first_name': 'C', 'last_name': 'D',
            'email': 'cd@test.com', 'password': 'Right1234!'
        })
        res = post_json(client, '/api/v1/auth/login',
                        {'email': 'cd@test.com', 'password': 'Wrong1234!'})
        assert res.status_code == 401

    def test_login_unknown_email_returns_401(self, client):
        res = post_json(client, '/api/v1/auth/login',
                        {'email': 'nobody@test.com', 'password': 'whatever'})
        assert res.status_code == 401

    def test_get_me_requires_auth(self, client):
        res = get_json(client, '/api/v1/auth/me')
        assert res.status_code == 401

    def test_get_me_returns_user_info(self, client):
        token = register_and_login(client, 'me@test.com')
        res = get_json(client, '/api/v1/auth/me', token=token)
        assert res.status_code == 200
        data = json.loads(res.data)
        assert data['email'] == 'me@test.com'


# ── Recipes ───────────────────────────────────────────────────────────────────

class TestRecipes:

    def test_get_recipes_requires_auth(self, client):
        res = get_json(client, '/api/v1/recipes/')
        assert res.status_code == 401

    def test_create_recipe(self, client):
        token = register_and_login(client, 'chef@test.com')
        res = post_json(client, '/api/v1/recipes/',
                        {'title': 'Tarta de manzana', 'description': 'Clásica'},
                        token=token)
        assert res.status_code == 201
        data = json.loads(res.data)
        assert data['title'] == 'Tarta de manzana'
        assert 'id' in data

    def test_get_recipes_returns_only_own(self, client):
        token1 = register_and_login(client, 'user1@test.com')
        token2 = register_and_login(client, 'user2@test.com')
        post_json(client, '/api/v1/recipes/', {'title': 'Receta de user1'}, token=token1)
        res = get_json(client, '/api/v1/recipes/', token=token2)
        assert res.status_code == 200
        data = json.loads(res.data)
        assert all(r['title'] != 'Receta de user1' for r in data)

    def test_get_recipe_by_id(self, client):
        token = register_and_login(client, 'get@test.com')
        create_res = post_json(client, '/api/v1/recipes/', {'title': 'Pizza'}, token=token)
        recipe_id = json.loads(create_res.data)['id']
        res = get_json(client, f'/api/v1/recipes/{recipe_id}', token=token)
        assert res.status_code == 200
        assert json.loads(res.data)['title'] == 'Pizza'

    def test_get_other_user_recipe_returns_403(self, client):
        token1 = register_and_login(client, 'owner@test.com')
        token2 = register_and_login(client, 'other@test.com')
        create_res = post_json(client, '/api/v1/recipes/', {'title': 'Private'}, token=token1)
        recipe_id = json.loads(create_res.data)['id']
        res = get_json(client, f'/api/v1/recipes/{recipe_id}', token=token2)
        assert res.status_code == 403

    def test_update_recipe(self, client):
        token = register_and_login(client, 'upd@test.com')
        create_res = post_json(client, '/api/v1/recipes/', {'title': 'Old Title'}, token=token)
        recipe_id = json.loads(create_res.data)['id']
        res = put_json(client, f'/api/v1/recipes/{recipe_id}', {'title': 'New Title'}, token)
        assert res.status_code == 200
        assert json.loads(res.data)['title'] == 'New Title'

    def test_delete_recipe(self, client):
        token = register_and_login(client, 'del@test.com')
        create_res = post_json(client, '/api/v1/recipes/', {'title': 'To Delete'}, token=token)
        recipe_id = json.loads(create_res.data)['id']
        res = delete_json(client, f'/api/v1/recipes/{recipe_id}', token)
        assert res.status_code == 204
        res2 = get_json(client, f'/api/v1/recipes/{recipe_id}', token=token)
        assert res2.status_code == 404


# ── Ingredients ───────────────────────────────────────────────────────────────

class TestIngredients:

    @pytest.fixture
    def recipe(self, client):
        token = register_and_login(client, 'ing@test.com')
        res = post_json(client, '/api/v1/recipes/', {'title': 'Test Recipe'}, token=token)
        recipe_id = json.loads(res.data)['id']
        return token, recipe_id

    def test_add_ingredient(self, client, recipe):
        token, recipe_id = recipe
        res = post_json(client, f'/api/v1/recipes/{recipe_id}/ingredients',
                        {'name': 'Harina', 'quantity': '200', 'unit': 'g'}, token=token)
        assert res.status_code == 201
        data = json.loads(res.data)
        assert data['name'] == 'Harina'

    def test_list_ingredients(self, client, recipe):
        token, recipe_id = recipe
        post_json(client, f'/api/v1/recipes/{recipe_id}/ingredients',
                  {'name': 'Azucar', 'quantity': '100', 'unit': 'g'}, token=token)
        res = get_json(client, f'/api/v1/recipes/{recipe_id}/ingredients', token=token)
        assert res.status_code == 200
        names = [i['name'] for i in json.loads(res.data)]
        assert 'Azucar' in names

    def test_update_preferred_store(self, client, recipe):
        token, recipe_id = recipe
        add_res = post_json(client, f'/api/v1/recipes/{recipe_id}/ingredients',
                            {'name': 'Sal', 'quantity': '1', 'unit': 'pizca'}, token=token)
        ing_id = json.loads(add_res.data)['id']
        res = put_json(client, f'/api/v1/recipes/{recipe_id}/ingredients/{ing_id}',
                       {'preferred_store_id': 'fake-store-id'}, token)
        assert res.status_code == 200
        assert json.loads(res.data)['preferred_store_id'] == 'fake-store-id'

    def test_delete_ingredient(self, client, recipe):
        token, recipe_id = recipe
        add_res = post_json(client, f'/api/v1/recipes/{recipe_id}/ingredients',
                            {'name': 'Levadura', 'quantity': '7', 'unit': 'g'}, token=token)
        ing_id = json.loads(add_res.data)['id']
        res = delete_json(client, f'/api/v1/recipes/{recipe_id}/ingredients/{ing_id}', token)
        assert res.status_code == 204


# ── Stores & Brands ───────────────────────────────────────────────────────────

class TestStoresAndBrands:

    def test_create_store(self, client):
        token = register_and_login(client, 'store@test.com')
        res = post_json(client, '/api/v1/stores', {'name': 'Intermarché'}, token=token)
        assert res.status_code == 201
        assert json.loads(res.data)['name'] == 'Intermarché'

    def test_create_store_idempotent(self, client):
        token = register_and_login(client, 'idem@test.com')
        res1 = post_json(client, '/api/v1/stores', {'name': 'Lidl'}, token=token)
        res2 = post_json(client, '/api/v1/stores', {'name': 'Lidl'}, token=token)
        assert json.loads(res1.data)['id'] == json.loads(res2.data)['id']

    def test_list_stores_only_own(self, client):
        token1 = register_and_login(client, 'st1@test.com')
        token2 = register_and_login(client, 'st2@test.com')
        post_json(client, '/api/v1/stores', {'name': 'User1Store'}, token=token1)
        res = get_json(client, '/api/v1/stores', token=token2)
        names = [s['name'] for s in json.loads(res.data)]
        assert 'User1Store' not in names

    def test_create_brand(self, client):
        token = register_and_login(client, 'brand@test.com')
        res = post_json(client, '/api/v1/brands', {'name': 'Hacendado'}, token=token)
        assert res.status_code == 201
        assert json.loads(res.data)['name'] == 'Hacendado'

    def test_create_brand_idempotent(self, client):
        token = register_and_login(client, 'bi@test.com')
        res1 = post_json(client, '/api/v1/brands', {'name': 'Dia'}, token=token)
        res2 = post_json(client, '/api/v1/brands', {'name': 'Dia'}, token=token)
        assert json.loads(res1.data)['id'] == json.loads(res2.data)['id']


# ── Custom Prices ─────────────────────────────────────────────────────────────

class TestCustomPrices:

    def test_create_custom_price(self, client):
        token = register_and_login(client, 'price@test.com')
        res = post_json(client, '/api/v1/prices', {
            'ingredient_name': 'harina',
            'price_per_kg': 1.20,
            'bought_qty': 1,
            'bought_unit': 'kg',
            'bought_price': 1.20
        }, token=token)
        assert res.status_code == 201
        data = json.loads(res.data)
        assert data['ingredient_name'] == 'harina'
        assert data['price_per_kg'] == 1.20

    def test_list_custom_prices_only_own(self, client):
        token1 = register_and_login(client, 'cp1@test.com')
        token2 = register_and_login(client, 'cp2@test.com')
        post_json(client, '/api/v1/prices', {
            'ingredient_name': 'azucar', 'price_per_kg': 1.0,
            'bought_qty': 1, 'bought_unit': 'kg', 'bought_price': 1.0
        }, token=token1)
        res = get_json(client, '/api/v1/prices', token=token2)
        assert res.status_code == 200
        names = [p['ingredient_name'] for p in json.loads(res.data)]
        assert 'azucar' not in names

    def test_delete_custom_price(self, client):
        token = register_and_login(client, 'cpd@test.com')
        create_res = post_json(client, '/api/v1/prices', {
            'ingredient_name': 'sal', 'price_per_kg': 0.50,
            'bought_qty': 1, 'bought_unit': 'kg', 'bought_price': 0.50
        }, token=token)
        price_id = json.loads(create_res.data)['id']
        res = delete_json(client, f'/api/v1/prices/{price_id}', token)
        assert res.status_code == 204
