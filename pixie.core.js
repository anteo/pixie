window.PIXIE_LAYER = (() => {
  const MAX_W = 256, MAX_H = 192;
  const offset = (x, y) => ((y & 0xc0) << 5) | ((y & 7) << 8) | ((y & 0x38) << 2) | (x >> 3);
  const attrIndex = (x, y) => (y >> 3) * 32 + (x >> 3);
  function emptyLayer(name) {
    return { name, visible: true, solo: false, x: 0, y: 0,
      bitmap: new Uint8Array(6144), attrs: new Uint8Array(768).fill(0x47),
      mask: new Uint8Array(6144), extra: new Map() };
  }
  const basePixel = (x, y) => x >= 0 && x < MAX_W && y >= 0 && y < MAX_H;
  const extraKey = (x, y) => `${Math.floor(x / 8)},${Math.floor(y / 8)}`;
  function extraCell(layer, x, y, create = false) {
    const key = extraKey(x, y);
    let cell = layer.extra?.get(key);
    if (!cell && create) {
      cell = { bitmap: new Uint8Array(8), mask: new Uint8Array(8), attr: 0x47 };
      if (!layer.extra) layer.extra = new Map();
      layer.extra.set(key, cell);
    }
    return cell;
  }
  function layerBit(layer, x, y) {
    const bitMask = 128 >> (x & 7);
    if (basePixel(x, y)) return !!(layer.bitmap[offset(x, y)] & bitMask);
    const cell = extraCell(layer, x, y);
    return !!(cell && cell.bitmap[y & 7] & bitMask);
  }
  function layerOpaque(layer, x, y) {
    const bitMask = 128 >> (x & 7);
    if (basePixel(x, y)) return !!(layer.mask[offset(x, y)] & bitMask);
    const cell = extraCell(layer, x, y);
    return !!(cell && cell.mask[y & 7] & bitMask);
  }
  function layerAttr(layer, x, y, fallback = 0x47) {
    if (basePixel(x, y)) return layer.attrs[attrIndex(x, y)];
    return extraCell(layer, x, y)?.attr ?? fallback;
  }
  function writeLayerBit(layer, x, y, on, opaque) {
    const bitMask = 128 >> (x & 7);
    if (basePixel(x, y)) {
      const index = offset(x, y);
      layer.bitmap[index] = on ? layer.bitmap[index] | bitMask : layer.bitmap[index] & ~bitMask;
      layer.mask[index] = opaque ? layer.mask[index] | bitMask : layer.mask[index] & ~bitMask;
      return;
    }
    const cell = extraCell(layer, x, y, on || opaque);
    if (!cell) return;
    const row = y & 7;
    cell.bitmap[row] = on ? cell.bitmap[row] | bitMask : cell.bitmap[row] & ~bitMask;
    cell.mask[row] = opaque ? cell.mask[row] | bitMask : cell.mask[row] & ~bitMask;
  }
  function writeLayerAttr(layer, x, y, value) {
    if (basePixel(x, y)) layer.attrs[attrIndex(x, y)] = value;
    else extraCell(layer, x, y, true).attr = value;
  }
  function cloneExtra(extra) {
    return new Map([...(extra || [])].map(([key, cell]) => [key,
      { bitmap: cell.bitmap.slice(), mask: cell.mask.slice(), attr: cell.attr }]));
  }
  function cloneLayer(layer) {
    return { ...layer, bitmap: layer.bitmap.slice(), attrs: layer.attrs.slice(),
      mask: layer.mask.slice(), extra: cloneExtra(layer.extra) };
  }
  return { offset, attrIndex, emptyLayer, extraKey, layerBit, layerOpaque, layerAttr,
    writeLayerBit, writeLayerAttr, cloneLayer };
})();

