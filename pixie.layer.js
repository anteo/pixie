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
