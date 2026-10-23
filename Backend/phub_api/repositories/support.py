from phub_api.repositories.admin_accounts import literal_search

PUBLIC_COLUMNS = 'ma_phan_hoi,tieu_de,noi_dung,ma_sp,ma_donhang,trang_thai,phan_hoi_quan_ly,ngay_phan_hoi,ngay_tao,cap_nhat_luc'
ADMIN_COLUMNS = PUBLIC_COLUMNS + ',ma_kh,muc_do_uu_tien,nguoi_xu_ly,khach:KHACH_HANG(ten_kh),nhan_vien:NHAN_VIEN(ho_ten)'


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
            request = request.or_(literal_search(query, ('tieu_de', 'noi_dung')))
        return request.order('ngay_tao', desc=True).order('ma_phan_hoi').range((page - 1) * page_size, page * page_size - 1).execute()

    def detail(self, ticket_id, customer_id=None):
        request = self.db.table('PHAN_HOI').select(PUBLIC_COLUMNS if customer_id else ADMIN_COLUMNS).eq('ma_phan_hoi', str(ticket_id))
        if customer_id:
            request = request.eq('ma_kh', customer_id)
        return request.limit(1).execute().data

    def create(self, actor_id, payload):
        return self.db.rpc('customer_create_feedback_v1', {'p_actor_account_id': actor_id, 'p_payload': payload}).execute().data

    def update(self, actor_id, ticket_id, changes):
        return self.db.rpc('admin_update_feedback_v1', {
            'p_actor_account_id': actor_id, 'p_feedback_id': str(ticket_id), 'p_changes': changes,
        }).execute().data
