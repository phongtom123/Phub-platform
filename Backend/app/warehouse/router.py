from fastapi import APIRouter, Depends, HTTPException
from postgrest.exceptions import APIError

from ..auth import User, current_user
from ..supabase import get_supabase
from .repository import ReceiptWorkflowError, WarehouseRepository
from .schemas import OrderDispatchResult, ReceiptConfirmation, ReceiptWorkflowResult
from .schemas import TransferWorkflowResult
from .transfer_repository import TransferRepository, TransferWorkflowError
from .drafts import DraftWorkflowResult, ReceiptDraftRequest, TransferDraftRequest, WarehouseOptionsResult, StocktakeDraftRequest, StocktakeWorkflowResult

router = APIRouter(prefix="/api/warehouse", tags=["Warehouse Workflows"])


def get_repository():
    return WarehouseRepository(get_supabase())


def _require_warehouse_scope(user: User, warehouse_id: int):
    if user.role not in {"ADMIN", "THU_KHO"} or not user.employee_id:
        raise HTTPException(403, "Role không được tạo phiếu kho.")
    if user.role == "THU_KHO" and user.warehouse_id != warehouse_id:
        raise HTTPException(403, "Kho không thuộc phạm vi được phân quyền.")


@router.get("/options", response_model=WarehouseOptionsResult, summary="Danh sách kho và nhà cung cấp dùng khi lập phiếu")
def warehouse_options(user: User = Depends(current_user), db=Depends(get_supabase)):
    if user.role not in {"ADMIN", "THU_KHO"}:
        raise HTTPException(403, "Role không được lập phiếu kho.")
    warehouse_query = db.table("KHO").select("ma_kho,ten_kho").eq("trang_thai", 1).order("ma_kho").limit(500)
    if user.role == "THU_KHO":
        if user.warehouse_id is None:
            raise HTTPException(403, "Tài khoản thủ kho chưa được phân công kho.")
        warehouse_query = warehouse_query.eq("ma_kho", user.warehouse_id)
    warehouses = warehouse_query.execute().data
    suppliers = db.table("NHA_CUNG_CAP").select("ma_ncc,ten_ncc").eq("trang_thai", 1).order("ma_ncc").limit(500).execute().data
    products = db.table("SAN_PHAM").select("sku,ten_sp").eq("trang_thai", 1).order("sku").limit(1000).execute().data
    return {"warehouses": warehouses, "suppliers": suppliers, "products": products}


@router.get("/stocktakes", summary="Danh sách phiên kiểm kê theo kho")
def list_stocktakes(user: User = Depends(current_user), db=Depends(get_supabase)):
    if user.role not in {"ADMIN", "THU_KHO"}:
        raise HTTPException(403, "Role không được xem kiểm kê.")
    query = db.table("PHIEU_KIEM_KE").select("ma_phieu_kiem,ma_phieu_code,ma_kho,ngay_tao,trang_thai,nguoi_tao,nguoi_duyet,ngay_duyet,ghi_chu,warehouse:KHO(ten_kho)").order("ngay_tao", desc=True).limit(500)
    if user.role == "THU_KHO":
        query = query.eq("ma_kho", user.warehouse_id)
    return query.execute().data


@router.post("/stocktakes/draft", response_model=StocktakeWorkflowResult, status_code=201,
             summary="Tạo phiên kiểm kê nháp")
def create_stocktake(body: StocktakeDraftRequest, user: User = Depends(current_user), db=Depends(get_supabase)):
    _require_warehouse_scope(user, body.warehouse_id)
    try:
        result = db.rpc("create_stocktake_draft", {
            "p_ma_kho": body.warehouse_id,
            "p_nguoi_tao": user.employee_id,
            "p_ghi_chu": body.note,
            "p_lines": [line.model_dump() for line in body.lines],
        }).execute().data
        return {"data": result}
    except APIError as exc:
        raise HTTPException(422, "Không thể tạo phiên kiểm kê: " + str(exc.message or exc)) from None


@router.post("/stocktakes/{stocktake_id}/submit", response_model=StocktakeWorkflowResult,
             summary="Gửi phiên kiểm kê chờ duyệt")
def submit_stocktake(stocktake_id: int, user: User = Depends(current_user), db=Depends(get_supabase)):
    if user.role not in {"ADMIN", "THU_KHO"}:
        raise HTTPException(403, "Role không được gửi kiểm kê.")
    if user.role == "THU_KHO":
        row = db.table("PHIEU_KIEM_KE").select("ma_kho").eq("ma_phieu_kiem", stocktake_id).limit(1).execute().data
        if not row:
            raise HTTPException(404, "Không tìm thấy phiên kiểm kê.")
        if row[0].get("ma_kho") != user.warehouse_id:
            raise HTTPException(403, "Phiên kiểm kê không thuộc kho được phân quyền.")
    try:
        result = db.rpc("submit_stocktake", {"p_ma_phieu_kiem": stocktake_id}).execute().data
        return {"data": result}
    except APIError as exc:
        raise HTTPException(409, "Không thể gửi phiên kiểm kê: " + str(exc.message or exc)) from None


