"use client";
import Link from "next/link";
export default function FormView({ section }: { section: string }) {
  return <section className="form-panel"><h2>Chưa có API tạo chứng từ</h2><p>Không thể lưu phiếu hoặc cập nhật tồn kho khi nghiệp vụ chưa được triển khai.</p><Link className="button" href={`/${section}`}>Quay lại danh sách</Link></section>;
}
