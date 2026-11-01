import json
import re

from phub_api.models.resources import CUSTOMER_CHILDREN, RESOURCES, public_columns
from phub_api.models.user import User


def selected_columns(name: str, user: User) -> str:
    parts = [c["name"] + ("::text" if c["type"].startswith("decimal") else "") for c in public_columns(name)]
    if user.role == "KHACH_HANG" and name in CUSTOMER_CHILDREN:
        parts.append("scope:DON_HANG!inner(ma_kh)")
    if user.role == "NHAN_VIEN" and name == "receipt-lines":
        parts.append("scope:PHIEU_NHAP!inner(ma_kho)")
    if user.role == "NHAN_VIEN" and name == "transfer-lines":
        parts.append("scope:PHIEU_CHUYEN_KHO!inner(ma_kho_xuat,ma_kho_nhan)")
    return ",".join(parts)


def scoped_query(name: str, user: User, db, search: str | None = None):
    query = db.table(RESOURCES[name].table).select(selected_columns(name, user), count="exact")
    if user.role == "KHACH_HANG":
        query = query.eq("scope.ma_kh" if name in CUSTOMER_CHILDREN else "ma_kh", user.customer_id)
    if user.role == "NHAN_VIEN":
        if name in {"warehouses", "inventory", "receipts"}:
            query = query.eq("ma_kho", user.warehouse_id)
        elif name == "receipt-lines":
            query = query.eq("scope.ma_kho", user.warehouse_id)
        elif name in {"transfers", "transfer-lines"}:
            clause = f"ma_kho_xuat.eq.{user.warehouse_id},ma_kho_nhan.eq.{user.warehouse_id}"
            if name == "transfers" and search:
                clause = f"and(or({clause}),or({search}))"
            query = query.or_(clause, reference_table="scope") if name == "transfer-lines" else query.or_(clause)
    if search and not (user.role == "NHAN_VIEN" and name == "transfers"):
        query = query.or_(search)
    return query


def apply_keys(query, name: str, values: list):
    for field, value in zip(RESOURCES[name].keys, values):
        query = query.eq(field, value)
    return query


def clean(rows: list[dict]) -> list[dict]:
    return [{key: value for key, value in row.items() if key not in {"scope", "mat_khau", "mat_khau_hash", "phien_ban_mat_khau"}} for row in rows]


class TablesRepository:
    def __init__(self, client):
        self.client = client

    def page(self, name, user, page, page_size, q, keys, order_id, filters=None):
        search = None
        if q.strip():
            pattern = json.dumps(re.escape(q.strip()), ensure_ascii=False)
            fields = [c["name"] for c in public_columns(name) if c["type"] == "varchar"]
            if fields:
                search = ",".join(f"{field}.imatch.{pattern}" for field in fields)
        query = scoped_query(name, user, self.client, search)
        if order_id is not None:
            query = query.eq("ma_donhang", order_id)
        if keys is not None:
            query = apply_keys(query, name, keys)
        for field, operator, value in filters or []:
            query = getattr(query, operator)(field, value)
        for field in RESOURCES[name].keys:
            query = query.order(field)
        return query.range((page - 1) * page_size, page * page_size - 1).execute()

    def detail(self, name, user, keys):
        return apply_keys(scoped_query(name, user, self.client), name, keys).limit(1).execute().data

    def insert(self, name, values):
        return self.client.table(RESOURCES[name].table).insert(values).execute().data

    def update(self, name, keys, values):
        return apply_keys(self.client.table(RESOURCES[name].table).update(values), name, keys).execute().data

    def update_draft(self, name, keys, values):
        # The state guard is part of the UPDATE, closing the read/confirm/write race.
        query = self.client.table(RESOURCES[name].table).update(values).eq("trang_thai", "NHAP")
        return apply_keys(query, name, keys).execute().data
