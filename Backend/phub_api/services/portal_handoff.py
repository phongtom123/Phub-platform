import hashlib
import secrets

from fastapi import HTTPException
from postgrest.exceptions import APIError

from phub_api.config.runtime import frontend_origins
from phub_api.models.user import User
from phub_api.repositories.auth import AuthRepository
from phub_api.schemas.portal_handoff import HandoffExchange
from phub_api.services.auth import AuthService


class PortalHandoffService:
    def __init__(self, repository: AuthRepository):
        self.repository = repository

    @staticmethod
    def origins(source: str, target: str):
        allowed = frontend_origins()
        if source not in allowed or target not in allowed:
            raise HTTPException(403, "Địa chỉ chuyển phiên không được phép.")

    @staticmethod
    def database_call(operation, parameters):
        try:
            return operation(parameters)
        except APIError as error:
            if str(error.code) in {"PGRST202", "42P01", "42883"}:
                raise HTTPException(503, "Database chưa cài migration staff_portal_handoff.") from None
            if str(error.code) == "PT401":
                raise HTTPException(401, "Phiên đăng nhập không còn hợp lệ.") from None
            raise

    def create(self, user: User, version: str, source: str, target: str):
        self.origins(source, target)
        if user.role not in {"ADMIN", "NHAN_VIEN"}:
            raise HTTPException(403, "Chỉ tài khoản nội bộ được chuyển phiên giữa admin và kho.")
        code = secrets.token_urlsafe(32)
        self.database_call(self.repository.create_handoff, {
            "p_account_id": user.account_id,
            "p_code_hash": hashlib.sha256(code.encode()).hexdigest(),
            "p_credential_version": version,
            "p_source_origin": source,
            "p_target_origin": target,
            "p_role": user.role,
        })
        return {"code": code, "expires_in": 60}

    def exchange(self, body: HandoffExchange, source: str):
        self.origins(source, body.target_origin)
        saved = self.database_call(self.repository.consume_handoff, {
            "p_code_hash": hashlib.sha256(body.code.encode()).hexdigest(),
            "p_source_origin": source,
            "p_target_origin": body.target_origin,
            "p_role": body.role,
        })
        if not isinstance(saved, dict) or not saved.get("account_id") or not saved.get("credential_version"):
            raise HTTPException(401, "Mã chuyển phiên đã hết hạn hoặc đã được sử dụng. Vui lòng đăng nhập lại.")
        # Recheck account status, password revision, role and warehouse after consuming the code.
        user = AuthService(self.repository).current_user({"sub": saved["account_id"], "ver": saved["credential_version"]})
        if user.role != body.role:
            raise HTTPException(403, "Vai trò đã thay đổi; vui lòng đăng nhập lại.")
        return user, saved["credential_version"]
