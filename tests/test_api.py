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


def register_and_login_full(client, email='test@test.com', password='Password1!'):
    """Returns (access_token, refresh_token)."""
    post_json(client, '/api/v1/auth/register', {
        'first_name': 'Test', 'last_name': 'User',
        'email': email, 'password': password
    })
    res = post_json(client, '/api/v1/auth/login', {'email': email, 'password': password})
    data = json.loads(res.data)
    return data['access_token'], data['refresh_token']


def refresh_json(client, refresh_token):
    return client.post('/api/v1/auth/refresh',
                       headers={'Authorization': f'Bearer {refresh_token}'})


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

    def test_refresh_token_issues_new_access_token(self, client):
        _, refresh_token = register_and_login_full(client, 'refresh@test.com')
        res = refresh_json(client, refresh_token)
        assert res.status_code == 200
        assert 'access_token' in json.loads(res.data)

    def test_update_me_first_name(self, client):
        token = register_and_login(client, 'updme@test.com')
        res = put_json(client, '/api/v1/auth/me', {'first_name': 'Nuevo'}, token)
        assert res.status_code == 200
        assert json.loads(res.data)['first_name'] == 'Nuevo'

    def test_update_me_email_already_in_use_returns_400(self, client):
        register_and_login(client, 'taken@test.com')
        token2 = register_and_login(client, 'updconflict@test.com')
        res = put_json(client, '/api/v1/auth/me', {'email': 'taken@test.com'}, token2)
        assert res.status_code == 400

    def test_update_me_password_change(self, client):
        token = register_and_login(client, 'passchange@test.com', 'OldPass123!')
        put_json(client, '/api/v1/auth/me', {'password': 'NewPass456!'}, token)
        res = post_json(client, '/api/v1/auth/login',
                        {'email': 'passchange@test.com', 'password': 'NewPass456!'})
        assert res.status_code == 200
        assert 'access_token' in json.loads(res.data)

    def test_delete_account(self, client):
        token = register_and_login(client, 'deleteme@test.com')
        res = client.delete('/api/v1/auth/me',
                            headers={'Authorization': f'Bearer {token}'})
        assert res.status_code == 204
        res2 = get_json(client, '/api/v1/auth/me', token=token)
        assert res2.status_code == 404


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

    def test_get_nonexistent_recipe_returns_404(self, client):
        token = register_and_login(client, 'r404@test.com')
        res = get_json(client, '/api/v1/recipes/00000000-0000-0000-0000-000000000000', token=token)
        assert res.status_code == 404

    def test_update_nonexistent_recipe_returns_404(self, client):
        token = register_and_login(client, 'ru404@test.com')
        res = put_json(client, '/api/v1/recipes/00000000-0000-0000-0000-000000000000',
                       {'title': 'Nada'}, token)
        assert res.status_code == 404

    def test_update_other_user_recipe_returns_403(self, client):
        token1 = register_and_login(client, 'rowner@test.com')
        token2 = register_and_login(client, 'rattacker@test.com')
        create_res = post_json(client, '/api/v1/recipes/', {'title': 'Privada'}, token=token1)
        recipe_id = json.loads(create_res.data)['id']
        res = put_json(client, f'/api/v1/recipes/{recipe_id}', {'title': 'Hackeada'}, token2)
        assert res.status_code == 403

    def test_delete_other_user_recipe_returns_403(self, client):
        token1 = register_and_login(client, 'rdowner@test.com')
        token2 = register_and_login(client, 'rdattacker@test.com')
        create_res = post_json(client, '/api/v1/recipes/', {'title': 'No tocar'}, token=token1)
        recipe_id = json.loads(create_res.data)['id']
        res = delete_json(client, f'/api/v1/recipes/{recipe_id}', token2)
        assert res.status_code == 403


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

    def test_get_ingredient_by_id(self, client, recipe):
        token, recipe_id = recipe
        add_res = post_json(client, f'/api/v1/recipes/{recipe_id}/ingredients',
                            {'name': 'Mantequilla', 'quantity': '100', 'unit': 'g'}, token=token)
        ing_id = json.loads(add_res.data)['id']
        res = get_json(client, f'/api/v1/recipes/{recipe_id}/ingredients/{ing_id}', token=token)
        assert res.status_code == 200
        assert json.loads(res.data)['name'] == 'Mantequilla'

    def test_get_nonexistent_ingredient_returns_404(self, client, recipe):
        token, recipe_id = recipe
        res = get_json(client,
                       f'/api/v1/recipes/{recipe_id}/ingredients/00000000-0000-0000-0000-000000000000',
                       token=token)
        assert res.status_code == 404

    def test_add_ingredient_to_other_user_recipe_returns_403(self, client):
        token1 = register_and_login(client, 'iowner@test.com')
        token2 = register_and_login(client, 'iattacker@test.com')
        create_res = post_json(client, '/api/v1/recipes/', {'title': 'Receta ajena'}, token=token1)
        recipe_id = json.loads(create_res.data)['id']
        res = post_json(client, f'/api/v1/recipes/{recipe_id}/ingredients',
                        {'name': 'Azúcar', 'quantity': '100', 'unit': 'g'}, token=token2)
        assert res.status_code == 403

    def test_delete_ingredient_from_other_user_recipe_returns_403(self, client):
        token1 = register_and_login(client, 'idowner@test.com')
        token2 = register_and_login(client, 'idattacker@test.com')
        create_res = post_json(client, '/api/v1/recipes/', {'title': 'Receta mía'}, token=token1)
        recipe_id = json.loads(create_res.data)['id']
        add_res = post_json(client, f'/api/v1/recipes/{recipe_id}/ingredients',
                            {'name': 'Leche', 'quantity': '200', 'unit': 'ml'}, token=token1)
        ing_id = json.loads(add_res.data)['id']
        res = delete_json(client, f'/api/v1/recipes/{recipe_id}/ingredients/{ing_id}', token2)
        assert res.status_code == 403


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

    def test_list_brands_only_own(self, client):
        token1 = register_and_login(client, 'br1@test.com')
        token2 = register_and_login(client, 'br2@test.com')
        post_json(client, '/api/v1/brands', {'name': 'MarcaSecreta'}, token=token1)
        res = get_json(client, '/api/v1/brands', token=token2)
        names = [b['name'] for b in json.loads(res.data)]
        assert 'MarcaSecreta' not in names

    def test_delete_store(self, client):
        token = register_and_login(client, 'dstore@test.com')
        create_res = post_json(client, '/api/v1/stores', {'name': 'Auchan'}, token=token)
        store_id = json.loads(create_res.data)['id']
        res = delete_json(client, f'/api/v1/stores/{store_id}', token)
        assert res.status_code == 204
        stores = json.loads(get_json(client, '/api/v1/stores', token=token).data)
        assert not any(s['id'] == store_id for s in stores)

    def test_delete_nonexistent_store_returns_404(self, client):
        token = register_and_login(client, 'ds404@test.com')
        res = delete_json(client, '/api/v1/stores/00000000-0000-0000-0000-000000000000', token)
        assert res.status_code == 404

    def test_delete_brand(self, client):
        token = register_and_login(client, 'dbrand@test.com')
        create_res = post_json(client, '/api/v1/brands', {'name': 'Carrefour Bio'}, token=token)
        brand_id = json.loads(create_res.data)['id']
        res = delete_json(client, f'/api/v1/brands/{brand_id}', token)
        assert res.status_code == 204
        brands = json.loads(get_json(client, '/api/v1/brands', token=token).data)
        assert not any(b['id'] == brand_id for b in brands)

    def test_delete_nonexistent_brand_returns_404(self, client):
        token = register_and_login(client, 'db404@test.com')
        res = delete_json(client, '/api/v1/brands/00000000-0000-0000-0000-000000000000', token)
        assert res.status_code == 404

    def test_patch_brand_ingredient_name(self, client):
        token = register_and_login(client, 'bpatch@test.com')
        create_res = post_json(client, '/api/v1/brands', {'name': 'Natura'}, token=token)
        brand_id = json.loads(create_res.data)['id']
        res = client.patch(
            f'/api/v1/brands/{brand_id}',
            data=json.dumps({'ingredient_name': 'mantequilla'}),
            headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {token}'}
        )
        assert res.status_code == 200
        assert json.loads(res.data)['ingredient_name'] == 'mantequilla'

    def test_patch_brand_other_user_returns_404(self, client):
        token1 = register_and_login(client, 'bpowner@test.com')
        token2 = register_and_login(client, 'bpattacker@test.com')
        create_res = post_json(client, '/api/v1/brands', {'name': 'AjenaMarca'}, token=token1)
        brand_id = json.loads(create_res.data)['id']
        res = client.patch(
            f'/api/v1/brands/{brand_id}',
            data=json.dumps({'ingredient_name': 'leche'}),
            headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {token2}'}
        )
        assert res.status_code == 404


