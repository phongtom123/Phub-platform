"""Executable layer boundaries: fail before the project drifts back into mixed layers."""
import ast
from importlib import import_module
from pathlib import Path

import pytest

PACKAGE = Path(__file__).resolve().parents[1] / "phub_api"


def imports(tree):
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom):
            yield node.module or "", {alias.name for alias in node.names}
        elif isinstance(node, ast.Import):
            for alias in node.names:
                yield alias.name, set()


def test_backend_has_no_legacy_app_package_or_imports():
    backend = PACKAGE.parent
    assert not (backend / "app").exists(), "Backend uses phub_api only; remove legacy app source/cache."
    for directory in (PACKAGE, backend / "scripts", backend / "tests"):
        for path in directory.rglob("*.py"):
            for module, _ in imports(ast.parse(path.read_text(encoding="utf-8-sig"))):
                assert module != "app" and not module.startswith("app."), f"{path}: import from phub_api, not app"


def test_real_customer_launcher_uses_phub_api_entrypoint():
    launcher = (PACKAGE.parent.parent / "scripts" / "start-customer.ps1").read_text(encoding="utf-8-sig")
    assert "$taskApp = 'phub_api.main:app'" in launcher
    assert "$taskApp = 'app.main:app'" not in launcher


BOUNDARIES = {
    "controllers": {"repositories", "controllers"},
    "services": {"controllers", "dependencies", "middleware"},
    "repositories": {"controllers", "services", "dependencies", "middleware"},
    "models": {"controllers", "services", "repositories", "dependencies", "middleware", "schemas"},
    "schemas": {"controllers", "services", "repositories", "dependencies", "middleware"},
}
FILES = [path for layer in BOUNDARIES for path in sorted((PACKAGE / layer).glob("*.py"))]


@pytest.mark.parametrize("path", FILES, ids=lambda path: str(path.relative_to(PACKAGE)))
def test_dependencies_follow_the_layer_direction(path):
    layer = path.parent.name
    tree = ast.parse(path.read_text(encoding="utf-8-sig"))
    for module, names in imports(tree):
        parts = module.split(".")
        if len(parts) > 1 and parts[0] == "phub_api":
            assert parts[1] not in BOUNDARIES[layer], f"{path.name}: {layer} must not import {module}"
        if layer in {"controllers", "services", "models", "schemas"}:
            assert module != "phub_api.config.database", f"{path.name}: inject a service/repository through dependencies"
            assert not module.startswith("supabase"), f"{path.name}: Supabase clients belong to repositories/config"
        if layer in {"services", "repositories"} and module in {"fastapi", "starlette.requests", "starlette.responses"}:
            assert not names.intersection({"Request", "Response", "Depends", "APIRouter"}), f"{path.name}: HTTP transport belongs to controllers"


@pytest.mark.parametrize("layer", ["controllers", "services", "dependencies", "models", "schemas"])
def test_database_and_storage_io_exist_only_in_repositories(layer):
    forbidden = {"table", "from_", "rpc", "execute"}
    for path in (PACKAGE / layer).glob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8-sig"))
        for node in ast.walk(tree):
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
                assert node.func.attr not in forbidden, f"{path.name}:{node.lineno}: move .{node.func.attr}() into a repository"
            if isinstance(node, ast.Attribute):
                assert node.attr != "storage", f"{path.name}:{node.lineno}: Storage access belongs to MediaRepository"


def test_routers_live_in_controllers_without_a_duplicate_api_package():
    from fastapi.routing import APIRoute

    assert not list((PACKAGE / "api").glob("*.py"))
    # Inspect APIRouter directly: FastAPI may lazily include routers on the app.
    routers = [getattr(import_module(f"phub_api.controllers.{path.stem}"), "router", None)
               for path in (PACKAGE / "controllers").glob("*.py") if path.stem != "__init__"]
    assert routers and all(router is not None for router in routers)
    routes = [route for router in routers for route in router.routes if isinstance(route, APIRoute)]
    assert routes
    for route in routes:
        assert route.endpoint.__module__.startswith("phub_api.controllers."), route.path


def test_dynamic_request_models_live_in_schemas_not_domain_models():
    from phub_api.models import resources
    from phub_api.schemas.resources import payload_model

    assert not hasattr(resources, "payload_model")
    assert payload_model("warehouses", False).__name__ == "KHOCreate"
