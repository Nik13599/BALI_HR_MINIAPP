(() => {
  if (window.BaliDemo) return;

  const VERSION = 1;
  const VERSION_KEY = "bali_full_demo_seed_version_v1";
  const ACTIVE_KEY = "bali_full_demo_active_user_v1";
  const USERS_KEY = "bali_full_demo_users_v1";
  const CONTROLLED_KEYS = [
    "bali_events_v2", "bali_menu_v2", "bali_tables_v2", "bali_customers_v2", "bali_bookings_v2",
    "bali_bonus_settings_v1", "bali_bonus_profile_v1", "bali_bonus_ledger_v1", "bali_bonus_actions_v1",
    "bali_attendance_codes_v1", "bali_points_accounts_v1", "bali_beta4_profile_v1", "bali_beta4_vip_v1",
    "bali_beta4_vip_gifts_v1", "bali_vip_config_v1", "bali_beta4_achievements_v1",
    "bali_beta4_loyalty_config_v1", "bali_beta4_chips_v1", "bali_beta4_chip_history_v1",
    "bali_beta4_custom_rewards_v1", "bali_beta4_reward_grants_v1", "bali_app_users_v1",
    "bali_age_verification_v1", "bali_social_profile_v1", "bali_social_people_v1",
    "bali_social_requests_v1", "bali_social_gifts_v1", "bali_social_swipes_v2",
    "bali_event_checkins_v1", "bali_event_rsvps_v1", "bali_event_qr_trust_v2",
    "bali_night_crown_entries_v1", "bali_night_crown_votes_v1", "bali_night_crown_prizes_v1",
    "bali_chip_requests_v1", "bali_event_checkin_notices_v1", "bali_home_design_v1"
  ];

  window.BALI_CONFIG = {};

  const now = new Date();
  const isoDate = offset => {
    const date = new Date(now);
    date.setDate(date.getDate() + offset);
    return date.toISOString().slice(0, 10);
  };
  const isoTime = (offsetDays = 0, hour = 20, minute = 0) => {
    const date = new Date(now);
    date.setDate(date.getDate() + offsetDays);
    date.setHours(hour, minute, 0, 0);
    return date.toISOString();
  };
  const svg = (title, subtitle, a, b, icon = "B") => {
    const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="900" height="1200" rx="54" fill="#080a0a"/><circle cx="690" cy="210" r="330" fill="url(#g)" opacity=".82"/><circle cx="180" cy="990" r="390" fill="url(#g)" opacity=".32"/><text x="72" y="132" fill="#c8ff3d" font-family="Arial" font-weight="800" font-size="58">${icon}</text><text x="72" y="870" fill="white" font-family="Arial" font-weight="900" font-size="76">${title}</text><text x="72" y="948" fill="#cbd2ce" font-family="Arial" font-size="34">${subtitle}</text><text x="72" y="1100" fill="#c8ff3d" font-family="Arial" font-weight="700" font-size="28">BALI · МИНСК · КИРОВА, 13</text></svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(markup)}`;
  };
  const avatar = (initials, a, b) => svg(initials, "BALI PEOPLE", a, b, "B");

  const users = [
    { key:"bali-user-nikolay", code:"BALI-NIKOLAY", telegramId:910001, name:"Николай", username:"@nikolay_bali", phone:"375296700300", birthDate:"1994-12-19", gender:"male", balance:4200, xp:5350, visits:14, bookings:6, streak:3, status:"party", bio:"Организую лучшие ночи BALI. Ищу компанию на вечеринку.", shareTelegram:true, sharePhone:false, colorA:"#c8ff3d", colorB:"#184d35", vip:{planId:"black", days:30, remainingDays:18} },
    { key:"bali-user-anna", code:"BALI-ANNA", telegramId:910002, name:"Анна Мороз", username:"@anna_moroz", phone:"375291112233", birthDate:"1998-05-14", gender:"female", balance:7800, xp:6680, visits:18, bookings:8, streak:5, status:"table", bio:"Люблю house и красивые вечеринки. Собираю компанию за столик.", shareTelegram:true, sharePhone:false, colorA:"#ff6fb1", colorB:"#5d1b67", vip:null },
    { key:"bali-user-maxim", code:"BALI-MAXIM", telegramId:910003, name:"Максим Орлов", username:"@max_orlov", phone:"375333456789", birthDate:"1996-09-02", gender:"male", balance:2350, xp:2940, visits:9, bookings:3, streak:1, status:"chat", bio:"DJ, музыка и новые знакомства.", shareTelegram:true, sharePhone:true, colorA:"#4dd4ff", colorB:"#123e7a", vip:{planId:"vip", days:30, remainingDays:9} },
    { key:"bali-user-sofia", code:"BALI-SOFIA", telegramId:910004, name:"София Волкова", username:"@sofia_wave", phone:"375447778899", birthDate:"2000-02-28", gender:"female", balance:5100, xp:4270, visits:12, bookings:4, streak:2, status:"party", bio:"Танцую до утра. Всегда за яркие события.", shareTelegram:true, sharePhone:false, colorA:"#f4cf5d", colorB:"#9f3f28", vip:null },
    { key:"bali-user-artem", code:"BALI-ARTEM", telegramId:910005, name:"Артём Левин", username:"@art_levin", phone:"375259998877", birthDate:"1997-07-11", gender:"male", balance:1250, xp:1780, visits:6, bookings:2, streak:1, status:"table", bio:"Ищу компанию на ближайшую пятницу.", shareTelegram:true, sharePhone:false, colorA:"#a783ff", colorB:"#32205e", vip:null },
    { key:"bali-user-daria", code:"BALI-DARIA", telegramId:910006, name:"Дарья Ночь", username:"@daria_night", phone:"375295554433", birthDate:"1999-11-08", gender:"female", balance:3400, xp:3560, visits:10, bookings:5, streak:4, status:"chat", bio:"Коктейли, танцы и новые люди ✨", shareTelegram:true, sharePhone:false, colorA:"#ff8f55", colorB:"#721c45", vip:null }
  ].map(user => ({ ...user, avatar: avatar(user.name.split(/\s+/).map(x=>x[0]).join("").slice(0,2), user.colorA, user.colorB) }));

  const byKey = Object.fromEntries(users.map(user => [user.key, user]));
  const defaultUser = users[0].key;

  function write(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  function read(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }

  function profileFor(user) {
    return {
      id:user.key, userKey:user.key, ownerKey:user.key, code:user.code, telegramId:user.telegramId,
      name:user.name, username:user.username, telegram:user.username, phone:user.phone, avatar:user.avatar,
      birthDate:user.birthDate, gender:user.gender, xp:user.xp, visits:user.visits, bookings:user.bookings,
      streak:user.streak, publicRanking:true, points:user.balance, createdAt:isoTime(-500,12,0), updatedAt:isoTime(0,12,0)
    };
  }

  function pointAccountFor(user) {
    return {
      userKey:user.key, ownerKey:user.key, code:user.code, telegramId:user.telegramId, name:user.name,
      telegram:user.username, phone:user.phone, avatar:user.avatar, balance:user.balance, xp:user.xp,
      visits:user.visits, bookings:user.bookings, birthDate:user.birthDate, gender:user.gender,
      createdAt:isoTime(-500,12,0), updatedAt:isoTime(0,12,0)
    };
  }

  function socialFor(user) {
    return {
      id:user.key, name:user.name, username:user.username, phone:user.phone, photo:user.avatar,
      status:user.status, bio:user.bio, active:true, gender:user.gender, birthDate:user.birthDate,
      shareTelegram:user.shareTelegram, sharePhone:user.sharePhone, cropX:50, cropY:42, updatedAt:isoTime(0,12,0)
    };
  }

  function seedAll() {
    const events = [
      { id:"event-demo-crown", title:"BALI Neon Crown", event_date:isoDate(0), event_time:"23:00", description:"Главная тестовая ночь: QR-вход, конкурс Король и Королева ночи, баллы и подарки.", image_url:svg("NEON CROWN","КОНКУРС · DJ · СВОБОДНЫЙ ВХОД","#c8ff3d","#174c3c","👑"), active:true, sort_order:1, night_crown_enabled:true, night_crown_ever_enabled:true, qr_token:"demo-crown-token" },
      { id:"event-demo-tropic", title:"Tropic Party", event_date:isoDate(5), event_time:"23:00", description:"Тропическая вечеринка, DJ-сеты, бар и кальяны.", image_url:svg("TROPIC PARTY","ПЯТНИЦА · 23:00","#51ff93","#0d515f","🌴"), active:true, sort_order:2, qr_token:"demo-tropic-token" },
      { id:"event-demo-football", title:"Football Afterparty", event_date:isoDate(9), event_time:"21:00", description:"Большие экраны, трансляция матча и вечеринка после финального свистка.", image_url:svg("FOOTBALL NIGHT","БОЛЬШИЕ ЭКРАНЫ · БАР","#f4cf5d","#603b16","⚽"), active:true, sort_order:3, qr_token:"demo-football-token" },
      { id:"event-demo-black", title:"BALI Black Night", event_date:isoDate(14), event_time:"23:00", description:"Премиальная клубная ночь с VIP-привилегиями.", image_url:svg("BLACK NIGHT","VIP · SPECIAL GUEST","#a783ff","#281340","B"), active:true, sort_order:4, qr_token:"demo-black-token" }
    ];

    const menu = [
      {id:"menu-demo-1",category:"Коктейли",name:"BALI Signature",description:"Маракуйя, цитрус и фирменный тропический микс",price:25,active:true,sort_order:1},
      {id:"menu-demo-2",category:"Коктейли",name:"Neon Spritz",description:"Игристые ноты, апельсин и маракуйя",price:24,active:true,sort_order:2},
      {id:"menu-demo-3",category:"Коктейли",name:"Black Mango",description:"Манго, лайм и пряный сироп",price:27,active:true,sort_order:3},
      {id:"menu-demo-4",category:"Шоты",name:"BALI Shot Set",description:"Сет из пяти фирменных шотов",price:45,active:true,sort_order:4},
      {id:"menu-demo-5",category:"Пиво",name:"Пиво разливное",description:"Светлое, 0,5 л",price:10,active:true,sort_order:5},
      {id:"menu-demo-6",category:"Без алкоголя",name:"Passion Lemonade",description:"Маракуйя, лимон и содовая",price:14,active:true,sort_order:6},
      {id:"menu-demo-7",category:"Кальяны",name:"Classic Hookah",description:"Классическая чаша",price:45,active:true,sort_order:7},
      {id:"menu-demo-8",category:"Кальяны",name:"Premium Hookah",description:"Премиальная чаша и авторский микс",price:60,active:true,sort_order:8},
      {id:"menu-demo-9",category:"Закуски",name:"Пивной сет",description:"Закуски для компании, 500 г",price:32,active:true,sort_order:9},
      {id:"menu-demo-10",category:"Закуски",name:"Картофель фри",description:"С кетчупом, 150 г",price:12,active:true,sort_order:10}
    ];

    const tables = [
      {id:"table-1",name:"Стол 1",seats:4,x:12,y:18,shape:"round",active:true},
      {id:"table-2",name:"Стол 2",seats:4,x:37,y:18,shape:"round",active:true},
      {id:"table-3",name:"Стол 3",seats:6,x:64,y:18,shape:"round",active:true},
      {id:"table-4",name:"Стол 4",seats:4,x:14,y:52,shape:"square",active:true},
      {id:"table-5",name:"Стол 5",seats:6,x:42,y:52,shape:"square",active:true},
      {id:"table-6",name:"Стол 6",seats:6,x:68,y:52,shape:"square",active:true},
      {id:"table-vip-1",name:"VIP 1",seats:8,x:22,y:79,shape:"vip",active:true},
      {id:"table-vip-2",name:"VIP 2",seats:10,x:66,y:79,shape:"vip",active:true}
    ];

    const customers = users.map((user,index) => ({
      id:`customer-${index+1}`, name:user.name, phone:user.phone, telegram:user.username,
      notes:index===0?"Организатор тестирования":index===1?"Предпочитает VIP-столы":"Гость демо-базы",
      visits:user.visits, total_spent:[2180,3420,1280,2260,980,1740][index],
      last_visit_at:isoTime(-index,2,15), created_at:isoTime(-420+index*10,12,0)
    }));

    const bookings = [
      {id:"booking-demo-1",booking_date:isoDate(0),booking_time:"22:30",table_id:"table-vip-1",table_name:"VIP 1",customer_id:"customer-2",customer_name:"Анна Мороз",phone:"375291112233",guests:7,status:"confirmed",comment:"День рождения, нужен торт",created_at:isoTime(-3,15,0)},
      {id:"booking-demo-2",booking_date:isoDate(0),booking_time:"23:00",table_id:"table-2",table_name:"Стол 2",customer_id:"customer-3",customer_name:"Максим Орлов",phone:"375333456789",guests:4,status:"seated",comment:"",created_at:isoTime(-2,18,20)},
      {id:"booking-demo-3",booking_date:isoDate(0),booking_time:"23:30",table_id:"table-5",table_name:"Стол 5",customer_id:"customer-4",customer_name:"София Волкова",phone:"375447778899",guests:5,status:"pending",comment:"Подтвердить в Telegram",created_at:isoTime(-1,10,10)},
      {id:"booking-demo-4",booking_date:isoDate(5),booking_time:"23:00",table_id:"table-vip-2",table_name:"VIP 2",customer_id:"customer-1",customer_name:"Николай",phone:"375296700300",guests:8,status:"confirmed",comment:"Тестовая бронь из пользовательского приложения",created_at:isoTime(0,9,30)},
      {id:"booking-demo-5",booking_date:isoDate(9),booking_time:"21:00",table_id:"table-3",table_name:"Стол 3",customer_id:"customer-6",customer_name:"Дарья Ночь",phone:"375295554433",guests:6,status:"confirmed",comment:"У экрана",created_at:isoTime(0,11,45)},
      {id:"booking-demo-6",booking_date:isoDate(-7),booking_time:"23:00",table_id:"table-1",table_name:"Стол 1",customer_id:"customer-5",customer_name:"Артём Левин",phone:"375259998877",guests:3,status:"completed",comment:"",created_at:isoTime(-10,12,0)},
      {id:"booking-demo-7",booking_date:isoDate(5),booking_time:"23:30",table_id:"table-4",table_name:"Стол 4",customer_id:"customer-5",customer_name:"Артём Левин",phone:"375259998877",guests:4,status:"cancelled",comment:"Отмена клиентом",created_at:isoTime(-1,13,0)}
    ];

    const accounts = Object.fromEntries(users.map(user => [user.key, pointAccountFor(user)]));
    const appUsers = Object.fromEntries(users.map((user,index) => [user.key, {
      user_key:user.key, telegram_id:user.telegramId, name:user.name, username:user.username,
      phone:user.phone, avatar:user.avatar, birth_date:user.birthDate, gender:user.gender,
      age:null, first_seen_at:isoTime(-120+index*8,12,0), last_seen_at:isoTime(-index,21,30), opens:42-index*5
    }]));

    const ledger = [];
    users.forEach((user,index) => {
      ledger.push(
        {id:`ledger-${user.key}-1`,userKey:user.key,type:"attendance",title:"Посещение «BALI Neon Crown»",amount:100,createdAt:isoTime(-index,23,45)},
        {id:`ledger-${user.key}-2`,userKey:user.key,type:"admin_add",title:"Подарочные баллы от BALI",amount:500,createdAt:isoTime(-10-index,18,0)},
        {id:`ledger-${user.key}-3`,userKey:user.key,type:"event_share",title:"Репост афиши",amount:10,createdAt:isoTime(-14-index,20,0)}
      );
    });

    const checkins = {};
    users.forEach((user,index) => {
      const id=`checkin-event-demo-crown-${user.key}`;
      checkins[id]={id,event_id:"event-demo-crown",event_title:"BALI Neon Crown",event_date:isoDate(0),event_time:"23:00",user_key:user.key,telegram_id:user.telegramId,telegram:user.username,name:user.name,phone:user.phone,checked_in_at:isoTime(0,22,10+index*5),source:"event_qr",reward:100,xp:250,visits:user.visits,level:user.xp>=4000?"BALI Insider":user.xp>=1500?"Night Regular":"Party Starter"};
    });

    const crownEntries = [
      {id:"crown-entry-anna",event_id:"event-demo-crown",event_title:"BALI Neon Crown",event_date:isoDate(0),user_key:"bali-user-anna",telegram_id:910002,name:"Анна Мороз",username:"@anna_moroz",gender:"female",photo_url:byKey["bali-user-anna"].avatar,status:"approved",moderation_note:"",joined_at:isoTime(0,22,35),updated_at:isoTime(0,22,40),approved_at:isoTime(0,22,40),rejected_at:null},
      {id:"crown-entry-sofia",event_id:"event-demo-crown",event_title:"BALI Neon Crown",event_date:isoDate(0),user_key:"bali-user-sofia",telegram_id:910004,name:"София Волкова",username:"@sofia_wave",gender:"female",photo_url:byKey["bali-user-sofia"].avatar,status:"approved",moderation_note:"",joined_at:isoTime(0,22,41),updated_at:isoTime(0,22,44),approved_at:isoTime(0,22,44),rejected_at:null},
      {id:"crown-entry-daria",event_id:"event-demo-crown",event_title:"BALI Neon Crown",event_date:isoDate(0),user_key:"bali-user-daria",telegram_id:910006,name:"Дарья Ночь",username:"@daria_night",gender:"female",photo_url:byKey["bali-user-daria"].avatar,status:"pending",moderation_note:"",joined_at:isoTime(0,22,48),updated_at:isoTime(0,22,48),approved_at:null,rejected_at:null},
      {id:"crown-entry-nikolay",event_id:"event-demo-crown",event_title:"BALI Neon Crown",event_date:isoDate(0),user_key:"bali-user-nikolay",telegram_id:910001,name:"Николай",username:"@nikolay_bali",gender:"male",photo_url:byKey["bali-user-nikolay"].avatar,status:"approved",moderation_note:"",joined_at:isoTime(0,22,30),updated_at:isoTime(0,22,34),approved_at:isoTime(0,22,34),rejected_at:null},
      {id:"crown-entry-maxim",event_id:"event-demo-crown",event_title:"BALI Neon Crown",event_date:isoDate(0),user_key:"bali-user-maxim",telegram_id:910003,name:"Максим Орлов",username:"@max_orlov",gender:"male",photo_url:byKey["bali-user-maxim"].avatar,status:"approved",moderation_note:"",joined_at:isoTime(0,22,38),updated_at:isoTime(0,22,42),approved_at:isoTime(0,22,42),rejected_at:null},
      {id:"crown-entry-artem",event_id:"event-demo-crown",event_title:"BALI Neon Crown",event_date:isoDate(0),user_key:"bali-user-artem",telegram_id:910005,name:"Артём Левин",username:"@art_levin",gender:"male",photo_url:byKey["bali-user-artem"].avatar,status:"rejected",moderation_note:"Фотография требует повторной загрузки",joined_at:isoTime(0,22,50),updated_at:isoTime(0,22,55),approved_at:null,rejected_at:isoTime(0,22,55)}
    ];

    const votePairs = [
      ["bali-user-nikolay","bali-user-anna","female"],["bali-user-maxim","bali-user-anna","female"],["bali-user-artem","bali-user-sofia","female"],["bali-user-daria","bali-user-anna","female"],
      ["bali-user-anna","bali-user-nikolay","male"],["bali-user-sofia","bali-user-maxim","male"],["bali-user-daria","bali-user-nikolay","male"],["bali-user-artem","bali-user-nikolay","male"]
    ];
    const crownVotes = votePairs.map(([from,to,gender],index)=>({id:`crown-vote-${index+1}`,event_id:"event-demo-crown",event_title:"BALI Neon Crown",event_date:isoDate(0),voter_key:from,candidate_key:to,candidate_name:byKey[to].name,candidate_gender:gender,created_at:isoTime(0,23,index*3)}));

    const rewards = [
      {id:"reward-demo-regular",title:"Постоянный гость",description:"Посетить BALI минимум 5 раз",image:"",xp:300,conditionType:"visits",eventId:"",eventTitle:"",threshold:5,active:true,sort_order:1,createdAt:isoTime(-200,12,0),updatedAt:isoTime(0,12,0)},
      {id:"reward-demo-crown",title:"Участник Neon Crown",description:"Посетить BALI Neon Crown",image:"",xp:500,conditionType:"event",eventId:"event-demo-crown",eventTitle:"BALI Neon Crown",threshold:1,active:true,sort_order:2,createdAt:isoTime(-20,12,0),updatedAt:isoTime(0,12,0)},
      {id:"reward-demo-legend",title:"Легенда танцпола",description:"Эксклюзивная ручная награда",image:"",xp:1000,conditionType:"manual",eventId:"",eventTitle:"",threshold:1,active:true,sort_order:3,createdAt:isoTime(-100,12,0),updatedAt:isoTime(0,12,0)}
    ];

    const socialPeople = users.map(socialFor);
    const swipes = [
      {id:"thumb-1",fromId:"bali-user-nikolay",toId:"bali-user-anna",decision:"thumb",createdAt:isoTime(-2,19,0)},
      {id:"thumb-2",fromId:"bali-user-anna",toId:"bali-user-nikolay",decision:"thumb",createdAt:isoTime(-1,20,0)},
      {id:"thumb-3",fromId:"bali-user-sofia",toId:"bali-user-nikolay",decision:"thumb",createdAt:isoTime(-1,21,0)},
      {id:"thumb-4",fromId:"bali-user-maxim",toId:"bali-user-daria",decision:"thumb",createdAt:isoTime(-3,22,0)}
    ];

    const requests = [
      {id:"request-1",fromId:"bali-user-anna",fromName:"Анна Мороз",toId:"bali-user-nikolay",toName:"Николай",type:"event",status:"pending",eventId:"event-demo-tropic",eventTitle:"Tropic Party",eventDate:isoDate(5),createdAt:isoTime(-1,18,30)},
      {id:"request-2",fromId:"bali-user-nikolay",fromName:"Николай",toId:"bali-user-maxim",toName:"Максим Орлов",type:"table",status:"accepted",eventId:"event-demo-black",eventTitle:"BALI Black Night",eventDate:isoDate(14),createdAt:isoTime(-4,19,0),respondedAt:isoTime(-3,10,0)}
    ];

    const gifts = [
      {id:"gift-1",fromId:"bali-user-anna",fromName:"Анна Мороз",toId:"bali-user-nikolay",toName:"Николай",giftId:"cocktail",giftName:"Коктейль",icon:"🍸",stars:50,source:"demo",createdAt:isoTime(-2,23,0)},
      {id:"gift-2",fromId:"bali-user-maxim",fromName:"Максим Орлов",toId:"bali-user-daria",toName:"Дарья Ночь",giftId:"rose",giftName:"Роза",icon:"🌹",stars:25,source:"demo",createdAt:isoTime(-3,22,30)}
    ];

    const chips = Object.fromEntries(users.map((user,index)=>[user.key,[12,24,7,15,3,9][index]]));
    const chipRequests = [
      {id:"chip-request-demo-1",lookup_token:"demo-token-1",user_key:"bali-user-sofia",telegram_id:910004,name:"София Волкова",phone:"375447778899",telegram:"@sofia_wave",quantity:5,points_cost:500,rate_points:100,status:"pending",created_at:isoTime(-1,21,0),fulfilled_at:null,fulfilled_by:"",cancelled_at:null,cancelled_by:"",refund_at:null},
      {id:"chip-request-demo-2",lookup_token:"demo-token-2",user_key:"bali-user-maxim",telegram_id:910003,name:"Максим Орлов",phone:"375333456789",telegram:"@max_orlov",quantity:3,points_cost:300,rate_points:100,status:"fulfilled",created_at:isoTime(-5,21,0),fulfilled_at:isoTime(-4,20,0),fulfilled_by:"BALI Admin",cancelled_at:null,cancelled_by:"",refund_at:null}
    ];

    write("bali_events_v2", events);
    write("bali_menu_v2", menu);
    write("bali_tables_v2", tables);
    write("bali_customers_v2", customers);
    write("bali_bookings_v2", bookings);
    write("bali_bonus_settings_v1", {referral:50,attendance:100,eventShare:10});
    write("bali_bonus_ledger_v1", ledger);
    write("bali_bonus_actions_v1", {});
    write("bali_attendance_codes_v1", [
      {code:"BALI-DEMO-100",amount:100,eventTitle:"BALI Neon Crown",createdAt:isoTime(-1,12,0),usedAt:null,usedBy:null},
      {code:"BALI-DEMO-250",amount:250,eventTitle:"Tropic Party",createdAt:isoTime(-1,12,0),usedAt:null,usedBy:null}
    ]);
    write("bali_points_accounts_v1", accounts);
    write("bali_beta4_vip_gifts_v1", [
      {id:"gift-vip-anna",targetKeys:["bali-user-anna","phone:375291112233"],targetName:"Анна Мороз",targetPhone:"375291112233",targetTelegram:"@anna_moroz",planId:"legend",days:30,source:"admin_gift",note:"Подарок для тестирования",purchasedAt:isoTime(-2,12,0),expiresAt:isoTime(28,12,0),revokedAt:null}
    ]);
    write("bali_vip_config_v1", {});
    write("bali_beta4_loyalty_config_v1", {chipRatePoints:100,chipDescription:"Демо-фишки можно тестово обменивать на баре BALI.",vipPointPrices:{vip:2500,black:5000,legend:9000}});
    write("bali_beta4_chips_v1", chips);
    write("bali_beta4_chip_history_v1", users.map((user,index)=>({id:`chip-history-${index}`,userKey:user.key,amount:chips[user.key],title:"Начальный демо-баланс",createdAt:isoTime(-7+index,12,0)})));
    write("bali_beta4_custom_rewards_v1", rewards);
    write("bali_beta4_reward_grants_v1", [
      {id:"grant-demo-1",rewardId:"reward-demo-regular",userKey:"bali-user-nikolay",userName:"Николай",source:"auto_visits",xp:300,earnedAt:isoTime(-20,12,0)},
      {id:"grant-demo-2",rewardId:"reward-demo-regular",userKey:"bali-user-anna",userName:"Анна Мороз",source:"auto_visits",xp:300,earnedAt:isoTime(-30,12,0)}
    ]);
    write("bali_app_users_v1", appUsers);
    write("bali_social_people_v1", socialPeople);
    write("bali_social_requests_v1", requests);
    write("bali_social_gifts_v1", gifts);
    write("bali_social_swipes_v2", swipes);
    write("bali_event_checkins_v1", checkins);
    write("bali_event_rsvps_v1", {"event-demo-crown":Object.fromEntries(users.map(user=>[user.key,{user_key:user.key,name:user.name,telegram:user.username,telegram_id:user.telegramId,status:"checked_in",attendance_mode:"qr",updated_at:isoTime(0,22,30)}]))});
    write("bali_event_qr_trust_v2", {"event-demo-crown":"demo-crown-token","event-demo-tropic":"demo-tropic-token"});
    write("bali_night_crown_entries_v1", crownEntries);
    write("bali_night_crown_votes_v1", crownVotes);
    write("bali_night_crown_prizes_v1", [
      {id:"crown-prize-demo-1",event_id:"event-demo-crown",event_title:"BALI Neon Crown",event_date:isoDate(0),user_key:"bali-user-anna",name:"Анна Мороз",gender:"female",prize_type:"points",prize_value:"500",note:"Демо-приз лидеру голосования",awarded_at:isoTime(0,23,30),applied_at:isoTime(0,23,30)}
    ]);
    write("bali_chip_requests_v1", chipRequests);
    write("bali_home_design_v1", {});
    write(USERS_KEY, users);
    localStorage.setItem(VERSION_KEY, String(VERSION));
    if (!localStorage.getItem(ACTIVE_KEY) || !byKey[localStorage.getItem(ACTIVE_KEY)]) localStorage.setItem(ACTIVE_KEY, defaultUser);
  }

  function achievementsFor(user) {
    const all = ["first_open"];
    if (user.bookings > 0) all.push("first_booking");
    if (user.visits > 0) all.push("first_visit");
    if (user.visits >= 8) all.push("social");
    if (user.bookings >= 5) all.push("company");
    if (user.vip || user.key === "bali-user-anna") all.push("vip_member");
    return Object.fromEntries(all.map((id,index)=>[id,isoTime(-30+index,12,0)]));
  }

  function localVipFor(user) {
    if (!user.vip) return null;
    return {
      id:`demo-vip-${user.key}`,planId:user.vip.planId,source:"demo",purchasedAt:isoTime(-(user.vip.days-user.vip.remainingDays),12,0),
      expiresAt:isoTime(user.vip.remainingDays,12,0),stars:user.vip.planId==="black"?699:299,days:user.vip.days
    };
  }

  function applyUser(key) {
    const user = byKey[key] || byKey[defaultUser];
    localStorage.setItem(ACTIVE_KEY, user.key);
    write("bali_bonus_profile_v1", pointAccountFor(user));
    write("bali_beta4_profile_v1", profileFor(user));
    write("bali_beta4_achievements_v1", achievementsFor(user));
    const vip = localVipFor(user);
    if (vip) write("bali_beta4_vip_v1", vip); else localStorage.removeItem("bali_beta4_vip_v1");
    write("bali_age_verification_v1", {verified:true,birthDate:user.birthDate,verifiedAt:isoTime(-100,12,0)});
    write("bali_social_profile_v1", socialFor(user));
    try { sessionStorage.removeItem("bali_app_user_registered"); } catch {}
    window.dispatchEvent(new CustomEvent("bali:demo-user-changed", {detail:{userKey:user.key}}));
    return user;
  }

  function reset() {
    CONTROLLED_KEYS.forEach(key => localStorage.removeItem(key));
    localStorage.removeItem(VERSION_KEY);
    seedAll();
    return applyUser(defaultUser);
  }

  if (String(localStorage.getItem(VERSION_KEY) || "") !== String(VERSION)) seedAll();
  const active = applyUser(localStorage.getItem(ACTIVE_KEY) || defaultUser);

  window.BaliDemo = {
    version:VERSION,
    keys:{version:VERSION_KEY,active:ACTIVE_KEY,users:USERS_KEY},
    users,
    activeUser:() => byKey[localStorage.getItem(ACTIVE_KEY)] || active,
    selectUser:applyUser,
    reset,
    reseed:reset
  };
})();
