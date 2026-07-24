(() => {
  if (window.__BALI_PEOPLE_PRIVACY__) return;
  window.__BALI_PEOPLE_PRIVACY__ = true;
  const social = window.BaliBeta4Social;
  const game = window.BaliBeta4Game;
  const tg = window.Telegram?.WebApp;
  if (!social || !game) return;
  const esc=(v="")=>String(v).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const username=value=>String(value||"").trim().replace(/^@/,"");
  let activePersonId="";

  function styles(){
    if(document.getElementById("baliPeoplePrivacyStyle"))return;
    const s=document.createElement("style");
    s.id="baliPeoplePrivacyStyle";
    s.textContent=`.people-private-contact{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.people-private-contact a{display:inline-flex;align-items:center;min-height:30px;padding:0 10px;border:1px solid rgba(200,255,61,.24);border-radius:999px;background:#c8ff3d0d;color:var(--lime);font-size:9px;font-weight:900;text-decoration:none}.people-privacy-note{padding:10px;border:1px solid rgba(200,255,61,.18);border-radius:13px;background:rgba(200,255,61,.05);color:var(--muted);font-size:8px;line-height:1.55}`;
    document.head.appendChild(s);
  }

  function contactHtml(person){
    const nick=username(person?.username||person?.telegram);
    if(!person?.shareTelegram||!nick)return "";
    return `<a href="https://t.me/${esc(nick)}" data-open-public-telegram="${esc(nick)}">@${esc(nick)}</a>`;
  }

  function injectSettings(){
    const form=document.getElementById("profileV2SettingsForm");
    if(!form)return;
    form.querySelector('[name="sharePhone"]')?.closest("label")?.remove();
    if(form.querySelector('[name="shareTelegram"]')){
      const label=form.querySelector('[name="shareTelegram"]')?.closest("label")?.querySelector("span");
      if(label)label.textContent="Показывать мой Telegram-ник другим пользователям";
      return;
    }
    const profile=social.profile();
    const anchor=form.querySelector('[name="socialStatus"]')?.closest("label")||form.querySelector("button[type=submit]");
    const note=document.createElement("div");
    note.className="people-privacy-note";
    note.textContent="Telegram-ник увидят другие пользователи только после вашего разрешения. Администратор видит ник всегда для поддержки и клиентской базы.";
    anchor?.insertAdjacentElement("beforebegin",note);
    const label=document.createElement("label");
    label.className="profile-v2-switch";
    label.innerHTML=`<span>Показывать мой Telegram-ник другим пользователям</span><input name="shareTelegram" type="checkbox" ${profile.shareTelegram?"checked":""}>`;
    anchor?.insertAdjacentElement("beforebegin",label);
  }

  function setContact(body,person){
    if(!body)return;
    const html=contactHtml(person);
    const actions=body.querySelector(".person-v2-actions");
    let box=body.querySelector(".people-private-contact");
    if(!html){box?.remove();return}
    if(!box){box=document.createElement("div");box.className="people-private-contact";actions?.insertAdjacentElement("beforebegin",box)}
    if(box.innerHTML!==html)box.innerHTML=html;
  }

  function decorateCards(){
    const people=social.visiblePeople();
    document.querySelectorAll('[data-open-social-person]').forEach(card=>{
      const person=people.find(item=>String(item.id)===String(card.dataset.openSocialPerson));
      if(person)setContact(card.querySelector(".person-v2-body"),person);
    });
  }

  function decorateDialog(){
    const body=document.getElementById("socialPersonBody");
    if(!body||!activePersonId)return;
    const person=social.visiblePeople().find(item=>String(item.id)===String(activePersonId));
    if(person)setContact(body,person);
  }

  function sync(){
    const gameProfile=game.profile(),socialProfile=social.profile(),patch={};
    if((socialProfile.username||"")!==(gameProfile.username||""))patch.username=gameProfile.username||"";
    if(Object.keys(patch).length)social.saveProfile(patch);
  }

  document.addEventListener("click",event=>{
    const link=event.target.closest("[data-open-public-telegram]");
    if(link){
      event.preventDefault();event.stopPropagation();
      const url=`https://t.me/${link.dataset.openPublicTelegram}`;
      if(tg?.openTelegramLink)tg.openTelegramLink(url);else window.open(url,"_blank","noopener");
      return;
    }
    const card=event.target.closest('[data-open-social-person]');
    if(card&&!event.target.closest("button")){activePersonId=card.dataset.openSocialPerson;setTimeout(decorateDialog,0)}
    if(event.target.closest("[data-open-profile-settings]"))setTimeout(injectSettings,0);
  },true);

  document.addEventListener("submit",event=>{
    if(event.target.id!=="profileV2SettingsForm")return;
    const form=event.target,data=Object.fromEntries(new FormData(form).entries());
    social.saveProfile({username:String(data.username||"").trim(),shareTelegram:Boolean(form.elements.shareTelegram?.checked),sharePhone:false});
  },true);

  styles();sync();
  let busy=false;
  const refresh=()=>{if(busy)return;busy=true;requestAnimationFrame(()=>{busy=false;injectSettings();decorateCards();decorateDialog()})};
  new MutationObserver(records=>{if(records.some(record=>record.addedNodes.length||record.removedNodes.length))refresh()}).observe(document.body,{childList:true,subtree:true});
  window.addEventListener("bali:social-changed",refresh);
  refresh();
})();