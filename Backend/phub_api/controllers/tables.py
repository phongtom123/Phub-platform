"""HTTP adapter for table APIs; no database query builders."""
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from starlette.concurrency import run_in_threadpool

from phub_api.dependencies.auth import current_user
from phub_api.dependencies.origin import check_origin
from phub_api.dependencies.tables import get_service
from phub_api.models.resources import ResourceName
from phub_api.models.user import User
from phub_api.schemas.api_contracts import READ_ERRORS, ResourceMetadata, WRITE_ERRORS, error_response
from phub_api.services.tables import TablesService, access, resource_metadata


router = APIRouter(prefix="/api/data", tags=["Tables"])

@router.get("/resources", summary="Danh mục bảng và trường mà role hiện tại được sử dụng",
            response_model=list[ResourceMetadata], responses=READ_ERRORS)
def resources(response: Response, user: User = Depends(current_user)):
    response.headers["Cache-Control"] = "no-store"
    return resource_metadata(user)


@router.get("/{resource}", responses=READ_ERRORS)
def read_rows(resource: ResourceName, response: Response, page: int = Query(1, ge=1),
              page_size: int = Query(20, ge=1, le=100), q: str = Query("", max_length=100),
              key: str | None = Query(None, max_length=6000),
              order_id: str | None = Query(None, min_length=1, max_length=100),
              filters: str | None = Query(None, max_length=4000),
              service: TablesService = Depends(get_service)):
    result = service.read(resource.value, page, page_size, q, key, order_id, filters)
    response.headers["Cache-Control"] = "no-store"
    return result


async def json_body(request: Request):
    try:
        return await request.json()
    except ValueError:
        raise HTTPException(422, "Body phải là JSON hợp lệ.") from None


@router.post("/{resource}", status_code=201, responses=WRITE_ERRORS)
async def create_row(resource: ResourceName, request: Request, response: Response,
                     service: TablesService = Depends(get_service)):
    check_origin(request)
    access(resource.value, service.user, write=True)
    result = await run_in_threadpool(service.create, resource.value, await json_body(request))
    response.headers["Cache-Control"] = "no-store"
    return result


@router.patch("/{resource}", responses={**WRITE_ERRORS, 404: error_response(404, "Bản ghi không tồn tại.")})
async def update_row(resource: ResourceName, request: Request, response: Response, key: str = Query(..., max_length=6000),
                     service: TablesService = Depends(get_service)):
    check_origin(request)
    access(resource.value, service.user, write=True)
    result = await run_in_threadpool(service.update, resource.value, key, await json_body(request))
    response.headers["Cache-Control"] = "no-store"
    return result
