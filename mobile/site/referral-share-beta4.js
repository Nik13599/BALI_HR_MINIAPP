(() => {
  if (window.__BALI_REFERRAL_SHARE__) return;
  window.__BALI_REFERRAL_SHARE__ = true;

  const points = window.BaliPoints;
  const tg = window.Telegram?.WebApp;
  const REFERRAL_CLAIMS_KEY = "bali_referral_claims_v1";
  const SHARE_ACTIONS_KEY = "bali_event_share_actions_v1";

  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  };
  const write = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
    return value;
  };
  const toast = message => {
    const el = document.getElementById("toast");
    if (el) {
      el.textContent = message;
      el.classList.add("show");
      clearTimeout(toast.timer);
      toast.timer = setTimeout(() => el.classList.remove("show"), 2600);
      return;
    }
    try { tg?.showAlert?.(message); } catch {}
  };

  function profile() {
    return points?.profile?.() || { code: "BALI-GUEST", userKey: "guest", balance: 0 };
  }

  function referralCode() {
    return String(profile().code || profile().userKey || "BALI-GUEST").replace(/[^a-zA-Z0-9_-]/g, "");
  }

  function appBaseUrl() {
    const url = new URL(location.href);
    url.hash = "";
    url.search = "";
    return url.toString();
  }

  function referralUrl() {
    const url = new URL(appBaseUrl());
    url.searchParams.set("ref", referralCode());
    return url.toString();
  }

  function eventShareUrl(eventId) {
    const url = new URL(appBaseUrl());
    url.searchParams.set("event", String(eventId || ""));
    url.searchParams.set("ref", referralCode());
    return url.toString();
  }

  function telegramShare(url, text) {
    const share = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
    try {
      if (tg?.openTelegramLink) tg.openTelegramLink(share);
      else location.href = share;
    } catch {
      window.open(share, "_blank", "noopener,noreferrer");
    }
  }

  async function sharePoster(item, url, text) {
    const imageUrl = item.image_url || item.image || item.poster_url || item.poster || "";
    if (imageUrl && navigator.share && navigator.canShare) {
      try {
        const absoluteUrl = new URL(imageUrl, location.href).toString();
        const response = await fetch(absoluteUrl, { mode: "cors", credentials: "omit" });
        if (response.ok) {
          const blob = await response.blob();
          const extension = (blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
          const file = new File([blob], `bali-event.${extension}`, { type: blob.type || "image/jpeg" });
          const payload = { title: item.title || "BALI", text: `${text}\n${url}`, files: [file] };
          if (navigator.canShare(payload)) {
            await navigator.share(payload);
            return true;
          }
        }
      } catch (error) {
        if (error?.name === "AbortError") return false;
        console.warn("BALI poster share fallback", error);
      }
    }

    const fallbackText = imageUrl ? `${text}\nАфиша: ${new URL(imageUrl, location.href).toString()}` : text;
    telegramShare(url, fallbackText);
    return true;
  }

  function applyReferralFromUrl() {
    const params = new URLSearchParams(location.search);
    const ref = String(params.get("ref") || "").trim();
    if (!ref || ref === referralCode()) return;

    const me = profile();
    const claimKey = `${ref}:${me.userKey || me.code}`;
    const claims = read(REFERRAL_CLAIMS_KEY, {});
    if (claims[claimKey]) return;

    const accounts = points?.accounts?.() || {};
    const referrer = Object.values(accounts).find(item => String(item.code || item.userKey || "") === ref);
    const reward = Number(points?.settings?.().referral || 50);

    if (referrer && points?.adjustAccount) {
      points.adjustAccount(referrer, reward, `Приглашён новый пользователь ${me.name || "BALI"}`);
      claims[claimKey] = { ref, invitedUserKey: me.userKey || me.code, reward, createdAt: new Date().toISOString() };
      write(REFERRAL_CLAIMS_KEY, claims);
      toast(`Пригласившему начислено ${reward} BALI-баллов`);
    } else {
      claims[claimKey] = { ref, invitedUserKey: me.userKey || me.code, reward, pending: true, createdAt: new Date().toISOString() };
      write(REFERRAL_CLAIMS_KEY, claims);
    }
  }

  function inviteFriend() {
    const reward = Number(points?.settings?.().referral || 50);
    telegramShare(referralUrl(), `Присоединяйся к BALI! За приглашение начисляются ${reward} BALI-баллов.`);
  }

  function eventModel(eventId) {
    return read("bali_events_v2", []).find(item => String(item.id) === String(eventId)) || {};
  }

  async function shareEvent(eventId) {
    if (!eventId) return;
    const item = eventModel(eventId);
    const title = item.title || document.getElementById("eventDialogTitle")?.textContent || "мероприятие BALI";
    const reward = Number(points?.settings?.().eventShare || 10);
    const shared = await sharePoster(item, eventShareUrl(eventId), `Смотри мероприятие «${title}» в BALI`);
    if (!shared) return;

    const actions = read(SHARE_ACTIONS_KEY, {});
    const key = `${profile().userKey || profile().code}:${eventId}`;
    if (!actions[key]) {
      const credited = points?.add?.("event_share", reward, `Репост мероприятия «${title}»`, `event-share-${key}`);
      actions[key] = { eventId, reward, credited: Boolean(credited), createdAt: new Date().toISOString() };
      write(SHARE_ACTIONS_KEY, actions);
      if (credited) toast(`Начислено ${reward} BALI-баллов за репост`);
    } else {
      toast("Этим мероприятием уже делились — повторные баллы не начисляются");
    }
  }

  function styles() {
    if (document.getElementById("baliReferralShareStyles")) return;
    const style = document.createElement("style");
    style.id = "baliReferralShareStyles";
    style.textContent = `
      .bali-invite-card{margin-top:14px;padding:16px;border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.04)}
      .bali-invite-card h3{margin:0 0 6px;font-size:14px}.bali-invite-card p{margin:0 0 12px;color:var(--muted,#9da49f);font-size:10px;line-height:1.55}
      .bali-share-event{width:100%;margin-top:10px;min-height:44px;padding:0 12px;border:1px solid rgba(255,255,255,.18);border-radius:13px;background:rgba(255,255,255,.06);color:#fff;font-weight:800}
      .event .bali-card-share{position:absolute;right:10px;top:10px;z-index:3;width:42px;height:42px;border:1px solid rgba(255,255,255,.24);border-radius:50%;background:rgba(8,10,10,.78);color:#fff;font-size:17px}
      .event{position:relative}
    `;
    document.head.appendChild(style);
  }

  function decorateProfile() {
    const screen = document.querySelector('[data-screen="profile"] .inner');
    if (!screen || screen.querySelector("[data-bali-invite-card]")) return;
    const reward = Number(points?.settings?.().referral || 50);
    const card = document.createElement("section");
    card.className = "bali-invite-card";
    card.dataset.baliInviteCard = "1";
    card.innerHTML = `<h3>Приглашай друзей — получай баллы</h3><p>Выбери человека в Telegram и отправь ему персональную ссылку. После его первого входа тебе начислится ${reward} BALI-баллов.</p><button type="button" class="primary full" data-invite-friend>Пригласить друга и получить ${reward} баллов</button>`;
    const wallet = screen.querySelector(".wallet");
    if (wallet) wallet.insertAdjacentElement("afterend", card);
    else screen.appendChild(card);
  }

  function decorateEventDialog() {
    const social = document.getElementById("eventSocial");
    if (!social || social.querySelector("[data-share-current-event]")) return;
    const reward = Number(points?.settings?.().eventShare || 10);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "bali-share-event";
    button.dataset.shareCurrentEvent = "1";
    button.textContent = `↗ Делись мероприятием — получай ${reward} баллов`;
    social.appendChild(button);
  }

  function decorateEventCards() {
    document.querySelectorAll(".event[data-event]").forEach(card => {
      if (card.querySelector("[data-share-event-card]")) return;
      const reward = Number(points?.settings?.().eventShare || 10);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "bali-card-share";
      button.dataset.shareEventCard = card.dataset.event;
      button.setAttribute("aria-label", `Поделиться афишей и получить ${reward} баллов`);
      button.title = `Поделиться афишей и получить ${reward} баллов`;
      button.textContent = "↗";
      card.appendChild(button);
    });
  }

  function decorate() {
    styles();
    decorateProfile();
    decorateEventDialog();
    decorateEventCards();
  }

  document.addEventListener("click", event => {
    const invite = event.target.closest("[data-invite-friend]");
    if (invite) {
      event.preventDefault();
      inviteFriend();
      return;
    }

    const cardShare = event.target.closest("[data-share-event-card]");
    if (cardShare) {
      event.preventDefault();
      event.stopPropagation();
      shareEvent(cardShare.dataset.shareEventCard);
      return;
    }

    const dialogShare = event.target.closest("[data-share-current-event]");
    if (dialogShare) {
      event.preventDefault();
      const eventId = document.querySelector('#bookingForm [name="event_id"]')?.value;
      shareEvent(eventId);
    }
  }, true);

  const app = document.getElementById("app");
  const observer = app ? new MutationObserver(() => requestAnimationFrame(decorate)) : null;
  observer?.observe(app, { childList: true, subtree: true });
  ["bali:full-demo-ready", "bali:full-demo-enhancements-ready", "bali:data-changed", "bali:beta4-changed"].forEach(name => window.addEventListener(name, decorate));

  applyReferralFromUrl();
  decorate();
  window.BaliReferralShare = { inviteFriend, shareEvent, referralUrl, eventShareUrl, applyReferralFromUrl, decorate };
})();
