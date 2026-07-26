(() => {
  if (window.__BALI_EVENT_PERFORMER_CARDS__) return;
  window.__BALI_EVENT_PERFORMER_CARDS__ = true;

  const EVENTS_KEY = "bali_events_v2";
  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;"
  })[char]);
  const initials = name => String(name || "BALI").trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase();

  const readEvents = () => {
    try {
      const rows = JSON.parse(localStorage.getItem(EVENTS_KEY) || "[]");
      return Array.isArray(rows) ? rows : [];
    } catch {
      return [];
    }
  };

  function normalizeUrl(value, type = "") {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) return raw;
    if (/^tg:\/\//i.test(raw)) return raw;
    if (raw.startsWith("@")) {
      const handle = raw.slice(1);
      return type === "instagram" ? `https://instagram.com/${handle}` : `https://t.me/${handle}`;
    }
    if (/^(?:t\.me|instagram\.com|www\.instagram\.com|tiktok\.com|www\.tiktok\.com)\//i.test(raw)) return `https://${raw}`;
    return "";
  }

  function inferType(url = "") {
    if (/instagram\.com/i.test(url)) return "instagram";
    if (/(?:t\.me|telegram\.me|tg:\/\/)/i.test(url)) return "telegram";
    if (/tiktok\.com/i.test(url)) return "tiktok";
    if (/vk\.com/i.test(url)) return "vk";
    return "website";
  }

  function socialList(row = {}) {
    const result = [];
    const add = (type, value, label = "") => {
      const url = normalizeUrl(value, type);
      if (!url || result.some(item => item.url === url)) return;
      result.push({ type, url, label });
    };

    if (Array.isArray(row.socials)) {
      row.socials.forEach(item => add(item.type || inferType(item.url), item.url, item.label));
    } else if (row.socials && typeof row.socials === "object") {
      Object.entries(row.socials).forEach(([type, value]) => add(type, value));
    }

    add("instagram", row.instagram_url || row.instagram || row.instagramUrl);
    add("telegram", row.telegram_url || row.telegram || row.telegramUrl || row.telegram_channel);
    add("tiktok", row.tiktok_url || row.tiktok || row.tiktokUrl);
    add("vk", row.vk_url || row.vk || row.vkUrl);
    add("website", row.website_url || row.website || row.site_url);
    if (row.social_url) add(inferType(row.social_url), row.social_url);
    return result;
  }

  function fallbackPerformers(event = {}) {
    const result = [];
    if (event.dj_name) result.push({
      id:"event-dj",
      role:"DJ",
      name:event.dj_name,
      photo_url:event.dj_photo_url || event.dj_photo || "",
      instagram_url:event.dj_instagram_url || event.dj_instagram || "",
      telegram_url:event.dj_telegram_url || event.dj_telegram || "",
      tiktok_url:event.dj_tiktok_url || event.dj_tiktok || "",
      bio:event.dj_bio || ""
    });
    if (event.host_name || event.mc_name) result.push({
      id:"event-host",
      role:event.host_role || "MC",
      name:event.host_name || event.mc_name,
      photo_url:event.host_photo_url || event.mc_photo_url || event.host_photo || "",
      instagram_url:event.host_instagram_url || event.mc_instagram_url || "",
      telegram_url:event.host_telegram_url || event.mc_telegram_url || "",
      tiktok_url:event.host_tiktok_url || event.mc_tiktok_url || "",
      bio:event.host_bio || event.mc_bio || ""
    });
    return result;
  }

  function performersFor(event = {}) {
    const rows = Array.isArray(event.performers) && event.performers.length ? event.performers : fallbackPerformers(event);
    return rows.map((row, index) => ({
      ...row,
      id:row.id || `performer-${index}`,
      name:row.name || row.title || "Артист BALI",
      role:row.role || row.type || "Артист",
      photo_url:row.photo_url || row.photo || row.image_url || row.avatar || "",
      bio:row.bio || row.description || "",
      socials:socialList(row)
    }));
  }

  function currentEvent() {
    const title = document.getElementById("eventDialogTitle")?.textContent?.trim();
    const dateText = document.getElementById("eventDialogDate")?.textContent || "";
    const rows = readEvents();
    const byTitle = rows.filter(row => String(row.title || "").trim() === title);
    if (byTitle.length <= 1) return byTitle[0] || null;
    return byTitle.find(row => dateText.includes(String(row.event_date || ""))) || byTitle[0] || null;
  }

  function iconFor(type) {
    return ({ instagram:"◎", telegram:"✈", tiktok:"♪", vk:"VK", website:"↗" })[type] || "↗";
  }
  function labelFor(type) {
    return ({ instagram:"Instagram", telegram:"Telegram", tiktok:"TikTok", vk:"VK", website:"Сайт" })[type] || "Ссылка";
  }

  function ensureDialog() {
    if (document.getElementById("eventPerformerDialog")) return;
    document.body.insertAdjacentHTML("beforeend", `
      <dialog class="performer-dialog" id="eventPerformerDialog">
        <div class="performer-sheet">
          <button class="performer-close" type="button" data-close-performer>×</button>
          <div class="performer-photo" id="eventPerformerPhoto"></div>
          <div class="performer-info">
            <span class="eyebrow" id="eventPerformerRole">АРТИСТ BALI</span>
            <h2 id="eventPerformerName">Артист BALI</h2>
            <p id="eventPerformerBio"></p>
          </div>
        </div>
      </dialog>`);
  }

  function styles() {
    if (document.getElementById("eventPerformerCardsStyle")) return;
    const style = document.createElement("style");
    style.id = "eventPerformerCardsStyle";
    style.textContent = `
      .fast-lineup{display:flex;gap:7px;flex-wrap:wrap;margin:10px 0}
      .fast-performer-chip{display:inline-flex;align-items:center;gap:7px;min-height:38px;padding:7px 10px;border:1px solid rgba(255,255,255,.12);border-radius:999px;background:#ffffff08;color:#e4e9e5;text-align:left}
      .fast-performer-chip.has-links{border-color:#7dff5c;background:rgba(125,255,92,.12);box-shadow:0 0 0 1px rgba(125,255,92,.08) inset;color:#efffeb}
      .fast-performer-chip i{font-style:normal;font-size:14px}.fast-performer-chip span{display:grid;gap:1px}.fast-performer-chip small{font-size:7px;color:var(--muted);letter-spacing:.08em}.fast-performer-chip b{font-size:9px}
      .performer-dialog{width:min(500px,calc(100% - 16px));max-height:92dvh;padding:0;border:1px solid var(--line);border-radius:24px;background:#0c0f0e;color:#fff;overflow:hidden}
      .performer-dialog::backdrop{background:#000d;backdrop-filter:blur(6px)}
      .performer-sheet{position:relative;max-height:92dvh;overflow:auto}
      .performer-close{position:absolute;right:12px;top:12px;z-index:5;width:42px;height:42px;border:1px solid rgba(255,255,255,.18);border-radius:50%;background:#080a0acc;color:#fff;font-size:24px}
      .performer-photo{position:relative;min-height:360px;display:grid;place-items:center;overflow:hidden;background:radial-gradient(circle at 75% 20%,rgba(200,255,61,.22),transparent 32%),linear-gradient(145deg,#1d2520,#080a0a);color:var(--lime);font:700 64px Unbounded}
      .performer-photo>img{width:100%;height:100%;min-height:360px;max-height:68dvh;object-fit:cover;display:block}
      .performer-socials{position:absolute;left:14px;right:14px;bottom:14px;display:flex;gap:9px;flex-wrap:wrap;padding:10px;border:1px solid rgba(255,255,255,.14);border-radius:18px;background:rgba(8,10,10,.8);backdrop-filter:blur(10px)}
      .performer-socials a{display:inline-flex;align-items:center;gap:7px;min-height:42px;padding:0 12px;border-radius:13px;text-decoration:none;font-size:9px;font-weight:900}
      .performer-socials a[data-social-type="instagram"]{background:linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045);color:#fff}
      .performer-socials a[data-social-type="telegram"]{background:#229ed9;color:#fff}
      .performer-socials a[data-social-type="tiktok"]{background:#050505;color:#fff;border:1px solid #35f4ee}
      .performer-socials a[data-social-type="vk"]{background:#2787f5;color:#fff}.performer-socials a[data-social-type="website"]{background:var(--lime);color:#080a0a}
      .performer-socials i{font-style:normal;font-size:16px}
      .performer-info{display:grid;gap:8px;padding:18px}.performer-info h2{font-size:26px}.performer-info p{color:var(--muted);font-size:10px;line-height:1.6}.performer-info p:empty{display:none}
    `;
    document.head.appendChild(style);
  }

  function decorate() {
    const event = currentEvent();
    const lineup = document.querySelector("#eventPrivilege .fast-lineup");
    if (!event || !lineup) return false;
    const rows = performersFor(event);
    lineup.innerHTML = rows.map((row, index) => `
      <button type="button" class="fast-performer-chip ${row.socials.length ? "has-links" : ""}" data-open-event-performer="${index}">
        <i>${row.socials.length ? "●" : "○"}</i><span><small>${esc(row.role)}</small><b>${esc(row.name)}</b></span>
      </button>`).join("");
    lineup.dataset.performerEventId = String(event.id || "");
    return true;
  }

  function openPerformer(index) {
    const event = currentEvent();
    const row = performersFor(event || {})[Number(index)];
    if (!row) return;
    ensureDialog();
    const photo = document.getElementById("eventPerformerPhoto");
    const links = row.socials.map(item => `<a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer" data-performer-social data-social-type="${esc(item.type)}"><i>${iconFor(item.type)}</i><span>${esc(item.label || labelFor(item.type))}</span></a>`).join("");
    photo.innerHTML = `${row.photo_url ? `<img src="${esc(row.photo_url)}" alt="${esc(row.name)}">` : `<span>${esc(initials(row.name))}</span>`}${links ? `<div class="performer-socials">${links}</div>` : ""}`;
    document.getElementById("eventPerformerRole").textContent = row.role || "АРТИСТ BALI";
    document.getElementById("eventPerformerName").textContent = row.name;
    document.getElementById("eventPerformerBio").textContent = row.bio || "";
    const dialog = document.getElementById("eventPerformerDialog");
    if (dialog && !dialog.open) dialog.showModal();
  }

  document.addEventListener("click", event => {
    const button = event.target.closest("[data-open-event-performer]");
    if (button) {
      event.preventDefault();
      event.stopPropagation();
      openPerformer(button.dataset.openEventPerformer);
      return;
    }
    if (event.target.closest("[data-close-performer]")) {
      document.getElementById("eventPerformerDialog")?.close();
      return;
    }
    const social = event.target.closest("[data-performer-social]");
    if (social && window.Telegram?.WebApp) {
      event.preventDefault();
      if (social.dataset.socialType === "telegram" && window.Telegram.WebApp.openTelegramLink) window.Telegram.WebApp.openTelegramLink(social.href);
      else window.Telegram.WebApp.openLink?.(social.href);
    }
  }, true);

  ensureDialog();
  styles();
  const root = document.getElementById("eventPrivilege");
  if (root) new MutationObserver(() => requestAnimationFrame(decorate)).observe(root, { childList:true, subtree:true });
  ["bali:full-demo-ready", "bali:full-demo-enhancements-ready", "bali:data-changed"].forEach(name => window.addEventListener(name, () => setTimeout(decorate, 0)));
  window.BaliEventPerformerCards = { decorate, openPerformer, performersFor };
})();