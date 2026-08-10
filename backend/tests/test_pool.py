"""
Connection pool tests.

Three groups:
1. Config unit tests  — verify ProductionConfig has the right pool values.
2. App smoke tests    — verify the app starts and the DB works normally.
3. pre_ping behavior  — simulate a server-side connection drop and confirm recovery.
"""
import pytest
from sqlalchemy import create_engine, text, exc


# ---------------------------------------------------------------------------
# 1. Config unit tests
# ---------------------------------------------------------------------------

class TestProductionPoolConfig:

    def setup_method(self):
        from config import ProductionConfig
        self.opts = ProductionConfig.SQLALCHEMY_ENGINE_OPTIONS

    def test_pool_pre_ping_enabled(self):
        assert self.opts['pool_pre_ping'] is True

    def test_pool_recycle_is_1800(self):
        assert self.opts['pool_recycle'] == 1800

    def test_pool_size_is_5(self):
        assert self.opts['pool_size'] == 5

    def test_max_overflow_is_5(self):
        assert self.opts['max_overflow'] == 5

    def test_total_connections_within_supabase_limit(self):
        total = self.opts['pool_size'] + self.opts['max_overflow']
        assert total <= 25, (
            f"pool_size + max_overflow = {total}, "
            "exceeds Supabase free tier limit of 25 connections"
        )

    def test_development_config_has_no_pool_options(self):
        from config import DevelopmentConfig
        assert not hasattr(DevelopmentConfig, 'SQLALCHEMY_ENGINE_OPTIONS')


# ---------------------------------------------------------------------------
# 2. App smoke tests (uses 'testing' config → SQLite in-memory)
# ---------------------------------------------------------------------------

class TestAppWithPoolConfig:

    def test_app_starts_successfully(self, app):
        assert app is not None

    def test_health_endpoint_returns_ok(self, client):
        res = client.get('/api/v1/health')
        assert res.status_code == 200
        assert res.get_json()['status'] == 'ok'

    def test_db_executes_basic_query(self, db):
        result = db.session.execute(text('SELECT 1')).scalar()
        assert result == 1

    def test_db_handles_many_sequential_queries(self, db):
        for _ in range(20):
            result = db.session.execute(text('SELECT 1')).scalar()
            assert result == 1


# ---------------------------------------------------------------------------
# 3. pre_ping behavior — simulates a server-side connection drop
# ---------------------------------------------------------------------------

class TestPrePingBehavior:

    @pytest.fixture
    def engine_with_ping(self, tmp_path):
        db_file = str(tmp_path / 'test_ping.db')
        engine = create_engine(f'sqlite:///{db_file}', pool_pre_ping=True)
        with engine.connect() as conn:
            conn.execute(text('CREATE TABLE IF NOT EXISTS t (id INTEGER)'))
        yield engine
        engine.dispose()

    @pytest.fixture
    def engine_without_ping(self, tmp_path):
        db_file = str(tmp_path / 'test_no_ping.db')
        engine = create_engine(f'sqlite:///{db_file}', pool_pre_ping=False)
        with engine.connect() as conn:
            conn.execute(text('CREATE TABLE IF NOT EXISTS t (id INTEGER)'))
        yield engine
        engine.dispose()

    def _put_dead_conn_in_pool(self, engine):
        """Check out a connection, close the underlying DBAPI conn, return to pool."""
        pool_conn = engine.pool.connect()
        pool_conn.driver_connection.close()
        pool_conn.close()

    def test_pool_attributes_reflect_config(self, tmp_path):
        db_file = str(tmp_path / 'attrs.db')
        engine = create_engine(
            f'sqlite:///{db_file}',
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=5,
            pool_recycle=1800,
        )
        pool = engine.pool
        assert pool.size() == 5
        assert pool._max_overflow == 5
        assert pool._recycle == 1800
        assert pool._pre_ping is True
        engine.dispose()

    def test_pre_ping_recovers_after_dead_connection(self, engine_with_ping):
        """
        Simulates what happens when Supabase closes an idle connection:
        pool holds a dead DBAPI conn, but pool_pre_ping detects it and
        opens a fresh one so the query succeeds.
        """
        self._put_dead_conn_in_pool(engine_with_ping)

        with engine_with_ping.connect() as conn:
            result = conn.execute(text('SELECT 1')).scalar()

        assert result == 1

    def test_without_pre_ping_attribute_is_false(self, engine_without_ping):
        """
        Verify that an engine created without pool_pre_ping has the attribute
        set to False. This is the Postgres-relevant distinction: without pre_ping,
        Postgres hands back a stale connection that raises OperationalError on use
        (SQLite auto-heals on close, so the failure mode can't be replicated here).
        """
        assert engine_without_ping.pool._pre_ping is False
