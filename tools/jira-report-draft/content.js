(function () {
  "use strict";
  const Core = globalThis.PhubJiraDraftCore;
  if (!Core || document.getElementById("phub-jira-report-draft") || location.pathname.startsWith("/wiki")) return;

  const host = document.createElement("div");
  host.id = "phub-jira-report-draft";
  host.style.cssText = "position:fixed;right:18px;bottom:18px;z-index:2147483647;";
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `
    :host{font:14px/1.5 Arial,sans-serif;color:#172b4d}
    *{box-sizing:border-box} [hidden]{display:none!important}
    button,input,select,textarea{font:inherit} button{cursor:pointer}
    .launcher,.primary{background:#0052cc;color:#fff;border:0;border-radius:8px;padding:11px 16px}
    .panel{width:370px;max-width:calc(100vw - 36px);max-height:85vh;overflow:auto;padding:18px;background:#fff;border:1px solid #dfe1e6;border-radius:12px;box-shadow:0 8px 32px #091e4238;margin-bottom:10px}
    .header{display:flex;justify-content:space-between;align-items:center;gap:12px}.header h2{font-size:17px;margin:0}
    .close{border:0;background:none;font-size:22px;padding:0 5px}
    .note{padding:10px;background:#fff7d6;border-radius:6px;font-size:12px}
    label{display:block;font-weight:bold;margin-top:12px}input,select,textarea{width:100%;padding:8px;border:1px solid #a5adba;border-radius:5px;color:#172b4d;background:#fff}
    textarea{height:230px;font-size:12px;line-height:1.6;resize:vertical;margin-top:12px}
    .actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.secondary{border:1px solid #a5adba;border-radius:6px;background:#fff;padding:8px 10px}
    button:disabled{opacity:.5;cursor:not-allowed}.status{font-size:12px;white-space:pre-line;margin:12px 0 0}.error{color:#ae2a19}
    button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible{outline:2px solid #0052cc;outline-offset:2px}
  `;
  shadow.append(style);

  function node(tag, text, attrs = {}) {
    const element = document.createElement(tag);
    if (text) element.textContent = text;
    for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, value);
    return element;
  }

  const panel = node("section", "", { class: "panel", "aria-label": "Khung báo cáo Jira" });
  panel.hidden = true;
  const header = node("div", "", { class: "header" });
  header.append(node("h2", "Khung báo cáo Jira"));
  const close = node("button", "×", { type: "button", class: "close", "aria-label": "Đóng khung trợ giúp" });
  header.append(close);
  panel.append(header, node("p", "Chỉ tạo bản nháp. Tool KHÔNG nhấn Save, không đăng comment và không thay trạng thái ticket.", { class: "note" }));
  panel.append(node("label", "Mã ticket", { for: "qa-ticket-key" }));
  const keyInput = node("input", "", { id: "qa-ticket-key", placeholder: "KAN-123", autocomplete: "off" });
  panel.append(keyInput, node("label", "Ngôn ngữ báo cáo", { for: "qa-language" }));
  const language = node("select", "", { id: "qa-language" });
  language.append(node("option", "English", { value: "en" }), node("option", "Tiếng Việt", { value: "vi" }));
  panel.append(language);
  const actions = node("div", "", { class: "actions" });
  const prepare = node("button", "1. Tạo khung", { type: "button", class: "primary", "data-qa-draft-action": "prepare" });
  actions.append(prepare);
  const preview = node("textarea", "", { "aria-label": "Bản nháp báo cáo", spellcheck: "false" });
  panel.append(actions, preview);
  const insert = node("button", "2. Điền vào Comment — chưa lưu", { type: "button", class: "primary", "data-qa-draft-action": "insert" });
  const copy = node("button", "Sao chép", { type: "button", class: "secondary" });
  insert.disabled = true;
  copy.disabled = true;
  const draftActions = node("div", "", { class: "actions" });
  draftActions.append(insert, copy);
  const status = node("p", "Mở ticket cần kiểm tra, tạo khung rồi điền vào Comment để tự duyệt.", { class: "status", role: "status", "aria-live": "polite" });
  panel.append(draftActions, status);
  const launcher = node("button", "QA Draft", { type: "button", class: "launcher", "aria-expanded": "false", "aria-label": "Mở công cụ khung báo cáo Jira" });
  shadow.append(panel, launcher);
  document.body.append(host);

  const state = { loadedKey: null, routeKey: null, preferredEditor: null, controller: null, generation: 0 };
  function message(text, error = false) {
    status.textContent = text;
    status.className = "status" + (error ? " error" : "");
  }
  function setOpen(open) {
    panel.hidden = !open;
    launcher.setAttribute("aria-expanded", String(open));
  }
  launcher.addEventListener("click", () => setOpen(panel.hidden));
  close.addEventListener("click", () => setOpen(false));

  document.addEventListener("focusin", (event) => {
    if (Core.commentEditors(document).includes(event.target)) state.preferredEditor = event.target;
  });

  function syncRoute() {
    const current = Core.issueKeyFromUrl(location.href);
    if (current !== state.routeKey) {
      state.routeKey = current;
      keyInput.value = current || "";
      insert.disabled = !state.loadedKey || state.loadedKey !== current;
    }
  }
  syncRoute();
  // Jira changes tickets without a document navigation; this never sends requests.
  setInterval(syncRoute, 1000);

  prepare.addEventListener("click", async () => {
    const key = Core.issueKey(keyInput.value);
    if (!key) return message("Nhập mã ticket hợp lệ, ví dụ KAN-123.", true);
    state.controller?.abort();
    const controller = new AbortController();
    const generation = ++state.generation;
    state.controller = controller;
    const timeout = setTimeout(() => controller.abort(), 15000);
    prepare.disabled = true;
    insert.disabled = true;
    copy.disabled = true;
    preview.value = "";
    state.loadedKey = null;
    message("Đang đọc ticket " + key + "…");
    try {
      // The only Jira API call in the tool is this authenticated, same-origin GET.
      const response = await fetch("/rest/api/3/issue/" + encodeURIComponent(key) + "?fields=summary,description,status,updated", {
        method: "GET", credentials: "same-origin", headers: { Accept: "application/json" }, signal: controller.signal,
      });
      if (!response.ok) throw new Error("Không đọc được ticket (HTTP " + response.status + "). Kiểm tra đăng nhập và quyền xem ticket.");
      const issue = await response.json();
      if (Core.issueKey(issue.key) !== key) throw new Error("API trả về ticket khác với mã yêu cầu.");
      if (generation !== state.generation) return;
      preview.value = Core.buildReport(issue, { language: language.value, origin: location.origin });
      state.loadedKey = key;
      insert.disabled = Core.issueKeyFromUrl(location.href) !== key;
      copy.disabled = false;
      message("Đã tạo khung cho " + key + ". Bạn có thể sửa khung, rồi điền vào Comment. Chưa có comment nào được đăng.");
    } catch (error) {
      if (generation === state.generation) message(error.name === "AbortError" ? "Đã dừng hoặc hết thời gian đọc ticket. Bấm Tạo khung để thử lại." : error.message, true);
    } finally {
      clearTimeout(timeout);
      if (generation === state.generation) prepare.disabled = false;
    }
  });

  insert.addEventListener("click", async () => {
    insert.disabled = true;
    try {
      const key = state.loadedKey;
      if (!key || Core.issueKeyFromUrl(location.href) !== key || Core.issueKey(keyInput.value) !== key) {
        throw new Error("Ticket đang mở không khớp bản nháp. Mở đúng ticket và tạo lại khung.");
      }
      let editor = Core.findCommentEditor(document, state.preferredEditor);
      if (!editor) {
        const opener = Core.findCommentOpener(document);
        if (opener) {
          opener.click();
          const deadline = Date.now() + 3000;
          while (!editor && Date.now() < deadline) {
            await new Promise((resolve) => setTimeout(resolve, 100));
            editor = Core.findCommentEditor(document, state.preferredEditor);
          }
        }
      }
      if (!editor) throw new Error("Chưa nhận diện được ô Comment. Bấm Add a comment trên Jira rồi thử lại, hoặc dùng Sao chép và dán thủ công.");
      if (Core.issueKeyFromUrl(location.href) !== key) throw new Error("Ticket đã đổi trong lúc mở editor. Chưa chèn nội dung.");
      Core.insertDraft(editor, preview.value);
      message("Đã điền bản nháp vào Comment. Tool đã dừng, KHÔNG nhấn Save. Bạn kiểm tra, chỉnh kết quả thực tế rồi tự lưu trên Jira.");
    } catch (error) {
      message(error.message, true);
    } finally {
      insert.disabled = !state.loadedKey || Core.issueKeyFromUrl(location.href) !== state.loadedKey;
    }
  });

  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(preview.value);
      message("Đã sao chép khung. Dán vào Comment và tự kiểm tra trước khi lưu.");
    } catch {
      preview.focus();
      preview.select();
      message("Hãy nhấn Ctrl+C để sao chép phần đã chọn, sau đó dán vào Comment. Tool không tự lưu.");
    }
  });
})();
