window.PIXIE_COMPOSITE = (() => {
  const MAX_W = 256, MAX_H = 192;
  const { offset, attrIndex, layerBit, layerOpaque, layerAttr, extraKey, writeLayerAttr, writeLayerBit } = window.PIXIE_LAYER;
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
  function forEachOpaquePixel(layer, visit) {
    for (let y = 0; y < MAX_H; y++) for (let x = 0; x < MAX_W; x++) {
      if (layerOpaque(layer, x, y)) visit(x + layer.x, y + layer.y, layer, x, y);
    }
    for (const [key, cell] of layer.extra || []) {
      const [cellX, cellY] = key.split(',').map(Number);
      for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
        if (!(cell.mask[row] & (128 >> col))) continue;
        const x = cellX * 8 + col, y = cellY * 8 + row;
        visit(x + layer.x, y + layer.y, layer, x, y);
      }
    }
  }
  function mergeOffscreenPixels(merged, pair, W, H, colorDistance) {
    const inside = (x, y) => x >= 0 && x < W && y >= 0 && y < H;
    const cells = new Map();
    for (const [order, layer] of pair.entries()) {
      forEachOpaquePixel(layer, (x, y, source, sx, sy) => {
        if (inside(x, y)) return;
        const key = extraKey(x, y);
        if (!cells.has(key)) cells.set(key, []);
        const attr = layerAttr(source, sx, sy);
        const color = layerBit(source, sx, sy) ? attr & 7 : attr >> 3 & 7;
        cells.get(key).push({ x, y, color: attr & 64 && color ? color + 8 : color, weight: order ? 4 : 1 });
      });
    }
    for (const [key, outside] of cells) {
      const [cellX, cellY] = key.split(',').map(Number);
      const x0 = cellX * 8, y0 = cellY * 8;
      const colors = new Int8Array(64).fill(-1), weights = new Uint8Array(64);
      for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
        const x = x0 + col, y = y0 + row;
        if (!inside(x, y) || !layerOpaque(merged, x, y)) continue;
        const attr = layerAttr(merged, x, y);
        const color = layerBit(merged, x, y) ? attr & 7 : attr >> 3 & 7;
        const index = row * 8 + col;
        colors[index] = attr & 64 && color ? color + 8 : color;
        weights[index] = 4;
      }
      for (const pixel of outside) {
        const index = (pixel.y - y0) * 8 + pixel.x - x0;
        colors[index] = pixel.color; weights[index] = pixel.weight;
      }
      let bestScore = Infinity, bestInk = 0, bestPaper = 0, bestBright = 0;
      for (let brightState = 0; brightState < 2; brightState++) {
        for (let paper = 0; paper < 8; paper++) for (let ink = 0; ink < 8; ink++) {
          const paperCode = brightState && paper ? paper + 8 : paper;
          const inkCode = brightState && ink ? ink + 8 : ink;
          let score = 0;
          for (let i = 0; i < 64; i++) {
            if (colors[i] < 0) continue;
            score += weights[i] * Math.min(colorDistance[colors[i]][paperCode], colorDistance[colors[i]][inkCode]);
          }
          if (score < bestScore) {
            bestScore = score; bestInk = ink; bestPaper = paper; bestBright = brightState;
          }
        }
      }
      writeLayerAttr(merged, x0, y0, bestInk | bestPaper << 3 | bestBright << 6);
      const inkCode = bestBright && bestInk ? bestInk + 8 : bestInk;
      const paperCode = bestBright && bestPaper ? bestPaper + 8 : bestPaper;
      for (let i = 0; i < 64; i++) {
        const x = x0 + i % 8, y = y0 + Math.floor(i / 8), opaque = colors[i] >= 0;
        const on = opaque && colorDistance[colors[i]][inkCode] < colorDistance[colors[i]][paperCode];
        writeLayerBit(merged, x, y, on, opaque);
      }
    }
  }
  return { layerForPreview, compositePixels, flatten, mergeOffscreenPixels };
})();
