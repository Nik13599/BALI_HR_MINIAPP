(() => {
  if(window.__BALI_CROWN_STATUS_NOTIFY__||!window.BaliNightCrown)return;window.__BALI_CROWN_STATUS_NOTIFY__=true;
  const crown=window.BaliNightCrown,KEY="bali_crown_status_seen_v1";let busy=false;
  const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||"{}")}catch{return{}}};
  const toast=m=>{const n=document.getElementById("toast");if(!n)return;n.textContent=m;n.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>n.classList.remove("show"),5000)};
  async function check(){if(busy)return;busy=true;try{const event=await crown.activeEvent();if(!event)return;const entry=await crown.myEntry(event.id);if(!entry||!['approved','rejected'].includes(entry.status))return;const seen=read(),mark=`${entry.status}:${entry.updated_at||entry.approved_at||entry.rejected_at||''}`;if(seen[event.id]===mark)return;seen[event.id]=mark;localStorage.setItem(KEY,JSON.stringify(seen));toast(entry.status==='approved'?`👑 Ваша фотография одобрена. Вы участвуете в конкурсе «${event.title}».`:`⚠️ Вы сняты с конкурса. ${entry.moderation_note||'Фотография не соответствует правилам конкурса.'}`)}finally{busy=false}}
  ['bali:night-crown-changed','bali:data-changed'].forEach(n=>window.addEventListener(n,check));setInterval(()=>{if(!document.hidden)check()},15000);setTimeout(check,1000);
})();