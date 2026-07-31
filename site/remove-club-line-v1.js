(() => {
  "use strict";

  if (window.__BALI_REMOVE_CLUB_LINE_V1__) return;
  window.__BALI_REMOVE_CLUB_LINE_V1__ = true;

  const style = document.createElement("style");
  style.id = "baliRemoveClubLineV1";
  style.textContent = `
    @media (max-width:760px){
      .top .brand small{
        display:none!important;
      }
      .top .bali-brand-copy{
        gap:0!important;
      }
      .top .bali-top-description{
        margin-top:1px!important;
      }
      .shell{
        grid-template-rows:calc(60px + var(--safe-top)) minmax(0,1fr) calc(42px + var(--safe))!important;
      }
      .top{
        min-height:58px!important;
      }
    }
  `;
  document.head.appendChild(style);

  const apply = () => {
    document.querySelectorAll(".top .brand small").forEach(node => {
      node.setAttribute("aria-hidden", "true");
      node.style.display = "none";
    });
    window.BaliHomeOneScreen?.fit?.();
  };

  const observer = new MutationObserver(apply);
  observer.observe(document.body, { subtree:true, childList:true });

  apply();
  setTimeout(apply, 100);
  setTimeout(apply, 400);
})();