@router.post("/stocktakes/{stocktake_id}/approve", response_model=StocktakeWorkflowResult,
             summary="Admin duyệt và cập nhật tồn kho từ kiểm kê")
def approve_stocktake(stocktake_id: int, user: User = Depends(current_user), db=Depends(get_supabase)):
    if user.role != "ADMIN":
        raise HTTPException(403, "Chỉ ADMIN được duyệt kiểm kê.")
    _require_employee(user)
    try:
        result = db.rpc("approve_stocktake", {"p_ma_phieu_kiem": stocktake_id, "p_nguoi_duyet": user.employee_id}).execute().data
        return {"data": result}
    except APIError as exc:
        raise HTTPException(409, "Không thể duyệt phiên kiểm kê: " + str(exc.message or exc)) from None


@router.get("/dispatches", summary="Danh sách phiếu xuất theo đơn hàng và kho")
def list_dispatches(user: User = Depends(current_user), db=Depends(get_supabase)):
    if user.role not in {"ADMIN", "THU_KHO"}:
        raise HTTPException(403, "Role không được xem phiếu xuất.")
    # Load the complete allocation of each order. The dispatch RPC is atomic for
    # the whole order, so a warehouse worker must not see a multi-warehouse order
    # as if only the visible subset could be dispatched.
    query = db.table("CT_DON_HANG").select("ma_donhang,sku,ma_kho_xuat,so_luong,ten_sp_luc_ban")
    lines = query.limit(1000).execute().data
    order_ids = list(dict.fromkeys(row["ma_donhang"] for row in lines))
    if not order_ids:
        return []
    orders = db.table("DON_HANG").select("ma_donhang,trang_thai,thoi_gian_dat,ten_nguoi_nhan").in_("ma_donhang", order_ids).execute().data
    order_map = {row["ma_donhang"]: row for row in orders}
    status_map = {"MOI": "Chờ xử lý", "XAC_NHAN": "Đã xác nhận", "DANG_CHUAN_BI": "Đang soạn", "DA_XUAT_KHO": "Đã xuất", "HOAN_THANH": "Hoàn tất", "HUY": "Đã hủy"}
    grouped: dict[str, dict] = {}
    for line in lines:
        order_id = line["ma_donhang"]
        order = order_map.get(order_id, {})
        item = grouped.setdefault(order_id, {"id": f"PX-{order_id}", "recordId": order_id, "order": order_id, "warehouse": f"Kho #{line['ma_kho_xuat']}", "items": "", "created": order.get("thoi_gian_dat"), "status": status_map.get(order.get("trang_thai"), order.get("trang_thai", "—")), "receiver": order.get("ten_nguoi_nhan") or "—", "_sku_count": 0, "_quantity": 0})
        item["_sku_count"] += 1
        item["_quantity"] += line["so_luong"]
    for item in grouped.values():
        if user.role == "THU_KHO":
            order_lines = [line for line in lines if line["ma_donhang"] == item["recordId"]]
            warehouses = {line["ma_kho_xuat"] for line in order_lines}
            if warehouses != {user.warehouse_id}:
                continue
        item["items"] = f"{item.pop('_sku_count')} SKU · {item.pop('_quantity')} SP"
    return list(grouped.values())


@router.get("/receipts/{receipt_id}", summary="Chi tiết phiếu nhập và các dòng hàng")
def receipt_detail(receipt_id: int, user: User = Depends(current_user), db=Depends(get_supabase)):
    if user.role not in {"ADMIN", "THU_KHO"}:
        raise HTTPException(403, "Role không được xem phiếu nhập.")
    header_rows = db.table("PHIEU_NHAP").select("*").eq("ma_phieu_nhap", receipt_id).limit(1).execute().data
    if not header_rows:
        raise HTTPException(404, "Không tìm thấy phiếu nhập.")
    header = header_rows[0]
    if user.role == "THU_KHO" and header.get("ma_kho") != user.warehouse_id:
        raise HTTPException(403, "Phiếu không thuộc kho được phân quyền.")
    lines = db.table("CT_PHIEU_NHAP").select("sku,so_luong_nhap,gia_nhap").eq("ma_phieu_nhap", receipt_id).order("sku").execute().data
    return {"header": header, "lines": lines}


