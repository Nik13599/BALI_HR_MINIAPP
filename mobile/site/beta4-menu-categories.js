(() => {
  if (window.__BALI_MENU_CATEGORIES_GUEST__) return;
  window.__BALI_MENU_CATEGORIES_GUEST__ = true;
  const KEY = "bali_menu_categories_v1";
  let selected = "Все";
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
  const escapeHtml = value => String(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  function registry() {
    let rows = read();
    const root = document.getElementById("menuTabs");
    const domNames = root ? [...root.querySelectorAll("[data-category]")].map(b=>String(b.dataset.category||"").trim()).filter(n=>n&&n!=="Все") : [];
    if (!rows.length && domNames.length) {
      rows = domNames.map((name,index)=>({id:`category-${index+1}`,name,sort_order:index+1,active:true}));
      localStorage.setItem(KEY,JSON.stringify(rows));
    }
    return rows.filter(row=>row.active!==false&&String(row.name||"").trim()).sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0));
  }
  function patchTabs() {
    const root = document.getElementById("menuTabs");
    if (!root) return false;
    const names = registry().map(row=>row.name);
    if (!names.length) return true;
    const active = root.querySelector("[data-category].active")?.dataset.category;
    if (active) selected = active;
    if (selected !== "Все" && !names.includes(selected)) selected = "Все";
    const expected = ["Все",...names];
    const current = [...root.querySelectorAll("[data-category]")].map(button=>button.dataset.category);
    if (JSON.stringify(current) !== JSON.stringify(expected)) root.innerHTML = expected.map(name=>`<button class="${name===selected?"active":""}" data-category="${escapeHtml(name)}">${escapeHtml(name)}</button>`).join("");
    return true;
  }
  document.addEventListener("click", event => {
    const category = event.target.closest("#menuTabs [data-category]");
    if (category) { selected = category.dataset.category || "Все"; setTimeout(patchTabs,0); }
    if (event.target.closest('[data-page="menu"]')) setTimeout(patchTabs,50);
  }, true);
  window.addEventListener("bali:menu-categories-changed",patchTabs);
  window.addEventListener("storage",event=>{if(event.key===KEY)patchTabs()});
  window.addEventListener("focus",patchTabs);
  let attempts=0;const timer=setInterval(()=>{attempts++;if(patchTabs()||attempts>30)clearInterval(timer)},100);
})();