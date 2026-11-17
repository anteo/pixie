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
