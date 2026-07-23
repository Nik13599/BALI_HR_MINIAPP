(() => {
  if (window.__BALI_ADMIN_EVENT_QR__) return;
  window.__BALI_ADMIN_EVENT_QR__ = true;
  const store=window.BaliStore,cfg=window.BALI_CONFIG||{};
  const $=(s,r=document)=>r.querySelector(s);
  const esc=(v="")=>String(v).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  function token(){return[...crypto.getRandomValues(new Uint8Array(24))].map(x=>x.toString(16).padStart(2,"0")).join("")}
  function encode(value){const bytes=new TextEncoder().encode(JSON.stringify(value));let binary="";bytes.forEach(byte=>binary+=String.fromCharCode(byte));return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"")}
  function checkinUrl(event){const url=new URL(cfg.checkinAppUrl||`${location.origin}/beta4-qr-app.html`);url.searchParams.set("checkin",encode({v:2,eventId:event.id,token:event.qr_token,title:event.title,date:event.event_date,time:event.event_time||"23:00",issuedAt:new Date().toISOString()}));return url.toString()}
  async function loadQrLib(){if(window.QRCode?.toCanvas)return;await new Promise((resolve,reject)=>{const script=document.createElement("script");script.src="https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js";script.onload=resolve;script.onerror=reject;document.head.appendChild(script)})}
  function dialog(){let d=$("#adminEventQrDialog");if(d)return d;document.body.insertAdjacentHTML("beforeend",'<dialog id="adminEventQrDialog" class="modal"><button class="modal-close" data-close-event-qr>×</button><div id="adminEventQrBody" class="editor-form"></div></dialog>');d=$("#adminEventQrDialog");d.addEventListener("click",e=>{if(e.target.closest("[data-close-event-qr]"))d.close()});return d}
  function notify(message){const t=$("#toast");if(!t)return;t.textContent=message;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2600)}
  async function openQr(eventId){
    try{
      if(!store?.cloudEnabled)throw new Error("Подключите рабочую базу Supabase");
      const rows=await store.list("events");let event=rows.find(x=>String(x.id)===String(eventId));if(!event)throw new Error("Событие не найдено");
      if(!event.qr_token){event=await store.save("events",{...event,qr_token:token(),qr_created_at:new Date().toISOString()})}
      const url=checkinUrl(event),d=dialog();$("#adminEventQrBody").innerHTML=`<div><span class="eyebrow">QR-ВХОД</span><h3>${esc(event.title)}</h3><p class="muted">${esc(event.event_date)} · ${esc(String(event.event_time||"23:00").slice(0,5))}</p></div><div style="display:grid;place-items:center;padding:16px;background:white;border-radius:18px"><canvas id="eventQrCanvas"></canvas></div><div class="code-box" style="overflow-wrap:anywhere">${esc(url)}</div><div class="modal-actions"><button class="ghost" id="copyEventQr">Копировать ссылку</button><button class="primary" id="downloadEventQr">Скачать QR</button></div>`;d.showModal();await loadQrLib();const canvas=$("#eventQrCanvas");await window.QRCode.toCanvas(canvas,url,{width:320,margin:2,errorCorrectionLevel:"H"});$("#copyEventQr")?.addEventListener("click",()=>navigator.clipboard.writeText(url).then(()=>notify("Ссылка скопирована")));$("#downloadEventQr")?.addEventListener("click",()=>{const a=document.createElement("a");a.href=canvas.toDataURL("image/png");a.download=`BALI-QR-${String(event.title||event.id).replace(/[^a-zA-Zа-яА-Я0-9]+/g,"-")}.png`;a.click()});
    }catch(error){notify(error.message||"Не удалось создать QR")}
  }
  function decorate(){document.querySelectorAll("[data-edit-event]").forEach(edit=>{const actions=edit.closest(".row-actions");if(!actions||actions.querySelector("[data-event-qr]"))return;const button=document.createElement("button");button.className="icon-btn";button.type="button";button.dataset.eventQr=edit.dataset.editEvent;button.title="QR-код входа";button.textContent="QR";actions.insertBefore(button,edit)})}
  document.addEventListener("click",event=>{const b=event.target.closest("[data-event-qr]");if(b){event.preventDefault();event.stopPropagation();openQr(b.dataset.eventQr)}},true);
  new MutationObserver(decorate).observe(document.body,{childList:true,subtree:true});
  decorate();
})();