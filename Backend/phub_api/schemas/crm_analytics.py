from pydantic import BaseModel, Field


class CustomerInsightsSummary(BaseModel):
    total_customers: int
    active_buyers: int
    total_orders: int
    total_revenue: str
    aov: str
    arpu: str
    status_scope: str = "ACTIVE"


class GenderItem(BaseModel):
    label: str
    value: int
    percentage: float


class AgeGroupItem(BaseModel):
    group: str
    value: int
    percentage: float


class InterestItem(BaseModel):
    category: str
    count: int
    percentage: float


class TopCategoryItem(BaseModel):
    category_id: str
    category_name: str
    quantity_sold: int
    revenue: str
    percentage: float


class TopProductItem(BaseModel):
    sku: str
    name: str
    category_name: str
    quantity_sold: int
    revenue: str


class GenderDetail(BaseModel):
    label: str
    key: str
    customer_count: int
    customer_percentage: float
    active_buyers: int
    total_orders: int
    revenue: str
    top_categories: list[TopCategoryItem]
    top_products: list[TopProductItem]


class GenderCategoryMatrixItem(BaseModel):
    category_id: str
    category_name: str
    total_quantity: int
    total_revenue: str
    nam_quantity: int
    nam_revenue: str
    nu_quantity: int
    nu_revenue: str
    khac_quantity: int
    khac_revenue: str
    chua_xac_dinh_quantity: int
    chua_xac_dinh_revenue: str


class AgeGroupDetail(BaseModel):
    group: str
    customer_count: int
    customer_percentage: float
    active_buyers: int
    total_orders: int
    revenue: str
    gender: list[GenderItem]
    top_categories: list[TopCategoryItem]
    top_products: list[TopProductItem]
    by_gender: list[GenderDetail] = []
    gender_category_matrix: list[GenderCategoryMatrixItem] = []


class DemographicsData(BaseModel):
    gender: list[GenderItem]
    age_groups: list[AgeGroupItem]
    interests: list[InterestItem]
    by_age_group: list[AgeGroupDetail] = []
    by_gender: list[GenderDetail] = []
    gender_category_matrix: list[GenderCategoryMatrixItem] = []


class TimelinePoint(BaseModel):
    period: str
    label: str
    order_count: int
    revenue: str
    avg_spending: str


class CustomerSegment(BaseModel):
    segment: str
    count: int
    percentage: float
    revenue: str


class SpendingTrendsData(BaseModel):
    period_type: str
    timeline: list[TimelinePoint]
    customer_segments: list[CustomerSegment]


class ProductInsightsData(BaseModel):
    top_categories: list[TopCategoryItem]
    top_products: list[TopProductItem]


class StrategicRecommendation(BaseModel):
    type: str
    title: str
    content: str


class RatingBreakdownItem(BaseModel):
    stars: int
    count: int
    percentage: float


class RecentFeedbackItem(BaseModel):
    customer_name: str
    overall_score: float | None = None
    product_score: float | None = None
    service_score: float | None = None
    comment: str | None = None
    created_at: str


class SurveyInsightsData(BaseModel):
    total_surveys: int
    total_responses: int
    rated_responses: int = Field(default=0, description="Số bài có câu chấm điểm HAI_LONG đã trả lời")
    total_ratings: int = Field(default=0, description="Số câu chấm điểm HAI_LONG đã trả lời; mẫu số phân bố sao")
    avg_overall_score: float | None = None
    avg_product_score: float | None = None
    avg_service_score: float | None = None
    rating_breakdown: list[RatingBreakdownItem] = Field(description="Phân bố điểm từng câu HAI_LONG, không làm tròn trung bình bài thành sao")
    recent_feedbacks: list[RecentFeedbackItem]


class CityDistributionItem(BaseModel):
    city: str
    order_count: int
    customer_count: int
    revenue: str
    percentage: float
    order_percentage: float


class CustomerInsightsReport(BaseModel):
    summary: CustomerInsightsSummary
    demographics: DemographicsData
    spending_trends: SpendingTrendsData
    product_insights: ProductInsightsData
    survey_insights: SurveyInsightsData
    strategic_recommendations: list[StrategicRecommendation]
    city_distribution: list[CityDistributionItem] = []

