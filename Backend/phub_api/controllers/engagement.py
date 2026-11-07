from typing import Annotated, Literal
from uuid import UUID
from fastapi import APIRouter, Depends, Path, Query

from phub_api.dependencies.engagement import admin_read, admin_write, customer_read, customer_write, public_read
from phub_api.schemas.api_contracts import READ_ERRORS as COMMON_READ_ERRORS, WRITE_ERRORS as COMMON_WRITE_ERRORS, error_response
from phub_api.schemas.engagement import (CrmReport, EngagementPage, PreviewPage, PublicReviewPage, ReviewModerate, ReviewRecord, ReviewWrite,
    SurveyCreate, SurveyDetail, SurveyPage, SurveyStatistics, SurveySubmit, SurveyUpdate, Version)
from phub_api.services.engagement import EngagementService

router = APIRouter(tags=["CRM · Khảo sát và đánh giá"])
AdminRead = Annotated[EngagementService, Depends(admin_read)]
AdminWrite = Annotated[EngagementService, Depends(admin_write)]
CustomerRead = Annotated[EngagementService, Depends(customer_read)]
CustomerWrite = Annotated[EngagementService, Depends(customer_write)]
PublicRead = Annotated[EngagementService, Depends(public_read)]
Page = Annotated[int, Query(ge=1, le=10000)]
READ_ERRORS = {**COMMON_READ_ERRORS, 404: error_response(404, "Không tìm thấy dữ liệu thuộc quyền truy cập của bạn."),
               502: error_response(502, "API chưa xác nhận kết quả; cần tải lại để đối chiếu.")}
WRITE_ERRORS = {**COMMON_WRITE_ERRORS, **READ_ERRORS, 409: error_response(409, "Dữ liệu đã thay đổi hoặc bài đã được gửi; cần đối chiếu phiên bản.")}


@router.get("/api/crm/report", response_model=CrmReport, responses=READ_ERRORS, summary="Báo cáo độ tuổi, đánh giá và khảo sát sở thích (ADMIN)")
def report(service: AdminRead):
    return service.survey_read(True, "report")


@router.get("/api/crm/surveys", response_model=SurveyPage, responses=READ_ERRORS, summary="Danh sách khảo sát cho nhân viên vận hành và admin xem kết quả")
def surveys(service: AdminRead, page: Page = 1):
    return service.survey_read(True, "list", page=page)


@router.post("/api/crm/surveys", response_model=SurveyDetail, responses=WRITE_ERRORS, summary="Tạo khảo sát nháp, thử lại cùng request_id để tránh trùng")
def create_survey(body: SurveyCreate, service: AdminWrite):
    return service.survey_write("create", body.request_id, body.model_dump(mode="json", exclude={"request_id"}))


@router.get("/api/crm/surveys/{survey_id}", response_model=SurveyDetail, responses=READ_ERRORS, summary="Xem khảo sát và cấu trúc câu hỏi (ADMIN/NHAN_VIEN)")
def survey(survey_id: UUID, service: AdminRead):
    return service.survey_read(True, "detail", survey_id)


@router.put("/api/crm/surveys/{survey_id}", response_model=SurveyDetail, responses=WRITE_ERRORS, summary="Sửa bản nháp với phiên bản đối chiếu")
def update_survey(survey_id: UUID, body: SurveyUpdate, service: AdminWrite):
    return service.survey_write("update", survey_id, body.model_dump(mode="json", exclude={"expected_version"}), body.expected_version)


@router.get("/api/crm/surveys/{survey_id}/preview", response_model=PreviewPage, responses=READ_ERRORS, summary="Xem trước đối tượng hoặc danh sách đã gửi, có phân trang")
def preview(survey_id: UUID, service: AdminRead, page: Page = 1):
    return service.survey_read(True, "preview", survey_id, page)


@router.post("/api/crm/surveys/{survey_id}/publish", response_model=SurveyDetail, responses=WRITE_ERRORS, summary="Chốt cấu trúc và gửi cho khách đủ điều kiện theo tuổi")
def publish(survey_id: UUID, body: Version, service: AdminWrite):
    return service.survey_write("publish", survey_id, version=body.expected_version)


@router.post("/api/crm/surveys/{survey_id}/close", response_model=SurveyDetail, responses=WRITE_ERRORS, summary="Đóng khảo sát, giữ nguyên kết quả")
def close(survey_id: UUID, body: Version, service: AdminWrite):
    return service.survey_write("close", survey_id, version=body.expected_version)


@router.get("/api/crm/surveys/{survey_id}/statistics", response_model=SurveyStatistics, responses=READ_ERRORS, summary="Kết quả từng câu; phân trang nội dung văn bản/Khác")
def statistics(survey_id: UUID, service: AdminRead, page: Page = 1):
    return service.survey_read(True, "statistics", survey_id, page)


@router.get("/api/customer/crm/surveys", response_model=SurveyPage, responses=READ_ERRORS, summary="Khảo sát được gửi cho khách đang đăng nhập")
def customer_surveys(service: CustomerRead, page: Page = 1):
    return service.survey_read(False, "list", page=page)


@router.get("/api/customer/crm/surveys/{survey_id}", response_model=SurveyDetail, responses=READ_ERRORS, summary="Xem khảo sát/bài đã gửi của chính mình")
def customer_survey(survey_id: UUID, service: CustomerRead):
    return service.survey_read(False, "detail", survey_id)


@router.post("/api/customer/crm/surveys/{survey_id}/submit", response_model=SurveyDetail, responses=WRITE_ERRORS, summary="Nộp toàn bộ bài trong transaction; thử lại cùng submission_id")
def submit(survey_id: UUID, body: SurveySubmit, service: CustomerWrite):
    return service.submit(survey_id, body)


@router.get("/api/customer/crm/reviews/eligible", response_model=EngagementPage, responses=READ_ERRORS, summary="Mỗi sản phẩm đã mua một dòng, kèm đánh giá duy nhất của khách")
def eligible_reviews(service: CustomerRead, page: Page = 1,
                     product_id: str | None = Query(None, min_length=1, max_length=200)):
    return service.reviews("eligible", product=product_id, page=page)


@router.post("/api/customer/crm/reviews", response_model=ReviewRecord, responses=WRITE_ERRORS, summary="Một đánh giá/khách/sản phẩm; đăng và sửa hiển thị ngay, giữ ẩn nếu đã bị ẩn")
def write_review(body: ReviewWrite, service: CustomerWrite):
    return service.write_review(body)


@router.get("/api/crm/reviews", response_model=EngagementPage, responses=READ_ERRORS, summary="Nhân viên xem đánh giá theo sản phẩm và trạng thái")
def reviews(service: AdminRead, page: Page = 1, status: Literal["HIEN_THI", "AN"] | None = None,
            product_id: str | None = Query(None, min_length=1, max_length=200)):
    return service.reviews("admin", product=product_id, status=status, page=page)


@router.post("/api/crm/reviews/{review_id}/moderate", response_model=ReviewRecord, responses=WRITE_ERRORS, summary="Ẩn/hiển thị lại đúng phiên bản nội dung đánh giá")
def moderate(review_id: UUID, body: ReviewModerate, service: AdminWrite):
    return service.moderate(review_id, body)


@router.get("/api/catalog/products/{product_id}/reviews", response_model=PublicReviewPage, responses=READ_ERRORS, summary="Nhận xét và điểm sao công khai; loại các đánh giá đã ẩn")
def public_reviews(product_id: Annotated[str, Path(min_length=1, max_length=200)], service: PublicRead, page: Page = 1):
    return service.reviews("public", product=product_id, page=page)
