(() => {
  if (window.__BALI_ADMIN_GIFTS__) return;
  window.__BALI_ADMIN_GIFTS__ = true;
  const social = window.BaliBeta4Social;
  if (!social) return;

  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"
  })[char]);
  const fmt = value => value ? new Date(value).toLocaleString("ru-RU", {
    day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit"
  }) : "—";
  const uid = () => `gift-${crypto.randomUUID?.() || Date.now()}`;

  function styles() {
    if (document.getElementById("adminGiftsStyle")) return;
    const style = document.createElement("style");
    style.id = "adminGiftsStyle";
    style.textContent = `
      .admin-gifts-grid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(280px,.85fr);gap:14px}
      .gift-catalog-list,.gift-history-list{display:grid;gap:8px}
      .gift-catalog-row{display:grid;grid-template-columns:70px minmax(130px,1fr) 110px 90px auto;gap:7px;align-items:end;padding:9px;border:1px solid var(--line);border-radius:13px}
      .gift-catalog-row label,.admin-gift-form label{display:grid;gap:5px;color:var(--muted);font-size:8px;font-weight:800}
      .gift-catalog-row input,.admin-gift-form input,.admin-gift-form select{width:100%;min-height:41px;padding:7px 9px;border:1px solid var(--line);border-radius:10px;background:rgba(255,255,255,.04);color:var(--text)}
      .gift-catalog-row .gift-active{display:flex;align-items:center;gap:6px;min-height:41px}.gift-catalog-row .gift-active input{width:18px;min-height:18px}
      .admin-gift-form{display:grid;gap:9px;padding:12px;border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,.02)}
      .gift-history-list{margin-top:12px}.gift-history-row{display:grid;grid-template-columns:42px minmax(0,1fr) auto;gap:9px;align-items:center;padding:9px;border:1px solid var(--line);border-radius:12px}
      .gift-history-row>i{width:42px;height:42px;display:grid;place-items:center;border-radius:11px;background:rgba(215,173,104,.1);font-style:normal;font-size:22px}
      .gift-history-row strong,.gift-history-row small{display:block}.gift-history-row small{margin-top:3px;color:var(--muted);font-size:8px}
      .gift-catalog-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}
      @media(max-width:850px){.admin-gifts-grid{grid-template-columns:1fr}.gift-catalog-row{grid-template-columns:70px 1fr 110px}.gift-catalog-row .gift-active,.gift-catalog-row button{grid-column:auto}.gift-catalog-row button{min-height:41px}}
      @media(max-width:520px){.gift-catalog-row{grid-template-columns:62px 1fr}.gift-catalog-row label:nth-child(3),.gift-catalog-row .gift-active{grid-column:auto}.gift-catalog-row button{grid-column:1/-1}.gift-history-row{grid-template-columns:40px 1fr}.gift-history-row button{grid-column:1/-1}}
    `;
    document.head.appendChild(style);
  }

  function catalogRow(item, index) {
    return `<article class="gift-catalog-row" data-gift-catalog-row="${esc(item.id)}">
      <label><span>Значок</span><input data-gift-field="icon" maxlength="12" value="${esc(item.icon || "🎁")}"></label>
      <label><span>Название</span><input data-gift-field="name" value="${esc(item.name)}" required></label>
      <label><span>Цена, баллов</span><input data-gift-field="stars" type="number" min="1" step="1" value="${Number(item.stars || 1)}"></label>
      <label class="gift-active"><input data-gift-field="active" type="checkbox" ${item.active !== false ? "checked" : ""}><span>Активен</span></label>
      <button class="danger compact" type="button" data-remove-gift-catalog="${esc(item.id)}" ${social.GIFT_CATALOG.length <= 1 ? "disabled" : ""}>Удалить</button>
      <input data-gift-field="sortOrder" type="hidden" value="${Number(item.sortOrder || index + 1)}">
    </article>`;
  }

  function append() {
    if (typeof state === "undefined" || state.view !== "bonuses") return;
    const root = document.getElementById("content");
    if (!root || root.querySelector("#adminGiftsPanel")) return;
    const people = social.people().filter(person => String(person.id) !== "bali-admin");
    const history = social.gifts().slice(0, 50);
    root.insertAdjacentHTML("beforeend", `<section class="panel loyalty-admin" id="adminGiftsPanel">
      <div class="panel-head"><div><h3>Подарки пользователям</h3><small>Настройка каталога, цены в BALI-Баллах, ручная выдача и история</small></div><span class="count">${social.GIFT_CATALOG.length}</span></div>
      <div class="panel-body admin-gifts-grid">
        <div>
          <form id="giftCatalogForm">
            <div class="gift-catalog-list" id="giftCatalogList">${social.GIFT_CATALOG.map(catalogRow).join("")}</div>
            <div class="gift-catalog-actions">
              <button class="secondary" type="button" data-add-gift-catalog>Добавить подарок</button>
              <button class="primary" type="submit">Сохранить каталог</button>
              <button class="ghost" type="button" data-reset-gift-catalog>Вернуть исходные подарки</button>
            </div>
          </form>
        </div>
        <div>
          <form class="admin-gift-form" id="adminGiftGrantForm">
            <h4>Подарить от имени клуба</h4>
            <label><span>Получатель</span><select name="targetId" required>${people.map(person => `<option value="${esc(person.id)}">${esc(person.name || "Гость BALI")}</option>`).join("")}</select></label>
            <label><span>Подарок</span><select name="giftId" required>${social.GIFT_CATALOG.filter(item => item.active !== false).map(item => `<option value="${esc(item.id)}">${esc(item.icon)} ${esc(item.name)} · ${Number(item.stars || 0)} баллов</option>`).join("")}</select></label>
            <label><span>Комментарий</span><input name="note" value="Подарок от BALI Night Club"></label>
            <button class="primary" type="submit">Выдать подарок бесплатно</button>
            <small class="muted">Ручная выдача от клуба не списывает баллы получателя.</small>
          </form>
          <div class="gift-history-list">${history.length ? history.map(item => `<article class="gift-history-row"><i>${esc(item.icon || "🎁")}</i><div><strong>${esc(item.giftName || "Подарок BALI")} → ${esc(item.toName || item.toId)}</strong><small>От: ${esc(item.fromName || "BALI")} · ${fmt(item.createdAt)}${item.note ? ` · ${esc(item.note)}` : ""}</small></div><button class="danger compact" type="button" data-remove-issued-gift="${esc(item.id)}">Удалить</button></article>`).join("") : '<div class="empty">Выданных подарков пока нет</div>'}</div>
        </div>
      </div>
    </section>`);

    const catalogForm = root.querySelector("#giftCatalogForm");
    catalogForm?.addEventListener("submit", event => {
      event.preventDefault();
      const rows = [...event.currentTarget.querySelectorAll("[data-gift-catalog-row]")].map((row, index) => ({
        id:row.dataset.giftCatalogRow,
        icon:row.querySelector('[data-gift-field="icon"]').value.trim() || "🎁",
        name:row.querySelector('[data-gift-field="name"]').value.trim() || "Подарок BALI",
        stars:Math.max(1, Math.floor(Number(row.querySelector('[data-gift-field="stars"]').value || 1))),
        active:row.querySelector('[data-gift-field="active"]').checked,
        sortOrder:index + 1
      }));
      social.saveGiftCatalog(rows);
      toast("Каталог подарков сохранён");
      window.render?.();
    });
    root.querySelector("[data-add-gift-catalog]")?.addEventListener("click", () => {
      const list = root.querySelector("#giftCatalogList");
      list.insertAdjacentHTML("beforeend", catalogRow({ id:uid(), icon:"🎁", name:"Новый подарок", stars:100, active:true, sortOrder:list.children.length + 1 }, list.children.length));
    });
    root.querySelector("[data-reset-gift-catalog]")?.addEventListener("click", () => {
      if (!confirm("Вернуть исходные четыре подарка и цены?")) return;
      social.saveGiftCatalog(social.DEFAULT_GIFT_CATALOG);
      toast("Исходный каталог восстановлен");
      window.render?.();
    });
    root.addEventListener("click", event => {
      const removeCatalog = event.target.closest("[data-remove-gift-catalog]");
      if (removeCatalog) {
        if (!confirm("Удалить этот подарок из каталога? История уже выданных подарков сохранится.")) return;
        removeCatalog.closest("[data-gift-catalog-row]")?.remove();
      }
      const removeIssued = event.target.closest("[data-remove-issued-gift]");
      if (removeIssued) {
        if (!confirm("Удалить выданный подарок из истории пользователя?")) return;
        const result = social.removeGift(removeIssued.dataset.removeIssuedGift);
        toast(result.ok ? "Подарок удалён" : result.message);
        if (result.ok) window.render?.();
      }
    });
    root.querySelector("#adminGiftGrantForm")?.addEventListener("submit", event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      const person = people.find(item => String(item.id) === String(data.targetId));
      const gift = social.GIFT_CATALOG.find(item => item.id === data.giftId);
      if (!person || !gift) return toast("Выберите пользователя и подарок");
      if (!confirm(`Выдать «${gift.name}» пользователю ${person.name} от имени BALI?`)) return;
      const result = social.adminGift(person.id, gift.id, data.note);
      toast(result.ok ? "Подарок выдан пользователю" : result.message);
      if (result.ok) window.render?.();
    });
  }

  styles();
  const baseRender = window.render;
  window.render = async function(...args) {
    const result = await baseRender.apply(this, args);
    await append();
    return result;
  };
  if (typeof state !== "undefined" && state.view === "bonuses") append();
})();
