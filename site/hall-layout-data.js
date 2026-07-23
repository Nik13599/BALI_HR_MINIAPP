(() => {
  const version = 5;
  const versionKey = "bali_hall_layout_version";
  const storageKey = "bali_tables_v2";
  const layout = [
    { id:"table-1",  name:"Стол 1",  seats:4,  x:26.5, y:85.0, shape:"vip", active:true },
    { id:"table-2",  name:"Стол 2",  seats:6,  x:18.6, y:86.0, shape:"vip", active:true },
    { id:"table-3",  name:"Стол 3",  seats:6,  x:10.7, y:84.0, shape:"vip", active:true },
    { id:"table-4",  name:"Стол 4",  seats:6,  x:9.4,  y:74.0, shape:"vip", active:true },
    { id:"table-5",  name:"Стол 5",  seats:6,  x:17.0, y:74.0, shape:"vip", active:true },
    { id:"table-6",  name:"Стол 6",  seats:6,  x:60.5, y:83.0, shape:"vip", active:true },
    { id:"table-7",  name:"Стол 7",  seats:4,  x:18.4, y:58.0, shape:"square", active:true },
    { id:"table-8",  name:"Стол 8",  seats:4,  x:18.4, y:46.0, shape:"square", active:true },
    { id:"table-9",  name:"Стол 9",  seats:6,  x:20.0, y:30.0, shape:"vip", active:true },
    { id:"table-10", name:"Стол 10", seats:4,  x:25.5, y:23.5, shape:"square", active:true },
    { id:"table-11", name:"Стол 11", seats:6,  x:33.0, y:14.5, shape:"vip", active:true },
    { id:"table-12", name:"Стол 12", seats:4,  x:34.2, y:45.2, shape:"square", active:true },
    { id:"table-13", name:"Стол 13", seats:4,  x:34.5, y:58.0, shape:"square", active:true },
    { id:"table-14", name:"Стол 14", seats:4,  x:77.2, y:68.2, shape:"square", active:true },
    { id:"table-15", name:"Стол 15", seats:4,  x:81.0, y:62.0, shape:"square", active:true },
    { id:"table-16", name:"Стол 16", seats:4,  x:81.5, y:53.0, shape:"square", active:true },
    { id:"table-17", name:"Стол 17", seats:4,  x:81.0, y:43.5, shape:"square", active:true },
    { id:"table-18", name:"Стол 18", seats:4,  x:77.5, y:36.0, shape:"square", active:true },
    { id:"table-19", name:"Стол 19", seats:8,  x:82.5, y:12.5, shape:"vip", active:true },
    { id:"table-20", name:"Стол 20", seats:6,  x:61.5, y:24.5, shape:"vip", active:true },
    { id:"table-21", name:"Стол 21", seats:6,  x:61.0, y:11.5, shape:"vip", active:true },
    { id:"table-23", name:"Стол 23", seats:6,  x:54.5, y:11.5, shape:"vip", active:true },
    { id:"table-24", name:"Стол 24", seats:6,  x:46.5, y:11.5, shape:"vip", active:true },
    { id:"table-25", name:"Стол 25", seats:6,  x:46.5, y:24.5, shape:"vip", active:true },
    { id:"table-26", name:"Стол 26", seats:4,  x:42.0, y:83.5, shape:"square", active:true }
  ];

  if (!window.BaliStore?.cloudEnabled) {
    let current = [];
    try { current = JSON.parse(localStorage.getItem(storageKey) || "[]"); } catch {}
    if (!Array.isArray(current) || current.length === 0 || Number(localStorage.getItem(versionKey) || 0) < version) {
      localStorage.setItem(storageKey, JSON.stringify(Array.isArray(current) && current.length ? current : layout));
      localStorage.setItem(versionKey, String(version));
    }
  }
  window.BALI_HALL_LAYOUT = layout;
})();