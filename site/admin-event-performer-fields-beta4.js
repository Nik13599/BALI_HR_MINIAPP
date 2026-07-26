(() => {
  if (window.__BALI_ADMIN_EVENT_PERFORMER_FIELDS__) return;
  window.__BALI_ADMIN_EVENT_PERFORMER_FIELDS__ = true;

  try {
    if (typeof editorDefinitions === "undefined" || !editorDefinitions.events?.fields) return;

    const fields = editorDefinitions.events.fields;
    const additions = [
      ["dj_name", "DJ — имя", "text", false, "full"],
      ["dj_photo_url", "DJ — ссылка на фотографию", "url", false, "full"],
      ["dj_instagram_url", "DJ — Instagram", "url", false, "full"],
      ["dj_telegram_url", "DJ — Telegram-канал", "url", false, "full"],
      ["dj_tiktok_url", "DJ — TikTok", "url", false, "full"],
      ["dj_bio", "DJ — краткое описание", "textarea", false, "full"],
      ["host_name", "MC / ведущий — имя", "text", false, "full"],
      ["host_photo_url", "MC / ведущий — ссылка на фотографию", "url", false, "full"],
      ["host_instagram_url", "MC / ведущий — Instagram", "url", false, "full"],
      ["host_telegram_url", "MC / ведущий — Telegram-канал", "url", false, "full"],
      ["host_tiktok_url", "MC / ведущий — TikTok", "url", false, "full"],
      ["host_bio", "MC / ведущий — краткое описание", "textarea", false, "full"]
    ];
    additions.forEach(field => {
      if (!fields.some(existing => existing[0] === field[0])) fields.splice(fields.length - 1, 0, field);
    });

    const socialValue = (row, type) => {
      if (row?.[`${type}_url`]) return row[`${type}_url`];
      if (row?.[type]) return row[type];
      if (Array.isArray(row?.socials)) return row.socials.find(item => item.type === type)?.url || "";
      if (row?.socials && typeof row.socials === "object") return row.socials[type] || "";
      if (row?.social_url) {
        const url = String(row.social_url);
        if (type === "instagram" && /instagram\.com/i.test(url)) return url;
        if (type === "telegram" && /(?:t\.me|telegram\.me|tg:\/\/)/i.test(url)) return url;
        if (type === "tiktok" && /tiktok\.com/i.test(url)) return url;
      }
      return "";
    };

    const mapPerformer = (row, prefix) => ({
      [`${prefix}_name`]:row?.name || row?.title || "",
      [`${prefix}_photo_url`]:row?.photo_url || row?.photo || row?.image_url || "",
      [`${prefix}_instagram_url`]:socialValue(row, "instagram"),
      [`${prefix}_telegram_url`]:socialValue(row, "telegram"),
      [`${prefix}_tiktok_url`]:socialValue(row, "tiktok"),
      [`${prefix}_bio`]:row?.bio || row?.description || ""
    });

    const originalOpenEditor = typeof openEditor === "function" ? openEditor : null;
    if (originalOpenEditor) {
      openEditor = async function(type, row = null) {
        if (type !== "events" || !row) return originalOpenEditor(type, row);
        const performers = Array.isArray(row.performers) ? row.performers : [];
        const dj = performers.find(item => /\bdj\b/i.test(String(item.role || item.type || "")));
        const host = performers.find(item => /\b(?:mc|host|ведущ)/i.test(String(item.role || item.type || "")));
        return originalOpenEditor(type, {
          ...row,
          ...(dj ? mapPerformer(dj, "dj") : {}),
          ...(host ? mapPerformer(host, "host") : {})
        });
      };
    }

    const form = document.getElementById("editorForm");
    form?.addEventListener("submit", () => {
      if (typeof state === "undefined" || state.editing?.type !== "events") return;
      const elements = form.elements;
      const performer = prefix => {
        const name = String(elements[`${prefix}_name`]?.value || "").trim();
        if (!name) return null;
        return {
          id:`${prefix}-${String(state.editing.row?.id || Date.now())}`,
          role:prefix === "dj" ? "DJ" : "MC",
          name,
          photo_url:String(elements[`${prefix}_photo_url`]?.value || "").trim(),
          instagram_url:String(elements[`${prefix}_instagram_url`]?.value || "").trim(),
          telegram_url:String(elements[`${prefix}_telegram_url`]?.value || "").trim(),
          tiktok_url:String(elements[`${prefix}_tiktok_url`]?.value || "").trim(),
          bio:String(elements[`${prefix}_bio`]?.value || "").trim()
        };
      };
      const existing = Array.isArray(state.editing.row?.performers) ? state.editing.row.performers : [];
      const others = existing.filter(item => !/\b(?:dj|mc|host|ведущ)\b/i.test(String(item.role || item.type || "")));
      state.editing.row.performers = [performer("dj"), performer("host"), ...others].filter(Boolean);
    }, true);
  } catch (error) {
    console.warn("Не удалось подключить поля DJ/MC", error);
  }
})();