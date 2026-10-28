-- OPTIONAL DEMO DATA: run only when explicitly requested, never during deployment.
-- Inserts only PHAN_HOI; uses existing SEED_ customers/admin, no real-user tickets.
-- Titles/content identify demo data. No order/product links or outbound messages.
-- A repeated run skips matching demo titles for the same sample customer.
with sample_customers as (
  select ma_kh,row_number() over (order by ma_kh) as position
  from public."KHACH_HANG" where ma_kh like 'SEED\_%' escape '\'
), sample_admin as (
  select n.ma_nhan_vien from public."NHAN_VIEN" n
  join public."TAI_KHOAN" a on a.ma_nhan_vien=n.ma_nhan_vien
  where n.ma_nhan_vien like 'SEED\_%' escape '\'
    and n.loai_nhan_vien='ADMIN' and n.trang_thai=1 and a.trang_thai=1
  order by n.ma_nhan_vien limit 1
), samples(position,title,content,status,priority,reply,age) as (
  values
  (1,'Tư vấn lựa chọn sản phẩm',
   'Tôi cần tư vấn lựa chọn máy tính phục vụ học tập và làm việc văn phòng. Mong được hướng dẫn cấu hình phù hợp.',
   'MOI','BINH_THUONG',null,interval '20 minutes'),
  (2,'Không tải được ảnh sản phẩm',
   'Khi mở trang chi tiết, hình ảnh sản phẩm chưa hiển thị. Tôi đã tải lại trang nhưng vẫn chưa xem được ảnh.',
   'MOI','CAO',null,interval '45 minutes'),
  (3,'Cần kiểm tra tiến độ giao hàng',
   'Tôi muốn được hướng dẫn kiểm tra trạng thái giao hàng và thời gian dự kiến nhận hàng.',
   'DANG_XU_LY','CAO','[Dữ liệu demo] Đã tiếp nhận yêu cầu mẫu. Nhân viên đang kiểm tra thông tin để hướng dẫn khách.',interval '2 hours'),
  (4,'Không áp dụng được mã giảm giá',
   'Trang thanh toán thông báo mã giảm giá không hợp lệ. Nhờ bộ phận hỗ trợ hướng dẫn kiểm tra điều kiện sử dụng mã.',
   'DANG_XU_LY','KHAN_CAP','[Dữ liệu demo] Đang kiểm tra tình huống sử dụng mã và điều kiện đơn hàng trong kịch bản demo.',interval '4 hours'),
  (5,'Hướng dẫn xem hóa đơn mua hàng',
   'Tôi chưa biết cách xem thông tin hóa đơn của đơn hàng trong tài khoản. Nhờ bộ phận hỗ trợ hướng dẫn.',
   'DA_GIAI_QUYET','BINH_THUONG','[Dữ liệu demo] Đã hướng dẫn khách mở tài khoản, chọn lịch sử đơn hàng và xem hóa đơn của đơn tương ứng. Kịch bản đã được giải quyết.',interval '1 day'),
  (6,'Hướng dẫn cập nhật thông tin nhận hàng',
   'Tôi muốn cập nhật địa chỉ mặc định cho các lần mua tiếp theo. Thay đổi này có tác động đến đơn hàng đã đặt hay không?',
   'DA_DONG','THAP','[Dữ liệu demo] Đã giải thích cách cập nhật thông tin nhận hàng mặc định cho các đơn mới; đơn đã đặt giữ thông tin đã xác nhận. Đóng ticket mẫu.',interval '2 days')
), inserted as (
  insert into public."PHAN_HOI"
    (ma_kh,tieu_de,noi_dung,trang_thai,muc_do_uu_tien,nguoi_xu_ly,
     phan_hoi_quan_ly,ngay_phan_hoi,ngay_tao,cap_nhat_luc)
  select c.ma_kh,'[DEMO-PHUB] '||s.title,
    '[Dữ liệu demo để kiểm thử giao diện, không phải phản hồi thực tế.] '||s.content,
    s.status,s.priority,
    case when s.status<>'MOI' then (select ma_nhan_vien from sample_admin) end,
    s.reply,case when s.reply is not null then statement_timestamp()-interval '10 minutes' end,
    statement_timestamp()-s.age,
    case when s.reply is not null then statement_timestamp()-interval '10 minutes' else statement_timestamp()-s.age end
  from samples s join sample_customers c on c.position=s.position
  where not exists (select 1 from public."PHAN_HOI" p
    where p.ma_kh=c.ma_kh and p.tieu_de='[DEMO-PHUB] '||s.title)
  returning ma_phan_hoi,tieu_de,trang_thai,muc_do_uu_tien
)
select * from inserted order by tieu_de;
