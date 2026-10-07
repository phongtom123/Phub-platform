"""Deployment settings; preserves the existing localhost CORS default."""
import os
from urllib.parse import urlsplit


def frontend_origins() -> list[str]:
    raw = os.getenv("FRONTEND_ORIGINS", os.getenv("FRONTEND_URL", "http://localhost:3000"))
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
