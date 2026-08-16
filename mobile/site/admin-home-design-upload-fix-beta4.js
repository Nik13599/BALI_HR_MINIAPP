(() => {
  if (window.__BALI_HOME_UPLOAD_FIX__ || !window.BaliHomeDesign) return;
  window.__BALI_HOME_UPLOAD_FIX__ = true;
  const design = window.BaliHomeDesign;
  let targetPath = "";
  const set = (object, path, value) => {
    const keys = String(path || "").split(".").filter(Boolean);
    let target = object;
    keys.slice(0, -1).forEach(key => target = target[key] ||= {});
    if (keys.length) target[keys.at(-1)] = value;
  };
  const notify = message => window.toast?.(message);

  function collectForm() {
    const current = design.read();
    const form = document.getElementById("homeDesignForm");
    if (!form) return current;
    new FormData(form).forEach((value, path) => {
      if (!path || path === "homeDesignImageInput") return;
      set(current, path, path.endsWith("minHeight") ? Number(value || 0) : value);
    });
    current.hero ||= {};
    current.hero.pills = [
      form.elements["hero.pill1"]?.value,
      form.elements["hero.pill2"]?.value,
      form.elements["hero.pill3"]?.value
    ].filter(Boolean);
    delete current.hero.pill1;
    delete current.hero.pill2;
    delete current.hero.pill3;
    return current;
  }

  function refresh() {
    if (typeof state !== "undefined" && state.view === "settings") {
      Promise.resolve(window.render?.()).catch(() => location.reload());
    }
  }

  document.addEventListener("click", event => {
    const pick = event.target.closest("[data-home-image]");
    if (pick) {
      event.preventDefault();
      event.stopImmediatePropagation();
      targetPath = pick.dataset.homeImage || "";
      const input = document.getElementById("homeDesignImageInput");
      if (!input) return notify("Поле загрузки не найдено. Обновите раздел настроек.");
      input.value = "";
      input.click();
      return;
    }
    const clear = event.target.closest("[data-home-image-clear]");
    if (clear) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const next = collectForm();
      set(next, clear.dataset.homeImageClear, "");
      design.write(next);
      notify("Изображение удалено");
      refresh();
    }
  }, true);

  document.addEventListener("change", async event => {
    if (event.target.id !== "homeDesignImageInput" || !targetPath) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const file = event.target.files?.[0];
    const path = targetPath;
    targetPath = "";
    event.target.value = "";
    if (!file) return;
    try {
      if (!/^image\/(png|jpeg|webp)$/i.test(file.type)) throw new Error("Поддерживаются PNG, JPG и WEBP");
      const next = collectForm();
      const compact = path.includes("logo") || path.includes("icon");
      set(next, path, await design.imageData(file, compact ? 640 : 1800, compact ? .92 : .84));
      try {
        design.write(next);
      } catch (error) {
        if (error?.name === "QuotaExceededError") throw new Error("Файл слишком большой. Уменьшите изображение и загрузите повторно.");
        throw error;
      }
      notify(path === "brand.logo" ? "Логотип клуба загружен и сохранён" : "Изображение загружено и сохранено");
      refresh();
    } catch (error) {
      notify(error.message || "Не удалось загрузить изображение");
    }
  }, true);
})();