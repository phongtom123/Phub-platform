from getpass import getpass

from pwdlib import PasswordHash


def main() -> None:
    password = getpass("New password (10-128 characters): ")
    confirmation = getpass("Confirm password: ")
    if password != confirmation or not 10 <= len(password) <= 128:
        raise SystemExit("Passwords must match and contain 10-128 characters.")
    print(PasswordHash.recommended().hash(password))


if __name__ == "__main__":
    main()
