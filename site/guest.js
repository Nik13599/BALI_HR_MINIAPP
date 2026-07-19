const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const store = window.BaliStore;
const tg = window.Telegram?.WebApp;
const state = { menu: [], events: [], cart: new Map(), category: "Все", selectedTable: null, availability: [] };
const esc = (value = "") => String(value).replace(/[&<>'"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[ch]));
const money = (value) => `${Number(value || 0).toLocaleString("ru-RU")} BYN`;
const formatDate = (value) => new Date(`${value}T12:00:00`).toLocaleDateString("ru-RU", { day: "2-digit", month: "long" });
const tableNumber = (name = "") => String(name).replace(/^Стол\s*/i, "").replace(/^VIP\s*/i, "VIP ");
const HALL_LAYOUT_STORAGE_KEY = "bali_hall_layout_config_v1";
const DEFAULT_HALL_LAYOUT = { image: "", imageName: "", updatedAt: null };

function readHallLayoutConfig() {
  try {
    const raw = localStorage.getItem(HALL_LAYOUT_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_HALL_LAYOUT };
    return { ...DEFAULT_HALL_LAYOUT, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_HALL_LAYOUT };
  }
}

function toCssUrl(value = "") {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "%27");
}

function buildHallBackground(config, baseLayers = "") {
  if (!config?.image) return "";
  const safe = toCssUrl(config.image);
  return `${baseLayers ? `${baseLayers}, ` : ""}url('${safe}')`;
}

if (tg) {
  tg.ready();
  tg.expand();
  tg.setHeaderColor("#080a0a");
  tg.setBackgroundColor("#080a0a");
}

function haptic(type = "light") { try { tg?.HapticFeedback?.impactOccurred(type); } catch {} }
function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 2400);
}

async function loadContent() {
  [state.events, state.menu] = await Promise.all([
    store.list("events", { order: "sort_order" }),
    store.list("menu_items", { order: "sort_order" })
  ]);
  state.events = state.events.filter((item) => item.active !== false);
  state.menu = state.menu.filter((item) => item.active !== false);
  renderEvents();
  renderCategories();
  renderMenu();
}

function renderEvents() {
  const track = $("#eventTrack");
  $("#eventCount").textContent = `${state.events.length} событий`;
  track.innerHTML = state.events.length ? state.events.map((event, index) => `
    <article class="poster poster-${(index % 3) + 1}" data-event="${event.id}">
      ${event.image_url ? `<img src="${esc(event.image_url)}" alt="${esc(event.title)}"/>` : ""}
      <div class="poster-visual"><small>BALI PRESENTS</small><b>${esc(event.title)}</b><i>${formatDate(event.event_date)} · ${esc(event.event_time)}</i></div>
      <div class="poster-info"><span>${formatDate(event.event_date)}</span><h3>${esc(event.title)}</h3><p>${esc(event.description)}</p></div>
    </article>`).join("") : '<div class="empty-card">Новые афиши скоро появятся</div>';
}

function renderCategories() {
  const cats = ["Все", ...new Set(state.menu.map((item) => item.category))];
  $("#categoryTabs").innerHTML = cats.map((cat) => `<button class="category ${state.category === cat ? "active" : ""}" data-category="${esc(cat)}">${esc(cat)}</button>`).join("");
}

function renderMenu() {
  const rows = state.category === "Все" ? state.menu : state.menu.filter((item) => item.category === state.category);
  $("#menuGrid").innerHTML = rows.length ? rows.map((item) => `
    <article class="menu-card">
      <div class="menu-glow"></div><span class="menu-category">${esc(item.category)}</span>
      <h3>${esc(item.name)}</h3><p>${esc(item.description)}</p>
      <footer><strong>${money(item.price)}</strong><button data-add="${item.id}" aria-label="Добавить ${esc(item.name)}">＋</button></footer>
    </article>`).join("") : '<div class="empty-card">В этой категории пока нет позиций</div>';
}

function renderCart() {
  const rows = [...state.cart.entries()].map(([id, qty]) => ({ item: state.menu.find((menuItem) => menuItem.id === id), qty })).filter((row) => row.item);
  const total = rows.reduce((sum, row) => sum + Number(row.item.price) * row.qty, 0);
  $("#cartCount").textContent = rows.reduce((sum, row) => sum + row.qty, 0);
  $("#cartItems").innerHTML = rows.length ? rows.map(({ item, qty }) => `<div class="cart-row"><div><strong>${esc(item.name)}</strong><small>${qty} × ${money(item.price)}</small></div><div><button data-cart-minus="${item.id}">−</button><b>${qty}</b><button data-cart-plus="${item.id}">＋</button></div></div>`).join("") : '<div class="empty-card">Корзина пока пуста</div>';
  $("#cartTotal").textContent = money(total);
}

async function loadAvailability() {
  const date = $("#bookingDate").value;
  if (!date) return;
  state.availability = await store.getAvailability(date);
  state.availability.sort((a, b) => Number(tableNumber(a.name)) - Number(tableNumber(b.name)));
  if (state.selectedTable && !state.availability.find((t) => t.id === state.selectedTable && t.available)) state.selectedTable = null;
  renderHall();
}

function clearHallBackground(node) {
  node.style.removeProperty("background-image");
  node.style.removeProperty("background-size");
  node.style.removeProperty("background-position");
  node.style.removeProperty("background-repeat");
}

