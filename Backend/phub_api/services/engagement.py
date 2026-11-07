from fastapi import HTTPException
from postgrest.exceptions import APIError


class EngagementService:
    def __init__(self, repository, actor=None):
        self.repository, self.actor = repository, actor

    def account(self, admin=False):
        allowed = {"ADMIN", "NHAN_VIEN"} if admin else {"KHACH_HANG"}
        if not self.actor or self.actor.role not in allowed:
            raise HTTPException(403, "Bạn không có quyền thực hiện thao tác này.")
        return self.actor.account_id

    def call(self, operation, *args):
        try:
            result = operation(*args)
        except APIError as exc:
            code = str(exc.code)
            if code in {"PGRST202", "42883", "42P01"}:
                raise HTTPException(503, "Backend/database chưa hỗ trợ khảo sát và đánh giá. Cần áp dụng migration crm_surveys_reviews.") from None
            if code == "42501":
                raise HTTPException(403, "Bạn không có quyền thực hiện, tài khoản không hoạt động hoặc đơn chưa hoàn thành.") from None
            if code == "P0002":
                raise HTTPException(404, "Không tìm thấy dữ liệu thuộc quyền truy cập của bạn.") from None
            if code in {"40001", "23505"}:
                raise HTTPException(409, "Dữ liệu đã thay đổi hoặc bài đã được gửi. Tải lại để đối chiếu; không gửi lại bằng một mã yêu cầu mới.") from None
            if code == "23514":
                # Only explicit RAISE messages from our RPCs are user-facing.
                message = str(exc.message)
                if message.startswith(("Khảo sát", "Thời hạn", "Chưa có khách", "Cần ", "Câu ", "Vui lòng", "Chọn ", "Điểm ", "Lựa chọn", "Một câu", "Chỉ đóng", "Sản phẩm")):
                    raise HTTPException(422, message) from None
                raise HTTPException(422, "Nội dung hoặc trạng thái thao tác không hợp lệ.") from None
            raise
        if not isinstance(result, dict):
            raise HTTPException(502, "API chưa xác nhận kết quả. Tải lại dữ liệu để kiểm tra.")
        return result

    def survey_read(self, admin, kind, survey_id=None, page=1):
        if admin:
            self.account(True)
            if kind in {"report", "statistics"} and self.actor.role != "ADMIN":
                raise HTTPException(403, "Chỉ quản trị viên được xem thống kê.")
            if kind == "preview" and self.actor.role != "NHAN_VIEN":
                raise HTTPException(403, "Chỉ nhân viên được xử lý đối tượng khảo sát.")
        return self.call(self.repository.survey_read, self.account(admin), admin, kind, str(survey_id) if survey_id else None, page)

    def survey_write(self, action, survey_id, payload=None, version=None):
        self.require_staff()
        return self.call(self.repository.survey_write, self.account(True), str(survey_id), action, payload or {}, str(version) if version else None)

    def submit(self, survey_id, body):
        return self.call(self.repository.survey_submit, self.account(), str(survey_id), str(body.submission_id), [answer.model_dump(mode="json") for answer in body.answers])

    def reviews(self, kind, product=None, status=None, page=1):
        if kind == "admin":
            self.require_staff()
        actor = None if kind == "public" else self.account(kind == "admin")
        return self.call(self.repository.review_read, actor, kind, product, status, page)

    def write_review(self, body):
        return self.call(self.repository.review_write, self.account(), body)

    def moderate(self, review_id, body):
        self.require_staff()
        return self.call(self.repository.moderate, self.account(True), str(review_id), body.status, str(body.expected_version))

    def require_staff(self):
        if not self.actor or self.actor.role != "NHAN_VIEN" or not self.actor.employee_id:
            raise HTTPException(403, "Chỉ nhân viên được xử lý nghiệp vụ CRM.")
