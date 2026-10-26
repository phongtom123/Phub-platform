"""Read-only smoke check for real local/Render deployments; no DB writes/login."""
import argparse
from urllib.parse import urlsplit

import httpx


def origin(value):
    parsed = urlsplit(value)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in {"", "/"}:
        raise argparse.ArgumentTypeError("Provide an HTTP(S) origin without credentials or path")
    return value.rstrip("/")


def check(api: str, ui: str, auth_pending: bool):
    with httpx.Client(timeout=60, follow_redirects=False) as client:
        for base in (api, ui):
            response = client.get(base + "/api/health")
            assert response.status_code == 200 and response.json() == {"status": "ok"}, "Health check failed"
        schema = client.get(api + "/openapi.json")
        assert schema.status_code == 200
        paths = schema.json()["paths"]
        assert {"/api/catalog/products", "/api/orders", "/api/customer/me", "/api/customer/checkout/quote", "/api/customer/orders", "/api/orders/{order_id}/payments", "/api/orders/{order_id}/transactions", "/api/health"}.issubset(paths)
        assert not any(path.startswith(("/__manual", "/__e2e")) for path in paths)
        for path in ("/__manual", "/__e2e/state"):
            assert client.get(api + path).status_code == 404, "Fixture controls must not exist in production"
        for base in (api, ui):
            response = client.get(base + "/api/catalog/products", params={"page_size": 1})
            assert response.status_code == 200, "Catalog could not read the database"
            assert isinstance(response.json()["items"], list)
            invalid = client.get(base + "/api/catalog/products", params={"page": 0})
            assert invalid.status_code == 422 and invalid.json()["error"]["code"] == "VALIDATION_ERROR", "Catalog validation failed"
            profile = client.get(base + "/api/customer/me")
            expected = 503 if auth_pending else 401
            assert profile.status_code == expected, "Unexpected guest authentication behavior"
            if auth_pending:
                assert profile.json()["error"]["code"] == "AUTH_INTEGRATION_REQUIRED"
        print("PASS: UI/API health, Swagger, real catalog/proxy, validation, guest access and no fixture routes")
        if auth_pending:
            print("Auth handoff still pending; this does not certify real checkout or migrations.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api", type=origin, required=True)
    parser.add_argument("--ui", type=origin, required=True)
    parser.add_argument("--auth-pending", action="store_true")
    args = parser.parse_args()
    check(args.api, args.ui, args.auth_pending)
