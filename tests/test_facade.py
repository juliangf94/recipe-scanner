"""
Unit tests for RecipeScannerFacade methods that are not exercised through
the HTTP layer (test_api.py).  Uses the same `app` fixture from conftest.py
so the app context and DB cleanup (autouse clean_db) are inherited.
"""
import sys
import os
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app.extensions import db
from app.models.user import User
from app.services.facade import facade


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_user(email, first_name='Test', last_name='User'):
    u = User(first_name=first_name, last_name=last_name,
             email=email, password_hash='hashed')
    db.session.add(u)
    db.session.commit()
    return u


# ── get_brand_by_name_and_ingredient ─────────────────────────────────────────

class TestGetBrandByNameAndIngredient:
    """
    Covers the exact-match semantics of facade.get_brand_by_name_and_ingredient.
    The deduplication key is (user_id, name, ingredient_name).
    """

    def test_finds_brand_by_name_and_ingredient(self, app):
        """Returns a brand when name AND ingredient_name match exactly."""
        with app.app_context():
            u = _make_user('fbni1@test.com')
            facade.create_brand(u.id, 'Hacendado', ingredient_name='leche')
            result = facade.get_brand_by_name_and_ingredient(u.id, 'Hacendado', 'leche')
            assert result is not None
            assert result.name == 'Hacendado'
            assert result.ingredient_name == 'leche'

    def test_returns_none_when_ingredient_does_not_match(self, app):
        """Returns None when the name matches but ingredient_name is different."""
        with app.app_context():
            u = _make_user('fbni2@test.com')
            facade.create_brand(u.id, 'Hacendado', ingredient_name='leche')
            result = facade.get_brand_by_name_and_ingredient(u.id, 'Hacendado', 'mantequilla')
            assert result is None

    def test_returns_none_when_name_does_not_match(self, app):
        """Returns None when ingredient matches but brand name is different."""
        with app.app_context():
            u = _make_user('fbni3@test.com')
            facade.create_brand(u.id, 'Dia', ingredient_name='yogur')
            result = facade.get_brand_by_name_and_ingredient(u.id, 'OtraMarca', 'yogur')
            assert result is None

    def test_returns_none_when_combination_does_not_exist(self, app):
        """Returns None when neither name+ingredient combination is stored."""
        with app.app_context():
            u = _make_user('fbni4@test.com')
            result = facade.get_brand_by_name_and_ingredient(u.id, 'Inexistente', 'algo')
            assert result is None

    def test_finds_generic_brand_with_none_ingredient(self, app):
        """Returns a generic brand (ingredient_name=None) when queried with None."""
        with app.app_context():
            u = _make_user('fbni5@test.com')
            facade.create_brand(u.id, 'Lidl', ingredient_name=None)
            result = facade.get_brand_by_name_and_ingredient(u.id, 'Lidl', None)
            assert result is not None
            assert result.name == 'Lidl'
            assert result.ingredient_name is None

    def test_specific_ingredient_brand_not_found_when_searching_generic(self, app):
        """
        A brand stored with ingredient_name='mantequilla' must NOT be returned
        when the caller searches with ingredient_name=None.
        """
        with app.app_context():
            u = _make_user('fbni6@test.com')
            facade.create_brand(u.id, 'Carrefour', ingredient_name='mantequilla')
            result = facade.get_brand_by_name_and_ingredient(u.id, 'Carrefour', None)
            assert result is None

    def test_generic_brand_not_returned_when_searching_with_ingredient(self, app):
        """
        A brand stored with ingredient_name=None must NOT be returned when the
        caller searches for a specific ingredient.
        """
        with app.app_context():
            u = _make_user('fbni7@test.com')
            facade.create_brand(u.id, 'Mercadona', ingredient_name=None)
            result = facade.get_brand_by_name_and_ingredient(u.id, 'Mercadona', 'leche')
            assert result is None

    def test_lookup_is_case_insensitive_for_name(self, app):
        """Brand name matching must be case-insensitive."""
        with app.app_context():
            u = _make_user('fbni8@test.com')
            facade.create_brand(u.id, 'Hacendado', ingredient_name='leche')
            result = facade.get_brand_by_name_and_ingredient(u.id, 'hacendado', 'leche')
            assert result is not None

    def test_query_is_case_insensitive_for_ingredient(self, app):
        """
        The SEARCH query for ingredient_name is normalised to lowercase inside the
        function, so passing 'Leche' as the search term finds a brand stored as 'leche'
        (the API always stores lowercase — this mirrors that flow).
        """
        with app.app_context():
            u = _make_user('fbni9@test.com')
            # Store lowercase (as the API does via strip().lower())
            facade.create_brand(u.id, 'Dia', ingredient_name='leche')
            # Search with uppercase — the function normalises the query
            result = facade.get_brand_by_name_and_ingredient(u.id, 'Dia', 'Leche')
            assert result is not None

    def test_known_bug_stored_ingredient_mixed_case_not_found(self, app):
        """
        BUG REPORT: get_brand_by_name_and_ingredient does NOT normalise the
        *stored* ingredient_name before comparing.  When a brand is created
        via the facade directly (bypassing the API, which normalises to lowercase),
        a mixed-case stored value is NOT found by a lowercase query.

        The name comparison (`b.name.lower()`) IS case-insensitive; the
        ingredient_name comparison (`(b.ingredient_name or None) == ing_lower`)
        is NOT — so the two halves are inconsistent.

        Through the API this never surfaces because the API normalises
        ingredient_name to lowercase before calling create_brand.  It would
        affect any caller that uses the facade directly with a mixed-case value.

        Fix: change the comparison to
            `(b.ingredient_name or '').lower() == (ing_lower or '')`
        inside get_brand_by_name_and_ingredient in facade.py.
        """
        with app.app_context():
            u = _make_user('fbni9b@test.com')
            # Stored with capital L — impossible via API, possible via direct facade call
            facade.create_brand(u.id, 'Dia', ingredient_name='Leche')
            result = facade.get_brand_by_name_and_ingredient(u.id, 'Dia', 'leche')
            # This assertion documents the current (buggy) behaviour:
            # a mixed-case stored value is NOT found.  Change to `is not None`
            # once the bug is fixed.
            assert result is None, (
                "Bug confirmed: stored ingredient_name 'Leche' is not matched "
                "by query 'leche' because the comparison is not normalised."
            )

    def test_two_brands_same_name_different_ingredient_both_findable(self, app):
        """
        When two brands share a name but differ in ingredient_name, each must
        be independently findable.
        """
        with app.app_context():
            u = _make_user('fbni10@test.com')
            b1 = facade.create_brand(u.id, 'Natura', ingredient_name='leche')
            b2 = facade.create_brand(u.id, 'Natura', ingredient_name='mantequilla')

            found_leche = facade.get_brand_by_name_and_ingredient(u.id, 'Natura', 'leche')
            found_mant = facade.get_brand_by_name_and_ingredient(u.id, 'Natura', 'mantequilla')

            assert found_leche is not None and found_leche.id == b1.id
            assert found_mant is not None and found_mant.id == b2.id

    def test_does_not_cross_users(self, app):
        """A brand belonging to user A must not be found when querying user B."""
        with app.app_context():
            u1 = _make_user('fbni11a@test.com')
            u2 = _make_user('fbni11b@test.com')
            facade.create_brand(u1.id, 'Aldi', ingredient_name='sal')
            result = facade.get_brand_by_name_and_ingredient(u2.id, 'Aldi', 'sal')
            assert result is None
