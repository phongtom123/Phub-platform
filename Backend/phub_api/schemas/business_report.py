from datetime import date
from typing import Literal

from pydantic import BaseModel


class ProductProfit(BaseModel):
    sku: str
    name: str
    quantity: int
    net_revenue: str
    cost: str | None
    gross_profit: str | None
    margin: str | None
    unpriced_lines: int


class DailyProfit(BaseModel):
    day: date
    net_revenue: str
    gross_profit: str | None


class BusinessReport(BaseModel):
    start: date
    end: date
    method: Literal['MOVING_WEIGHTED_AVERAGE']
    basis: Literal['COMPLETED_ORDERS']
    net_revenue: str
    tax: str
    discounts: str
    gross_revenue: str
    collected: str
    refunds: str
    order_count: int
    quantity: int
    cost: str | None
    known_cost: str
    gross_profit: str | None
    margin: str | None
    costed_lines: int
    total_lines: int
    warnings: list[Literal['INCOMPLETE_COST_HISTORY', 'UNALLOCATED_REFUNDS']]
    products: list[ProductProfit]
    daily: list[DailyProfit]
