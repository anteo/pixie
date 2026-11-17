window.PIXIE_TEXT = (() => {
  const font = Uint8Array.from(atob('AAAAAAAAAAAAEBAQEAAQAAAkJAAAAAAAACR+JCR+JAAACD4oPgo+CABiZAgQJkYAABAoECpEOgAACBAAAAAAAAAECAgICAQAACAQEBAQIAAAABQIPggUAAAACAg+CAgAAAAAAAAICBAAAAAAPgAAAAAAAAAAGBgAAAACBAgQIAAAPEZKUmI8AAAYKAgICD4AADxCAjxAfgAAPEIMAkI8AAAIGChIfggAAH5AfAJCPAAAPEB8QkI8AAB+AgQIEBAAADxCPEJCPAAAPEJCPgI8AAAAABAAABAAAAAQAAAQECAAAAQIEAgEAAAAAD4APgAAAAAQCAQIEAAAPEIECAAIAAA8SlZeQDwAADxCQn5CQgAAfEJ8QkJ8AAA8QkBAQjwAAHhEQkJEeAAAfkB8QEB+AAB+QHxAQEAAADxCQE5CPAAAQkJ+QkJCAAA+CAgICD4AAAICAkJCPAAAREhwSERCAABAQEBAQH4AAEJmWkJCQgAAQmJSSkZCAAA8QkJCQjwAAHxCQnxAQAAAPEJCUko8AAB8QkJ8REIAADxAPAJCPAAA/hAQEBAQAABCQkJCQjwAAEJCQkIkGAAAQkJCQlokAABCJBgYJEIAAIJEKBAQEAAAfgQIECB+AAAOCAgICA4AAABAIBAIBAAAcBAQEBBwAAAQOFQQEBAAAAAAAAAAAP8AHCJ4ICB+AAAAOAQ8RDwAACAgPCIiPAAAABwgICAcAAAEBDxERDwAAAA4RHhAPAAADBAYEBAQAAAAPEREPAQ4AEBAeERERAAAEAAwEBA4AAAEAAQEBCQYACAoMDAoJAAAEBAQEBAMAAAAaFRUVFQAAAB4RERERAAAADhEREQ4AAAAeEREeEBAAAA8REQ8BAYAABwgICAgAAAAOEA4BHgAABA4EBAQDAAAAEREREQ4AAAAREQoKBAAAABEVFRUKAAAAEQoEChEAAAAREREPAQ4AAB8CBAgfAAADggwCAgOAAAICAgICAgAAHAQDBAQcAAAFCgAAAAAADxCmaGhmUI8'), c => c.charCodeAt(0));
  function textFontSpec(options) {
    const size = Math.max(4, Math.min(96, Number(options.size) || 16));
    const family = options.family;
    const cssFamily = ['sans-serif', 'serif', 'monospace'].includes(family.toLowerCase())
      ? family.toLowerCase() : JSON.stringify(family);
    return { size, face: `${options.italic ? 'italic ' : ''}${options.bold ? 'bold ' : ''}${size}px ${cssFamily}, sans-serif` };
  }
  function textLineMetrics(context, size) {
    const sample = context.measureText('Mg|Др');
    const ascent = Math.ceil(Math.max(size, sample.fontBoundingBoxAscent || sample.actualBoundingBoxAscent || 0)) + 1;
    const descent = Math.ceil(Math.max(size * 0.3,
      sample.fontBoundingBoxDescent || sample.actualBoundingBoxDescent || 0)) + 1;
    return { ascent, h: Math.min(160, ascent + descent) };
  }
  function textCursorHeight(options) {
    if (/^zx rom$/i.test(options.family)) return 8;
    const { size, face } = textFontSpec(options);
    const context = document.createElement('canvas').getContext('2d');
    context.font = face;
    return textLineMetrics(context, size).h;
  }
  function rasterizeText(value, caretIndex, options) {
    if (!value) return null;
    if (/^zx rom$/i.test(options.family)) {
      const w = value.length * 8, h = 8, bits = new Uint8Array(w * h);
      for (let n = 0; n < value.length; n++) {
        const code = value.charCodeAt(n);
        if (code < 32 || code > 127) continue;
        for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++)
          bits[row * w + n * 8 + col] = !!(font[(code - 32) * 8 + row] & (128 >> col));
      }
      return { w, h, bits, cursorX: Math.min(caretIndex, value.length) * 8 };
    }
    const { size, face } = textFontSpec(options);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.font = face;
    const metrics = context.measureText(value);
    const left = Math.ceil(Math.max(0, metrics.actualBoundingBoxLeft || 0)) + 1;
    const { ascent, h } = textLineMetrics(context, size);
    const textEndX = Math.min(2047, left + Math.round(metrics.width));
    const cursorX = Math.min(2047, left + Math.round(context.measureText(value.slice(0, caretIndex)).width));
    const w = Math.min(2048, Math.max(textEndX + 1,
      Math.ceil(left + Math.max(metrics.width, metrics.actualBoundingBoxRight || 0)) + 1));
    const scale = w * h < 50000 ? 4 : w * h < 150000 ? 3 : 2;
    canvas.width = w * scale; canvas.height = h * scale;
    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.font = face;
    context.textBaseline = 'alphabetic';
    context.fillStyle = '#fff';
    context.fillText(value, left, ascent);
    const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const bits = new Uint8Array(w * h);
    const threshold = scale * scale * 255 * 0.45;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let coverage = 0;
      for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++)
        coverage += rgba[((y * scale + sy) * canvas.width + x * scale + sx) * 4 + 3];
      bits[y * w + x] = coverage >= threshold ? 1 : 0;
    }
    return { w, h, bits, cursorX };
  }
  return { rasterize: rasterizeText, cursorHeight: textCursorHeight };
})();
