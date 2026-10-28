from datetime import date
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response
from starlette.concurrency import run_in_threadpool

from phub_api.dependencies.admin_operations import get_service
from phub_api.dependencies.origin import check_origin
from phub_api.schemas.admin_operations import Command, CommandResult, Resource

router = APIRouter(prefix='/api/admin/operations', tags=['Admin · Vận hành'])


@router.get('/read/{kind}', summary='Thống kê, tìm kiếm, thông báo, cài đặt và lịch sử quản trị')
def read(kind: Literal['summary', 'search', 'notifications', 'settings', 'history', 'messages'], response: Response,
         q: str = Query('', max_length=100), record_id: str | None = Query(None, max_length=200),
         resource: str | None = Query(None, max_length=30), page: int = Query(1, ge=1),
         start: date | None = None, end: date | None = None,
         service=Depends(get_service)):
    if start and end and start > end:
        raise HTTPException(422, 'Ngày bắt đầu phải trước ngày kết thúc.')
    response.headers['Cache-Control'] = 'no-store'
    return service.read(kind, {'q': q.strip(), 'record_id': record_id, 'resource': resource, 'page': page,
                               'start': start.isoformat() if start else None, 'end': end.isoformat() if end else None})


@router.post('/{resource}', response_model=CommandResult, summary='Thực hiện nghiệp vụ quản trị trong một transaction')
async def command(resource: Resource, body: Command, request: Request, response: Response,
                  idempotency_key: UUID = Header(alias='Idempotency-Key'), service=Depends(get_service)):
    check_origin(request)
    if idempotency_key.version != 4:
        raise HTTPException(422, 'Idempotency-Key phải là UUID v4.')
    result = await run_in_threadpool(service.command, resource, body, idempotency_key)
    response.headers['Cache-Control'] = 'no-store'
    response.headers['Idempotency-Replayed'] = str(result.get('replayed', False)).lower()
    return result
