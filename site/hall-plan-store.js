(() => {
  const store = window.BaliStore;
  const client = store?.client;
  const cloudEnabled = Boolean(store?.cloudEnabled && client);
  const localKey = "bali_hall_plan_settings_v1";
  const defaultSettings = {
    id: "main",
    background_url: "./hall-plan.svg",
    aspect_ratio: 1,
    updated_at: null
  };

  const emitChange = () => window.dispatchEvent(new CustomEvent("bali:hall-plan-changed"));

  function readLocal() {
    try {
      const saved = JSON.parse(localStorage.getItem(localKey) || "null");
      return saved ? { ...defaultSettings, ...saved } : { ...defaultSettings };
    } catch {
      return { ...defaultSettings };
    }
  }

  function writeLocal(settings) {
    localStorage.setItem(localKey, JSON.stringify(settings));
    emitChange();
    return settings;
  }

  async function getSettings() {
    if (!cloudEnabled) return readLocal();
    const { data, error } = await client
      .from("hall_settings")
      .select("*")
      .eq("id", "main")
      .maybeSingle();
    if (error) throw error;
    return data ? { ...defaultSettings, ...data } : { ...defaultSettings };
  }

  async function saveSettings(settings) {
    const payload = {
      id: "main",
      background_url: settings.background_url || "",
      aspect_ratio: Number(settings.aspect_ratio || 1),
      updated_at: new Date().toISOString()
    };
    if (!cloudEnabled) return writeLocal(payload);
    const { data, error } = await client
      .from("hall_settings")
      .upsert(payload)
      .select()
      .single();
    if (error) throw error;
    emitChange();
    return data;
  }

  function loadImage(source) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Не удалось прочитать изображение"));
      image.src = source;
    });
  }

  async function prepareImage(file) {
    if (!file || !/^image\/(png|jpeg|webp)$/i.test(file.type)) {
      throw new Error("Поддерживаются JPG, PNG и WEBP");
    }
    if (file.size > 12 * 1024 * 1024) {
      throw new Error("Размер изображения не должен превышать 12 МБ");
    }

    const objectUrl = URL.createObjectURL(file);
    try {
      const image = await loadImage(objectUrl);
      const maxSide = 2200;
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { alpha: true });
      context.drawImage(image, 0, 0, width, height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.88));
      if (!blob) throw new Error("Не удалось подготовить изображение");
      return {
        blob,
        dataUrl: canvas.toDataURL("image/webp", 0.88),
        aspectRatio: width / height
      };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  async function uploadFile(file) {
    const prepared = await prepareImage(file);
    if (!cloudEnabled) {
      return saveSettings({
        background_url: prepared.dataUrl,
        aspect_ratio: prepared.aspectRatio
      });
    }

    const suffix = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    const path = `main/${Date.now()}-${suffix}.webp`;
    const { error: uploadError } = await client.storage
      .from("hall-plans")
      .upload(path, prepared.blob, {
        contentType: "image/webp",
        cacheControl: "3600",
        upsert: false
      });
    if (uploadError) throw uploadError;

    const { data } = client.storage.from("hall-plans").getPublicUrl(path);
    return saveSettings({
      background_url: data.publicUrl,
      aspect_ratio: prepared.aspectRatio
    });
  }

  async function useUrl(url) {
    const normalized = String(url || "").trim();
    if (!normalized) throw new Error("Укажите ссылку на изображение");
    const image = await loadImage(normalized);
    return saveSettings({
      background_url: normalized,
      aspect_ratio: image.naturalWidth / image.naturalHeight
    });
  }

  async function reset() {
    if (!cloudEnabled) {
      localStorage.removeItem(localKey);
      emitChange();
      return { ...defaultSettings };
    }
    return saveSettings({ background_url: "", aspect_ratio: 1 });
  }

  async function apply(element) {
    if (!element) return;
    const settings = await getSettings();
    const url = settings.background_url || defaultSettings.background_url;
    element.style.backgroundImage = `linear-gradient(rgba(255,255,255,.015),rgba(255,255,255,.015)),url("${String(url).replace(/"/g, '\\"')}")`;
    element.style.aspectRatio = String(Number(settings.aspect_ratio || 1));
    element.dataset.hallBackground = url;
  }

  async function applyAll() {
    const elements = [...document.querySelectorAll(".hall-map,.hall-layout")];
    await Promise.all(elements.map((element) => apply(element).catch(() => {})));
  }

  const observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => [...mutation.addedNodes].some((node) => node.nodeType === 1 && (node.matches?.(".hall-map,.hall-layout") || node.querySelector?.(".hall-map,.hall-layout"))))) {
      applyAll();
    }
  });

  if (document.documentElement) observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("bali:hall-plan-changed", applyAll);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", applyAll);
  else applyAll();

  window.BaliHallPlan = {
    cloudEnabled,
    getSettings,
    saveSettings,
    uploadFile,
    useUrl,
    reset,
    apply,
    applyAll
  };
})();