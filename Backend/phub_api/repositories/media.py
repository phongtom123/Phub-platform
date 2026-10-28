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

    def remove(self, bucket: str, path: str) -> None:
        self.client.storage.from_(bucket).remove([path])

    def register(self, values: dict) -> dict:
        rows = self.client.table("MEDIA").insert(values).execute().data
        if not rows:
            raise RuntimeError("Media insert returned no rows")
        return rows[0]

    def set_avatar(self, account_id: str, media_id: str) -> bool:
        rows = (self.client.table("TAI_KHOAN").update({"ma_media_anh_dai_dien": media_id})
                .eq("ma_tk", account_id).execute().data)
        return len(rows) == 1 and rows[0].get("ma_tk") == account_id

    def unregister(self, media_id: str) -> None:
        self.client.table("MEDIA").delete().eq("ma_media", media_id).execute()
