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

window.PIXIE_TEXT_UI = (() => {
  function create({ tr, note, textEntry, textPreview, textFont, textFontList, textLocalFonts,
    textSize, textBold, textItalic, getActiveLayer, drawText, getSize, getDrawState }) {
    let textSession = null;
    const chosenTextFont = () => textFont.value.trim() || textFont.dataset.previousFont || 'ZX ROM';
    const isRomFont = () => /^zx rom$/i.test(chosenTextFont());
    const textRasterOptions = () => ({
      family: chosenTextFont(), size: Number(textSize.value),
      bold: textBold.checked, italic: textItalic.checked,
    });
    const textCursorHeight = () => window.PIXIE_TEXT.cursorHeight(textRasterOptions());
    const rasterizeText = (value, caretIndex = value.length) =>
      window.PIXIE_TEXT.rasterize(value, caretIndex, textRasterOptions());
    function textPixels(value, caretIndex = value.length) {
      const mask = rasterizeText(value, caretIndex);
      if (!mask) return null;
      const count = mask.w * mask.h;
      const { attr, inkTransparent, paperTransparent } = getDrawState();
      const colors = new Uint8Array(count).fill(attr);
      const opacity = new Uint8Array(count);
      for (let i = 0; i < count; i++) opacity[i] = mask.bits[i] ? !inkTransparent : !paperTransparent;
      return { ...mask, colors, opacity };
    }
    function previewText() {
      const { W, H } = getSize();
      const { brightEnabled, bright, normal, ink, paper, inkTransparent, paperTransparent } = getDrawState();
      textPreview.clearRect(0, 0, W, H);
      if (!textSession) return;
      const caretIndex = textEntry.selectionDirection === 'backward'
        ? textEntry.selectionStart : textEntry.selectionEnd;
      const data = textPixels(textEntry.value, caretIndex ?? textEntry.value.length);
      const palette = brightEnabled ? bright : normal;
      if (data) {
        if (!paperTransparent) {
          textPreview.fillStyle = palette[paper];
          textPreview.fillRect(textSession.x, textSession.y, data.w, data.h);
        }
        if (!inkTransparent) {
          textPreview.fillStyle = palette[ink];
          for (let y = 0; y < data.h; y++) for (let x = 0; x < data.w; x++)
            if (data.bits[y * data.w + x]) textPreview.fillRect(textSession.x + x, textSession.y + y, 1, 1);
        }
      }
      textPreview.fillStyle = '#ff40ff';
      textPreview.fillRect(textSession.x + (data?.cursorX || 0), textSession.y, 1,
        data?.h || textCursorHeight());
    }
    function commitText() {
      if (!textSession) return;
      const position = textSession, value = textEntry.value;
      textSession = null; textEntry.value = ''; previewText();
      if (document.activeElement === textEntry) textEntry.blur();
      drawText(position, value);
    }
    function cancelText() {
      textSession = null; textEntry.value = ''; previewText();
      if (document.activeElement === textEntry) textEntry.blur();
    }
    function startText(p) {
      commitText(); textSession = { x: p.x, y: p.y, layer: getActiveLayer() };
      textEntry.focus({ preventScroll: true }); previewText();
    }
    textEntry.addEventListener('input', () => {
      if (isRomFont()) {
        const clean = textEntry.value.replace(/[^\x20-\x7f]/g, '');
        if (clean !== textEntry.value) {
          textEntry.value = clean; note(tr('The ZX ROM font supports ASCII characters only.'));
        }
      }
      previewText();
    });
    textEntry.addEventListener('selectionchange', previewText);
    textEntry.addEventListener('keyup', previewText);
    textEntry.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); commitText(); }
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancelText(); }
    });
    function updateTextControls() {
      const rom = isRomFont();
      document.querySelector('#text-size-row').hidden = rom;
      document.querySelector('#text-bold-row').hidden = rom;
      document.querySelector('#text-italic-row').hidden = rom;
      if (rom && textSession) {
        const clean = textEntry.value.replace(/[^\x20-\x7f]/g, '');
        if (clean !== textEntry.value) {
          textEntry.value = clean;
          note(tr('The ZX ROM font supports ASCII characters only.'));
        }
      }
      previewText();
    }
    textFont.addEventListener('focus', () => {
      textFont.dataset.previousFont = textFont.value;
      textFont.value = '';
    });
    textFont.addEventListener('pointerdown', () => {
      if (document.activeElement !== textFont || !textFont.value) return;
      textFont.dataset.previousFont = textFont.value;
      textFont.value = '';
    });
    textFont.addEventListener('input', updateTextControls);
    textFont.addEventListener('blur', () => {
      textFont.value = textFont.value.trim() || textFont.dataset.previousFont || 'ZX ROM';
      delete textFont.dataset.previousFont;
      updateTextControls();
    });
    textFont.addEventListener('keydown', event => {
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        const fonts = [...new Set([...textFontList.options].map(option => option.value).filter(Boolean))];
        if (!fonts.length) return;
        const current = chosenTextFont();
        const index = fonts.findIndex(font => font.toLowerCase() === current.toLowerCase());
        const next = index < 0 ? (event.key === 'ArrowDown' ? 0 : fonts.length - 1)
          : Math.max(0, Math.min(fonts.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)));
        textFont.value = fonts[next];
        updateTextControls();
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (event.key !== 'Escape') return;
      textFont.value = textFont.dataset.previousFont || 'ZX ROM';
      textFont.blur();
      event.stopPropagation();
    });
    for (const control of [textSize, textBold, textItalic])
      control.addEventListener('input', previewText);
    textLocalFonts.hidden = typeof window.queryLocalFonts !== 'function';
    textLocalFonts.addEventListener('click', async () => {
      try {
        const faces = await window.queryLocalFonts();
        const families = [...new Set(faces.map(face => face.family).filter(Boolean))].sort((a, b) => a.localeCompare(b));
        textFontList.querySelectorAll('option[data-local-font]').forEach(option => option.remove());
        for (const family of families) {
          const option = new Option(family, family);
          option.dataset.localFont = '';
          textFontList.append(option);
        }
        textLocalFonts.hidden = true;
        note(tr('{count} installed font families available.', { count: families.length }));
      } catch {
        note(tr('Font access was denied or is unavailable here. Enter a font family manually.'));
      }
    });
    updateTextControls();
    return { get session() { return textSession; }, textPixels, previewText, commitText, cancelText, startText };
  }
  return { create };
})();
