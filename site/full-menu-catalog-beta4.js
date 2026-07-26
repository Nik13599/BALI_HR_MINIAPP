(() => {
  if (window.__BALI_FULL_MENU_CATALOG__) return;
  window.__BALI_FULL_MENU_CATALOG__ = true;

  const VERSION = 1;
  const VERSION_KEY = "bali_full_menu_catalog_version_v1";
  const STORAGE_KEY = "bali_menu_v2";
  const SOURCE = "bali_full_menu_2026";

  const raw = [
    ["Холодные закуски", "Ассорти сырное", "130/40/20", 21],
    ["Холодные закуски", "Ассорти мясное", "170/20/5", 25],
    ["Холодные закуски", "Сёмга слабосолёная", "120", 30],
    ["Холодные закуски", "Ассорти овощное", "200", 20],
    ["Холодные закуски", "Мясная тарелка", "200", 30],
    ["Холодные закуски", "Рыбная тарелка", "200", 30],
    ["Холодные закуски", "Сырная тарелка", "200", 30],
    ["Холодные закуски", "Овощная тарелка", "200", 20],
    ["Холодные закуски", "Фруктовая тарелка", "1500", 50],

    ["Горячие закуски", "Драники со сметаной", "150/50 · 4 шт.", 20],
    ["Горячие закуски", "Драники с курицей и грибами", "150/150", 30],
    ["Горячие закуски", "Драники с лососем", "150/70", 35],
    ["Горячие закуски", "Мясное плато", "300", 45],

    ["Паста", "Паста с курицей и грибами", "150/130", 25],
    ["Паста", "Паста карбонара", "150/120", 25],

    ["Гарниры и закуски", "Картофель фри с кетчупом", "150", 10],
    ["Гарниры и закуски", "Куриные наггетсы с кетчупом", "150", 15],
    ["Гарниры и закуски", "Картофельные дольки с кетчупом", "150", 12],
    ["Гарниры и закуски", "Гренки чесночные", "150", 14],
    ["Гарниры и закуски", "Пивной сет", "500", 55],

    ["Шашлыки", "Шашлык из курицы", "200/50", 28],
    ["Шашлыки", "Шашлык из свинины", "200/50", 32],
    ["Шашлыки", "Шашлык из говядины", "200/50", 35],
    ["Шашлыки", "Люля-кебаб из курицы", "200/50", 28],
    ["Шашлыки", "Люля-кебаб из говядины", "200/50", 32],
    ["Шашлыки", "Овощи на мангале", "200", 18],
    ["Шашлыки", "Шашлык из телятины", "180", 34],

    ["Соусы", "Кетчуп", "50", 3],
    ["Соусы", "Сметана", "50", 3],
    ["Соусы", "Майонез", "50", 3],
    ["Соусы", "Аджика", "50", 3],
    ["Соусы", "Тар-тар", "50", 3],
    ["Соусы", "Наршараб", "50", 3],

    ["Напитки", "Вода без газа / с газом", "500 мл", 5],
    ["Напитки", "Сок в ассортименте", "250 мл", 7],
    ["Напитки", "Coca-Cola / Sprite / Fanta", "500 мл", 7],
    ["Напитки", "Энергетические напитки", "250 мл", 10],

    ["Выпечка", "Хлеб ржаной", "1/60", 1],
    ["Выпечка", "Лаваш", "200", 5],
    ["Выпечка", "Хачапури по-аджарски", "450", 28],
    ["Выпечка", "Хачапури по-мегрельски", "600", 28]
  ];

  const slug = value => String(value || "")
    .toLocaleLowerCase("ru")
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  const catalog = raw.map(([category, name, weight, price], index) => ({
    id: `menu-bali-${String(index + 1).padStart(2, "0")}-${slug(name)}`,
    category,
    name,
    description: weight ? `Выход: ${weight}` : "",
    weight,
    price,
    active: true,
    sort_order: index + 1,
    source: SOURCE
  }));

  const read = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  function install() {
    const existing = read();
    const defaultIds = new Set(["menu-1", "menu-2", "menu-3", "menu-4", "menu-5", "menu-6"]);
    const catalogIds = new Set(catalog.map(item => item.id));
    const custom = existing.filter(item => !defaultIds.has(String(item.id)) && !catalogIds.has(String(item.id)) && item.source !== SOURCE);
    const next = [...catalog, ...custom.map((item, index) => ({
      ...item,
      sort_order: Number(item.sort_order || catalog.length + index + 1)
    }))];

    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    localStorage.setItem(VERSION_KEY, String(VERSION));
    window.dispatchEvent(new CustomEvent("bali:data-changed", { detail:{ table:"menu_items", source:SOURCE, count:catalog.length } }));
    return next;
  }

  if (localStorage.getItem(VERSION_KEY) !== String(VERSION)) install();
  window.BaliFullMenuCatalog = { version:VERSION, source:SOURCE, catalog, install };
})();