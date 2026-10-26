from pydantic import BaseModel


class UploadedImage(BaseModel):
    media_id: str
    bucket: str
    path: str
    url: str
    content_type: str
    size: int
    width: int
    height: int
