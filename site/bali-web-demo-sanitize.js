(() => {
  if (window.__BALI_WEB_DEMO_SANITIZE__) return;
  window.__BALI_WEB_DEMO_SANITIZE__ = true;
  window.BALI_WEB_DEMO = true;

  const phone = window.BALI_CONFIG?.managerContactUrl || "tel:+375296700300";
  const blockedUrl = value => /^(?:tg:|https?:\/\/(?:t\.me|telegram\.me|telegram\.org)(?:\/|$))/i.test(String(value || "").trim());
  const forbiddenWord = /telegram|телеграм/i;

  try { delete window.Telegram; } catch { window.Telegram = undefined; }

  const originalOpen = window.open?.bind(window);
  if (originalOpen) {
    window.open = function webDemoOpen(url, ...args) {
      if (blockedUrl(url)) {
        location.href = phone;
        return null;
      }
      return originalOpen(url, ...args);
    };
  }

  function cleanRecord(value) {
    if (Array.isArray(value)) return value.map(cleanRecord);
    if (!value || typeof value !== "object") return value;
    const result = {};
    for (const [key, item] of Object.entries(value)) {
      if (/^telegram(?:_?id|_?username)?$/i.test(key)) continue;
      if (key === "username" && typeof item === "string") {
        result[key] = item.replace(/^@+/, "");
        continue;
      }
      result[key] = cleanRecord(item);
    }
    return result;
  }

  function cleanDemoMemory() {
    const users = window.BaliDemo?.users;
    if (!Array.isArray(users)) return;
    users.forEach((user, index) => {
      delete user.telegramId;
      delete user.telegram_id;
      delete user.telegram;
      delete user.telegramUsername;
      if (typeof user.username === "string") user.username = user.username.replace(/^@+/, "") || `guest-${index + 1}`;
    });
  }

  function cleanLocalData() {
    const keys = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key) keys.push(key);
    }
    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        localStorage.setItem(key, JSON.stringify(cleanRecord(parsed)));
      } catch {}
    }
  }

  function replaceContactLink(anchor) {
    if (!blockedUrl(anchor.getAttribute("href"))) return;
    anchor.setAttribute("href", phone);
    anchor.removeAttribute("target");
    anchor.removeAttribute("rel");
    const text = anchor.textContent.trim();
    if (forbiddenWord.test(text) || /менеджер|написать/i.test(text)) anchor.textContent = "Позвонить менеджеру";
  }

  function hideExternalField(element) {
    const field = element.matches?.("input,textarea,select") ? element : element.querySelector?.("input,textarea,select");
    const signature = [
      element.textContent,
      field?.name,
      field?.id,
      field?.placeholder,
      field?.getAttribute?.("aria-label")
    ].filter(Boolean).join(" ");
    if (!forbiddenWord.test(signature)) return;
    const wrapper = field?.closest("label,.field,.form-field,.editor-field") || element.closest?.("label,.field,.form-field,.editor-field") || element;
    if (wrapper?.style) wrapper.style.setProperty("display", "none", "important");
    if (field) {
      field.disabled = true;
      field.removeAttribute("required");
      field.value = "";
    }
  }

  function hideExternalColumns(root) {
    root.querySelectorAll?.("table").forEach(table => {
      const headers = [...table.querySelectorAll("thead th")];
      const indexes = headers.map((header, index) => forbiddenWord.test(header.textContent) ? index : -1).filter(index => index >= 0);
      for (const index of indexes) {
        table.querySelectorAll("tr").forEach(row => {
          const cell = row.children[index];
          if (cell?.style) cell.style.setProperty("display", "none", "important");
        });
      }
    });
  }

  function sanitize(root = document) {
    root.querySelectorAll?.("a[href]").forEach(replaceContactLink);
    root.querySelectorAll?.("label,.field,.form-field,.editor-field,input,textarea,select").forEach(hideExternalField);
    root.querySelectorAll?.("[data-telegram],[data-telegram-id]").forEach(node => node.remove());
    hideExternalColumns(root);

    root.querySelectorAll?.("button,a").forEach(node => {
      const text = node.textContent.trim();
      if (!forbiddenWord.test(text)) return;
      if (node.tagName === "A") {
        node.setAttribute("href", phone);
        node.textContent = "Позвонить менеджеру";
      } else {
        node.textContent = "Позвонить менеджеру";
        node.dataset.webDemoCall = "1";
      }
    });
  }

  document.addEventListener("click", event => {
    const link = event.target.closest?.("a[href]");
    if (link && blockedUrl(link.getAttribute("href"))) {
      event.preventDefault();
      location.href = phone;
      return;
    }
    const button = event.target.closest?.("[data-web-demo-call='1']");
    if (button) {
      event.preventDefault();
      location.href = phone;
    }
  }, true);

  cleanDemoMemory();
  cleanLocalData();
  sanitize(document);

  const observer = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) sanitize(node);
      }
    }
  });
  observer.observe(document.documentElement, { childList:true, subtree:true });

  window.addEventListener("bali:data-changed", () => {
    cleanDemoMemory();
    cleanLocalData();
  });
  window.addEventListener("bali:demo-user-changed", () => {
    cleanDemoMemory();
    cleanLocalData();
  });
})();
