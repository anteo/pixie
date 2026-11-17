  (() => {
    const MAX_W = 256, MAX_H = 192;
    const russian = /^ru(?:-|$)/i.test(navigator.languages?.[0] || navigator.language || '');
    const tr = (english, values = {}) => {
      let template = russian ? window.PIXIE_RU?.[english] ?? english : english;
      if (typeof template === 'object') {
        const plural = new Intl.PluralRules('ru').select(values.count ?? 0);
        template = template[plural] ?? template.other ?? english;
      }
      return template.replace(/\{([a-z]+)\}/g, (match, name) => values[name] ?? match);
    };
    document.documentElement.lang = russian ? 'ru' : 'en';
    {
      document.title = tr('Pixie — The ZX Spectrum graphics editor');
      const text = {
        'header h1': 'Pixie',
        '#app-tagline': 'The ZX Spectrum graphics editor',
        '#layers-panel .layers-heading strong': 'Layers',
        '#background-panel strong': 'Background',
        '#status': 'New blank project. Add a layer or import SCR.',
        '#new-dialog-title': 'New document',
        '#new-dialog legend': 'Size',
        '#new-size-screen-label': 'Full screen 256×192',
        '#new-size-custom-label': 'Custom size',
        '#new-dialog > p': 'Save the current project before creating a new one?',
        '#new-cancel': 'Cancel', '#new-discard': "Don't save", '#new-save': 'Save',
        '#name-dialog-title': 'File name', '#name-cancel': 'Cancel', '#name-accept': 'Save',
      };
      for (const [selector, value] of Object.entries(text)) document.querySelector(selector).textContent = tr(value);
      const labels = {
        '#new': ['New blank document (N)', 'New blank document'],
        '#open-project': ['Open Pixie project (⌘O)', 'Open Pixie project'],
        '#save-project': ['Save Pixie project (⌘S)', 'Save Pixie project'],
        '#open': ['Import SCR (⌘⇧O)', 'Import SCR'],
        '#save': ['Export SCR (⌘⇧S)', 'Export SCR'],
        '#save-png': ['Export PNG (Alt+P)', 'Export PNG'],
        '#copy': ['Copy selection (⌘C)', 'Copy selection'],
        '#cut': ['Cut selection (⌘X)', 'Cut selection'],
        '#paste': ['Paste (⌘V)', 'Paste'],
        '#undo': ['Undo (⌘Z)', 'Undo'],
        '#redo': ['Redo (⌘⇧Z)', 'Redo'],
        '#stroke-presets': [null, 'Brush size'],
        '#ink-swatches': [null, 'INK color'],
        '#paper-swatches': [null, 'PAPER color'],
        '#swap': ['Swap INK and PAPER (I)', 'Swap INK and PAPER'],
        '#grid': ['Grid: pixels from 8× (G)', 'Grid'],
        '#zx-preview': ['Preview ZX attributes (Z)', 'Preview ZX attributes'],
        '.tool-rail': [null, 'Tools'],
        '[data-tool="draw"]': ['Draw or erase (B); right button erases', 'Draw'],
        '[data-tool="line"]': ['Polyline (D): click for points, drag for one segment; Shift snaps to axes and 45°; Escape ends', 'Polyline'],
        '[data-tool="rect"]': ['Rectangle (R): two clicks or drag; right button erases', 'Rectangle'],
        '[data-tool="fill-rect"]': ['Filled rectangle (F): two clicks or drag; right button erases', 'Filled rectangle'],
        '[data-tool="select"]': ['Select area (S); Shift snaps to 8×8 cells', 'Select'],
        '[data-tool="move-layer"]': ['Move layer (M; arrows move 1 pixel, Shift+arrows move 8)', 'Move layer'],
        '#attr-mode': ['Draw 8×8 cell attributes (A)', 'Draw cell attributes'],
        '[data-tool="text"]': ['Text: click the canvas and type; Shift snaps to a cell (T)', 'Text'],
        '#text-entry': [null, 'Text on canvas'],
        '.zoom-presets': [null, 'Quick zoom'],
        '#zoom-1': ['Zoom 1× (Alt+1)'], '#zoom-2': ['Zoom 2× (Alt+2)'],
        '#zoom-fit': ['Fit screen (Alt+0)', 'Fit screen'],
        '#layers-panel': [null, 'Layers'],
        '#layer-add': ['Add layer (L)', 'Add layer'],
        '#layer-up': ['Raise layer (])', 'Raise layer'],
        '#layer-down': ['Lower layer ([)', 'Lower layer'],
        '#layer-merge': ['Merge with layer below (Shift+M)', 'Merge with layer below'],
        '#layer-delete': ['Delete layer (⇧L)', 'Delete layer'],
        '#background-swatches': [null, 'Background color'],
        '#stroke-current': ['Brush size: 1×1 pixels', 'Brush size'],
        '#cursor-info': ['INK and PAPER after SCR encoding', 'SCR attributes under cursor'],
        '#new-width': [null, 'Width in pixels'], '#new-height': [null, 'Height in pixels'],
        '#name-input': [null, 'Name'],
      };
      for (const [selector, [title, label]] of Object.entries(labels)) {
        const element = document.querySelector(selector);
        if (title) element.title = tr(title);
        if (label) element.setAttribute('aria-label', tr(label));
      }
    }
    let W = MAX_W, H = MAX_H;
    const offset = (x, y) => ((y & 0xc0) << 5) | ((y & 7) << 8) | ((y & 0x38) << 2) | (x >> 3);
    const attrIndex = (x, y) => (y >> 3) * 32 + (x >> 3);
    const font = Uint8Array.from(atob('AAAAAAAAAAAAEBAQEAAQAAAkJAAAAAAAACR+JCR+JAAACD4oPgo+CABiZAgQJkYAABAoECpEOgAACBAAAAAAAAAECAgICAQAACAQEBAQIAAAABQIPggUAAAACAg+CAgAAAAAAAAICBAAAAAAPgAAAAAAAAAAGBgAAAACBAgQIAAAPEZKUmI8AAAYKAgICD4AADxCAjxAfgAAPEIMAkI8AAAIGChIfggAAH5AfAJCPAAAPEB8QkI8AAB+AgQIEBAAADxCPEJCPAAAPEJCPgI8AAAAABAAABAAAAAQAAAQECAAAAQIEAgEAAAAAD4APgAAAAAQCAQIEAAAPEIECAAIAAA8SlZeQDwAADxCQn5CQgAAfEJ8QkJ8AAA8QkBAQjwAAHhEQkJEeAAAfkB8QEB+AAB+QHxAQEAAADxCQE5CPAAAQkJ+QkJCAAA+CAgICD4AAAICAkJCPAAAREhwSERCAABAQEBAQH4AAEJmWkJCQgAAQmJSSkZCAAA8QkJCQjwAAHxCQnxAQAAAPEJCUko8AAB8QkJ8REIAADxAPAJCPAAA/hAQEBAQAABCQkJCQjwAAEJCQkIkGAAAQkJCQlokAABCJBgYJEIAAIJEKBAQEAAAfgQIECB+AAAOCAgICA4AAABAIBAIBAAAcBAQEBBwAAAQOFQQEBAAAAAAAAAAAP8AHCJ4ICB+AAAAOAQ8RDwAACAgPCIiPAAAABwgICAcAAAEBDxERDwAAAA4RHhAPAAADBAYEBAQAAAAPEREPAQ4AEBAeERERAAAEAAwEBA4AAAEAAQEBCQYACAoMDAoJAAAEBAQEBAMAAAAaFRUVFQAAAB4RERERAAAADhEREQ4AAAAeEREeEBAAAA8REQ8BAYAABwgICAgAAAAOEA4BHgAABA4EBAQDAAAAEREREQ4AAAAREQoKBAAAABEVFRUKAAAAEQoEChEAAAAREREPAQ4AAB8CBAgfAAADggwCAgOAAAICAgICAgAAHAQDBAQcAAAFCgAAAAAADxCmaGhmUI8'), c => c.charCodeAt(0));
    function emptyLayer(name) {
      return { name, visible: true, x: 0, y: 0,
        bitmap: new Uint8Array(6144), attrs: new Uint8Array(768).fill(0x47),
        mask: new Uint8Array(6144) };
    }
    let layers = [emptyLayer(tr('Layer {number}', { number: 1 }))];
    let activeLayer = 0, bitmap = layers[0].bitmap, attrs = layers[0].attrs, mask = layers[0].mask;
    let projectFileName = 'screen.pixie', exportFileName = 'screen.scr';
    const screen = document.querySelector('#screen');
    const transparencyCanvas = document.querySelector('#transparency');
    const transparencyContext = transparencyCanvas.getContext('2d');
    const pixelGrid = document.querySelector('#pixel-grid'), cellGrid = document.querySelector('#cell-grid');
    const selectionOutline = document.querySelector('#selection-outline');
    const ctx = screen.getContext('2d');
    const textEntry = document.querySelector('#text-entry');
    const textPreview = document.querySelector('#text-preview').getContext('2d');
    const stage = document.querySelector('#stage'), viewport = document.querySelector('#viewport'), status = document.querySelector('#status');
    const inkSwatches = document.querySelector('#ink-swatches'), paperSwatches = document.querySelector('#paper-swatches');
    const brightControl = document.querySelector('#bright'), gridControl = document.querySelector('#grid');
    const zxPreviewControl = document.querySelector('#zx-preview');
    const colors = ['Black', 'Blue', 'Red', 'Magenta', 'Green', 'Cyan', 'Yellow', 'White'].map(name => tr(name));
    const normal = ['#000000', '#0000d7', '#d70000', '#d700d7', '#00d700', '#00d7d7', '#d7d700', '#d7d7d7'];
    const bright = ['#000000', '#0000ff', '#ff0000', '#ff00ff', '#00ff00', '#00ffff', '#ffff00', '#ffffff'];
    const paletteRgb = [...normal, ...bright].map(hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)));
    const colorDistance = paletteRgb.map(a => paletteRgb.map(b =>
      (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2));
    const cursorCoords = document.querySelector('#cursor-coords');
    const cursorInk = document.querySelector('#cursor-ink'), cursorPaper = document.querySelector('#cursor-paper');
    const strokeIndicator = document.querySelector('#stroke-indicator');
    const strokeIndicatorSlot = document.querySelector('#stroke-indicator-slot');
    let cursorPoint = null, displayedScr = null, displayedCoverage = null;
    let ink = 7, paper = 0, inkTransparent = false, paperTransparent = true;
    let brightEnabled = true, gridEnabled = false, zxPreview = true, backgroundCode = 0;
    const backgroundSwatches = document.querySelector('#background-swatches');
    function updateBackgroundSwatches() {
      for (const button of backgroundSwatches.children) {
        const index = Number(button.dataset.color);
        const selected = index === 8 ? backgroundCode === -1
          : backgroundCode === index || backgroundCode === index + 8;
        button.classList.toggle('active', selected);
        button.setAttribute('aria-pressed', String(selected));
        button.style.backgroundColor = index === 8 ? '' : selected && backgroundCode >= 0
          ? (backgroundCode > 8 ? bright[backgroundCode - 8] : normal[backgroundCode])
          : (brightEnabled ? bright : normal)[index];
      }
    }
    for (let i = 0; i < 9; i++) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'swatch' + (i === 8 ? ' transparent' : '');
      button.dataset.color = String(i);
      const label = i === 8 ? tr('Transparent (black in SCR)') : colors[i];
      button.title = `${tr('Background')}: ${label}`;
      button.setAttribute('aria-label', `${tr('Background')}: ${label}`);
      button.onclick = () => {
        const next = i === 8 ? -1 : brightEnabled && i ? i + 8 : i;
        if (next === backgroundCode) return;
        remember(); backgroundCode = next; updateBackgroundSwatches(); render();
      };
      backgroundSwatches.appendChild(button);
    }
    updateBackgroundSwatches();
    function updateSwatches() {
      for (const [kind, group] of [['ink', inkSwatches], ['paper', paperSwatches]]) {
        for (const button of group.children) {
          const index = Number(button.dataset.color);
          const selected = index === 8 ? (kind === 'ink' ? inkTransparent : paperTransparent)
            : !(kind === 'ink' ? inkTransparent : paperTransparent) && index === (kind === 'ink' ? ink : paper);
          button.style.backgroundColor = index === 8 ? '' : (brightEnabled ? bright : normal)[index];
          button.classList.toggle('active', selected);
          button.setAttribute('aria-pressed', String(selected));
        }
      }
      strokeIndicator.classList.toggle('transparent', inkTransparent);
      strokeIndicator.style.backgroundColor = inkTransparent ? '' : (brightEnabled ? bright : normal)[ink];
      strokeIndicatorSlot.classList.toggle('transparent', paperTransparent);
      strokeIndicatorSlot.style.backgroundColor = paperTransparent ? '' : (brightEnabled ? bright : normal)[paper];
      strokeIndicatorSlot.style.borderColor = paperTransparent ? '' : (brightEnabled ? bright : normal)[paper];
    }
    function chooseColor(kind, index) {
      if (kind === 'ink') { inkTransparent = index === 8; if (index < 8) ink = index; }
      else { paperTransparent = index === 8; if (index < 8) paper = index; }
      updateSwatches();
      if (selection) recolorSelection(kind, index);
      previewText();
      refreshPolyline(); refreshRectangle();
    }
    for (let i = 0; i < 9; i++) {
      for (const [kind, group] of [['ink', inkSwatches], ['paper', paperSwatches]]) {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'swatch' + (i === 8 ? ' transparent' : ''); button.dataset.color = String(i);
        const label = i === 8 ? tr('Transparent') : colors[i];
        button.title = `${kind.toUpperCase()}: ${label} (${i === 8 ? (kind === 'ink' ? '0' : '⇧0') : (kind === 'ink' ? '' : '⇧') + (i + 1)})`;
        button.setAttribute('aria-label', `${kind.toUpperCase()}: ${label}`);
        button.onclick = () => chooseColor(kind, i);
        group.appendChild(button);
      }
    }
    updateSwatches();
    let tool = 'draw', attrMode = false, zoom = 6, selection = null, drag = null, clipboard = null, textSession = null;
    let lineSession = null, rectangleSession = null, shapePress = null;
    let pendingMove = null;
    const attrModeButton = document.querySelector('#attr-mode');
    attrModeButton.onclick = () => {
      attrMode = !attrMode;
      attrModeButton.classList.toggle('active', attrMode);
      attrModeButton.setAttribute('aria-pressed', String(attrMode));
      refreshPolyline(); refreshRectangle();
      note(tr(attrMode ? 'Drawing 8×8 cell attributes.' : 'Drawing pixels.'));
    };
    const strokeSizes = [1, 2, 3, 4, 5, 6, 7, 8];
    const strokePresets = document.querySelector('#stroke-presets');
    const strokeCurrent = document.querySelector('#stroke-current');
    const strokeDimensions = document.querySelector('#stroke-dimensions');
    let strokeWidth = 1;
    function setStrokeWidth(width) {
      strokeWidth = width;
      strokeDimensions.textContent = `${width}×${width} px`;
      strokeIndicator.style.setProperty('--square-size', `${width * 2 + 2}px`);
      strokeCurrent.title = tr('Brush size: {width}×{width} pixels', { width });
      for (const button of strokePresets.children) {
        const selected = Number(button.dataset.size) === width;
        button.classList.toggle('active', selected);
        button.setAttribute('aria-pressed', String(selected));
      }
      refreshPolyline(); refreshRectangle();
    }
    strokeSizes.slice(0, 3).forEach((size, index) => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'icon-button stroke-size';
      button.dataset.size = String(size);
      const unit = tr(size === 1 ? 'pixel' : 'pixels', { count: size });
      button.title = tr('Brush size {size} {unit} (Alt+Shift+{key})', { size, unit, key: index + 1 });
      button.setAttribute('aria-label', tr('Brush size: {size} {unit}', { size, unit }));
      button.style.setProperty('--square-size', `${size * 2 + 2}px`);
      button.innerHTML = '<span class="stroke-square" aria-hidden="true"></span>';
      button.onclick = () => setStrokeWidth(size);
      strokePresets.appendChild(button);
    });
    setStrokeWidth(1);
    const drawingTools = new Set(['draw', 'line', 'rect', 'fill-rect']);
    const undo = [], redo = [];
    const note = message => { status.textContent = message; };
    const inside = (x, y) => x >= 0 && x < W && y >= 0 && y < H;
    const active = () => layers[activeLayer];
    function bindActive() { bitmap = active().bitmap; attrs = active().attrs; mask = active().mask; }
    function bit(x, y) {
      const sx = x - active().x, sy = y - active().y;
      return inside(sx, sy) && !!(bitmap[offset(sx, sy)] & (128 >> (sx & 7)));
    }
    function setBit(x, y, on, opaque = on ? !inkTransparent : !paperTransparent) {
      const sx = x - active().x, sy = y - active().y;
      if (!inside(sx, sy)) return;
      const index = offset(sx, sy), bitMask = 128 >> (sx & 7);
      bitmap[index] = on ? bitmap[index] | bitMask : bitmap[index] & ~bitMask;
      if (opaque) mask[index] |= bitMask;
      else mask[index] &= ~bitMask;
    }
    function getAttr(x, y) {
      const sx = x - active().x, sy = y - active().y;
      return inside(sx, sy) ? attrs[attrIndex(sx, sy)] : activeAttr();
    }
    function setAttr(x, y, value) {
      const sx = x - active().x, sy = y - active().y;
      if (inside(sx, sy)) attrs[attrIndex(sx, sy)] = value;
    }
    function paintAttrCell(x, y) {
      const sx = x - active().x, sy = y - active().y;
      if (!inside(sx, sy)) return;
      const x0 = sx & ~7, y0 = sy & ~7;
      const cell = attrIndex(sx, sy);
      attrs[cell] = paperTransparent
        ? (attrs[cell] & 0x38) | ink | (brightEnabled ? 64 : 0)
        : activeAttr();
      for (let py = y0; py < y0 + 8; py++) {
        for (let px = x0; px < x0 + 8; px++) {
          const index = offset(px, py), bitMask = 128 >> (px & 7);
          if (bitmap[index] & bitMask ? !inkTransparent : !paperTransparent) mask[index] |= bitMask;
          else mask[index] &= ~bitMask;
        }
      }
    }
    function recolorSelection(kind, index) {
      if (pendingMove) {
        remember();
        const data = pendingMove.data;
        for (let i = 0; i < data.colors.length; i++) {
          if (index < 8) data.colors[i] = kind === 'ink'
            ? (data.colors[i] & ~7) | index : (data.colors[i] & ~0x38) | (index << 3);
          if (!!data.bits[i] === (kind === 'ink')) data.opacity[i] = index === 8 ? 0 : 1;
        }
        render();
        note(tr('{kind} of floating selection changed.', { kind: kind.toUpperCase() }));
        return;
      }
      const x0 = Math.max(0, selection.x - active().x);
      const y0 = Math.max(0, selection.y - active().y);
      const x1 = Math.min(W, selection.x + selection.w - active().x);
      const y1 = Math.min(H, selection.y + selection.h - active().y);
      if (x0 >= x1 || y0 >= y1) return;
      remember();
      for (let cy = y0 >> 3; cy <= (y1 - 1) >> 3; cy++) {
        for (let cx = x0 >> 3; cx <= (x1 - 1) >> 3; cx++) {
          const cell = cy * 32 + cx;
          if (index === 8) continue;
          attrs[cell] = kind === 'ink' ? (attrs[cell] & ~7) | index
            : (attrs[cell] & ~0x38) | (index << 3);
        }
      }
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const byte = offset(x, y), bitMask = 128 >> (x & 7);
          const isInk = !!(bitmap[byte] & bitMask);
          if (isInk !== (kind === 'ink')) continue;
          if (index === 8) mask[byte] &= ~bitMask;
          else mask[byte] |= bitMask;
        }
      }
      render();
      note(tr('{kind} of selection changed; each affected 8×8 cell shares its attributes across its pixels.',
        { kind: kind.toUpperCase() }));
    }
    const activeAttr = () => (ink | (paper << 3) | (brightEnabled ? 64 : 0));
    const copyMove = move => move ? {
      source: move.source ? { ...move.source } : null, target: { ...move.target },
      sourceLayer: move.sourceLayer, targetLayer: move.targetLayer,
      data: { ...move.data, bits: move.data.bits.slice(), colors: move.data.colors.slice(), opacity: move.data.opacity.slice() },
    } : null;
    function snapshot() {
      return { activeLayer, projectFileName, exportFileName, backgroundCode, width: W, height: H,
        selection: selection ? { ...selection } : null, pendingMove: copyMove(pendingMove), layers: layers.map(layer => ({
        name: layer.name, visible: layer.visible, x: layer.x, y: layer.y,
        bitmap: layer.bitmap.slice(), attrs: layer.attrs.slice(), mask: layer.mask.slice(),
      })) };
    }
    function remember(previousSelection = selection) {
      const saved = snapshot();
      saved.selection = previousSelection ? { ...previousSelection } : null;
      undo.push(saved);
      if (undo.length > 50) undo.shift();
      redo.length = 0;
    }
    function restore(from, to) {
      if (!from.length) return;
      stopLineSession(); stopRectangleSession();
      to.push(snapshot());
      const saved = from.pop(); layers = saved.layers; activeLayer = saved.activeLayer;
      projectFileName = saved.projectFileName; exportFileName = saved.exportFileName;
      backgroundCode = saved.backgroundCode;
      setDocumentSize(saved.width, saved.height);
      bindActive(); selection = saved.selection ? { ...saved.selection } : null;
      pendingMove = copyMove(saved.pendingMove);
      updateBackgroundSwatches(); renderLayerList(); render(); updateCanvasCursor();
    }
    function layerForPreview(index, previews, sourceLayers = layers) {
      return previews?.get(index) || sourceLayers[index];
    }
    function compositePixels(previews = pendingMove ? pendingPreviewLayers() : null,
      sourceLayers = layers, background = backgroundCode) {
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
        for (let sy = 0; sy < H; sy++) {
          const y = sy + layer.y;
          if (y < 0 || y >= H) continue;
          for (let sx = 0; sx < W; sx++) {
            const byte = offset(sx, sy), bitMask = 128 >> (sx & 7);
            if (!(layer.mask[byte] & bitMask)) continue;
            const x = sx + layer.x;
            if (x < 0 || x >= W) continue;
            const attr = layer.attrs[attrIndex(sx, sy)];
            const on = !!(layer.bitmap[byte] & bitMask);
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
    function flatten(previews = pendingMove ? pendingPreviewLayers() : null,
      sourceLayers = layers, background = backgroundCode, ignoreTransparency = false) {
      const visible = sourceLayers.map((layer, index) => layerForPreview(index, previews, sourceLayers))
        .filter(layer => layer.visible);
      if (visible.length === 1 && visible[0].x === 0 && visible[0].y === 0 &&
          visible[0].mask.every(byte => byte === 0xff)) {
        const direct = new Uint8Array(6912);
        direct.set(visible[0].bitmap); direct.set(visible[0].attrs, 6144);
        return direct;
      }
      const { imageColors, priority, coverage, cellOwner, paperOwner, paperAttr } =
        compositePixels(previews, sourceLayers, background);
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
    function render(composite = null, outline = null, previews = null) {
      if (!previews && pendingMove) previews = pendingPreviewLayers();
      if (!composite) composite = flatten(previews);
      const image = ctx.createImageData(W, H), pixels = image.data;
      displayedScr = composite;
      const raw = !zxPreview || backgroundCode === -1 ? compositePixels(previews) : null;
      displayedCoverage = backgroundCode === -1 ? raw.coverage : null;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        let rgb;
        if (zxPreview) {
          const a = composite[6144 + attrIndex(x, y)];
          const on = !!(composite[offset(x, y)] & (128 >> (x & 7)));
          const color = on ? a & 7 : (a >> 3) & 7;
          rgb = paletteRgb[a & 64 && color ? color + 8 : color];
        } else rgb = paletteRgb[raw.imageColors[y * MAX_W + x]];
        const i = (y * W + x) * 4;
        pixels[i] = rgb[0]; pixels[i + 1] = rgb[1]; pixels[i + 2] = rgb[2];
        pixels[i + 3] = displayedCoverage && !displayedCoverage[y * W + x] ? 0 : 255;
      }
      ctx.putImageData(image, 0, 0); drawOverlay(outline); paintCursor();
    }
    function setZxPreview(enabled) {
      zxPreview = enabled;
      zxPreviewControl.classList.toggle('active', enabled);
      zxPreviewControl.setAttribute('aria-pressed', String(enabled));
      if (lineSession) refreshPolyline();
      else if (rectangleSession) refreshRectangle();
      else render();
    }
    function paintCursor() {
      if (!cursorPoint || !displayedScr) {
        cursorCoords.textContent = 'x: — · y: —';
        cursorInk.classList.remove('transparent'); cursorPaper.classList.remove('transparent');
        cursorInk.style.backgroundColor = 'transparent';
        cursorPaper.style.backgroundColor = 'transparent';
        cursorInk.title = cursorPaper.title = '';
        return;
      }
      const { x, y } = cursorPoint;
      cursorCoords.textContent = `x: ${x} · y: ${y}`;
      if (displayedCoverage && !displayedCoverage[y * W + x]) {
        cursorInk.style.backgroundColor = cursorPaper.style.backgroundColor = '';
        cursorInk.classList.add('transparent'); cursorPaper.classList.add('transparent');
        cursorInk.title = cursorPaper.title = tr('Transparent');
        return;
      }
      cursorInk.classList.remove('transparent'); cursorPaper.classList.remove('transparent');
      const attr = displayedScr[6144 + attrIndex(x, y)];
      const palette = attr & 64 ? bright : normal;
      const inkIndex = attr & 7, paperIndex = (attr >> 3) & 7;
      cursorInk.style.backgroundColor = palette[inkIndex];
      cursorPaper.style.backgroundColor = palette[paperIndex];
      cursorInk.title = `INK: ${colors[inkIndex]}`;
      cursorPaper.title = `PAPER: ${colors[paperIndex]}`;
    }
    function canMergeDown() {
      return activeLayer > 0 && active().visible && layers[activeLayer - 1].visible;
    }
    const layerList = document.querySelector('#layer-list');
    let layerDrag = null, suppressLayerClick = false;
    function clearLayerDropMarkers(list) {
      for (const item of list.children) item.classList.remove('drop-before', 'drop-after');
    }
    function reorderLayer(sourceLayer, targetLayer, before) {
      const source = layers.indexOf(sourceLayer), target = layers.indexOf(targetLayer);
      if (source < 0 || target < 0) return;
      let insertion = before ? target + 1 : target;
      if (source < insertion) insertion--;
      if (insertion === source) return;
      const selectedLayer = active();
      const moveSource = pendingMove?.sourceLayer != null ? layers[pendingMove.sourceLayer] : null;
      const moveTarget = pendingMove ? layers[pendingMove.targetLayer] : null;
      remember();
      const [moved] = layers.splice(source, 1);
      layers.splice(insertion, 0, moved);
      activeLayer = layers.indexOf(selectedLayer); bindActive();
      if (pendingMove) {
        pendingMove.sourceLayer = moveSource ? layers.indexOf(moveSource) : null;
        pendingMove.targetLayer = layers.indexOf(moveTarget);
      }
      renderLayerList(); render(); note(tr('Layer order changed.'));
    }
    layerList.addEventListener('pointerdown', event => {
      suppressLayerClick = false;
      if (event.button !== 0 || event.target.closest('button')) return;
      const row = event.target.closest('.layer-row');
      if (!row || !layerList.contains(row)) return;
      layerDrag = { source: layers[Number(row.dataset.index)], pointerId: event.pointerId,
        x: event.clientX, y: event.clientY, active: false, target: null, before: false };
    });
    layerList.addEventListener('pointermove', event => {
      const move = layerDrag;
      if (!move || move.pointerId !== event.pointerId) return;
      if (!move.active) {
        const dx = event.clientX - move.x, dy = event.clientY - move.y;
        if (dx * dx + dy * dy < 16) return;
        move.active = true;
        layerList.setPointerCapture(event.pointerId);
        const sourceRow = [...layerList.children].find(row =>
          layers[Number(row.dataset.index)] === move.source);
        sourceRow?.classList.add('dragging');
      }
      event.preventDefault(); clearLayerDropMarkers(layerList);
      move.target = null;
      const bounds = layerList.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right ||
          event.clientY < bounds.top || event.clientY > bounds.bottom) return;
      const rows = [...layerList.children];
      const targetRow = rows.find(item => event.clientY <= item.getBoundingClientRect().bottom) || rows.at(-1);
      if (!targetRow) return;
      const box = targetRow.getBoundingClientRect();
      move.target = layers[Number(targetRow.dataset.index)];
      move.before = event.clientY < box.top + box.height / 2;
      targetRow.classList.add(move.before ? 'drop-before' : 'drop-after');
    });
    layerList.addEventListener('pointerup', event => {
      const move = layerDrag;
      if (!move || move.pointerId !== event.pointerId) return;
      layerDrag = null;
      if (layerList.hasPointerCapture(event.pointerId)) layerList.releasePointerCapture(event.pointerId);
      for (const row of layerList.children) row.classList.remove('dragging');
      clearLayerDropMarkers(layerList);
      if (!move.active) return;
      suppressLayerClick = true;
      if (move.target) reorderLayer(move.source, move.target, move.before);
    });
    layerList.addEventListener('pointercancel', event => {
      if (layerDrag?.pointerId !== event.pointerId) return;
      layerDrag = null;
      for (const row of layerList.children) row.classList.remove('dragging');
      clearLayerDropMarkers(layerList);
    });
    function renderLayerList() {
      const list = layerList;
      list.replaceChildren();
      for (let index = layers.length - 1; index >= 0; index--) {
        const layer = layers[index];
        const row = document.createElement('div');
        row.dataset.index = String(index);
        row.className = 'layer-row' + (index === activeLayer ? ' active' : '');
        row.title = tr('Select or drag layer; double-click its name to rename');
        row.onclick = () => {
          if (suppressLayerClick) return;
          if (activeLayer === index) return;
          stopLineSession(); stopRectangleSession();
          if (selection) remember();
          activeLayer = index; bindActive();
          if (pendingMove) pendingMove.targetLayer = index;
          for (const item of list.children) item.classList.toggle('active', Number(item.dataset.index) === index);
          document.querySelector('#layer-up').disabled = activeLayer === layers.length - 1;
          document.querySelector('#layer-down').disabled = activeLayer === 0;
          document.querySelector('#layer-merge').disabled = !canMergeDown();
          render();
        };
        const eye = document.createElement('button');
        eye.type = 'button'; eye.className = 'layer-eye';
        eye.title = tr('Show or hide layer (V toggles active layer)');
        eye.setAttribute('aria-label', tr(layer.visible ? 'Hide layer' : 'Show layer'));
        eye.innerHTML = `<svg class="icon"><use href="#i-eye${layer.visible ? '' : '-off'}"/></svg>`;
        eye.onclick = event => {
          event.stopPropagation(); remember(); layer.visible = !layer.visible;
          renderLayerList(); render();
        };
        const name = document.createElement('span');
        name.className = 'layer-name'; name.textContent = layer.name;
        name.ondblclick = async event => {
          event.stopPropagation();
          const next = await askName(tr('Layer name'), layer.name, tr('Rename'));
          if (next !== null && next !== layer.name) {
            remember(); layer.name = next; renderLayerList();
          }
        };
        const coords = document.createElement('span');
        coords.className = 'layer-coords';
        coords.textContent = `x:${layer.x} y:${layer.y}`;
        coords.title = tr('Layer offset: x {x}, y {y}', { x: layer.x, y: layer.y });
        row.append(eye, name, coords); list.appendChild(row);
      }
      document.querySelector('#layer-up').disabled = activeLayer === layers.length - 1;
      document.querySelector('#layer-down').disabled = activeLayer === 0;
      document.querySelector('#layer-merge').disabled = !canMergeDown();
      document.querySelector('#layer-delete').disabled = layers.length === 1;
    }
    function updateActiveLayerCoords() {
      const coords = document.querySelector('#layer-list .layer-row.active .layer-coords');
      if (!coords) return;
      coords.textContent = `x:${active().x} y:${active().y}`;
      coords.title = tr('Layer offset: x {x}, y {y}', { x: active().x, y: active().y });
    }
    function addLayer() {
      stopLineSession(); stopRectangleSession();
      remember();
      const number = layers.length + 1;
      layers.push(emptyLayer(tr('Layer {number}', { number })));
      activeLayer = layers.length - 1; bindActive();
      if (pendingMove) pendingMove.targetLayer = activeLayer;
      renderLayerList(); render();
    }
    function moveLayerStack(step) {
      const next = activeLayer + step;
      if (next < 0 || next >= layers.length) return;
      const moveSource = pendingMove?.sourceLayer != null ? layers[pendingMove.sourceLayer] : null;
      const moveTarget = pendingMove ? layers[pendingMove.targetLayer] : null;
      remember();
      [layers[activeLayer], layers[next]] = [layers[next], layers[activeLayer]];
      activeLayer = next; bindActive();
      if (pendingMove) {
        pendingMove.sourceLayer = moveSource ? layers.indexOf(moveSource) : null;
        pendingMove.targetLayer = layers.indexOf(moveTarget);
      }
      renderLayerList(); render();
    }
    function deleteLayer() {
      if (layers.length === 1) return;
      stopLineSession(); stopRectangleSession();
      const removed = active();
      const moveSource = pendingMove?.sourceLayer != null ? layers[pendingMove.sourceLayer] : null;
      const moveTarget = pendingMove ? layers[pendingMove.targetLayer] : null;
      remember(); layers.splice(activeLayer, 1);
      activeLayer = Math.min(activeLayer, layers.length - 1);
      bindActive();
      if (pendingMove) {
        pendingMove.sourceLayer = moveSource && moveSource !== removed ? layers.indexOf(moveSource) : null;
        if (pendingMove.sourceLayer == null) pendingMove.source = null;
        pendingMove.targetLayer = moveTarget && moveTarget !== removed ? layers.indexOf(moveTarget) : activeLayer;
      }
      renderLayerList(); render();
    }
    function mergeDown() {
      if (!canMergeDown()) return;
      stopLineSession(); stopRectangleSession(); commitText();
      remember(); finishPendingMove(); selection = null;
      const lowerIndex = activeLayer - 1;
      const pair = [layers[lowerIndex], layers[activeLayer]];
      const coverage = compositePixels(null, pair, -1).coverage;
      const encoded = flatten(null, pair, -1, true);
      const mergedMask = new Uint8Array(6144);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (coverage[y * W + x]) mergedMask[offset(x, y)] |= 128 >> (x & 7);
      }
      layers[lowerIndex] = { name: pair[0].name, visible: true, x: 0, y: 0,
        bitmap: encoded.slice(0, 6144), attrs: encoded.slice(6144), mask: mergedMask };
      layers.splice(activeLayer, 1);
      activeLayer = lowerIndex; bindActive();
      renderLayerList(); render(); note(tr('Merged with layer below.'));
    }
    function setDocumentSize(width, height) {
      W = width; H = height;
      screen.width = width; screen.height = height;
      transparencyCanvas.width = width * 2; transparencyCanvas.height = height * 2;
      drawTransparency();
      const preview = document.querySelector('#text-preview');
      preview.width = width; preview.height = height;
      previewText();
      document.querySelector('#pixel-overlay').setAttribute('viewBox', `0 0 ${width} ${height}`);
      document.querySelector('#overlay').setAttribute('viewBox', `0 0 ${width} ${height}`);
      document.querySelector('#document-size').textContent = `${width}×${height}`;
      const fullScreen = width === MAX_W && height === MAX_H;
      const scrExport = document.querySelector('#save');
      scrExport.disabled = !fullScreen;
      scrExport.title = tr(fullScreen ? 'Export SCR (⌘⇧S)' : 'SCR export requires a full 256×192 screen');
      stage.style.width = width * zoom + 'px';
      stage.style.height = height * zoom + 'px';
      viewport.scrollLeft = 0; viewport.scrollTop = 0;
      updateGrid();
    }
    function resetDocument(width = MAX_W, height = MAX_H) {
      stopLineSession(); stopRectangleSession(); cancelText(); remember();
      pendingMove = null;
      layers = [emptyLayer(tr('Layer {number}', { number: 1 }))]; activeLayer = 0; backgroundCode = 0;
      zxPreview = true; zxPreviewControl.classList.add('active'); zxPreviewControl.setAttribute('aria-pressed', 'true');
      attrMode = false; attrModeButton.classList.remove('active'); attrModeButton.setAttribute('aria-pressed', 'false');
      paperTransparent = true; updateSwatches();
      projectFileName = 'screen.pixie'; exportFileName = 'screen.scr';
      setDocumentSize(width, height);
      bindActive(); selection = null; setTool('draw');
      updateBackgroundSwatches(); renderLayerList(); render(); fitZoom();
      note(tr('New blank document.'));
    }
    function newDocument() {
      const dialog = document.querySelector('#new-dialog');
      if (dialog.open) return;
      document.querySelector('input[name="new-size"][value="screen"]').checked = true;
      document.querySelector('#new-size-error').textContent = '';
      dialog.showModal();
    }
    function mark(name, coordinates, color) {
      const ns = 'http://www.w3.org/2000/svg';
      const element = document.createElementNS(ns, name);
      for (const [key, value] of Object.entries(coordinates)) element.setAttribute(key, value);
      element.setAttribute('fill', 'none');
      element.setAttribute('stroke', color);
      element.setAttribute('stroke-width', '1');
      element.setAttribute('vector-effect', 'non-scaling-stroke');
      element.setAttribute('shape-rendering', 'crispEdges');
      return element;
    }
    function drawTransparency() {
      const unit = zoom >= 8 ? 1 : 8;
      const image = transparencyContext.createImageData(W * 2, H * 2);
      const pixels = image.data;
      const shades = [[80, 84, 91], [48, 52, 60]];
      for (let y = 0; y < H * 2; y++) {
        for (let x = 0; x < W * 2; x++) {
          const shade = shades[((x / unit | 0) + (y / unit | 0)) & 1];
          const i = (y * W * 2 + x) * 4;
          pixels[i] = shade[0]; pixels[i + 1] = shade[1]; pixels[i + 2] = shade[2]; pixels[i + 3] = 255;
        }
      }
      transparencyContext.putImageData(image, 0, 0);
    }
    function updateGrid() {
      const pixels = document.createDocumentFragment(), cells = document.createDocumentFragment();
      if (gridEnabled) {
        if (zoom >= 8) {
          for (let x = 1; x < W; x++) if (x % 8) pixels.appendChild(mark('line', { x1: x, y1: 0, x2: x, y2: H }, '#222222'));
          for (let y = 1; y < H; y++) if (y % 8) pixels.appendChild(mark('line', { x1: 0, y1: y, x2: W, y2: y }, '#222222'));
        }
        for (let x = 8; x < W; x += 8) cells.appendChild(mark('line', { x1: x, y1: 0, x2: x, y2: H }, '#888888'));
        for (let y = 8; y < H; y += 8) cells.appendChild(mark('line', { x1: 0, y1: y, x2: W, y2: y }, '#888888'));
      }
      pixelGrid.replaceChildren(pixels);
      cellGrid.replaceChildren(cells);
    }
    function drawOverlay(preview = null) {
      const s = preview || selection;
      if (!s) { selectionOutline.replaceChildren(); return; }
      const outline = mark('rect', { x: s.x, y: s.y, width: s.w, height: s.h }, '#ff40ff');
      outline.setAttribute('stroke-dasharray', '4 3');
      selectionOutline.replaceChildren(outline);
    }
    function updateCanvasCursor(p = cursorPoint) {
      screen.style.cursor = drag?.action === 'move' || drag?.action === 'move-layer' ? 'grabbing'
        : tool === 'move-layer' || (tool === 'select' && contains(selection, p)) ? 'grab'
        : tool === 'text' ? 'text' : 'crosshair';
    }
    function setTool(name) {
      if (tool === 'line' && name !== 'line') stopLineSession();
      if (rectangleSession && name !== rectangleSession.action) stopRectangleSession();
      tool = name;
      document.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === name));
      updateCanvasCursor();
      const tips = {
        draw: 'Click an empty pixel to draw or a filled pixel to erase; drag to continue.',
        line: 'Click for polyline points or drag one segment; Escape ends the polyline.',
        rect: 'Draw an outlined rectangle with two clicks or a drag.',
        'fill-rect': 'Draw a filled rectangle with two clicks or a drag.',
        select: 'Select an area; Shift snaps the outline to 8×8 cells.',
        'move-layer': 'Drag the canvas to move the active layer.',
        text: 'Click the canvas and type. Enter commits; Escape cancels.',
      };
      note(tr(tips[name]));
    }
    const point = event => {
      const r = screen.getBoundingClientRect();
      return { x: Math.floor((event.clientX - r.left) * W / r.width), y: Math.floor((event.clientY - r.top) * H / r.height) };
    };
    const clamp = (value, max) => Math.max(0, Math.min(max, value));
    const rectangle = (a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x) + 1, h: Math.abs(a.y - b.y) + 1 });
    function selectionRectangle(a, b, snap) {
      const rect = rectangle(a, b);
      if (!snap) return rect;
      const x = Math.floor(rect.x / 8) * 8, y = Math.floor(rect.y / 8) * 8;
      return { x, y, w: Math.min(W, Math.ceil((rect.x + rect.w) / 8) * 8) - x,
        h: Math.min(H, Math.ceil((rect.y + rect.h) / 8) * 8) - y };
    }
    const contains = (s, p) => !!s && !!p && p.x >= s.x && p.x < s.x + s.w && p.y >= s.y && p.y < s.y + s.h;
    const sameSelection = (a, b) => a === b || !!a && !!b &&
      a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
    function capture(s) {
      const bits = new Uint8Array(s.w * s.h), colors = new Uint8Array(bits.length), opacity = new Uint8Array(bits.length);
      for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
        const i = y * s.w + x, sx = s.x + x, sy = s.y + y;
        bits[i] = bit(sx, sy) ? 1 : 0; colors[i] = getAttr(sx, sy);
        const lx = sx - active().x, ly = sy - active().y;
        opacity[i] = inside(lx, ly) && !!(mask[offset(lx, ly)] & (128 >> (lx & 7))) ? 1 : 0;
      }
      return { x: s.x, y: s.y, w: s.w, h: s.h, bits, colors, opacity };
    }
    function clear(s) {
      for (let y = s.y; y < s.y + s.h; y++) for (let x = s.x; x < s.x + s.w; x++) setBit(x, y, false, false);
    }
    function stamp(data, x0, y0) {
      for (let y = 0; y < data.h; y++) for (let x = 0; x < data.w; x++) {
        const dx = x0 + x, dy = y0 + y;
        if (!inside(dx, dy)) continue;
        const i = y * data.w + x;
        if (!data.opacity[i]) continue;
        setBit(dx, dy, !!data.bits[i], true); setAttr(dx, dy, data.colors[i]);
      }
    }
    function withLayer(index, layer, action) {
      const originalIndex = activeLayer, originalBitmap = bitmap, originalAttrs = attrs, originalMask = mask;
      activeLayer = index; bitmap = layer.bitmap; attrs = layer.attrs; mask = layer.mask;
      try { action(); }
      finally {
        activeLayer = originalIndex; bitmap = originalBitmap; attrs = originalAttrs; mask = originalMask;
      }
    }
    function movePreviewLayers(source, data, target, sourceLayer, targetLayer) {
      const previews = new Map();
      const edit = (index, action) => {
        if (index == null || index < 0) return;
        let layer = previews.get(index);
        if (!layer) {
          const original = layers[index];
          layer = { ...original, bitmap: original.bitmap.slice(), attrs: original.attrs.slice(), mask: original.mask.slice() };
          previews.set(index, layer);
        }
        withLayer(index, layer, action);
      };
      if (source) edit(sourceLayer, () => clear(source));
      edit(targetLayer, () => stamp(data, target.x, target.y));
      return previews;
    }
    function pendingPreviewLayers() {
      return movePreviewLayers(pendingMove.source, pendingMove.data, pendingMove.target,
        pendingMove.sourceLayer, pendingMove.targetLayer);
    }
    function finishPendingMove() {
      if (!pendingMove) return;
      if (pendingMove.source) withLayer(pendingMove.sourceLayer, layers[pendingMove.sourceLayer],
        () => clear(pendingMove.source));
      withLayer(pendingMove.targetLayer, layers[pendingMove.targetLayer],
        () => stamp(pendingMove.data, pendingMove.target.x, pendingMove.target.y));
      pendingMove = null;
    }
    function removeSelectionPixels() {
      if (!pendingMove) { clear(selection); return; }
      if (pendingMove.source) withLayer(pendingMove.sourceLayer, layers[pendingMove.sourceLayer],
        () => clear(pendingMove.source));
      pendingMove = null;
    }
    function moveTarget(p) {
      return { x: clamp(drag.source.x + p.x - drag.start.x, W - 1),
        y: clamp(drag.source.y + p.y - drag.start.y, H - 1),
        w: drag.source.w, h: drag.source.h };
    }
    function previewMove(target) {
      const move = pendingMove || { source: drag.source, data: drag.data,
        sourceLayer: activeLayer, targetLayer: activeLayer };
      const previews = movePreviewLayers(move.source, move.data, target, move.sourceLayer, move.targetLayer);
      render(flatten(previews), target, previews);
    }
    function paintBrush(x, y, on) {
      const width = strokeWidth;
      const offset = Math.floor((width - 1) / 2);
      for (let by = y - offset; by < y - offset + width; by++) {
        for (let bx = x - offset; bx < x - offset + width; bx++) {
          if (on && !inkTransparent) {
            setBit(bx, by, true, true);
            paintAttrCell(bx, by);
          } else {
            setBit(bx, by, false, on ? false : !paperTransparent);
          }
        }
      }
    }
    function line(a, b, on) {
      let x = a.x, y = a.y;
      const dx = Math.abs(b.x - x), dy = -Math.abs(b.y - y), sx = x < b.x ? 1 : -1, sy = y < b.y ? 1 : -1;
      let err = dx + dy;
      while (true) {
        paintBrush(x, y, on);
        if (x === b.x && y === b.y) break;
        const e2 = err * 2;
        if (e2 >= dy) { err += dy; x += sx; }
        if (e2 <= dx) { err += dx; y += sy; }
      }
    }
    function paintShape(action, start, end, on) {
      if (action === 'line') { line(start, end, on); return; }
      const rect = rectangle(start, end);
      if (action === 'fill-rect') {
        for (let y = rect.y; y < rect.y + rect.h; y++) {
          for (let x = rect.x; x < rect.x + rect.w; x++) paintBrush(x, y, on);
        }
      } else {
        const left = rect.x, right = rect.x + rect.w - 1;
        const top = rect.y, bottom = rect.y + rect.h - 1;
        line({ x: left, y: top }, { x: right, y: top }, on);
        line({ x: right, y: top }, { x: right, y: bottom }, on);
        line({ x: right, y: bottom }, { x: left, y: bottom }, on);
        line({ x: left, y: bottom }, { x: left, y: top }, on);
      }
    }
    const cellPoint = p => ({ x: p.x >> 3, y: p.y >> 3 });
    function cellLine(a, b) {
      let x = a.x, y = a.y;
      const dx = Math.abs(b.x - x), dy = -Math.abs(b.y - y), sx = x < b.x ? 1 : -1, sy = y < b.y ? 1 : -1;
      let err = dx + dy;
      while (true) {
        paintAttrCell(x * 8, y * 8);
        if (x === b.x && y === b.y) break;
        const e2 = err * 2;
        if (e2 >= dy) { err += dy; x += sx; }
        if (e2 <= dx) { err += dx; y += sy; }
      }
    }
    function paintAttributeShape(action, start, end) {
      const a = cellPoint(start), b = cellPoint(end);
      if (action === 'line') { cellLine(a, b); return; }
      const rect = rectangle(a, b);
      if (action === 'fill-rect') {
        for (let y = rect.y; y < rect.y + rect.h; y++) {
          for (let x = rect.x; x < rect.x + rect.w; x++) paintAttrCell(x * 8, y * 8);
        }
      } else {
        const left = rect.x, right = rect.x + rect.w - 1;
        const top = rect.y, bottom = rect.y + rect.h - 1;
        cellLine({ x: left, y: top }, { x: right, y: top });
        cellLine({ x: right, y: top }, { x: right, y: bottom });
        cellLine({ x: right, y: bottom }, { x: left, y: bottom });
        cellLine({ x: left, y: bottom }, { x: left, y: top });
      }
    }
    const shapeMeasure = document.querySelector('#shape-measure');
    function lineEnd(start, end, shifted, maxX = W - 1, maxY = H - 1) {
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
    function hideShapeMeasure() { shapeMeasure.style.display = 'none'; }
    function showShapeMeasure(value, clientX, clientY) {
      shapeMeasure.textContent = value;
      shapeMeasure.style.display = 'block';
      shapeMeasure.style.left = `${Math.max(8, Math.min(clientX + 14, window.innerWidth - shapeMeasure.offsetWidth - 8))}px`;
      shapeMeasure.style.top = `${Math.max(8, Math.min(clientY + 14, window.innerHeight - shapeMeasure.offsetHeight - 8))}px`;
    }
    function lineEndpoint(start, raw, shifted) {
      if (attrMode) {
        const first = cellPoint(start);
        const last = lineEnd(first, cellPoint(raw), shifted, Math.ceil(W / 8) - 1, Math.ceil(H / 8) - 1);
        return { end: { x: last.x * 8, y: last.y * 8 },
          length: Math.max(Math.abs(last.x - first.x), Math.abs(last.y - first.y)) + 1,
          unit: tr('cells') };
      }
      const end = lineEnd(start, raw, shifted);
      return { end, length: Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y)) + 1,
        unit: 'px' };
    }
    function previewPolyline(raw, shifted, clientX, clientY) {
      if (!lineSession) return;
      const index = layers.indexOf(lineSession.layer);
      if (index < 0) { stopLineSession(); return; }
      lineSession.raw = raw;
      lineSession.pointer = { x: clientX, y: clientY };
      const { end, length, unit } = lineEndpoint(lineSession.start, raw, shifted);
      const layer = layers[index];
      const previewLayer = { ...layer, bitmap: layer.bitmap.slice(), attrs: layer.attrs.slice(), mask: layer.mask.slice() };
      withLayer(index, previewLayer, () => {
        if (attrMode) paintAttributeShape('line', lineSession.start, end);
        else paintShape('line', lineSession.start, end, lineSession.on);
      });
      const previews = new Map([[index, previewLayer]]);
      render(flatten(previews), null, previews);
      showShapeMeasure(`${length} ${unit}`, clientX, clientY);
    }
    function stopLineSession() {
      if (!lineSession) return;
      if (shapePress?.kind === 'line') shapePress = null;
      lineSession = null; hideShapeMeasure(); render();
    }
    function refreshPolyline() {
      if (lineSession?.raw && lineSession.pointer)
        previewPolyline(lineSession.raw, shiftHeld, lineSession.pointer.x, lineSession.pointer.y);
    }
    function clickPolyline(p, shifted, clientX, clientY) {
      if (!lineSession) {
        lineSession = { layer: active(), start: p, on: true, committed: false };
        previewPolyline(p, shifted, clientX, clientY);
        return;
      }
      const index = layers.indexOf(lineSession.layer);
      if (index < 0) { stopLineSession(); return; }
      const { end } = lineEndpoint(lineSession.start, p, shifted);
      if (!lineSession.committed) { remember(); lineSession.committed = true; }
      withLayer(index, layers[index], () => {
        if (attrMode) paintAttributeShape('line', lineSession.start, end);
        else paintShape('line', lineSession.start, end, lineSession.on);
      });
      lineSession.start = end;
      previewPolyline(end, false, clientX, clientY);
    }
    function previewRectangle(end, clientX, clientY) {
      if (!rectangleSession) return;
      const index = layers.indexOf(rectangleSession.layer);
      if (index < 0) { stopRectangleSession(); return; }
      rectangleSession.raw = end;
      rectangleSession.pointer = { x: clientX, y: clientY };
      const layer = layers[index];
      const previewLayer = { ...layer, bitmap: layer.bitmap.slice(), attrs: layer.attrs.slice(), mask: layer.mask.slice() };
      withLayer(index, previewLayer, () => {
        if (rectangleSession.attrMode) paintAttributeShape(rectangleSession.action, rectangleSession.start, end);
        else paintShape(rectangleSession.action, rectangleSession.start, end, rectangleSession.on);
      });
      const previews = new Map([[index, previewLayer]]);
      render(flatten(previews), null, previews);
      const size = rectangle(rectangleSession.attrMode ? cellPoint(rectangleSession.start) : rectangleSession.start,
        rectangleSession.attrMode ? cellPoint(end) : end);
      showShapeMeasure(`${size.w}×${size.h} ${rectangleSession.attrMode ? tr('cells') : 'px'}`, clientX, clientY);
    }
    function stopRectangleSession() {
      if (!rectangleSession) return;
      if (shapePress?.kind === 'rectangle') shapePress = null;
      rectangleSession = null; hideShapeMeasure(); render();
    }
    function refreshRectangle() {
      if (!rectangleSession?.raw || !rectangleSession.pointer) return;
      rectangleSession.attrMode = attrMode && !rectangleSession.forceErase;
      previewRectangle(rectangleSession.raw, rectangleSession.pointer.x, rectangleSession.pointer.y);
    }
    function clickRectangle(p, forceErase, clientX, clientY) {
      if (!rectangleSession) {
        rectangleSession = { layer: active(), action: tool, start: p, forceErase,
          attrMode: attrMode && !forceErase, on: !forceErase };
        previewRectangle(p, clientX, clientY);
        return true;
      }
      if (forceErase) {
        rectangleSession.forceErase = true;
        rectangleSession.attrMode = false;
        rectangleSession.on = false;
      }
      const index = layers.indexOf(rectangleSession.layer);
      if (index < 0) { stopRectangleSession(); return false; }
      remember();
      withLayer(index, layers[index], () => {
        if (rectangleSession.attrMode) paintAttributeShape(rectangleSession.action, rectangleSession.start, p);
        else paintShape(rectangleSession.action, rectangleSession.start, p, rectangleSession.on);
      });
      stopRectangleSession();
      return false;
    }
    function previewSelection(end, snap, clientX, clientY) {
      drag.raw = end;
      drag.pointer = { x: clientX, y: clientY };
      const size = selectionRectangle(drag.start, end, snap);
      drawOverlay(size);
      showShapeMeasure(`${size.w}×${size.h} px`, clientX, clientY);
    }
    function drawText(p, value) {
      if (!value) return;
      remember();
      const originalIndex = activeLayer, targetIndex = layers.indexOf(p.layer);
      if (targetIndex >= 0) { activeLayer = targetIndex; bindActive(); }
      try {
        for (let n = 0; n < value.length; n++) {
          const code = value.charCodeAt(n);
          if (code < 32 || code > 127) continue;
          for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
            const x = p.x + n * 8 + col, y = p.y + row;
            if (!inside(x, y)) continue;
            const on = !!(font[(code - 32) * 8 + row] & (128 >> col));
            setBit(x, y, on); setAttr(x, y, activeAttr());
          }
        }
      } finally { activeLayer = originalIndex; bindActive(); }
      render();
    }
    function previewText() {
      textPreview.clearRect(0, 0, W, H);
      if (!textSession) return;
      const value = textEntry.value;
      const palette = brightEnabled ? bright : normal;
      for (let n = 0; n < value.length; n++) {
        const code = value.charCodeAt(n);
        if (code < 32 || code > 127) continue;
        if (!paperTransparent) {
          textPreview.fillStyle = palette[paper];
          textPreview.fillRect(textSession.x + n * 8, textSession.y, 8, 8);
        }
        if (inkTransparent) continue;
        textPreview.fillStyle = palette[ink];
        for (let row = 0; row < 8; row++) {
          const bits = font[(code - 32) * 8 + row];
          for (let col = 0; col < 8; col++) {
            if (bits & (128 >> col)) textPreview.fillRect(textSession.x + n * 8 + col, textSession.y + row, 1, 1);
          }
        }
      }
      textPreview.fillStyle = '#ff40ff';
      textPreview.fillRect(textSession.x + value.length * 8, textSession.y, 1, 8);
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
      commitText(); textSession = { x: p.x, y: p.y, layer: active() };
      textEntry.focus({ preventScroll: true }); previewText();
    }
    textEntry.addEventListener('input', () => {
      const clean = textEntry.value.replace(/[^\x20-\x7f]/g, '');
      if (clean !== textEntry.value) {
        textEntry.value = clean; note(tr('The ZX ROM font supports ASCII characters only.'));
      }
      previewText();
    });
    textEntry.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); commitText(); }
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancelText(); }
    });
    document.addEventListener('click', event => {
      if (!textSession || event.target === textEntry || event.target.closest('#viewport')) return;
      if (document.querySelector('dialog[open]')) return;
      if (event.target.closest('#new, #open, #open-project, #save, #save-project, #save-png')) return;
      textEntry.focus({ preventScroll: true });
    });
    viewport.addEventListener('pointerdown', event => {
      if (event.target.closest('#stage')) return;
      if (textSession) commitText();
      if (lineSession) stopLineSession();
      if (rectangleSession) stopRectangleSession();
      if (selection) { remember(); finishPendingMove(); selection = null; render(); }
    });
    function beginShapePress(kind, event) {
      shapePress = { kind, pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
      screen.setPointerCapture(event.pointerId);
    }
    function updateShapePress(event) {
      if (!shapePress || shapePress.pointerId !== event.pointerId) return;
      const dx = event.clientX - shapePress.x, dy = event.clientY - shapePress.y;
      if (dx * dx + dy * dy >= 9) shapePress.moved = true;
    }
    screen.addEventListener('contextmenu', event => {
      if (tool === 'draw' || tool === 'rect' || tool === 'fill-rect') event.preventDefault();
    });
    screen.addEventListener('pointerdown', event => {
      if (shapePress) return;
      const forceErase = event.button === 2 && (tool === 'draw' || tool === 'rect' || tool === 'fill-rect');
      if (event.button !== 0 && !forceErase) return;
      const p = point(event); if (!inside(p.x, p.y)) return;
      if (forceErase) event.preventDefault();
      if (tool !== 'text' && textSession) commitText();
      const previousSelection = selection ? { ...selection } : null;
      let finalizedPending = false;
      if (pendingMove && (tool !== 'select' || !contains(selection, p))) {
        remember(); finishPendingMove();
        finalizedPending = true;
      }
      if (tool !== 'select' && selection) { selection = null; drawOverlay(); }
      if (tool === 'text') {
        if (previousSelection && !finalizedPending) remember(previousSelection);
        const position = event.shiftKey || shiftHeld
          ? { x: p.x & ~7, y: p.y & ~7 } : p;
        event.preventDefault(); startText(position); return;
      }
      if (tool === 'line') {
        if (previousSelection && !finalizedPending) remember(previousSelection);
        event.preventDefault();
        clickPolyline(p, event.shiftKey || shiftHeld, event.clientX, event.clientY);
        if (lineSession) beginShapePress('line', event);
        return;
      }
      if (tool === 'rect' || tool === 'fill-rect') {
        if (previousSelection && !finalizedPending) remember(previousSelection);
        event.preventDefault();
        if (clickRectangle(p, forceErase, event.clientX, event.clientY)) beginShapePress('rectangle', event);
        return;
      }
      if (drawingTools.has(tool) && !finalizedPending) remember(previousSelection);
      if (tool === 'move-layer' && !finalizedPending) remember(previousSelection);
      drag = { start: p, last: p, action: tool === 'select' && contains(selection, p) ? 'move' : tool,
        attrMode: attrMode && drawingTools.has(tool) && !forceErase, previousSelection, finalizedPending };
      if (tool === 'draw' && !drag.attrMode) drag.on = !forceErase && (inkTransparent || !bit(p.x, p.y));
      if (tool === 'move-layer') drag.origin = { x: active().x, y: active().y };
      if (drag.action === 'move') {
        drag.source = { ...selection };
        drag.data = pendingMove ? pendingMove.data : capture(drag.source);
      }
      if (drag.action === 'select') selection = null;
      screen.setPointerCapture(event.pointerId);
      updateCanvasCursor(p);
      if (tool === 'draw') {
        if (drag.attrMode) paintAttrCell(p.x, p.y);
        else paintBrush(p.x, p.y, drag.on);
      }
      render();
      if (drag.action === 'select') previewSelection(p, event.shiftKey || shiftHeld, event.clientX, event.clientY);
    });
    screen.addEventListener('pointermove', event => {
      updateShapePress(event);
      if (lineSession) {
        const raw = point(event), p = { x: clamp(raw.x, W - 1), y: clamp(raw.y, H - 1) };
        previewPolyline(p, event.shiftKey || shiftHeld, event.clientX, event.clientY);
        return;
      }
      if (rectangleSession) {
        const raw = point(event), p = { x: clamp(raw.x, W - 1), y: clamp(raw.y, H - 1) };
        previewRectangle(p, event.clientX, event.clientY);
        return;
      }
      if (!drag) return;
      const raw = point(event), p = { x: clamp(raw.x, W - 1), y: clamp(raw.y, H - 1) };
      if (drag.action === 'draw') {
        if (drag.attrMode) cellLine(cellPoint(drag.last), cellPoint(p));
        else line(drag.last, p, drag.on);
      }
      if (drag.action === 'move-layer') {
        active().x = drag.origin.x + p.x - drag.start.x;
        active().y = drag.origin.y + p.y - drag.start.y;
        updateActiveLayerCoords();
      }
      if (drag.action === 'select') previewSelection(p, event.shiftKey || shiftHeld, event.clientX, event.clientY);
      else if (drag.action === 'move') previewMove(moveTarget(p));
      else render();
      drag.last = p;
    });
    function updateCursor(event) {
      const p = point(event);
      cursorPoint = inside(p.x, p.y) ? p : null;
      paintCursor();
      updateCanvasCursor(cursorPoint);
    }
    screen.addEventListener('pointerdown', updateCursor);
    screen.addEventListener('pointermove', updateCursor);
    screen.addEventListener('pointerleave', () => { cursorPoint = null; paintCursor(); updateCanvasCursor(null); });
    screen.addEventListener('pointerup', event => {
      if (shapePress?.pointerId === event.pointerId) {
        updateShapePress(event);
        const press = shapePress;
        shapePress = null;
        if (press.moved) {
          const raw = point(event), p = { x: clamp(raw.x, W - 1), y: clamp(raw.y, H - 1) };
          if (press.kind === 'line' && lineSession) {
            clickPolyline(p, event.shiftKey || shiftHeld, event.clientX, event.clientY);
            stopLineSession();
          } else if (press.kind === 'rectangle' && rectangleSession) {
            clickRectangle(p, false, event.clientX, event.clientY);
          }
        }
        return;
      }
      if (!drag) return;
      if (drag.action === 'draw') {
        const raw = point(event), p = { x: clamp(raw.x, W - 1), y: clamp(raw.y, H - 1) };
        if (drag.attrMode) cellLine(cellPoint(drag.last), cellPoint(p));
        else line(drag.last, p, drag.on);
      }
      if (drag.action === 'move-layer') {
        const raw = point(event), p = { x: clamp(raw.x, W - 1), y: clamp(raw.y, H - 1) };
        active().x = drag.origin.x + p.x - drag.start.x;
        active().y = drag.origin.y + p.y - drag.start.y;
        renderLayerList();
      }
      if (drag.action === 'select') {
        const raw = point(event), p = { x: clamp(raw.x, W - 1), y: clamp(raw.y, H - 1) };
        const snap = event.shiftKey || shiftHeld;
        const nextSelection = !snap && drag.start.x === p.x && drag.start.y === p.y
          ? null : selectionRectangle(drag.start, p, snap);
        if (!drag.finalizedPending && !sameSelection(drag.previousSelection, nextSelection)) remember(drag.previousSelection);
        selection = nextSelection;
      }
      if (drag.action === 'move') {
        const raw = point(event), p = { x: clamp(raw.x, W - 1), y: clamp(raw.y, H - 1) };
        const dx = p.x - drag.start.x, dy = p.y - drag.start.y;
        if (dx || dy) {
          const target = moveTarget(p);
          if (!sameSelection(selection, target)) {
            remember();
            if (pendingMove) pendingMove.target = target;
            else pendingMove = { source: drag.source, data: drag.data, target,
              sourceLayer: activeLayer, targetLayer: activeLayer };
            selection = target;
          }
        } else { remember(); finishPendingMove(); selection = null; }
      }
      hideShapeMeasure(); drag = null; render(); updateCursor(event);
    });
    screen.addEventListener('pointercancel', () => {
      if (shapePress) {
        if (shapePress.kind === 'line') stopLineSession();
        else stopRectangleSession();
        shapePress = null;
      }
      if (drag?.action === 'select') selection = drag.finalizedPending ? null : drag.previousSelection;
      hideShapeMeasure(); drag = null; render(); updateCanvasCursor();
    });
    document.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => setTool(b.dataset.tool));
    document.querySelector('#new').onclick = newDocument;
    const newDialog = document.querySelector('#new-dialog');
    for (const input of document.querySelectorAll('#new-width, #new-height')) {
      input.addEventListener('focus', () => {
        document.querySelector('input[name="new-size"][value="custom"]').checked = true;
      });
    }
    function requestedSize() {
      if (document.querySelector('input[name="new-size"][value="screen"]').checked)
        return { width: MAX_W, height: MAX_H };
      const width = Number(document.querySelector('#new-width').value);
      const height = Number(document.querySelector('#new-height').value);
      if (!Number.isInteger(width) || !Number.isInteger(height) ||
          width < 1 || width > MAX_W || height < 1 || height > MAX_H) {
        document.querySelector('#new-size-error').textContent = tr('Size: width 1–256, height 1–192 pixels.');
        return null;
      }
      document.querySelector('#new-size-error').textContent = '';
      return { width, height };
    }
    document.querySelector('#new-cancel').onclick = () => newDialog.close();
    document.querySelector('#new-discard').onclick = () => {
      const size = requestedSize(); if (!size) return;
      newDialog.close(); resetDocument(size.width, size.height);
    };
    document.querySelector('#new-save').onclick = async () => {
      const size = requestedSize(); if (!size) return;
      newDialog.close();
      if (await saveProject()) resetDocument(size.width, size.height);
    };
    document.querySelector('#layer-add').onclick = addLayer;
    document.querySelector('#layer-up').onclick = () => moveLayerStack(1);
    document.querySelector('#layer-down').onclick = () => moveLayerStack(-1);
    document.querySelector('#layer-merge').onclick = mergeDown;
    document.querySelector('#layer-delete').onclick = deleteLayer;
    function captureSelection() {
      if (!pendingMove) return capture(selection);
      const data = pendingMove.data;
      return { ...data, x: selection.x, y: selection.y,
        bits: data.bits.slice(), colors: data.colors.slice(), opacity: data.opacity.slice() };
    }
    document.querySelector('#copy').onclick = () => { if (selection) { clipboard = captureSelection(); note(tr('Selection copied.')); } };
    document.querySelector('#cut').onclick = () => {
      if (!selection) return;
      clipboard = captureSelection(); remember(); removeSelectionPixels(); render();
      note(tr('Selection cut.'));
    };
    document.querySelector('#paste').onclick = () => {
      if (!clipboard) { note(tr('Copy a selection first.')); return; }
      commitText(); remember();
      finishPendingMove();
      selection = { x: clipboard.x, y: clipboard.y, w: clipboard.w, h: clipboard.h };
      pendingMove = copyMove({ source: null, data: clipboard, target: selection,
        sourceLayer: null, targetLayer: activeLayer });
      setTool('select'); render();
      note(tr('Floating paste at its original position. Drag it or deselect to apply.'));
    };
    document.querySelector('#undo').onclick = () => restore(undo, redo);
    document.querySelector('#redo').onclick = () => restore(redo, undo);
    document.querySelector('#swap').onclick = () => {
      [ink, paper] = [paper, ink];
      [inkTransparent, paperTransparent] = [paperTransparent, inkTransparent];
      updateSwatches(); previewText(); refreshPolyline(); refreshRectangle();
    };
    brightControl.onclick = () => {
      brightEnabled = !brightEnabled;
      brightControl.classList.toggle('active', brightEnabled);
      brightControl.setAttribute('aria-pressed', String(brightEnabled));
      updateSwatches();
      updateBackgroundSwatches();
      previewText();
      refreshPolyline(); refreshRectangle();
    };
    gridControl.onclick = () => {
      gridEnabled = !gridEnabled;
      gridControl.classList.toggle('active', gridEnabled);
      gridControl.setAttribute('aria-pressed', String(gridEnabled));
      updateGrid();
    };
    zxPreviewControl.onclick = () => {
      setZxPreview(!zxPreview);
      note(tr(zxPreview ? 'ZX attribute preview on.' : 'ZX attribute preview off.'));
    };
    function zoomAt(value, clientX, clientY) {
      const next = Math.max(1, Math.min(24, value));
      if (next === zoom) return;
      const view = viewport.getBoundingClientRect();
      if (!Number.isFinite(clientX)) clientX = view.left + view.width / 2;
      if (!Number.isFinite(clientY)) clientY = view.top + view.height / 2;
      const rect = stage.getBoundingClientRect();
      const x = (clientX - rect.left) / zoom, y = (clientY - rect.top) / zoom;
      const previous = zoom;
      zoom = next;
      stage.style.width = W * zoom + 'px';
      stage.style.height = H * zoom + 'px';
      if ((previous >= 8) !== (zoom >= 8)) { drawTransparency(); updateGrid(); }
      viewport.scrollLeft += x * (zoom - previous);
      viewport.scrollTop += y * (zoom - previous);
    }
    function zoomAtCenter(value) {
      const rect = viewport.getBoundingClientRect();
      zoomAt(value, rect.left + rect.width / 2, rect.top + rect.height / 2);
    }
    function fitZoom() {
      const width = (viewport.clientWidth - 60) / W;
      const height = (viewport.clientHeight - 60) / H;
      zoomAtCenter(Math.max(1, Math.min(width, height)));
    }
    document.querySelector('#zoom-1').onclick = () => zoomAtCenter(1);
    document.querySelector('#zoom-2').onclick = () => zoomAtCenter(2);
    document.querySelector('#zoom-fit').onclick = fitZoom;
    // Chromium sends trackpad pinch as Ctrl+wheel. An ordinary wheel scrolls the viewport.
    viewport.addEventListener('wheel', event => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      if (!safariGesture) zoomAt(zoom * Math.exp(-event.deltaY * 0.01), event.clientX, event.clientY);
    }, { passive: false });
    // Safari uses gesture events for the same trackpad motion.
    let safariGesture = false, safariScale = 1;
    viewport.addEventListener('gesturestart', event => {
      event.preventDefault(); safariGesture = true; safariScale = 1;
    }, { passive: false });
    viewport.addEventListener('gesturechange', event => {
      event.preventDefault();
      zoomAt(zoom * event.scale / safariScale, event.clientX, event.clientY);
      safariScale = event.scale;
    }, { passive: false });
    viewport.addEventListener('gestureend', event => {
      event.preventDefault(); safariGesture = false;
    }, { passive: false });
    function download(name, data, type) {
      const url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type }));
      const link = document.createElement('a');
      link.href = url; link.download = name; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    function fileStem(name) {
      return name.replace(/\.(pixie|scr)$/i, '').replace(/-layers$/i, '') || 'screen';
    }
    function askName(title, initial, action = tr('Save')) {
      return new Promise(resolve => {
        const dialog = document.querySelector('#name-dialog');
        if (dialog.open) { resolve(null); return; }
        const input = document.querySelector('#name-input');
        const error = document.querySelector('#name-error');
        const accept = document.querySelector('#name-accept');
        const cancel = document.querySelector('#name-cancel');
        document.querySelector('#name-dialog-title').textContent = title;
        accept.textContent = action;
        input.value = initial;
        error.textContent = '';
        let done = false;
        function finish(value) {
          if (done) return;
          done = true;
          dialog.removeEventListener('close', onClose);
          input.removeEventListener('keydown', onKeydown);
          accept.onclick = cancel.onclick = null;
          if (dialog.open) dialog.close();
          resolve(value);
        }
        function onClose() { finish(null); }
        function onKeydown(event) {
          if (event.key === 'Enter') { event.preventDefault(); accept.click(); }
        }
        accept.onclick = () => {
          const value = input.value.trim();
          if (!value) { error.textContent = tr('Enter a name.'); input.focus(); return; }
          finish(value);
        };
        cancel.onclick = () => finish(null);
        dialog.addEventListener('close', onClose);
        input.addEventListener('keydown', onKeydown);
        dialog.showModal(); input.focus(); input.select();
      });
    }
    async function askFileName(kind, suggested, extension) {
      const answer = await askName(tr('{kind} file name', { kind }), suggested);
      if (answer === null) return null;
      return answer.toLowerCase().endsWith(extension) ? answer : answer + extension;
    }
    function base64(bytes) { return btoa(String.fromCharCode(...bytes)); }
    function decodeBase64(value, length) {
      const bytes = Uint8Array.from(atob(value), char => char.charCodeAt(0));
      if (bytes.length !== length) throw new Error(tr('Invalid layer data size'));
      return bytes;
    }
    function projectText() {
      const lines = [`width = ${W}`, `height = ${H}`, `active = ${activeLayer}`,
        `background = ${backgroundCode}`, `zx_preview = ${zxPreview}`];
      const previews = pendingMove ? pendingPreviewLayers() : null;
      const projectLayers = layers.map((layer, index) => layerForPreview(index, previews));
      for (const layer of projectLayers) {
        lines.push('', '[[layer]]', `name = ${JSON.stringify(layer.name)}`,
          `visible = ${layer.visible}`, `x = ${layer.x}`, `y = ${layer.y}`,
          `bitmap_base64 = "${base64(layer.bitmap)}"`,
          `attrs_base64 = "${base64(layer.attrs)}"`,
          `mask_base64 = "${base64(layer.mask)}"`);
      }
      return lines.join('\n') + '\n';
    }
    function parseProject(source) {
      const parsed = { layers: [] };
      let current = parsed;
      for (const raw of source.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith('#')) continue;
        if (line === '[[layer]]') {
          current = {}; parsed.layers.push(current); continue;
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
            !Number.isInteger(item.x) || !Number.isInteger(item.y)) {
          throw new Error(tr('Invalid layer properties'));
        }
        const bitmap = decodeBase64(item.bitmap_base64, 6144);
        const attrs = decodeBase64(item.attrs_base64, 768);
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
        } else mask = decodeBase64(item.mask_base64, 6144);
        return { name: item.name, visible: item.visible, x: item.x, y: item.y,
          bitmap, attrs, mask };
      });
      return { layers: loaded, activeLayer: parsed.active, background, zxPreview: parsed.zx_preview, width, height };
    }
    document.querySelector('#open').onclick = () => document.querySelector('#file').click();
    document.querySelector('#file').onchange = async event => {
      const file = event.target.files[0]; if (!file) return;
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (bytes.length !== 6912) { note(tr('A standard 6912-byte SCR file is required.')); return; }
      stopLineSession(); stopRectangleSession(); cancelText();
      setDocumentSize(MAX_W, MAX_H);
      layers = [{ name: file.name, visible: true, x: 0, y: 0,
        bitmap: bytes.slice(0, 6144), attrs: bytes.slice(6144), mask: new Uint8Array(6144).fill(0xff) }];
      activeLayer = 0; backgroundCode = -1; zxPreview = true;
      zxPreviewControl.classList.add('active'); zxPreviewControl.setAttribute('aria-pressed', 'true');
      bindActive(); updateBackgroundSwatches();
      projectFileName = fileStem(file.name) + '.pixie'; exportFileName = file.name;
      undo.length = 0; redo.length = 0; selection = null; pendingMove = null;
      renderLayerList(); render(); note(tr('Imported SCR: {name}', { name: file.name }));
      event.target.value = '';
    };
    document.querySelector('#save').onclick = async () => {
      const name = await askFileName('SCR', exportFileName, '.scr');
      if (!name) return;
      commitText();
      exportFileName = name;
      download(name, flatten(), 'application/octet-stream');
    };
    document.querySelector('#save-png').onclick = async () => {
      const name = await askFileName('PNG', fileStem(projectFileName) + '.png', '.png');
      if (!name) return;
      commitText();
      const { imageColors, coverage } = compositePixels();
      const scr = zxPreview ? flatten() : null;
      const output = document.createElement('canvas');
      output.width = W; output.height = H;
      const outputContext = output.getContext('2d');
      const image = outputContext.createImageData(W, H);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          let color = imageColors[y * MAX_W + x];
          if (scr) {
            const attr = scr[6144 + attrIndex(x, y)];
            const on = !!(scr[offset(x, y)] & (128 >> (x & 7)));
            const index = on ? attr & 7 : (attr >> 3) & 7;
            color = attr & 64 && index ? index + 8 : index;
          }
          const rgb = paletteRgb[color];
          const i = (y * W + x) * 4;
          image.data[i] = rgb[0]; image.data[i + 1] = rgb[1]; image.data[i + 2] = rgb[2];
          image.data[i + 3] = coverage[y * W + x] ? 255 : 0;
        }
      }
      outputContext.putImageData(image, 0, 0);
      const blob = await new Promise(resolve => output.toBlob(resolve, 'image/png'));
      if (!blob) { note(tr('Could not create PNG.')); return; }
      download(name, blob, 'image/png');
    };
    document.querySelector('#open-project').onclick = () => document.querySelector('#project-file').click();
    document.querySelector('#project-file').onchange = async event => {
      const file = event.target.files[0]; if (!file) return;
      try {
        const project = parseProject(await file.text());
        stopLineSession(); stopRectangleSession(); cancelText();
        layers = project.layers; activeLayer = project.activeLayer; backgroundCode = project.background;
        zxPreview = project.zxPreview;
        zxPreviewControl.classList.toggle('active', zxPreview);
        zxPreviewControl.setAttribute('aria-pressed', String(zxPreview));
        setDocumentSize(project.width, project.height);
        bindActive(); updateBackgroundSwatches();
        projectFileName = file.name; exportFileName = fileStem(file.name) + '.scr';
        undo.length = 0; redo.length = 0; selection = null; pendingMove = null;
        renderLayerList(); render(); note(tr('Opened project {name}', { name: file.name }));
      } catch (error) { note(tr('Could not open project: {message}', { message: error.message })); }
      event.target.value = '';
    };
    async function saveProject() {
      const name = await askFileName(tr('Pixie project'), projectFileName, '.pixie');
      if (!name) return false;
      commitText();
      projectFileName = name; exportFileName = fileStem(name) + '.scr';
      download(name, projectText(), 'application/toml;charset=utf-8');
      return true;
    }
    document.querySelector('#save-project').onclick = saveProject;
    let shiftHeld = false;
    document.addEventListener('keydown', event => {
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
        shiftHeld = true;
        refreshPolyline();
        if (drag?.action === 'select' && drag.raw && drag.pointer) previewSelection(drag.raw, true, drag.pointer.x, drag.pointer.y);
      }
    }, true);
    document.addEventListener('keyup', event => {
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
        shiftHeld = false;
        refreshPolyline();
        if (drag?.action === 'select' && drag.raw && drag.pointer) previewSelection(drag.raw, false, drag.pointer.x, drag.pointer.y);
      }
    }, true);
    window.addEventListener('blur', () => { shiftHeld = false; hideShapeMeasure(); });
    document.addEventListener('keydown', event => {
      if (document.querySelector('#name-dialog').open || document.querySelector('#new-dialog').open) return;
      const typing = event.target instanceof Element && !!event.target.closest('input, textarea, select, [contenteditable="true"]');
      const code = event.code;
      if (event.altKey && !event.metaKey && !event.ctrlKey && !typing) {
        if (code === 'KeyP' && !event.shiftKey) {
          event.preventDefault(); document.querySelector('#save-png').click(); return;
        }
        const digit = /^Digit([0-9])$/.exec(event.code);
        const shifted = event.shiftKey || shiftHeld;
        if (digit && shifted && Number(digit[1]) >= 1 && Number(digit[1]) <= strokeSizes.length) {
          event.preventDefault(); setStrokeWidth(strokeSizes[Number(digit[1]) - 1]); return;
        }
        if (digit && !shifted) {
          event.preventDefault(); if (digit[1] === '0') fitZoom(); else zoomAtCenter(Number(digit[1])); return;
        }
      }
      if (event.metaKey || event.ctrlKey) {
        if (code === 'KeyO') {
          event.preventDefault(); document.querySelector(event.shiftKey ? '#open' : '#open-project').click(); return;
        }
        if (code === 'KeyS') {
          event.preventDefault(); document.querySelector(event.shiftKey ? '#save' : '#save-project').click(); return;
        }
        if (typing) return;
        if (code === 'KeyZ') { event.preventDefault(); restore(event.shiftKey ? redo : undo, event.shiftKey ? undo : redo); }
        if (code === 'KeyC' && selection) { event.preventDefault(); document.querySelector('#copy').click(); }
        if (code === 'KeyX' && selection) { event.preventDefault(); document.querySelector('#cut').click(); }
        if (code === 'KeyV') { event.preventDefault(); document.querySelector('#paste').click(); }
        return;
      }
      if (event.key === 'Escape') {
        if (lineSession) { event.preventDefault(); stopLineSession(); return; }
        if (rectangleSession) { event.preventDefault(); stopRectangleSession(); return; }
        if (typing) event.target.blur();
        if (selection) remember();
        finishPendingMove();
        selection = null; setTool('draw'); render(); return;
      }
      if (typing || event.altKey) return;
      if (selection && (event.key === 'Delete' || event.key === 'Backspace')) {
        event.preventDefault(); remember(); removeSelectionPixels(); render();
        note(tr('Selection cleared. Clipboard unchanged.')); return;
      }
      const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (tool === 'move-layer' && directions[event.key]) {
        event.preventDefault(); remember();
        const step = event.shiftKey ? 8 : 1;
        active().x += directions[event.key][0] * step;
        active().y += directions[event.key][1] * step;
        renderLayerList(); render(); return;
      }
      const digit = /^Digit([1-8])$/.exec(event.code);
      if (digit) {
        event.preventDefault();
        chooseColor(event.shiftKey ? 'paper' : 'ink', Number(digit[1]) - 1); return;
      }
      if (code === 'Digit0') {
        event.preventDefault();
        chooseColor(event.shiftKey ? 'paper' : 'ink', 8); return;
      }
      const shortcuts = {
        KeyB: () => setTool('draw'), KeyD: () => setTool('line'), KeyR: () => setTool('rect'), KeyF: () => setTool('fill-rect'), KeyS: () => setTool('select'),
        KeyM: () => setTool('move-layer'), KeyA: () => attrModeButton.click(), KeyT: () => setTool('text'),
        KeyN: newDocument,
        KeyI: () => document.querySelector('#swap').click(),
        KeyH: () => brightControl.click(), KeyG: () => gridControl.click(),
        KeyZ: () => zxPreviewControl.click(),
        KeyV: () => { remember(); active().visible = !active().visible; renderLayerList(); render(); },
      };
      if (code === 'KeyL') {
        event.preventDefault();
        if (event.shiftKey) deleteLayer(); else addLayer();
        return;
      }
      if (code === 'KeyM' && event.shiftKey) { event.preventDefault(); mergeDown(); return; }
      if (code === 'BracketRight') { event.preventDefault(); moveLayerStack(1); return; }
      if (code === 'BracketLeft') { event.preventDefault(); moveLayerStack(-1); return; }
      if (shortcuts[code]) { event.preventDefault(); shortcuts[code](); return; }
    });
    drawTransparency(); fitZoom(); updateGrid(); renderLayerList(); render();
  })();