# ── Steps ─────────────────────────────────────────────────────────────────────

class TestSteps:

    @pytest.fixture
    def recipe(self, client):
        token = register_and_login(client, 'steps@test.com')
        res = post_json(client, '/api/v1/recipes/', {'title': 'Step Test Recipe'}, token=token)
        recipe_id = json.loads(res.data)['id']
        return token, recipe_id

    def test_add_step(self, client, recipe):
        token, recipe_id = recipe
        res = post_json(client, f'/api/v1/recipes/{recipe_id}/steps',
                        {'description': 'Mezclar harina con agua'}, token=token)
        assert res.status_code == 201
        data = json.loads(res.data)
        assert data['description'] == 'Mezclar harina con agua'
        assert 'id' in data
        assert 'order_num' in data

    def test_add_step_auto_order_num(self, client, recipe):
        token, recipe_id = recipe
        res1 = post_json(client, f'/api/v1/recipes/{recipe_id}/steps',
                         {'description': 'Primer paso'}, token=token)
        res2 = post_json(client, f'/api/v1/recipes/{recipe_id}/steps',
                         {'description': 'Segundo paso'}, token=token)
        assert json.loads(res1.data)['order_num'] == 1
        assert json.loads(res2.data)['order_num'] == 2

    def test_list_steps(self, client, recipe):
        token, recipe_id = recipe
        post_json(client, f'/api/v1/recipes/{recipe_id}/steps',
                  {'description': 'Paso 1'}, token=token)
        res = get_json(client, f'/api/v1/recipes/{recipe_id}/steps', token=token)
        assert res.status_code == 200
        data = json.loads(res.data)
        assert isinstance(data, list)
        assert len(data) >= 1

    def test_list_steps_sorted_by_order_num(self, client, recipe):
        token, recipe_id = recipe
        post_json(client, f'/api/v1/recipes/{recipe_id}/steps',
                  {'description': 'Paso A'}, token=token)
        post_json(client, f'/api/v1/recipes/{recipe_id}/steps',
                  {'description': 'Paso B'}, token=token)
        post_json(client, f'/api/v1/recipes/{recipe_id}/steps',
                  {'description': 'Paso C'}, token=token)
        res = get_json(client, f'/api/v1/recipes/{recipe_id}/steps', token=token)
        steps = json.loads(res.data)
        nums = [s['order_num'] for s in steps]
        assert nums == sorted(nums)

    def test_update_step_description(self, client, recipe):
        token, recipe_id = recipe
        add_res = post_json(client, f'/api/v1/recipes/{recipe_id}/steps',
                            {'description': 'Descripción original'}, token=token)
        step_id = json.loads(add_res.data)['id']
        res = put_json(client, f'/api/v1/recipes/{recipe_id}/steps/{step_id}',
                       {'description': 'Descripción actualizada'}, token)
        assert res.status_code == 200
        assert json.loads(res.data)['description'] == 'Descripción actualizada'

    def test_update_step_order_num(self, client, recipe):
        token, recipe_id = recipe
        add_res = post_json(client, f'/api/v1/recipes/{recipe_id}/steps',
                            {'description': 'Paso reordenable'}, token=token)
        step_id = json.loads(add_res.data)['id']
        res = put_json(client, f'/api/v1/recipes/{recipe_id}/steps/{step_id}',
                       {'order_num': 99}, token)
        assert res.status_code == 200
        assert json.loads(res.data)['order_num'] == 99

    def test_delete_step(self, client, recipe):
        token, recipe_id = recipe
        add_res = post_json(client, f'/api/v1/recipes/{recipe_id}/steps',
                            {'description': 'Paso a eliminar'}, token=token)
        step_id = json.loads(add_res.data)['id']
        res = delete_json(client, f'/api/v1/recipes/{recipe_id}/steps/{step_id}', token)
        assert res.status_code == 204

    def test_add_step_missing_description_returns_400(self, client, recipe):
        token, recipe_id = recipe
        res = post_json(client, f'/api/v1/recipes/{recipe_id}/steps', {}, token=token)
        assert res.status_code == 400

    def test_add_step_to_nonexistent_recipe_returns_404(self, client, recipe):
        token, _ = recipe
        res = post_json(client, '/api/v1/recipes/00000000-0000-0000-0000-000000000000/steps',
                        {'description': 'Paso fantasma'}, token=token)
        assert res.status_code == 404

    def test_add_step_to_other_user_recipe_returns_403(self, client):
        token1 = register_and_login(client, 'step_owner@test.com')
        token2 = register_and_login(client, 'step_intruder@test.com')
        create_res = post_json(client, '/api/v1/recipes/', {'title': 'Receta propia'}, token=token1)
        recipe_id = json.loads(create_res.data)['id']
        res = post_json(client, f'/api/v1/recipes/{recipe_id}/steps',
                        {'description': 'Intruso'}, token=token2)
        assert res.status_code == 403

    def test_delete_step_from_other_user_recipe_returns_403(self, client):
        token1 = register_and_login(client, 'step_own2@test.com')
        token2 = register_and_login(client, 'step_int2@test.com')
        create_res = post_json(client, '/api/v1/recipes/', {'title': 'Receta mía'}, token=token1)
        recipe_id = json.loads(create_res.data)['id']
        add_res = post_json(client, f'/api/v1/recipes/{recipe_id}/steps',
                            {'description': 'Paso mío'}, token=token1)
        step_id = json.loads(add_res.data)['id']
        res = delete_json(client, f'/api/v1/recipes/{recipe_id}/steps/{step_id}', token2)
        assert res.status_code == 403

    def test_update_step_nonexistent_returns_404(self, client, recipe):
        token, recipe_id = recipe
        res = put_json(client, f'/api/v1/recipes/{recipe_id}/steps/00000000-0000-0000-0000-000000000000',
                       {'description': 'Nada'}, token)
        assert res.status_code == 404


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

    def test_update_custom_price(self, client):
        token = register_and_login(client, 'cpu@test.com')
        create_res = post_json(client, '/api/v1/prices', {
            'ingredient_name': 'aceite', 'price_per_kg': 4.00,
            'bought_qty': 1, 'bought_unit': 'l', 'bought_price': 4.00
        }, token=token)
        price_id = json.loads(create_res.data)['id']
        res = put_json(client, f'/api/v1/prices/{price_id}',
                       {'price_per_kg': 3.50}, token)
        assert res.status_code == 200
        assert json.loads(res.data)['price_per_kg'] == 3.50

    def test_create_duplicate_price_returns_409(self, client):
        token = register_and_login(client, 'cpdup@test.com')
        payload = {'ingredient_name': 'leche', 'price_per_kg': 1.20,
                   'bought_qty': 1, 'bought_unit': 'l', 'bought_price': 1.20}
        post_json(client, '/api/v1/prices', payload, token=token)
        res = post_json(client, '/api/v1/prices', payload, token=token)
        assert res.status_code == 409

    def test_create_price_without_price_data_returns_400(self, client):
        token = register_and_login(client, 'cp400@test.com')
        res = post_json(client, '/api/v1/prices',
                        {'ingredient_name': 'mantequilla'}, token=token)
        assert res.status_code == 400

    def test_delete_other_user_price_returns_404(self, client):
        token1 = register_and_login(client, 'cpowner@test.com')
        token2 = register_and_login(client, 'cpattacker@test.com')
        create_res = post_json(client, '/api/v1/prices', {
            'ingredient_name': 'crema', 'price_per_kg': 3.50,
            'bought_qty': 1, 'bought_unit': 'l', 'bought_price': 3.50
        }, token=token1)
        price_id = json.loads(create_res.data)['id']
        res = delete_json(client, f'/api/v1/prices/{price_id}', token2)
        assert res.status_code == 404

    def test_price_unit_conversion_grams_to_kg(self, client):
        token = register_and_login(client, 'conv@test.com')
        res = post_json(client, '/api/v1/prices', {
            'ingredient_name': 'harina',
            'bought_qty': 500, 'bought_unit': 'g', 'bought_price': 0.60
        }, token=token)
        assert res.status_code == 201
        assert json.loads(res.data)['price_per_kg'] == pytest.approx(1.20, rel=1e-3)


