(() => {
  "use strict";
  if (window.__BALI_ADMIN_MOBILE_ACCESS__) return;
  window.__BALI_ADMIN_MOBILE_ACCESS__ = true;

  const app = document.getElementById("adminApp");
  const content = document.getElementById("adminContent");
  const sidebar = document.getElementById("chatSidebar");
  const nav = document.querySelector(".admin-header nav");
  const toastNode = document.getElementById("adminToast");
  let activeStatus = "pending";
  let lastPending = -1;
  let active = false;

  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;"
  })[char]);
  const fmt = value => value ? new Date(value).toLocaleString("ru-RU") : "—";

  async function api(path, options = {}) {
    const response = await fetch(path, {
      credentials:"same-origin",
      ...options,
      headers:{ "Content-Type":"application/json", ...(options.headers || {}) }
    });
    const payload = response.status === 204 ? null : await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error?.message || "Ошибка запроса");
    return payload;
  }
  function toast(message) {
    if (!toastNode) return;
    toastNode.textContent = message;
    toastNode.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => toastNode.classList.remove("show"), 2600);
  }

  function ensureNavButton() {
    if (!nav || nav.querySelector("[data-mobile-access-view]")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mobile-access-nav";
    button.dataset.mobileAccessView = "1";
    button.innerHTML = 'Доступ <span class="mobile-access-badge" id="mobileAccessBadge" hidden>0</span>';
    const crm = nav.querySelector('[data-admin-view="crm"]');
    crm?.after(button);
  }

  function setBadge(count) {
    ensureNavButton();
    const badge = document.getElementById("mobileAccessBadge");
    if (!badge) return;
    badge.textContent = String(count || 0);
    badge.hidden = !count;
  }

  function passwordOverlay(result) {
    let overlay = document.getElementById("mobilePasswordOverlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "mobilePasswordOverlay";
      overlay.className = "mobile-password-overlay";
      document.body.appendChild(overlay);
    }
    overlay.hidden = false;
    overlay.innerHTML = `<div class="mobile-password-card">
      <span class="mobile-access-type">${result.requestType === "registration" ? "Новая регистрация" : "Сброс пароля"}</span>
      <h2>Временный пароль создан</h2>
      <p>${esc(result.phone)} · @${esc(result.telegramUsername)}</p>
      <code class="mobile-password-value" id="mobileTemporaryPassword">${esc(result.temporaryPassword)}</code>
      <p class="warning">Пароль показывается только сейчас. Скопируйте его и отправьте пользователю в Telegram.</p>
      <div class="mobile-password-buttons">
        <button class="primary" type="button" data-copy-mobile-password>Скопировать пароль</button>
        <a href="${esc(result.telegramUrl)}" target="_blank" rel="noopener">Открыть Telegram</a>
        <button type="button" data-close-mobile-password>Закрыть</button>
      </div>
    </div>`;
  }

  function requestRow(row) {
    const registration = row.request_type === "registration";
    return `<article class="mobile-access-row">
      <div>
        <span class="mobile-access-type">${registration ? "Регистрация" : "Восстановление"}</span>
        <h3>${esc(row.display_name || row.user_name || "Пользователь BALI")}</h3>
        <p><b>${esc(row.phone)}</b> · @${esc(row.telegram_username)}</p>
        <small>${fmt(row.requested_at)}${row.last_login_at ? ` · последний вход ${fmt(row.last_login_at)}` : ""}</small>
      </div>
      <div class="mobile-access-actions">
        <a href="https://t.me/${encodeURIComponent(String(row.telegram_username || "").replace(/^@/, ""))}" target="_blank" rel="noopener">Telegram</a>
        ${row.status === "pending" ? `<button class="issue" type="button" data-issue-mobile-access="${esc(row.id)}">Выдать временный пароль</button><button class="reject" type="button" data-reject-mobile-access="${esc(row.id)}">Отклонить</button>` : `<span>${esc(row.status)}</span>`}
      </div>
    </article>`;
  }

  async function render(status = activeStatus) {
    activeStatus = status;
    active = true;
    document.querySelectorAll("[data-admin-view]").forEach(button => button.classList.remove("active"));
    document.querySelector("[data-mobile-access-view]")?.classList.add("active");
    if (sidebar) sidebar.hidden = true;
    if (content) content.innerHTML = '<div class="admin-empty">Загружаем заявки…</div>';
    const payload = await api(`/api/v1/admin/mobile-access?status=${encodeURIComponent(status)}`);
    const counts = payload.counts || {};
    setBadge(Number(counts.pending || 0));
    if (content) content.innerHTML = `
      <header class="content-head"><div><p class="eyebrow">МОБИЛЬНОЕ ПРИЛОЖЕНИЕ</p><h1>Регистрация и доступ</h1><p>Телефон + временный пароль от администратора. SMS не используется.</p></div></header>
      <div class="mobile-access-summary"><article><small>Ожидают</small><strong>${Number(counts.pending || 0)}</strong></article><article><small>Пароль выдан</small><strong>${Number(counts.issued || 0)}</strong></article><article><small>Завершено</small><strong>${Number(counts.completed || 0)}</strong></article></div>
      <div class="mobile-access-toolbar">
        ${[["pending","Ожидают"],["issued","Пароль выдан"],["completed","Завершено"],["rejected","Отклонено"]].map(([id,label]) => `<button type="button" class="${status === id ? "active" : ""}" data-mobile-access-status="${id}">${label}</button>`).join("")}
      </div>
      <div class="mobile-access-list">${(payload.requests || []).map(requestRow).join("") || '<div class="mobile-access-empty">В этой категории заявок нет.</div>'}</div>`;
  }

  async function poll() {
    ensureNavButton();
    if (!app || app.hidden) return;
    try {
      const payload = await api("/api/v1/admin/mobile-access?status=pending");
      const count = Number(payload.counts?.pending || 0);
      setBadge(count);
      if (lastPending >= 0 && count > lastPending) toast(`Новая заявка на доступ: +${count - lastPending}`);
      lastPending = count;
      if (active && activeStatus === "pending") await render("pending");
    } catch {
      // Admin may still be logging in or session may have expired.
    }
  }

  document.addEventListener("click", async event => {
    if (event.target.closest("[data-admin-view]")) active = false;
    if (event.target.closest("[data-mobile-access-view]")) {
      event.preventDefault();
      event.stopPropagation();
      await render("pending").catch(error => toast(error.message));
      return;
    }
    const status = event.target.closest("[data-mobile-access-status]");
    if (status) return render(status.dataset.mobileAccessStatus).catch(error => toast(error.message));
    const issue = event.target.closest("[data-issue-mobile-access]");
    if (issue) {
      issue.disabled = true;
      try {
        const result = await api(`/api/v1/admin/mobile-access/${encodeURIComponent(issue.dataset.issueMobileAccess)}/issue`, { method:"POST", body:"{}" });
        passwordOverlay(result);
        await render(activeStatus);
      } catch (error) { issue.disabled = false; toast(error.message); }
      return;
    }
    const reject = event.target.closest("[data-reject-mobile-access]");
    if (reject) {
      const note = prompt("Причина отклонения", "Отклонено администратором");
      if (note === null) return;
      try {
        await api(`/api/v1/admin/mobile-access/${encodeURIComponent(reject.dataset.rejectMobileAccess)}/reject`, { method:"POST", body:JSON.stringify({ note }) });
        toast("Заявка отклонена");
        await render(activeStatus);
      } catch (error) { toast(error.message); }
      return;
    }
    if (event.target.closest("[data-copy-mobile-password]")) {
      const value = document.getElementById("mobileTemporaryPassword")?.textContent || "";
      await navigator.clipboard?.writeText?.(value);
      toast("Пароль скопирован");
      return;
    }
    if (event.target.closest("[data-close-mobile-password]")) {
      document.getElementById("mobilePasswordOverlay")?.setAttribute("hidden", "");
    }
  }, true);

  ensureNavButton();
  setInterval(poll, 15000);
  setTimeout(poll, 1200);
})();
