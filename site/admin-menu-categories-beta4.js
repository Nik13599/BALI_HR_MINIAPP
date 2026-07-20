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
      .sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
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
    style.textContent = `.menu-category-admin{margin-bottom:14px}.menu-category-create{display:grid;grid-template-columns:minmax(0,1fr) 100px auto;gap:8px;align-items:end}.menu-category-create label,.menu-category-row label{display:grid;gap:5px;color:var(--muted);font-size:9px;font-weight:800}.menu-category-create input,.menu-category-row input{width:100%;min-height:43px;padding:0 11px;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.04);color:var(--text)}.menu-category-list{display:grid;gap:8px;margin-top:13px}.menu-category-row{display:grid;grid-template-columns:minmax(0,1fr) 84px auto;gap:8px;align-items:end;padding:10px;border:1px solid rgba(255,255,255,.07);border-radius:14px;background:rgba(255,255,255,.018)}.menu-category-actions{display:flex;gap:6px}.menu-category-actions button{min-width:38px;height:43px;border-radius:11px}.menu-category-note{margin-top:10px;color:var(--muted);font-size:9px;line-height:1.5}@media(max-width:650px){.menu-category-create,.menu-category-row{grid-template-columns:1fr 78px}.menu-category-create button,.menu-category-actions{grid-column:1/-1}.menu-category-actions button{flex:1}}`;
    document.head.appendChild(style);
  }

  function categoryPanel(rows) {
    return `<section class="panel menu-category-admin"><div class="panel-head"><div><h3>Категории меню</h3><small>Добавление, переименование, сортировка и удаление</small></div></div><div class="panel-body"><form id="menuCategoryCreate" class="menu-category-create"><label><span>Новая категория</span><input name="name" placeholder="Например: Безалкогольные коктейли" required></label><label><span>Порядок</span><input name="sort_order" type="number" min="1" value="${rows.length + 1}"></label><button class="primary" type="submit">Добавить</button></form><div class="menu-category-list">${rows.map((row) => `<div class="menu-category-row" data-category-id="${esc(row.id)}"><label><span>Название</span><input data-category-name value="${esc(row.name)}"></label><label><span>Порядок</span><input data-category-order type="number" min="1" value="${Number(row.sort_order)}"></label><div class="menu-category-actions"><button class="secondary" type="button" data-category-up title="Выше">↑</button><button class="secondary" type="button" data-category-down title="Ниже">↓</button><button class="primary" type="button" data-category-save>Сохранить</button><button class="danger" type="button" data-category-delete>Удалить</button></div></div>`).join("")}</div><p class="menu-category-note">Новая категория сразу становится доступной при редактировании товара и появляется в пользовательском меню. Товары удалённой категории переносятся в «${FALLBACK}».</p></div></section>`;
  }

  async function updateItemsCategory(oldName, newName) {
    if (!oldName || oldName === newName) return;
    const items = await store.list("menu_items");
    for (const item of items.filter((row) => String(row.category || "") === oldName)) {
      await store.save("menu_items", { ...item, category: newName });
    }
  }

  async function renderCategoriesPanel(root) {
    if (state.view !== "menu" || !root || root.querySelector(".menu-category-admin")) return;
    const rows = await ensureCategories();
    root.insertAdjacentHTML("afterbegin", categoryPanel(rows));

    root.querySelector("#menuCategoryCreate")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      const name = String(data.name || "").trim();
      const current = read();
      if (!name) return toast("Введите название категории");
      if (current.some((row) => row.name.toLowerCase() === name.toLowerCase())) return toast("Такая категория уже существует");
      write([...current, { id: `category-${crypto.randomUUID?.() || Date.now()}`, name, sort_order: Number(data.sort_order || current.length + 1), active: true }]);
      toast("Категория добавлена");
      render();
    });

    root.querySelector(".menu-category-list")?.addEventListener("click", async (event) => {
      const rowNode = event.target.closest("[data-category-id]");
      if (!rowNode) return;
      const id = rowNode.dataset.categoryId;
      let rows = read();
      const index = rows.findIndex((row) => row.id === id);
      if (index < 0) return;

      if (event.target.closest("[data-category-up]") && index > 0) {
        [rows[index - 1].sort_order, rows[index].sort_order] = [rows[index].sort_order, rows[index - 1].sort_order];
        write(rows); return render();
      }
      if (event.target.closest("[data-category-down]") && index < rows.length - 1) {
        [rows[index + 1].sort_order, rows[index].sort_order] = [rows[index].sort_order, rows[index + 1].sort_order];
        write(rows); return render();
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
        return render();
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
        return render();
      }
    });
  }

  injectStyles();
  const baseRenderMenu = renderMenu;
  renderMenu = async function(root) {
    await baseRenderMenu(root);
    await renderCategoriesPanel(root);
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

  window.BaliMenuCategories = { KEY, read, write, ensureCategories };
})();