@router.get("/transfers/{transfer_id}", summary="Chi tiết phiếu chuyển và các dòng hàng")
def transfer_detail(transfer_id: int, user: User = Depends(current_user), db=Depends(get_supabase)):
    if user.role not in {"ADMIN", "THU_KHO"}:
        raise HTTPException(403, "Role không được xem phiếu chuyển.")
    header_rows = db.table("PHIEU_CHUYEN_KHO").select("*").eq("ma_phieu_chuyen", transfer_id).limit(1).execute().data
    if not header_rows:
        raise HTTPException(404, "Không tìm thấy phiếu chuyển.")
    header = header_rows[0]
    if user.role == "THU_KHO" and header.get("ma_kho_xuat") != user.warehouse_id and header.get("ma_kho_nhan") != user.warehouse_id:
        raise HTTPException(403, "Phiếu không thuộc kho được phân quyền.")
    lines = db.table("CT_CHUYEN_KHO").select("sku,so_luong").eq("ma_phieu_chuyen", transfer_id).order("sku").execute().data
    return {"header": header, "lines": lines}


@router.post("/dispatches/{order_id}/dispatch", response_model=OrderDispatchResult,
             summary="Xuất kho theo đơn hàng và trừ tồn trong một transaction")
def dispatch_order(order_id: str, user: User = Depends(current_user), db=Depends(get_supabase)):
    _require_employee(user)
    try:
        result = db.rpc("dispatch_order", {"p_ma_donhang": order_id, "p_nguoi_xuat": user.employee_id, "p_ma_kho_duoc_phep": None if user.role == "ADMIN" else user.warehouse_id}).execute().data
        return result
    except APIError as exc:
        codes = {"P0060": (404, "Đơn hàng không tồn tại."), "P0061": (409, "Đơn hàng không ở trạng thái có thể xuất."), "P0062": (409, "Đơn hàng chưa có sản phẩm."), "P0063": (403, "Nhân viên xuất kho không còn hoạt động."), "P0064": (403, "Đơn hàng có sản phẩm ngoài kho được phân quyền."), "P0065": (409, "Kho không đủ tồn để xuất đơn hàng.")}
        status, detail = codes.get(str(exc.code or ""), (503, "Dịch vụ xuất kho chưa sẵn sàng."))
        raise HTTPException(status, detail) from None


@router.post("/receipts/draft", response_model=DraftWorkflowResult, status_code=201,
             summary="Tạo phiếu nhập nháp cùng các dòng hàng trong một transaction")
def create_receipt_draft(body: ReceiptDraftRequest, user: User = Depends(current_user), db=Depends(get_supabase)):
    _require_warehouse_scope(user, body.warehouse_id)
    try:
        result = db.rpc("create_receipt_draft", {
            "p_ma_ncc": body.supplier_id,
            "p_ma_kho": body.warehouse_id,
            "p_nguoi_tao": user.employee_id,
            "p_ghi_chu": body.note,
            "p_lines": [line.model_dump() for line in body.lines],
        }).execute().data
        return {"data": result}
    except APIError as exc:
        raise HTTPException(422, "Không thể tạo phiếu nhập nháp: " + str(exc.message or exc)) from None


@router.post("/transfers/draft", response_model=DraftWorkflowResult, status_code=201,
             summary="Tạo phiếu chuyển kho nháp cùng các dòng hàng trong một transaction")
def create_transfer_draft(body: TransferDraftRequest, user: User = Depends(current_user), db=Depends(get_supabase)):
    _require_warehouse_scope(user, body.source_warehouse_id)
    if user.role == "THU_KHO" and user.warehouse_id != body.source_warehouse_id:
        raise HTTPException(403, "Kho xuất không thuộc phạm vi được phân quyền.")
    try:
        result = db.rpc("create_transfer_draft", {
            "p_ma_kho_xuat": body.source_warehouse_id,
            "p_ma_kho_nhan": body.destination_warehouse_id,
            "p_nguoi_tao": user.employee_id,
            "p_ghi_chu": body.note,
            "p_lines": [line.model_dump() for line in body.lines],
        }).execute().data
        return {"data": result}
    except APIError as exc:
        raise HTTPException(422, "Không thể tạo phiếu chuyển nháp: " + str(exc.message or exc)) from None


@router.post("/receipts/{receipt_id}/confirm", response_model=ReceiptConfirmation,
             summary="Xác nhận phiếu nhập và cộng tồn trong một transaction")
def confirm_receipt(receipt_id: int, user: User = Depends(current_user), repository: WarehouseRepository = Depends(get_repository)):
    if user.role not in {"ADMIN", "THU_KHO"}:
        raise HTTPException(403, "Role không được xác nhận phiếu nhập.")
    _require_employee(user)
    try:
        return repository.confirm_receipt(receipt_id, user.employee_id, None if user.role == "ADMIN" else user.warehouse_id)
    except ReceiptWorkflowError as exc:
        raise HTTPException(exc.status_code, exc.detail) from None


@router.post("/receipts/{receipt_id}/cancel", response_model=ReceiptWorkflowResult,
             summary="Hủy phiếu nhập nháp, không thay đổi tồn kho")
