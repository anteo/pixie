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
