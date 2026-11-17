window.PIXIE_COMPOSITE = (() => {
  const MAX_W = 256, MAX_H = 192;
  const { offset, attrIndex, layerBit, layerOpaque, layerAttr } = window.PIXIE_LAYER;
  function layerForPreview(index, previews, sourceLayers) {
    return previews?.get(index) || sourceLayers[index];
  }
  function compositePixels(previews, sourceLayers, background, W, H) {
    const imageColors = new Uint8Array(MAX_W * MAX_H);
    if (background >= 0) imageColors.fill(background);
    const priority = new Uint16Array(MAX_W * MAX_H);
    const coverage = new Uint8Array(W * H);
    const cellOwner = new Int16Array(768).fill(-1);
    const paperOwner = new Int16Array(768).fill(-1);
    const paperAttr = new Uint8Array(768);
    if (background >= 0) coverage.fill(1);
    for (let index = 0; index < sourceLayers.length; index++) {
      const layer = layerForPreview(index, previews, sourceLayers);
      if (!layer.visible) continue;
      for (let y = 0; y < H; y++) {
        const sy = y - layer.y;
        for (let x = 0; x < W; x++) {
          const sx = x - layer.x;
          if (!layerOpaque(layer, sx, sy)) continue;
          const attr = layerAttr(layer, sx, sy);
          const on = layerBit(layer, sx, sy);
          const color = on ? attr & 7 : (attr >> 3) & 7;
          const cell = attrIndex(x, y);
          cellOwner[cell] = index;
          if (!on) { paperOwner[cell] = index; paperAttr[cell] = attr; }
          imageColors[y * MAX_W + x] = attr & 64 && color ? color + 8 : color;
          priority[y * MAX_W + x] = (1 + index * 16) * (on ? 4 : 1);
          coverage[y * W + x] = 1;
        }
      }
    }
    return { imageColors, priority, coverage, cellOwner, paperOwner, paperAttr };
  }
  function flatten(previews, sourceLayers, background, ignoreTransparency, W, H, colorDistance) {
    const visible = sourceLayers.map((layer, index) => layerForPreview(index, previews, sourceLayers))
      .filter(layer => layer.visible);
    if (visible.length === 1 && visible[0].x === 0 && visible[0].y === 0 &&
        visible[0].mask.every(byte => byte === 0xff)) {
      const direct = new Uint8Array(6912);
      direct.set(visible[0].bitmap); direct.set(visible[0].attrs, 6144);
      return direct;
    }
    const { imageColors, priority, coverage, cellOwner, paperOwner, paperAttr } =
      compositePixels(previews, sourceLayers, background, W, H);
    const result = new Uint8Array(6912);
    const weights = new Uint32Array(16), counts = new Uint8Array(16);
    for (let cellY = 0; cellY < H; cellY += 8) {
      for (let cellX = 0; cellX < W; cellX += 8) {
        weights.fill(0); counts.fill(0);
        const used = [];
        for (let py = cellY; py < cellY + 8; py++) {
          for (let px = cellX; px < cellX + 8; px++) {
            if (ignoreTransparency && (px >= W || py >= H || !coverage[py * W + px])) continue;
            const pixel = py * MAX_W + px, color = imageColors[pixel];
            if (!counts[color]) used.push(color);
            counts[color]++;
            weights[color] += priority[pixel] || 1;
          }
        }
        let bestScore = Infinity, bestInkUse = Infinity;
        let bestBright = 0, bestInk = 0, bestPaper = 0;
        const cell = attrIndex(cellX, cellY);
        if (cellOwner[cell] >= 0 && paperOwner[cell] === cellOwner[cell]) {
          const attr = paperAttr[cell];
          bestBright = (attr >> 6) & 1;
          bestInk = attr & 7;
          bestPaper = (attr >> 3) & 7;
        } else {
          for (let brightState = 0; brightState < 2; brightState++) {
            for (let paperColor = 0; paperColor < 8; paperColor++) {
              const paperCode = brightState && paperColor ? paperColor + 8 : paperColor;
              for (let inkColor = 0; inkColor < 8; inkColor++) {
                const inkCode = brightState && inkColor ? inkColor + 8 : inkColor;
                let score = 0, inkUse = 0;
                for (const color of used) {
                  const paperError = colorDistance[color][paperCode];
                  const inkError = colorDistance[color][inkCode];
                  score += weights[color] * Math.min(paperError, inkError);
                  if (inkError < paperError) inkUse += counts[color];
                  if (score > bestScore) break;
                }
                if (score < bestScore || score === bestScore && inkUse < bestInkUse) {
                  bestScore = score; bestInkUse = inkUse;
                  bestBright = brightState; bestInk = inkColor; bestPaper = paperColor;
                }
              }
            }
          }
        }
        result[6144 + attrIndex(cellX, cellY)] = bestInk | bestPaper << 3 | bestBright << 6;
        const paperCode = bestBright && bestPaper ? bestPaper + 8 : bestPaper;
        const inkCode = bestBright && bestInk ? bestInk + 8 : bestInk;
        for (let py = cellY; py < cellY + 8; py++) {
          for (let px = cellX; px < cellX + 8; px++) {
            if (ignoreTransparency && (px >= W || py >= H || !coverage[py * W + px])) continue;
            const color = imageColors[py * MAX_W + px];
            if (colorDistance[color][inkCode] < colorDistance[color][paperCode])
              result[offset(px, py)] |= 128 >> (px & 7);
          }
        }
      }
    }
    return result;
  }
  return { layerForPreview, compositePixels, flatten };
})();