# ── Costs ─────────────────────────────────────────────────────────────────────

class TestCosts:

    @pytest.fixture
    def recipe_with_ingredient(self, client):
        token = register_and_login(client, 'costs@test.com')
        r = post_json(client, '/api/v1/recipes/', {'title': 'Receta Coste'}, token=token)
        recipe_id = json.loads(r.data)['id']
        i = post_json(client, f'/api/v1/recipes/{recipe_id}/ingredients',
                      {'name': 'harina', 'quantity': '500', 'unit': 'g'}, token=token)
        ing_id = json.loads(i.data)['id']
        return token, recipe_id, ing_id

    def test_get_recipe_cost_requires_auth(self, client):
        res = get_json(client, '/api/v1/recipes/fake-id/cost')
        assert res.status_code == 401

    def test_get_recipe_cost_returns_ingredients(self, client, recipe_with_ingredient):
        token, recipe_id, _ = recipe_with_ingredient
        res = get_json(client, f'/api/v1/recipes/{recipe_id}/cost', token=token)
        assert res.status_code == 200
        data = json.loads(res.data)
        assert 'ingredients' in data
        assert 'total_estimated_cost' in data
        assert len(data['ingredients']) == 1

    def test_get_recipe_cost_other_user_returns_403(self, client, recipe_with_ingredient):
        _, recipe_id, _ = recipe_with_ingredient
        token2 = register_and_login(client, 'costsattacker@test.com')
        res = get_json(client, f'/api/v1/recipes/{recipe_id}/cost', token=token2)
        assert res.status_code == 403

    def test_manual_price_set_reflected_in_cost(self, client, recipe_with_ingredient):
        token, recipe_id, ing_id = recipe_with_ingredient
        put_json(client, f'/api/v1/recipes/{recipe_id}/ingredients/{ing_id}/price',
                 {'price_per_kg': 99.99}, token)
        res = get_json(client, f'/api/v1/recipes/{recipe_id}/cost', token=token)
        data = json.loads(res.data)
        ing = data['ingredients'][0]
        assert ing['source'] == 'manual'
        assert ing['price_per_kg'] == 99.99

    def test_manual_price_clear_removes_override(self, client, recipe_with_ingredient):
        token, recipe_id, ing_id = recipe_with_ingredient
        put_json(client, f'/api/v1/recipes/{recipe_id}/ingredients/{ing_id}/price',
                 {'price_per_kg': 99.99}, token)
        client.delete(f'/api/v1/recipes/{recipe_id}/ingredients/{ing_id}/price',
                      headers={'Authorization': f'Bearer {token}'})
        res = get_json(client, f'/api/v1/recipes/{recipe_id}/cost', token=token)
        data = json.loads(res.data)
        ing = data['ingredients'][0]
        assert ing['source'] != 'manual'


# ── Health ─────────────────────────────────────────────────────────────────────

class TestHealth:

    def test_health_returns_200(self, client):
        res = client.get('/api/v1/health')
        assert res.status_code == 200

    def test_health_no_auth_required(self, client):
        res = client.get('/api/v1/health')
        data = json.loads(res.data)
        assert data.get('status') == 'ok'