window.PIXIE_GEOMETRY = (() => {
  const rectangle = (a, b) => ({
    x: Math.min(a.x, b.x), y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x) + 1, h: Math.abs(a.y - b.y) + 1,
  });
  const cellPoint = point => ({ x: point.x >> 3, y: point.y >> 3 });

  function selectionRectangle(a, b, snap, width, height) {
    const rect = rectangle(a, b);
    if (!snap) return rect;
    const x = Math.floor(rect.x / 8) * 8, y = Math.floor(rect.y / 8) * 8;
    return { x, y, w: Math.min(width, Math.ceil((rect.x + rect.w) / 8) * 8) - x,
      h: Math.min(height, Math.ceil((rect.y + rect.h) / 8) * 8) - y };
  }
  const contains = (selection, point) => !!selection && !!point &&
    point.x >= selection.x && point.x < selection.x + selection.w &&
    point.y >= selection.y && point.y < selection.y + selection.h;
  const sameSelection = (a, b) => a === b || !!a && !!b &&
    a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;

  function scaleSelection(data, width, height) {
    const bits = new Uint8Array(width * height);
    const colors = new Uint8Array(bits.length);
    const opacity = new Uint8Array(bits.length);
    for (let y = 0; y < height; y++) {
      const sourceY = Math.min(data.h - 1, Math.floor(y * data.h / height));
      for (let x = 0; x < width; x++) {
        const sourceX = Math.min(data.w - 1, Math.floor(x * data.w / width));
        const source = sourceY * data.w + sourceX, target = y * width + x;
        bits[target] = data.bits[source];
        colors[target] = data.colors[source];
        opacity[target] = data.opacity[source];
      }
    }
    return { ...data, w: width, h: height, bits, colors, opacity };
  }

  function resizedSelection(bounds, handle, dx, dy, snap, width, height) {
    const extent = (size, maximum) => {
      if (!snap || maximum < 8) return Math.max(1, Math.min(maximum, size));
      return Math.max(8, Math.min(Math.floor(maximum / 8) * 8, Math.round(size / 8) * 8));
    };
    let { x, y, w, h } = bounds;
    if (dx && handle.includes('w')) {
      w = extent(bounds.w - dx, bounds.x + bounds.w);
      x = bounds.x + bounds.w - w;
    } else if (dx && handle.includes('e')) w = extent(bounds.w + dx, width - bounds.x);
    if (dy && handle.includes('n')) {
      h = extent(bounds.h - dy, bounds.y + bounds.h);
      y = bounds.y + bounds.h - h;
    } else if (dy && handle.includes('s')) h = extent(bounds.h + dy, height - bounds.y);
    return { x, y, w, h };
  }

  function nudgeCoordinate(value, direction, snap) {
    if (!direction) return value;
    if (!snap) return value + direction;
    return direction > 0 ? (Math.floor(value / 8) + 1) * 8 : (Math.ceil(value / 8) - 1) * 8;
  }

  function connectedArea(width, height, startX, startY, matches) {
    const seen = new Uint8Array(width * height), queue = new Int32Array(width * height);
    let head = 0, tail = 0;
    queue[tail++] = startY * width + startX;
    seen[startY * width + startX] = 1;
    while (head < tail) {
      const cell = queue[head++], x = cell % width, y = Math.floor(cell / width);
      for (const next of [x > 0 ? cell - 1 : -1, x + 1 < width ? cell + 1 : -1,
        y > 0 ? cell - width : -1, y + 1 < height ? cell + width : -1]) {
        if (next < 0 || seen[next]) continue;
        if (!matches(next % width, Math.floor(next / width))) continue;
        seen[next] = 1; queue[tail++] = next;
      }
    }
    return queue.subarray(0, tail);
  }

  function walkLine(a, b, visit) {
    let x = a.x, y = a.y;
    const dx = Math.abs(b.x - x), dy = -Math.abs(b.y - y);
    const sx = x < b.x ? 1 : -1, sy = y < b.y ? 1 : -1;
    let err = dx + dy;
    while (true) {
      visit(x, y);
      if (x === b.x && y === b.y) break;
      const e2 = err * 2;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
    }
  }

  function ellipseOutline(start, end, segment) {
    const bounds = rectangle(start, end);
    const left = bounds.x, top = bounds.y;
    const right = left + bounds.w - 1, bottom = top + bounds.h - 1;
    if (bounds.w === 1 || bounds.h === 1) {
      segment({ x: left, y: top }, { x: right, y: bottom });
      return;
    }
    const cx = (left + right) / 2, cy = (top + bottom) / 2;
    const rx = (right - left) / 2, ry = (bottom - top) / 2;
    const steps = Math.ceil(Math.PI * Math.max(bounds.w, bounds.h));
    let previous = { x: right, y: Math.round(cy) };
    for (let i = 1; i <= steps; i++) {
      const angle = i * 2 * Math.PI / steps;
      const next = { x: Math.round(cx + rx * Math.cos(angle)), y: Math.round(cy + ry * Math.sin(angle)) };
      segment(previous, next);
      previous = next;
    }
  }

  function lineEnd(start, end, shifted, maxX, maxY) {
    if (!shifted) return end;
    const dx = end.x - start.x, dy = end.y - start.y;
    const ax = Math.abs(dx), ay = Math.abs(dy);
    if (!ax && !ay) return start;
    const axisLimit = 1 + Math.SQRT2;
    if (ax >= ay * axisLimit) return { x: end.x, y: start.y };
    if (ay >= ax * axisLimit) return { x: start.x, y: end.y };
    const sx = Math.sign(dx), sy = Math.sign(dy);
    const xLimit = sx > 0 ? maxX - start.x : start.x;
    const yLimit = sy > 0 ? maxY - start.y : start.y;
    const steps = Math.min(Math.round((ax + ay) / 2), xLimit, yLimit);
    return { x: start.x + sx * steps, y: start.y + sy * steps };
  }

  function ellipseEndpoint(start, raw, shifted, cellMode, width, height) {
    if (!shifted) return raw;
    const a = cellMode ? cellPoint(start) : start;
    const b = cellMode ? cellPoint(raw) : raw;
    const maxX = cellMode ? Math.ceil(width / 8) - 1 : width - 1;
    const maxY = cellMode ? Math.ceil(height / 8) - 1 : height - 1;
    const dx = b.x - a.x, dy = b.y - a.y;
    const sx = Math.sign(dx) || (maxX - a.x >= a.x ? 1 : -1);
    const sy = Math.sign(dy) || (maxY - a.y >= a.y ? 1 : -1);
    const xRoom = sx > 0 ? maxX - a.x : a.x;
    const yRoom = sy > 0 ? maxY - a.y : a.y;
    const radius = Math.min(Math.max(Math.abs(dx), Math.abs(dy)), xRoom, yRoom);
    const end = { x: a.x + sx * radius, y: a.y + sy * radius };
    return cellMode ? { x: end.x * 8, y: end.y * 8 } : end;
  }

  return { rectangle, cellPoint, selectionRectangle, contains, sameSelection, scaleSelection,
    resizedSelection, nudgeCoordinate, connectedArea, walkLine, ellipseOutline, lineEnd, ellipseEndpoint };
})();

