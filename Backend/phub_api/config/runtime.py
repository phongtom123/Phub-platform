from urllib.parse import urlsplit
import os


DEFAULT_FRONTEND_ORIGINS = ",".join([
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://localhost:8000",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:3002",
    "http://127.0.0.1:8000",
])


def frontend_origins() -> list[str]:
    raw = os.getenv("FRONTEND_ORIGINS", os.getenv("FRONTEND_URL", DEFAULT_FRONTEND_ORIGINS))
    origins = []
    for value in raw.split(","):
        value = value.strip()
        try:
            parsed = urlsplit(value)
            _ = parsed.port
            if (
                not value or any(char.isspace() for char in value)
                or parsed.scheme not in {"http", "https"} or not parsed.hostname
                or "*" in value or parsed.username is not None or parsed.password is not None
                or parsed.path not in {"", "/"} or parsed.query or parsed.fragment
            ):
                raise ValueError
        except ValueError:
            raise RuntimeError("FRONTEND_ORIGINS/FRONTEND_URL phải là origin HTTP(S), phân cách bằng dấu phẩy.") from None
        origin = f"{parsed.scheme}://{parsed.netloc}"
        if origin not in origins:
            origins.append(origin)
    return origins
