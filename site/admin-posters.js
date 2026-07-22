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

  const parsePerformers = value => {
    if (Array.isArray(value)) return value;
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const uid = () => `artist-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;

  window.BaliImageTools = { fileToDataUrl: imageFileToDataUrl };

  const style = document.createElement("style");
  style.id = "adminEventLineupStyle";
  style.textContent = `
    .event-lineup-editor{grid-column:1/-1;display:grid;gap:12px;padding:14px;border:1px solid rgba(200,255,61,.22);border-radius:16px;background:rgba(200,255,61,.035)}
    .event-lineup-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.event-lineup-head h3{margin:0;font-size:15px}.event-lineup-head p{margin:4px 0 0;color:var(--muted);font-size:9px;line-height:1.45}
    .event-lineup-list{display:grid;gap:10px}.event-lineup-empty{padding:18px;border:1px dashed var(--line);border-radius:14px;color:var(--muted);font-size:10px;text-align:center}
    .event-artist-editor{position:relative;display:grid;grid-template-columns:110px minmax(0,1fr) minmax(0,1fr);gap:10px;padding:12px;border:1px solid var(--line);border-radius:15px;background:#0d110f}
    .event-artist-photo{grid-row:span 2;display:grid;align-content:start;gap:7px}.event-artist-photo-preview{width:100%;aspect-ratio:1;display:grid;place-items:center;overflow:hidden;border:1px solid var(--line);border-radius:14px;background:#171c19;color:var(--muted);font-size:9px;text-align:center}.event-artist-photo-preview img{width:100%;height:100%;object-fit:cover}
    .event-artist-editor label{display:grid;gap:5px;color:var(--muted);font-size:9px;font-weight:800}.event-artist-editor input{width:100%;min-height:42px;padding:0 10px;border:1px solid var(--line);border-radius:11px;background:#171c19;color:#fff}.event-artist-editor input[type=file]{padding:8px;font-size:8px}
    .event-artist-link{grid-column:2/-1}.event-artist-remove{position:absolute;right:8px;top:8px;width:30px;height:30px;border:1px solid rgba(255,119,119,.28);border-radius:50%;background:#ff777714;color:#ff9b9b}
    .event-lineup-count{color:var(--lime);font-weight:900}
    @media(max-width:720px){.event-artist-editor{grid-template-columns:86px minmax(0,1fr)}.event-artist-photo{grid-row:span 3}.event-artist-link{grid-column:2}.event-artist-editor label:nth-of-type(2){grid-column:2}}
  `;
  document.head.appendChild(style);

  editorDefinitions.events.fields = [
    ["title", "Название события", "text", true],
    ["event_date", "Дата", "date", true],
    ["event_time", "Время", "time", true],
    ["sort_order", "Порядок", "number"],
    ["image_file", "Загрузить изображение афиши", "file", false, "full"],
    ["image_url", "Или ссылка на изображение", "url", false, "full"],
    ["description", "Краткое описание для карточки и первого экрана", "textarea", false, "full"],
    ["details_description", "Подробное описание вечеринки", "textarea", false, "full"],
    ["active", "Опубликовать", "checkbox"]
  ];

  function artistEditor(row = {}) {
    const id = row.id || uid();
    const photo = row.photo_url || row.photo || "";
    return `<article class="event-artist-editor" data-event-artist-id="${esc(id)}" data-existing-photo="${esc(photo)}">
      <button class="event-artist-remove" type="button" data-remove-event-artist title="Удалить участника">×</button>
      <div class="event-artist-photo">
        <div class="event-artist-photo-preview">${photo ? `<img src="${esc(photo)}" alt="${esc(row.name || "Участник")}">` : "ФОТО<br>УЧАСТНИКА"}</div>
        <input type="file" accept="image/*" data-event-artist-photo aria-label="Фотография участника">
      </div>
      <label><span>Кто это / роль</span><input data-event-artist-role value="${esc(row.role || "")}" placeholder="DJ, MC, шоу-балет, go-go, артист"></label>
      <label><span>Имя или название</span><input data-event-artist-name value="${esc(row.name || "")}" placeholder="DJ ANI, MC Максим, Secret Guest"></label>
      <label class="event-artist-link"><span>Instagram или Telegram</span><input data-event-artist-link type="url" value="${esc(row.social_url || row.link || "")}" placeholder="https://instagram.com/... или https://t.me/..."></label>
    </article>`;
  }

  function lineupEditor(rows = []) {
    return `<section class="event-lineup-editor" id="eventLineupEditor">
      <div class="event-lineup-head"><div><h3>Участники и артисты</h3><p>Добавляйте DJ, MC, артистов, шоу-балет, go-go и других участников. Карточки появятся в подробном описании события.</p></div><button class="ghost" type="button" data-add-event-artist>＋ Добавить участника</button></div>
      <div class="event-lineup-list" id="eventLineupList">${rows.length ? rows.map(artistEditor).join("") : '<div class="event-lineup-empty">Участники пока не добавлены</div>'}</div>
    </section>`;
  }

  const baseOpenEditor = openEditor;
  openEditor = async function(type, row = null) {
    await baseOpenEditor(type, row);
    if (type !== "events") return;
    if (row?.image_url) {
      $("#editorFields").insertAdjacentHTML("beforeend", `<div class="image-upload-preview" id="eventImagePreview"><img src="${esc(row.image_url)}" alt="Текущая афиша"/><span>Текущее изображение. Новая загрузка заменит его.</span></div>`);
    }
    $("#editorFields").insertAdjacentHTML("beforeend", lineupEditor(parsePerformers(row?.performers)));
  };

  $("#editorFields").addEventListener("click", event => {
    const add = event.target.closest("[data-add-event-artist]");
    if (add) {
      const list = $("#eventLineupList");
      list.querySelector(".event-lineup-empty")?.remove();
      list.insertAdjacentHTML("beforeend", artistEditor());
      return;
    }
    const remove = event.target.closest("[data-remove-event-artist]");
    if (remove) {
      const list = $("#eventLineupList");
      remove.closest("[data-event-artist-id]")?.remove();
      if (list && !list.querySelector("[data-event-artist-id]")) list.innerHTML = '<div class="event-lineup-empty">Участники пока не добавлены</div>';
    }
  });

  $("#editorFields").addEventListener("change", event => {
    const posterInput = event.target.closest('input[name="image_file"]');
    if (posterInput?.files?.[0]) {
      const previewUrl = URL.createObjectURL(posterInput.files[0]);
      let preview = $("#eventImagePreview");
      if (!preview) {
        $("#eventFields")?.insertAdjacentHTML("beforeend", '<div class="image-upload-preview" id="eventImagePreview"><img alt="Предпросмотр"/><span></span></div>');
        $("#editorFields").insertAdjacentHTML("beforeend", '<div class="image-upload-preview" id="eventImagePreview"><img alt="Предпросмотр"/><span></span></div>');
        preview = $("#eventImagePreview");
      }
      $("img", preview).src = previewUrl;
      $("span", preview).textContent = `${posterInput.files[0].name} · будет сжато для приложения`;
      return;
    }
    const artistInput = event.target.closest("[data-event-artist-photo]");
    if (artistInput?.files?.[0]) {
      const card = artistInput.closest("[data-event-artist-id]");
      const preview = card?.querySelector(".event-artist-photo-preview");
      if (preview) preview.innerHTML = `<img src="${URL.createObjectURL(artistInput.files[0])}" alt="Предпросмотр">`;
    }
  });

  async function collectPerformers() {
    const cards = $$("#eventLineupList [data-event-artist-id]");
    const performers = [];
    for (const card of cards) {
      const role = card.querySelector("[data-event-artist-role]")?.value.trim() || "";
      const name = card.querySelector("[data-event-artist-name]")?.value.trim() || "";
      const socialUrl = card.querySelector("[data-event-artist-link]")?.value.trim() || "";
      const file = card.querySelector("[data-event-artist-photo]")?.files?.[0];
      let photoUrl = card.dataset.existingPhoto || "";
      if (file) photoUrl = await imageFileToDataUrl(file, 640, 0.82);
      if (!role && !name && !photoUrl && !socialUrl) continue;
      performers.push({ id: card.dataset.eventArtistId || uid(), role, name, photo_url: photoUrl, social_url: socialUrl });
    }
    return performers;
  }

  $("#editorForm").addEventListener("submit", async event => {
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
      payload.performers = await collectPerformers();
      await store.save("events", payload);
      $("#editorDialog").close();
      toast(file ? "Афиша, описание и участники сохранены" : "Афиша и участники сохранены");
      render();
    } catch (error) {
      toast(error.message || "Не удалось сохранить афишу");
    }
  }, true);

  renderEvents = async function(root) {
    const rows = await store.list("events", { order: "sort_order" });
    root.innerHTML = `<section class="panel"><div class="panel-head"><div><h3>Афиши и события</h3><small>Основная афиша, подробное описание и любое количество участников</small></div></div>${rows.length ? `<table class="data-table"><thead><tr><th>Изображение</th><th>Событие</th><th>Участники</th><th>Дата</th><th>Время</th><th>Статус</th><th></th></tr></thead><tbody>${rows.map(row => { const performers = parsePerformers(row.performers); return `<tr><td>${row.image_url ? `<img class="poster-admin-thumb" src="${esc(row.image_url)}" alt="${esc(row.title)}"/>` : '<div class="poster-admin-empty">НЕТ<br>ФОТО</div>'}</td><td><strong>${esc(row.title)}</strong><br><small>${esc(row.description)}</small></td><td><span class="event-lineup-count">${performers.length}</span><br><small>${performers.slice(0, 2).map(item => esc(`${item.role || "Артист"}: ${item.name || "без имени"}`)).join(" · ") || "Не добавлены"}</small></td><td>${formatDate(row.event_date)}</td><td>${esc(row.event_time)}</td><td><span class="status ${row.active !== false ? "available" : "completed"}">${row.active !== false ? "Опубликовано" : "Черновик"}</span></td><td><div class="row-actions"><button class="icon-btn" data-edit="events" data-id="${row.id}">✎</button><button class="icon-btn" data-delete="events" data-id="${row.id}">×</button></div></td></tr>`; }).join("")}</tbody></table>` : '<div class="empty">Афиш пока нет</div>'}</section>`;
  };
})();