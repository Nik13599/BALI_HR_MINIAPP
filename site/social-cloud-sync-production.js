(() => {
  if (window.__BALI_SOCIAL_CLOUD_SYNC_PRODUCTION__) return;
  window.__BALI_SOCIAL_CLOUD_SYNC_PRODUCTION__ = true;
  const social = window.BaliBeta4Social;
  const game = window.BaliBeta4Game;
  const cfg = window.BALI_CONFIG || {};
  const tg = window.Telegram?.WebApp;
  if (!social || !game || !tg) return;
  const endpoint = cfg.supabaseUrl ? `${String(cfg.supabaseUrl).replace(/\/$/, "")}/functions/v1/telegram-social-profile` : "";
  const localSave = social.saveProfile.bind(social);
  const localProfile = social.profile.bind(social);
  let remote = [];
  let saving = false;
  let refreshTimer = 0;

  async function invoke(action, body = {}) {
    if (!endpoint || !cfg.supabaseAnonKey || !tg.initData) throw new Error("BALI PEOPLE не подключён к серверу");
    const response = await fetch(endpoint, {
      method:"POST",
      headers:{ "Content-Type":"application/json", apikey:cfg.supabaseAnonKey, Authorization:`Bearer ${cfg.supabaseAnonKey}` },
      body:JSON.stringify({ action, init_data:tg.initData, ...body })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.error) throw new Error(data.error || "Ошибка BALI PEOPLE");
    return data;
  }

  function normalize(row) {
    return {
      id:String(row.user_key || ""),
      userKey:String(row.user_key || ""),
      telegramId:row.telegram_id || null,
      name:row.name || "Гость BALI",
      username:row.username ? `@${String(row.username).replace(/^@/, "")}` : "",
      telegram:row.username ? `@${String(row.username).replace(/^@/, "")}` : "",
      photo:row.photo || "",
      cropX:Number(row.crop_x ?? 50),
      cropY:Number(row.crop_y ?? 40),
      status:row.status || "closed",
      bio:row.bio || "",
      active:Boolean(row.active),
      shareTelegram:Boolean(row.share_telegram),
      phone:"",
      gender:row.gender || "unspecified",
      updatedAt:row.updated_at || "",
      createdAt:row.created_at || ""
    };
  }

  function combinedPeople() {
    const me = localProfile();
    return [me, ...remote.filter(row => String(row.id) !== String(me.id))];
  }

  social.people = combinedPeople;
  social.visiblePeople = () => remote.filter(row => row.active === true && row.status !== "closed");
  social.incomingThumbs = () => social.visiblePeople().filter(person => social.hasThumb(person.id, social.myId()));

  async function refresh() {
    clearTimeout(refreshTimer);
    try {
      const data = await invoke("list");
      remote = (data.profiles || []).map(normalize).filter(row => row.id);
      window.dispatchEvent(new CustomEvent("bali:social-changed", { detail:{ source:"cloud" } }));
    } catch (error) { console.warn("[BALI PEOPLE cloud]", error.message); }
    refreshTimer = setTimeout(refresh, 60000);
  }

  async function syncProfile(profile = social.profile()) {
    if (saving) return;
    saving = true;
    try {
      const data = await invoke("sync", { profile:{
        name:profile.name || game.profile().name || "Гость BALI",
        photo:profile.photo || game.profile().avatar || "",
        crop_x:Number(profile.cropX ?? 50),
        crop_y:Number(profile.cropY ?? 40),
        status:profile.status || "closed",
        bio:profile.bio || "",
        active:Boolean(profile.active),
        share_telegram:Boolean(profile.shareTelegram),
        gender:profile.gender || game.profile().gender || "unspecified",
        birth_date:profile.birthDate || game.profile().birthDate || null
      }});
      const normalized = normalize(data.profile || {});
      localSave({ ...profile, username:normalized.username, telegram:normalized.telegram, shareTelegram:normalized.shareTelegram });
      await refresh();
    } catch (error) { console.warn("[BALI PEOPLE sync]", error.message); }
    finally { saving = false; }
  }

  social.saveProfile = function(patch = {}) {
    const next = localSave(patch);
    setTimeout(() => syncProfile(next), 0);
    return next;
  };

  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") refresh(); });
  window.addEventListener("bali:telegram-authenticated", () => { syncProfile(); refresh(); }, { once:true });
  setTimeout(() => { syncProfile(); refresh(); }, 800);
  window.BaliSocialCloud = { refresh, syncProfile, profiles:() => [...remote] };
})();