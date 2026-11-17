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
