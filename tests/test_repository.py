import pytest
from app.persistence.repository import InMemoryStorage
from app.persistence.db_storage import DbStorage
from app.extensions import db
from app.models.user import User
from app.models.recipe import Recipe


# ── InMemoryStorage ──────────────────────────────────────────────────────────
# InMemoryStorage is a generic dict-backed store — tested with plain objects
# that just need an .id attribute (no DB involved).

class _Obj:
    """Minimal object with an id field — used only in InMemoryStorage tests."""
    def __init__(self, obj_id, value):
        self.id = obj_id
        self.value = value


class TestInMemoryStorage:

    @pytest.fixture
    def storage(self):
        return InMemoryStorage()

    @pytest.fixture
    def obj(self):
        return _Obj('id-1', 'hello')

    def test_save_returns_the_object(self, storage, obj):
        assert storage.save(obj) is obj

    def test_save_makes_object_retrievable(self, storage, obj):
        storage.save(obj)
        assert storage.get_by_id('id-1') is obj

    def test_get_by_id_unknown_returns_none(self, storage):
        assert storage.get_by_id('nope') is None

    def test_get_all_empty(self, storage):
        assert storage.get_all() == []

    def test_get_all_returns_all(self, storage):
        a = _Obj('a', 1)
        b = _Obj('b', 2)
        storage.save(a)
        storage.save(b)
        result = storage.get_all()
        assert len(result) == 2
        assert a in result and b in result

    def test_update_overwrites(self, storage, obj):
        storage.save(obj)
        obj.value = 'updated'
        storage.update(obj)
        assert storage.get_by_id('id-1').value == 'updated'

    def test_delete_removes_object(self, storage, obj):
        storage.save(obj)
        storage.delete('id-1')
        assert storage.get_by_id('id-1') is None

    def test_delete_nonexistent_does_not_raise(self, storage):
        storage.delete('ghost-id')

    def test_get_by_attribute_finds_match(self, storage):
        a = _Obj('a', 'foo')
        b = _Obj('b', 'bar')
        storage.save(a)
        storage.save(b)
        assert storage.get_by_attribute('value', 'bar') is b

    def test_get_by_attribute_returns_none_when_not_found(self, storage):
        assert storage.get_by_attribute('value', 'missing') is None


# ── DbStorage ────────────────────────────────────────────────────────────────

class TestDbStorage:

    def _make_user(self, email='db@test.com'):
        u = User(first_name='DB', last_name='Test', email=email, password_hash='hashed')
        return u

    def test_save_and_get_by_id(self, app):
        with app.app_context():
            storage = DbStorage(User)
            u = self._make_user()
            storage.save(u)
            found = storage.get_by_id(u.id)
            assert found.email == 'db@test.com'

    def test_get_by_id_unknown_returns_none(self, app):
        with app.app_context():
            storage = DbStorage(User)
            assert storage.get_by_id('no-such-id') is None

    def test_get_all_returns_saved_objects(self, app):
        with app.app_context():
            storage = DbStorage(User)
            u1 = self._make_user('u1@test.com')
            u2 = self._make_user('u2@test.com')
            storage.save(u1)
            storage.save(u2)
            all_users = storage.get_all()
            emails = [u.email for u in all_users]
            assert 'u1@test.com' in emails
            assert 'u2@test.com' in emails

    def test_get_by_attribute_finds_match(self, app):
        with app.app_context():
            storage = DbStorage(User)
            u = self._make_user('attr@test.com')
            storage.save(u)
            found = storage.get_by_attribute('email', 'attr@test.com')
            assert found.id == u.id

    def test_get_by_attribute_returns_none_when_not_found(self, app):
        with app.app_context():
            storage = DbStorage(User)
            assert storage.get_by_attribute('email', 'ghost@test.com') is None

    def test_update_persists_changes(self, app):
        with app.app_context():
            storage = DbStorage(User)
            u = self._make_user('upd@test.com')
            storage.save(u)
            u.first_name = 'Updated'
            storage.update(u)
            found = storage.get_by_id(u.id)
            assert found.first_name == 'Updated'

    def test_delete_removes_object(self, app):
        with app.app_context():
            storage = DbStorage(User)
            u = self._make_user('del@test.com')
            storage.save(u)
            storage.delete(u.id)
            assert storage.get_by_id(u.id) is None
