(() => {
  if (window.__BALI_REFERRAL_COMMISSION__) return;
  window.__BALI_REFERRAL_COMMISSION__ = true;

  const points = window.BaliPoints;
  if (!points?.add || !points?.profile) return;

  const RATE = 0.10;
  const PENDING_KEY = "bali_referral_commissions_pending_v1";
  const PAID_KEY = "bali_referral_commissions_paid_v1";

  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  };
  const write = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
    return value;
  };

  function currentReferralCode() {
    return String(new URLSearchParams(location.search).get("ref") || "").trim();
  }

  function attachReferrer() {
    const ref = currentReferralCode();
    if (!ref) return;
    const me = points.profile();
    if (String(me.code || me.userKey || "") === ref || me.referredByCode) return;
    const linked = { ...me, referredByCode: ref, referredAt: new Date().toISOString() };
    points.write(points.keys.profile, linked);
    points.saveAccount(linked);
  }

  function referrerFor(user) {
    const code = String(user?.referredByCode || "").trim();
    if (!code) return null;
    return Object.values(points.accounts?.() || {}).find(item => String(item.code || item.userKey || "") === code) || null;
  }

  function commissionAmount(amount) {
    return Math.floor(Math.max(0, Number(amount || 0)) * RATE);
  }

  function payCommission(user, amount, sourceTitle, sourceKey) {
    const commission = commissionAmount(amount);
    if (!commission) return;

    const uniqueKey = `${user.userKey || user.code}:${sourceKey || sourceTitle}:${amount}`;
    const paid = read(PAID_KEY, {});
    if (paid[uniqueKey]) return;

    const referrer = referrerFor(user);
    if (referrer && points.adjustAccount) {
      points.adjustAccount(referrer, commission, `10% от баллов приглашённого: ${sourceTitle || "активность BALI"}`);
      paid[uniqueKey] = {
        invitedUserKey: user.userKey || user.code,
        referrerKey: referrer.userKey || referrer.code,
        sourceAmount: Number(amount || 0),
        commission,
        createdAt: new Date().toISOString()
      };
      write(PAID_KEY, paid);
      return;
    }

    const pending = read(PENDING_KEY, []);
    pending.push({
      invitedUserKey: user.userKey || user.code,
      referredByCode: user.referredByCode,
      sourceAmount: Number(amount || 0),
      commission,
      sourceTitle,
      sourceKey,
      createdAt: new Date().toISOString()
    });
    write(PENDING_KEY, pending.slice(-500));
  }

  const originalAdd = points.add.bind(points);
  points.add = function(type, amount, title, actionKey) {
    const userBefore = points.profile();
    const credited = originalAdd(type, amount, title, actionKey);
    if (credited && Number(amount || 0) > 0 && type !== "referral_commission") {
      payCommission(userBefore, amount, title, actionKey || `${type}-${Date.now()}`);
    }
    return credited;
  };

  attachReferrer();
  window.BaliReferralCommission = { rate: RATE, attachReferrer, commissionAmount, payCommission };
})();