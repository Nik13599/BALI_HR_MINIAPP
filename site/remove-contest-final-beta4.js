(() => {
  if (window.__BALI_REMOVE_CONTEST_FINAL__) return;
  window.__BALI_REMOVE_CONTEST_FINAL__ = true;
  const selectors=[
    '[data-page="ranking"]','[data-screen="ranking"]','[data-view="crown"]',
    '[data-open-night-crown]','[data-night-crown]','#nightCrownPage','#nightCrownDialog',
    '.night-crown-card','.crown-win-card','.night-crown-widget'
  ];
  function clean(){selectors.forEach(s=>document.querySelectorAll(s).forEach(n=>n.remove()));}
  clean();
  let scheduled=false;
  const observer=new MutationObserver(records=>{
    if(scheduled)return;
    if(!records.some(r=>r.addedNodes.length))return;
    scheduled=true;requestAnimationFrame(()=>{scheduled=false;clean();});
  });
  observer.observe(document.body,{childList:true,subtree:true});
  window.BaliRemoveContestFinal={clean};
})();