(() => {
  const registry = window.BaliRewardIcons;
  if (!registry || window.__BALI_REWARD_ICON_LIST__) return;
  window.__BALI_REWARD_ICON_LIST__ = true;
  let selectedReward = "";
  const esc = value => String(value || "").replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));

  function draw() {
    if (typeof state === "undefined" || state.view !== "bonuses") return;
    const content = document.getElementById("content");
    if (!content) return;
    let panel = document.getElementById("rewardIconPanel");
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "rewardIconPanel";
      panel.className = "panel loyalty-admin";
      content.appendChild(panel);
    }
    const rewards = registry.allRewards();
    panel.innerHTML = `<div class="panel-head"><div><h3>Все награды</h3><small>Редактирование стандартных и созданных наград</small></div><span class="count">${rewards.length}</span></div><div class="panel-body"><p class="muted">Для каждой награды можно заменить значок. Принимается только PNG 1:1 с прозрачным фоном, сторона 64–2048 px.</p><input id="rewardIconFile" type="file" accept="image/png" hidden><div class="reward-icon-grid">${rewards.map(item => `<article class="reward-icon-item"><div>${item.image ? `<img src="${esc(item.image)}" alt="${esc(item.title)}">` : `<span>${esc(item.icon || "🏆")}</span>`}</div><strong>${esc(item.title)}</strong><small>${item.source === "standard" ? "Стандартная" : "Созданная вручную"} · +${Number(item.xp || 0)} XP</small><button type="button" class="secondary" data-pick-reward-icon="${esc(item.id)}">Заменить PNG</button></article>`).join("") || '<div class="empty">Награды ещё не добавлены</div>'}</div></div>`;
  }

  const style = document.createElement("style");
  style.textContent = `.reward-icon-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.reward-icon-item{display:grid;gap:7px;padding:10px;border:1px solid var(--line);border-radius:14px}.reward-icon-item>div{aspect-ratio:1;display:grid;place-items:center;overflow:hidden;border-radius:12px;background:rgba(255,255,255,.04)}.reward-icon-item img{width:100%;height:100%;object-fit:contain}.reward-icon-item span{font-size:38px}.reward-icon-item small{color:var(--muted);font-size:8px}.reward-icon-item button{min-height:38px}@media(max-width:720px){.reward-icon-grid{grid-template-columns:1fr 1fr}}@media(max-width:420px){.reward-icon-grid{grid-template-columns:1fr}}`;
  document.head.appendChild(style);

  document.addEventListener("click", event => {
    const button = event.target.closest("[data-pick-reward-icon]");
    if (!button) return;
    selectedReward = button.dataset.pickRewardIcon;
    document.getElementById("rewardIconFile")?.click();
  }, true);

  document.addEventListener("change", async event => {
    if (event.target.id !== "rewardIconFile" || !selectedReward) return;
    try {
      registry.set(selectedReward, await window.BaliRewardPng.validate(event.target.files?.[0]));
      window.toast?.("Значок награды обновлён");
      draw();
    } catch (error) {
      window.toast?.(error.message || "PNG не соответствует требованиям");
    }
    event.target.value = "";
  }, true);

  if (typeof window.render === "function" && !window.__BALI_REWARD_RENDER_HOOK__) {
    window.__BALI_REWARD_RENDER_HOOK__ = true;
    const baseRender = window.render;
    window.render = async function(...args) {
      const result = await baseRender.apply(this, args);
      draw();
      return result;
    };
  }

  window.addEventListener("bali:reward-icons-changed", draw);
  window.addEventListener("bali:loyalty-changed", draw);
  window.BaliRewardIconAdminDraw = draw;
  draw();
})();