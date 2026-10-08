from app.config import ensure_env_file


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
