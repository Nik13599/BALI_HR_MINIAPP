(() => {
  if (window.__BALI_ADMIN_LOYALTY_ISSUANCE_PRODUCTION__) return;
  window.__BALI_ADMIN_LOYALTY_ISSUANCE_PRODUCTION__ = true;

  const store = window.BaliStore;
  const esc = (value = "") => String(value).replace(/[&<>'"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));
  let mounting = false;

  async function loadUsers() {
    const rows = await store.list("app_users").catch(() => []);
    return rows
      .filter(row => row.user_key)
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ru"));
  }

  async function mount() {
    if (mounting || typeof state === "undefined" || state.view !== "bonuses") return;
    const root = document.getElementById("content");
    if (!root || document.getElementById("loyaltyIssuancePanel")) return;
    mounting = true;
    try {
      const [users, rewards, gifts] = await Promise.all([
        loadUsers(),
        store.list("loyalty_rewards").catch(() => []),
        store.list("loyalty_gifts").catch(() => [])
      ]);
      const activeRewards = rewards.filter(row => row.active !== false);
      const activeGifts = gifts.filter(row => row.active !== false);
      const userOptions = users.map(row => `<option value="${esc(row.user_key)}">${esc(row.name || "Гость BALI")}${row.username ? ` · ${esc(row.username)}` : ""}</option>`).join("");
      root.insertAdjacentHTML("beforeend", `<section class="panel" id="loyaltyIssuancePanel" style="margin-top:14px"><div class="panel-head"><div><h3>Выдача пользователям</h3><small>Награда или подарок сохраняется в общей истории выдач</small></div></div><div class="panel-body" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px"><form id="rewardIssueForm" class="admin-complete-form"><h3>Выдать награду</h3><label><span>Пользователь</span><select name="user_key" required><option value="">Выберите пользователя</option>${userOptions}</select></label><label><span>Награда</span><select name="reward_id" required><option value="">Выберите награду</option>${activeRewards.map(row => `<option value="${esc(row.id)}">${esc(row.title)}</option>`).join("")}</select></label><button class="primary" type="submit" ${!users.length || !activeRewards.length ? "disabled" : ""}>Выдать награду</button>${!users.length ? '<p class="muted">Нет зарегистрированных пользователей app_users.</p>' : ""}${!activeRewards.length ? '<p class="muted">Сначала создайте активную награду.</p>' : ""}</form><form id="giftIssueForm" class="admin-complete-form"><h3>Выдать подарок</h3><label><span>Пользователь</span><select name="to_user_key" required><option value="">Выберите пользователя</option>${userOptions}</select></label><label><span>Подарок</span><select name="gift_id" required><option value="">Выберите подарок</option>${activeGifts.map(row => `<option value="${esc(row.id)}">${esc(row.title)}</option>`).join("")}</select></label><button class="primary" type="submit" ${!users.length || !activeGifts.length ? "disabled" : ""}>Выдать подарок</button>${!activeGifts.length ? '<p class="muted">Сначала создайте активный подарок.</p>' : ""}</form></div></section>`);
    } finally {
      mounting = false;
    }
  }

  document.addEventListener("submit", async event => {
    if (event.target.id === "rewardIssueForm") {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.target).entries());
      const rewards = await store.list("loyalty_rewards");
      const reward = rewards.find(row => String(row.id) === String(data.reward_id));
      if (!reward) return toast("Награда не найдена");
      const existing = (await store.list("reward_grants")).find(row => String(row.user_key) === String(data.user_key) && String(row.reward_id) === String(data.reward_id) && !row.revoked_at);
      if (existing) return toast("Эта награда уже выдана пользователю");
      await store.save("reward_grants", { user_key: data.user_key, reward_id: data.reward_id, reward_title: reward.title, status: "issued", source: "admin" });
      toast("Награда выдана");
      event.target.reset();
      return;
    }
    if (event.target.id === "giftIssueForm") {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.target).entries());
      const gifts = await store.list("loyalty_gifts");
      const gift = gifts.find(row => String(row.id) === String(data.gift_id));
      if (!gift) return toast("Подарок не найден");
      await store.save("gift_grants", { from_user_key: null, to_user_key: data.to_user_key, gift_id: data.gift_id, gift_title: gift.title, status: "sent" });
      toast("Подарок выдан");
      event.target.reset();
    }
  }, true);

  const observer = new MutationObserver(() => requestAnimationFrame(mount));
  observer.observe(document.getElementById("content"), { childList: true, subtree: false });
  document.addEventListener("click", event => {
    if (event.target.closest('#adminNav [data-view="bonuses"],[data-loyalty-tab]')) setTimeout(mount, 0);
  }, true);

  window.BaliAdminLoyaltyIssuance = { mount };
})();