"""Plaintext storage contract; HTTP responses/tokens still must not expose passwords."""
import hashlib

import pytest

from phub_api.models.resources import public_columns
from phub_api.repositories.tables import clean
from phub_api.services.auth import password_matches, password_version


@pytest.mark.parametrize("password", ["normal-password", "  keep spaces  ", "Mật-khẩu-đơn-giản"])
def test_password_comparison_uses_original_text(password):
    assert password_matches(password, password)
    assert not password_matches(password + "x", password)
    assert not password_matches(password, None)
    assert not password_matches(password, 123)


def test_session_version_is_not_password_or_public_sha256(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "test-only-" + "x" * 64)
    password = "normal-password"
    original = password_version(password)
    assert password not in original
    assert original != hashlib.sha256(password.encode()).hexdigest()
    assert password_version(password + "x") != original
    monkeypatch.setenv("JWT_SECRET", "other-test-only-" + "y" * 64)
    assert password_version(password) != original


def test_both_current_and_legacy_credential_fields_are_private():
    assert {column["name"] for column in public_columns("accounts")}.isdisjoint({"mat_khau", "mat_khau_hash"})
    assert clean([{"ma_tk": "A", "mat_khau": "secret", "mat_khau_hash": "old-secret"}]) == [{"ma_tk": "A"}]
