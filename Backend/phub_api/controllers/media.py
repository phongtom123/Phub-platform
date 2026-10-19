from fastapi import Depends, HTTPException, Request, Response
from starlette.concurrency import run_in_threadpool

from phub_api.config.database import get_supabase
from phub_api.dependencies.auth import require_admin
from phub_api.dependencies.origin import check_origin
from phub_api.services import media


async def upload_image(request: Request, response: Response, user=Depends(require_admin), db=Depends(get_supabase)):
    check_origin(request)
    response.headers["Cache-Control"] = "no-store"
    content_type = request.headers.get("content-type", "").split(";")[0].strip().lower()
    if content_type not in media.MIME_FORMATS:
        raise HTTPException(415, "Chỉ hỗ trợ JPG, PNG hoặc WebP.")
    length = request.headers.get("content-length", "")
    if length.isdigit() and int(length) > media.MAX_BYTES:
        raise HTTPException(413, "Dung lượng ảnh không được vượt quá 5 MB.")
    data = bytearray()
    async for chunk in request.stream():
        if len(data) + len(chunk) > media.MAX_BYTES:
            raise HTTPException(413, "Dung lượng ảnh không được vượt quá 5 MB.")
        data.extend(chunk)
    if not data:
        raise HTTPException(422, "Hãy chọn một file ảnh.")
    return await run_in_threadpool(media.store_image, bytes(data), content_type, db)
