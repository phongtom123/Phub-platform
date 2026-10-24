"""Prepare a local SQL artifact; never connects to or mutates a database."""
import argparse
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MARKER = "-- PHUB_LOCAL_PASSWORD_INPUT: generated locally; never commit real credentials."
CONFIRM = "RESET_UNKNOWN_ACCOUNT_PASSWORDS"


def sql_text(value: str) -> str:
    if not isinstance(value, str) or "\x00" in value:
        raise ValueError("Invalid text in migration input.")
    return "'" + value.replace("'", "''") + "'"


def preservation_rows(backup: dict, known_passwords: dict) -> list[dict]:
    """Verify only user-supplied passwords; never guess or recover unknown ones."""
    from pwdlib import PasswordHash
    from pwdlib.exceptions import UnknownHashError
    from pwdlib.hashers.argon2 import Argon2Hasher
    from pwdlib.hashers.bcrypt import BcryptHasher

    checker = PasswordHash((Argon2Hasher(), BcryptHasher()))
    accounts = backup["accounts"]
    if not isinstance(accounts, list) or len({a["ma_tk"] for a in accounts}) != len(accounts):
        raise ValueError("Invalid account snapshot.")
    if not isinstance(known_passwords, dict) or not known_passwords:
        raise ValueError("Provide at least one known password before preparing a cutover.")
    selected = {}
    for login, password in known_passwords.items():
        if not isinstance(login, str) or not isinstance(password, str) or not 10 <= len(password) <= 128 or "\x00" in password:
            raise ValueError("Known passwords must contain 10–128 characters and no NUL.")
        matches = [a for a in accounts if (str(a.get("email") or "").lower() == login.lower() if "@" in login else a["ten_tai_khoan"] == login)]
        if len(matches) != 1:
            raise ValueError(f"Known login must identify exactly one account: {login}")
        account = matches[0]
        try:
            valid = checker.verify(password, account["mat_khau_hash"])
        except (ValueError, TypeError, UnknownHashError):
            valid = False
        if not valid:
            raise ValueError(f"Known password does not match the current snapshot: {login}") from None
        row = {"ma_tk": account["ma_tk"], "mat_khau": password, "expected_hash": account["mat_khau_hash"]}
        if row["ma_tk"] in selected and selected[row["ma_tk"]]["mat_khau"] != password:
            raise ValueError("Conflicting passwords for the same account.")
        selected[row["ma_tk"]] = row
    return [selected[key] for key in sorted(selected)]


def render_cutover(migration: str, backup: dict, known_passwords: dict) -> tuple[str, list[dict]]:
    if migration.count(MARKER) != 1:
        raise ValueError("Migration input marker is missing or ambiguous.")
    preserved = preservation_rows(backup, known_passwords)
    statements = []
    for account in sorted(backup["accounts"], key=lambda row: row["ma_tk"]):
        snapshot = json.dumps(account, ensure_ascii=False, separators=(",", ":"))
        statements.append("insert into pg_temp.phub_password_source_snapshot (ma_tk,expected_account) values ("
                          + sql_text(account["ma_tk"]) + "," + sql_text(snapshot) + "::jsonb);")
    for row in preserved:
        statements.append("insert into pg_temp.phub_password_preservation (ma_tk,mat_khau,expected_hash) values ("
                          + ",".join(sql_text(row[key]) for key in ("ma_tk", "mat_khau", "expected_hash")) + ");")
    # Place confirmation inside the transaction so it cannot leak across sessions.
    statements.append("set local phub.allow_plaintext_password_reset = " + sql_text(CONFIRM) + ";")
    header = "-- LOCAL SECRET ARTIFACT. DO NOT COMMIT OR PASTE INTO CHAT/LOGS.\n"
    return header + migration.replace(MARKER, MARKER + "\n" + "\n".join(statements)), preserved


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--backup", type=Path, required=True)
    parser.add_argument("--known-passwords", type=Path, required=True)
    parser.add_argument("--migration", type=Path, default=ROOT / "Backend/migrations/20261024161801_account_plaintext_passwords.sql")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    output = args.output.resolve()
    if output.is_relative_to(ROOT) and not output.is_relative_to(ROOT / ".password-migration-local"):
        raise SystemExit("Write secret artifacts outside the repository or inside ignored .password-migration-local/ only.")
    try:
        backup = json.loads(args.backup.read_text(encoding="utf-8"))
        known = json.loads(args.known_passwords.read_text(encoding="utf-8"))
        rendered, preserved = render_cutover(args.migration.read_text(encoding="utf-8"), backup, known)
        output.parent.mkdir(parents=True, exist_ok=True)
        with output.open("x", encoding="utf-8", newline="\n") as target:
            target.write(rendered)
    except FileExistsError:
        raise SystemExit("Output already exists; choose a fresh artifact path, do not overwrite a previous plan.") from None
    except (ValueError, KeyError, ImportError) as error:
        raise SystemExit(str(error)) from None
    print(json.dumps({"output": str(output), "accounts": len(backup["accounts"]), "preserved": len(preserved),
                      "reset_unknown": len(backup["accounts"]) - len(preserved), "database_changed": False}))


if __name__ == "__main__":
    main()
