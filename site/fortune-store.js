(() => {
  const baseStore = window.BaliStore;
  const client = baseStore?.client;
  const cloudEnabled = Boolean(baseStore?.cloudEnabled && client);
  const localKeys = {
    prizes: "bali_fortune_prizes_v1",
    codes: "bali_fortune_codes_v1",
    spins: "bali_fortune_spins_v1"
  };
  const defaultPrizes = [
    { id: "prize-beer", name: "Пиво", weight: 1, active: true, sort_order: 1 },
    { id: "prize-cocktail", name: "Коктейль", weight: 1, active: true, sort_order: 2 },
    { id: "prize-5-shots", name: "5 шотов", weight: 1, active: true, sort_order: 3 },
    { id: "prize-10-shots", name: "10 шотов", weight: 1, active: true, sort_order: 4 },
    { id: "prize-tequila", name: "Текила", weight: 1, active: true, sort_order: 5 },
    { id: "prize-nothing", name: "Ничего", weight: 1, active: true, sort_order: 6 }
  ];
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  const emitChange = () => window.dispatchEvent(new CustomEvent("bali:fortune-changed"));

  function makeId(prefix) {
    return `${prefix}-${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`}`;
  }

  function readLocal(key, fallback = []) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        const initial = structuredClone(fallback);
        localStorage.setItem(key, JSON.stringify(initial));
        return initial;
      }
      return JSON.parse(raw);
    } catch {
      return structuredClone(fallback);
    }
  }

  function writeLocal(key, rows) {
    localStorage.setItem(key, JSON.stringify(rows));
    emitChange();
    return rows;
  }

  function normalizeCode(value) {
    return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  }

  function randomUnit() {
    if (crypto.getRandomValues) {
      const array = new Uint32Array(1);
      crypto.getRandomValues(array);
      return array[0] / 4294967296;
    }
    return Math.random();
  }

  function generateCodeValue(length = 7) {
    const values = new Uint32Array(length);
    if (crypto.getRandomValues) crypto.getRandomValues(values);
    else for (let i = 0; i < length; i += 1) values[i] = Math.floor(Math.random() * 1e9);
    return [...values].map((value) => alphabet[value % alphabet.length]).join("");
  }

  async function listPrizes(includeInactive = false) {
    if (!cloudEnabled) {
      const rows = readLocal(localKeys.prizes, defaultPrizes);
      return rows
        .filter((row) => includeInactive || row.active !== false)
        .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
    }
    let query = client.from("fortune_prizes").select("*").order("sort_order", { ascending: true });
    if (!includeInactive) query = query.eq("active", true);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async function savePrize(row) {
    const payload = {
      ...row,
      id: row.id || makeId("prize"),
      weight: Math.max(0.01, Number(row.weight || 1)),
      sort_order: Number(row.sort_order || 0),
      active: row.active !== false
    };
    if (!cloudEnabled) {
      const rows = readLocal(localKeys.prizes, defaultPrizes);
      const index = rows.findIndex((item) => item.id === payload.id);
      if (index >= 0) rows[index] = { ...rows[index], ...payload };
      else rows.push(payload);
      writeLocal(localKeys.prizes, rows);
      return payload;
    }
    const { data, error } = await client.from("fortune_prizes").upsert(payload).select().single();
    if (error) throw error;
    emitChange();
    return data;
  }

  async function removePrize(id) {
    if (!cloudEnabled) {
      writeLocal(localKeys.prizes, readLocal(localKeys.prizes, defaultPrizes).filter((item) => item.id !== id));
      return;
    }
    const { error } = await client.from("fortune_prizes").delete().eq("id", id);
    if (error) throw error;
    emitChange();
  }

  async function listCodes() {
    if (!cloudEnabled) {
      return readLocal(localKeys.codes).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    }
    const { data, error } = await client
      .from("fortune_codes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function listSpins() {
    if (!cloudEnabled) {
      return readLocal(localKeys.spins).sort((a, b) => String(b.spun_at).localeCompare(String(a.spun_at)));
    }
    const { data, error } = await client
      .from("fortune_spins")
      .select("*")
      .order("spun_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function generateCodes(count = 1, expiresAt = null) {
    const amount = Math.max(1, Math.min(100, Number(count || 1)));
    const existing = new Set((await listCodes()).map((item) => item.code));
    const created = [];
    while (created.length < amount) {
      const code = generateCodeValue();
      if (existing.has(code)) continue;
      existing.add(code);
      created.push({
        id: makeId("fortune-code"),
        code,
        status: "active",
        expires_at: expiresAt || null,
        used_at: null,
        prize_id: null,
        prize_name: "",
        created_at: new Date().toISOString()
      });
    }

    if (!cloudEnabled) {
      writeLocal(localKeys.codes, [...created, ...readLocal(localKeys.codes)]);
      return created;
    }
    const { data, error } = await client.from("fortune_codes").insert(created).select();
    if (error) throw error;
    emitChange();
    return data || [];
  }

  async function revokeCode(id) {
    if (!cloudEnabled) {
      const rows = readLocal(localKeys.codes);
      const row = rows.find((item) => item.id === id);
      if (row && row.status === "active") row.status = "revoked";
      writeLocal(localKeys.codes, rows);
      return row;
    }
    const { data, error } = await client
      .from("fortune_codes")
      .update({ status: "revoked" })
      .eq("id", id)
      .eq("status", "active")
      .select()
      .maybeSingle();
    if (error) throw error;
    emitChange();
    return data;
  }

  async function redeem(code, metadata = {}) {
    const normalized = normalizeCode(code);
    if (normalized.length < 5) throw new Error("Введите код, полученный у бармена");

    if (cloudEnabled) {
      const { data, error } = await client.rpc("redeem_fortune_code", {
        p_code: normalized,
        p_telegram_id: String(metadata.telegramId || "")
      });
      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : data;
      if (!result) throw new Error("Код не найден или уже использован");
      emitChange();
      return result;
    }

    const codes = readLocal(localKeys.codes);
    const codeRow = codes.find((item) => item.code === normalized);
    if (!codeRow) throw new Error("Код не найден");
    if (codeRow.status !== "active") throw new Error("Этот код уже использован или отменён");
    if (codeRow.expires_at && new Date(codeRow.expires_at).getTime() < Date.now()) {
      codeRow.status = "expired";
      writeLocal(localKeys.codes, codes);
      throw new Error("Срок действия кода истёк");
    }

    const prizes = (await listPrizes()).filter((item) => item.active !== false && Number(item.weight) > 0);
    if (!prizes.length) throw new Error("В колесе нет активных призов");
    const total = prizes.reduce((sum, item) => sum + Number(item.weight), 0);
    let roll = randomUnit() * total;
    let prize = prizes[prizes.length - 1];
    for (const item of prizes) {
      roll -= Number(item.weight);
      if (roll <= 0) {
        prize = item;
        break;
      }
    }

    const usedAt = new Date().toISOString();
    codeRow.status = "used";
    codeRow.used_at = usedAt;
    codeRow.prize_id = prize.id;
    codeRow.prize_name = prize.name;
    writeLocal(localKeys.codes, codes);

    const spin = {
      id: makeId("fortune-spin"),
      code_id: codeRow.id,
      code: codeRow.code,
      prize_id: prize.id,
      prize_name: prize.name,
      telegram_id: String(metadata.telegramId || ""),
      spun_at: usedAt
    };
    writeLocal(localKeys.spins, [spin, ...readLocal(localKeys.spins)]);

    return {
      prize_id: prize.id,
      prize_name: prize.name,
      code: codeRow.code,
      spun_at: usedAt
    };
  }

  window.BaliFortune = {
    cloudEnabled,
    normalizeCode,
    listPrizes,
    savePrize,
    removePrize,
    listCodes,
    listSpins,
    generateCodes,
    revokeCode,
    redeem
  };
})();