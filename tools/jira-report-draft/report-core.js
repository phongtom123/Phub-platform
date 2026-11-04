(function (root) {
  "use strict";

  const KEY = /^[A-Z][A-Z0-9_]*-\d+$/;
  const normalize = (text) => String(text || "").replace(/\s+/g, " ").trim();

  function issueKey(value) {
    const key = String(value || "").trim().toUpperCase();
    return KEY.test(key) ? key : null;
  }

  function issueKeyFromUrl(value) {
    try {
      const url = new URL(value);
      for (const name of ["selectedIssue", "issueKey"]) {
        const key = issueKey(url.searchParams.get(name));
        if (key) return key;
      }
      const match = url.pathname.match(/\/(?:browse|issues)\/([A-Z][A-Z0-9_]*-\d+)(?:\/|$)/i);
      return match ? issueKey(match[1]) : null;
    } catch {
      return null;
    }
  }

  function adfText(node, depth = 0) {
    if (!node || depth > 30) return "";
    if (typeof node === "string") return node;
    if (Array.isArray(node)) return node.map((child) => adfText(child, depth + 1)).join("");
    if (typeof node !== "object") return "";
    if (node.type === "text") return typeof node.text === "string" ? node.text : "";
    if (node.type === "hardBreak") return "\n";
    if (node.type === "mention") return String(node.attrs?.text || "");
    if (node.type === "inlineCard") return String(node.attrs?.url || "");
    const text = adfText(node.content, depth + 1);
    return ["paragraph", "heading", "listItem", "codeBlock", "tableRow"].includes(node.type)
      ? text + "\n" : text;
  }

  function buildReport(issue, options = {}) {
    const key = issueKey(issue?.key);
    if (!key) throw new Error("Mã ticket Jira không hợp lệ.");
    const fields = issue.fields || {};
    const title = String(fields.summary || issue.summary || "").slice(0, 500);
    const status = String(fields.status?.name || "—");
    const date = (options.date || new Date()).toISOString();
    const url = new URL("/browse/" + key, options.origin).href;
    const description = adfText(fields.description).trim().slice(0, 4000);

    if (options.language === "vi") {
      return [
        "BÁO CÁO KIỂM TRA — " + key,
        "Ticket: " + title, "Liên kết: " + url,
        "Trạng thái Jira: " + status, "Tạo khung lúc: " + date,
        "Kết quả kiểm tra: CHƯA KIỂM TRA — đây chỉ là khung báo cáo.",
        "", "1. Môi trường", "- Người kiểm tra: [điền tên]",
        "- Môi trường / URL: [điền]", "- Build / phiên bản: [điền]",
        "- Thiết bị / OS / trình duyệt: [điền]",
        "", "2. Phạm vi và tiêu chí chấp nhận", "- [đối chiếu yêu cầu trong ticket]",
        ...(description ? ["", "Mô tả ticket để tham khảo (chưa xác minh):", description] : []),
        "", "3. Các bước kiểm tra", "TC-01: [tên trường hợp kiểm tra]",
        "- Điều kiện ban đầu: [điền]", "- Các bước: [điền]",
        "- Kết quả mong đợi: [điền]", "- Kết quả thực tế: [chưa kiểm tra]",
        "- Kết luận: CHƯA KIỂM TRA", "- Bằng chứng / ảnh / log: [điền sau khi thực hiện]",
        "", "4. Kiểm tra hồi quy", "- [các luồng liên quan cần kiểm tra]",
        "", "5. Vấn đề và giới hạn", "- [điền lỗi, điều kiện chưa kiểm tra hoặc vướng mắc]",
        "", "6. Kết luận và bước tiếp theo",
        "Chưa có kết luận. Điền kết quả thực tế và kiểm tra nội dung trước khi tự nhấn Save.",
      ].join("\n");
    }

    return [
      "QA TEST REPORT — " + key,
      "Ticket: " + title, "Link: " + url,
      "Jira status: " + status, "Template created at: " + date,
      "Test result: NOT TESTED — report template only.",
      "", "1. Environment", "- Tester: [name]", "- Environment / URL: [fill in]",
      "- Build / version: [fill in]", "- Device / OS / browser: [fill in]",
      "", "2. Scope and acceptance criteria", "- [check the requirements in the ticket]",
      ...(description ? ["", "Ticket description for reference (not verified):", description] : []),
      "", "3. Test execution", "TC-01: [test case name]",
      "- Preconditions: [fill in]", "- Steps: [fill in]",
      "- Expected result: [fill in]", "- Actual result: [not tested]",
      "- Result: NOT TESTED", "- Evidence / screenshots / logs: [add after testing]",
      "", "4. Regression checks", "- [related flows to check]",
      "", "5. Issues and limitations", "- [failures, untested conditions or blockers]",
      "", "6. Conclusion and next steps",
      "No conclusion yet. Record actual results and review this draft before manually clicking Save.",
    ].join("\n");
  }

  function visible(element) {
    if (!element.isConnected || !element.getClientRects().length || element.closest("[hidden]")) return false;
    const style = element.ownerDocument.defaultView.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  }

  function commentContext(element) {
    // Do not pick an unrelated description editor just because it is editable.
    const ancestors = [];
    for (let node = element, depth = 0; node && depth < 6; node = node.parentElement, depth++) {
      if (["BODY", "HTML", "MAIN", "FORM"].includes(node.tagName) && node !== element) break;
      const descriptor = ["id", "data-testid", "aria-label", "placeholder", "data-placeholder", "data-editor-container-id", "aria-labelledby"]
        .map((name) => node.getAttribute(name) || "").join(" ");
      const labelledBy = node.getAttribute("aria-labelledby");
      const labelText = labelledBy ? labelledBy.split(/\s+/).map((id) =>
        element.ownerDocument.getElementById(id)?.textContent || "").join(" ") : "";
      ancestors.push(descriptor + " " + labelText);
    }
    // Explicit field identity takes priority over a surrounding comment section.
    if (ancestors.some((text) => /description|summary|mô tả|tóm tắt/i.test(text))) return false;
    return ancestors.some((text) => /comment|bình luận|nhận xét/i.test(text));
  }

  function commentEditors(doc) {
    return [...doc.querySelectorAll('textarea, [contenteditable="true"], [contenteditable="plaintext-only"]')]
      .filter((element) => visible(element) && !element.disabled && !element.readOnly
        && element.getAttribute("aria-disabled") !== "true" && commentContext(element));
  }

  function findCommentEditor(doc, preferred) {
    const editors = commentEditors(doc);
    if (preferred && editors.includes(preferred)) return preferred;
    if (editors.length > 1) throw new Error("Có nhiều ô Comment đang mở. Bấm vào đúng ô muốn dùng rồi thử lại.");
    return editors[0] || null;
  }

  function findCommentOpener(doc) {
    return [...doc.querySelectorAll('button, [role="button"]')].find((element) => {
      if (!visible(element) || element.disabled) return false;
      const label = normalize(element.getAttribute("aria-label") || element.textContent)
        .replace(/[.…]+$/g, "").trim();
      return /^(add a comment|write a comment|thêm bình luận|thêm nhận xét|viết bình luận)$/i.test(label);
    }) || null;
  }

  function editorText(element) {
    return element.tagName === "TEXTAREA" ? element.value : element.innerText;
  }

  function insertDraft(element, text) {
    if (!visible(element)) throw new Error("Ô Comment không còn hiển thị. Mở lại rồi thử lại.");
    if (!normalize(text)) throw new Error("Khung báo cáo đang trống.");
    if (normalize(editorText(element))) {
      throw new Error("Comment đã có nội dung. Tool giữ nguyên bản nháp; bạn có thể sao chép khung để chèn thủ công.");
    }
    const doc = element.ownerDocument;
    const win = doc.defaultView;
    element.focus();
    if (!visible(element)) throw new Error("Jira vừa thay trình soạn thảo. Bấm vào ô Comment mới rồi thử lại.");
    if (normalize(editorText(element))) throw new Error("Jira vừa khôi phục bản nháp có sẵn. Tool giữ nguyên nội dung đó.");
    if (element.tagName === "TEXTAREA") {
      const setter = Object.getOwnPropertyDescriptor(win.HTMLTextAreaElement.prototype, "value").set;
      setter.call(element, text);
      element.dispatchEvent(new win.InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
      element.dispatchEvent(new win.Event("change", { bubbles: true }));
    } else {
      const selection = win.getSelection();
      const range = doc.createRange();
      range.selectNodeContents(element);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      // A native editing operation keeps rich-editor input/undo handling intact.
      // Do not assign innerHTML/innerText, which can bypass the editor's state.
      if (!doc.execCommand("insertText", false, text)) {
        throw new Error("Trình soạn thảo không hỗ trợ chèn trực tiếp. Dùng nút Sao chép và dán vào Comment.");
      }
    }
    if (!normalize(editorText(element)).includes(normalize(text))) {
      throw new Error("Chưa xác nhận được nội dung trong editor. Kiểm tra ô Comment; không có thao tác lưu nào được thực hiện.");
    }
    element.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  const api = { issueKey, issueKeyFromUrl, adfText, buildReport, commentEditors, findCommentEditor, findCommentOpener, editorText, insertDraft };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PhubJiraDraftCore = Object.freeze(api);
})(typeof globalThis === "object" ? globalThis : this);
