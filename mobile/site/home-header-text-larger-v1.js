(() => {
  "use strict";

  if (window.__BALI_HOME_HEADER_TEXT_LARGER_V1__) return;
  window.__BALI_HOME_HEADER_TEXT_LARGER_V1__ = true;

  const style = document.createElement("style");
  style.id = "baliHomeHeaderTextLargerV1";
  style.textContent = `
    @media (max-width:760px){
      .shell{
        grid-template-rows:calc(64px + var(--safe-top)) minmax(0,1fr) calc(42px + var(--safe))!important;
      }
      .top{
        min-height:62px!important;
      }
      .top .brand small{
        margin-top:1px!important;
        font-size:8.2px!important;
        line-height:1.08!important;
        letter-spacing:.035em!important;
      }
      .top .bali-top-description{
        max-width:calc(100vw - 92px)!important;
        margin-top:2px!important;
        font-size:9px!important;
        line-height:1.12!important;
      }
    }

    @media (max-width:360px){
      .top .brand small{
        font-size:7.7px!important;
      }
      .top .bali-top-description{
        font-size:8.4px!important;
        line-height:1.1!important;
      }
    }
  `;
  document.head.appendChild(style);

  const refit = () => window.BaliHomeOneScreen?.fit?.();
  requestAnimationFrame(refit);
  setTimeout(refit, 100);
  window.addEventListener("resize", refit, { passive:true });
})();
