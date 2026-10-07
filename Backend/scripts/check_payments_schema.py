"""Opt-in read-only schema/query check. Run from Backend; no real customer data.

Uses GET/HEAD only, with fresh synthetic IDs. No auth override on the application,
no account login, no writes, no printing credentials, records or transaction IDs.
"""

import sys
from pathlib import Path
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.payments.auth import CurrentCustomer
from app.payments.errors import PaymentError
from app.payments.repository import PaymentRepository
from app.supabase import supabase


def check():
    checks = 0

    def passed(label):
        nonlocal checks
        checks += 1
        print("PASS:", label)

    response = supabase.postgrest.session.get("/", headers={"Accept": "application/openapi+json"})
    response.raise_for_status()
    definitions = response.json().get("definitions", {})
    required = {
        "DON_HANG": {"ma_donhang", "ma_kh"},
        "THANH_TOAN": {"ma_thanh_toan", "ma_donhang", "so_tien", "loai_giao_dich", "phuong_thuc", "trang_thai", "thoi_gian"},
    }
    for table, columns in required.items():
        assert columns <= set(definitions.get(table, {}).get("properties", {})), "Required schema columns unavailable"
        passed("Required columns present: " + table)

    repository = PaymentRepository(supabase)
    suffix = uuid4().hex
    order_id = "READ_ONLY_SCHEMA_CHECK_" + suffix
    customer = CurrentCustomer(customer_id="READ_ONLY_SCHEMA_CHECK_" + suffix)
    try:
        repository.overview(order_id, customer)
    except PaymentError as exc:
        assert exc.status_code == 404 and exc.code == "ORDER_NOT_FOUND"
    else:
        raise AssertionError("Synthetic order unexpectedly exists")
    passed("Quoted order/customer ownership filters accepted; nonexistent order returns 404")
    result = repository.transaction_query(order_id, customer, count="exact").limit(1).execute()
    assert result.data == [] and result.count == 0
    passed("Inner ownership join, decimal text cast, status/time projection and exact count accepted")
    result = repository.transaction_query(order_id, customer, count="exact", head=True).limit(1).execute()
    assert result.count == 0
    passed("Ownership-scoped HEAD count accepted")
    print(f"{checks} read-only payment schema checks passed; no database changes.")


if __name__ == "__main__":
    try:
        check()
    except Exception as exc:
        # Never echo raw transport/SQL messages, which may include private fields.
        print("Payment schema check failed:", type(exc).__name__)
        raise SystemExit(1)
