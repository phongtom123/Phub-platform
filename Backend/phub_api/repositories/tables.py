from phub_api.models.resources import CUSTOMER_CHILDREN, RESOURCES, public_columns
from phub_api.models.user import User


def selected_columns(name: str, user: User) -> str:
    parts = [c["name"] + ("::text" if c["type"].startswith("decimal") else "") for c in public_columns(name)]
    if user.role == "KHACH_HANG" and name in CUSTOMER_CHILDREN:
        parts.append("scope:DON_HANG!inner(ma_kh)")
    if user.role == "THU_KHO" and name == "receipt-lines":
        parts.append("scope:PHIEU_NHAP!inner(ma_kho)")
    if user.role == "THU_KHO" and name == "transfer-lines":
        parts.append("scope:PHIEU_CHUYEN_KHO!inner(ma_kho_xuat,ma_kho_nhan)")
    return ",".join(parts)


def scoped_query(name: str, user: User, db, search: str | None = None):
    query = db.table(RESOURCES[name].table).select(selected_columns(name, user), count="exact")
    if user.role == "KHACH_HANG":
        query = query.eq("scope.ma_kh" if name in CUSTOMER_CHILDREN else "ma_kh", user.customer_id)
    if user.role == "THU_KHO":
        if name in {"warehouses", "inventory", "receipts"}:
            query = query.eq("ma_kho", user.warehouse_id)
        elif name == "receipt-lines":
            query = query.eq("scope.ma_kho", user.warehouse_id)
        elif name in {"transfers", "transfer-lines"}:
            clause = f"ma_kho_xuat.eq.{user.warehouse_id},ma_kho_nhan.eq.{user.warehouse_id}"
            if name == "transfers" and search:
                clause = f"and(or({clause}),or({search}))"
            query = query.or_(clause, reference_table="scope") if name == "transfer-lines" else query.or_(clause)
    if search and not (user.role == "THU_KHO" and name == "transfers"):
        query = query.or_(search)
    return query


def apply_keys(query, name: str, values: list):
    for field, value in zip(RESOURCES[name].keys, values):
        query = query.eq(field, value)
    return query


def clean(rows: list[dict]) -> list[dict]:
    return [{key: value for key, value in row.items() if key not in {"scope", "mat_khau_hash"}} for row in rows]
