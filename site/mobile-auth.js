(() => {
  "use strict";
  if (window.BaliMobileAuth) return;

  const gate = document.getElementById("productionGate");
  const app = document.getElementById("app");
  const card = gate?.querySelector(".production-gate__card");
  const transport = window.BaliApi;
  let temporaryPassword = "";
  let resolveReady;
  let rejectReady;
  let readyPromise;

  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;"
  })[char]);

  async function api(path, options = {}) {
    const response = await (transport?.request ? transport.request(path, {
      ...options,
      headers: { "Content-Type":"application/json", ...(options.headers || {}) }
    }) : fetch(path, {
      credentials: "include",
      ...options,
      headers: { "Content-Type":"application/json", ...(options.headers || {}) }
    }));
    if (response.status === 204) return null;
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload?.error?.message || "Не удалось выполнить запрос");
      error.status = response.status;
      error.code = payload?.error?.code;
      throw error;
    }
    return payload;
  }

  function openGate() {
    if (gate) gate.hidden = false;
    if (app) app.hidden = true;
  }
  function closeGate() {
    if (gate) gate.hidden = true;
    if (app) app.hidden = false;
  }
  function setCard(html) {
    if (!card) return;
    card.innerHTML = `<span class="production-gate__mark">B</span>${html}`;
    openGate();
  }
  function errorNode() { return document.getElementById("mobileAuthError"); }
  function showError(error) {
    const node = errorNode();
    if (node) node.textContent = error?.message || "Ошибка. Повторите попытку.";
  }
  function busy(form, value) {
    form?.querySelectorAll("button,input").forEach(node => { node.disabled = value; });
  }

  function fieldValue(form, name) {
    const field = form?.elements?.namedItem?.(name);
    const value = field && typeof field.value !== "undefined" ? field.value : "";
    return String(value ?? "").normalize("NFKC").trim();
}

function passwordFieldValue(form, name) {
  const field = form?.elements?.namedItem?.(name);
  const value = field && typeof field.value !== "undefined" ? field.value : "";
  return String(value ?? "");
}

