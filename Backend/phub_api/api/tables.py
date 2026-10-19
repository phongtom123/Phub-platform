from fastapi import APIRouter

from phub_api.controllers import tables
from phub_api.schemas.api_contracts import ResourceMetadata
from phub_api.schemas.api_contracts import READ_ERRORS, WRITE_ERRORS, error_response

router = APIRouter(prefix="/api/data", tags=["Tables"])

router.get("/resources", summary="Danh mục bảng và trường mà role hiện tại được sử dụng",
            response_model=list[ResourceMetadata], responses=READ_ERRORS)(tables.resources)

router.get("/{resource}", responses=READ_ERRORS)(tables.read_rows)

router.post("/{resource}", status_code=201, responses=WRITE_ERRORS)(tables.create_row)

router.patch("/{resource}", responses={**WRITE_ERRORS, 404: error_response(404, "Bản ghi không tồn tại.")})(tables.update_row)
