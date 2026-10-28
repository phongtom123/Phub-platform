from dataclasses import dataclass
from typing import Literal


@dataclass
class User:
    account_id: str
    username: str
    role: Literal["ADMIN", "NHAN_VIEN_KHO", "KHACH_HANG"]
    name: str
    customer_id: str | None = None
    employee_id: str | None = None
    warehouse_id: int | None = None
