(() => {
  "use strict";

  const STORAGE_KEY = "bali_clans_integrated_demo_v1";
  const USER_KEY = "tg:1001";
  const ADMIN = { id:"admin-beta", email:"beta@bali.test", role:"superadmin", status:"active" };
  const PERMISSION_KEYS = [
    "announcement.create",
    "event.attach",
    "event.detach",
    "event.set_primary",
    "message.create",
    "message.delete_any",
    "message.reply",
    "pin.create",
    "poll.cancel",
    "poll.create",
    "poll.delete",
    "poll.finish",
    "poll.vote",
    "report.create",
    "restriction.manage"
  ];
  const USER_PERMISSIONS = PERMISSION_KEYS.filter(key => key !== "restriction.manage");
  const CORPORATE_CLAN_IDS = new Set([
    "clan-temple",
    "clan-neon-dynasty",
    "clan-night-orchids",
    "clan-sunset-family",
    "clan-monsoon"
  ]);
  const eventImage = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='420'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' x2='1'%3E%3Cstop stop-color='%23130b05'/%3E%3Cstop offset='.55' stop-color='%23643a10'/%3E%3Cstop offset='1' stop-color='%23080604'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='800' height='420' fill='url(%23g)'/%3E%3Ccircle cx='620' cy='120' r='95' fill='%23f1b64b' opacity='.18'/%3E%3Cpath d='M0 350L170 190 300 330 465 155 800 360V420H0Z' fill='%23070504' opacity='.85'/%3E%3Ctext x='48' y='86' fill='%23f4c66c' font-family='serif' font-size='54'%3EBALI NIGHT%3C/text%3E%3C/svg%3E";

  const nowIso = (offsetMinutes = 0) => new Date(Date.now() + offsetMinutes * 60_000).toISOString();
  const clone = value => JSON.parse(JSON.stringify(value));
  const uid = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const clanCategory = (type, id = "") => (
    type === "corporate" || type === "vip" || CORPORATE_CLAN_IDS.has(String(id))
      ? "corporate"
      : "user"
  );

  function rankingClan(id, name, clanType, ratingPoints, leaderName, memberCount) {
    const leaderKey = `demo:${id}:leader`;
    return {
      id,
      name,
      clan_type:clanType,
      rating_points:ratingPoints,
      leader_user_key:leaderKey,
      enabled:true,
      read_only:false,
      own_delete_window_seconds:900,
      unread_count:0,
      notificationPreference:{ muted_until:null, announcements_only:false },
      members:Array.from({ length:memberCount }, (_row, index) => ({
        user_key:index === 0 ? leaderKey : `demo:${id}:member:${index}`,
        name:index === 0 ? leaderName : `Участник ${index + 1}`,
        username:"",
        role:index === 0 ? "leader" : "member",
        status:"active"
      })),
      messages:[],
      polls:[],
      events:[],
      announcements:[],
      pins:[],
      grants:[],
      restrictions:[],
      reports:[]
    };
  }

  function seed() {
    return {
      version: 3,
      adminLoggedIn: true,
      currentUser: {
        id: USER_KEY,
        userKey: USER_KEY,
        telegramUserId: "1001",
        name: "Александр",
        username: "bali_beta",
        status: "active"
      },
      availableEvents: [
        {
          id: "event-jungle",
          title: "Jungle Night",
          event_date: nowIso(24 * 60).slice(0, 10),
          event_time: "23:00",
          description: "Live show, DJ set и специальная программа BALI.",
          image_url: eventImage,
          active: true
        },
        {
          id: "event-temple",
          title: "Golden Temple",
          event_date: nowIso(4 * 24 * 60).slice(0, 10),
          event_time: "22:30",
          description: "Закрытая клубная ночь для участников BALI.",
          image_url: eventImage,
          active: true
        }
      ],
      rateLimits: [
        { bucket:"message.create", limit_count:8, window_seconds:30, enabled:true },
        { bucket:"message.repeat", limit_count:2, window_seconds:60, enabled:true },
        { bucket:"message.mentions", limit_count:5, window_seconds:60, enabled:true },
        { bucket:"poll.vote", limit_count:10, window_seconds:60, enabled:true },
        { bucket:"report.create", limit_count:3, window_seconds:300, enabled:true }
      ],
      audit: [
        {
          id:"audit-seed",
          created_at:nowIso(-25),
          actor_type:"system",
          actor_id:"beta-seed",
          permission_key:"",
          action:"beta.reset",
          target_type:"environment",
          target_id:"clan-chat-beta",
          request_id:"beta-initial",
          reason:"Исходное тестовое состояние"
        }
      ],
      clans: [
        {
          id:"clan-night",
          name:"BALI NIGHT LEGENDS",
          clan_type:"user",
          rating_points:12840,
          leader_user_key:USER_KEY,
          enabled:true,
          read_only:false,
          own_delete_window_seconds:900,
          unread_count:3,
          notificationPreference:{ muted_until:null, announcements_only:false },
          members:[
            { user_key:USER_KEY, name:"Александр", username:"bali_beta", role:"leader", status:"active" },
            { user_key:"tg:1002", name:"Анна Мороз", username:"anna_neon", role:"deputy", status:"active" },
            { user_key:"tg:1003", name:"Максим Орлов", username:"dj_sunset", role:"moderator", status:"active" },
            { user_key:"tg:1004", name:"София Волкова", username:"sofia_bali", role:"member", status:"active" },
            { user_key:"tg:1005", name:"Артём Левин", username:"artem_night", role:"member", status:"active" }
          ],
          messages:[
            {
              id:"msg-welcome",
              author_user_key:null,
              author_name:"BALI",
              body:"Добро пожаловать в закрытый чат клана. Здесь находятся только действующие участники.",
              message_type:"announcement",
              created_at:nowIso(-180),
              deleted_at:null,
              reply_to_message_id:null
            },
            {
              id:"msg-anna",
              author_user_key:"tg:1002",
              author_name:"Анна Мороз",
              body:"Кто будет на Jungle Night в пятницу?",
              message_type:"text",
              created_at:nowIso(-48),
              deleted_at:null,
              reply_to_message_id:null
            },
            {
              id:"msg-max",
              author_user_key:"tg:1003",
              author_name:"Максим Орлов",
              body:"Буду к 23:00. Предлагаю встретиться у VIP-входа.",
              message_type:"text",
              created_at:nowIso(-41),
              deleted_at:null,
              reply_to_message_id:"msg-anna"
            },
            {
              id:"msg-owner",
              author_user_key:USER_KEY,
              author_name:"Александр",
              body:"Отлично, закрепил событие и запустил опрос.",
              message_type:"text",
              created_at:nowIso(-34),
              deleted_at:null,
              reply_to_message_id:null
            }
          ],
          polls:[
            {
              id:"poll-jungle",
              question:"Идём на Jungle Night?",
              allow_multiple:false,
              status:"active",
              created_at:nowIso(-30),
              options:[
                { id:"poll-jungle-yes", label:"Буду", votes:3 },
                { id:"poll-jungle-later", label:"Присоединюсь позже", votes:1 },
                { id:"poll-jungle-no", label:"Не смогу", votes:0 }
              ],
              votes:{ [USER_KEY]:["poll-jungle-yes"] }
            }
          ],
          events:[
            {
              id:"attachment-jungle",
              event_id:"event-jungle",
              title:"Jungle Night",
              event_date:nowIso(24 * 60).slice(0, 10),
              event_time:"23:00",
              description:"Live show, DJ set и специальная программа BALI.",
              image_url:eventImage,
              active:true,
              is_primary:true,
              created_at:nowIso(-32)
            }
          ],
          announcements:[
            {
              id:"announcement-meeting",
              title:"Сбор клана",
              body:"Встречаемся в пятницу в 22:45 у VIP-входа.",
              official:true,
              published_at:nowIso(-28),
              created_at:nowIso(-28)
            }
          ],
          pins:[
            { id:"pin-jungle", target_type:"event", target_id:"attachment-jungle", created_at:nowIso(-27) }
          ],
          grants:[
            {
              id:"grant-moderate",
              user_key:"tg:1003",
              user_name:"Максим Орлов",
              permission_key:"message.delete_any",
              effect:"allow",
              reason:"Модерация beta-чата",
              expires_at:nowIso(7 * 24 * 60),
              revoked_at:null,
              created_at:nowIso(-120)
            }
          ],
          restrictions:[],
          reports:[
            {
              id:"report-1",
              message_id:"msg-max",
              reporter_user_key:"tg:1004",
              reporter_name:"София Волкова",
              message_author_name:"Максим Орлов",
              reason:"Тестовая жалоба для проверки модерации",
              status:"new",
              resolution:null,
              created_at:nowIso(-20)
            }
          ]
        },
        {
          id:"clan-temple",
          name:"GOLDEN TEMPLE",
          clan_type:"corporate",
          rating_points:10920,
          leader_user_key:"tg:2001",
          enabled:true,
          read_only:true,
          own_delete_window_seconds:600,
          unread_count:1,
          notificationPreference:{ muted_until:null, announcements_only:true },
          members:[
            { user_key:USER_KEY, name:"Александр", username:"bali_beta", role:"member", status:"active" },
            { user_key:"tg:2001", name:"Neon Queen", username:"neon_queen", role:"leader", status:"active" },
            { user_key:"tg:2002", name:"DJ Sunset", username:"sunset", role:"member", status:"active" }
          ],
          messages:[
            {
              id:"msg-temple",
              author_user_key:"tg:2001",
              author_name:"Neon Queen",
              body:"Чат временно работает только для чтения. Следите за объявлениями.",
              message_type:"announcement",
              created_at:nowIso(-55),
              deleted_at:null,
              reply_to_message_id:null
            }
          ],
          polls:[],
          events:[],
          announcements:[
            {
              id:"announcement-temple",
              title:"Режим чтения",
              body:"Новые сообщения временно отключены главным клана.",
              official:false,
              published_at:nowIso(-50),
              created_at:nowIso(-50)
            }
          ],
          pins:[],
          grants:[],
          restrictions:[],
          reports:[]
        },
        rankingClan("clan-jungle-spirit", "JUNGLE SPIRIT", "user", 15640, "Maya Flame", 38),
        rankingClan("clan-neon-dynasty", "NEON DYNASTY", "corporate", 14310, "Neon Queen", 31),
        rankingClan("clan-bali-wave", "BALI WAVE", "user", 11780, "Ocean Alex", 27),
        rankingClan("clan-night-orchids", "NIGHT ORCHIDS", "corporate", 9650, "Lana Noir", 24),
        rankingClan("clan-lava-tribe", "LAVA TRIBE", "user", 8420, "Fire Keeper", 19),
        rankingClan("clan-sunset-family", "SUNSET FAMILY", "corporate", 7310, "DJ Sunset", 17),
        rankingClan("clan-temple-guard", "TEMPLE GUARD", "user", 6890, "Golden Boy", 15),
        rankingClan("clan-monsoon", "MONSOON CREW", "corporate", 5240, "Rain Maker", 12)
      ]
    };
  }

  function activeAppUser() {
    const social = window.BaliBeta4Social?.profile?.();
    const demo = window.BaliDemo?.activeUser?.();
    const game = window.BaliBeta4Game?.profile?.();
    const source = social || demo || game || {};
    return {
      id:USER_KEY,
      userKey:USER_KEY,
      telegramUserId:String(source.telegramId || demo?.telegramId || "1001"),
      name:String(source.name || "Гость BALI"),
      username:String(source.username || demo?.username || "").replace(/^@/, ""),
      status:"active"
    };
  }

  function syncActiveIdentity(state) {
    const current = activeAppUser();
    state.currentUser = current;
    state.clans.forEach(clan => {
      const member = clan.members.find(row => row.user_key === USER_KEY);
      if (!member) return;
      member.name = current.name;
      member.username = current.username;
      clan.messages
        .filter(row => row.author_user_key === USER_KEY)
        .forEach(row => { row.author_name = current.name; });
    });
    return state;
  }

  function upgradeState(state) {
    if (!state || !Array.isArray(state.clans)) return null;
    state.version = 3;
    state.clans.forEach(clan => {
      clan.clan_type = clanCategory(clan.clan_type, clan.id);
      clan.members = Array.isArray(clan.members) ? clan.members : [];
      clan.members.forEach(member => { member.clan_type = clan.clan_type; });
    });
    const activeMemberships = new Set();
    state.clans
      .flatMap(clan => clan.members
        .filter(member => member.status === "active")
        .map(member => ({ clan, member })))
      .forEach(({ clan, member }) => {
        const key = `${member.user_key}:${clan.clan_type}`;
        if (!activeMemberships.has(key)) {
          activeMemberships.add(key);
          return;
        }
        member.status = "left";
      });
    return state;
  }

  function read() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      const upgraded = upgradeState(parsed);
      if (upgraded) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(upgraded));
        return syncActiveIdentity(upgraded);
      }
    } catch {
      // Invalid beta data is replaced by a known fixture.
    }
    const initial = seed();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return syncActiveIdentity(initial);
  }

  function write(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent("bali:clan-beta-updated", {
      detail:{ updatedAt:new Date().toISOString() }
    }));
    return state;
  }

  function jsonBody(options) {
    if (!options?.body) return {};
    if (typeof options.body === "object") return options.body;
    try { return JSON.parse(options.body); } catch { return {}; }
  }

  function error(message, status = 400) {
    const problem = new Error(message);
    problem.status = status;
    throw problem;
  }

  function clanById(state, id) {
    const clan = state.clans.find(row => row.id === id);
    if (!clan) error("Клан не найден", 404);
    return clan;
  }

  function addAudit(state, action, targetType, targetId, reason = "", permissionKey = "") {
    state.audit.unshift({
      id:uid("audit"),
      created_at:new Date().toISOString(),
      actor_type:"admin",
      actor_id:ADMIN.email,
      permission_key:permissionKey,
      action,
      target_type:targetType,
      target_id:targetId,
      request_id:uid("beta-request"),
      reason
    });
  }

  function userMessages(clan) {
    return clan.messages
      .filter(message => !message.deleted_at)
      .map(message => {
        const replySource = message.reply_to_message_id
          ? clan.messages.find(row => row.id === message.reply_to_message_id)
          : null;
        return {
          id:message.id,
          body:message.body,
          messageType:message.message_type,
          createdAt:message.created_at,
          deleted:false,
          author:message.author_user_key ? {
            id:message.author_user_key,
            name:message.author_name,
            username:clan.members.find(row => row.user_key === message.author_user_key)?.username || ""
          } : { id:"system", name:"BALI", username:"" },
          reply:replySource ? {
            id:replySource.id,
            body:replySource.body,
            authorName:replySource.author_name
          } : null
        };
      });
  }

  function userPermissions(clan) {
    const member = clan.members.find(row => row.user_key === USER_KEY);
    if (!clan.enabled) return [];
    if (member?.role === "leader") {
      return USER_PERMISSIONS.filter(key => key !== "message.create" || !clan.read_only);
    }
    const base = ["message.reply", "poll.vote", "report.create"];
    if (!clan.read_only) base.push("message.create");
    return [...new Set([
      ...base,
      ...clan.grants
        .filter(row => row.user_key === USER_KEY && row.effect === "allow" && !row.revoked_at)
        .map(row => row.permission_key)
    ])];
  }

  function clanBundle(clan) {
    return {
      clan:{ id:clan.id, name:clan.name, clanType:clan.clan_type, role:clan.members.find(row => row.user_key === USER_KEY)?.role || "member" },
      chat:{
        id:`chat-${clan.id}`,
        enabled:clan.enabled,
        readOnly:clan.read_only,
        ownDeleteWindowSeconds:clan.own_delete_window_seconds,
        settings:{ beta:true }
      },
      permissions:userPermissions(clan),
      messages:userMessages(clan),
      pagination:{ hasMore:false, nextBefore:null },
      polls:clan.polls.map(poll => ({
        id:poll.id,
        question:poll.question,
        allow_multiple:poll.allow_multiple,
        status:poll.status,
        created_at:poll.created_at,
        options:clone(poll.options),
        myOptionIds:clone(poll.votes[USER_KEY] || [])
      })),
      events:clone(clan.events),
      announcements:clone(clan.announcements),
      pins:clone(clan.pins),
      notificationPreference:clone(clan.notificationPreference)
    };
  }

  function adminChatRow(clan) {
    const activePolls = clan.polls.filter(row => row.status === "active").length;
    const openReports = clan.reports.filter(row => row.status === "new").length;
    const latest = clan.messages.map(row => row.created_at).sort().at(-1) || null;
    return {
      clan_id:clan.id,
      name:clan.name,
      clan_type:clan.clan_type,
      status:"active",
      rating_points:Number(clan.rating_points || 0),
      leader_user_key:clan.leader_user_key,
      leader_name:clan.members.find(row => row.user_key === clan.leader_user_key)?.name || "",
      chat_id:`chat-${clan.id}`,
      enabled:clan.enabled,
      read_only:clan.read_only,
      member_count:clan.members.filter(row => row.status === "active").length,
      message_count:clan.messages.length,
      last_message_at:latest,
      active_poll_count:activePolls,
      attached_event_count:clan.events.length,
      open_report_count:openReports
    };
  }

  function adminDetail(clan) {
    return {
      chat:{
        id:`chat-${clan.id}`,
        clan_id:clan.id,
        clan_name:clan.name,
        clan_type:clan.clan_type,
        rating_points:Number(clan.rating_points || 0),
        leader_user_key:clan.leader_user_key,
        enabled:clan.enabled,
        read_only:clan.read_only,
        own_delete_window_seconds:clan.own_delete_window_seconds,
        settings:{ beta:true }
      },
      members:clone(clan.members),
      messages:clone(clan.messages).sort((a, b) => b.created_at.localeCompare(a.created_at)),
      polls:clone(clan.polls),
      events:clone(clan.events),
      grants:clone(clan.grants),
      restrictions:clone(clan.restrictions),
      reports:clone(clan.reports)
    };
  }

  function adminUsers(state) {
    const users = new Map();
    const ensure = source => {
      const userKey = String(source.user_key || source.userKey || source.id || "");
      if (!userKey) return null;
      if (!users.has(userKey)) {
        users.set(userKey, {
          user_key:userKey,
          name:String(source.name || "Пользователь BALI"),
          username:String(source.username || "").replace(/^@/, ""),
          user_clan_name:"",
          corporate_clan_name:""
        });
      }
      return users.get(userKey);
    };
    ensure(state.currentUser);
    state.clans.forEach(clan => clan.members.forEach(member => {
      const user = ensure(member);
      if (!user || member.status !== "active") return;
      if (clan.clan_type === "corporate") user.corporate_clan_name = clan.name;
      else user.user_clan_name = clan.name;
    }));
    return [...users.values()].sort((left, right) => left.name.localeCompare(right.name, "ru"));
  }

  function mutateMessage(state, clan, body, replyToId) {
    const message = {
      id:uid("msg"),
      author_user_key:USER_KEY,
      author_name:state.currentUser.name,
      body:String(body || "").trim(),
      message_type:"text",
      created_at:new Date().toISOString(),
      deleted_at:null,
      reply_to_message_id:replyToId || null
    };
    if (!message.body) error("Введите сообщение");
    clan.messages.push(message);
    write(state);
    return message;
  }

  function handleUserApi(state, pathname, method, body) {
    if (pathname === "/api/v1/clans" && method === "GET") {
      return {
        clans:state.clans
          .filter(clan => clan.members.some(row => row.user_key === USER_KEY && row.status === "active"))
          .map(clan => ({
          id:clan.id,
          name:clan.name,
          clan_type:clan.clan_type,
          role:clan.members.find(row => row.user_key === USER_KEY)?.role || "member",
          chat_id:`chat-${clan.id}`,
          enabled:clan.enabled,
          read_only:clan.read_only,
          unread_count:clan.unread_count
        }))
      };
    }
    if (pathname === "/api/v1/clans/ranking" && method === "GET") {
      const source = state.clans
        .map(clan => ({
          id:clan.id,
          name:clan.name,
          clanType:clan.clan_type,
          leaderName:clan.members.find(row => row.user_key === clan.leader_user_key)?.name || "",
          ratingPoints:Number(clan.rating_points || 0),
          memberCount:clan.members.filter(row => row.status === "active").length,
          isMember:clan.members.some(row => row.user_key === USER_KEY && row.status === "active")
        }));
      const rankCategory = type => source
        .filter(clan => clan.clanType === type)
        .sort((left, right) => right.ratingPoints - left.ratingPoints
          || right.memberCount - left.memberCount
          || left.name.localeCompare(right.name, "ru"))
        .map((clan, index) => ({ ...clan, position:index + 1 }));
      const categories = {
        user:rankCategory("user"),
        corporate:rankCategory("corporate")
      };
      return { clans:[...categories.user, ...categories.corporate], categories };
    }

    const match = pathname.match(/^\/api\/v1\/clans\/([^/]+)\/(.+)$/);
    if (!match) return undefined;
    const clan = clanById(state, decodeURIComponent(match[1]));
    if (!clan.members.some(row => row.user_key === USER_KEY && row.status === "active")) {
      error("Чат доступен только участникам клана", 403);
    }
    const action = match[2];

    if (action === "chat" && method === "GET") return clanBundle(clan);
    if (action === "members" && method === "GET") {
      return {
        members:clan.members
          .filter(row => row.status === "active")
          .map(row => ({
            userKey:row.user_key,
            role:row.role,
            profile:{ name:row.name, username:row.username }
          }))
      };
    }
    if (action === "events/available" && method === "GET") {
      const attached = new Set(clan.events.map(row => row.event_id));
      return { events:clone(state.availableEvents.filter(row => !attached.has(row.id))) };
    }
    if (action === "read" && method === "POST") {
      clan.unread_count = 0;
      write(state);
      return { ok:true };
    }
    if (action === "notifications" && method === "PUT") {
      clan.notificationPreference = {
        muted_until:body.mutedUntil || null,
        announcements_only:Boolean(body.announcementsOnly)
      };
      write(state);
      return { preference:clone(clan.notificationPreference) };
    }
    if (action === "messages" && method === "POST") {
      return { message:mutateMessage(state, clan, body.body, body.replyToId) };
    }

    let nested = action.match(/^messages\/([^/]+)$/);
    if (nested && method === "DELETE") {
      const message = clan.messages.find(row => row.id === nested[1]);
      if (!message) error("Сообщение не найдено", 404);
      message.deleted_at = new Date().toISOString();
      write(state);
      return null;
    }
    nested = action.match(/^messages\/([^/]+)\/reports$/);
    if (nested && method === "POST") {
      const message = clan.messages.find(row => row.id === nested[1]);
      if (!message) error("Сообщение не найдено", 404);
      clan.reports.unshift({
        id:uid("report"),
        message_id:message.id,
        reporter_user_key:USER_KEY,
        reporter_name:state.currentUser.name,
        message_author_name:message.author_name,
        reason:String(body.reason || "Без причины"),
        status:"new",
        resolution:null,
        created_at:new Date().toISOString()
      });
      write(state);
      return { ok:true };
    }
    if (action === "polls" && method === "POST") {
      const labels = Array.isArray(body.options) ? body.options.filter(Boolean) : [];
      if (labels.length < 2) error("Добавьте минимум два варианта");
      const pollId = uid("poll");
      clan.polls.unshift({
        id:pollId,
        question:String(body.question || "").trim(),
        allow_multiple:Boolean(body.allowMultiple),
        status:"active",
        created_at:new Date().toISOString(),
        options:labels.map(label => ({ id:uid("option"), label:String(label), votes:0 })),
        votes:{}
      });
      write(state);
      return { poll:clone(clan.polls[0]) };
    }
    nested = action.match(/^polls\/([^/]+)\/votes$/);
    if (nested && method === "POST") {
      const poll = clan.polls.find(row => row.id === nested[1]);
      if (!poll || poll.status !== "active") error("Опрос недоступен", 404);
      const previous = poll.votes[USER_KEY] || [];
      previous.forEach(id => {
        const option = poll.options.find(row => row.id === id);
        if (option) option.votes = Math.max(0, Number(option.votes) - 1);
      });
      const chosen = Array.isArray(body.optionIds) ? body.optionIds : [];
      chosen.forEach(id => {
        const option = poll.options.find(row => row.id === id);
        if (option) option.votes = Number(option.votes) + 1;
      });
      poll.votes[USER_KEY] = chosen;
      write(state);
      return { ok:true };
    }
    nested = action.match(/^polls\/([^/]+)\/(finish|cancel)$/);
    if (nested && method === "POST") {
      const poll = clan.polls.find(row => row.id === nested[1]);
      if (!poll) error("Опрос не найден", 404);
      poll.status = nested[2] === "finish" ? "finished" : "cancelled";
      write(state);
      return { poll:clone(poll) };
    }
    nested = action.match(/^polls\/([^/]+)$/);
    if (nested && method === "DELETE") {
      clan.polls = clan.polls.filter(row => row.id !== nested[1]);
      write(state);
      return null;
    }
    if (action === "events" && method === "POST") {
      const source = state.availableEvents.find(row => row.id === body.eventId);
      if (!source) error("Событие не найдено", 404);
      const attachment = {
        ...clone(source),
        id:uid("attachment"),
        event_id:source.id,
        is_primary:clan.events.length === 0,
        created_at:new Date().toISOString()
      };
      clan.events.push(attachment);
      write(state);
      return { event:clone(attachment) };
    }
    nested = action.match(/^events\/([^/]+)$/);
    if (nested && method === "DELETE") {
      clan.events = clan.events.filter(row => row.id !== nested[1]);
      if (clan.events.length && !clan.events.some(row => row.is_primary)) clan.events[0].is_primary = true;
      write(state);
      return null;
    }
    nested = action.match(/^events\/([^/]+)\/primary$/);
    if (nested && method === "POST") {
      clan.events.forEach(row => { row.is_primary = row.id === nested[1]; });
      write(state);
      return { ok:true };
    }
    if (action === "announcements" && method === "POST") {
      const announcement = {
        id:uid("announcement"),
        title:String(body.title || "Объявление"),
        body:String(body.body || "").trim(),
        official:false,
        published_at:new Date().toISOString(),
        created_at:new Date().toISOString()
      };
      clan.announcements.unshift(announcement);
      clan.messages.push({
        id:uid("msg-announcement"),
        author_user_key:USER_KEY,
        author_name:state.currentUser.name,
        body:announcement.body,
        message_type:"announcement",
        created_at:announcement.created_at,
        deleted_at:null,
        reply_to_message_id:null
      });
      write(state);
      return { announcement:clone(announcement) };
    }
    return undefined;
  }

  function handleAdminApi(state, pathname, searchParams, method, body) {
    if (pathname === "/api/v1/auth/admin/session" && method === "GET") {
      if (!state.adminLoggedIn) error("Beta-сессия завершена", 401);
      return { admin:clone(ADMIN) };
    }
    if (pathname === "/api/v1/auth/admin/login" && method === "POST") {
      if (String(body.email || "").toLowerCase() !== ADMIN.email || body.password !== "bali-beta-2026") {
        error("Используйте beta@bali.test / bali-beta-2026", 401);
      }
      state.adminLoggedIn = true;
      write(state);
      return { admin:clone(ADMIN) };
    }
    if (pathname === "/api/v1/auth/admin/logout" && method === "POST") {
      state.adminLoggedIn = false;
      write(state);
      return null;
    }
    if (!pathname.startsWith("/api/v1/admin/")) return undefined;
    if (!state.adminLoggedIn) error("Требуется beta-вход", 401);

    if (pathname === "/api/v1/admin/permissions" && method === "GET") {
      return { permissions:PERMISSION_KEYS.map(permission_key => ({ permission_key })) };
    }
    if (pathname === "/api/v1/admin/users" && method === "GET") {
      const search = String(searchParams.get("search") || "").toLocaleLowerCase("ru");
      return {
        users:adminUsers(state).filter(user => !search
          || user.name.toLocaleLowerCase("ru").includes(search)
          || user.username.toLocaleLowerCase("ru").includes(search))
      };
    }
    if (pathname === "/api/v1/admin/clans" && method === "POST") {
      const name = String(body.name || "").trim();
      const category = clanCategory(body.clanType);
      const leaderUserKey = String(body.leaderUserKey || "");
      const leader = adminUsers(state).find(user => user.user_key === leaderUserKey);
      if (!name || name.length > 120) error("Название клана должно содержать от 1 до 120 символов");
      if (!["user","corporate"].includes(String(body.clanType || ""))) {
        error("Выберите пользовательский или корпоративный тип клана");
      }
      if (!leader) error("Старший клана не найден", 404);
      const conflict = state.clans.find(clan => clan.clan_type === category
        && clan.members.some(member => member.user_key === leaderUserKey && member.status === "active"));
      if (conflict) error(`Пользователь уже состоит в клане категории «${category === "corporate" ? "Корпоративный" : "Пользовательский"}»`, 409);
      const clan = {
        id:uid("clan"),
        name,
        clan_type:category,
        rating_points:Math.max(0, Number(body.ratingPoints || 0)),
        leader_user_key:leaderUserKey,
        enabled:true,
        read_only:false,
        own_delete_window_seconds:900,
        unread_count:0,
        notificationPreference:{ muted_until:null, announcements_only:false },
        members:[{
          user_key:leaderUserKey,
          name:leader.name,
          username:leader.username,
          clan_type:category,
          role:"leader",
          status:"active"
        }],
        messages:[],
        polls:[],
        events:[],
        announcements:[],
        pins:[],
        grants:[],
        restrictions:[],
        reports:[]
      };
      state.clans.push(clan);
      addAudit(state, "clan.create", "clan", clan.id, String(body.reason || "Создание клана через админку BALI"));
      write(state);
      return {
        clan:{
          id:clan.id,
          name:clan.name,
          clan_type:clan.clan_type,
          rating_points:clan.rating_points,
          leader_user_key:clan.leader_user_key,
          status:"active"
        },
        chat:{ id:`chat-${clan.id}`, clan_id:clan.id, enabled:true, read_only:false }
      };
    }
    if (pathname === "/api/v1/admin/chats" && method === "GET") {
      const search = String(searchParams.get("search") || "").toLocaleLowerCase("ru");
      return {
        chats:state.clans
          .filter(clan => !search || clan.name.toLocaleLowerCase("ru").includes(search))
          .map(adminChatRow)
      };
    }
    if (pathname === "/api/v1/admin/audit" && method === "GET") {
      return { audit:clone(state.audit) };
    }
    if (pathname === "/api/v1/admin/rate-limits" && method === "GET") {
      return { settings:clone(state.rateLimits) };
    }

    let match = pathname.match(/^\/api\/v1\/admin\/rate-limits\/([^/]+)$/);
    if (match && method === "PUT") {
      const bucket = decodeURIComponent(match[1]);
      const setting = state.rateLimits.find(row => row.bucket === bucket);
      if (!setting) error("Лимит не найден", 404);
      setting.limit_count = Number(body.limitCount);
      setting.window_seconds = Number(body.windowSeconds);
      setting.enabled = Boolean(body.enabled);
      addAudit(state, "rate_limit.update", "rate_limit", bucket, "Beta-настройка лимита");
      write(state);
      return { setting:clone(setting) };
    }

    match = pathname.match(/^\/api\/v1\/admin\/clans\/([^/]+)\/chat$/);
    if (match && method === "GET") return adminDetail(clanById(state, decodeURIComponent(match[1])));
    if (match && method === "PATCH") {
      const clan = clanById(state, decodeURIComponent(match[1]));
      clan.enabled = body.enabled === undefined ? clan.enabled : Boolean(body.enabled);
      clan.read_only = body.readOnly === undefined ? clan.read_only : Boolean(body.readOnly);
      clan.own_delete_window_seconds = Number(body.ownDeleteWindowSeconds ?? clan.own_delete_window_seconds);
      addAudit(state, "chat.settings.update", "chat", clan.id, String(body.reason || ""));
      write(state);
      return { chat:adminDetail(clan).chat };
    }

    match = pathname.match(/^\/api\/v1\/admin\/clans\/([^/]+)\/rating$/);
    if (match && method === "PUT") {
      const clan = clanById(state, decodeURIComponent(match[1]));
      const ratingPoints = Number(body.ratingPoints);
      if (!Number.isInteger(ratingPoints) || ratingPoints < 0 || ratingPoints > 1_000_000_000) {
        error("Рейтинг должен быть целым числом от 0 до 1000000000");
      }
      clan.rating_points = ratingPoints;
      addAudit(state, "clan.rating.update", "clan", clan.id, String(body.reason || ""));
      write(state);
      return { clan:{ id:clan.id, name:clan.name, rating_points:clan.rating_points } };
    }

    match = pathname.match(/^\/api\/v1\/admin\/clans\/([^/]+)\/messages$/);
    if (match && method === "GET") {
      const clan = clanById(state, decodeURIComponent(match[1]));
      const search = String(searchParams.get("search") || "").toLocaleLowerCase("ru");
      return {
        messages:clone(clan.messages)
          .filter(row => !search || row.body.toLocaleLowerCase("ru").includes(search))
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
      };
    }

    match = pathname.match(/^\/api\/v1\/admin\/clans\/([^/]+)\/messages\/([^/]+)$/);
    if (match && method === "DELETE") {
      const clan = clanById(state, decodeURIComponent(match[1]));
      const message = clan.messages.find(row => row.id === match[2]);
      if (!message) error("Сообщение не найдено", 404);
      message.deleted_at = new Date().toISOString();
      addAudit(state, "message.delete", "message", message.id, String(body.reason || ""), "message.delete_any");
      write(state);
      return { message:clone(message) };
    }

    match = pathname.match(/^\/api\/v1\/admin\/clans\/([^/]+)\/leader$/);
    if (match && method === "PUT") {
      const clan = clanById(state, decodeURIComponent(match[1]));
      const previous = clan.members.find(row => row.user_key === clan.leader_user_key);
      const next = clan.members.find(row => row.user_key === body.userKey);
      if (!next) error("Участник не найден", 404);
      if (previous) previous.role = "member";
      next.role = "leader";
      clan.leader_user_key = next.user_key;
      addAudit(state, "clan.leader.transfer", "clan", clan.id, String(body.reason || ""));
      write(state);
      return { leader:clone(next) };
    }

    match = pathname.match(/^\/api\/v1\/admin\/clans\/([^/]+)\/announcements$/);
    if (match && method === "POST") {
      const clan = clanById(state, decodeURIComponent(match[1]));
      const announcement = {
        id:uid("announcement"),
        title:String(body.title || "BALI"),
        body:String(body.body || "").trim(),
        official:true,
        published_at:new Date().toISOString(),
        created_at:new Date().toISOString()
      };
      clan.announcements.unshift(announcement);
      clan.messages.push({
        id:uid("msg-official"),
        author_user_key:null,
        author_name:"BALI ADMIN",
        body:announcement.body,
        message_type:"announcement",
        created_at:announcement.created_at,
        deleted_at:null,
        reply_to_message_id:null
      });
      addAudit(state, "announcement.create", "announcement", announcement.id, "Официальное beta-объявление");
      write(state);
      return { announcement:clone(announcement) };
    }

    match = pathname.match(/^\/api\/v1\/admin\/clans\/([^/]+)\/grants$/);
    if (match && method === "POST") {
      const clan = clanById(state, decodeURIComponent(match[1]));
      const member = clan.members.find(row => row.user_key === body.userKey);
      if (!member) error("Участник не найден", 404);
      const grant = {
        id:uid("grant"),
        user_key:member.user_key,
        user_name:member.name,
        permission_key:String(body.permissionKey),
        effect:String(body.effect || "allow"),
        reason:String(body.reason || ""),
        expires_at:body.expiresAt || null,
        revoked_at:null,
        created_at:new Date().toISOString()
      };
      clan.grants.unshift(grant);
      addAudit(state, "permission.grant", "grant", grant.id, grant.reason, grant.permission_key);
      write(state);
      return { grant:clone(grant) };
    }

    match = pathname.match(/^\/api\/v1\/admin\/clans\/([^/]+)\/grants\/([^/]+)$/);
    if (match && method === "DELETE") {
      const clan = clanById(state, decodeURIComponent(match[1]));
      const grant = clan.grants.find(row => row.id === match[2]);
      if (!grant) error("Разрешение не найдено", 404);
      grant.revoked_at = new Date().toISOString();
      addAudit(state, "permission.revoke", "grant", grant.id, String(body.reason || ""), grant.permission_key);
      write(state);
      return { grant:clone(grant) };
    }

    match = pathname.match(/^\/api\/v1\/admin\/clans\/([^/]+)\/restrictions$/);
    if (match && method === "POST") {
      const clan = clanById(state, decodeURIComponent(match[1]));
      const member = clan.members.find(row => row.user_key === body.userKey);
      if (!member) error("Участник не найден", 404);
      const restriction = {
        id:uid("restriction"),
        user_key:member.user_key,
        user_name:member.name,
        can_write:false,
        reason:String(body.reason || ""),
        expires_at:body.expiresAt || null,
        revoked_at:null,
        created_at:new Date().toISOString()
      };
      clan.restrictions.unshift(restriction);
      addAudit(state, "restriction.create", "restriction", restriction.id, restriction.reason);
      write(state);
      return { restriction:clone(restriction) };
    }

    match = pathname.match(/^\/api\/v1\/admin\/reports\/([^/]+)$/);
    if (match && method === "PATCH") {
      const report = state.clans.flatMap(row => row.reports).find(row => row.id === match[1]);
      if (!report) error("Жалоба не найдена", 404);
      report.status = String(body.status || "reviewed");
      report.resolution = String(body.resolution || "");
      report.reviewed_at = new Date().toISOString();
      addAudit(state, "report.review", "report", report.id, report.resolution);
      write(state);
      return { report:clone(report) };
    }

    match = pathname.match(/^\/api\/v1\/admin\/clans\/([^/]+)\/polls\/([^/]+)$/);
    if (match && method === "DELETE") {
      const clan = clanById(state, decodeURIComponent(match[1]));
      clan.polls = clan.polls.filter(row => row.id !== match[2]);
      addAudit(state, "poll.delete", "poll", match[2], "Удалено в beta-админке");
      write(state);
      return null;
    }

    match = pathname.match(/^\/api\/v1\/admin\/clans\/([^/]+)\/events\/([^/]+)$/);
    if (match && method === "DELETE") {
      const clan = clanById(state, decodeURIComponent(match[1]));
      clan.events = clan.events.filter(row => row.id !== match[2]);
      addAudit(state, "event.detach", "event", match[2], "Откреплено в beta-админке");
      write(state);
      return null;
    }
    return undefined;
  }

  async function demoApi(path, options = {}) {
    const url = new URL(path, window.location.origin);
    const method = String(options.method || "GET").toUpperCase();
    const body = jsonBody(options);
    const state = read();
    const adminResult = handleAdminApi(state, url.pathname, url.searchParams, method, body);
    if (adminResult !== undefined) return clone(adminResult);
    const userResult = handleUserApi(state, url.pathname, method, body);
    if (userResult !== undefined) return clone(userResult);
    error(`Beta API не поддерживает ${method} ${url.pathname}`, 404);
  }

  function reset() {
    write(seed());
    return read();
  }

  function auditCsvHref() {
    const header = "created_at,actor_type,actor_id,permission_key,action,target_type,target_id,request_id,reason";
    const rows = read().audit.map(row => [
      row.created_at,
      row.actor_type,
      row.actor_id,
      row.permission_key,
      row.action,
      row.target_type,
      row.target_id,
      row.request_id,
      row.reason
    ].map(value => `"${String(value || "").replaceAll('"', '""')}"`).join(","));
    return `data:text/csv;charset=utf-8,${encodeURIComponent([header, ...rows].join("\n"))}`;
  }

  async function api(path, options = {}) {
    if (window.BALI_DEMO_ONLY || window.BALI_BROWSER_DEMO) return demoApi(path, options);
    const response = await fetch(path, {
      credentials:"include",
      ...options,
      headers:{
        "Content-Type":"application/json",
        ...(options.headers || {})
      }
    });
    if (response.status === 204) return null;
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const problem = new Error(payload?.error?.message || payload.message || "Не удалось выполнить запрос");
      problem.status = response.status;
      throw problem;
    }
    return payload;
  }

  window.BaliClans = {
    api,
    demoApi,
    storageKey:STORAGE_KEY,
    currentUser:() => clone(read().currentUser),
    reset,
    snapshot:() => clone(read()),
    credentials:{ email:ADMIN.email, password:"bali-beta-2026" }
  };
  window.BaliBetaApi = demoApi;
  window.BaliClanBeta = window.BaliClans;
  window.BaliAdminAuditHref = auditCsvHref();
})();
