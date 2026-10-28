import re
from uuid import UUID

from phub_api.repositories.admin_accounts import literal_search

PUBLIC_COLUMNS = 'ma_phan_hoi,tieu_de,noi_dung,ma_sp,ma_donhang,trang_thai,phan_hoi_quan_ly,ngay_phan_hoi,ngay_tao,cap_nhat_luc'
ADMIN_COLUMNS = PUBLIC_COLUMNS + ',ma_kh,muc_do_uu_tien,nguoi_xu_ly,khach:KHACH_HANG(ten_kh),nhan_vien:NHAN_VIEN(ho_ten)'


def ticket_id_filter(query: str) -> str | None:
    """Match the visible PH-XXXXXXXX code without casting the UUID column to text."""
    value = query.strip()
    if value[:3].lower() == 'ph-':
        value = value[3:]
    if re.fullmatch(r'[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}', value):
        return f'ma_phan_hoi.eq.{UUID(value)}'
    if not re.fullmatch(r'[0-9a-fA-F]{1,8}', value):
        return None
    shift = (32 - len(value)) * 4
    lower = int(value, 16) << shift
    upper = (int(value, 16) + 1) << shift
    start = f'ma_phan_hoi.gte.{UUID(int=lower)}'
    if upper == 1 << 128:
        return start
    return f'and({start},ma_phan_hoi.lt.{UUID(int=upper)})'


class SupportRepository:
    def __init__(self, db):
        self.db = db

    def page(self, customer_id, page, page_size, status, priority, query):
        request = self.db.table('PHAN_HOI').select(PUBLIC_COLUMNS if customer_id else ADMIN_COLUMNS, count='exact')
        if customer_id:
            request = request.eq('ma_kh', customer_id)
        if status:
            request = request.eq('trang_thai', status)
        if priority:
            request = request.eq('muc_do_uu_tien', priority)
        if query:
            search = literal_search(query, ('tieu_de', 'noi_dung'))
            identifier = ticket_id_filter(query)
            request = request.or_(f'{search},{identifier}' if identifier else search)
        return request.order('ngay_tao', desc=True).order('ma_phan_hoi').range((page - 1) * page_size, page * page_size - 1).execute()

    def detail(self, ticket_id, customer_id=None):
        request = self.db.table('PHAN_HOI').select(PUBLIC_COLUMNS if customer_id else ADMIN_COLUMNS).eq('ma_phan_hoi', str(ticket_id))
        if customer_id:
            request = request.eq('ma_kh', customer_id)
        return request.limit(1).execute().data

    def create(self, actor_id, payload):
        return self.db.rpc('customer_create_feedback_v1', {'p_actor_account_id': actor_id, 'p_payload': payload}).execute().data

    def update(self, actor_id, ticket_id, changes):
        return self.db.rpc('admin_update_feedback_thread_v1', {
            'p_actor_account_id': actor_id, 'p_feedback_id': str(ticket_id), 'p_changes': changes,
        }).execute().data

    def history(self, actor_id, ticket_id, page, text=None, key=None):
        return self.db.rpc('customer_feedback_messages_v1', {
            'p_actor': actor_id, 'p_ticket': str(ticket_id), 'p_page': page,
            'p_text': text, 'p_key': str(key) if key else None,
        }).execute().data
