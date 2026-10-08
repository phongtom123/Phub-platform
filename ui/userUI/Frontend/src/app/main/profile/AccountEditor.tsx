"use client";
import type { DemoAccount, EditorKind } from "./accountData";
interface AccountEditorProps { kind: EditorKind; account: DemoAccount; onSave: (patch: Partial<DemoAccount>) => void; onClose: () => void }
export function AccountEditor({ onClose }: AccountEditorProps) {
  return <section role="dialog" aria-label="Chỉnh sửa tài khoản"><p>Biểu mẫu này chưa kết nối API cập nhật tài khoản.</p><button onClick={onClose}>Đóng</button></section>;
}
