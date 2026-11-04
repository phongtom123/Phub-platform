"""Storage and media persistence adapter; no image processing or HTTP decisions."""


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

    def product_gallery(self, product_id: str) -> list[dict]:
        return (self.client.table("SAN_PHAM").select(
            "ma_sp,duong_dan_anh,images:MEDIA!MEDIA_product_fkey(ma_media,url,alt_text,thu_tu,la_anh_chinh)"
        ).eq("ma_sp", product_id).limit(1).execute().data)

    def save_gallery(self, product_id: str, values: dict) -> dict:
        return self.client.rpc("admin_product_gallery_v1", {
            "p_product_id": product_id,
            "p_items": values["items"],
            "p_expected_ids": values["expected_ids"],
            "p_expected_legacy_url": values["expected_legacy_url"],
        }).execute().data

    def image(self, media_id: str) -> list[dict]:
        return (self.client.table("MEDIA").select("ma_media,url,chieu_rong,chieu_cao")
                .eq("ma_media", media_id).limit(1).execute().data)
