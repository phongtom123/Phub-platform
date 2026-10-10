"""Documentation must describe actual URLs, payload models, permissions and errors."""
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from openapi_spec_validator import validate
from jsonschema import Draft202012Validator

from app.api_examples import key_example, payload_example, row_example
from app.auth import User, current_user
from app.main import app
from app.resources import RESOURCES, SYSTEM_FIELDS, payload_model
from app.supabase import get_supabase
from app.tables import validate_combined


@pytest.fixture(scope="module")
def spec():
    return app.openapi()


def test_spec_is_valid_openapi_31(spec):
    validate(spec)
    assert spec["openapi"].startswith("3.1")


def test_doc_pages_work_without_a_database():
    with TestClient(app) as client:
        for path in ["/docs", "/redoc", "/openapi.json"]:
            assert client.get(path).status_code == 200
        html = client.get("/docs").text
        assert '"withCredentials": true' in html
        assert '"persistAuthorization": false' in html
        assert '"docExpansion": "none"' in html


def test_tables_have_concrete_paths_and_no_fake_workflows(spec):
    assert "/api/data/{resource}" not in spec["paths"]
    for name, resource in RESOURCES.items():
        methods = spec["paths"][f"/api/data/{name}"]
        assert set(methods) == ({"get", "post", "patch"} if resource.writable else {"get"})
        for operation in methods.values():
            assert operation["security"] == [{"SessionCookie": []}]
            assert operation["x-table"] == resource.table
            assert operation["x-primary-key"] == list(resource.keys)
            assert not any(p["in"] == "path" for p in operation.get("parameters", []))
    assert not any("delete" in path for path in spec["paths"].values())
    assert "/api/checkout" not in spec["paths"]
    assert spec["x-live-database-verified"] is False


def test_operation_ids_are_unique_and_tags_exist(spec):
    operations = [operation for path in spec["paths"].values() for operation in path.values()]
    identifiers = [operation["operationId"] for operation in operations]
    assert len(identifiers) == len(set(identifiers)) == 68
    tags = {tag["name"] for tag in spec["tags"]}
    for operation in operations:
        assert set(operation["tags"]).issubset(tags)


def test_order_filter_is_documented_only_for_related_tables(spec):
    for name in RESOURCES:
        params = spec["paths"][f"/api/data/{name}"]["get"]["parameters"]
        assert any(p["name"] == "order_id" for p in params) == (name in {"orders", "order-lines", "invoices", "payments", "voucher-uses"})


def test_all_local_references_resolve(spec):
    def walk(value):
        if isinstance(value, dict):
            if "$ref" in value:
                assert value["$ref"].startswith("#/")
                node = spec
                for part in value["$ref"][2:].split("/"):
                    node = node[part.replace("~1", "/").replace("~0", "~")]
            for child in value.values():
                walk(child)
        elif isinstance(value, list):
            for child in value:
                walk(child)
    walk(spec)


def test_cookie_auth_and_public_operations(spec):
    cookie = spec["components"]["securitySchemes"]["SessionCookie"]
    assert (cookie["type"], cookie["in"], cookie["name"]) == ("apiKey", "cookie", "phub_session")
    assert spec["paths"]["/api/auth/me"]["get"]["security"] == [{"SessionCookie": []}]
    for path in ["/api/auth/login", "/api/auth/logout", "/api/health", "/api/products", "/api/catalog/products"]:
        for operation in spec["paths"][path].values():
            assert operation["security"] == []
    login = spec["paths"]["/api/auth/login"]["post"]
    assert "Set-Cookie" in login["responses"]["200"]["headers"]
    assert "429" in login["responses"]
    assert spec["components"]["schemas"]["LoginBody"]["properties"]["password"]["writeOnly"]
    assert "content" not in spec["paths"]["/api/auth/logout"]["post"]["responses"]["204"]


@pytest.mark.parametrize("name", RESOURCES)
def test_row_examples_match_schema_and_no_hashes(spec, name):
    component = spec["components"]["schemas"][RESOURCES[name].table + "Read"]
    Draft202012Validator(component).validate(row_example(name))
    assert "mat_khau_hash" not in component["properties"]
    assert "password" not in component["properties"]


@pytest.mark.parametrize("name", [name for name, r in RESOURCES.items() if r.writable])
@pytest.mark.parametrize("patch", [False, True])
def test_payload_examples_use_the_runtime_models(spec, name, patch):
    model = payload_model(name, patch)
    example = payload_example(name, patch)
    validated = model.model_validate(example).model_dump(mode="json", exclude_unset=patch)
    component = spec["components"]["schemas"][model.__name__]
    Draft202012Validator(component).validate(example)
    validate_combined(name, {**row_example(name), **validated}, User("TK001", "example.admin", "ADMIN", "Example", employee_id="NV001"))
    assert set(model.model_fields) == set(component["properties"])
    assert component["additionalProperties"] is False
    assert all(field not in component["properties"] for field in SYSTEM_FIELDS.get(name, set()))
    if patch:
        assert component["minProperties"] == 1
        assert not any(key in component["properties"] for key in RESOURCES[name].keys)


