(() => {
  if (window.__BALI_ADMIN_GIFTS_PRODUCTION__) return;
  window.__BALI_ADMIN_GIFTS_PRODUCTION__ = true;
  const store = window.BaliStore;
  if (!store) return;
  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
  const notify = message => window.toast ? window.toast(message) : console.info(message);
  let imageData = "";

  function styles() {
    if (document.getElementById("adminGiftsProductionStyle")) return;
    const style = document.createElement("style");
    style.id = "adminGiftsProductionStyle";
    style.textContent = `
      .gift-admin-grid{display:grid;grid-template-columns:minmax(280px,.75fr) minmax(0,1.25fr);gap:14px}.gift-admin-form{display:grid;gap:10px}.gift-admin-form label{display:grid;gap:6px;color:var(--muted);font-size:9px;font-weight:800}.gift-admin-form input,.gift-admin-form textarea{width:100%;min-height:45px;padding:9px 11px;border:1px solid var(--line);border-radius:12px;background:#111614;color:#fff}.gift-admin-form textarea{min-height:90px}.gift-admin-two{display:grid;grid-template-columns:1fr 1fr;gap:9px}.gift-admin-preview{min-height:110px;display:grid;place-items:center;overflow:hidden;border:1px dashed var(--line);border-radius:16px;background:#ffffff04;font-size:42px}.gift-admin-preview img{width:100%;height:160px;object-fit:contain}.gift-admin-list{display:grid;gap:8px}.gift-admin-row{display:grid;grid-template-columns:52px minmax(0,1fr) auto;gap:10px;align-items:center;padding:11px;border:1px solid var(--line);border-radius:15px;background:#ffffff04}.gift-admin-icon{width:52px;height:52px;display:grid;place-items:center;overflow:hidden;border-radius:14px;background:#c8ff3d0d;font-size:27px}.gift-admin-icon img{width:100%;height:100%;object-fit:cover}.gift-admin-row h4{margin:0;font-size:11px}.gift-admin-row p{margin:4px 0 0;color:var(--muted);font-size:8px;line-height:1.45}.gift-admin-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.gift-admin-actions button{min-height:34px;padding:0 8px}.gift-admin-form .check-row{display:flex;align-items:center;justify-content:space-between}.gift-admin-form .check-row input{width:22px;min-height:22px}
      @media(max-width:820px){.gift-admin-grid{grid-template-columns:1fr}.gift-admin-row{grid-template-columns:46px minmax(0,1fr)}.gift-admin-actions{grid-column:2;justify-content:flex-start}}
    `;
    document.head.appendChild(style);
  }

  function fileToData(file) {
    if (file.size > 2 * 1024 * 1024) return Promise.reject(new Error("Изображение больше 2 МБ"));
    if (!file.type.startsWith("image/")) return Promise.reject(new Error("Выберите изображение"));
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Не удалось прочитать изображение"));
      reader.onload = () => resolve(String(reader.result || ""));
      reader.readAsDataURL(file);
    });
  }

  async function listGifts() {
    if (!store.cloudEnabled || !store.client) return [];
    const { data, error } = await store.client.from("loyalty_gifts").select("*").order("sort_order");
    if (error) throw error;
    return data || [];
  }

  function giftRow(row) {
    return `<article class="gift-admin-row"><span class="gift-admin-icon">${row.image_url ? `<img src="${esc(row.image_url)}" alt="">` : esc(row.icon || "🎁")}</span><div><h4>${esc(row.title)}</h4><p>${esc(row.description || "Без описания")}<br><strong>${Number(row.points_price || 0)} BALI-Баллов</strong> · ${row.active !== false ? "показывается" : "скрыт"}</p></div><div class="gift-admin-actions"><button class="ghost" type="button" data-edit-production-gift="${esc(row.id)}">Изменить</button><button class="danger" type="button" data-delete-production-gift="${esc(row.id)}">Удалить</button></div></article>`;
  }

  async function mount() {
    if (typeof state === "undefined" || state.view !== "bonuses") return;
    const root = document.getElementById("content");
    if (!root || root.querySelector("#adminProductionGifts")) return;
    styles();
    let rows = [];
    try { rows = await listGifts(); }
    catch (error) {
      root.insertAdjacentHTML("beforeend", `<section class="panel" id="adminProductionGifts"><div class="panel-head"><h3>Подарки</h3></div><div class="empty">${esc(error.message || "Выполните admin complete migration")}</div></section>`);
      return;
    }
    root.insertAdjacentHTML("beforeend", `<section class="panel" id="adminProductionGifts"><div class="panel-head"><div><h3>Подарки</h3><small>Каталог подарков, которые пользователи дарят друг другу за BALI-Баллы</small></div><span class="count">${rows.length}</span></div><div class="panel-body gift-admin-grid"><form class="gift-admin-form" id="productionGiftForm"><input type="hidden" name="id"><label><span>Название подарка</span><input name="title" maxlength="80" required placeholder="Коктейль, Роза, Корона"></label><label><span>Описание</span><textarea name="description" maxlength="300" placeholder="Короткое описание подарка"></textarea></label><div class="gift-admin-two"><label><span>Значок emoji</span><input name="icon" maxlength="8" value="🎁"></label><label><span>Стоимость, BALI-Баллы</span><input name="points_price" type="number" min="0" value="50" required></label></div><div class="gift-admin-two"><label><span>Порядок</span><input name="sort_order" type="number" min="0" value="${rows.length + 1}"></label><label><span>Ссылка на изображение</span><input name="image_url" type="url" placeholder="https://..."></label></div><label><span>Или загрузить изображение до 2 МБ</span><input id="productionGiftImage" type="file" accept="image/*"></label><div class="gift-admin-preview" id="productionGiftPreview">🎁</div><label class="check-row"><span>Показывать пользователям</span><input name="active" type="checkbox" checked></label><button class="primary" type="submit">Сохранить подарок</button><button class="ghost" type="button" id="productionGiftReset">Очистить форму</button></form><div><div class="gift-admin-list" id="productionGiftList">${rows.length ? rows.map(giftRow).join("") : '<div class="empty">Подарков пока нет</div>'}</div></div></div></section>`);

    const form = document.getElementById("productionGiftForm");
    const preview = document.getElementById("productionGiftPreview");
    const reset = () => { form.reset(); form.id.value = ""; form.icon.value = "🎁"; form.points_price.value = "50"; form.sort_order.value = String(rows.length + 1); form.active.checked = true; imageData = ""; preview.innerHTML = "🎁"; };
    document.getElementById("productionGiftReset")?.addEventListener("click", reset);
    document.getElementById("productionGiftImage")?.addEventListener("change", async event => {
      const file = event.target.files?.[0]; if (!file) return;
      try { imageData = await fileToData(file); preview.innerHTML = `<img src="${imageData}" alt="">`; }
      catch (error) { event.target.value = ""; imageData = ""; notify(error.message); }
    });
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      const payload = { id:data.id || crypto.randomUUID(), title:String(data.title || "").trim(), description:String(data.description || "").trim(), icon:String(data.icon || "🎁").trim() || "🎁", image_url:imageData || String(data.image_url || "").trim(), points_price:Math.max(0,Number(data.points_price || 0)), sort_order:Number(data.sort_order || 0), active:form.active.checked, updated_at:new Date().toISOString() };
      const { error } = await store.client.from("loyalty_gifts").upsert(payload);
      if (error) return notify(error.message || "Не удалось сохранить подарок");
      notify("Подарок сохранён");
      await render();
    });
    root.querySelectorAll("[data-edit-production-gift]").forEach(button => button.addEventListener("click", () => {
      const row = rows.find(item => String(item.id) === String(button.dataset.editProductionGift)); if (!row) return;
      form.id.value = row.id; form.title.value = row.title || ""; form.description.value = row.description || ""; form.icon.value = row.icon || "🎁"; form.points_price.value = row.points_price || 0; form.sort_order.value = row.sort_order || 0; form.image_url.value = row.image_url && !String(row.image_url).startsWith("data:") ? row.image_url : ""; form.active.checked = row.active !== false; imageData = row.image_url || ""; preview.innerHTML = row.image_url ? `<img src="${esc(row.image_url)}" alt="">` : esc(row.icon || "🎁"); form.scrollIntoView({ behavior:"smooth", block:"start" });
    }));
    root.querySelectorAll("[data-delete-production-gift]").forEach(button => button.addEventListener("click", async () => {
      const row = rows.find(item => String(item.id) === String(button.dataset.deleteProductionGift));
      if (!row || !confirm(`Удалить подарок «${row.title}»?`)) return;
      const { error } = await store.client.from("loyalty_gifts").delete().eq("id", row.id);
      if (error) return notify(error.message || "Не удалось удалить подарок");
      notify("Подарок удалён"); await render();
    }));
  }

  const baseRender = window.render;
  if (typeof baseRender === "function") window.render = async function(...args) { const result = await baseRender.apply(this,args); await mount(); return result; };
  setTimeout(mount, 300);
})();