function renderHall() {
  const hall = $("#hallMap");
  const config = readHallLayoutConfig();
  hall.classList.toggle("has-background", Boolean(config.image));
  if (config.image) {
    hall.style.backgroundImage = buildHallBackground(config, "radial-gradient(circle at 50% 42%,rgba(200,255,61,.10),transparent 34%),linear-gradient(145deg,rgba(18,18,16,.88),rgba(8,10,9,.95))");
    hall.style.backgroundSize = "auto, auto, cover";
    hall.style.backgroundPosition = "center, center, center";
    hall.style.backgroundRepeat = "no-repeat, no-repeat, no-repeat";
  } else {
    clearHallBackground(hall);
  }
  hall.innerHTML = state.availability.map((table) => `
    <button
      type="button"
      class="guest-table ${esc(table.shape || "round")} ${table.available ? "free" : "booked"} ${state.selectedTable === table.id ? "selected" : ""}"
      style="left:${Number(table.x)}%;top:${Number(table.y)}%"
      data-table="${table.id}"
      title="${esc(table.name)} · ${table.seats} мест · ${table.available ? "свободен" : "занят"}"
      aria-label="${esc(table.name)}, ${table.seats} мест, ${table.available ? "свободен" : "занят"}"
      ${table.available ? "" : "disabled"}>
      <b>${esc(tableNumber(table.name))}</b>
      <small>${table.available ? "свободен" : "занят"}</small>
    </button>`).join("");

  const selected = state.availability.find((t) => t.id === state.selectedTable);
  $("#selectedTableText").textContent = selected
    ? `${selected.name} · ${selected.seats} мест · свободен`
    : "Выберите свободный стол на схеме";
  $("#selectedTableId").value = selected?.id || "";
}

$("#categoryTabs").addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  state.category = button.dataset.category;
  haptic();
  renderCategories();
  renderMenu();
});

$("#menuGrid").addEventListener("click", (event) => {
  const button = event.target.closest("[data-add]");
  if (!button) return;
  const id = button.dataset.add;
  state.cart.set(id, (state.cart.get(id) || 0) + 1);
  haptic();
  renderCart();
  toast("Добавлено в заказ");
});

$("#cartItems").addEventListener("click", (event) => {
  const plus = event.target.closest("[data-cart-plus]");
  const minus = event.target.closest("[data-cart-minus]");
  const id = plus?.dataset.cartPlus || minus?.dataset.cartMinus;
  if (!id) return;
  const qty = (state.cart.get(id) || 0) + (plus ? 1 : -1);
  if (qty <= 0) state.cart.delete(id); else state.cart.set(id, qty);
  renderCart();
});

$("#hallMap").addEventListener("click", (event) => {
  const table = event.target.closest("[data-table]");
  if (!table || table.disabled) return;
  state.selectedTable = table.dataset.table;
  haptic("medium");
  renderHall();
});

$("#bookingDate").addEventListener("change", loadAvailability);

$("#bookingForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = Object.fromEntries(new FormData(event.currentTarget).entries());
  if (!form.table_id) return toast("Сначала выберите свободный стол");
  try {
    const selected = state.availability.find((t) => t.id === form.table_id);
    await store.createBooking(form);
    haptic("heavy");
    event.currentTarget.reset();
    $("#bookingDate").value = new Date().toISOString().slice(0, 10);
    state.selectedTable = null;
    await loadAvailability();
    $("#successDialog").showModal();
    const username = (window.BALI_CONFIG?.telegramUsername || "").replace(/^@/, "");
    $("#telegramConfirm").href = username ? `https://t.me/${username}` : "#";
    $("#successText").textContent = `Заявка на ${selected?.name || "стол"} принята. Менеджер подтвердит бронь по телефону.`;
  } catch (error) {
    toast(error.message || "Не удалось создать бронь");
    await loadAvailability();
  }
});

$("#sendOrder").addEventListener("click", () => {
  const rows = [...state.cart.entries()].map(([id, qty]) => ({ item: state.menu.find((x) => x.id === id), qty })).filter((x) => x.item);
  if (!rows.length) return toast("Добавьте позиции в заказ");
  const lines = rows.map(({ item, qty }) => `• ${item.name} — ${qty} шт.`).join("\n");
  const username = (window.BALI_CONFIG?.telegramUsername || "").replace(/^@/, "");
  const text = encodeURIComponent(`Предзаказ BALI:\n${lines}`);
  const url = username ? `https://t.me/${username}?text=${text}` : `https://t.me/share/url?url=&text=${text}`;
  tg?.openTelegramLink ? tg.openTelegramLink(url) : window.open(url, "_blank");
});

$("#shareButton").addEventListener("click", () => {
  const url = location.href;
  if (navigator.share) navigator.share({ title: "BALI Minsk", text: "Афиши, меню и бронь столов", url });
  else navigator.clipboard.writeText(url).then(() => toast("Ссылка скопирована"));
});

$$('[data-open]').forEach((button) => button.addEventListener("click", () => $(button.dataset.open).showModal()));
$$('[data-close]').forEach((button) => button.addEventListener("click", () => button.closest("dialog").close()));
$$('[data-scroll]').forEach((button) => button.addEventListener("click", () => document.getElementById(button.dataset.scroll).scrollIntoView({ behavior: "smooth" })));

const today = new Date().toISOString().slice(0, 10);
$("#bookingDate").min = today;
$("#bookingDate").value = today;
window.addEventListener("bali:data-changed", () => { loadContent(); loadAvailability(); });
loadContent().catch((error) => toast(error.message));
loadAvailability().catch((error) => toast(error.message));
renderCart();