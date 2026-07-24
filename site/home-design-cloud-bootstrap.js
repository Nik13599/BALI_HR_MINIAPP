(() => {
  if (window.BaliHomeDesignCloudReady) return;
  const KEY = "bali_home_design_v1";
  const store = window.BaliStore;

  window.BaliHomeDesignCloudReady = (async () => {
    if (!store?.cloudEnabled || !store.client) return null;
    try {
      const { data, error } = await store.client
        .from("venue_content")
        .select("home_design")
        .eq("id", "venue-main")
        .maybeSingle();
      if (error) throw error;
      const design = data?.home_design;
      if (design && typeof design === "object" && Object.keys(design).length) {
        localStorage.setItem(KEY, JSON.stringify(design));
        return design;
      }
      localStorage.removeItem(KEY);
      return null;
    } catch (error) {
      const message = String(error?.message || "");
      if (/home_design|venue_content|schema cache|does not exist/i.test(message)) {
        localStorage.removeItem(KEY);
      }
      console.warn("[BALI home design cloud]", message || error);
      return null;
    }
  })();
})();
