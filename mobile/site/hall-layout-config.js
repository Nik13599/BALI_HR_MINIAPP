(() => {
  const STORAGE_KEY = "bali_hall_layout_config_v1";
  const DEFAULT_CONFIG = { image: "", imageName: "", updatedAt: null };

  const read = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_CONFIG };
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_CONFIG, ...(parsed || {}) };
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  };

  const notify = () => {
    window.dispatchEvent(new CustomEvent("bali:data-changed", { detail: { table: "hall_layout" } }));
  };

  const write = (next = {}) => {
    const config = { ...DEFAULT_CONFIG, ...(next || {}) };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    notify();
    return config;
  };

  const clear = () => {
    localStorage.removeItem(STORAGE_KEY);
    notify();
    return { ...DEFAULT_CONFIG };
  };

  const safeCssUrl = (value = "") => String(value).replace(/\\/g, "\\\\").replace(/'/g, "%27");

  const buildBackgroundImage = (config, baseLayers = "") => {
    const image = config?.image || "";
    if (!image) return "";
    const layers = baseLayers ? `${baseLayers}, ` : "";
    return `${layers}url('${safeCssUrl(image)}')`;
  };

  const api = window.BaliStore || (window.BaliStore = {});
  api.getHallLayoutConfig = read;
  api.saveHallLayoutConfig = async (next) => write(next);
  api.resetHallLayoutConfig = async () => clear();
  api.getHallBackgroundImage = buildBackgroundImage;
  api.getHallLayoutStorageKey = () => STORAGE_KEY;
})();