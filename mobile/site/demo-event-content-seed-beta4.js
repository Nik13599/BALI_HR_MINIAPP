(() => {
  if (!window.BaliDemo || window.__BALI_EVENT_CONTENT_DEMO_SEED__) return;
  window.__BALI_EVENT_CONTENT_DEMO_SEED__ = true;

  const VERSION_KEY = "bali_event_content_demo_seed_v1";
  if (localStorage.getItem(VERSION_KEY) === "1") return;

  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const svg = (title, subtitle, a = "#c8ff3d", b = "#153f2d") => {
    const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900" viewBox="0 0 900 900"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="900" height="900" fill="#080a0a"/><circle cx="680" cy="180" r="330" fill="url(#g)" opacity=".72"/><circle cx="140" cy="760" r="390" fill="url(#g)" opacity=".28"/><text x="62" y="690" fill="#fff" font-family="Arial" font-size="74" font-weight="900">${title}</text><text x="62" y="760" fill="#c8ff3d" font-family="Arial" font-size="34" font-weight="700">${subtitle}</text><text x="62" y="842" fill="#b9c2bc" font-family="Arial" font-size="25">BALI · МИНСК · КИРОВА, 13</text></svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(markup)}`;
  };

  const people = read("bali_social_people_v1", []);
  const photo = id => people.find(person => person.id === id)?.photo || "";
  const events = read("bali_events_v2", []);
  const lineupByEvent = {
    "event-demo-crown": [
      { id:"artist-ani", role:"DJ", name:"DJ ANI", photo_url:photo("bali-user-nikolay") || svg("DJ ANI","HEADLINER"), social_url:"https://www.instagram.com/baliminsk/" },
      { id:"artist-maxim-mc", role:"MC", name:"Максим Орлов", photo_url:photo("bali-user-maxim") || svg("MC MAXIM","HOST","#4dd4ff","#123e7a"), social_url:"https://t.me/baliclubminsk" }
    ],
    "event-demo-tropic": [
      { id:"artist-ani-tropic", role:"DJ", name:"DJ ANI", photo_url:photo("bali-user-nikolay") || svg("DJ ANI","TROPIC SET"), social_url:"https://www.instagram.com/baliminsk/" },
      { id:"artist-sofia", role:"Go-Go", name:"Sofia Wave", photo_url:photo("bali-user-sofia") || svg("SOFIA","GO-GO","#f4cf5d","#9f3f28"), social_url:"https://t.me/baliclubminsk" },
      { id:"artist-dance", role:"Шоу-балет", name:"BALI Show", photo_url:svg("BALI SHOW","DANCE PERFORMANCE","#ff6fb1","#5d1b67"), social_url:"" }
    ],
    "event-demo-football": [
      { id:"artist-commentator", role:"Ведущий", name:"MC Иван", photo_url:photo("bali-user-artem") || svg("MC IVAN","FOOTBALL HOST","#f4cf5d","#603b16"), social_url:"https://t.me/baliclubminsk" }
    ],
    "event-demo-black": [
      { id:"artist-secret", role:"Secret Guest", name:"Будет объявлен", photo_url:svg("SECRET","SPECIAL GUEST","#a783ff","#281340"), social_url:"" }
    ]
  };

  const patchedEvents = events.map(event => {
    const lineup = lineupByEvent[event.id];
    if (!lineup) return event;
    return {
      ...event,
      details_description: event.details_description || `${event.description || "Событие BALI"}\n\nВ подробной программе представлены участники вечера, специальная шоу-программа, бар, кальяны и клубная атмосфера BALI.`,
      performers: Array.isArray(event.performers) && event.performers.length ? event.performers : lineup
    };
  });
  write("bali_events_v2", patchedEvents);

  const venueRows = read("bali_venue_content_v1", []);
  if (!venueRows.length || !parseInt(venueRows[0]?.media?.length || 0, 10)) {
    write("bali_venue_content_v1", [{
      id:"venue-main",
      title:"Площадка BALI",
      description:"BALI — клубная площадка в центре Минска. Здесь объединены танцпол, профессиональный звук, большие экраны, контактный бар, кухня, кальяны, столы и VIP-зоны. Пространство подходит как для свободного клубного отдыха, так и для событий с индивидуальной программой.",
      formats:"Клубные вечеринки и DJ-сеты\nКонцерты и выступления артистов\nСпортивные трансляции на больших экранах\nЗакрытые мероприятия и презентации\nДни рождения, корпоративы и частные события",
      media:[
        { id:"venue-floor", type:"image", title:"Танцпол и сцена", url:svg("ТАНЦПОЛ","СЦЕНА · СВЕТ · ЗВУК","#c8ff3d","#174c3c") },
        { id:"venue-screens", type:"image", title:"Большие экраны", url:svg("ЭКРАНЫ","ТРАНСЛЯЦИИ · ШОУ","#4dd4ff","#123e7a") },
        { id:"venue-vip", type:"image", title:"VIP-зона и столы", url:svg("VIP ЗОНА","КОМФОРТНАЯ РАССАДКА","#e3bd64","#5d3418") }
      ],
      active:true,
      updated_at:new Date().toISOString()
    }]);
  }

  const reviews = read("bali_reviews_v1", []);
  if (!reviews.length) {
    write("bali_reviews_v1", [
      { id:"review-demo-1", user_key:"bali-user-anna", user_name:"Анна Мороз", telegram:"@anna_moroz", event_id:"event-demo-tropic", event_title:"Tropic Party", type:"artist", rating:5, message:"Хотелось бы чаще видеть расширенный DJ-состав и отдельный блок с именами артистов в афише.", status:"new", created_at:new Date(Date.now()-3600000).toISOString(), updated_at:new Date(Date.now()-3600000).toISOString() },
      { id:"review-demo-2", user_key:"bali-user-maxim", user_name:"Максим Орлов", telegram:"@max_orlov", event_id:"", event_title:"", type:"improvement", rating:4, message:"Добавьте больше фотографий площадки и короткие видео с разных зон клуба.", status:"reviewed", created_at:new Date(Date.now()-86400000).toISOString(), updated_at:new Date(Date.now()-72000000).toISOString() }
    ]);
  }

  localStorage.setItem(VERSION_KEY, "1");
  window.dispatchEvent(new CustomEvent("bali:data-changed", { detail:{ table:"events" } }));
})();