window.PIXIE_SELECTION = (() => {
  const { layerBit, layerOpaque, layerAttr, writeLayerBit, writeLayerAttr } = window.PIXIE_LAYER;
  const copyPixels = data => ({ ...data, bits: data.bits.slice(),
    colors: data.colors.slice(), opacity: data.opacity.slice() });
  const copyMove = move => move ? {
    source: move.source ? { ...move.source } : null, target: { ...move.target },
    sourceLayer: move.sourceLayer, targetLayer: move.targetLayer,
    data: copyPixels(move.data), scaleSource: move.scaleSource ? copyPixels(move.scaleSource) : null,
  } : null;
  function capture(s, layer, fallbackAttr) {
    const bits = new Uint8Array(s.w * s.h), colors = new Uint8Array(bits.length), opacity = new Uint8Array(bits.length);
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
      const i = y * s.w + x, sx = s.x + x, sy = s.y + y;
      bits[i] = layerBit(layer, sx - layer.x, sy - layer.y) ? 1 : 0;
      colors[i] = layerAttr(layer, sx - layer.x, sy - layer.y, fallbackAttr);
      const lx = sx - layer.x, ly = sy - layer.y;
      opacity[i] = layerOpaque(layer, lx, ly) ? 1 : 0;
    }
    return { x: s.x, y: s.y, w: s.w, h: s.h, bits, colors, opacity };
  }
  function clear(s, layer) {
    for (let y = s.y; y < s.y + s.h; y++) for (let x = s.x; x < s.x + s.w; x++) writeLayerBit(layer, x - layer.x, y - layer.y, false, false);
  }
  function stamp(data, x0, y0, layer) {
    for (let y = 0; y < data.h; y++) for (let x = 0; x < data.w; x++) {
      const dx = x0 + x, dy = y0 + y;
      const i = y * data.w + x;
      if (!data.opacity[i]) continue;
      writeLayerBit(layer, dx - layer.x, dy - layer.y, !!data.bits[i], true);
      writeLayerAttr(layer, dx - layer.x, dy - layer.y, data.colors[i]);
    }
  }
  return { copyPixels, copyMove, capture, clear, stamp };
})();

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

  async function pngBlob(width, height, imageColors, coverage, scr, paletteRgb) {
    const output = document.createElement('canvas');
    output.width = width; output.height = height;
    const context = output.getContext('2d');
    const image = context.createImageData(width, height);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      let color = imageColors[y * MAX_W + x];
      if (scr) {
        const attr = scr[6144 + attrIndex(x, y)];
        const on = !!(scr[offset(x, y)] & (128 >> (x & 7)));
        const index = on ? attr & 7 : (attr >> 3) & 7;
        color = attr & 64 && index ? index + 8 : index;
      }
      const rgb = paletteRgb[color];
      const index = (y * width + x) * 4;
      image.data[index] = rgb[0]; image.data[index + 1] = rgb[1]; image.data[index + 2] = rgb[2];
      image.data[index + 3] = coverage[y * width + x] ? 255 : 0;
    }
    context.putImageData(image, 0, 0);
    return new Promise(resolve => output.toBlob(resolve, 'image/png'));
  }

  return { topSoloPixel, renderNormal, renderSolo, pngBlob };
})();

