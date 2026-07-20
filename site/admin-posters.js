(() => {
  function imageFileToDataUrl(file, maxWidth = 1400, quality = 0.84) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Не удалось прочитать изображение"));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => resolve(String(reader.result || ""));
        image.onload = () => {
          const scale = Math.min(1, maxWidth / image.width);
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        image.src = String(reader.result || "");
      };
      reader.readAsDataURL(file);
    });
  }
  window.BaliImageTools = { fileToDataUrl: imageFileToDataUrl };

  editorDefinitions.events.fields = [
    ["title", "Название события", "text", true],
    ["event_date", "Дата", "date", true],
    ["event_time", "Время", "time", true],
    ["sort_order", "Порядок", "number"],
    ["image_file", "Загрузить изображение афиши", "file", false, "full"],
    ["image_url", "Или ссылка на изображение", "url", false, "full"],
    ["description", "Описание", "textarea", false, "full"],
    ["active", "Опубликовать", "checkbox"]
  ];

  const baseOpenEditor = openEditor;
  openEditor = async function(type, row = null) {
    await baseOpenEditor(type, row);
    if (type === "events" && row?.image_url) {
      $("#editorFields").insertAdjacentHTML("beforeend", `<div class="image-upload-preview" id="eventImagePreview"><img src="${esc(row.image_url)}" alt="Текущая афиша"/><span>Текущее изображение. Новая загрузка заменит его.</span></div>`);
    }
  };

  $("#editorFields").addEventListener("change", (event) => {
    const input = event.target.closest('input[name="image_file"]');
    if (!input?.files?.[0]) return;
    const previewUrl = URL.createObjectURL(input.files[0]);
    let preview = $("#eventImagePreview");
    if (!preview) {
      $("#editorFields").insertAdjacentHTML("beforeend", '<div class="image-upload-preview" id="eventImagePreview"><img alt="Предпросмотр"/><span></span></div>');
      preview = $("#eventImagePreview");
    }
    $("img", preview).src = previewUrl;
    $("span", preview).textContent = `${input.files[0].name} · будет сжато для Beta3`;
  });

  $("#editorForm").addEventListener("submit", async (event) => {
    if (state.editing?.type !== "events") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const form = new FormData(event.currentTarget);
    const payload = { ...(state.editing.row || {}) };
    for (const [key, value] of form.entries()) if (key !== "image_file") payload[key] = value;
    payload.active = Boolean($("#editorFields input[name='active']")?.checked);
    payload.sort_order = Number(payload.sort_order || 0);
    const file = $("#editorFields input[name='image_file']")?.files?.[0];
    try {
      if (file) payload.image_url = await imageFileToDataUrl(file);
      await store.save("events", payload);
      $("#editorDialog").close();
      toast(file ? "Афиша и изображение сохранены" : "Афиша сохранена");
      render();
    } catch (error) {
      toast(error.message || "Не удалось сохранить афишу");
    }
  }, true);

  renderEvents = async function(root) {
    const rows = await store.list("events", { order: "sort_order" });
    root.innerHTML = `<section class="panel"><div class="panel-head"><div><h3>Афиши и события</h3><small>Загружайте собственное изображение для каждой карточки Mini App</small></div></div>${rows.length ? `<table class="data-table"><thead><tr><th>Изображение</th><th>Событие</th><th>Дата</th><th>Время</th><th>Статус</th><th></th></tr></thead><tbody>${rows.map((row) => `<tr><td>${row.image_url ? `<img class="poster-admin-thumb" src="${esc(row.image_url)}" alt="${esc(row.title)}"/>` : '<div class="poster-admin-empty">НЕТ<br>ФОТО</div>'}</td><td><strong>${esc(row.title)}</strong><br><small>${esc(row.description)}</small></td><td>${formatDate(row.event_date)}</td><td>${esc(row.event_time)}</td><td><span class="status ${row.active !== false ? "available" : "completed"}">${row.active !== false ? "Опубликовано" : "Черновик"}</span></td><td><div class="row-actions"><button class="icon-btn" data-edit="events" data-id="${row.id}">✎</button><button class="icon-btn" data-delete="events" data-id="${row.id}">×</button></div></td></tr>`).join("")}</tbody></table>` : '<div class="empty">Афиш пока нет</div>'}</section>`;
  };
})();