(() => {
  if (window.__BALI_ADMIN_USER_SEARCH__) return;
  window.__BALI_ADMIN_USER_SEARCH__ = true;

  const normalize = value => String(value || "").toLocaleLowerCase("ru").replace(/\s+/g, " ").trim();

  function styles() {
    if (document.getElementById("adminUserSearchStyle")) return;
    const style = document.createElement("style");
    style.id = "adminUserSearchStyle";
    style.textContent = `.admin-user-search{display:grid;gap:6px;margin:0 0 10px}.admin-user-search span{color:var(--muted);font-size:9px;font-weight:800}.admin-user-search input{width:100%;min-height:46px;padding:0 13px;border:1px solid var(--line);border-radius:13px;background:rgba(255,255,255,.045);color:var(--text)}.admin-user-search small{color:var(--muted);font-size:8px}`;
    document.head.appendChild(style);
  }

  function enhance(select) {
    if (!select || select.dataset.userSearchReady === "1") return;
    select.dataset.userSearchReady = "1";
    const wrapper = document.createElement("label");
    wrapper.className = "admin-user-search";
    wrapper.innerHTML = `<span>Поиск гостя</span><input type="search" autocomplete="off" placeholder="Имя, @username, телефон или код"><small>Введите несколько символов — список ниже отфильтруется.</small>`;
    const host = select.closest("label") || select;
    host.parentNode?.insertBefore(wrapper, host);
    const input = wrapper.querySelector("input");
    input.addEventListener("input", () => {
      const query = normalize(input.value);
      let firstVisible = null;
      [...select.options].forEach(option => {
        const visible = !query || normalize(`${option.textContent} ${option.value}`).includes(query);
        option.hidden = !visible;
        option.disabled = !visible;
        if (visible && !firstVisible) firstVisible = option;
      });
      if (select.selectedOptions[0]?.hidden && firstVisible) {
        firstVisible.selected = true;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
  }

  function scan(root = document) {
    root.querySelectorAll?.('select[name="userKey"]').forEach(enhance);
  }

  styles();
  scan();
  new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
    if (node.nodeType !== 1) return;
    if (node.matches?.('select[name="userKey"]')) enhance(node);
    scan(node);
  }))).observe(document.body, { childList: true, subtree: true });
})();