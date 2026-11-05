"""Offline preparation tooling tests; install requirements-migration.txt to run."""
import importlib.util
from pathlib import Path

import pytest

pytest.importorskip("pwdlib")
from pwdlib import PasswordHash

MODULE = Path(__file__).resolve().parents[1] / "scripts/prepare_plaintext_password_migration.py"
spec = importlib.util.spec_from_file_location("password_migration_preparation", MODULE)
preparation = importlib.util.module_from_spec(spec)
spec.loader.exec_module(preparation)


@pytest.fixture
def snapshot():
    return {"accounts": [{"ma_tk": "AD1", "ten_tai_khoan": "admin", "email": "admin@example.test",
                          "mat_khau_hash": PasswordHash.recommended().hash("  preserved-password  ")},
                         {"ma_tk": "KH1", "ten_tai_khoan": "customer", "email": None,
                          "mat_khau_hash": "!DISABLED_LOGIN"}]}


def test_preservation_verifies_supplied_password_and_keeps_spaces(snapshot):
    result = preparation.preservation_rows(snapshot, {"ADMIN@EXAMPLE.TEST": "  preserved-password  "})
    assert result == [{"ma_tk": "AD1", "mat_khau": "  preserved-password  ", "expected_hash": snapshot["accounts"][0]["mat_khau_hash"]}]


@pytest.mark.parametrize("known", [{}, {"admin": "wrong-password"}, {"missing": "wrong-password"},
                                  {"customer": "wrong-password"}, {"admin": "short"}])
def test_invalid_preservation_is_rejected_without_echoing_password(snapshot, known):
    with pytest.raises(ValueError) as error:
        preparation.preservation_rows(snapshot, known)
    assert all(password not in str(error.value) for password in known.values())
    assert "$argon2" not in str(error.value)


def test_generated_input_is_inside_transaction_and_checks_complete_snapshot(snapshot):
    migration = "begin;\n" + preparation.MARKER + "\ncommit;\n"
    sql, rows = preparation.render_cutover(migration, snapshot, {"admin": "  preserved-password  "})
    assert sql.index("begin;") < sql.index("insert into pg_temp.phub_password_preservation") < sql.index("commit;")
    assert sql.count("insert into pg_temp.phub_password_source_snapshot") == 2
    assert "set local phub.allow_plaintext_password_reset" in sql
    assert len(rows) == 1


def test_sql_quoting_preserves_literal_input_and_rejects_nul():
    assert preparation.sql_text("quote' slash\\") == "'quote'' slash\\'"
    with pytest.raises(ValueError):
        preparation.sql_text("bad\x00value")
