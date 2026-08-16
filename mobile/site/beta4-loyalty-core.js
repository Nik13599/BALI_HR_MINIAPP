(() => {
  if (window.BaliBeta4Loyalty) return;
  const points = window.BaliPoints;
  const game = window.BaliBeta4Game;
  if (!points || !game) return;

  const KEYS = {
    config: "bali_beta4_loyalty_config_v1",
    chips: "bali_beta4_chips_v1",
    rewards: "bali_beta4_custom_rewards_v1",
    grants: "bali_beta4_reward_grants_v1",
    audit: "bali_beta4_reward_points_audit_v1",
    notifications: "bali_beta4_reward_notifications_v1"
  };
  const DEFAULT_CONFIG = {
    chipRatePoints: 100,
    chipDescription: "Фишки можно тратить на баре BALI: на коктейли, кальяны и специальные предложения клуба.",
    vipPointPrices: { vip: 2500, black: 5000, legend: 9000 }
  };
  const REWARD_POINT_PERMISSIONS = [
    "rewards.points.view",
    "rewards.points.configure",
    "rewards.award.override_points",
    "rewards.points.revoke",
    "rewards.points.audit"
  ];
  const MAX_REWARD_POINTS = 1_000_000_000;
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const write = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent("bali:loyalty-changed", { detail: { key } }));
    return value;
  };
  const now = () => new Date().toISOString();
  const uid = (prefix) => `${prefix}-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
  const integer = (value, fallback = 0, min = 0, max = MAX_REWARD_POINTS) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, Math.floor(parsed)));
  };
  const config = () => ({ ...DEFAULT_CONFIG, ...read(KEYS.config, {}), vipPointPrices: { ...DEFAULT_CONFIG.vipPointPrices, ...(read(KEYS.config, {}).vipPointPrices || {}) } });
  const saveConfig = (patch = {}) => write(KEYS.config, { ...config(), ...patch, vipPointPrices: { ...config().vipPointPrices, ...(patch.vipPointPrices || {}) } });
  const asSubject = (subject = game.profile()) => typeof subject === "string" ? { userKey: subject, name: "Гость BALI" } : (subject || game.profile());
  const identityKeys = (subject = game.profile()) => new Set(game.identityKeys(asSubject(subject)).map(String));
  const subjectKey = (subject = game.profile()) => {
    const row = asSubject(subject);
    return String(row.userKey || row.id || row.ownerKey || row.code || game.profile().id);
  };
  const can = (permission, permissions) => !Array.isArray(permissions) || permissions.includes(permission);

  function normalizeReward(row = {}, index = 0) {
    const repeatable = row.repeatable === true;
    const enabled = row.awardPointsEnabled ?? row.award_points_enabled ?? false;
    const rawMode = row.awardPointsMode || row.award_points_mode || (repeatable ? "each" : "first");
    const awardPointsMode = ["first", "each", "none"].includes(rawMode) ? rawMode : (repeatable ? "each" : "first");
    return {
      ...row,
      id: row.id || uid("reward"),
      title: String(row.title || "Награда BALI").trim(),
      description: String(row.description || "").trim(),
      image: row.image || "",
      xp: integer(row.xp, 0),
      conditionType: row.conditionType || "manual",
      eventId: row.eventId || "",
      eventTitle: row.eventTitle || "",
      threshold: integer(row.threshold, 1, 1),
      active: row.active !== false,
      repeatable,
      awardPointsEnabled: enabled === true,
      pointsRewardAmount: integer(row.pointsRewardAmount ?? row.points_reward_amount, 0),
      pointsRewardType: "points",
      awardPointsMode,
      deductPointsOnRevoke: (row.deductPointsOnRevoke ?? row.deduct_points_on_revoke) === true,
      pointsHistoryComment: String(row.pointsHistoryComment || row.points_history_comment || `Награда: ${row.title || "Награда BALI"}`).trim(),
      sort_order: Number(row.sort_order ?? index + 1),
      createdAt: row.createdAt || now(),
      updatedAt: row.updatedAt || now()
    };
  }

  function spendPoints(amount, title, type = "purchase") {
    const value = Math.max(0, Number(amount || 0));
    const profile = points.profile();
    if (!value) return { ok: false, message: "Стоимость не настроена" };
    if (Number(profile.balance || 0) < value) return { ok: false, message: "Недостаточно BALI-Баллов" };
    const result = points.adjustAccount(profile, -value, title);
    return result.ok ? { ok: true, spent: value, balance: Number(result.account?.balance || 0), type } : result;
  }

  const chipsRegistry = () => read(KEYS.chips, {});
  function chipBalance(subject = game.profile()) {
    const keys = identityKeys(subject), rows = chipsRegistry();
    for (const key of keys) if (rows[key] !== undefined) return Number(rows[key] || 0);
    return 0;
  }
  function setChipBalance(subject, value, note = "Корректировка фишек") {
    const rows = chipsRegistry(), key = subjectKey(subject);
    rows[key] = Math.max(0, Number(value || 0));
    write(KEYS.chips, rows);
    const history = read("bali_beta4_chip_history_v1", []);
    history.unshift({ id: uid("chip"), userKey: key, amount: rows[key], title: note, createdAt: now() });
    write("bali_beta4_chip_history_v1", history.slice(0, 300));
    return rows[key];
  }
  function adjustChips(subject, delta, note = "Корректировка фишек") {
    return setChipBalance(subject, chipBalance(subject) + Number(delta || 0), note);
  }
  function exchangeForChips(count = 1) {
    const quantity = Math.max(1, Math.floor(Number(count || 1)));
    const cost = quantity * Math.max(1, Number(config().chipRatePoints || 100));
    const spent = spendPoints(cost, `Обмен на ${quantity} фиш.${quantity === 1 ? "ку" : "ки"}`, "chips");
    if (!spent.ok) return spent;
    const balance = adjustChips(game.profile(), quantity, `Получено ${quantity} фиш.`);
    return { ok: true, quantity, cost, chipBalance: balance, pointsBalance: spent.balance };
  }
  function buyVipWithPoints(planId) {
    const plan = game.config().plans.find((row) => row.id === planId && row.active !== false);
    if (!plan) return { ok: false, message: "VIP-тариф не найден" };
    const cost = Math.max(0, Number(config().vipPointPrices?.[planId] || 0));
    const spent = spendPoints(cost, `Покупка ${plan.name} за BALI-Баллы`, "vip_points");
    if (!spent.ok) return spent;
    try {
      const vip = game.activateVip(planId, "bali_points", Number(plan.days || 30));
      return { ok: true, vip, cost, balance: spent.balance };
    } catch (error) {
      points.adjustAccount(points.profile(), cost, `Возврат за ${plan.name}`);
      return { ok: false, message: error.message || "Не удалось активировать VIP" };
    }
  }

  const rewards = () => read(KEYS.rewards, []).map(normalizeReward).sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
  function auditLog(action, payload = {}) {
    const rows = read(KEYS.audit, []);
    const entry = {
      id: uid("reward-audit"),
      action,
      rewardId: payload.rewardId || "",
      userRewardId: payload.userRewardId || "",
      userId: payload.userId || "",
      adminId: payload.adminId || "",
      amount: Number(payload.amount || 0),
      pointsType: payload.pointsType || "points",
      balanceBefore: payload.balanceBefore ?? null,
      balanceAfter: payload.balanceAfter ?? null,
      transactionId: payload.transactionId || "",
      sourceType: payload.sourceType || "",
      sourceId: payload.sourceId || "",
      metadata: payload.metadata || {},
      createdAt: now()
    };
    rows.unshift(entry);
    write(KEYS.audit, rows.slice(0, 2000));
    return entry;
  }
  const audit = (filters = {}) => read(KEYS.audit, []).filter((row) =>
    (!filters.rewardId || row.rewardId === filters.rewardId) &&
    (!filters.userId || row.userId === filters.userId) &&
    (!filters.action || row.action === filters.action)
  );
  function saveRewards(rows) {
    return write(KEYS.rewards, rows.map((row, index) => ({ ...normalizeReward(row, index), updatedAt: now() })));
  }
  function upsertReward(reward, options = {}) {
    if (!can("rewards.points.configure", options.permissions)) return { ok: false, message: "Недостаточно прав для настройки баллов награды" };
    const rawAmount = reward.pointsRewardAmount ?? reward.points_reward_amount;
    if (rawAmount !== undefined && (!Number.isInteger(Number(rawAmount)) || Number(rawAmount) < 0 || Number(rawAmount) > MAX_REWARD_POINTS)) {
      return { ok: false, message: "Количество баллов должно быть целым неотрицательным числом" };
    }
    const rows = rewards(), index = rows.findIndex((row) => row.id === reward.id);
    const previous = index >= 0 ? rows[index] : null;
    const next = normalizeReward({ ...(previous || {}), ...reward }, index >= 0 ? index : rows.length);
    if (index >= 0) rows[index] = next; else rows.push(next);
    saveRewards(rows);
    const pointsChanged = !previous ||
      previous.awardPointsEnabled !== next.awardPointsEnabled ||
      previous.pointsRewardAmount !== next.pointsRewardAmount ||
      previous.awardPointsMode !== next.awardPointsMode ||
      previous.deductPointsOnRevoke !== next.deductPointsOnRevoke;
    if (pointsChanged) {
      auditLog(previous ? "reward_points_config_changed" : "reward_points_config_created", {
        rewardId: next.id,
        adminId: options.adminId || "demo-admin",
        amount: next.pointsRewardAmount,
        metadata: {
          before: previous ? {
            enabled: previous.awardPointsEnabled,
            amount: previous.pointsRewardAmount,
            mode: previous.awardPointsMode,
            deductOnRevoke: previous.deductPointsOnRevoke
          } : null,
          after: {
            enabled: next.awardPointsEnabled,
            amount: next.pointsRewardAmount,
            mode: next.awardPointsMode,
            deductOnRevoke: next.deductPointsOnRevoke
          }
        }
      });
    }
    return next;
  }
  function removeReward(id) { return saveRewards(rewards().filter((row) => row.id !== id)); }

  const grants = () => read(KEYS.grants, []).sort((a, b) => String(b.earnedAt || "").localeCompare(String(a.earnedAt || "")));
  const saveGrants = (rows) => write(KEYS.grants, rows.slice(0, 3000));
  const rewardById = (rewardOrId) => {
    if (!rewardOrId) return null;
    return typeof rewardOrId === "string"
      ? rewards().find((row) => String(row.id) === String(rewardOrId))
      : normalizeReward(rewardOrId);
  };
  const accountFor = (subject) => points.accounts()[subjectKey(subject)] || { ...asSubject(subject), userKey: subjectKey(subject), balance: Number(asSubject(subject).balance || 0) };

  function addNotification(grant, reward) {
    const rows = read(KEYS.notifications, []);
    if (rows.some((row) => row.userRewardId === grant.id)) return;
    rows.unshift({
      id: uid("reward-notice"),
      userKey: grant.userKey,
      userRewardId: grant.id,
      rewardId: reward.id,
      title: reward.title,
      amount: Number(grant.pointsAwarded || 0),
      text: grant.pointsAwarded > 0
        ? `Вы получили награду «${reward.title}» и ${grant.pointsAwarded} баллов`
        : `Вы получили награду «${reward.title}»`,
      createdAt: grant.earnedAt || now(),
      readAt: null
    });
    write(KEYS.notifications, rows.slice(0, 1000));
  }
  function notifications(subject = game.profile(), unreadOnly = false) {
    const keys = identityKeys(subject);
    return read(KEYS.notifications, []).filter((row) => keys.has(String(row.userKey)) && (!unreadOnly || !row.readAt));
  }
  function markNotificationRead(id) {
    write(KEYS.notifications, read(KEYS.notifications, []).map((row) => row.id === id ? { ...row, readAt: row.readAt || now() } : row));
  }

  function updateGrant(grantId, patch) {
    const rows = grants().map((row) => row.id === grantId ? { ...row, ...patch } : row);
    saveGrants(rows);
    return rows.find((row) => row.id === grantId);
  }

  function creditGrant(grantOrId) {
    const grant = typeof grantOrId === "string" ? grants().find((row) => row.id === grantOrId) : grantOrId;
    if (!grant) return { ok: false, message: "Запись о награде не найдена" };
    if (grant.pointsStatus === "credited") return { ok: true, duplicate: true, grant };
    if (Number(grant.pointsPlanned || 0) <= 0) return { ok: true, grant };
    const reward = rewardById(grant.rewardId);
    const result = points.adjustAccount(
      accountFor({ userKey: grant.userKey, name: grant.userName }),
      Number(grant.pointsPlanned),
      grant.pointsComment || `Награда: ${reward?.title || grant.rewardTitle || "BALI"}`,
      {
        type: "reward_award",
        actionKey: grant.pointsIdempotencyKey,
        metadata: {
          rewardId: grant.rewardId,
          userRewardId: grant.id,
          sourceType: grant.source,
          sourceId: grant.sourceId,
          pointsRule: grant.pointsRule
        }
      }
    );
    if (!result.ok) {
      const failed = updateGrant(grant.id, { pointsStatus: "retry_required", pointsError: result.message || "Ошибка начисления", pointsUpdatedAt: now() });
      auditLog("reward_points_error", {
        rewardId: grant.rewardId,
        userRewardId: grant.id,
        userId: grant.userKey,
        adminId: grant.adminId,
        amount: grant.pointsPlanned,
        sourceType: grant.source,
        sourceId: grant.sourceId,
        metadata: { message: result.message || "Ошибка начисления" }
      });
      return { ok: false, message: result.message || "Не удалось начислить баллы", grant: failed };
    }
    const transaction = result.transaction || points.ledger().find((row) => row.actionKey === grant.pointsIdempotencyKey);
    const credited = updateGrant(grant.id, {
      pointsAwarded: Number(transaction?.amount ?? grant.pointsPlanned),
      pointsStatus: "credited",
      pointsCreditedAt: transaction?.createdAt || now(),
      pointsTransactionId: transaction?.id || "",
      balanceBefore: transaction?.balanceBefore ?? null,
      balanceAfter: transaction?.balanceAfter ?? Number(result.account?.balance || 0),
      pointsError: ""
    });
    auditLog(result.duplicate ? "reward_points_retry_idempotent" : (grant.repeatableOccurrence ? "reward_points_repeat_credited" : "reward_points_credited"), {
      rewardId: grant.rewardId,
      userRewardId: grant.id,
      userId: grant.userKey,
      adminId: grant.adminId,
      amount: credited.pointsAwarded,
      balanceBefore: credited.balanceBefore,
      balanceAfter: credited.balanceAfter,
      transactionId: credited.pointsTransactionId,
      sourceType: grant.source,
      sourceId: grant.sourceId,
      metadata: { idempotencyKey: grant.pointsIdempotencyKey, duplicate: result.duplicate === true }
    });
    addNotification(credited, reward || { id: grant.rewardId, title: grant.rewardTitle || "Награда BALI" });
    return { ok: true, duplicate: result.duplicate === true, grant: credited, transaction };
  }

  function previewGrant(subject, rewardOrId, options = {}) {
    const reward = rewardById(rewardOrId);
    if (!reward?.id) return { ok: false, message: "Награда не найдена" };
    const userKey = subjectKey(subject);
    const previous = grants().filter((row) => row.rewardId === reward.id && row.userKey === userKey);
    const active = previous.find((row) => !row.revokedAt);
    const hasOverride = options.overridePoints !== undefined && options.overridePoints !== null && options.overridePoints !== "";
    if (hasOverride && !can("rewards.award.override_points", options.permissions)) return { ok: false, message: "Нет права менять сумму при выдаче" };
    if (hasOverride && (!Number.isInteger(Number(options.overridePoints)) || Number(options.overridePoints) < 0 || Number(options.overridePoints) > MAX_REWARD_POINTS)) {
      return { ok: false, message: "Изменённая сумма должна быть целым неотрицательным числом" };
    }
    let amount = hasOverride ? integer(options.overridePoints) : reward.pointsRewardAmount;
    let status = "planned";
    if (!reward.awardPointsEnabled || reward.awardPointsMode === "none" || amount <= 0) {
      amount = 0;
      status = "not_applicable";
    } else if (reward.repeatable && reward.awardPointsMode === "first" && previous.some((row) => row.pointsStatus === "credited" && Number(row.pointsAwarded || 0) > 0)) {
      amount = 0;
      status = "skipped_repeat";
    }
    return {
      ok: true,
      reward,
      userKey,
      alreadyHas: !reward.repeatable && Boolean(active),
      amount,
      pointsType: "points",
      status,
      balance: Number(accountFor(subject).balance || 0),
      effect: amount > 0 ? `Пользователь получит награду «${reward.title}» и ${amount} баллов` : `Пользователь получит награду «${reward.title}» без начисления баллов`
    };
  }

  function grantReward(subject, rewardOrId, source = "manual", options = {}) {
    const reward = rewardById(rewardOrId);
    if (!reward?.id) return { ok: false, message: "Награда не найдена" };
    const person = asSubject(subject);
    const key = subjectKey(person);
    const sourceId = String(options.sourceId || options.occurrenceId || (source.startsWith("admin_") ? uid("manual") : source));
    const idempotencyKey = String(options.idempotencyKey || (reward.repeatable
      ? `reward:${reward.id}:user:${key}:source:${source}:${sourceId}`
      : `reward:${reward.id}:user:${key}:once`));
    const previousRows = grants();
    const duplicate = previousRows.find((row) => row.idempotencyKey === idempotencyKey);
    if (duplicate) {
      if (duplicate.pointsStatus === "retry_required" || duplicate.pointsStatus === "pending") {
        const retried = creditGrant(duplicate);
        return { ...retried, duplicate: true };
      }
      const retryLogged = audit().some((row) =>
        row.action === "reward_points_retry_idempotent" &&
        row.userRewardId === duplicate.id &&
        row.sourceId === sourceId
      );
      if (!retryLogged) {
        auditLog("reward_points_retry_idempotent", {
          rewardId: reward.id,
          userRewardId: duplicate.id,
          userId: key,
          adminId: options.adminId || "",
          amount: duplicate.pointsAwarded,
          transactionId: duplicate.pointsTransactionId,
          sourceType: source,
          sourceId,
          metadata: { idempotencyKey }
        });
      }
      return { ok: true, duplicate: true, message: "Операция уже выполнена", grant: duplicate };
    }
    const active = previousRows.find((row) => row.rewardId === reward.id && row.userKey === key && !row.revokedAt);
    if (!reward.repeatable && active) return { ok: false, message: "Награда уже получена", grant: active };
    const preview = previewGrant(person, reward, options);
    if (!preview.ok) return preview;
    const hasOverride = options.overridePoints !== undefined && options.overridePoints !== null && options.overridePoints !== "";
    if (hasOverride && !String(options.overrideReason || "").trim()) return { ok: false, message: "Укажите причину изменения суммы" };
    const grant = {
      id: options.userRewardId || uid("grant"),
      rewardId: reward.id,
      rewardTitle: reward.title,
      userKey: key,
      userName: person.name || "Гость BALI",
      source,
      sourceId,
      idempotencyKey,
      xp: Number(reward.xp || 0),
      repeatableOccurrence: reward.repeatable === true,
      pointsConfiguredAmount: reward.pointsRewardAmount,
      pointsPlanned: preview.amount,
      pointsAwarded: 0,
      pointsType: "points",
      pointsRule: reward.repeatable ? reward.awardPointsMode : "first",
      pointsStatus: preview.status === "planned" ? "pending" : preview.status,
      pointsIdempotencyKey: `reward_points:${options.userRewardId || ""}`,
      pointsComment: reward.pointsHistoryComment || `Награда: ${reward.title}`,
      pointsOverride: hasOverride,
      pointsOverrideReason: hasOverride ? String(options.overrideReason).trim() : "",
      adminId: options.adminId || "",
      earnedAt: now(),
      revokedAt: null
    };
    grant.pointsIdempotencyKey = `reward_points:${grant.id}`;
    const rows = grants();
    rows.unshift(grant);
    saveGrants(rows);
    const currentKeys = identityKeys(game.profile());
    if (currentKeys.has(key)) game.addXp(Number(reward.xp || 0), `Награда: ${reward.title}`);
    else {
      const account = accountFor(person);
      account.xp = Number(account.xp || 0) + Number(reward.xp || 0);
      points.saveAccount(account);
    }
    if (hasOverride) {
      auditLog("reward_points_override", {
        rewardId: reward.id,
        userRewardId: grant.id,
        userId: key,
        adminId: options.adminId || "demo-admin",
        amount: preview.amount,
        sourceType: source,
        sourceId,
        metadata: { configuredAmount: reward.pointsRewardAmount, reason: grant.pointsOverrideReason }
      });
    }
    if (preview.amount <= 0) {
      addNotification(grant, reward);
      return { ok: true, grant };
    }
    const credited = creditGrant(grant);
    return credited.ok ? { ok: true, duplicate: credited.duplicate, grant: credited.grant, transaction: credited.transaction } : credited;
  }

  function previewBulk(subjects, rewardOrId, options = {}) {
    const reward = rewardById(rewardOrId);
    if (!reward?.id) return { ok: false, message: "Награда не найдена" };
    const rows = (subjects || []).map((subject) => ({ subject, preview: previewGrant(subject, reward, options) }));
    const eligible = rows.filter((row) => row.preview.ok && !row.preview.alreadyHas);
    const skipped = rows.length - eligible.length;
    const total = eligible.reduce((sum, row) => sum + Number(row.preview.amount || 0), 0);
    return {
      ok: true,
      reward,
      recipients: rows.length,
      eligible: eligible.length,
      skipped,
      pointsEach: eligible.length ? Math.max(...eligible.map((row) => Number(row.preview.amount || 0))) : 0,
      maxTotal: total,
      rows
    };
  }
  function bulkGrant(subjects, rewardOrId, options = {}) {
    const preview = previewBulk(subjects, rewardOrId, options);
    if (!preview.ok) return preview;
    const batchId = String(options.batchId || uid("reward-batch"));
    const results = [];
    for (const row of preview.rows) {
      if (row.preview.alreadyHas) {
        results.push({ ok: false, skipped: true, message: "Награда уже получена", userKey: row.preview.userKey });
        continue;
      }
      results.push(grantReward(row.subject, preview.reward, "admin_bulk", {
        ...options,
        sourceId: `${batchId}:${row.preview.userKey}`,
        idempotencyKey: `reward:${preview.reward.id}:batch:${batchId}:user:${row.preview.userKey}`
      }));
    }
    auditLog("reward_bulk_award", {
      rewardId: preview.reward.id,
      adminId: options.adminId || "demo-admin",
      amount: results.reduce((sum, row) => sum + Number(row.grant?.pointsAwarded || 0), 0),
      sourceType: "admin_bulk",
      sourceId: batchId,
      metadata: {
        recipients: preview.recipients,
        granted: results.filter((row) => row.ok && !row.duplicate).length,
        skipped: results.filter((row) => row.skipped || row.duplicate).length
      }
    });
    return { ok: true, batchId, preview, results };
  }

  function revokeReward(grantId, options = {}) {
    if (!can("rewards.points.revoke", options.permissions)) return { ok: false, message: "Недостаточно прав для отзыва баллов" };
    const grant = grants().find((row) => row.id === grantId);
    if (!grant) return { ok: false, message: "Выданная награда не найдена" };
    if (grant.revokedAt) return { ok: true, duplicate: true, grant };
    const reward = rewardById(grant.rewardId);
    const shouldDeduct = reward?.deductPointsOnRevoke === true && Number(grant.pointsAwarded || 0) > 0;
    let deduction = null;
    if (shouldDeduct) {
      deduction = points.adjustAccount(
        accountFor({ userKey: grant.userKey, name: grant.userName }),
        -Number(grant.pointsAwarded),
        `Отзыв награды: ${reward.title}`,
        {
          type: "reward_revoke",
          actionKey: `reward_points_revoke:${grant.id}`,
          metadata: {
            rewardId: reward.id,
            userRewardId: grant.id,
            originalTransactionId: grant.pointsTransactionId || ""
          }
        }
      );
      if (!deduction.ok) return { ok: false, message: deduction.message || "Не удалось списать связанные баллы", grant };
    }
    const revoked = updateGrant(grant.id, {
      revokedAt: now(),
      revokedBy: options.adminId || "demo-admin",
      revokeReason: String(options.reason || "Отзыв администратором"),
      pointsRevokeStatus: shouldDeduct ? (deduction.partial ? "partially_deducted" : "deducted") : "not_deducted",
      pointsDeducted: shouldDeduct ? Math.abs(Number(deduction.delta || 0)) : 0,
      pointsRevokeTransactionId: deduction?.transaction?.id || ""
    });
    auditLog(shouldDeduct ? "reward_points_revoked" : "reward_revoked_without_points", {
      rewardId: grant.rewardId,
      userRewardId: grant.id,
      userId: grant.userKey,
      adminId: options.adminId || "demo-admin",
      amount: shouldDeduct ? Math.abs(Number(deduction.delta || 0)) : 0,
      balanceBefore: deduction?.transaction?.balanceBefore ?? null,
      balanceAfter: deduction?.transaction?.balanceAfter ?? null,
      transactionId: deduction?.transaction?.id || "",
      sourceType: "admin_revoke",
      sourceId: grant.id,
      metadata: { originalTransactionId: grant.pointsTransactionId || "", partial: deduction?.partial === true }
    });
    return { ok: true, grant: revoked, deduction };
  }

  function earnedRewardIds(subject = game.profile()) {
    const keys = identityKeys(subject);
    return new Set(grants().filter((row) => !row.revokedAt && keys.has(String(row.userKey))).map((row) => row.rewardId));
  }
  function grantsFor(subject = game.profile()) {
    const keys = identityKeys(subject);
    return grants().filter((row) => keys.has(String(row.userKey)));
  }
  function rewardStats(rewardId) {
    const rows = grants().filter((row) => row.rewardId === rewardId && row.pointsStatus === "credited");
    return {
      totalPoints: rows.reduce((sum, row) => sum + Number(row.pointsAwarded || 0), 0),
      users: new Set(rows.map((row) => row.userKey)).size,
      operations: rows.length
    };
  }
  function yearsSince(dateValue) {
    if (!dateValue) return 0;
    const start = new Date(dateValue), today = new Date();
    let years = today.getFullYear() - start.getFullYear();
    const anniversary = new Date(today.getFullYear(), start.getMonth(), start.getDate());
    if (today < anniversary) years -= 1;
    return Math.max(0, years);
  }
  function hasEventCheckin(subject, eventId) {
    const keys = identityKeys(subject), rows = Object.values(read("bali_event_checkins_v1", {}));
    return rows.some((row) => String(row.event_id || "") === String(eventId || "") && (keys.has(String(row.user_key || "")) || String(row.telegram_id || "") === String(asSubject(subject).telegramId || "")));
  }
  function currentWeekId() {
    const date = new Date(), day = (date.getDay() + 6) % 7;
    date.setDate(date.getDate() - day);
    return date.toISOString().slice(0, 10);
  }
  function evaluateRewards(subject = game.profile()) {
    const person = asSubject(subject), earned = earnedRewardIds(person), awarded = [];
    for (const reward of rewards().filter((row) => row.active !== false && (row.repeatable || !earned.has(row.id)))) {
      let eligible = false, sourceId = "eligibility";
      if (reward.conditionType === "visits") {
        eligible = Number(person.visits || 0) >= Number(reward.threshold || 1);
        sourceId = `visits:${Math.floor(Number(person.visits || 0) / Number(reward.threshold || 1))}`;
      }
      if (reward.conditionType === "anniversary") {
        const years = yearsSince(person.createdAt);
        eligible = years >= Number(reward.threshold || 1);
        sourceId = `anniversary:${years}`;
      }
      if (reward.conditionType === "event") {
        eligible = hasEventCheckin(person, reward.eventId);
        sourceId = `event:${reward.eventId}`;
      }
      if (reward.conditionType === "ranking") {
        const rank = Number(person.weeklyRank || person.rank || 0);
        eligible = rank > 0 && rank <= Number(reward.threshold || 10);
        sourceId = `ranking:${person.rankingWeekId || currentWeekId()}`;
      }
      if (reward.conditionType === "referrals") {
        const count = Number(person.referrals || person.invitedFriends || 0);
        eligible = count >= Number(reward.threshold || 1);
        sourceId = `referrals:${Math.floor(count / Number(reward.threshold || 1))}`;
      }
      if (eligible) {
        const result = grantReward(person, reward, `auto_${reward.conditionType}`, { sourceId });
        if (result.ok && !result.duplicate) awarded.push({ ...reward, grant: result.grant });
      }
    }
    return awarded;
  }

  window.BaliBeta4Loyalty = {
    KEYS,
    DEFAULT_CONFIG,
    REWARD_POINT_PERMISSIONS,
    MAX_REWARD_POINTS,
    config,
    saveConfig,
    spendPoints,
    chipBalance,
    setChipBalance,
    adjustChips,
    exchangeForChips,
    buyVipWithPoints,
    normalizeReward,
    rewards,
    saveRewards,
    upsertReward,
    removeReward,
    grants,
    grantsFor,
    grantReward,
    creditGrant,
    previewGrant,
    previewBulk,
    bulkGrant,
    revokeReward,
    earnedRewardIds,
    evaluateRewards,
    rewardStats,
    audit,
    notifications,
    markNotificationRead,
    yearsSince
  };
})();
