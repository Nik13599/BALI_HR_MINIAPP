(() => {
  "use strict";
  if (window.__BALI_BETA4_MOBILE_ACCESS__) return;
  window.__BALI_BETA4_MOBILE_ACCESS__ = true;

  const state = {
    status: "pending",
    counts: { pending: 0, issued: 0, completed: 0 },
    context: null,
    lastPending: -1,
    polling: false
  };

  const esc = (value = "") => String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
  const fmt = value => value ? new Date(value).toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
  }) : "—";
  const username = value => String(value || "").replace(/^@+/, "");

  async function api(path, options = {}) {
    if (!window.BaliAdminApi?.request) throw new Error("Production API админки не подключён");
    const response = await window.BaliAdminApi.request(path, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) }
    });
    const payload = response.status === 204 ? null : await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error?.message || payload?.message || "Ошибка запроса");
    return payload;
  }

  function toast(message) {
    if (state.context?.toast) return state.context.toast(message);
    const node = document.getElementById("toast");
    if (!node) return;
    node.textContent = message;
    node.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove("show"), 2600);
  }

  function installStyles() {
    if (document.getElementById("beta4MobileAccessStyle")) return;
    const style = document.createElement("style");
    style.id = "beta4MobileAccessStyle";
    style.textContent = `
      .beta4-access-nav{position:relative}.beta4-access-badge{min-width:19px;height:19px;padding:0 5px;margin-left:auto;display:inline-flex;align-items:center;justify-content:center;border-radius:999px;background:#ff5454;color:#fff;font:900 9px/1 system-ui}.beta4-access-badge[hidden]{display:none!important}
      .beta4-access-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:14px}.beta4-access-head h3{margin:3px 0 6px;font-size:22px}.beta4-access-head p{margin:0;color:var(--muted);font-size:11px;line-height:1.55}.beta4-access-channel{display:flex;align-items:center;gap:8px;padding:9px 12px;border:1px solid #c8ff3d55;border-radius:999px;color:var(--lime);font-size:10px;white-space:nowrap}
      .beta4-access-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:12px}.beta4-access-stat{padding:15px;border:1px solid var(--line);border-radius:15px;background:var(--panel)}.beta4-access-stat small{display:block;color:var(--muted);font-size:9px;text-transform:uppercase}.beta4-access-stat strong{display:block;margin-top:5px;color:var(--lime);font-size:28px}
      .beta4-access-toolbar{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:12px}.beta4-access-toolbar button{min-height:38px;padding:0 12px;border:1px solid var(--line);border-radius:10px;background:#ffffff06;color:var(--muted);font-size:10px}.beta4-access-toolbar button.active{border-color:var(--lime);background:var(--lime);color:#080a08;font-weight:900}
      .beta4-access-list{display:grid;gap:9px}.beta4-access-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;align-items:center;padding:14px 15px;border:1px solid var(--line);border-radius:15px;background:var(--panel)}.beta4-access-row h4{margin:5px 0 4px;font-size:14px}.beta4-access-row p{margin:0;color:#fff;font-size:11px}.beta4-access-row small{display:block;margin-top:5px;color:var(--muted);font-size:9px}.beta4-access-type{display:inline-flex;padding:5px 8px;border:1px solid #c8ff3d44;border-radius:999px;color:var(--lime);font-size:8px;font-weight:800;text-transform:uppercase}.beta4-access-type.reset{border-color:#f3ca5a66;color:#f3ca5a}.beta4-access-actions{display:flex;gap:7px;align-items:center;justify-content:flex-end;flex-wrap:wrap}.beta4-access-actions button,.beta4-access-actions a{min-height:38px;padding:0 11px;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--line);border-radius:10px;background:#ffffff08;color:#fff;text-decoration:none;font-size:9px;font-weight:800}.beta4-access-actions .approve{border:0;background:var(--lime);color:#080a08}.beta4-access-actions .reject{border-color:#ff666655;color:#ff9292}.beta4-access-empty{padding:35px;border:1px dashed var(--line);border-radius:15px;color:var(--muted);text-align:center;font-size:11px}
      .beta4-access-overlay{position:fixed;inset:0;z-index:2147483200;display:grid;place-items:center;padding:20px;background:#000b}.beta4-access-overlay[hidden]{display:none!important}.beta4-access-secret{width:min(610px,100%);max-height:92vh;overflow:auto;padding:22px;border:1px solid #c8ff3d66;border-radius:22px;background:#0b0e0c;box-shadow:0 35px 100px #000}.beta4-access-secret h2{margin:7px 0 5px}.beta4-access-secret .recipient{margin:0 0 15px;color:var(--muted)}.beta4-access-password{display:block;padding:15px;border:1px solid #c8ff3d55;border-radius:13px;background:#050706;color:var(--lime);font:900 20px/1.3 ui-monospace,SFMono-Regular,Consolas,monospace;word-break:break-all}.beta4-access-message{margin-top:12px;padding:13px;border:1px solid var(--line);border-radius:13px;background:#ffffff05;white-space:pre-wrap;color:#d9ddd9;font-size:11px;line-height:1.55}.beta4-access-warning{margin:12px 0;color:#f3ca5a;font-size:10px;line-height:1.5}.beta4-access-secret-actions{display:flex;gap:8px;flex-wrap:wrap}.beta4-access-secret-actions button{min-height:42px;padding:0 13px;border:1px solid var(--line);border-radius:11px;background:#ffffff08;color:#fff;font-weight:800}.beta4-access-secret-actions .primary-send{border:0;background:var(--lime);color:#080a08}
      @media(max-width:760px){.beta4-access-head{display:grid}.beta4-access-channel{justify-self:start}.beta4-access-stats{grid-template-columns:1fr}.beta4-access-row{grid-template-columns:1fr}.beta4-access-actions{justify-content:flex-start}}
    `;
    document.head.appendChild(style);
  }

  function ensureNav() {
    const nav = document.getElementById("adminNav");
    if (!nav || nav.querySelector('[data-view="access"]')) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "beta4-access-nav";
    button.dataset.view = "access";
    button.innerHTML = '⊕ <span>Новые пользователи</span><b class="beta4-access-badge" id="beta4AccessBadge" hidden>0</b>';
    const customers = nav.querySelector('[data-view="customers"]');
    if (customers) customers.after(button); else nav.appendChild(button);
  }

  function setBadge(value) {
    ensureNav();
    const badge = document.getElementById("beta4AccessBadge");
    if (!badge) return;
    const count = Math.max(0, Number(value || 0));
    badge.textContent = String(count);
    badge.hidden = count === 0;
  }

  function rowHtml(row) {
    const registration = row.request_type === "registration";
    const tg = username(row.telegram_username);
    const title = row.display_name || row.user_name || "Пользователь BALI";
    const statusLine = row.status === "issued"
      ? `Временный пароль выдан ${fmt(row.issued_at)}${row.last_login_at ? ` · последний вход ${fmt(row.last_login_at)}` : ""}`
      : row.status === "completed"
        ? `Доступ активирован ${fmt(row.completed_at)}${row.last_login_at ? ` · последний вход ${fmt(row.last_login_at)}` : ""}`
        : row.status === "rejected"
          ? `Отклонено${row.note ? ` · ${esc(row.note)}` : ""}`
          : `Заявка ${fmt(row.requested_at)}`;
    return `<article class="beta4-access-row">
      <div>
        <span class="beta4-access-type ${registration ? "" : "reset"}">${registration ? "Новая регистрация" : "Восстановление пароля"}</span>
        <h4>${esc(title)}</h4>
        <p>${esc(row.phone)}${tg ? ` · @${esc(tg)}` : ""}</p>
        <small>${statusLine}</small>
      </div>
      <div class="beta4-access-actions">
        ${tg ? `<a href="https://t.me/${encodeURIComponent(tg)}" target="_blank" rel="noopener">Telegram ↗</a>` : ""}
        ${row.status === "pending" ? `<button class="approve" type="button" data-beta4-access-issue="${esc(row.id)}">Подтвердить и выдать пароль</button><button class="reject" type="button" data-beta4-access-reject="${esc(row.id)}">Отклонить</button>` : ""}
      </div>
    </article>`;
  }

  async function render(root, context) {
    state.context = context;
    root.innerHTML = '<div class="empty">Загружаем заявки на доступ…</div>';
    const payload = await api(`/api/v1/admin/mobile-access?status=${encodeURIComponent(state.status)}`);
    state.counts = payload.counts || state.counts;
    setBadge(state.counts.pending);
    root.innerHTML = `
      <div class="beta4-access-head">
        <div><span class="eyebrow">ДОСТУП В МОБИЛЬНОЕ ПРИЛОЖЕНИЕ</span><h3>Новые пользователи</h3><p>Здесь появляются заявки из приложения. После подтверждения создаётся учётная запись BALI и одноразовый временный пароль. Пользователь обязан заменить его после первого входа.</p></div>
        <div class="beta4-access-channel">✈ Канал выдачи: Telegram</div>
      </div>
      <div class="beta4-access-stats">
        <article class="beta4-access-stat"><small>Ожидают решения</small><strong>${Number(state.counts.pending || 0)}</strong></article>
        <article class="beta4-access-stat"><small>Пароль выдан</small><strong>${Number(state.counts.issued || 0)}</strong></article>
        <article class="beta4-access-stat"><small>Доступ активирован</small><strong>${Number(state.counts.completed || 0)}</strong></article>
      </div>
      <div class="beta4-access-toolbar">
        ${[["pending","Ожидают"],["issued","Пароль выдан"],["completed","Активированы"],["rejected","Отклонены"]].map(([id,label]) => `<button type="button" class="${state.status === id ? "active" : ""}" data-beta4-access-status="${id}">${label}</button>`).join("")}
      </div>
      <div class="beta4-access-list">${(payload.requests || []).map(rowHtml).join("") || '<div class="beta4-access-empty">В этой категории заявок пока нет.</div>'}</div>`;
  }

  function readyMessage(result, title) {
    const reset = result.requestType === "reset";
    return [
      `Здравствуйте${title ? `, ${title}` : ""}!`,
      "",
      reset ? "Для вашего аккаунта BALI создан новый временный пароль." : "Ваша заявка на доступ в приложение BALI подтверждена.",
      `Логин: ${result.phone}`,
      `Временный пароль: ${result.temporaryPassword}`,
      "",
      "После входа приложение попросит установить новый личный пароль. Временный пароль после этого больше не действует."
    ].join("\n");
  }

  function showSecret(result, row) {
    let overlay = document.getElementById("beta4AccessOverlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "beta4AccessOverlay";
      overlay.className = "beta4-access-overlay";
      document.body.appendChild(overlay);
    }
    const title = row?.display_name || row?.user_name || "";
    const message = readyMessage(result, title);
    const tg = username(result.telegramUsername);
    overlay.hidden = false;
    overlay.dataset.message = message;
    overlay.dataset.password = result.temporaryPassword || "";
    overlay.dataset.telegram = tg;
    overlay.innerHTML = `<div class="beta4-access-secret">
      <span class="beta4-access-type ${result.requestType === "reset" ? "reset" : ""}">${result.requestType === "reset" ? "Восстановление" : "Новый пользователь"}</span>
      <h2>Временный пароль создан</h2>
      <p class="recipient">${esc(result.phone)}${tg ? ` · @${esc(tg)}` : ""}</p>
      <code class="beta4-access-password">${esc(result.temporaryPassword)}</code>
      <div class="beta4-access-message">${esc(message)}</div>
      <p class="beta4-access-warning">⚠️ Пароль возвращается сервером только в момент выдачи. Не закрывайте это окно, пока не отправили данные пользователю.</p>
      <div class="beta4-access-secret-actions">
        ${tg ? '<button class="primary-send" type="button" data-beta4-access-telegram>Скопировать сообщение и открыть Telegram</button>' : ""}
        <button type="button" data-beta4-access-copy-message>Скопировать сообщение</button>
        <button type="button" data-beta4-access-copy-password>Скопировать пароль</button>
        <button type="button" data-beta4-access-close>Закрыть</button>
      </div>
    </div>`;
  }

  async function rerender() {
    if (!state.context || state.context.state?.view !== "access") return;
    const root = document.getElementById("content");
    if (root) await render(root, state.context);
  }

  async function poll() {
    if (state.polling || !window.BALI_BETA4_PRODUCTION || !window.BaliAdminApi?.token?.()) return;
    state.polling = true;
    try {
      const payload = await api("/api/v1/admin/mobile-access?status=pending");
      const count = Number(payload.counts?.pending || 0);
      setBadge(count);
      if (state.lastPending >= 0 && count > state.lastPending) toast(`Новая заявка на доступ: +${count - state.lastPending}`);
      state.lastPending = count;
      if (state.context?.state?.view === "access" && state.status === "pending") await rerender();
    } catch (_) {
      // Login may still be in progress.
    } finally {
      state.polling = false;
    }
  }

  document.addEventListener("click", async event => {
    const status = event.target.closest("[data-beta4-access-status]");
    if (status) {
      state.status = status.dataset.beta4AccessStatus;
      return rerender().catch(error => toast(error.message));
    }

    const issue = event.target.closest("[data-beta4-access-issue]");
    if (issue) {
      issue.disabled = true;
      const id = issue.dataset.beta4AccessIssue;
      try {
        const pending = await api("/api/v1/admin/mobile-access?status=pending");
        const row = (pending.requests || []).find(item => String(item.id) === String(id));
        const result = await api(`/api/v1/admin/mobile-access/${encodeURIComponent(id)}/issue`, { method: "POST", body: "{}" });
        showSecret(result, row);
        await rerender();
      } catch (error) {
        issue.disabled = false;
        toast(error.message);
      }
      return;
    }

    const reject = event.target.closest("[data-beta4-access-reject]");
    if (reject) {
      const note = prompt("Причина отклонения", "Отклонено администратором");
      if (note === null) return;
      reject.disabled = true;
      try {
        await api(`/api/v1/admin/mobile-access/${encodeURIComponent(reject.dataset.beta4AccessReject)}/reject`, {
          method: "POST",
          body: JSON.stringify({ note })
        });
        toast("Заявка отклонена");
        await rerender();
      } catch (error) {
        reject.disabled = false;
        toast(error.message);
      }
      return;
    }

    const overlay = document.getElementById("beta4AccessOverlay");
    if (!overlay || overlay.hidden) return;
    if (event.target.closest("[data-beta4-access-copy-message]")) {
      await navigator.clipboard?.writeText?.(overlay.dataset.message || "");
      toast("Сообщение скопировано");
      return;
    }
    if (event.target.closest("[data-beta4-access-copy-password]")) {
      await navigator.clipboard?.writeText?.(overlay.dataset.password || "");
      toast("Пароль скопирован");
      return;
    }
    if (event.target.closest("[data-beta4-access-telegram]")) {
      await navigator.clipboard?.writeText?.(overlay.dataset.message || "");
      const tg = overlay.dataset.telegram || "";
      if (tg) window.open(`https://t.me/${encodeURIComponent(tg)}`, "_blank", "noopener");
      toast("Сообщение скопировано — вставьте его в открывшийся чат Telegram");
      return;
    }
    if (event.target.closest("[data-beta4-access-close]")) {
      overlay.hidden = true;
      overlay.innerHTML = "";
    }
  }, true);

  installStyles();
  ensureNav();
  window.BaliAdminViews = window.BaliAdminViews || {};
  window.BaliAdminViews.access = {
    title: "Новые пользователи",
    primaryAction: false,
    render
  };
  setInterval(poll, 15000);
  setTimeout(poll, 1500);
})();
