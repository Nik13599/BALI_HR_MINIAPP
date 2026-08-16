(() => {
  if(window.__BALI_CROWN_PRIZE_NOTIFY__||!window.BaliNightCrown)return;window.__BALI_CROWN_PRIZE_NOTIFY__=true;
  const crown=window.BaliNightCrown,KEY="bali_crown_prizes_seen_v1";let busy=false;
  const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||"{}")}catch{return{}}};
  const toast=m=>{const n=document.getElementById("toast");if(!n)return;n.textContent=m;n.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>n.classList.remove("show"),6500)};
  async function check(){if(busy)return;busy=true;try{const mine=String(crown.myKey()),history=await crown.history(),seen=read();for(const item of history){for(const prize of item.prizes||[]){if(String(prize.user_key)!==mine||seen[prize.id])continue;seen[prize.id]=new Date().toISOString();const label=prize.note||({points:`${prize.prize_value} BALI-Баллов`,vip:`VIP-статус ${prize.prize_value}`,reward:`Награда ${prize.prize_value}`,gift:`Подарок ${prize.prize_value}`}[prize.prize_type]||prize.prize_value);toast(`🎁 Вам выдан приз конкурса «${prize.event_title||item.event.title}»: ${label}`)}}localStorage.setItem(KEY,JSON.stringify(seen))}finally{busy=false}}
  ["bali:night-crown-changed","bali:data-changed"].forEach(n=>window.addEventListener(n,check));setInterval(()=>{if(!document.hidden)check()},15000);setTimeout(check,1200);
})();