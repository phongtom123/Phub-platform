"""Local manual testing only. Requires the isolated fixture server's explicit mode.

Never imported by app.main. No Supabase credentials or password implementation.
"""
import html
import os
import secrets
from datetime import datetime
from urllib.parse import urlsplit

from fastapi import HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse

from scripts.shopping_e2e_app import app, lock, reset, sessions, state

UI = os.getenv("PHUB_DEMO_UI_ORIGIN", "http://127.0.0.1:13001")
ui_url = urlsplit(UI)
if ui_url.scheme != "http" or ui_url.hostname != "127.0.0.1" or ui_url.path or ui_url.query or ui_url.fragment or ui_url.username or ui_url.password:
    raise RuntimeError("Manual fixtures require a loopback UI origin")


def control_origin(request: Request):
    origin = request.headers.get("origin")
    if origin != str(request.base_url).rstrip("/") or request.headers.get("sec-fetch-site") == "cross-site":
        raise HTTPException(403, "Open the local manual testing page")


@app.get("/__manual", response_class=HTMLResponse, include_in_schema=False)
def manual_home():
    with lock:
        orders = list(state["orders"].values())
        entries = "".join(
            '<li><a href="' + UI + '/main/orders/' + html.escape(order["id"], quote=True)
            + '">' + html.escape(order["id"]) + '</a> — ' + html.escape(order["owner"]) + '</li>'
            for order in orders
        ) or "<li>Chưa có đơn thử.</li>"
    return '''<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>PHUB — chạy thử mua hàng</title><style>body{font-family:Arial,sans-serif;max-width:780px;margin:32px auto;padding:0 20px;line-height:1.65}a{color:#075cad}button{padding:10px 16px;cursor:pointer}aside{background:#fff3cf;padding:16px;border-radius:8px}form{margin:12px 0}</style>
    <h1>Test giao diện khách hàng</h1><aside><b>Dữ liệu thử riêng trong RAM.</b> Phiên khách được giả lập; không kiểm tra mật khẩu thật, không ghi Supabase. Khởi động lại sẽ mất đơn thử. Phần đăng nhập của nhóm được giữ nguyên.</aside>
    <h2>1. Chọn khách mẫu và mua hàng</h2><p><a href="/__manual/login/A">Mở giao diện với khách A</a> · <a href="/__manual/login/B">Mở với khách B để kiểm tra quyền xem đơn</a> · <a href="/__manual/logout">Xem khi chưa đăng nhập</a></p>
    <p>Sản phẩm: <b>SKU-A</b>, tồn 5 chiếc, giá 100.000,10 ₫ trước thuế. Voucher <b>SAVE10</b> giảm 10%. Mở sản phẩm → thêm giỏ → checkout → nhập người nhận → xác nhận đơn. Thuế 10% chỉ áp khi lập hóa đơn.</p>
    <h2>2. Test thanh toán sau khi tạo đơn</h2><p>Đơn mới chưa có giao dịch. Chọn một kịch bản dưới đây cho <b>đơn mới nhất của khách A</b>, rồi mở chi tiết đơn và bấm cập nhật thanh toán. Các nút chỉ thay dữ liệu mẫu trong RAM.</p>
    <form method="post" action="/__manual/payment/pending"><button>Giao dịch đang chờ</button></form>
    <form method="post" action="/__manual/payment/success"><button>Giao dịch thành công</button></form>
    <form method="post" action="/__manual/payment/refund"><button>Giao dịch hoàn tiền</button></form>
    <h2>Đơn đang có</h2><ul>''' + entries + '''</ul>
    <p><a href="/docs">Swagger backend thử</a></p>
    <form method="post" action="/__manual/reset"><button>Reset dữ liệu thử</button></form>
    <p>Reset xóa các đơn trong RAM, giữ phiên khách. Giỏ trong trình duyệt có thể chỉnh/xóa qua giao diện.</p></html>'''


@app.get("/__manual/login/{customer}", include_in_schema=False)
def login(customer: str):
    if customer not in {"A", "B"}:
        raise HTTPException(404)
    token = secrets.token_urlsafe(32)
    with lock:
        sessions[token] = f"KH-{customer}"
    response = RedirectResponse(UI + "/main/product", status_code=303)
    response.set_cookie("phub-e2e-session", token, httponly=True, samesite="strict")
    return response


@app.get("/__manual/logout", include_in_schema=False)
def logout(request: Request):
    with lock:
        sessions.pop(request.cookies.get("phub-e2e-session"), None)
    response = RedirectResponse(UI + "/main/product", status_code=303)
    response.delete_cookie("phub-e2e-session")
    return response


@app.post("/__manual/reset", include_in_schema=False)
def reset_data(request: Request):
    control_origin(request)
    with lock:
        reset()
    return RedirectResponse("/__manual", status_code=303)


@app.post("/__manual/payment/{kind}", include_in_schema=False)
def payment(kind: str, request: Request):
    control_origin(request)
    if kind not in {"pending", "success", "refund"}:
        raise HTTPException(404)
    with lock:
        orders = [order for order in state["orders"].values() if order["owner"] == "KH-A"]
        if not orders:
            return HTMLResponse('<meta charset="utf-8"><p>Hãy tạo đơn bằng khách A trước.</p><a href="/__manual">Quay lại</a>', status_code=409)
        order = orders[-1]
        row = {
            "so_tien": order["total"],
            "loai_giao_dich": "HOAN_TIEN" if kind == "refund" else "THU",
            "phuong_thuc": "CHUYEN_KHOAN",
            "trang_thai": "CHO_XU_LY" if kind == "pending" else "THANH_CONG",
            "thoi_gian": datetime.now().isoformat(timespec="seconds"),
            "owned_order": {"ma_donhang": order["id"], "ma_kh": order["owner"]},
            "ma_giao_dich": "PRIVATE-MANUAL-REFERENCE",
            "ma_thanh_toan": "PRIVATE-MANUAL-PAYMENT-ID",
        }
        state["transactions"][order["id"]] = [row, dict(row, loai_giao_dich="THU")] if kind == "refund" else [row]
    return RedirectResponse("/__manual", status_code=303)
