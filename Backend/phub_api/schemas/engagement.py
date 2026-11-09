"""Survey/review contracts: identity, audience counts and money never come from the client."""
from datetime import datetime
from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt, model_validator


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class SurveyOption(Input):
    noi_dung: str = Field(min_length=1, max_length=500)
    cho_phep_nhap_khac: StrictBool = False


class SurveyQuestion(Input):
    noi_dung: str = Field(min_length=1, max_length=1000)
    loai_cau_hoi: Literal["MOT_LUA_CHON", "DIEM_1_5", "VAN_BAN"]
    nhom_noi_dung: Literal["CHUNG", "SO_THICH", "HAI_LONG"] = "CHUNG"
    bat_buoc: StrictBool = True
    options: list[SurveyOption] = Field(default_factory=list, max_length=20)

    @model_validator(mode="after")
    def valid_options(self):
        if self.loai_cau_hoi == "MOT_LUA_CHON":
            if len(self.options) < 2 or sum(o.cho_phep_nhap_khac for o in self.options) > 1:
                raise ValueError("Cần 2–20 lựa chọn và tối đa một lựa chọn Khác.")
        elif self.options:
            raise ValueError("Câu điểm/văn bản không có danh sách lựa chọn.")
        return self


class SurveyAudience(Input):
    loai_doi_tuong: Literal["TAT_CA", "DO_TUOI", "CHUA_NGAY_SINH"]
    tuoi_tu: StrictInt | None = Field(default=None, ge=0, le=130)
    tuoi_den: StrictInt | None = Field(default=None, ge=0, le=130)
    khach_them: list[Annotated[str, Field(min_length=1, max_length=100)]] = Field(default_factory=list, max_length=5000)
    khach_loai: list[Annotated[str, Field(min_length=1, max_length=100)]] = Field(default_factory=list, max_length=5000)

    @model_validator(mode="after")
    def valid_target(self):
        if self.loai_doi_tuong == "DO_TUOI":
            if self.tuoi_tu is None or self.tuoi_den is None or self.tuoi_tu > self.tuoi_den:
                raise ValueError("Khoảng tuổi không hợp lệ.")
        elif self.tuoi_tu is not None or self.tuoi_den is not None:
            raise ValueError("Chỉ chọn khoảng tuổi cho đối tượng theo độ tuổi.")
        if len(set(self.khach_them)) != len(self.khach_them) or len(set(self.khach_loai)) != len(self.khach_loai):
            raise ValueError("Danh sách khách hàng bị trùng.")
        if set(self.khach_them) & set(self.khach_loai):
            raise ValueError("Một khách không thể vừa được thêm vừa bị loại.")
        self.khach_them.sort()
        self.khach_loai.sort()
        return self


class SurveyDraft(SurveyAudience):
    tieu_de: str = Field(min_length=1, max_length=200)
    mo_ta: str = Field(default="", max_length=5000)
    han_tra_loi: datetime
    questions: list[SurveyQuestion] = Field(min_length=1, max_length=30)

    @model_validator(mode="after")
    def valid_deadline(self):
        if self.han_tra_loi.tzinfo is None:
            raise ValueError("Thời hạn cần có múi giờ.")
        return self

    def rpc_payload(self):
        values = self.model_dump(mode="json", exclude={"request_id", "expected_version"})
        # Older clients must not clear saved recipient overrides by omitting them.
        for key in ("khach_them", "khach_loai"):
            if key not in self.model_fields_set:
                values.pop(key, None)
        return values


class SurveyCreate(SurveyDraft):
    request_id: UUID


class SurveyUpdate(SurveyDraft):
    expected_version: UUID


class Version(Input):
    expected_version: UUID


class SurveyAnswer(Input):
    ma_cau_hoi: UUID
    ma_lua_chon: UUID | None = None
    diem: StrictInt | None = Field(default=None, ge=1, le=5)
    noi_dung: str | None = Field(default=None, max_length=4000)


class SurveySubmit(Input):
    submission_id: UUID
    answers: list[SurveyAnswer] = Field(max_length=30)

    @model_validator(mode="after")
    def unique_questions(self):
        if len({a.ma_cau_hoi for a in self.answers}) != len(self.answers):
            raise ValueError("Một câu hỏi chỉ có một câu trả lời.")
        return self


class SurveyInfo(BaseModel):
    ma_khao_sat: UUID
    tieu_de: str
    mo_ta: str
    trang_thai: Literal["NHAP", "DANG_MO", "DONG"]
    loai_doi_tuong: str
    tuoi_tu: int | None
    tuoi_den: int | None
    han_tra_loi: datetime
    phien_ban: UUID
    ngay_tao: datetime
    ngay_chot_doi_tuong: datetime | None = None
    khach_them: list[str] = Field(default_factory=list)
    khach_loai: list[str] = Field(default_factory=list)


class SurveyItem(SurveyInfo):
    da_gui: int
    da_tra_loi: int
    hoan_thanh_luc: datetime | None


class SurveyPage(BaseModel):
    data: list[SurveyItem]
    total: int
    page: int
    page_size: int


class QuestionRead(BaseModel):
    ma_cau_hoi: UUID
    ma_khao_sat: UUID
    noi_dung: str
    loai_cau_hoi: str
    nhom_noi_dung: str
    bat_buoc: bool
    thu_tu: int
    options: list[dict[str, Any]]
    model_config = ConfigDict(extra="ignore")


class SurveyDetail(BaseModel):
    survey: SurveyInfo
    questions: list[QuestionRead]
    recipient: dict[str, Any] | None
    answers: list[SurveyAnswer]


