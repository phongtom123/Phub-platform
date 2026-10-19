from fastapi import Response


def health(response: Response):
    response.headers["Cache-Control"] = "no-store"
    return {"status": "ok"}
