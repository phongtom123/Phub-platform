from datetime import date
from typing import Literal

from pydantic import BaseModel, Field


class ReportRange(BaseModel):
    start: date | None = Field(description="Ngày bắt đầu lọc theo thời gian lập hóa đơn; NULL = từ đầu")
    end: date | None = Field(description="Ngày kết thúc lọc theo thời gian lập hóa đơn; NULL = đến nay")
    period_type: Literal["month", "quarter", "year"]


class ProductSummary(BaseModel):
    total_products: int = Field(description="Sản phẩm chưa ẩn (đang bán + tạm ngưng)")
    active_products: int
    paused_products: int
    hidden_products: int
    total_categories: int
    physical_units: int = Field(description="Tồn thực tế trong các kho đang hoạt động")
    held_units: int = Field(description="Phần tồn đang giữ cho đơn MOI/XAC_NHAN/DANG_CHUAN_BI đã có hóa đơn hoặc khoản thu thành công")
    available_units: int
    out_of_stock_products: int = Field(description="Sản phẩm đang bán có tồn khả dụng = 0")
    low_stock_products: int = Field(description="Sản phẩm đang bán có tồn khả dụng từ 1 đến ngưỡng sắp hết")
    low_stock_threshold: int
    inventory_value: str = Field(description="Tồn khả dụng của sản phẩm đang bán × giá bán hiện tại; không phải giá vốn")


class InvoiceSummary(BaseModel):
    total_invoices: int = Field(description="Mọi hóa đơn lập trong kỳ, kể cả của đơn đã hủy")
    valid_invoices: int = Field(description="Hóa đơn của đơn chưa hủy")
    cancelled_invoices: int
    total_amount: str = Field(description="Tổng sau thuế của hóa đơn đơn chưa hủy")
    pre_tax_amount: str
    tax_amount: str
    discount_amount: str
    avg_invoice_value: str
    collected_amount: str = Field(description="Thu thành công trừ hoàn tiền thành công của hóa đơn đơn chưa hủy")
    outstanding_amount: str = Field(description="Phần còn phải thu của hóa đơn đơn chưa hủy")
    paid_invoices: int
    partial_invoices: int
    unpaid_invoices: int
    items_sold: int = Field(description="Tổng số lượng sản phẩm trên hóa đơn của đơn chưa hủy")


class BreakdownItem(BaseModel):
    key: str
    label: str
    count: int
    amount: str
    percentage: float = Field(description="Tỷ trọng theo số lượng (count)")
    amount_percentage: float = Field(description="Tỷ trọng theo số tiền (amount)")


class InvoiceTimelinePoint(BaseModel):
    period: str
    label: str
    invoice_count: int
    pre_tax: str
    tax: str
    total: str
    collected: str
    items_sold: int


class CategoryStat(BaseModel):
    category_id: str
    category_name: str
    product_count: int = Field(description="Sản phẩm đang bán trong loại")
    available_units: int
    inventory_value: str
    quantity_sold: int
    revenue: str = Field(description="Doanh thu chưa thuế, sau giảm giá, của hóa đơn đơn chưa hủy")
    revenue_percentage: float


class ProductSalesItem(BaseModel):
    sku: str
    name: str
    category_name: str
    brand: str | None
    price: str
    quantity_sold: int
    revenue: str
    available_units: int
    held_units: int


class PriceRangeItem(BaseModel):
    key: str
    label: str
    count: int
    percentage: float
    categories: list["CategoryStat"] = Field(description="Theo loại, chỉ các sản phẩm đang bán trong khoảng giá này")


class BrandStat(BaseModel):
    brand: str
    product_count: int
    quantity_sold: int
    revenue: str
    revenue_percentage: float
    categories: list[CategoryStat] = Field(description="Theo loại, chỉ sản phẩm của thương hiệu này")


