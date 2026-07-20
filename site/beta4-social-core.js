(() => {
  if (window.BaliBeta4Social || !window.BaliBeta4Game) return;
  const game = window.BaliBeta4Game;
  const KEYS = { profile:"bali_social_profile_v1", people:"bali_social_people_v1", requests:"bali_social_requests_v1", gifts:"bali_social_gifts_v1", swipes:"bali_social_swipes_v1" };
  const STATUSES = [["open","Открыт(а) к знакомствам"],["party","Ищу компанию на вечеринку"],["table","Ищу компанию для бронирования столика"],["dance","Ищу компанию потанцевать"],["chat","Открыт(а) к общению"],["closed","Не знакомлюсь"]];
  const GIFT_CATALOG = [{id:"rose",icon:"🌹",name:"Роза",stars:25},{id:"cocktail",icon:"🍸",name:"Коктейль",stars:50},{id:"disco",icon:"🪩",name:"Диско-шар",stars:100},{id:"crown",icon:"👑",name:"VIP-корона",stars:250}];
  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
  const write=(key,value)=>{localStorage.setItem(key,JSON.stringify(value));window.dispatchEvent(new CustomEvent("bali:social-changed",{detail:{key}}));return value};
  const now=()=>new Date().toISOString();
  const uid=p=>`${p}-${crypto.randomUUID?.()||Date.now()}`;
  const base=()=>game.profile();
  const myId=()=>String(base().id||base().userKey||base().code);
  const demos=[
    {id:"demo-1",name:"Лера",username:"@lera_demo",photo:"",cropX:50,cropY:40,status:"party",bio:"Ищу компанию на вечеринку и люблю танцы.",active:true,shareTelegram:true},
    {id:"demo-2",name:"Макс",username:"@max_demo",photo:"",cropX:50,cropY:40,status:"table",bio:"Собираю компанию для бронирования столика.",active:true,shareTelegram:true},
    {id:"demo-3",name:"Алина",username:"@alina_demo",photo:"",cropX:50,cropY:40,status:"dance",bio:"Ищу компанию потанцевать.",active:true,shareTelegram:true}
  ];
  function profile(){const p=base(),saved=read(KEYS.profile,{});return{ id:myId(),name:p.name||"Гость BALI",username:p.username||"",photo:saved.photo||p.avatar||"",cropX:Number(saved.cropX??50),cropY:Number(saved.cropY??40),status:saved.status||"closed",bio:saved.bio||"",active:saved.active===true,shareTelegram:saved.shareTelegram!==false,...saved }}
  function saveProfile(patch={}){const next={...profile(),...patch,id:myId(),updatedAt:now()};write(KEYS.profile,next);const rows=people().filter(x=>x.id!==next.id);rows.unshift(next);write(KEYS.people,rows);return next}
  function people(){const rows=read(KEYS.people,[]);if(!rows.length)write(KEYS.people,demos);const me=profile();return[me,...read(KEYS.people,demos).filter(x=>x.id!==me.id)]}
  function visiblePeople(){return people().filter(x=>x.id!==myId()&&x.active!==false&&x.status!=="closed")}
  function swipe(targetId,decision){const rows=read(KEYS.swipes,{});rows[targetId]={decision,at:now()};return write(KEYS.swipes,rows)}
  const requests=()=>read(KEYS.requests,[]);
  function sendRequest(targetId,type="chat",event=null){const target=people().find(x=>x.id===targetId);if(!target)return{ok:false,message:"Профиль не найден"};if(requests().some(x=>x.fromId===myId()&&x.toId===targetId&&x.type===type&&x.status==="pending"))return{ok:false,message:"Запрос уже отправлен"};const item={id:uid("req"),fromId:myId(),fromName:profile().name,toId:targetId,toName:target.name,type,status:"pending",eventId:event?.id||"",eventTitle:event?.title||"",eventDate:event?.event_date||"",createdAt:now()};const rows=requests();rows.unshift(item);write(KEYS.requests,rows);return{ok:true,item}}
  function respond(id,accepted){const rows=requests(),i=rows.findIndex(x=>x.id===id);if(i<0)return null;rows[i]={...rows[i],status:accepted?"accepted":"declined",respondedAt:now()};write(KEYS.requests,rows);return rows[i]}
  function accepted(otherId){return requests().some(x=>x.status==="accepted"&&((x.fromId===myId()&&x.toId===otherId)||(x.toId===myId()&&x.fromId===otherId)))}
  function telegramVisible(person){return Boolean(person?.username&&person.shareTelegram!==false&&accepted(person.id))}
  const gifts=()=>read(KEYS.gifts,[]);
  function recordGift(targetId,giftId,source="beta_demo"){const gift=GIFT_CATALOG.find(x=>x.id===giftId),target=people().find(x=>x.id===targetId);if(!gift||!target)return null;const item={id:uid("gift"),fromId:myId(),fromName:profile().name,toId:targetId,toName:target.name,giftId,giftName:gift.name,icon:gift.icon,stars:gift.stars,source,createdAt:now()};const rows=gifts();rows.unshift(item);write(KEYS.gifts,rows.slice(0,300));return item}
  function seedIncoming(){const rows=requests();if(rows.some(x=>x.toId===myId()))return;rows.unshift({id:uid("req"),fromId:"demo-1",fromName:"Лера",toId:myId(),toName:profile().name,type:"chat",status:"pending",eventId:"",eventTitle:"",eventDate:"",createdAt:now()});write(KEYS.requests,rows)}
  seedIncoming();
  window.BaliBeta4Social={KEYS,STATUSES,GIFT_CATALOG,profile,saveProfile,people,visiblePeople,swipe,requests,sendRequest,respond,accepted,telegramVisible,gifts,recordGift,myId};
})();