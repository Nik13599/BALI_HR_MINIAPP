(() => {
  if (window.__BALI_MENU_CATEGORIES_ADMIN__) return;
  window.__BALI_MENU_CATEGORIES_ADMIN__ = true;

  const KEY = "bali_menu_categories_v1";
  const FALLBACK = "Другое";
  const read = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch { return []; }
  };
  const write = (rows) => {
    const normalized = rows
      .map((row, index) => ({
        id: row.id || `category-${crypto.randomUUID?.() || Date.now()}-${index}`,
        name: String(row.name || "").trim(),
        sort_order: Number(row.sort_order ?? index + 1),
        active: row.active !== false
      }))
      .filter((row) => row.name)
      .sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
      .map((row, index) => ({ ...row, sort_order: index + 1 }));
    localStorage.setItem(KEY, JSON.stringify(normalized));
    window.dispatchEvent(new CustomEvent("bali:menu-categories-changed"));
    return normalized;
  };

  async function ensureCategories() {
    let rows = read();
    if (rows.length) return rows;
    const items = await store.list("menu_items", { order: "sort_order" });
    const names = [...new Set(items.map((item) => String(item.category || "").trim()).filter(Boolean))];
    if (!names.length) names.push("Коктейли", "Шоты", "Пиво", "Кальяны");
    rows = names.map((name, index) => ({ id: `category-${index + 1}`, name, sort_order: index + 1, active: true }));
    return write(rows);
  }

  function injectStyles() {
    if (document.getElementById("menuCategoriesAdminStyle")) return;
    const style = document.createElement("style");
    style.id = "menuCategoriesAdminStyle";
    style.textContent = `
      .menu-categories-open{min-height:42px;padding:0 14px;white-space:nowrap}
      .menu-categories-dialog{width:min(760px,calc(100% - 20px));max-width:760px;max-height:92dvh;padding:0;border:1px solid var(--line);border-radius:22px;background:#0d100f;color:var(--text);overflow:hidden}
      .menu-categories-dialog::backdrop{background:rgba(0,0,0,.82);backdrop-filter:blur(4px)}
      .menu-categories-shell{display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;max-height:92dvh}
      .menu-categories-head{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:16px 18px;border-bottom:1px solid var(--line)}
      .menu-categories-head h3{margin:0;font:600 18px Unbounded}
      .menu-categories-head small{display:block;margin-top:5px;color:var(--muted);font-size:9px}
      .menu-categories-close{width:42px;height:42px;flex:0 0 42px;border:1px solid var(--line);border-radius:50%;background:rgba(255,255,255,.04);color:var(--text);font-size:24px}
      .menu-category-create{display:grid;grid-template-columns:minmax(0,1fr) 105px auto;gap:8px;align-items:end;padding:14px 18px;border-bottom:1px solid var(--line);background:rgba(255,255,255,.018)}
      .menu-category-create label,.menu-category-row label{display:grid;gap:5px;color:var(--muted);font-size:9px;font-weight:800}
      .menu-category-create input,.menu-category-row input{width:100%;min-height:43px;padding:0 11px;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.04);color:var(--text)}
      .menu-category-list{display:grid;gap:8px;padding:14px 18px;overflow:auto}
      .menu-category-row{display:grid;grid-template-columns:minmax(0,1fr) 82px auto;gap:8px;align-items:end;padding:10px;border:1px solid rgba(255,255,255,.07);border-radius:14px;background:rgba(255,255,255,.018)}
      .menu-category-actions{display:flex;gap:6px}
      .menu-category-actions button{min-width:38px;height:43px;padding:0 9px;border-radius:11px}
      .menu-category-note{margin:0;padding:11px 18px calc(11px + env(safe-area-inset-bottom,0px));border-top:1px solid var(--line);color:var(--muted);font-size:9px;line-height:1.5}
      @media(max-width:650px){
        .menu-categories-dialog{width:100%;max-width:none;max-height:96dvh;margin:auto 0 0;border-radius:22px 22px 0 0}
        .menu-categories-shell{max-height:96dvh}
        .menu-category-create,.menu-category-row{grid-template-columns:1fr 78px}
        .menu-category-create button,.menu-category-actions{grid-column:1/-1}
        .menu-category-actions button{flex:1}
      }
    `;
    document.head.appendChild(style);
  }

  function ensureDialog() {
    let dialog = document.getElementById("menuCategoriesDialog");
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.id = "menuCategoriesDialog";
    dialog.className = "menu-categories-dialog";
    dialog.innerHTML = `
      <div class="menu-categories-shell">
        <div class="menu-categories-head">
          <div><h3>Категории меню</h3><small>Добавление, переименование, сортировка и удаление</small></div>
          <button class="menu-categories-close" type="button" data-close-menu-categories>×</button>
        </div>
        <form id="menuCategoryCreate" class="menu-category-create">
          <label><span>Новая категория</span><input name="name" placeholder="Например: Безалкогольные коктейли" required></label>
          <label><span>Порядок</span><input name="sort_order" type="number" min="1" value="1"></label>
          <button class="primary" type="submit">Добавить</button>
        </form>
        <div class="menu-category-list" id="menuCategoryList"></div>
        <p class="menu-category-note">Новая категория сразу доступна при редактировании товара и появляется у пользователя. Товары удалённой категории переносятся в «${FALLBACK}».</p>
      </div>`;
    document.body.appendChild(dialog);

    dialog.querySelector("[data-close-menu-categories]").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener("close", () => {
      if (typeof state !== "undefined" && state.view === "menu") window.render?.();
    });

    dialog.querySelector("#menuCategoryCreate").addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      const name = String(data.name || "").trim();
      const current = read();
      if (!name) return toast("Введите название категории");
      if (current.some((row) => row.name.toLowerCase() === name.toLowerCase())) return toast("Такая категория уже существует");
      write([...current, {
        id: `category-${crypto.randomUUID?.() || Date.now()}`,
        name,
        sort_order: Number(data.sort_order || current.length + 1),
        active: true
      }]);
      event.currentTarget.reset();
      event.currentTarget.sort_order.value = read().length + 1;
      toast("Категория добавлена");
      await drawDialog();
    });

    dialog.querySelector("#menuCategoryList").addEventListener("click", async (event) => {
      const rowNode = event.target.closest("[data-category-id]");
      if (!rowNode) return;
      const id = rowNode.dataset.categoryId;
      let rows = read();
      const index = rows.findIndex((row) => row.id === id);
      if (index < 0) return;

      if (event.target.closest("[data-category-up]") && index > 0) {
        [rows[index - 1], rows[index]] = [rows[index], rows[index - 1]];
        write(rows.map((row, position) => ({ ...row, sort_order: position + 1 })));
        return drawDialog();
      }
      if (event.target.closest("[data-category-down]") && index < rows.length - 1) {
        [rows[index + 1], rows[index]] = [rows[index], rows[index + 1]];
        write(rows.map((row, position) => ({ ...row, sort_order: position + 1 })));
        return drawDialog();
      }
      if (event.target.closest("[data-category-save]")) {
        const oldName = rows[index].name;
        const newName = String(rowNode.querySelector("[data-category-name]")?.value || "").trim();
        const order = Number(rowNode.querySelector("[data-category-order]")?.value || index + 1);
        if (!newName) return toast("Название категории не может быть пустым");
        if (rows.some((row, position) => position !== index && row.name.toLowerCase() === newName.toLowerCase())) return toast("Такая категория уже существует");
        rows[index] = { ...rows[index], name: newName, sort_order: order };
        write(rows);
        await updateItemsCategory(oldName, newName);
        toast("Категория сохранена");
        return drawDialog();
      }
      if (event.target.closest("[data-category-delete]")) {
        const deleted = rows[index];
        if (!confirm(`Удалить категорию «${deleted.name}»? Товары будут перенесены в «${FALLBACK}».`)) return;
        rows.splice(index, 1);
        let fallback = rows.find((row) => row.name.toLowerCase() === FALLBACK.toLowerCase());
        if (!fallback) {
          fallback = { id: `category-${crypto.randomUUID?.() || Date.now()}`, name: FALLBACK, sort_order: rows.length + 1, active: true };
          rows.push(fallback);
        }
        write(rows);
        await updateItemsCategory(deleted.name, FALLBACK);
        toast("Категория удалена");
        return drawDialog();
      }
    });
    return dialog;
  }

  function categoryRows(rows) {
    return rows.map((row, index) => `
      <div class="menu-category-row" data-category-id="${esc(row.id)}">
        <label><span>Название</span><input data-category-name value="${esc(row.name)}"></label>
        <label><span>Порядок</span><input data-category-order type="number" min="1" value="${Number(row.sort_order)}"></label>
        <div class="menu-category-actions">
          <button class="secondary" type="button" data-category-up title="Выше" ${index === 0 ? "disabled" : ""}>↑</button>
          <button class="secondary" type="button" data-category-down title="Ниже" ${index === rows.length - 1 ? "disabled" : ""}>↓</button>
          <button class="primary" type="button" data-category-save>Сохранить</button>
          <button class="danger" type="button" data-category-delete>Удалить</button>
        </div>
      </div>`).join("") || '<div class="empty">Категорий пока нет</div>';
  }

  async function drawDialog() {
    const dialog = ensureDialog();
    const rows = await ensureCategories();
    dialog.querySelector("#menuCategoryList").innerHTML = categoryRows(rows);
    dialog.querySelector('#menuCategoryCreate [name="sort_order"]').value = rows.length + 1;
    document.querySelector("[data-open-menu-categories] [data-category-count]")?.replaceChildren(document.createTextNode(String(rows.length)));
  }

  async function openCategoriesDialog() {
    const dialog = ensureDialog();
    await drawDialog();
    if (!dialog.open) dialog.showModal();
  }

  async function updateItemsCategory(oldName, newName) {
    if (!oldName || oldName === newName) return;
    const items = await store.list("menu_items");
    for (const item of items.filter((row) => String(row.category || "") === oldName)) {
      await store.save("menu_items", { ...item, category: newName });
    }
  }

  async function addCategoriesButton(root) {
    if (state.view !== "menu" || !root) return;
    const panelHead = root.querySelector(".panel .panel-head");
    if (!panelHead || panelHead.querySelector("[data-open-menu-categories]")) return;
    const rows = await ensureCategories();
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary menu-categories-open";
    button.dataset.openMenuCategories = "true";
    button.innerHTML = `Категории <span class="count" data-category-count>${rows.length}</span>`;
    const filters = panelHead.querySelector(".filter-bar");
    filters ? filters.insertAdjacentElement("beforebegin", button) : panelHead.appendChild(button);
  }

  injectStyles();
  ensureDialog();
  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-open-menu-categories]")) {
      event.preventDefault();
      openCategoriesDialog();
    }
  }, true);

  const baseRenderMenu = renderMenu;
  renderMenu = async function(root) {
    await baseRenderMenu(root);
    await addCategoriesButton(root);
  };

  const baseOpenEditor = openEditor;
  openEditor = async function(type, row = null) {
    if (type === "menu_items") {
      const rows = await ensureCategories();
      const options = rows.map((category) => [category.name, category.name]);
      editorDefinitions.menu_items.fields = editorDefinitions.menu_items.fields.map((field) => field[0] === "category" ? ["category", "Категория", "select", true, "", options] : field);
    }
    return baseOpenEditor(type, row);
  };

  window.BaliMenuCategories = { KEY, read, write, ensureCategories, openDialog: openCategoriesDialog };
})();