import Link from "next/link";
export default function DetailView({ section, id }: { section: string; id: string; edit?: boolean }) {
  return <section><p>Chi tiết bản ghi được tải từ trang dữ liệu API, không dùng dữ liệu mẫu.</p><p>Mã bản ghi: {id}</p><Link href={`/${section}`}>Quay lại danh sách</Link></section>;
}
