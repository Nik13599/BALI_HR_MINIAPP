(() => {
  "use strict";
  if (window.__BALI_BETA4_PRODUCTION_SYNC__) return;
  window.__BALI_BETA4_PRODUCTION_SYNC__ = true;

  const STATE_PREFIX = "beta4_state_";
  const CHUNK_SIZE = 180000;
  const trackedKey = key => /^bali_/i.test(String(key || "")) && !/^bali_admin_/i.test(String(key || ""));
  const nativeSetItem = Storage.prototype.setItem;
  const nativeRemoveItem = Storage.prototype.removeItem;
  const nativeClear = Storage.prototype.clear;
  const blockIndex = new Map();
  const remoteKeys = new Set();
  const pending = new Map();
  let mirrorInstalled = false;
  let flushTimer = 0;
  let gameSyncTimer = 0;
  let gameSyncRunning = false;

  const esc = (value = "") => String(value).replace(/[&<>\"']/g, char => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  })[char]);

  async function api(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: { "Content-Type":"application/json", ...(options.headers || {}) }
    });
    if (response.status === 204) return null;
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload?.error?.message || payload?.message || "Ошибка соединения с BALI API");
      error.status = response.status;
      error.code = payload?.error?.code;
      throw error;
    }
    return payload;
  }

  function hash(text) {
    let value = 2166136261;
    for (const char of String(text)) {
      value ^= char.charCodeAt(0);
      value = Math.imul(value, 16777619);
    }
    return (value >>> 0).toString(16).padStart(8, "0");
  }

  function safeName(key) {
    const clean = String(key).replace(/[^a-zA-Z0-9:_-]/g, "_").slice(0, 105);
    return `${clean}_${hash(key)}`;
  }

  function metaKey(storageKey) { return `${STATE_PREFIX}${safeName(storageKey)}`; }
  function partKey(storageKey, index) { return `${metaKey(storageKey)}_p${index}`; }

  function localSnapshot() {
    const rows = new Map();
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!trackedKey(key)) continue;
      rows.set(key, localStorage.getItem(key) ?? "");
    }
    return rows;
  }

  async function loadBlocks() {
    const payload = await api("/api/v1/admin/content");
    blockIndex.clear();
    remoteKeys.clear();
    for (const block of payload?.blocks || []) {
      if (block.scope !== "admin" || !String(block.block_key || "").startsWith(STATE_PREFIX)) continue;
      blockIndex.set(block.block_key, block);
      const configuration = block.configuration || {};
      if (configuration.kind === "meta" && configuration.storageKey) remoteKeys.add(String(configuration.storageKey));
    }
    return payload;
  }

  async function upsertBlock(blockKey, configuration, name) {
    const existing = blockIndex.get(blockKey);
    if (existing) {
      const payload = await api(`/api/v1/admin/content/blocks/${encodeURIComponent(existing.id)}`, {
        method:"PATCH",
        body:JSON.stringify({
          configuration,
          active:true,
          reason:"Синхронизация production-состояния admin-beta4"
        })
      });
      if (payload?.block) blockIndex.set(blockKey, payload.block);
      return payload?.block;
    }
    const payload = await api("/api/v1/admin/content/blocks", {
      method:"POST",
      body:JSON.stringify({
        scope:"admin",
        blockKey,
        name:name || "BETA4 production state",
        title:"",
        subtitle:"",
        configuration,
        defaultValue:{
          name:name || "BETA4 production state",
          title:"",
          subtitle:"",
          assetKey:null,
          configuration
        },
        active:true,
        sortOrder:9000
      })
    });
    if (payload?.block) blockIndex.set(blockKey, payload.block);
    return payload?.block;
  }

  function chunks(raw) {
    const text = String(raw ?? "");
    if (!text.length) return [""];
    const result = [];
    for (let offset = 0; offset < text.length; offset += CHUNK_SIZE) result.push(text.slice(offset, offset + CHUNK_SIZE));
    return result;
  }

  async function syncStorageKey(storageKey, raw, deleted = false) {
    if (!trackedKey(storageKey)) return;
    const parts = deleted ? [] : chunks(raw);
    await upsertBlock(metaKey(storageKey), {
      kind:"meta",
      storageKey,
      chunks:parts.length,
      deleted:Boolean(deleted),
      updatedAt:new Date().toISOString()
    }, `BETA4 · ${storageKey}`);
    for (let index = 0; index < parts.length; index += 1) {
      await upsertBlock(partKey(storageKey, index), {
        kind:"chunk",
        storageKey,
        index,
        data:parts[index],
        updatedAt:new Date().toISOString()
      }, `BETA4 · ${storageKey} · ${index + 1}`);
    }
    remoteKeys.add(storageKey);
  }

  async function mapLimit(rows, limit, worker) {
    const source = [...rows];
    let cursor = 0;
    const runners = Array.from({ length: Math.min(limit, source.length) }, async () => {
      while (cursor < source.length) {
        const index = cursor++;
        await worker(source[index], index);
      }
    });
    await Promise.all(runners);
  }

  function readRemoteValue(storageKey) {
    const meta = blockIndex.get(metaKey(storageKey))?.configuration || {};
    if (meta.deleted) return { deleted:true, raw:"" };
    const count = Number(meta.chunks || 0);
    if (!count) return { deleted:false, raw:"" };
    let raw = "";
    for (let index = 0; index < count; index += 1) {
      const part = blockIndex.get(partKey(storageKey, index))?.configuration || {};
      raw += String(part.data ?? "");
    }
    return { deleted:false, raw };
  }

  async function hydrateOrSeed() {
    const localBefore = localSnapshot();
    await loadBlocks();
    if (remoteKeys.size) {
      for (const key of remoteKeys) {
        const remote = readRemoteValue(key);
        if (remote.deleted) nativeRemoveItem.call(localStorage, key);
        else nativeSetItem.call(localStorage, key, remote.raw);
      }
      const missing = [...localBefore.entries()].filter(([key]) => !remoteKeys.has(key));
      await mapLimit(missing, 4, ([key, value]) => syncStorageKey(key, value, false));
      return { mode:"hydrated", remote:remoteKeys.size, added:missing.length };
    }
    const rows = [...localBefore.entries()];
    await mapLimit(rows, 4, ([key, value]) => syncStorageKey(key, value, false));
    return { mode:"seeded", remote:0, added:rows.length };
  }

  async function flushPending() {
    clearTimeout(flushTimer);
    flushTimer = 0;
    const rows = [...pending.entries()];
    pending.clear();
    await mapLimit(rows, 3, async ([key, value]) => {
      try { await syncStorageKey(key, value.raw, value.deleted); }
      catch (error) { console.error("BALI beta4 state sync failed", key, error); }
    });
  }

  function queueStorageSync(key, raw, deleted = false) {
    if (!trackedKey(key)) return;
    pending.set(String(key), { raw:String(raw ?? ""), deleted:Boolean(deleted) });
    clearTimeout(flushTimer);
    flushTimer = setTimeout(() => flushPending().catch(console.error), 650);
  }

  function installStorageMirror() {
    if (mirrorInstalled) return;
    mirrorInstalled = true;
    Storage.prototype.setItem = function(key, value) {
      nativeSetItem.call(this, key, value);
      if (this === localStorage) queueStorageSync(key, value, false);
    };
    Storage.prototype.removeItem = function(key) {
      nativeRemoveItem.call(this, key);
      if (this === localStorage) queueStorageSync(key, "", true);
    };
    Storage.prototype.clear = function() {
      if (this !== localStorage) return nativeClear.call(this);
      const keys = [...localSnapshot().keys()];
      nativeClear.call(this);
      for (const key of keys) queueStorageSync(key, "", true);
    };
  }

  function backendAssetUrl(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    if (/^(?:https?:|data:|blob:)/i.test(text)) return text;
    if (text.startsWith("/site/")) return text;
    if (text.startsWith("./assets/")) return `/site/${text.slice(2)}`;
    if (text.startsWith("assets/")) return `/site/${text}`;
    return text;
  }

  function prizeId(position) {
    if (position === 1) return "match3-weekly-top1";
    if (position === 2) return "match3-weekly-top2";
    if (position === 3) return "match3-weekly-top3";
    return "match3-weekly-top10";
  }

  async function pushGameConfig(config) {
    if (!config || gameSyncRunning) return;
    gameSyncRunning = true;
    try {
      const economy = await api("/api/v1/admin/economy");
      const current = economy?.gameSettings || {};
      const existingPrizes = Array.isArray(current.default_prizes) ? current.default_prizes : [];
      const rewards = Array.isArray(config.rewards) ? config.rewards : [];
      const vipIds = new Set((economy?.vipPlans || []).map(row => String(row.id)));
      const defaultPrizes = Array.from({ length:10 }, (_, index) => {
        const position = index + 1;
        const source = rewards.find(row => Number(row.position) === position) || {};
        const before = existingPrizes.find(row => Number(row.position) === position) || {};
        const requestedVip = String(source.vipPlan || "");
        return {
          ...before,
          position,
          points:Math.max(0, Number(source.points ?? before.points ?? 0)),
          rewardIds:Array.isArray(before.rewardIds) && before.rewardIds.length ? before.rewardIds : [prizeId(position)],
          vipPlanId:requestedVip && vipIds.has(requestedVip) ? requestedVip : String(before.vipPlanId || ""),
          vipDays:Math.max(0, Number(source.vipDays ?? before.vipDays ?? 0))
        };
      });
      const symbols = (Array.isArray(config.tiles) ? config.tiles : []).map(tile => ({
        key:String(tile.id || ""),
        label:String(tile.name || tile.id || ""),
        imageUrl:backendAssetUrl(tile.activeAsset || tile.image),
        defaultImageUrl:backendAssetUrl(tile.originalAsset || tile.image),
        active:tile.active !== false
      })).filter(row => row.key && row.imageUrl);
      await api("/api/v1/admin/game/settings", {
        method:"PATCH",
        body:JSON.stringify({
          baseLives:Math.max(1, Number(config.lives?.maximum || current.base_lives || 5)),
          continuePointsCost:Math.max(0, Number(config.economy?.continueCosts?.[0] ?? current.continue_points_cost ?? 0)),
          rankingPeriodDays:Number(current.ranking_period_days || 7),
          symbols,
          defaultPrizes,
          gameTitle:String(config.title || current.game_title || "BALI Match"),
          gameSubtitle:String(config.subtitle || current.game_subtitle || "Бесконечная сезонная игра"),
          backgroundImageUrl:backendAssetUrl(config.backgroundImage || current.background_image_url),
          rewardImageUrl:backendAssetUrl(config.rewardImage || current.reward_image_url),
          levelRules:config.levelRules || current.level_rules || {},
          scoringRules:config.scoringRules || current.scoring_rules || {},
          ratingRules:config.ratingRules || current.rating_rules || {},
          economyRules:config.economy || current.economy_rules || {},
          livesRules:config.lives || current.lives_rules || {},
          clanRules:config.clanRules || current.clan_rules || {},
          reason:"Синхронизация настроек игры из admin-beta4"
        })
      });
      window.dispatchEvent(new CustomEvent("bali:beta4-game-cloud-synced"));
    } catch (error) {
      console.error("BALI Match3 production sync failed", error);
      window.toast?.(`Настройки игры сохранены локально, но облачная синхронизация не завершена: ${error.message}`);
    } finally {
      gameSyncRunning = false;
    }
  }

  function scheduleGameSync(config) {
    clearTimeout(gameSyncTimer);
    gameSyncTimer = setTimeout(() => pushGameConfig(config).catch(console.error), 850);
  }

  function installGameBridge() {
    const game = window.BaliMatch3;
    if (!game || game.__productionBridge) return;
    Object.defineProperty(game, "__productionBridge", { value:true, configurable:false });
    const saveConfig = game.saveConfig?.bind(game);
    if (saveConfig) game.saveConfig = patch => {
      const result = saveConfig(patch);
      scheduleGameSync(game.config?.() || result);
      return result;
    };
    const resetTiles = game.resetTiles?.bind(game);
    if (resetTiles) game.resetTiles = () => {
      const result = resetTiles();
      scheduleGameSync(game.config?.() || result);
      return result;
    };
    const resetRewards = game.resetRewards?.bind(game);
    if (resetRewards) game.resetRewards = () => {
      const result = resetRewards();
      scheduleGameSync(game.config?.() || result);
      return result;
    };
    scheduleGameSync(game.config?.());
  }

  function installLoginStyles() {
    if (document.getElementById("beta4ProductionAuthStyle")) return;
    const style = document.createElement("style");
    style.id = "beta4ProductionAuthStyle";
    style.textContent = `
      .beta4-production-auth{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:22px;background:radial-gradient(circle at 50% 0,#1b2418 0,#080a0a 42%,#050606 100%);color:#fff;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      .beta4-production-auth[hidden]{display:none!important}.beta4-production-auth form{width:min(430px,100%);display:grid;gap:14px;padding:28px;border:1px solid #c8ff3d55;border-radius:24px;background:#0d100ef2;box-shadow:0 28px 90px #000b}
      .beta4-production-auth .beta4-auth-logo{width:50px;height:50px;display:grid;place-items:center;border-radius:50%;background:#c8ff3d;color:#080a08;font-weight:950;font-size:27px}.beta4-production-auth small{color:#a6ada7;letter-spacing:.12em;text-transform:uppercase}.beta4-production-auth h1{margin:0;font-size:30px}.beta4-production-auth p{margin:0;color:#b7bcb8;line-height:1.55}
      .beta4-production-auth label{display:grid;gap:7px;color:#d9ddd9;font-size:12px;font-weight:700}.beta4-production-auth input{min-height:48px;padding:0 14px;border:1px solid #ffffff22;border-radius:13px;background:#080a08;color:#fff;font-size:16px}.beta4-production-auth button{min-height:50px;border:0;border-radius:13px;background:#c8ff3d;color:#080a08;font-size:15px;font-weight:900}.beta4-production-auth .beta4-auth-error{min-height:18px;color:#ff7d91;font-size:12px}.beta4-production-auth .beta4-auth-sync{color:#c8ff3d;font-size:12px}
    `;
    document.head.appendChild(style);
  }

  function ensureLoginOverlay() {
    installLoginStyles();
    let overlay = document.getElementById("beta4ProductionAuth");
    if (overlay) return overlay;
    overlay = document.createElement("section");
    overlay.id = "beta4ProductionAuth";
    overlay.className = "beta4-production-auth";
    overlay.innerHTML = `
      <form id="beta4ProductionAuthForm">
        <div class="beta4-auth-logo">B</div>
        <small>BALI CONTROL · PRODUCTION</small>
        <h1>Служебный вход</h1>
        <p>После входа откроется админка BETA4 один в один с сохранением её настроек.</p>
        <label>Email<input name="email" type="email" autocomplete="username" required></label>
        <label>Пароль<input name="password" type="password" autocomplete="current-password" minlength="12" required></label>
        <button type="submit">Войти</button>
        <div class="beta4-auth-sync" id="beta4AuthSync"></div>
        <div class="beta4-auth-error" id="beta4AuthError"></div>
      </form>`;
    document.body.appendChild(overlay);
    return overlay;
  }

  function setAuthStatus(message, error = false) {
    const status = document.getElementById(error ? "beta4AuthError" : "beta4AuthSync");
    if (status) status.textContent = message || "";
  }

  async function openProductionAdmin() {
    setAuthStatus("Синхронизация данных и настроек…");
    try {
      await hydrateOrSeed();
      installStorageMirror();
      installGameBridge();
      setAuthStatus("Настройки синхронизированы ✓");
    } catch (error) {
      console.error("BALI BETA4 initial cloud sync failed", error);
      setAuthStatus(`Админка откроется, синхронизация повторится: ${error.message}`, true);
      installStorageMirror();
      installGameBridge();
    }
    const overlay = document.getElementById("beta4ProductionAuth");
    if (overlay) overlay.hidden = true;
    document.getElementById("demoLogin")?.click();
  }

  async function checkSession() {
    try {
      const payload = await api("/api/v1/auth/admin/session");
      if (payload?.admin) return payload.admin;
      return payload || null;
    } catch (error) {
      if (error.status === 401) return null;
      throw error;
    }
  }

  async function init() {
    const overlay = ensureLoginOverlay();
    document.addEventListener("click", async event => {
      const logout = event.target.closest("#logoutButton");
      if (!logout) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      try { await api("/api/v1/auth/admin/logout", { method:"POST", body:"{}" }); } catch {}
      window.BaliAdminApi?.clearToken?.();
      location.reload();
    }, true);

    const form = document.getElementById("beta4ProductionAuthForm");
    form?.addEventListener("submit", async event => {
      event.preventDefault();
      setAuthStatus("");
      setAuthStatus("", true);
      const data = Object.fromEntries(new FormData(form).entries());
      const button = form.querySelector("button[type='submit']");
      if (button) button.disabled = true;
      try {
        const payload = await api("/api/v1/auth/admin/login", { method:"POST", body:JSON.stringify(data) });
        if (!payload?.admin) throw new Error("Администратор не найден");
        await openProductionAdmin();
      } catch (error) {
        setAuthStatus(error.message || "Не удалось войти", true);
      } finally {
        if (button) button.disabled = false;
      }
    });

    setAuthStatus("Проверка служебной сессии…");
    try {
      const admin = await checkSession();
      if (admin) await openProductionAdmin();
      else {
        setAuthStatus("");
        overlay.hidden = false;
      }
    } catch (error) {
      setAuthStatus(error.message || "Нет соединения с сервером", true);
      overlay.hidden = false;
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once:true });
  else init();
})();
