(() => {
  if (window.__BALI_USER_PRODUCTION_CLEANUP__) return;
  window.__BALI_USER_PRODUCTION_CLEANUP__ = true;
  function apply() {
    document.querySelectorAll(".top .brand small").forEach(node => {
      node.textContent = String(node.textContent || "").replace(/\s*·?\s*BETA\s*4?/gi, "").replace(/\s*·?\s*BETA4/gi, "").trim() || "МИНСК";
    });
    document.querySelectorAll('[data-screen="dating"] .head .count').forEach(node => {
      if (/beta/i.test(node.textContent || "")) node.remove();
    });
    document.querySelectorAll("#profileV2Quick .profile-v2-tile.shop small").forEach(node => node.remove());
    document.querySelectorAll("#profileV2Quick .profile-v2-tile.shop strong").forEach(node => {
      node.textContent = "BALI Shop";
      node.style.fontSize = "14px";
    });
    const textWalker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes=[];while(textWalker.nextNode())nodes.push(textWalker.currentNode);
    nodes.forEach(node=>{
      let text=node.nodeValue||"";
      text=text.replace(/демонстрационн(?:ый|ая|ое|ые)\s+(?:режим|данные|версия)/gi,"");
      text=text.replace(/тестов(?:ый|ая|ое)\s+режим/gi,"");
      if(text!==node.nodeValue)node.nodeValue=text;
    });
  }
  new MutationObserver(apply).observe(document.body,{childList:true,subtree:true});
  [0,120,500,1200].forEach(delay=>setTimeout(apply,delay));
})();