class ReviewWrite(Input):
    product_id: str = Field(min_length=1, max_length=200, description="Mỗi khách chỉ có một đánh giá cho mỗi sản phẩm, kể cả khi mua lại.")
    order_id: str = Field(min_length=1, max_length=100, description="Đơn đã hoàn thành của khách chứa sản phẩm. Sửa đánh giá không thay mã đơn chứng minh mua ban đầu.")
    stars: StrictInt = Field(ge=1, le=5)
    content: str = Field(min_length=1, max_length=4000)
    expected_version: UUID | None = None


class ReviewModerate(Version):
    status: Literal["HIEN_THI", "AN"]


class ReviewRecord(BaseModel):
    ma_danh_gia: UUID
    ma_kh: str
    ma_sp: str
    ma_donhang: str
    so_sao: int
    noi_dung: str
    trang_thai: Literal["HIEN_THI", "AN"]
    ngay_tao: datetime
    cap_nhat_luc: datetime
    phien_ban: UUID


class PreviewPage(BaseModel):
    data: list[dict[str, Any]]
    total: int
    page: int
    page_size: int
    phien_ban: UUID
    is_snapshot: bool


class AudienceCustomer(BaseModel):
    ma_kh: str
    ten_kh: str
    tuoi: int | None
    added_manually: bool


class AudiencePreviewPage(BaseModel):
    data: list[AudienceCustomer]
    total: int
    selected_total: int
    page: int
    page_size: int
    unavailable_added_ids: list[str]


class SurveyStatistics(BaseModel):
    survey: SurveyInfo
    sent: int
    completed: int
    questions: list[dict[str, Any]]
    text_page: int
    page_size: int


class SurveyRespondentAnswer(BaseModel):
    ma_cau_hoi: UUID
    cau_hoi: str
    nhom_noi_dung: Literal["CHUNG", "SO_THICH", "HAI_LONG"]
    lua_chon: str | None
    noi_dung: str | None
    diem: int | None


class SurveyRespondent(BaseModel):
    ma_gui: UUID
    ma_kh: str
    ten_kh: str
    tuoi: int | None
    luu_tru_luc: datetime | None
    hoan_thanh_luc: datetime
    answers: list[SurveyRespondentAnswer]


class SurveyRespondentPage(BaseModel):
    data: list[SurveyRespondent]
    total: int
    page: int
    page_size: int


class SurveyCreator(BaseModel):
    ma_tk: str
    ho_ten: str


class SurveyResults(BaseModel):
    statistics: SurveyStatistics
    creator: SurveyCreator | None
    respondents: SurveyRespondentPage


class CustomerInterestAnswer(BaseModel):
    ma_tra_loi: UUID
    ma_kh: str
    ten_kh: str
    tuoi: int | None
    ma_khao_sat: UUID
    tieu_de: str
    ma_cau_hoi: UUID
    cau_hoi: str
    loai_cau_hoi: Literal["MOT_LUA_CHON", "VAN_BAN", "DIEM_1_5"]
    lua_chon: str | None
    noi_dung: str | None
    diem: int | None
    hoan_thanh_luc: datetime


class InterestOptionCount(BaseModel):
    label: str
    count: int


class InterestSurvey(BaseModel):
    ma_khao_sat: UUID
    tieu_de: str


class InterestQuestionSummary(InterestSurvey):
    ma_cau_hoi: UUID
    cau_hoi: str
    loai_cau_hoi: Literal["MOT_LUA_CHON", "VAN_BAN", "DIEM_1_5"]
    answered: int
    options: list[InterestOptionCount]


class CustomerInterestsPage(BaseModel):
    data: list[CustomerInterestAnswer]
    total: int
    page: int
    page_size: int
    customers: int
    survey_count: int
    question_count: int
    summaries: list[InterestQuestionSummary]
    surveys: list[InterestSurvey]


class EngagementPage(BaseModel):
    data: list[dict[str, Any]]
    total: int
    page: int
    page_size: int


class PublicReview(BaseModel):
    so_sao: int
    noi_dung: str
    ngay_tao: datetime
    author: str


class PublicReviewPage(BaseModel):
    data: list[PublicReview]
    total: int
    average: float | None
    stars: list[dict[str, int]]
    page: int
    page_size: int


class CrmReport(BaseModel):
    as_of: str
    total_customers: int
    age_groups: list[dict[str, Any]]
    review_stars: list[dict[str, int]]
    review_status: dict[str, int]
    interest_surveys: list[dict[str, Any]]


class ReviewProductInsights(BaseModel):
    ma_sp: str
    sku: str
    ten_sp: str
    review_count: int
    average: float
    low_count: int
    low_rate: float
    latest_at: datetime


class ReviewInsightsSummary(BaseModel):
    products: int
    reviews: int
    average: float | None
    low_count: int
    low_rate: float


class ReviewInsightComment(BaseModel):
    ma_danh_gia: UUID
    so_sao: int
    author: str
    noi_dung: str
    ngay_tao: datetime
    cap_nhat_luc: datetime


class ReviewInsightsDetail(BaseModel):
    product: ReviewProductInsights
    data: list[ReviewInsightComment]
    total: int
    page: int
    page_size: int
    low_only: bool


class ReviewInsightsPage(BaseModel):
    data: list[ReviewProductInsights]
    total: int
    page: int
    page_size: int
    summary: ReviewInsightsSummary
    details: ReviewInsightsDetail | None
