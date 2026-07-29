(() => {
  if (window.__BALI_ADMIN_VISUAL_BLOCKS__ || !window.BaliVisualBlocks) return;
  window.__BALI_ADMIN_VISUAL_BLOCKS__ = true;

  const api = window.BaliVisualBlocks;
  let draft = api.read();
  const esc = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  }[char]));
  const isDataImage = (value) => /^data:image\//i.test(String(value || ""));
  const blockById = (id) => api.BLOCKS.find((block) => block.id === id);

  function styles() {
    if (document.getElementById("adminVisualBlocksStyle")) return;
    const style = document.createElement("style");
    style.id = "adminVisualBlocksStyle";
    style.textContent = `
      .visual-blocks-panel{margin-top:18px}.visual-blocks-intro{display:grid;gap:8px;margin-bottom:13px;padding:12px;border:1px solid rgba(215,173,104,.22);border-radius:14px;background:rgba(148,102,58,.08);color:#d8c8aa;font-size:9px;line-height:1.55}
      .visual-blocks-intro strong{color:var(--text)}.visual-blocks-groups{display:grid;gap:11px}.visual-blocks-group{border:1px solid var(--line);border-radius:17px;background:rgba(255,255,255,.022);overflow:hidden}
      .visual-blocks-group>summary{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px;cursor:pointer;list-style:none;color:var(--text);font-weight:900}.visual-blocks-group>summary::-webkit-details-marker{display:none}.visual-blocks-group>summary span{color:#d7ad68;font-size:8px}.visual-blocks-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:0 12px 12px}
      .visual-block-card{display:grid;grid-template-columns:112px minmax(0,1fr);gap:11px;padding:11px;border:1px solid rgba(255,255,255,.08);border-radius:15px;background:rgba(4,6,5,.58)}.visual-block-preview{position:relative;width:112px;min-height:126px;overflow:hidden;border:1px solid rgba(215,173,104,.25);border-radius:13px;background:#101210;display:grid;place-items:center;color:var(--muted);font-size:8px;text-align:center}
      .visual-block-preview img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.visual-block-preview:after{content:'';position:absolute;inset:0;background:linear-gradient(transparent,rgba(0,0,0,.56));pointer-events:none}.visual-block-preview span{position:relative;z-index:1;padding:8px}.visual-block-content{display:grid;gap:8px;min-width:0}.visual-block-head{display:flex;align-items:start;justify-content:space-between;gap:8px}.visual-block-head h4{margin:0;font-size:11px;line-height:1.35}.visual-block-head b{flex:none;padding:4px 6px;border-radius:999px;background:rgba(215,173,104,.12);color:#d7ad68;font-size:7px}
      .visual-block-size{color:#d7ad68;font-size:8px;font-weight:800}.visual-block-field{display:grid;gap:4px;color:var(--muted);font-size:8px;font-weight:800}.visual-block-field input,.visual-block-field select{width:100%;min-height:38px;padding:8px 9px;border:1px solid var(--line);border-radius:10px;background:rgba(255,255,255,.045);color:var(--text)}.visual-block-row{display:grid;grid-template-columns:1fr 1fr;gap:7px}.visual-block-range{display:grid;grid-template-columns:1fr auto;align-items:center;gap:7px}.visual-block-range output{min-width:31px;color:#d7ad68;text-align:right}
      .visual-block-actions{display:flex;gap:6px;flex-wrap:wrap;grid-column:1/-1}.visual-block-actions button{min-height:34px}.visual-block-actions .save{margin-left:auto}.visual-block-footer{display:flex;gap:8px;position:sticky;bottom:0;margin-top:13px;padding:11px;border:1px solid var(--line);border-radius:15px;background:rgba(7,9,8,.95);backdrop-filter:blur(10px);z-index:5}.visual-block-footer button{flex:1}
      @media(max-width:1100px){.visual-blocks-grid{grid-template-columns:1fr}}@media(max-width:680px){.visual-block-card{grid-template-columns:86px minmax(0,1fr)}.visual-block-preview{width:86px;min-height:116px}.visual-block-row{grid-template-columns:1fr}.visual-block-actions .save{margin-left:0}.visual-block-footer{bottom:68px;flex-direction:column}}
    `;
    document.head.appendChild(style);
  }

  function previewImage(block, current) {
    const image = current.image || block.defaultImage;
    const status = current.image ? (isDataImage(current.image) ? "Загружено" : "Свой URL") : "Исходное";
    return `<div class="visual-block-preview" data-visual-preview>${image ? `<img src="${esc(image)}" alt="">` : ""}<span>${esc(status)}</span></div>`;
  }

  function positionOptions(value) {
    const options = [
      ["center", "По центру"],
      ["top", "Сверху"],
      ["bottom", "Снизу"],
      ["left", "Слева"],
      ["right", "Справа"],
    ];
    return options.map(([id, label]) => `<option value="${id}" ${value === id ? "selected" : ""}>${label}</option>`).join("");
  }

  function blockCard(block) {
    const current = draft[block.id];
    const externalUrl = isDataImage(current.image) ? "" : current.image;
    return `<article class="visual-block-card" data-visual-block-card="${esc(block.id)}">
      ${previewImage(block, current)}
      <div class="visual-block-content">
        <div class="visual-block-head"><h4>${esc(block.label)}</h4><b>${esc(block.id)}</b></div>
        <div class="visual-block-size">Размер: ${block.width} × ${block.height} px</div>
        <label class="visual-block-field"><span>Название блока</span><input data-visual-field="title" maxlength="120" value="${esc(current.title)}" placeholder="${esc(block.defaultTitle)}"></label>
        <label class="visual-block-field"><span>URL фонового изображения</span><input data-visual-field="image" value="${esc(externalUrl)}" placeholder="https://… или ./assets/image.webp"></label>
        <div class="visual-block-row">
          <label class="visual-block-field"><span>Затемнение</span><span class="visual-block-range"><input data-visual-field="overlay" type="range" min="0" max="88" value="${Number(current.overlay)}"><output>${Number(current.overlay)}%</output></span></label>
          <label class="visual-block-field"><span>Позиция изображения</span><select data-visual-field="position">${positionOptions(current.position)}</select></label>
        </div>
      </div>
      <div class="visual-block-actions">
        <button class="secondary compact" type="button" data-visual-upload>Загрузить</button>
        <button class="ghost compact" type="button" data-visual-clear-image ${current.image ? "" : "disabled"}>Убрать картинку</button>
        <button class="ghost compact pink" type="button" data-visual-reset>Вернуть исходный</button>
        <button class="primary compact save" type="button" data-visual-save>Сохранить блок</button>
        <input type="file" accept="image/png,image/jpeg,image/webp" data-visual-file hidden>
      </div>
    </article>`;
  }

  function groupPanel(group, index) {
    const blocks = api.BLOCKS.filter((block) => block.group === group.id);
    return `<details class="visual-blocks-group" ${index === 0 ? "open" : ""}><summary>${esc(group.label)}<span>${blocks.length} блоков</span></summary><div class="visual-blocks-grid">${blocks.map(blockCard).join("")}</div></details>`;
  }

  function panel() {
    return `<section class="panel visual-blocks-panel"><div class="panel-head"><div><h3>Все визуальные блоки приложения</h3><small>Названия, изображения, затемнение и положение фона для каждого раздела</small></div><span class="count">${api.BLOCKS.length} БЛОКОВ</span></div><div class="panel-body">
      <div class="visual-blocks-intro"><strong>Размеры уже указаны у каждого изображения.</strong><span>PNG, JPG или WEBP до 12 МБ. При загрузке картинка автоматически обрезается под точный размер блока и сохраняется в WEBP. Пустое название или изображение означает исходное значение. URL удобнее для большого количества картинок.</span></div>
      <form id="visualBlocksForm"><div class="visual-blocks-groups">${api.GROUPS.map(groupPanel).join("")}</div>
        <div class="visual-block-footer"><button class="primary" type="submit">Сохранить все блоки</button><button class="danger" type="button" data-visual-reset-all>Вернуть весь дизайн к исходному</button></div>
      </form>
    </div></section>`;
  }

  function renderPanel(root) {
    if (!root || typeof state === "undefined" || state.view !== "settings") return;
    draft = api.read();
    root.querySelector(".visual-blocks-panel")?.remove();
    root.insertAdjacentHTML("beforeend", panel());
  }

  function collectCard(card) {
    const id = card.dataset.visualBlockCard;
    const current = draft[id] || {};
    const url = card.querySelector('[data-visual-field="image"]').value.trim();
    return {
      title: card.querySelector('[data-visual-field="title"]').value.trim(),
      image: url || (isDataImage(current.image) ? current.image : ""),
      overlay: Number(card.querySelector('[data-visual-field="overlay"]').value),
      position: card.querySelector('[data-visual-field="position"]').value,
    };
  }

  function collectAll(form = document.getElementById("visualBlocksForm")) {
    const next = api.read();
    form?.querySelectorAll("[data-visual-block-card]").forEach((card) => {
      next[card.dataset.visualBlockCard] = collectCard(card);
    });
    return next;
  }

  function updatePreview(card) {
    const id = card?.dataset.visualBlockCard;
    const block = blockById(id);
    const preview = card?.querySelector("[data-visual-preview]");
    if (!block || !preview) return;
    const url = card.querySelector('[data-visual-field="image"]').value.trim();
    const current = draft[id];
    const imageUrl = url || (isDataImage(current.image) ? current.image : block.defaultImage);
    const status = url ? "Свой URL" : isDataImage(current.image) ? "Загружено" : "Исходное";
    preview.replaceChildren();
    if (imageUrl) {
      const image = document.createElement("img");
      image.src = imageUrl;
      image.alt = "";
      preview.appendChild(image);
    }
    const label = document.createElement("span");
    label.textContent = status;
    preview.appendChild(label);
  }

  document.addEventListener("input", (event) => {
    const range = event.target.closest('[data-visual-field="overlay"]');
    if (range) range.closest(".visual-block-range")?.querySelector("output")?.replaceChildren(`${range.value}%`);
    if (event.target.matches('[data-visual-field="image"]')) updatePreview(event.target.closest("[data-visual-block-card]"));
  }, true);

  document.addEventListener("click", (event) => {
    const card = event.target.closest("[data-visual-block-card]");
    if (event.target.closest("[data-visual-upload]")) {
      event.preventDefault();
      const input = card?.querySelector("[data-visual-file]");
      if (input) {
        input.value = "";
        input.click();
      }
      return;
    }
    if (event.target.closest("[data-visual-clear-image]")) {
      event.preventDefault();
      const id = card.dataset.visualBlockCard;
      draft[id] = { ...collectCard(card), image: "" };
      api.write(draft);
      renderPanel(document.getElementById("content"));
      window.toast?.("Изображение блока удалено");
      return;
    }
    if (event.target.closest("[data-visual-reset]")) {
      event.preventDefault();
      api.resetBlock(card.dataset.visualBlockCard);
      renderPanel(document.getElementById("content"));
      window.toast?.("Исходный вид блока восстановлен");
      return;
    }
    if (event.target.closest("[data-visual-save]")) {
      event.preventDefault();
      const id = card.dataset.visualBlockCard;
      draft[id] = collectCard(card);
      api.write(draft);
      renderPanel(document.getElementById("content"));
      window.toast?.("Блок сохранён");
      return;
    }
    if (event.target.closest("[data-visual-reset-all]")) {
      event.preventDefault();
      if (!confirm("Вернуть названия и изображения всех блоков к исходному виду?")) return;
      api.reset();
      renderPanel(document.getElementById("content"));
      window.toast?.("Весь дизайн блоков возвращён к исходному");
    }
  }, true);

  document.addEventListener("change", async (event) => {
    const input = event.target.closest("[data-visual-file]");
    if (!input?.files?.[0]) return;
    const card = input.closest("[data-visual-block-card]");
    const block = blockById(card?.dataset.visualBlockCard);
    if (!block) return;
    try {
      const data = await api.imageData(input.files[0], block.width, block.height);
      const id = block.id;
      draft[id] = { ...collectCard(card), image: data };
      api.write(draft);
      renderPanel(document.getElementById("content"));
      window.toast?.(`Изображение ${block.width} × ${block.height} px загружено`);
    } catch (error) {
      window.toast?.(error?.name === "QuotaExceededError" ? "Недостаточно памяти. Используйте URL изображения." : error.message || "Не удалось загрузить изображение");
    }
  }, true);

  document.addEventListener("submit", (event) => {
    if (event.target.id !== "visualBlocksForm") return;
    event.preventDefault();
    try {
      draft = api.write(collectAll(event.target));
      renderPanel(document.getElementById("content"));
      window.toast?.("Дизайн всех блоков сохранён");
    } catch (error) {
      window.toast?.(error?.name === "QuotaExceededError" ? "Недостаточно памяти. Используйте URL для больших изображений." : "Не удалось сохранить дизайн");
    }
  }, true);

  styles();
  const baseRenderSettings = window.renderSettings;
  window.renderSettings = function visualBlocksRenderSettings(root) {
    baseRenderSettings(root);
    renderPanel(root);
  };
  if (typeof state !== "undefined" && state.view === "settings") window.render?.();
})();
