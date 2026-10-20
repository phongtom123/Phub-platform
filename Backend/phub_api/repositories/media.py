"""Supabase Storage adapter. No image processing or HTTP response decisions."""


class MediaRepository:
    def __init__(self, client):
        self.client = client

    def is_public(self, bucket: str) -> bool:
        return self.client.storage.get_bucket(bucket).public

    def upload(self, bucket: str, path: str, data: bytes) -> str:
        files = self.client.storage.from_(bucket)
        files.upload(path=path, file=data, file_options={
            "content-type": "image/webp", "cache-control": "31536000", "upsert": "false",
        })
        return files.get_public_url(path)
