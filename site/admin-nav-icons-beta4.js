(() => {
  if (window.__BALI_ADMIN_NAV_ICONS__ || !window.BaliNavIcons) return;
  window.__BALI_ADMIN_NAV_ICONS__ = true;
  const api = window.BaliNavIcons;
  const esc = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  }[char]));

  function styles() {
    if (document.getElementById("adminNavIconsStyle")) return;
    const style = document.createElement("style");
    style.id = "adminNavIconsStyle";
    style.textContent = `.admin-nav-icons{margin-top:18px}.admin-nav-icons-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.admin-nav-icon-card{display:grid;grid-template-columns:66px minmax(0,1fr);gap:10px;padding:11px;border:1px solid var(--line);border-radius:15px;background:rgba(255,255,255,.025)}.admin-nav-icon-preview{width:66px;height:66px;display:grid;place-items:center;overflow:hidden;border:1px solid rgba(200,255,61,.24);border-radius:15px;background:#0c0f0e;color:var(--lime);font-size:28px}.admin-nav-icon-preview img{width:36px;height:36px;object-fit:contain;border-radius:9px}.admin-nav-icon-fields{display:grid;gap:7px;min-width:0}.admin-nav-icon-fields h4{margin:0;font-size:11px}.admin-nav-icon-fields label{display:grid;gap:4px;color:var(--muted);font-size:8px;font-weight:800}.admin-nav-icon-fields input{width:100%;min-height:37px;padding:8px 9px;border:1px solid var(--line);border-radius:10px;background:rgba(255,255,255,.045);color:var(--text)}.admin-nav-icon-size{color:#d7ad68;font-size:8px;font-weight:800}.admin-nav-icon-actions{display:flex;gap:6px;flex-wrap:wrap;grid-column:1/-1}.admin-nav-icon-actions button{min-height:34px}.admin-nav-icons-footer{display:flex;gap:8px;margin-top:12px}.admin-nav-icons-footer button{flex:1}.admin-nav-icons-note{margin-bottom:11px;padding:10px;border:1px solid rgba(200,255,61,.18);border-radius:12px;background:rgba(200,255,61,.05);color:#c7d6a1;font-size:9px;line-height:1.5}@media(max-width:1000px){.admin-nav-icons-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:680px){.admin-nav-icons-grid{grid-template-columns:1fr}.admin-nav-icons-footer{flex-direction:column}}`;
    document.head.appendChild(style);
  }

  function preview(row) {
    return row.image
      ? `<img src="${esc(row.image)}" alt="">`
      : `<span>${esc(row.iconText || "•")}</span>`;
  }

  function panel() {
    return `<section class="panel admin-nav-icons"><div class="panel-head"><div><h3>Значки нижнего меню приложения</h3><small>Главная, афиши, меню, BALI PEOPLE, игра и профиль</small></div><span class="count">6 КНОПОК</span></div><div class="panel-body">
      <div class="admin-nav-icons-note">Исходный размер каждого значка: <strong>256 × 256 px</strong>. Можно менять название кнопки, указать URL, загрузить PNG/JPG/WEBP или оставить изображение пустым и использовать символ/эмодзи.</div>
      <form id="adminNavIconsForm">
        <div class="admin-nav-icons-grid">${api.read().map((row) => `<article class="admin-nav-icon-card" data-nav-icon-row="${esc(row.page)}">
          <div class="admin-nav-icon-preview" data-nav-icon-preview>${preview(row)}</div>
          <div class="admin-nav-icon-fields"><h4>${esc(row.label)}</h4><div class="admin-nav-icon-size">256 × 256 px</div>
            <label><span>Название кнопки</span><input data-nav-icon-field="label" maxlength="24" value="${esc(row.label)}"></label>
            <label><span>Символ или эмодзи</span><input data-nav-icon-field="iconText" maxlength="12" value="${esc(row.iconText)}"></label>
            <label><span>URL изображения</span><input data-nav-icon-field="image" value="${esc(row.image)}" placeholder="https://… или ./assets/icon.webp"></label>
          </div>
          <div class="admin-nav-icon-actions">
            <button class="secondary compact" type="button" data-nav-icon-pick>Загрузить</button>
            <button class="ghost compact" type="button" data-nav-icon-clear>Убрать картинку</button>
            <button class="ghost compact pink" type="button" data-nav-icon-reset="${esc(row.page)}">Вернуть исходный</button>
            <input type="file" accept="image/png,image/jpeg,image/webp" data-nav-icon-file hidden>
          </div>
        </article>`).join("")}</div>
        <div class="admin-nav-icons-footer"><button class="primary" type="submit">Сохранить значки меню</button><button class="danger" type="button" data-nav-icons-reset-all>Вернуть все исходные значки</button></div>
      </form>
    </div></section>`;
  }

  function renderPanel(root) {
    if (!root || typeof state === "undefined" || state.view !== "settings") return;
    root.querySelector(".admin-nav-icons")?.remove();
    root.insertAdjacentHTML("beforeend", panel());
  }

  function collect(form = document.getElementById("adminNavIconsForm")) {
    if (!form) return api.read();
    return [...form.querySelectorAll("[data-nav-icon-row]")].map((card) => {
      const fallback = api.item(card.dataset.navIconRow);
      return {
        page: card.dataset.navIconRow,
        label: card.querySelector('[data-nav-icon-field="label"]').value.trim() || fallback.label,
        iconText: card.querySelector('[data-nav-icon-field="iconText"]').value.trim(),
        image: card.querySelector('[data-nav-icon-field="image"]').value.trim(),
      };
    });
  }

  function updatePreview(card) {
    const previewNode = card?.querySelector("[data-nav-icon-preview]");
    if (!previewNode) return;
    const imageUrl = card.querySelector('[data-nav-icon-field="image"]').value.trim();
    const iconText = card.querySelector('[data-nav-icon-field="iconText"]').value.trim() || "•";
    previewNode.replaceChildren();
    if (imageUrl) {
      const image = document.createElement("img");
      image.src = imageUrl;
      image.alt = "";
      image.addEventListener("error", () => {
        previewNode.replaceChildren();
        previewNode.textContent = iconText;
      }, { once: true });
      previewNode.appendChild(image);
    } else {
      previewNode.textContent = iconText;
    }
  }

  document.addEventListener("input", (event) => {
    if (event.target.matches('[data-nav-icon-field="image"],[data-nav-icon-field="iconText"]')) {
      updatePreview(event.target.closest("[data-nav-icon-row]"));
    }
  }, true);

  document.addEventListener("click", (event) => {
    const pick = event.target.closest("[data-nav-icon-pick]");
    if (pick) {
      event.preventDefault();
      const input = pick.closest("[data-nav-icon-row]")?.querySelector("[data-nav-icon-file]");
      if (input) {
        input.value = "";
        input.click();
      }
      return;
    }
    const clear = event.target.closest("[data-nav-icon-clear]");
    if (clear) {
      event.preventDefault();
      const card = clear.closest("[data-nav-icon-row]");
      card.querySelector('[data-nav-icon-field="image"]').value = "";
      updatePreview(card);
      return;
    }
    const reset = event.target.closest("[data-nav-icon-reset]");
    if (reset) {
      event.preventDefault();
      api.resetPage(reset.dataset.navIconReset);
      renderPanel(document.getElementById("content"));
      window.toast?.("Исходный значок восстановлен");
      return;
    }
    if (event.target.closest("[data-nav-icons-reset-all]")) {
      event.preventDefault();
      if (!confirm("Вернуть все стандартные значки нижнего меню?")) return;
      api.reset();
      renderPanel(document.getElementById("content"));
      window.toast?.("Все стандартные значки восстановлены");
    }
  }, true);

  document.addEventListener("change", async (event) => {
    const input = event.target.closest("[data-nav-icon-file]");
    if (!input || !input.files?.[0]) return;
    try {
      const file = input.files[0];
      if (!/^image\/(png|jpeg|webp)$/i.test(file.type)) throw new Error("Поддерживаются PNG, JPG и WEBP");
      const card = input.closest("[data-nav-icon-row]");
      const data = await api.imageData(file);
      card.querySelector('[data-nav-icon-field="image"]').value = data;
      updatePreview(card);
      api.write(collect(input.form));
      window.toast?.("Значок загружен и сохранён");
    } catch (error) {
      window.toast?.(error.message || "Не удалось загрузить значок");
    }
  }, true);

  document.addEventListener("submit", (event) => {
    if (event.target.id !== "adminNavIconsForm") return;
    event.preventDefault();
    try {
      api.write(collect(event.target));
      window.toast?.("Значки нижнего меню сохранены");
    } catch (error) {
      window.toast?.(error?.name === "QuotaExceededError" ? "Недостаточно памяти для изображений" : "Не удалось сохранить значки");
    }
  }, true);

  styles();
  const baseRenderSettings = window.renderSettings;
  window.renderSettings = function navIconsRenderSettings(root) {
    baseRenderSettings(root);
    renderPanel(root);
  };
  if (typeof state !== "undefined" && state.view === "settings") window.render?.();
})();