window.PIXIE_PROJECT = (() => {
  const MAX_W = 256, MAX_H = 192;
  const offset = (x, y) => ((y & 0xc0) << 5) | ((y & 7) << 8) | ((y & 0x38) << 2) | (x >> 3);
  function base64(bytes) { return btoa(String.fromCharCode(...bytes)); }
  function decodeBase64(value, length, tr) {
    const bytes = Uint8Array.from(atob(value), char => char.charCodeAt(0));
    if (bytes.length !== length) throw new Error(tr('Invalid layer data size'));
    return bytes;
  }
  function projectText({ width, height, activeLayer, backgroundCode, zxPreview, traceSettings, layers, references }) {
    const lines = [`width = ${width}`, `height = ${height}`, `active = ${activeLayer}`,
      `background = ${backgroundCode}`, `zx_preview = ${zxPreview}`];
    for (const [key, value] of Object.entries(traceSettings)) {
      const name = `trace_${key.replace(/[A-Z]/g, letter => '_' + letter.toLowerCase())}`;
      lines.push(`${name} = ${typeof value === 'string' ? JSON.stringify(value) : value}`);
    }
    for (const layer of layers) {
      lines.push('', '[[layer]]', `name = ${JSON.stringify(layer.name)}`,
        `visible = ${layer.visible}`, `solo = ${!!layer.solo}`, `x = ${layer.x}`, `y = ${layer.y}`,
        `bitmap_base64 = "${base64(layer.bitmap)}"`,
        `attrs_base64 = "${base64(layer.attrs)}"`,
        `mask_base64 = "${base64(layer.mask)}"`);
      for (const [key, cell] of layer.extra || []) {
        const [cellX, cellY] = key.split(',').map(Number);
        lines.push('', '[[layer.extra]]', `cell_x = ${cellX}`, `cell_y = ${cellY}`,
          `bitmap_base64 = "${base64(cell.bitmap)}"`, `mask_base64 = "${base64(cell.mask)}"`,
          `attr = ${cell.attr}`);
      }
    }
    for (const reference of references) {
      lines.push('', '[[reference]]', `name = ${JSON.stringify(reference.name)}`,
        `visible = ${reference.visible}`, `opacity = ${reference.opacity}`,
        `x = ${reference.x}`, `y = ${reference.y}`,
        `width = ${reference.width}`, `height = ${reference.height}`,
        `image_data = ${JSON.stringify(reference.dataUrl)}`);
    }
    return lines.join('\n') + '\n';
  }
  function parseProject(source, tr, trace) {
    const parsed = { layers: [], references: [] };
    let current = parsed;
    for (const raw of source.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      if (line === '[[layer]]') {
        current = {}; parsed.layers.push(current); continue;
      }
      if (line === '[[layer.extra]]') {
        const layer = parsed.layers.at(-1);
        if (!layer) throw new Error(tr('Unrecognized project line'));
        current = {}; (layer.extra ||= []).push(current); continue;
      }
      if (line === '[[reference]]') {
        current = {}; parsed.references.push(current); continue;
      }
      const match = /^([a-z][a-z0-9_]*)\s*=\s*(.+)$/.exec(line);
      if (!match) throw new Error(tr('Unrecognized project line'));
      const value = match[2];
      current[match[1]] = value.startsWith('"') ? JSON.parse(value)
        : value === 'true' ? true : value === 'false' ? false : Number(value);
    }
    if (!parsed.layers.length || parsed.layers.length > 32 ||
        !Number.isInteger(parsed.active) || parsed.active < 0 || parsed.active >= parsed.layers.length) {
      throw new Error(tr('Unsupported layer project'));
    }
    const width = parsed.width === undefined ? MAX_W : parsed.width;
    const height = parsed.height === undefined ? MAX_H : parsed.height;
    if (!Number.isInteger(width) || width < 1 || width > MAX_W ||
        !Number.isInteger(height) || height < 1 || height > MAX_H)
      throw new Error(tr('Invalid document size'));
    const background = parsed.background === undefined ? 0 : parsed.background;
    if (!Number.isInteger(background) || background < -1 || background > 15)
      throw new Error(tr('Invalid background color'));
    if (typeof parsed.zx_preview !== 'boolean')
      throw new Error(tr('Invalid ZX preview setting'));
    const loaded = parsed.layers.map((item, index) => {
      if (typeof item.name !== 'string' || typeof item.visible !== 'boolean' ||
          (item.solo !== undefined && typeof item.solo !== 'boolean') ||
          (item.solo && !item.visible) ||
          !Number.isInteger(item.x) || !Number.isInteger(item.y)) {
        throw new Error(tr('Invalid layer properties'));
      }
      const bitmap = decodeBase64(item.bitmap_base64, 6144, tr);
      const attrs = decodeBase64(item.attrs_base64, 768, tr);
      let mask;
      if (item.mask_base64 === undefined) {
        mask = index === 0 ? new Uint8Array(6144).fill(0xff) : bitmap.slice();
        if (index !== 0) {
          for (let cellY = 0; cellY < 24; cellY++) {
            for (let cellX = 0; cellX < 32; cellX++) {
              if (!((attrs[cellY * 32 + cellX] >> 3) & 7)) continue;
              for (let row = 0; row < 8; row++) mask[offset(cellX * 8, cellY * 8 + row)] = 0xff;
            }
          }
        }
      } else mask = decodeBase64(item.mask_base64, 6144, tr);
      const extra = new Map();
      for (const cell of item.extra || []) {
        if (!Number.isInteger(cell.cell_x) || !Number.isInteger(cell.cell_y) ||
            !Number.isInteger(cell.attr) || cell.attr < 0 || cell.attr > 127 ||
            cell.cell_x >= 0 && cell.cell_x < 32 && cell.cell_y >= 0 && cell.cell_y < 24)
          throw new Error(tr('Invalid layer properties'));
        const key = `${cell.cell_x},${cell.cell_y}`;
        if (extra.has(key)) throw new Error(tr('Invalid layer properties'));
        extra.set(key, { bitmap: decodeBase64(cell.bitmap_base64, 8, tr),
          mask: decodeBase64(cell.mask_base64, 8, tr), attr: cell.attr });
      }
      return { name: item.name, visible: item.visible, solo: item.solo ?? false, x: item.x, y: item.y,
        bitmap, attrs, mask, extra };
    });
    const loadedReferences = parsed.references.map(item => {
      if (typeof item.name !== 'string' || typeof item.visible !== 'boolean' ||
          !Number.isFinite(item.opacity) || item.opacity < 0 || item.opacity > 1 ||
          !Number.isFinite(item.x) || !Number.isFinite(item.y) ||
          !Number.isFinite(item.width) || item.width <= 0 ||
          !Number.isFinite(item.height) || item.height <= 0 ||
          typeof item.image_data !== 'string' || !/^data:image\/[a-z0-9.+-]+;base64,/i.test(item.image_data))
        throw new Error(tr('Invalid reference image properties'));
      return { name: item.name, visible: item.visible, opacity: item.opacity,
        x: item.x, y: item.y, width: item.width, height: item.height, dataUrl: item.image_data };
    });
    const storedTrace = {};
    for (const key of Object.keys(trace.defaults)) {
      const name = `trace_${key.replace(/[A-Z]/g, letter => '_' + letter.toLowerCase())}`;
      if (parsed[name] !== undefined) storedTrace[key] = parsed[name];
    }
    return { layers: loaded, references: loadedReferences, activeLayer: parsed.active,
      background, zxPreview: parsed.zx_preview, width, height,
      traceSettings: trace.normalize(storedTrace) };
  }
  return { projectText, parseProject };
})();
