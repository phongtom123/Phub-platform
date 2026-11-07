import json
import re
from postgrest.exceptions import APIError

from phub_api.models.resources import CUSTOMER_CHILDREN, EMPLOYEE_LOOKUP_FIELDS, RESOURCES, public_columns
from phub_api.models.user import User


def selected_columns(name: str, user: User, include_buyer_email: bool = True) -> str:
    if user.role == "NHAN_VIEN" and name == "employees":
        return ",".join(EMPLOYEE_LOOKUP_FIELDS)
    if user.role == "ADMIN" and name == "warehouses":
        return "ma_kho,ten_kho,trang_thai"
    parts = [c["name"] + ("::text" if c["type"].startswith("decimal") else "") for c in public_columns(name)
             if include_buyer_email or name != "orders" or c["name"] != "email_nguoi_mua"]
    if name == "customers" and user.role == "NHAN_VIEN":
        parts.append("linked_account:TAI_KHOAN(ma_tk,trang_thai)")
    if user.role == "KHACH_HANG" and name in CUSTOMER_CHILDREN:
        parts.append("scope:DON_HANG!inner(ma_kh)")
    if user.role == "NHAN_VIEN" and name == "receipt-lines":
        parts.append("scope:PHIEU_NHAP!inner(ma_kho)")
    if user.role == "NHAN_VIEN" and name == "transfer-lines":
        parts.append("scope:PHIEU_CHUYEN_KHO!inner(ma_kho_xuat,ma_kho_nhan)")
    return ",".join(parts)


def scoped_query(name: str, user: User, db, search: str | None = None, include_buyer_email: bool = True):
    query = db.table(RESOURCES[name].table).select(selected_columns(name, user, include_buyer_email), count="exact")
    if user.role == "KHACH_HANG":
        query = query.eq("scope.ma_kh" if name in CUSTOMER_CHILDREN else "ma_kh", user.customer_id)
    # Staff reads span all warehouses; account/role administration stays separate.
    if search:
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
        return self._read_compatible(name, lambda include_email: self._page_query(name, user, page, page_size, q, keys, order_id, filters, include_email))

    def _read_compatible(self, name, query):
        try:
            return query(True).execute()
        except APIError as error:
            # Keep historical order reads available before the additive migration.
            # Writes never use a fallback or discard the buyer's email.
            if name != "orders" or error.code != "42703" or "email_nguoi_mua" not in str(error.message):
                raise
            result = query(False).execute()
            for row in result.data:
                row.setdefault("email_nguoi_mua", None)
            return result

    def _page_query(self, name, user, page, page_size, q, keys, order_id, filters, include_email):
        search = None
        if q.strip():
            pattern = json.dumps(re.escape(q.strip()), ensure_ascii=False)
            fields = [c["name"] for c in public_columns(name) if c["type"] == "varchar"
                      and (name != "employees" or user.role != "NHAN_VIEN" or c["name"] in EMPLOYEE_LOOKUP_FIELDS)
                      and (include_email or name != "orders" or c["name"] != "email_nguoi_mua")]
            if fields:
                search = ",".join(f"{field}.imatch.{pattern}" for field in fields)
            # Supplier IDs are integers, so name/text search needs an exact ID
            # alternative as well. Only normalized int32 values enter the filter.
            if name == "suppliers" and re.fullmatch(r"-?[0-9]{1,11}", q.strip()):
                supplier_id = int(q.strip())
                if -(2**31) <= supplier_id < 2**31:
                    search = ",".join(filter(None, (search, f"ma_ncc.eq.{supplier_id}")))
        query = scoped_query(name, user, self.client, search, include_email)
        if order_id is not None:
            query = query.eq("ma_donhang", order_id)
        if keys is not None:
            query = apply_keys(query, name, keys)
        if name == "customers" and keys is None and not any(operator == "archive" for _, operator, _ in filters or []):
            query = query.is_("luu_tru_luc", "null")
        for field, operator, value in filters or []:
            if operator == "archive":
                if value == "ACTIVE":
                    query = query.is_(field, "null")
                elif value == "ARCHIVED":
                    query = query.not_.is_(field, "null")
            else:
                query = getattr(query, operator)(field, value)
        for field in RESOURCES[name].keys:
            query = query.order(field)
        return query.range((page - 1) * page_size, page * page_size - 1)

    def detail(self, name, user, keys):
        return self._read_compatible(name, lambda include_email: apply_keys(scoped_query(name, user, self.client, include_buyer_email=include_email), name, keys).limit(1)).data

    def insert(self, name, values):
        return self.client.table(RESOURCES[name].table).insert(values).execute().data

    def update(self, name, keys, values):
        query = apply_keys(self.client.table(RESOURCES[name].table).update(values), name, keys)
        if name == "customers":
            query = query.is_("luu_tru_luc", "null")
        if name == "employees":
            query = query.eq("loai_nhan_vien", "NHAN_VIEN")
        return query.execute().data

    def update_draft(self, name, keys, values):
        # The state guard is part of the UPDATE, closing the read/confirm/write race.
        query = self.client.table(RESOURCES[name].table).update(values).eq("trang_thai", "NHAP")
        return apply_keys(query, name, keys).execute().data
