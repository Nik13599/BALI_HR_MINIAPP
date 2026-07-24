(() => {
  if (window.__BALI_SOCIAL_CLOUD_SYNC_PRODUCTION__) return;
  window.__BALI_SOCIAL_CLOUD_SYNC_PRODUCTION__ = true;

  const social = window.BaliBeta4Social;
  const game = window.BaliBeta4Game;
  const store = window.BaliStore;
  const points = window.BaliPoints;
  const cfg = window.BALI_CONFIG || {};
  const tg = window.Telegram?.WebApp;
  if (!social || !game || !tg) return;

  const endpoint = cfg.supabaseUrl ? `${String(cfg.supabaseUrl).replace(/\/$/, "")}/functions/v1/telegram-social-profile` : "";
  const localSave = social.saveProfile.bind(social);
  const localProfile = social.profile.bind(social);
  let remote = [];
  let saving = false;
  let refreshing = null;
  let refreshTimer = 0;
  let signature = "";

  const bootProfile = localProfile();
  if (!bootProfile.active || bootProfile.status === "closed") localSave({ ...bootProfile, active: true, status: "chat" });

  async function invoke(action, body = {}, timeout = 9000) {
    if (!endpoint || !cfg.supabaseAnonKey || !tg.initData) throw new Error("BALI PEOPLE не подключён к серверу");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type":"application/json", apikey:cfg.supabaseAnonKey, Authorization:`Bearer ${cfg.supabaseAnonKey}` },
        body: JSON.stringify({ action, init_data: tg.initData, ...body })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.error) throw new Error(data.error || "Ошибка BALI PEOPLE");
      return data;
    } catch (error) {
      if (error?.name === "AbortError") throw new Error("Сервер BALI PEOPLE отвечает слишком долго");
      throw error;
    } finally { clearTimeout(timer); }
  }

  function normalize(row = {}) {
    const planId = String(row.vip_plan_id || "");
    const id = String(row.user_key || row.userKey || row.id || "");
    return {
      id,
      userKey:id,
      user_key:id,
      telegramId:row.telegram_id || row.telegramId || null,
      telegram_id:row.telegram_id || row.telegramId || null,
      name:row.name || "Гость BALI",
      username:row.username ? `@${String(row.username).replace(/^@/, "")}` : (row.telegram || ""),
      telegram:row.username ? `@${String(row.username).replace(/^@/, "")}` : (row.telegram || ""),
      photo:row.photo || row.avatar || "",
      avatar:row.photo || row.avatar || "",
      cropX:Number(row.crop_x ?? row.cropX ?? 50),
      cropY:Number(row.crop_y ?? row.cropY ?? 40),
      status:row.status && row.status !== "closed" ? row.status : "chat",
      bio:row.bio || "Пользователь BALI",
      active:true,
      profileActive:Boolean(row.profile_active ?? row.active ?? true),
      shareTelegram:Boolean(row.share_telegram ?? row.shareTelegram),
      phone:"",
      gender:row.gender || "unspecified",
      vipPlanId:planId,
      vip_plan_id:planId,
      vipPlanName:row.vip_plan_name || "",
      vip_plan_name:row.vip_plan_name || "",
      vipColor:row.vip_color || "",
      vip_color:row.vip_color || "",
      vipDescription:row.vip_description || "",
      vipPrivileges:Array.isArray(row.vip_privileges) ? row.vip_privileges : [],
      vipExpiresAt:row.vip_expires_at || "",
      vip_expires_at:row.vip_expires_at || "",
      vipStartsAt:row.vip_starts_at || "",
      updatedAt:row.updated_at || row.updatedAt || row.last_seen_at || "",
      createdAt:row.created_at || row.createdAt || row.first_seen_at || ""
    };
  }

  async function directDirectory() {
    const map = new Map();
    const add = row => {
      const normalized = normalize(row);
      if (normalized.id) map.set(normalized.id, { ...(map.get(normalized.id) || {}), ...normalized });
    };

    Object.values(points?.accounts?.() || {}).forEach(add);

    if (store?.client) {
      const [usersResult, pointsResult] = await Promise.all([
        store.client.from("app_users").select("*").order("last_seen_at", { ascending:false }).limit(1000).catch(error => ({ data:[], error })),
        store.client.from("points_accounts").select("*").order("updated_at", { ascending:false }).limit(1000).catch(error => ({ data:[], error }))
      ]);
      if (usersResult.error) console.warn("[BALI PEOPLE app_users]", usersResult.error.message);
      if (pointsResult.error) console.warn("[BALI PEOPLE points_accounts]", pointsResult.error.message);
      (pointsResult.data || []).forEach(add);
      (usersResult.data || []).forEach(add);
    }

    const myKey = String(localProfile()?.id || localProfile()?.userKey || "");
    return [...map.values()].filter(row => row.id && row.id !== myKey);
  }

  social.people = () => {
    const me = localProfile();
    return [me, ...remote.filter(row => String(row.id) !== String(me.id))];
  };
  social.visiblePeople = () => [...remote];
  social.incomingThumbs = () => social.visiblePeople().filter(person => social.hasThumb(person.id, social.myId()));

  function scheduleRefresh(delay = 20000) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => refresh(), delay);
  }

  async function refresh({ force = false } = {}) {
    if (refreshing && !force) return refreshing;
    clearTimeout(refreshTimer);
    refreshing = (async () => {
      try {
        let rows = [];
        try {
          const data = await invoke("list");
          rows = (data.profiles || []).map(normalize).filter(row => row.id);
        } catch (error) {
          console.warn("[BALI PEOPLE cloud]", error.message);
        }
        if (!rows.length) rows = await directDirectory();
        const nextSignature = JSON.stringify(rows.map(row => [row.id, row.updatedAt, row.vipPlanId, row.vipExpiresAt, row.photo, row.name]));
        remote = rows;
        if (force || nextSignature !== signature) {
          signature = nextSignature;
          window.dispatchEvent(new CustomEvent("bali:social-changed", { detail:{ source:"cloud", total:remote.length, refreshedAt:new Date().toISOString() } }));
        }
        return remote;
      } finally {
        refreshing = null;
        scheduleRefresh(document.visibilityState === "visible" ? 20000 : 60000);
      }
    })();
    return refreshing;
  }

  async function syncProfile(profile = social.profile()) {
    if (saving) return;
    saving = true;
    const visibleStatus = profile.status && profile.status !== "closed" ? profile.status : "chat";
    localSave({ ...profile, active:true, status:visibleStatus });
    try {
      const data = await invoke("sync", { profile:{
        name:profile.name || game.profile().name || "Гость BALI",
        photo:profile.photo || game.profile().avatar || "",
        crop_x:Number(profile.cropX ?? 50),
        crop_y:Number(profile.cropY ?? 40),
        status:visibleStatus,
        bio:profile.bio || "",
        active:true,
        share_telegram:Boolean(profile.shareTelegram),
        gender:profile.gender || game.profile().gender || "unspecified",
        birth_date:profile.birthDate || game.profile().birthDate || null
      }});
      const normalized = normalize(data.profile || {});
      localSave({ ...profile, active:true, status:visibleStatus, username:normalized.username, telegram:normalized.telegram, shareTelegram:normalized.shareTelegram });
    } catch (error) {
      console.warn("[BALI PEOPLE sync]", error.message);
    } finally {
      await refresh({ force:true });
      saving = false;
    }
  }

  social.saveProfile = function(patch = {}) {
    const current = localProfile();
    const nextStatus = patch.status && patch.status !== "closed" ? patch.status : (current.status && current.status !== "closed" ? current.status : "chat");
    const next = localSave({ ...patch, active:true, status:nextStatus });
    setTimeout(() => syncProfile(next), 0);
    return next;
  };

  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" ? refresh({ force:true }) : scheduleRefresh(60000));
  window.addEventListener("focus", () => refresh({ force:true }));
  window.addEventListener("bali:telegram-authenticated", () => { syncProfile(); refresh({ force:true }); }, { once:true });
  window.addEventListener("online", () => refresh({ force:true }));
  setTimeout(() => { syncProfile(); refresh({ force:true }); }, 50);

  window.BaliSocialCloud = { refresh:() => refresh({ force:true }), syncProfile, profiles:() => [...remote] };
})();