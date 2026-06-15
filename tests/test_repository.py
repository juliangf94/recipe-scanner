import pytest
from app.persistence.repository import InMemoryStorage
from app.models.user import User


@pytest.fixture
def storage():
    return InMemoryStorage()


@pytest.fixture
def sample_user():
    return User(first_name='Ana', last_name='García',
                email='ana@test.com', password_hash='hashed')


class TestInMemoryStorage:

    def test_save_returns_the_object(self, storage, sample_user):
        result = storage.save(sample_user)
        assert result is sample_user

    def test_save_stores_object_retrievable_by_id(self, storage, sample_user):
        storage.save(sample_user)
        assert storage.get_by_id(sample_user.id) is sample_user

    def test_get_by_id_returns_none_for_unknown_id(self, storage):
        assert storage.get_by_id('nonexistent-id') is None

    def test_get_all_returns_empty_list_when_empty(self, storage):
        assert storage.get_all() == []

    def test_get_all_returns_all_saved_objects(self, storage):
        u1 = User(first_name='Ana', last_name='G', email='a@test.com', password_hash='h')
        u2 = User(first_name='Bob', last_name='S', email='b@test.com', password_hash='h')
        storage.save(u1)
        storage.save(u2)
        result = storage.get_all()
        assert len(result) == 2
        assert u1 in result
        assert u2 in result

    def test_update_overwrites_existing_object(self, storage, sample_user):
        storage.save(sample_user)
        sample_user.first_name = 'Updated'
        storage.update(sample_user)
        assert storage.get_by_id(sample_user.id).first_name == 'Updated'

    def test_delete_removes_object(self, storage, sample_user):
        storage.save(sample_user)
        storage.delete(sample_user.id)
        assert storage.get_by_id(sample_user.id) is None

    def test_delete_nonexistent_id_does_not_raise(self, storage):
        storage.delete('nonexistent-id')

    def test_get_by_attribute_finds_matching_object(self, storage, sample_user):
        storage.save(sample_user)
        result = storage.get_by_attribute('email', 'ana@test.com')
        assert result is sample_user

    def test_get_by_attribute_returns_none_when_not_found(self, storage):
        result = storage.get_by_attribute('email', 'notfound@test.com')
        assert result is None