function normalizePhoneInput(value) {
    const raw = String(value ?? "").normalize("NFKC").trim();
    const digits = raw.replace(/\D/g, "");
    if (digits.length < 9 || digits.length > 15) {
      throw new Error("Введите корректный номер телефона");
    }
    return `+${digits}`;
  }

  function loginPayload(form) {
    return {
      phone: normalizePhoneInput(fieldValue(form, "phone")),
      password: fieldValue(form, "password")
    };
  }

  function registrationPayload(form) {
    return {
      displayName: fieldValue(form, "displayName"),
      phone: normalizePhoneInput(fieldValue(form, "phone")),
      telegramUsername: fieldValue(form, "telegramUsername").replace(/\s+/g, "")
    };
  }

  function resetPayload(form) {
    return {
      phone: normalizePhoneInput(fieldValue(form, "phone")),
      telegramUsername: fieldValue(form, "telegramUsername").replace(/\s+/g, "")
    };
  }

  function renderLogin(message = "") {
    temporaryPassword = "";
    setCard(`
      <p class="mobile-auth-kicker">BALI MOBILE</p>
      <h1>Вход в приложение</h1>
      <p class="mobile-auth-copy">Введите номер телефона и пароль. SMS не используется.</p>
      <form class="mobile-auth-form" id="mobileLoginForm">
        <label>Номер телефона<input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+375 29 000-00-00" required></label>
        <label>Пароль<input name="password" type="password" autocomplete="current-password" placeholder="Ваш пароль" required></label>
        <button class="mobile-auth-button" type="submit">Войти</button>
      </form>
      <div class="mobile-auth-error" id="mobileAuthError">${esc(message)}</div>
      <div class="mobile-auth-links"><button type="button" data-mobile-auth="register">Первая регистрация</button><button type="button" data-mobile-auth="reset">Забыли пароль?</button></div>
    `);
  }

  function renderRegister() {
    setCard(`
      <p class="mobile-auth-kicker">ПЕРВАЯ РЕГИСТРАЦИЯ</p>
      <h1>Запросить доступ</h1>
      <p class="mobile-auth-copy">Администратор увидит заявку и создаст временный пароль. Вы получите его от администратора в Telegram.</p>
      <form class="mobile-auth-form" id="mobileRegisterForm">
        <label>Имя и фамилия<input name="displayName" autocomplete="name" placeholder="Ваше имя" required></label>
        <label>Номер телефона<input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+375 29 000-00-00" required></label>
        <label>Telegram username<input name="telegramUsername" autocapitalize="none" autocomplete="off" placeholder="@username" required></label>
        <button class="mobile-auth-button" type="submit">Отправить заявку</button>
      </form>
      <div class="mobile-auth-note">Telegram используется только как канал, куда администратор вручную отправит временный пароль. Само приложение работает отдельно от Telegram.</div>
      <div class="mobile-auth-error" id="mobileAuthError"></div>
      <div class="mobile-auth-links"><button type="button" data-mobile-auth="login">Уже есть пароль</button></div>
    `);
  }

  function renderReset() {
    setCard(`
      <p class="mobile-auth-kicker">ВОССТАНОВЛЕНИЕ</p>
      <h1>Запросить новый пароль</h1>
      <p class="mobile-auth-copy">Администратор получит уведомление и создаст новый временный пароль.</p>
      <form class="mobile-auth-form" id="mobileResetForm">
        <label>Номер телефона<input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+375 29 000-00-00" required></label>
        <label>Telegram username<input name="telegramUsername" autocapitalize="none" autocomplete="off" placeholder="@username" required></label>
        <button class="mobile-auth-button" type="submit">Запросить восстановление</button>
      </form>
      <div class="mobile-auth-error" id="mobileAuthError"></div>
      <div class="mobile-auth-links"><button type="button" data-mobile-auth="login">Вернуться ко входу</button></div>
    `);
  }

  function renderWaiting(type) {
    const registration = type === "registration";
    setCard(`
      <p class="mobile-auth-kicker">ЗАЯВКА ОТПРАВЛЕНА</p>
      <h1>${registration ? "Ждём пароль" : "Запрос принят"}</h1>
      <div class="mobile-auth-wait">
        <span class="mobile-auth-status">У администратора</span>
        <strong>${registration ? "Администратор создаст временный пароль" : "Администратор сбросит пароль"}</strong>
        <p>После того как получите пароль в Telegram, вернитесь на экран входа и введите номер телефона вместе с этим паролем.</p>
      </div>
      <div class="mobile-auth-actions"><button class="mobile-auth-button" type="button" data-mobile-auth="login">Перейти ко входу</button></div>
    `);
  }

  function renderChangePassword() {
    const haveTemporary = Boolean(temporaryPassword);
    setCard(`
      <p class="mobile-auth-kicker">БЕЗОПАСНОСТЬ</p>
      <h1>Создайте свой пароль</h1>
      <p class="mobile-auth-copy">Временный пароль действует только для первого входа. Сейчас замените его на постоянный.</p>
      <form class="mobile-auth-form" id="mobileChangePasswordForm">
        ${haveTemporary ? "" : '<label>Текущий временный пароль<input name="currentPassword" type="password" autocomplete="current-password" required></label>'}
        <label>Новый пароль<input name="newPassword" type="password" autocomplete="new-password" minlength="12" maxlength="128" required></label>
        <label>Повторите новый пароль<input name="confirmPassword" type="password" autocomplete="new-password" minlength="12" maxlength="128" required></label>
        <div class="mobile-auth-password-hint">Минимум 12 символов. После смены остальные активные сессии будут завершены.</div>
        <button class="mobile-auth-button" type="submit">Сохранить пароль и открыть BALI</button>
      </form>
      <div class="mobile-auth-error" id="mobileAuthError"></div>
    `);
  }

  async function complete(session) {
    closeGate();
    resolveReady?.(session);
    return session;
  }

  async function checkSession() {
    try {
      const session = await api("/api/v1/auth/mobile/session");
      if (session.authMethod !== "mobile") {
        await api("/api/v1/auth/logout", { method:"POST", body:"{}" }).catch(() => null);
        transport?.clearToken?.();
        renderLogin();
        return;
      }
      if (session.mustChangePassword) {
        renderChangePassword();
        return;
      }
      await complete(session);
    } catch (error) {
      if (error.status === 401) {
        transport?.clearToken?.();
        renderLogin();
      } else {
        setCard(`<p class="mobile-auth-kicker">BALI MOBILE</p><h1>Нет соединения</h1><p class="mobile-auth-copy">${esc(error.message)}</p><div class="mobile-auth-actions"><button class="mobile-auth-button" type="button" data-mobile-auth="retry">Повторить</button></div>`);
      }
    }
  }

  document.addEventListener("click", event => {
    const action = event.target.closest("[data-mobile-auth]")?.dataset.mobileAuth;
    if (!action) return;
    if (action === "login") renderLogin();
    if (action === "register") renderRegister();
    if (action === "reset") renderReset();
    if (action === "retry") checkSession();
  });

  document.addEventListener("submit", async event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;

    if (form.id === "mobileLoginForm") {
      event.preventDefault(); busy(form, true); showError("");
      let data;
      try { data = loginPayload(form); } catch (error) { busy(form, false); showError(error); return; }
      try {
        const result = await api("/api/v1/auth/mobile/login", { method:"POST", body:JSON.stringify(data) });
        transport?.setToken?.(result.accessToken || "");
        temporaryPassword = String(data.password || "");
        if (result.mustChangePassword) renderChangePassword();
        else await complete(result);
      } catch (error) { busy(form, false); showError(error); }
      return;
    }

    if (form.id === "mobileRegisterForm") {
      event.preventDefault(); busy(form, true); showError("");
      let data;
      try { data = registrationPayload(form); } catch (error) { busy(form, false); showError(error); return; }
      try {
        await api("/api/v1/auth/mobile/register-request", { method:"POST", body:JSON.stringify(data) });
        renderWaiting("registration");
      } catch (error) { busy(form, false); showError(error); }
      return;
    }

    if (form.id === "mobileResetForm") {
      event.preventDefault(); busy(form, true); showError("");
      let data;
      try { data = resetPayload(form); } catch (error) { busy(form, false); showError(error); return; }
      try {
        await api("/api/v1/auth/mobile/reset-request", { method:"POST", body:JSON.stringify(data) });
        renderWaiting("reset");
      } catch (error) { busy(form, false); showError(error); }
      return;
    }

    if (form.id === "mobileChangePasswordForm") {
      event.preventDefault(); busy(form, true); showError("");
      const currentPassword = temporaryPassword || passwordFieldValue(form, "currentPassword");
      const newPassword = passwordFieldValue(form, "newPassword");
      const confirmPassword = passwordFieldValue(form, "confirmPassword");
      if (newPassword.length < 12 || newPassword.length > 128) {
        busy(form, false); showError(new Error("Пароль должен содержать от 12 до 128 символов")); return;
      }
      if (newPassword !== confirmPassword) {
        busy(form, false); showError(new Error("Пароли не совпадают")); return;
      }
      try {
        await api("/api/v1/auth/mobile/change-password", {
          method:"POST",
          body:JSON.stringify({ currentPassword, newPassword })
        });
        temporaryPassword = "";
        const session = await api("/api/v1/auth/mobile/session");
        await complete(session);
      } catch (error) { busy(form, false); showError(error); }
    }
  });

  window.BaliMobileAuth = {
    ensureAuthenticated() {
      if (!readyPromise) {
        readyPromise = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
        checkSession().catch(rejectReady);
      }
      return readyPromise;
    },
    showLogin: renderLogin,
    api
  };
})();
