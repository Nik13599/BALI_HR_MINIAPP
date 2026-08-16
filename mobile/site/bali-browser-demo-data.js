(() => {
  if (window.__BALI_BROWSER_DEMO_DATA__) return;
  window.__BALI_BROWSER_DEMO_DATA__ = true;

  const VERSION = 2;
  const VERSION_KEY = "bali_browser_demo_catalog_version_v2";
  const now = new Date();
  const iso = (days = 0, hour = 20) => {
    const date = new Date(now);
    date.setDate(date.getDate() + days);
    date.setHours(hour, 0, 0, 0);
    return date.toISOString();
  };
  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const avatar = (name, a, b) => {
    const initials = String(name).split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="720" viewBox="0 0 720 720"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="720" height="720" rx="180" fill="#080a0a"/><circle cx="520" cy="180" r="300" fill="url(#g)" opacity=".85"/><circle cx="160" cy="620" r="280" fill="url(#g)" opacity=".36"/><text x="360" y="420" text-anchor="middle" fill="white" font-family="Arial" font-size="190" font-weight="900">${initials}</text></svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  };

  function install() {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index) || "";
      if (/supabase|telegram[_-]?auth|tg[_-]?auth|initdata|auth[_-]?token/i.test(key)) localStorage.removeItem(key);
    }

    const people = [
      { id:"bali-user-nikolay", name:"Николай", status:"Собираю компанию на ближайшую вечеринку", bio:"Организую лучшие ночи BALI. Собираю компанию на ближайшее событие.", active:true, gender:"male", birthDate:"1994-12-19", phone:"375296700300", sharePhone:false, vipPlan:"black", level:"BALI Insider", visits:14, xp:5350, photo:avatar("Николай","#c8ff3d","#184d35"), cropX:50, cropY:42, updatedAt:iso(0) },
      { id:"bali-user-anna", name:"Анна Мороз", status:"Ищу компанию за столик", bio:"Люблю house, красивые вечеринки и новые знакомства.", active:true, gender:"female", birthDate:"1998-05-14", phone:"375291112233", sharePhone:false, vipPlan:"legend", level:"Club Legend", visits:18, xp:6680, photo:avatar("Анна Мороз","#ff6fb1","#5d1b67"), cropX:50, cropY:42, updatedAt:iso(0) },
      { id:"bali-user-maxim", name:"Максим Орлов", status:"Сегодня только хорошая музыка", bio:"DJ, музыка и новые люди. Всегда на танцполе.", active:true, gender:"male", birthDate:"1996-09-02", phone:"375333456789", sharePhone:true, vipPlan:"vip", level:"Night Regular", visits:9, xp:2940, photo:avatar("Максим Орлов","#4dd4ff","#123e7a"), cropX:50, cropY:42, updatedAt:iso(0) },
      { id:"bali-user-sofia", name:"София Волкова", status:"Танцую до утра", bio:"Танцую до утра. Всегда за яркие события BALI.", active:true, gender:"female", birthDate:"2000-02-28", phone:"375447778899", sharePhone:false, vipPlan:"", level:"BALI Insider", visits:12, xp:4270, photo:avatar("София Волкова","#f4cf5d","#9f3f28"), cropX:50, cropY:42, updatedAt:iso(0) },
      { id:"bali-user-artem", name:"Артём Левин", status:"Кто со мной в пятницу?", bio:"Собираю компанию на ближайшую пятницу.", active:true, gender:"male", birthDate:"1997-07-11", phone:"375259998877", sharePhone:false, vipPlan:"", level:"Night Regular", visits:6, xp:1780, photo:avatar("Артём Левин","#a783ff","#32205e"), cropX:50, cropY:42, updatedAt:iso(0) },
      { id:"bali-user-daria", name:"Дарья Ночь", status:"Коктейли и новые знакомства ✨", bio:"Коктейли, танцы и новые знакомства ✨", active:true, gender:"female", birthDate:"1999-11-08", phone:"375295554433", sharePhone:false, vipPlan:"", level:"Night Regular", visits:10, xp:3560, photo:avatar("Дарья Ночь","#ff8f55","#721c45"), cropX:50, cropY:42, updatedAt:iso(0) },
      { id:"bali-user-alex", name:"Алекс Грин", status:"Techno до самого утра", bio:"Люблю techno и большие клубные события.", active:true, gender:"male", birthDate:"1995-03-22", phone:"375291010101", sharePhone:false, vipPlan:"black", level:"BALI Insider", visits:16, xp:4920, photo:avatar("Алекс Грин","#51ff93","#0d515f"), cropX:50, cropY:42, updatedAt:iso(0) },
      { id:"bali-user-mila", name:"Мила Рэй", status:"Сегодня отдыхаю с друзьями", bio:"Пришла слушать музыку и отдыхать с друзьями.", active:true, gender:"female", birthDate:"2001-06-18", phone:"375292020202", sharePhone:false, vipPlan:"", level:"Party Starter", visits:4, xp:980, photo:avatar("Мила Рэй","#ff9c5a","#4a174f"), cropX:50, cropY:42, updatedAt:iso(0) }
    ];

    const rewards = [
      { id:"reward-demo-regular", title:"Постоянный гость", description:"Посетить BALI минимум 5 раз", icon:"🎟", image:"", xp:300, conditionType:"visits", threshold:5, active:true, repeatable:false, awardPointsEnabled:true, pointsRewardAmount:250, pointsRewardType:"points", awardPointsMode:"first", deductPointsOnRevoke:false, pointsHistoryComment:"Награда: Постоянный гость", sort_order:1, createdAt:iso(-180), updatedAt:iso(0) },
      { id:"reward-demo-crown", title:"Участник BALI Match", description:"Войти в TOP 10 недельного рейтинга игры", icon:"👑", image:"", xp:500, conditionType:"ranking", eventId:"", eventTitle:"", threshold:10, active:true, repeatable:true, awardPointsEnabled:true, pointsRewardAmount:500, pointsRewardType:"points", awardPointsMode:"each", deductPointsOnRevoke:false, pointsHistoryComment:"Награда: Участник BALI Match", sort_order:2, createdAt:iso(-30), updatedAt:iso(0) },
      { id:"reward-demo-dance", title:"Легенда танцпола", description:"Эксклюзивная награда активному гостю", icon:"🪩", image:"", xp:1000, conditionType:"manual", threshold:1, active:true, repeatable:false, awardPointsEnabled:true, pointsRewardAmount:1000, pointsRewardType:"points", awardPointsMode:"first", deductPointsOnRevoke:false, pointsHistoryComment:"Награда: Легенда танцпола", sort_order:3, createdAt:iso(-90), updatedAt:iso(0) },
      { id:"reward-demo-company", title:"Большая компания", description:"Забронировать стол на 6 и более гостей", icon:"🥂", image:"", xp:350, conditionType:"manual", threshold:1, active:true, repeatable:true, awardPointsEnabled:true, pointsRewardAmount:350, pointsRewardType:"points", awardPointsMode:"each", deductPointsOnRevoke:false, pointsHistoryComment:"Награда: Большая компания", sort_order:4, createdAt:iso(-60), updatedAt:iso(0) },
      { id:"reward-demo-vip", title:"VIP-гость", description:"Получить любой VIP-статус BALI", icon:"💎", image:"", xp:600, conditionType:"manual", threshold:1, active:true, repeatable:false, awardPointsEnabled:true, pointsRewardAmount:600, pointsRewardType:"points", awardPointsMode:"first", deductPointsOnRevoke:true, pointsHistoryComment:"Награда: VIP-гость", sort_order:5, createdAt:iso(-45), updatedAt:iso(0) },
      { id:"reward-demo-social", title:"Душа BALI People", description:"Пригласить 3 друзей в BALI", icon:"✨", image:"", xp:450, conditionType:"referrals", threshold:3, active:true, repeatable:true, awardPointsEnabled:true, pointsRewardAmount:450, pointsRewardType:"points", awardPointsMode:"first", deductPointsOnRevoke:false, pointsHistoryComment:"Награда: Душа BALI People", sort_order:6, createdAt:iso(-20), updatedAt:iso(0) }
    ];

    const gifts = [
      { id:"gift-demo-1", fromId:"bali-user-anna", fromName:"Анна Мороз", toId:"bali-user-nikolay", toName:"Николай", giftId:"cocktail", giftName:"Коктейль", icon:"🍸", stars:50, source:"browser_demo", createdAt:iso(-1,23) },
      { id:"gift-demo-2", fromId:"bali-user-sofia", fromName:"София Волкова", toId:"bali-user-nikolay", toName:"Николай", giftId:"crown", giftName:"VIP-корона", icon:"👑", stars:250, source:"browser_demo", createdAt:iso(-2,22) },
      { id:"gift-demo-3", fromId:"bali-user-maxim", fromName:"Максим Орлов", toId:"bali-user-daria", toName:"Дарья Ночь", giftId:"rose", giftName:"Роза", icon:"🌹", stars:25, source:"browser_demo", createdAt:iso(-3,22) },
      { id:"gift-demo-4", fromId:"bali-user-artem", fromName:"Артём Левин", toId:"bali-user-anna", toName:"Анна Мороз", giftId:"disco", giftName:"Диско-шар", icon:"🪩", stars:100, source:"browser_demo", createdAt:iso(-4,21) },
      { id:"gift-demo-5", fromId:"bali-user-nikolay", fromName:"Николай", toId:"bali-user-sofia", toName:"София Волкова", giftId:"cocktail", giftName:"Коктейль", icon:"🍸", stars:50, source:"browser_demo", createdAt:iso(-5,20) },
      { id:"gift-demo-6", fromId:"bali-user-alex", fromName:"Алекс Грин", toId:"bali-user-nikolay", toName:"Николай", giftId:"rose", giftName:"Роза", icon:"🌹", stars:25, source:"browser_demo", createdAt:iso(-6,23) }
    ];

    const grants = [
      { id:"grant-demo-1", rewardId:"reward-demo-regular", userKey:"bali-user-nikolay", userName:"Николай", source:"auto_visits", xp:300, earnedAt:iso(-20) },
      { id:"grant-demo-2", rewardId:"reward-demo-crown", userKey:"bali-user-nikolay", userName:"Николай", source:"event", xp:500, earnedAt:iso(-10) },
      { id:"grant-demo-3", rewardId:"reward-demo-regular", userKey:"bali-user-anna", userName:"Анна Мороз", source:"auto_visits", xp:300, earnedAt:iso(-30) },
      { id:"grant-demo-4", rewardId:"reward-demo-vip", userKey:"bali-user-anna", userName:"Анна Мороз", source:"manual", xp:600, earnedAt:iso(-12) },
      { id:"grant-demo-5", rewardId:"reward-demo-dance", userKey:"bali-user-maxim", userName:"Максим Орлов", source:"manual", xp:1000, earnedAt:iso(-8) }
    ];

    const accounts = Object.fromEntries(people.map((person, index) => [person.id, {
      userKey:person.id,
      ownerKey:person.id,
      code:`BALI-WEB-${String(index + 1).padStart(3, "0")}`,
      name:person.name,
      phone:person.phone,
      avatar:person.photo,
      balance:[4200,7800,2350,5100,1250,3400,6200,900][index],
      xp:person.xp,
      visits:person.visits,
      bookings:[6,8,3,4,2,5,7,1][index],
      birthDate:person.birthDate,
      gender:person.gender,
      status:person.status,
      vipPlan:person.vipPlan,
      createdAt:iso(-500 + index * 10),
      updatedAt:iso(0)
    }]));

    const appUsers = Object.fromEntries(people.map((person, index) => [person.id, {
      user_key:person.id,
      name:person.name,
      phone:person.phone,
      avatar:person.photo,
      birth_date:person.birthDate,
      gender:person.gender,
      status:person.status,
      status_label:person.status,
      vip_plan:person.vipPlan,
      first_seen_at:iso(-120 + index * 7),
      last_seen_at:iso(-index, 22),
      opens:50 - index * 4
    }]));

    const vipGifts = [
      { id:"vip-demo-anna", targetKeys:["bali-user-anna","phone:375291112233"], targetName:"Анна Мороз", targetPhone:"375291112233", planId:"legend", days:30, source:"browser_demo", note:"Тестовый статус BALI LEGEND", purchasedAt:iso(-2), expiresAt:iso(28), revokedAt:null },
      { id:"vip-demo-nikolay", targetKeys:["bali-user-nikolay","phone:375296700300"], targetName:"Николай", targetPhone:"375296700300", planId:"black", days:30, source:"browser_demo", note:"Тестовый статус BALI BLACK", purchasedAt:iso(-12), expiresAt:iso(18), revokedAt:null },
      { id:"vip-demo-maxim", targetKeys:["bali-user-maxim","phone:375333456789"], targetName:"Максим Орлов", targetPhone:"375333456789", planId:"vip", days:30, source:"browser_demo", note:"Тестовый статус BALI VIP", purchasedAt:iso(-21), expiresAt:iso(9), revokedAt:null }
    ];

    const activeId = localStorage.getItem("bali_full_demo_active_user_v1") || "bali-user-nikolay";
    const active = people.find(person => person.id === activeId) || people[0];
    const activeAccount = accounts[active.id];

    write("bali_social_people_v1", people);
    write("bali_social_profile_v1", active);
    write("bali_social_gifts_v1", gifts);
    write("bali_beta4_custom_rewards_v1", rewards);
    write("bali_beta4_reward_grants_v1", grants);
    write("bali_beta4_vip_gifts_v1", vipGifts);
    write("bali_points_accounts_v1", accounts);
    write("bali_app_users_v1", appUsers);
    write("bali_bonus_profile_v1", activeAccount);
    write("bali_beta4_profile_v1", {
      id:active.id,
      userKey:active.id,
      ownerKey:active.id,
      code:activeAccount.code,
      name:active.name,
      phone:active.phone,
      avatar:active.photo,
      birthDate:active.birthDate,
      gender:active.gender,
      xp:active.xp,
      visits:active.visits,
      bookings:activeAccount.bookings,
      streak:3,
      publicRanking:true,
      points:activeAccount.balance,
      status:active.status,
      vipPlan:active.vipPlan,
      createdAt:activeAccount.createdAt,
      updatedAt:iso(0)
    });
    write("bali_beta4_achievements_v1", {
      first_open:iso(-90),
      first_booking:iso(-70),
      first_visit:iso(-60),
      social:iso(-40),
      company:iso(-30),
      vip_member:iso(-20)
    });

    localStorage.setItem(VERSION_KEY, String(VERSION));
    window.dispatchEvent(new CustomEvent("bali:demo-catalog-ready", { detail:{ people:people.length, gifts:gifts.length, rewards:rewards.length, statuses:4 } }));
  }

  if (String(localStorage.getItem(VERSION_KEY) || "") !== String(VERSION)) install();
  window.BaliBrowserDemoData = { version:VERSION, install, reset:install };
})();
