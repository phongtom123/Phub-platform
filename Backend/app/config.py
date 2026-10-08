from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
ENV_FILE = BACKEND_DIR / ".env"
ENV_EXAMPLE_FILE = BACKEND_DIR / ".env.example"


def ensure_env_file(
    env_file: Path = ENV_FILE,
    env_example_file: Path = ENV_EXAMPLE_FILE,
) -> bool:
    """Create .env from .env.example once, without overwriting existing values."""
    if env_file.exists():
        return False

    if not env_example_file.is_file():
        raise RuntimeError(f"Không tìm thấy file mẫu: {env_example_file}")

    try:
        with env_file.open("x", encoding="utf-8", newline="") as target:
            target.write(env_example_file.read_text(encoding="utf-8"))
    except FileExistsError:
        # Another worker may have created the file during application startup.
        return False

    return True
