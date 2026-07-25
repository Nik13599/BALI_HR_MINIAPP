(() => {
  if (window.__BALI_FULL_DEMO_DATA_UPGRADE__) return;
  window.__BALI_FULL_DEMO_DATA_UPGRADE__ = true;
  const VERSION = "2";
  const KEY = "bali_full_demo_data_upgrade_v2";
  if (localStorage.getItem(KEY) === VERSION) return;
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const usernames = {
    "bali-user-nikolay":"@nikolay_bali","bali-user-anna":"@anna_moroz","bali-user-maxim":"@max_orlov","bali-user-sofia":"@sofia_wave",
    "bali-user-artem":"@art_levin","bali-user-daria":"@daria_night","bali-user-alex":"@alex_green","bali-user-mila":"@mila_ray"
  };
  const people = read("bali_social_people_v1", []).map((person,index) => ({
    ...person,
    username:person.username || usernames[person.id] || "",
    shareTelegram:person.shareTelegram ?? (index % 3 !== 2),
    sharePhone:person.sharePhone ?? (index % 4 === 0),
    shareAge:person.shareAge ?? (index % 2 === 0),
    showPhoto:person.showPhoto ?? (index % 3 !== 1)
  }));
  write("bali_social_people_v1", people);
  const active = read("bali_social_profile_v1", {});
  const activePerson = people.find(person => String(person.id) === String(active.id)) || active;
  write("bali_social_profile_v1", { ...activePerson, ...active, username:active.username || activePerson.username || "", shareTelegram:active.shareTelegram ?? activePerson.shareTelegram ?? true, sharePhone:active.sharePhone ?? activePerson.sharePhone ?? false, shareAge:active.shareAge ?? activePerson.shareAge ?? true, showPhoto:active.showPhoto ?? activePerson.showPhoto ?? true });

  const users = read("bali_app_users_v1", {});
  Object.keys(users).forEach(id => { users[id] = { ...users[id], username:users[id].username || usernames[id] || "" }; });
  write("bali_app_users_v1", users);
  const accounts = read("bali_points_accounts_v1", {});
  Object.keys(accounts).forEach(id => { accounts[id] = { ...accounts[id], telegram:accounts[id].telegram || usernames[id] || "" }; });
  write("bali_points_accounts_v1", accounts);
  const customers = read("bali_customers_v2", []).map(row => {
    const person = people.find(item => String(item.phone || "").replace(/\D/g,"") === String(row.phone || "").replace(/\D/g,"")) || people.find(item => item.name === row.name || item.name === row.customer_name);
    return { ...row, telegram:row.telegram || person?.username || "" };
  });
  write("bali_customers_v2", customers);
  localStorage.setItem(KEY, VERSION);
  window.dispatchEvent(new CustomEvent("bali:social-changed"));
  window.dispatchEvent(new CustomEvent("bali:app-users-changed"));
})();