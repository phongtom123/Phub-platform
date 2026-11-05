from pathlib import Path

import pytest

from phub_api.config.environment import BACKEND_DIR, ENV_FILE, ENV_EXAMPLE_FILE, ensure_env_file


def test_ensure_env_file_copies_example_when_missing(tmp_path):
    example = tmp_path / ".env.example"
    env_file = tmp_path / ".env"
    example.write_text("SUPABASE_URL=example\n", encoding="utf-8")

    assert ensure_env_file(env_file, example) is True
    assert env_file.read_text(encoding="utf-8") == "SUPABASE_URL=example\n"


def test_ensure_env_file_never_overwrites_existing_env(tmp_path):
    example = tmp_path / ".env.example"
    env_file = tmp_path / ".env"
    example.write_text("SUPABASE_URL=example\n", encoding="utf-8")
    env_file.write_text("SUPABASE_URL=real\n", encoding="utf-8")

    assert ensure_env_file(env_file, example) is False
    assert env_file.read_text(encoding="utf-8") == "SUPABASE_URL=real\n"


def test_environment_paths_still_target_backend_after_package_move():
    assert BACKEND_DIR == Path(__file__).resolve().parents[1]
    assert ENV_FILE == BACKEND_DIR / ".env"
    assert ENV_EXAMPLE_FILE == BACKEND_DIR / ".env.example"


def test_missing_template_does_not_create_an_env_file(tmp_path):
    env_file = tmp_path / ".env"
    with pytest.raises(RuntimeError, match="Không tìm thấy file mẫu"):
        ensure_env_file(env_file, tmp_path / "missing.example")
    assert not env_file.exists()
