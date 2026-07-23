(() => {
  if (window.__BALI_USER_MESSAGE_READ_PRODUCTION__) return;
  window.__BALI_USER_MESSAGE_READ_PRODUCTION__ = true;
  const cfg=window.BALI_CONFIG||{},store=window.BaliStore,tg=window.Telegram?.WebApp;
  let busy=false;
  async function readOne(){
    if(busy||!store?.cloudEnabled||!tg?.initData||!cfg.supabaseUrl)return;
    busy=true;
    try{
      const response=await fetch(`${String(cfg.supabaseUrl).replace(/\/$/,"")}/functions/v1/telegram-user-chat`,{
        method:"POST",headers:{"Content-Type":"application/json",apikey:cfg.supabaseAnonKey,Authorization:`Bearer ${cfg.supabaseAnonKey}`},
        body:JSON.stringify({action:"read_one_oldest",init_data:tg.initData})
      });
      if(response.ok)await window.BaliUserMessages?.load?.(false);
    }catch{}finally{busy=false}
  }
  document.addEventListener("click",event=>{
    const message=event.target.closest(".user-chat-message.admin");
    if(message)readOne();
  },true);
})();