(() => {
  if (window.BaliRewardPng) return;
  async function validate(file) {
    if (!file || file.type !== "image/png") throw new Error("Загрузите файл PNG");
    const url = URL.createObjectURL(file);
    try {
      const image = await new Promise((resolve, reject) => {
        const item = new Image();
        item.onload = () => resolve(item);
        item.onerror = () => reject(new Error("Не удалось прочитать PNG"));
        item.src = url;
      });
      if (image.naturalWidth !== image.naturalHeight) throw new Error("PNG должен быть квадратным: 1:1");
      if (image.naturalWidth < 64 || image.naturalWidth > 2048) throw new Error("Сторона PNG: от 64 до 2048 px");
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = image.naturalWidth;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let hasTransparency = false;
      for (let index = 3; index < pixels.length; index += 4) {
        if (pixels[index] < 250) { hasTransparency = true; break; }
      }
      if (!hasTransparency) throw new Error("У PNG должен быть прозрачный фон");
      const size = Math.min(512, image.naturalWidth);
      const output = document.createElement("canvas");
      output.width = output.height = size;
      output.getContext("2d").drawImage(image, 0, 0, size, size);
      return output.toDataURL("image/png");
    } finally { URL.revokeObjectURL(url); }
  }
  window.BaliRewardPng = { validate };
})();