(() => {
  const baseRenderHallBeta3 = renderHall;
  renderHall = async function(root) {
    await baseRenderHallBeta3(root);
    const input = document.getElementById("hallUploadInput");
    if (!input) return;
    input.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file || !window.BaliImageTools?.fileToDataUrl) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      try {
        const image = await window.BaliImageTools.fileToDataUrl(file, 1800, 0.86);
        writeHallLayoutConfig({ image, imageName: file.name, updatedAt: new Date().toISOString() });
        toast("Схема зала сжата и сохранена");
        await renderHall(root);
      } catch (error) {
        toast(error.message || "Не удалось загрузить схему зала");
      }
    }, true);
  };

  if (/Beta4/i.test(document.title) && !document.querySelector('script[data-beta4-menu-categories-dialog]')) {
    const script = document.createElement("script");
    script.src = "./admin-menu-categories-dialog-beta4.js?v=category-dialog-1";
    script.async = false;
    script.dataset.beta4MenuCategoriesDialog = "true";
    script.onload = () => { if (typeof state !== "undefined" && state.view === "menu") window.render?.(); };
    document.body.appendChild(script);
  }
})();