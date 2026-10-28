from fastapi import APIRouter, Depends, Query, Request, Response
from starlette.concurrency import run_in_threadpool

from phub_api.dependencies.origin import check_origin
from phub_api.dependencies.warehouse_drafts import get_service
from phub_api.schemas.api_contracts import WRITE_ERRORS, error_response
from phub_api.schemas.warehouse_drafts import ReceiptDraftUpdate
from phub_api.services.warehouse_drafts import WarehouseDraftService


router = APIRouter(prefix="/api/admin/warehouse-drafts")
errors = {**WRITE_ERRORS, 404: error_response(404, "Không tìm thấy phiếu."),
          409: error_response(409, "Phiếu không còn ở trạng thái nháp.")}


@router.patch("/receipts", tags=["Kho · Phiếu nhập"], responses=errors,
              summary="Chỉnh sửa thông tin phiếu nhập nháp",
              description="Chỉ ADMIN. Cập nhật mã phiếu, nhà cung cấp, kho và ghi chú khi trạng thái còn NHAP; không chuyển trạng thái hoặc ghi tồn kho.")
async def update_receipt(request: Request, response: Response, body: ReceiptDraftUpdate,
                         key: str = Query(..., max_length=6000), service: WarehouseDraftService = Depends(get_service)):
    check_origin(request)
    result = await run_in_threadpool(service.update, "receipts", key, body)
    response.headers["Cache-Control"] = "no-store"
    return result