def cancel_receipt(receipt_id: int, user: User = Depends(current_user), db=Depends(get_supabase)):
    _require_employee(user)
    try:
        result = db.rpc("cancel_receipt_draft", {"p_ma_phieu_nhap": receipt_id, "p_nguoi_huy": user.employee_id, "p_ma_kho_duoc_phep": None if user.role == "ADMIN" else user.warehouse_id}).execute().data
        return result
    except APIError as exc:
        raise HTTPException(409, "Không thể hủy phiếu nhập: " + str(exc.message or exc)) from None


@router.put("/receipts/{receipt_id}/draft", response_model=DraftWorkflowResult,
            summary="Cập nhật phiếu nhập nháp và các dòng hàng trong một transaction")
def update_receipt_draft(receipt_id: int, body: ReceiptDraftRequest, user: User = Depends(current_user), db=Depends(get_supabase)):
    _require_warehouse_scope(user, body.warehouse_id)
    _require_employee(user)
    try:
        result = db.rpc("update_receipt_draft", {"p_ma_phieu_nhap": receipt_id, "p_ma_ncc": body.supplier_id, "p_ma_kho": body.warehouse_id, "p_nguoi_cap_nhat": user.employee_id, "p_ghi_chu": body.note, "p_lines": [line.model_dump() for line in body.lines]}).execute().data
        return {"data": result}
    except APIError as exc:
        raise HTTPException(409, "Không thể sửa phiếu nhập: " + str(exc.message or exc)) from None


def get_transfer_repository():
    return TransferRepository(get_supabase())


def _require_employee(user: User):
    if user.role not in {"ADMIN", "THU_KHO"} or not user.employee_id:
        raise HTTPException(403, "Role không được xử lý phiếu chuyển kho.")
    if user.role == "THU_KHO" and user.warehouse_id is None:
        raise HTTPException(403, "Tài khoản thủ kho chưa được phân công kho.")


@router.post("/transfers/{transfer_id}/dispatch", response_model=TransferWorkflowResult,
             summary="Giao chuyển kho và trừ tồn kho xuất trong một transaction")
def dispatch_transfer(transfer_id: int, user: User = Depends(current_user), repository: TransferRepository = Depends(get_transfer_repository)):
    _require_employee(user)
    try:
        return repository.dispatch(transfer_id, user.employee_id, None if user.role == "ADMIN" else user.warehouse_id)
    except TransferWorkflowError as exc:
        raise HTTPException(exc.status_code, exc.detail) from None


@router.post("/transfers/{transfer_id}/receive", response_model=TransferWorkflowResult,
             summary="Nhận chuyển kho và cộng tồn kho nhận trong một transaction")
def receive_transfer(transfer_id: int, user: User = Depends(current_user), repository: TransferRepository = Depends(get_transfer_repository)):
    _require_employee(user)
    try:
        return repository.receive(transfer_id, user.employee_id, None if user.role == "ADMIN" else user.warehouse_id)
    except TransferWorkflowError as exc:
        raise HTTPException(exc.status_code, exc.detail) from None


@router.post("/transfers/{transfer_id}/cancel", response_model=TransferWorkflowResult,
             summary="Hủy phiếu chuyển kho nháp, không thay đổi tồn kho")
def cancel_transfer(transfer_id: int, user: User = Depends(current_user), db=Depends(get_supabase)):
    _require_employee(user)
    try:
        result = db.rpc("cancel_transfer_draft", {"p_ma_phieu_chuyen": transfer_id, "p_nguoi_huy": user.employee_id, "p_ma_kho_duoc_phep": None if user.role == "ADMIN" else user.warehouse_id}).execute().data
        return result
    except APIError as exc:
        raise HTTPException(409, "Không thể hủy phiếu chuyển: " + str(exc.message or exc)) from None


@router.put("/transfers/{transfer_id}/draft", response_model=DraftWorkflowResult,
            summary="Cập nhật phiếu chuyển nháp và các dòng hàng trong một transaction")
def update_transfer_draft(transfer_id: int, body: TransferDraftRequest, user: User = Depends(current_user), db=Depends(get_supabase)):
    _require_warehouse_scope(user, body.source_warehouse_id)
    _require_employee(user)
    try:
        result = db.rpc("update_transfer_draft", {"p_ma_phieu_chuyen": transfer_id, "p_ma_kho_xuat": body.source_warehouse_id, "p_ma_kho_nhan": body.destination_warehouse_id, "p_nguoi_cap_nhat": user.employee_id, "p_ghi_chu": body.note, "p_lines": [line.model_dump() for line in body.lines]}).execute().data
        return {"data": result}
    except APIError as exc:
        raise HTTPException(409, "Không thể sửa phiếu chuyển: " + str(exc.message or exc)) from None
