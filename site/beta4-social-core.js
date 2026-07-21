(() => {
  if (window.BaliBeta4Social || !window.BaliBeta4Game) return;
  const game = window.BaliBeta4Game;
  const KEYS = { profile:"bali_social_profile_v1", people:"bali_social_people_v1", requests:"bali_social_requests_v1", gifts:"bali_social_gifts_v1", thumbs:"bali_social_swipes_v2" };
  const STATUSES = [["party","Ищу компанию на вечеринку"],["table","Ищу компанию для бронирования столика"],["chat","Открыт(а) к общению"],["closed","Не знакомлюсь"]];
  const GIFT_CATALOG = [{id:"rose",icon:"🌹",name:"Роза",stars:25},{id:"cocktail",icon:"🍸",name:"Коктейль",stars:50},{id:"disco",icon:"🪩",name:"Диско-шар",stars:100},{id:"crown",icon:"👑",name:"VIP-корона",stars:250}];
  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
  const write=(key,value)=>{localStorage.setItem(key,JSON.stringify(value));window.dispatchEvent(new CustomEvent("bali:social-changed",{detail:{key}}));return value};
  const now=()=>new Date().toISOString(),uid=p=>`${p}-${crypto.randomUUID?.()||Date.now()}`,base=()=>game.profile(),myId=()=>String(base().id||base().userKey||base().code);
  function profile(){const p=base(),saved=read(KEYS.profile,{});return{id:myId(),name:p.name||"Гость BALI",username:p.username||"",photo:saved.photo||p.avatar||"",cropX:Number(saved.cropX??50),cropY:Number(saved.cropY??40),status:saved.status||"closed",bio:saved.bio||"",active:saved.active===true,shareTelegram:false,...saved}}
  function cleanPeople(rows){return (rows||[]).filter(item=>item&&item.id&&!String(item.id).startsWith("demo-"))}
  function saveProfile(patch={}){const next={...profile(),...patch,id:myId(),updatedAt:now()};write(KEYS.profile,next);const rows=cleanPeople(read(KEYS.people,[])).filter(x=>x.id!==next.id);rows.unshift(next);write(KEYS.people,rows);return next}
  function people(){const me=profile(),rows=cleanPeople(read(KEYS.people,[]));return[me,...rows.filter(x=>x.id!==me.id)]}
  function visiblePeople(){return people().filter(x=>x.id!==myId()&&x.active===true&&x.status!=="closed")}
  const thumbs=()=>read(KEYS.thumbs,[]);
  function setThumb(fromId,toId,active=true){const rows=thumbs().filter(x=>!(x.fromId===fromId&&x.toId===toId));if(active)rows.unshift({id:uid("thumb"),fromId,toId,decision:"thumb",createdAt:now()});write(KEYS.thumbs,rows.slice(0,3000));return active}
  function toggleThumb(targetId){const active=!hasThumb(myId(),targetId);setThumb(myId(),targetId,active);return{active,connected:active&&isConnection(targetId)}}
  function hasThumb(fromId,toId){return thumbs().some(x=>x.fromId===fromId&&x.toId===toId&&(x.decision==="thumb"||x.decision==="like"))}
  function isConnection(otherId){return hasThumb(myId(),otherId)&&hasThumb(otherId,myId())}
  function incomingThumbs(){return visiblePeople().filter(person=>hasThumb(person.id,myId()))}
  function connections(){return visiblePeople().filter(person=>isConnection(person.id))}
  const requests=()=>read(KEYS.requests,[]);
  function sendRequest(targetId,type="event",event=null){const target=people().find(x=>x.id===targetId);if(!target)return{ok:false,message:"Профиль не найден"};if(requests().some(x=>x.fromId===myId()&&x.toId===targetId&&x.type===type&&x.status==="pending"))return{ok:false,message:"Такое приглашение уже отправлено"};const item={id:uid("req"),fromId:myId(),fromName:profile().name,toId:targetId,toName:target.name,type,status:"pending",eventId:event?.id||"",eventTitle:event?.title||"",eventDate:event?.event_date||"",createdAt:now()};const rows=requests();rows.unshift(item);write(KEYS.requests,rows.slice(0,1000));return{ok:true,item}}
  function respond(id,accepted){const rows=requests(),index=rows.findIndex(x=>x.id===id);if(index<0)return null;rows[index]={...rows[index],status:accepted?"accepted":"declined",respondedAt:now()};write(KEYS.requests,rows);return rows[index]}
  const gifts=()=>read(KEYS.gifts,[]);
  function recordGift(targetId,giftId,source="beta_demo"){const gift=GIFT_CATALOG.find(x=>x.id===giftId),target=people().find(x=>x.id===targetId);if(!gift||!target)return null;const item={id:uid("gift"),fromId:myId(),fromName:profile().name,toId:targetId,toName:target.name,giftId,giftName:gift.name,icon:gift.icon,stars:gift.stars,source,createdAt:now()};const rows=gifts();rows.unshift(item);write(KEYS.gifts,rows.slice(0,500));return item}
  window.BaliBeta4Social={KEYS,STATUSES,GIFT_CATALOG,profile,saveProfile,people,visiblePeople,thumbs,toggleThumb,setThumb,hasThumb,isConnection,incomingThumbs,connections,requests,sendRequest,respond,gifts,recordGift,myId};
})();