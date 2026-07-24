(() => {
  if (window.__BALI_ADMIN_BROADCASTS_PRODUCTION__) return;
  window.__BALI_ADMIN_BROADCASTS_PRODUCTION__ = true;
  const store = window.BaliStore;
  if (!store) return;
  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
  const notify = message => window.toast ? window.toast(message) : console.info(message);
  let imageData = "";
  let imageMime = "";
  let currentId = "";
  let sending = false;

  const statusLabels = { draft:"Черновик", sending:"Отправляется", completed:"Завершена", failed:"Ошибка", cancelled:"Отменена" };
  const fmt = value => value ? new Date(value).toLocaleString("ru-RU", { day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit" }) : "—";

  function styles() {
    if (document.getElementById("adminBroadcastsProductionStyle")) return;
    const style = document.createElement("style");
    style.id = "adminBroadcastsProductionStyle";
    style.textContent = `
      .broadcast-dialog{width:min(980px,calc(100% - 16px));max-height:95dvh;padding:0;border:1px solid var(--line);border-radius:24px;background:#0b0e0d;color:#fff;overflow:hidden}.broadcast-dialog::backdrop{background:#000d;backdrop-filter:blur(6px)}.broadcast-shell{max-height:95dvh;overflow:auto}.broadcast-head{position:sticky;top:0;z-index:4;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 17px;border-bottom:1px solid var(--line);background:#0b0e0df2}.broadcast-head h2{margin:4px 0 0;font-size:18px}.broadcast-close{width:41px;height:41px;border:1px solid var(--line);border-radius:50%;background:#ffffff08;color:#fff;font-size:23px}.broadcast-body{display:grid;grid-template-columns:minmax(300px,.8fr) minmax(0,1.2fr);gap:14px;padding:14px}.broadcast-form{display:grid;align-content:start;gap:10px}.broadcast-form label{display:grid;gap:6px;color:var(--muted);font-size:9px;font-weight:900}.broadcast-form input,.broadcast-form textarea{width:100%;min-height:45px;padding:10px 12px;border:1px solid var(--line);border-radius:13px;background:#151a17;color:#fff}.broadcast-form textarea{min-height:170px;resize:vertical}.broadcast-counter{text-align:right;color:var(--muted);font-size:8px}.broadcast-preview{min-height:120px;display:grid;place-items:center;overflow:hidden;border:1px dashed var(--line);border-radius:15px;color:var(--muted);font-size:9px}.broadcast-preview img{width:100%;max-height:240px;object-fit:contain}.broadcast-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.broadcast-list{display:grid;align-content:start;gap:9px}.broadcast-list-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.broadcast-row{display:grid;gap:9px;padding:13px;border:1px solid var(--line);border-radius:16px;background:#ffffff04}.broadcast-row-head{display:flex;justify-content:space-between;gap:10px}.broadcast-row h4{margin:0;font-size:11px}.broadcast-row p{margin:4px 0 0;color:var(--muted);font-size:8px;line-height:1.5}.broadcast-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.broadcast-stats article{padding:9px;border:1px solid var(--line);border-radius:12px;text-align:center}.broadcast-stats strong{display:block;color:var(--lime);font:600 13px Unbounded}.broadcast-stats span{display:block;margin-top:4px;color:var(--muted);font-size:7px}.broadcast-row-actions{display:flex;gap:6px;flex-wrap:wrap}.broadcast-row-actions button{min-height:34px;padding:0 8px}.broadcast-progress{padding:11px;border:1px solid rgba(200,255,61,.2);border-radius:13px;background:#c8ff3d0b;color:#dfff7c;font-size:9px;line-height:1.5}.admin-messages-toolbar .create-broadcast-button{width:100%;min-height:41px;margin-bottom:8px}
      @media(max-width:820px){.broadcast-body{grid-template-columns:1fr}.broadcast-actions{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function ensureDialog() {
    if (document.getElementById("broadcastDialog")) return;
    document.body.insertAdjacentHTML("beforeend", `<dialog class="broadcast-dialog" id="broadcastDialog"><div class="broadcast-shell"><header class="broadcast-head"><div><span class="eyebrow">TELEGRAM</span><h2>Создать рассылку!</h2></div><button class="broadcast-close" type="button" data-close-broadcast>×</button></header><div class="broadcast-body"><form class="broadcast-form" id="broadcastForm"><input type="hidden" name="id"><label><span>Название черновика</span><input name="title" maxlength="100" placeholder="Например: Анонс пятницы"></label><label><span>Текст до 1000 символов</span><textarea name="message_text" maxlength="1000" placeholder="Текст сообщения для клиентской базы"></textarea><span class="broadcast-counter" id="broadcastCounter">0 / 1000</span></label><label><span>Изображение до 2 МБ</span><input id="broadcastImage" type="file" accept="image/*"></label><div class="broadcast-preview" id="broadcastPreview">Изображение не выбрано</div><div class="broadcast-progress" id="broadcastProgress" hidden></div><div class="broadcast-actions"><button class="ghost" type="button" id="saveBroadcastDraft">Сохранить черновик</button><button class="primary" type="submit">Отправить рассылку</button></div><button class="ghost" type="button" id="resetBroadcastForm">Новая рассылка</button></form><section class="broadcast-list"><div class="broadcast-list-head"><div><h3>Черновики и история</h3><small>Результаты каждой отправки сохраняются</small></div><button class="danger compact" type="button" id="clearBroadcastHistory">Очистить историю</button></div><div id="broadcastHistory"></div></section></div></div></dialog>`);
  }

  function fileToData(file) {
    if (file.size > 2 * 1024 * 1024) return Promise.reject(new Error("Изображение больше 2 МБ"));
    if (!file.type.startsWith("image/")) return Promise.reject(new Error("Выберите изображение"));
    return new Promise((resolve,reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Не удалось прочитать изображение"));
      reader.onload = () => resolve(String(reader.result || ""));
      reader.readAsDataURL(file);
    });
  }

  async function listRows() {
    const { data, error } = await store.client.from("telegram_broadcasts").select("*").order("created_at", { ascending:false });
    if (error) throw error;
    return data || [];
  }

  function rowHtml(row) {
    return `<article class="broadcast-row" data-broadcast-id="${esc(row.id)}"><div class="broadcast-row-head"><div><h4>${esc(row.title || "Рассылка BALI")}</h4><p>${esc(statusLabels[row.status] || row.status)} · ${esc(fmt(row.sent_at || row.updated_at || row.created_at))}</p></div><span class="status ${row.status === "completed" ? "available" : row.status === "draft" ? "pending" : "completed"}">${esc(statusLabels[row.status] || row.status)}</span></div><p>${esc(String(row.message_text || "").slice(0,180))}${String(row.message_text || "").length > 180 ? "…" : ""}</p><div class="broadcast-stats"><article><strong>${Number(row.recipient_count || 0)}</strong><span>ПОЛУЧАТЕЛЕЙ</span></article><article><strong>${Number(row.success_count || 0)}</strong><span>УСПЕШНО</span></article><article><strong>${Number(row.failure_count || 0)}</strong><span>НЕУСПЕШНО</span></article></div><div class="broadcast-row-actions">${row.status === "draft" ? `<button class="ghost" type="button" data-edit-broadcast="${esc(row.id)}">Изменить</button><button class="primary" type="button" data-send-saved-broadcast="${esc(row.id)}">Отправить</button>` : ""}${Number(row.failure_count || 0) ? `<button class="ghost" type="button" data-retry-broadcast="${esc(row.id)}">Повторить неуспешные</button>` : ""}<button class="danger" type="button" data-delete-broadcast="${esc(row.id)}">Удалить</button></div></article>`;
  }

  async function renderHistory() {
    const root = document.getElementById("broadcastHistory");
    if (!root) return;
    try {
      const rows = await listRows();
      root.innerHTML = rows.length ? rows.map(rowHtml).join("") : '<div class="empty">Черновиков и истории пока нет</div>';
    } catch (error) { root.innerHTML = `<div class="empty">${esc(error.message || "Выполните admin complete migration")}</div>`; }
  }

  function resetForm() {
    const form = document.getElementById("broadcastForm");
    form?.reset();
    if (form) form.id.value = "";
    currentId = ""; imageData = ""; imageMime = "";
    const preview = document.getElementById("broadcastPreview"); if (preview) preview.textContent = "Изображение не выбрано";
    const counter = document.getElementById("broadcastCounter"); if (counter) counter.textContent = "0 / 1000";
    const progress = document.getElementById("broadcastProgress"); if (progress) { progress.hidden = true; progress.textContent = ""; }
  }

  async function saveDraft() {
    const form = document.getElementById("broadcastForm");
    const data = Object.fromEntries(new FormData(form).entries());
    const text = String(data.message_text || "").trim();
    if (!text && !imageData) throw new Error("Добавьте текст или изображение");
    if (text.length > 1000) throw new Error("Текст длиннее 1000 символов");
    const payload = { id:data.id || currentId || crypto.randomUUID(), title:String(data.title || "").trim() || `Рассылка ${new Date().toLocaleDateString("ru-RU")}`, message_text:text, image_data:imageData, image_mime:imageMime, status:"draft", updated_at:new Date().toISOString() };
    if (!data.id && !currentId) payload.created_at = new Date().toISOString();
    const { data:saved, error } = await store.client.from("telegram_broadcasts").upsert(payload).select("*").single();
    if (error) throw error;
    currentId = saved.id; form.id.value = saved.id;
    await renderHistory();
    return saved;
  }

  async function sendBatches(id, retry = false) {
    if (sending) return;
    sending = true;
    const progress = document.getElementById("broadcastProgress");
    progress.hidden = false;
    try {
      let action = retry ? "retry_failed" : "send_batch";
      let result;
      do {
        progress.textContent = "Отправка выполняется… Не закрывайте админку.";
        const { data, error } = await store.client.functions.invoke("telegram-broadcast", { body:{ broadcast_id:id, action } });
        if (error || data?.error) throw error || new Error(data.error);
        result = data;
        action = "send_batch";
        progress.textContent = `Получателей: ${result.recipient_count} · успешно: ${result.success_count} · неуспешно: ${result.failure_count} · осталось: ${result.remaining}`;
        await renderHistory();
      } while (Number(result.remaining || 0) > 0);
      notify(`Рассылка завершена: ${result.success_count} успешно, ${result.failure_count} неуспешно`);
      resetForm();
    } catch (error) { progress.textContent = error.message || "Ошибка рассылки"; notify(progress.textContent); }
    finally { sending = false; await renderHistory(); }
  }

  async function open() {
    styles(); ensureDialog(); resetForm(); await renderHistory();
    const dialog = document.getElementById("broadcastDialog");
    if (!dialog.open) dialog.showModal();
  }

  document.addEventListener("input", event => {
    if (event.target.closest('#broadcastForm [name="message_text"]')) document.getElementById("broadcastCounter").textContent = `${event.target.value.length} / 1000`;
  });
  document.addEventListener("change", async event => {
    if (event.target.id !== "broadcastImage") return;
    const file = event.target.files?.[0]; if (!file) return;
    try { imageData = await fileToData(file); imageMime = file.type; document.getElementById("broadcastPreview").innerHTML = `<img src="${imageData}" alt="Предпросмотр">`; }
    catch (error) { event.target.value = ""; imageData = ""; imageMime = ""; notify(error.message); }
  });
  document.addEventListener("submit", async event => {
    if (event.target.id !== "broadcastForm") return;
    event.preventDefault();
    try { const saved = await saveDraft(); await sendBatches(saved.id); }
    catch (error) { notify(error.message || "Не удалось сохранить рассылку"); }
  });
  document.addEventListener("click", async event => {
    if (event.target.closest("[data-open-broadcast]")) { event.preventDefault(); return open(); }
    if (event.target.closest("[data-close-broadcast]")) return document.getElementById("broadcastDialog")?.close();
    if (event.target.id === "resetBroadcastForm") return resetForm();
    if (event.target.id === "saveBroadcastDraft") { try { await saveDraft(); notify("Черновик сохранён"); } catch (error) { notify(error.message); } return; }
    const edit = event.target.closest("[data-edit-broadcast]");
    if (edit) {
      const rows = await listRows(); const row = rows.find(item => String(item.id) === String(edit.dataset.editBroadcast)); if (!row) return;
      const form = document.getElementById("broadcastForm"); currentId = row.id; form.id.value = row.id; form.title.value = row.title || ""; form.message_text.value = row.message_text || ""; imageData = row.image_data || ""; imageMime = row.image_mime || ""; document.getElementById("broadcastCounter").textContent = `${form.message_text.value.length} / 1000`; document.getElementById("broadcastPreview").innerHTML = imageData ? `<img src="${esc(imageData)}" alt="">` : "Изображение не выбрано"; return;
    }
    const send = event.target.closest("[data-send-saved-broadcast]"); if (send) return sendBatches(send.dataset.sendSavedBroadcast);
    const retry = event.target.closest("[data-retry-broadcast]"); if (retry) return sendBatches(retry.dataset.retryBroadcast, true);
    const del = event.target.closest("[data-delete-broadcast]");
    if (del && confirm("Удалить рассылку и всю историю доставки?")) { const { error } = await store.client.from("telegram_broadcasts").delete().eq("id", del.dataset.deleteBroadcast); if (error) notify(error.message); else { notify("Рассылка удалена"); await renderHistory(); } return; }
    if (event.target.id === "clearBroadcastHistory" && confirm("Удалить всю историю завершённых рассылок? Черновики останутся.")) { const { error } = await store.client.from("telegram_broadcasts").delete().neq("status", "draft"); if (error) notify(error.message); else { notify("История очищена"); await renderHistory(); } }
  }, true);

  styles(); ensureDialog();
  window.BaliAdminBroadcasts = { open, renderHistory };
})();