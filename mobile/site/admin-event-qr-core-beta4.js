(() => {
  if (window.BaliEventQrCore) return;
  const QR_KEY="bali_event_qr_registry_v1", CHECKIN_KEY="bali_event_checkins_v1";
  const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}};
  const write=(k,v)=>{localStorage.setItem(k,JSON.stringify(v));window.dispatchEvent(new CustomEvent("bali:data-changed",{detail:{table:k}}));return v};
  const uid=()=>crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
  function ensure(event){const rows=read(QR_KEY,{});if(!rows[event.id]){rows[event.id]={eventId:event.id,token:uid(),active:true,createdAt:new Date().toISOString()};write(QR_KEY,rows)}return rows[event.id]}
  function payload(event){const qr=ensure(event);return `${location.origin}/BALI_HR_MINIAPP/site/beta4-square-app.html?checkin=1&event=${encodeURIComponent(event.id)}&token=${encodeURIComponent(qr.token)}`}
  async function lib(){if(window.QRCode?.toCanvas)return;await new Promise((resolve,reject)=>{const s=document.createElement("script");s.src="https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js";s.onload=resolve;s.onerror=reject;document.head.appendChild(s)})}
  async function draw(canvas,event){await lib();await QRCode.toCanvas(canvas,payload(event),{width:320,margin:2,errorCorrectionLevel:"H",color:{dark:"#080a0a",light:"#ffffff"}})}
  function checkins(eventId){return Object.values(read(CHECKIN_KEY,{})).filter(x=>String(x.event_id)===String(eventId)).sort((a,b)=>String(b.checked_in_at).localeCompare(String(a.checked_in_at)))}
  function regenerate(eventId){const rows=read(QR_KEY,{});rows[eventId]={eventId,token:uid(),active:true,createdAt:new Date().toISOString()};return write(QR_KEY,rows)[eventId]}
  window.BaliEventQrCore={QR_KEY,CHECKIN_KEY,read,write,ensure,payload,draw,checkins,regenerate};
})();