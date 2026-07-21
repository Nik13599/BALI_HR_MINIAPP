(() => {
  if (window.__BALI_ADMIN_BONUSES_ONLY__) return;
  window.__BALI_ADMIN_BONUSES_ONLY__ = true;

  function clean(root = document) {
    root.querySelectorAll?.('.vip-plan-admin label').forEach(label => {
      const text = label.textContent || "";
      const input = label.querySelector('input[name^="stars_"]');
      if (input || /Stars/i.test(text)) label.style.display = "none";
    });
    root.querySelectorAll?.('*').forEach(element => {
      if (element.children.length) return;
      if (/Стоимость Stars/i.test(element.textContent || "")) element.textContent = "VIP приобретается только за BALI-Баллы";
      if (/Telegram Stars/i.test(element.textContent || "")) element.textContent = (element.textContent || "").replace(/Telegram Stars/gi, "BALI-Баллы");
    });
    root.querySelectorAll?.('.bonus-hub-card').forEach(card => {
      const paragraph = card.querySelector('p');
      if (paragraph) paragraph.textContent = paragraph.textContent.replace(/Стоимость в Telegram Stars,?\s*/gi, "");
    });
  }

  clean();
  let scheduled = false;
  new MutationObserver(records => {
    if (scheduled) return;
    if (!records.some(record => record.addedNodes.length)) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; clean(); });
  }).observe(document.body, { childList: true, subtree: true });
})();