"""Backfill MEDIA Storage metadata from existing public bucket objects.

Dry-run is the default. Pass --apply only after every referenced object has
been downloaded and validated successfully.
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass
from io import BytesIO
import json
import os
from pathlib import Path, PurePosixPath
import re
import sys
from urllib.parse import unquote, urlparse
from xml.etree import ElementTree

from PIL import Image, UnidentifiedImageError

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from phub_api.config.database import close_supabase, get_supabase  # noqa: E402


PUBLIC_OBJECT_MARKER = "/storage/v1/object/public/"
LOCAL_IMAGE_PREFIX = "/images/"
NUMBER = re.compile(r"^\s*([0-9]+(?:\.[0-9]+)?)\s*(?:px)?\s*$", re.I)


@dataclass(frozen=True)
class Metadata:
    bucket: str
    path: str
    mime_type: str
    size: int
    width: int
    height: int

    def database_values(self) -> dict[str, str | int]:
        return {
            "storage_bucket": self.bucket,
            "storage_path": self.path,
            "mime_type": self.mime_type,
            "kich_thuoc_bytes": self.size,
            "chieu_rong": self.width,
            "chieu_cao": self.height,
        }


def storage_location(url: str, default_bucket: str) -> tuple[str, str]:
    if url.startswith(LOCAL_IMAGE_PREFIX):
        bucket = default_bucket
        path = "products/" + unquote(url[len(LOCAL_IMAGE_PREFIX):])
    else:
        parsed = urlparse(url)
        marker_at = parsed.path.find(PUBLIC_OBJECT_MARKER)
        if parsed.scheme not in {"http", "https"} or marker_at < 0:
            raise ValueError(f"Unsupported media URL: {url}")
        remainder = unquote(parsed.path[marker_at + len(PUBLIC_OBJECT_MARKER):])
        bucket, separator, path = remainder.partition("/")
        if not separator:
            raise ValueError(f"Storage URL has no object path: {url}")

    normalized = PurePosixPath(path)
    if not bucket or not path or path.startswith("/") or ".." in normalized.parts:
        raise ValueError(f"Unsafe Storage location derived from: {url}")
    return bucket, normalized.as_posix()


def svg_dimension(value: str | None) -> float | None:
    if value is None:
        return None
    match = NUMBER.fullmatch(value)
    return float(match.group(1)) if match else None


def svg_size(data: bytes) -> tuple[int, int]:
    root = ElementTree.fromstring(data)
    if root.tag.rsplit("}", 1)[-1].casefold() != "svg":
        raise ValueError("XML object is not an SVG")
    width, height = svg_dimension(root.get("width")), svg_dimension(root.get("height"))
    view_box = root.get("viewBox") or root.get("viewbox")
    if (width is None or height is None) and view_box:
        values = [float(value) for value in re.split(r"[\s,]+", view_box.strip()) if value]
        if len(values) == 4:
            width = width if width is not None else values[2]
            height = height if height is not None else values[3]
    if width is None or height is None or width <= 0 or height <= 0:
        raise ValueError("SVG object has no positive width/height or viewBox")
    return round(width), round(height)


def inspect_image(data: bytes, bucket: str, path: str) -> Metadata:
    if not data:
        raise ValueError(f"Storage object is empty: {bucket}/{path}")
    stripped = data.lstrip()
    if stripped.startswith(b"<svg") or (stripped.startswith(b"<?xml") and b"<svg" in stripped[:4096]):
        width, height = svg_size(data)
        mime_type = "image/svg+xml"
    else:
        try:
            with Image.open(BytesIO(data)) as image:
                image.load()
                width, height = image.size
                mime_type = Image.MIME.get(image.format or "")
        except (UnidentifiedImageError, OSError, ValueError) as exc:
            raise ValueError(f"Invalid image object: {bucket}/{path}") from exc
        if not mime_type or not mime_type.startswith("image/"):
            raise ValueError(f"Unknown image MIME type: {bucket}/{path}")
    if width <= 0 or height <= 0:
        raise ValueError(f"Image has invalid dimensions: {bucket}/{path}")
    return Metadata(bucket, path, mime_type, len(data), width, height)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Persist validated metadata to MEDIA")
    args = parser.parse_args()

    default_bucket = os.getenv("SUPABASE_MEDIA_BUCKET", "media").strip()
    if not default_bucket:
        raise SystemExit("SUPABASE_MEDIA_BUCKET is empty")

    client = get_supabase()
    try:
        rows = (
            client.table("MEDIA")
            .select("ma_media,url,storage_bucket,storage_path,mime_type,kich_thuoc_bytes,chieu_rong,chieu_cao")
            .order("ma_media")
            .execute()
            .data
        )
        incomplete = [row for row in rows if any(row.get(field) is None for field in (
            "storage_bucket", "storage_path", "mime_type", "kich_thuoc_bytes", "chieu_rong", "chieu_cao"
        ))]

        locations: dict[str, tuple[str, str]] = {}
        metadata_by_location: dict[tuple[str, str], Metadata] = {}
        for row in incomplete:
            location = storage_location(row["url"], default_bucket)
            locations[row["ma_media"]] = location
            if location not in metadata_by_location:
                data = client.storage.from_(location[0]).download(location[1])
                metadata_by_location[location] = inspect_image(data, *location)

        summary = {
            "mode": "apply" if args.apply else "dry-run",
            "total_rows": len(rows),
            "incomplete_rows": len(incomplete),
            "distinct_objects": len(metadata_by_location),
            "validated_bytes": sum(item.size for item in metadata_by_location.values()),
            "mime_types": {},
        }
        for item in metadata_by_location.values():
            summary["mime_types"][item.mime_type] = summary["mime_types"].get(item.mime_type, 0) + 1

        if args.apply:
            updated = 0
            for row in incomplete:
                values = metadata_by_location[locations[row["ma_media"]]].database_values()
                result = (
                    client.table("MEDIA")
                    .update(values)
                    .eq("ma_media", row["ma_media"])
                    .execute()
                    .data
                )
                if len(result) != 1:
                    raise RuntimeError(f"MEDIA update returned {len(result)} rows for {row['ma_media']}")
                updated += 1
            summary["updated_rows"] = updated

        print(json.dumps(summary, ensure_ascii=False, sort_keys=True))
        return 0
    finally:
        close_supabase()


if __name__ == "__main__":
    raise SystemExit(main())