class ProductInvoiceInsightsReport(BaseModel):
    range: ReportRange
    product_summary: ProductSummary
    invoice_summary: InvoiceSummary
    invoice_status: list[BreakdownItem]
    payment_methods: list[BreakdownItem] = Field(description="Khoản thu thành công (THU) của hóa đơn trong kỳ")
    sales_channels: list[BreakdownItem]
    invoice_sources: list[BreakdownItem]
    timeline: list[InvoiceTimelinePoint]
    categories: list[CategoryStat]
    top_products: list[ProductSalesItem]
    slow_products: list[ProductSalesItem] = Field(description="Sản phẩm đang bán còn tồn khả dụng nhưng không bán được trong kỳ")
    low_stock_products: list[ProductSalesItem]
    price_ranges: list[PriceRangeItem]
    top_brands: list[BrandStat]


class ProductSalesPoint(BaseModel):
    period: str
    label: str
    quantity: int
    revenue: str
    invoice_count: int


class ProductChannelStat(BaseModel):
    key: str
    label: str
    quantity: int
    revenue: str


class ProductWarehouseStat(BaseModel):
    warehouse_id: int
    name: str
    physical_units: int
    held_units: int
    available_units: int
    quantity_sold: int = Field(description="Số lượng xuất từ kho này trên hóa đơn của đơn chưa hủy trong kỳ")


class ProductSalesSummary(BaseModel):
    quantity_sold: int
    revenue: str = Field(description="Doanh thu chưa thuế, sau giảm giá")
    invoice_count: int
    avg_unit_price: str = Field(description="Doanh thu / số lượng bán; 0 khi chưa bán")
    physical_units: int
    held_units: int
    available_units: int


class ProductSalesReport(BaseModel):
    sku: str
    name: str
    category_name: str
    brand: str | None
    price: str | None = Field(description="Giá bán hiện tại; NULL nếu SKU không còn trong danh mục")
    status: int | None
    range: ReportRange
    summary: ProductSalesSummary
    timeline: list[ProductSalesPoint] = Field(description="Đủ mọi kỳ liên tiếp, kể cả kỳ không bán được")
    channels: list[ProductChannelStat]
    warehouses: list[ProductWarehouseStat]


class StockListItem(BaseModel):
    sku: str
    name: str
    category_id: str
    category_name: str
    brand: str | None
    price: str
    status: int = Field(description="1 đang bán, 2 tạm ngưng, 0 đã ẩn")
    physical_units: int
    held_units: int
    available_units: int
    inventory_value: str = Field(description="Tồn khả dụng × giá bán hiện tại")
    value_percentage: float = Field(description="Tỷ trọng giá trị tồn trong tập đã lọc")
    quantity_sold: int = Field(description="Số lượng trên hóa đơn của đơn chưa hủy trong kỳ")
    revenue: str = Field(description="Doanh thu chưa thuế, sau giảm giá, trong kỳ")


class StockListTotals(BaseModel):
    products: int
    physical_units: int
    held_units: int
    available_units: int
    inventory_value: str


class StockListWarehouse(BaseModel):
    warehouse_id: int
    name: str
    physical_units: int
    held_units: int
    available_units: int


class StockListCategory(BaseModel):
    category_id: str
    category_name: str


class ProductStockList(BaseModel):
    view: Literal["products", "stock", "low", "value", "sales"]
    status: Literal["ACTIVE", "PAUSED", "HIDDEN", "ALL"]
    category: str | None
    q: str | None
    start: date | None
    end: date | None
    page: int
    page_size: int
    total: int = Field(description="Số sản phẩm khớp bộ lọc (mọi trang)")
    low_stock_threshold: int
    totals: StockListTotals = Field(description="Cộng dồn trên mọi sản phẩm khớp bộ lọc, không chỉ trang hiện tại")
    warehouses: list[StockListWarehouse] = Field(description="Tồn theo kho đang hoạt động của các sản phẩm khớp bộ lọc")
    categories: list[StockListCategory] = Field(description="Các loại sản phẩm để lọc")
    items: list[StockListItem]
