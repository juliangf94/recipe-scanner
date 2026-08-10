import pytest
from app import create_app
from app.extensions import db as _db


@pytest.fixture(scope='session')
def app():
    application = create_app('testing')
    with application.app_context():
        _db.create_all()
        yield application


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def db(app):
    with app.app_context():
        yield _db