def test_money_and_password_contracts(spec):
    schema = spec["components"]["schemas"]
    assert schema["SAN_PHAMRead"]["properties"]["gia_ban_hien_tai"]["type"] == "string"
    assert "sku" not in schema["SAN_PHAMUpdate"]["properties"]
    assert schema["AccountCreate"]["properties"]["password"]["writeOnly"]
    assert "password" in schema["AccountCreate"]["required"]
    assert "ma_tk" not in schema["NewAccountCreate"]["properties"]
    assert schema["NewAccountCreate"]["properties"]["password"]["writeOnly"]
    assert "password" not in schema["AccountUpdate"]["properties"]


def test_permissions_and_errors_are_documented(spec):
    for name, resource in RESOURCES.items():
        for method, operation in spec["paths"]["/api/data/" + name].items():
            assert {"401", "403", "422", "503"}.issubset(operation["responses"])
            if method != "get":
                assert "409" in operation["responses"]
                assert any(p["name"] == "Origin" and p["required"] for p in operation["parameters"])
                assert operation["x-roles"] == (["ADMIN", "THU_KHO"] if name == "suppliers" else ["ADMIN"])
            if method == "patch":
                assert "404" in operation["responses"]
            if name == "accounts":
                assert operation["x-roles"] == ["ADMIN"]
    assert "KHACH_HANG" in spec["paths"]["/api/data/orders"]["get"]["x-roles"]
    assert "THU_KHO" in spec["paths"]["/api/data/inventory"]["get"]["x-roles"]
    error = spec["paths"]["/api/catalog/products"]["get"]["responses"]["422"]
    assert "error" in error["content"]["application/json"]["example"]


@pytest.mark.parametrize("name", RESOURCES)
def test_documented_get_paths_reach_actual_generic_router(name):
    from types import SimpleNamespace
    class Database:
        def table(self, table):
            assert table == RESOURCES[name].table
            return self
        def __getattr__(self, attr):
            if attr == "execute":
                return lambda: SimpleNamespace(data=[row_example(name)], count=1)
            return lambda *args, **kwargs: self
    app.dependency_overrides[current_user] = lambda: User("TK001", "example.admin", "ADMIN", "Example", employee_id="NV001")
    app.dependency_overrides[get_supabase] = lambda: Database()
    try:
        with TestClient(app) as client:
            response = client.get("/api/data/" + name, params={"key": json.dumps(key_example(name))})
        assert response.status_code == 200
        assert response.json()["data"] == [row_example(name)]
    finally:
        app.dependency_overrides.clear()


def test_versioned_snapshot_has_no_drift_or_real_secrets(spec):
    path = Path(__file__).resolve().parents[1] / "docs" / "openapi.json"
    assert json.loads(path.read_text(encoding="utf-8")) == spec
    serialized = json.dumps(spec)
    assert "sb_secret_" not in serialized
    assert "mat_khau_hash" not in spec["components"]["schemas"]["TAI_KHOANRead"]["properties"]


def test_swagger_origins_remain_explicit(monkeypatch):
    from fastapi import HTTPException
    from starlette.requests import Request
    from app.auth import check_origin
    monkeypatch.delenv("FRONTEND_ORIGINS", raising=False)
    for origin in ["http://localhost:8000", "http://127.0.0.1:8000"]:
        check_origin(Request({"type": "http", "headers": [(b"origin", origin.encode())]}))
    with pytest.raises(HTTPException) as error:
        check_origin(Request({"type": "http", "headers": [(b"origin", b"https://evil.example")]}))
    assert error.value.status_code == 403
    monkeypatch.setenv("FRONTEND_ORIGINS", "https://shop.example")
    with pytest.raises(HTTPException):
        check_origin(Request({"type": "http", "headers": [(b"origin", b"http://localhost:8000")]}))


def test_export_cli_saves_valid_utf8_and_checks_snapshot(tmp_path):
    import subprocess
    import sys
    script = Path(__file__).resolve().parents[1] / "scripts" / "export_openapi.py"
    output = tmp_path / "exported" / "openapi.json"
    result = subprocess.run([sys.executable, str(script), "--output", str(output)], capture_output=True, check=False)
    assert result.returncode == 0, result.stderr
    assert not output.read_bytes().startswith(b"\xef\xbb\xbf")
    assert json.loads(output.read_text(encoding="utf-8")) == app.openapi()
    result = subprocess.run([sys.executable, str(script), "--check"], capture_output=True, check=False)
    assert result.returncode == 0, result.stderr
