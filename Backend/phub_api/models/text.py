"""Text invariants shared by internal models and API schemas."""


def clean_text(value: str) -> str:
    value = value.strip()
    if any(ord(char) < 32 or ord(char) == 127 for char in value):
        raise ValueError("Không được chứa ký tự điều khiển.")
    return value
