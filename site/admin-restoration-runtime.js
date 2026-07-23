(() => {
  if (window.__BALI_ADMIN_RESTORATION_RUNTIME__) return;
  window.__BALI_ADMIN_RESTORATION_RUNTIME__ = true;
  let scheduled=false;

  function setText(node,value){if(node&&node.textContent!==value)node.textContent=value}
  function apply() {
    scheduled=false;
    const badge = document.getElementById("modeBadge");
    if (badge && /демо|beta|content|stable/i.test(badge.textContent || "")) setText(badge,window.BaliStore?.cloudEnabled ? "ОБЛАКО" : "ЛОКАЛЬНО");
    document.querySelectorAll("#resetDemo").forEach(node => node.remove());
    document.querySelectorAll(".step strong,.step p,.login-card small,.login-card .eyebrow,.brand small").forEach(node => {
      const current=String(node.textContent || "");
      const next=current.replace(/демонстрационный режим/gi,"локальное рабочее хранилище").replace(/демонстрационные данные/gi,"локальные данные").replace(/·\s*(?:BETA\s*\d*|CONTENT\s*\d*|STABLE\s*\d*)/gi,"").trim();
      if(next!==current)node.textContent=next;
    });
    setText(document.querySelector('#adminNav [data-view="hall"] span'),"Схемы");
    setText(document.querySelector('#adminNav [data-view="bonuses"] span'),"Баллы + VIP");
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(apply)}
  const observer = new MutationObserver(schedule);
  observer.observe(document.body,{childList:true,subtree:true});
  [0,150,600,1500].forEach(delay => setTimeout(schedule,delay));
})();