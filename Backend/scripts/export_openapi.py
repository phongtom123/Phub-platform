r"""Print the credential-free OpenAPI spec, or check the versioned snapshot.

From Backend:
  .venv\Scripts\python.exe scripts/export_openapi.py
  .venv\Scripts\python.exe scripts/export_openapi.py --output docs/openapi.json
  .venv\Scripts\python.exe scripts/export_openapi.py --check

Output goes to stdout, never reads live database records or exports .env values.
"""
import argparse
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import app

SNAPSHOT = Path(__file__).resolve().parents[1] / "docs" / "openapi.json"


def main() -> None:
    parser = argparse.ArgumentParser(description="Export/check PHUB OpenAPI without database access")
    action = parser.add_mutually_exclusive_group()
    action.add_argument("--check", action="store_true", help="Check the versioned docs/openapi.json for drift")
    action.add_argument("--output", type=Path, help="Explicit path to save the generated JSON (UTF-8, no BOM)")
    parser.add_argument("--compact", action="store_true", help="Print compact JSON")
    args = parser.parse_args()
    spec = app.openapi()
    if args.check:
        if not SNAPSHOT.exists() or json.loads(SNAPSHOT.read_text(encoding="utf-8")) != spec:
            raise SystemExit("OpenAPI snapshot is missing or outdated. Regenerate Backend/docs/openapi.json.")
        print("OpenAPI snapshot matches the application.")
    elif args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(spec, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
        print(f"Saved OpenAPI to {args.output}")
    else:
        # ASCII escapes make stdout reproducible on Windows terminals too.
        print(json.dumps(spec, ensure_ascii=True, indent=None if args.compact else 2, sort_keys=True))


if __name__ == "__main__":
    main()
