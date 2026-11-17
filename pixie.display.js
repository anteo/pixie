window.PIXIE_DISPLAY = (() => {
  const MAX_W = 256;
  const { offset, attrIndex, layerBit, layerOpaque, layerAttr } = window.PIXIE_LAYER;

  function topSoloPixel(soloLayers, x, y) {
    for (let index = soloLayers.length - 1; index >= 0; index--) {
      const layer = soloLayers[index];
      const sx = x - layer.x, sy = y - layer.y;
      if (!layerOpaque(layer, sx, sy)) continue;
      const attr = layerAttr(layer, sx, sy);
      const color = layerBit(layer, sx, sy) ? attr & 7 : (attr >> 3) & 7;
      return { attr, color: attr & 64 && color ? color + 8 : color };
    }
    return null;
  }

  function renderNormal(ctx, width, height, scr, raw, coverage, zxPreview, paletteRgb) {
    const image = ctx.createImageData(width, height), pixels = image.data;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      let rgb;
      if (zxPreview) {
        const attr = scr[6144 + attrIndex(x, y)];
        const on = !!(scr[offset(x, y)] & (128 >> (x & 7)));
        const color = on ? attr & 7 : (attr >> 3) & 7;
        rgb = paletteRgb[attr & 64 && color ? color + 8 : color];
      } else rgb = paletteRgb[raw.imageColors[y * MAX_W + x]];
      const index = (y * width + x) * 4;
      pixels[index] = rgb[0]; pixels[index + 1] = rgb[1]; pixels[index + 2] = rgb[2];
      pixels[index + 3] = coverage && !coverage[y * width + x] ? 0 : 255;
    }
    return image;
  }

  function renderSolo(ctx, width, height, scr, raw, coverage, soloLayers, zxPreview, paletteRgb) {
    const image = ctx.createImageData(width, height), pixels = image.data;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const index = y * width + x, pixel = index * 4;
      let color = raw ? raw.imageColors[y * MAX_W + x] : 0;
      if (zxPreview) {
        const attr = scr[6144 + attrIndex(x, y)];
        const bitOn = !!(scr[offset(x, y)] & (128 >> (x & 7)));
        const inkOrPaper = bitOn ? attr & 7 : (attr >> 3) & 7;
        color = attr & 64 && inkOrPaper ? inkOrPaper + 8 : inkOrPaper;
      }
      let rgb = paletteRgb[color];
      let alpha = coverage && !coverage[index] ? 0 : 255;
      const soloPixel = topSoloPixel(soloLayers, x, y);
      if (soloPixel) { rgb = paletteRgb[soloPixel.color]; alpha = 255; }
      const dimmed = !soloPixel;
      pixels[pixel] = dimmed ? Math.round(rgb[0] * 0.28) : rgb[0];
      pixels[pixel + 1] = dimmed ? Math.round(rgb[1] * 0.28) : rgb[1];
      pixels[pixel + 2] = dimmed ? Math.round(rgb[2] * 0.28) : rgb[2];
      pixels[pixel + 3] = alpha;
    }
    return image;
  }

  return { topSoloPixel, renderNormal, renderSolo };
})();
