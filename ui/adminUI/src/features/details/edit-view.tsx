import Link from "next/link";
import { getSectionHref } from "@/src/lib/admin-navigation";
export default function EditView({ section, id }: { section: string; id: string }) {
  return <section><p>Không sử dụng biểu mẫu dữ liệu mẫu. Hãy mở bản ghi trong trang dữ liệu API để chỉnh sửa.</p><Link href={getSectionHref(section)}>Quay lại danh sách</Link><p>Mã bản ghi: {id}</p></section>;
}
