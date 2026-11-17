window.PIXIE_TRACE = (() => {
  const defaults = Object.freeze({
    brightness: 0, contrast: 0, saturation: 100, levels: 8, simplify: 0, noise: 0,
    ditherMode: 'fs', ditherStrength: 100, checkerStrength: 35, ditherDensity: 100,
    optimizeClashing: false, clashStrength: 45,
  });
  const ranges = Object.freeze({
    brightness: [-100, 100], contrast: [-100, 100], saturation: [0, 200],
    levels: [2, 16], simplify: [0, 100], noise: [0, 100],
    ditherStrength: [0, 100], checkerStrength: [0, 100],
    ditherDensity: [0, 100], clashStrength: [0, 100],
  });
  const kernels = Object.freeze({
    fs: [[1, 0, 7 / 16], [-1, 1, 3 / 16], [0, 1, 5 / 16], [1, 1, 1 / 16]],
    atkinson: [[1, 0, 1 / 8], [2, 0, 1 / 8], [-1, 1, 1 / 8], [0, 1, 1 / 8], [1, 1, 1 / 8], [0, 2, 1 / 8]],
    sierra: [[1, 0, 5 / 32], [2, 0, 3 / 32], [-2, 1, 2 / 32], [-1, 1, 4 / 32],
      [0, 1, 5 / 32], [1, 1, 4 / 32], [2, 1, 2 / 32], [-1, 2, 2 / 32],
      [0, 2, 3 / 32], [1, 2, 2 / 32]],
  });
  function bayer(size) {
    let values = [[0]];
    while (values.length < size) {
      const n = values.length;
      values = Array.from({ length: n * 2 }, (_, y) => Array.from({ length: n * 2 }, (_, x) =>
        values[y % n][x % n] * 4 + [[0, 2], [3, 1]][Math.floor(y / n)][Math.floor(x / n)]));
    }
    return values;
  }
  const ordered = { ordered4: bayer(4), ordered8: bayer(8) };
  const clamp = value => Math.max(0, Math.min(255, value));
  function randomAt(x, y) {
    let value = Math.imul(x + 503, 374761393) + Math.imul(y + 907, 668265263);
    value = Math.imul(value ^ value >>> 13, 1274126177);
    return ((value ^ value >>> 16) >>> 0) / 4294967295;
  }
  function distance(a, b) {
    const red = a[0] - b[0], green = a[1] - b[1], blue = a[2] - b[2];
    return red * red + green * green + blue * blue;
  }
  const toLinear = value => {
    const scaled = value / 255;
    return scaled <= 0.04045 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  };
  function mixture(values, index, paper, delta, length) {
    const at = index * 3;
    return ((values[at] - paper[0]) * delta[0] + (values[at + 1] - paper[1]) * delta[1]
      + (values[at + 2] - paper[2]) * delta[2]) / length;
  }
  function pairDistance(a, b, palette) {
    const ai = palette[a.bright * 8 + a.ink], ap = palette[a.bright * 8 + a.paper];
    const bi = palette[b.bright * 8 + b.ink], bp = palette[b.bright * 8 + b.paper];
    return Math.min(distance(ai, bi) + distance(ap, bp), distance(ai, bp) + distance(ap, bi))
      + (a.bright === b.bright ? 0 : 0.35);
  }
  function normalize(settings) {
    const result = { ...defaults };
    for (const [key, [minimum, maximum]] of Object.entries(ranges)) {
      const value = settings?.[key];
      if (Number.isFinite(value)) result[key] = Math.max(minimum, Math.min(maximum, Math.round(value)));
    }
    for (const key of ['optimizeClashing']) {
      if (typeof settings?.[key] === 'boolean') result[key] = settings[key];
    }
    if (['none', 'checker', 'fs', 'atkinson', 'sierra', 'ordered4', 'ordered8'].includes(settings?.ditherMode))
      result.ditherMode = settings.ditherMode;
    return result;
  }
  function prepareImage(imageData, selection, layer, options, background) {
    const { width: canvasWidth, height: canvasHeight, data: source } = imageData;
    const { x: x0, y: y0, w, h } = selection;
    const opacity = new Uint8Array(w * h);
    const linear = new Float32Array(w * h * 3), cellByPixel = new Int32Array(w * h).fill(-1);
    const groups = new Map(), positions = new Map(), cellIds = new Map();
    const contrast = 1 + options.contrast / 100;
    const brightness = options.brightness / 100 * 255;
    const saturation = options.saturation / 100;
    const levelStep = 255 / (options.levels - 1);
    const simplifyStep = 1 + Math.round(options.simplify / 100 * 31);
    const noise = options.noise / 100 * 36;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const documentX = x0 + x, documentY = y0 + y;
      const localX = documentX - layer.x, localY = documentY - layer.y;
      if (documentX < 0 || documentX >= canvasWidth || documentY < 0 || documentY >= canvasHeight) continue;
      const pixel = (documentY * canvasWidth + documentX) * 4;
      const alpha = source[pixel + 3] / 255;
      if (alpha < 0.5) continue;
      const index = y * w + x;
      opacity[index] = 1;
      const original = [0, 1, 2].map(channel => source[pixel + channel] * alpha + background[channel] * (1 - alpha));
      const rgb = original.map(channel => (channel - 128) * contrast + 128 + brightness);
      const gray = rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114;
      const perturb = (randomAt(documentX, documentY) - 0.5) * 2 * noise;
      for (let channel = 0; channel < 3; channel++) {
        let value = gray + (rgb[channel] - gray) * saturation;
        value = Math.round(value / levelStep) * levelStep;
        value = Math.round(value / simplifyStep) * simplifyStep;
        const prepared = clamp(value + perturb);
        linear[index * 3 + channel] = toLinear(prepared);
      }
      const cellX = Math.floor(localX / 8), cellY = Math.floor(localY / 8);
      const key = `${cellX},${cellY}`;
      if (!cellIds.has(key)) {
        const id = cellIds.size;
        cellIds.set(key, id); positions.set(id, { x: cellX, y: cellY });
      }
      const cell = cellIds.get(key);
      cellByPixel[index] = cell;
      if (!groups.has(cell)) groups.set(cell, []);
      groups.get(cell).push(index);
    }
    return { linear, cellByPixel, groups, positions, opacity };
  }
  function fitPair(indices, linear, bright, paper, ink, linearPalette) {
    const paperRgb = linearPalette[bright * 8 + paper];
    const inkRgb = linearPalette[bright * 8 + ink];
    const delta = inkRgb.map((value, channel) => value - paperRgb[channel]);
    const length = Math.max(1e-12, delta.reduce((sum, value) => sum + value * value, 0));
    const contrastPenalty = length * 0.15;
    let error = 0;
    for (const index of indices) {
      const amount = Math.max(0, Math.min(1, mixture(linear, index, paperRgb, delta, length)));
      const at = index * 3;
      const red = linear[at] - paperRgb[0] - amount * delta[0];
      const green = linear[at + 1] - paperRgb[1] - amount * delta[1];
      const blue = linear[at + 2] - paperRgb[2] - amount * delta[2];
      error += red * red + green * green + blue * blue + contrastPenalty * amount * (1 - amount);
    }
    return { bright, paper, ink, error, paperLinear: paperRgb, delta, length };
  }
  function chooseCellPairs(groups, positions, linear, palette, options, pixelCount) {
    const colors = new Uint8Array(pixelCount);
    const linearPalette = palette.map(rgb => rgb.map(toLinear));
    const chosen = new Map(), neighbors = new Map();
    for (const [cell, indices] of [...groups].sort((a, b) => a[0] - b[0])) {
      const candidates = [];
      for (let bright = 0; bright < 2; bright++) {
        for (let paper = 0; paper < 8; paper++) {
          for (let ink = paper; ink < 8; ink++) {
            candidates.push(fitPair(indices, linear, bright, paper, ink, linearPalette));
          }
        }
      }
      candidates.sort((a, b) => a.error - b.error);
      const position = positions.get(cell);
      const left = neighbors.get(`${position.x - 1},${position.y}`);
      const above = neighbors.get(`${position.x},${position.y - 1}`);
      let best = candidates[0], bestScore = Infinity;
      for (const candidate of options.optimizeClashing ? candidates.slice(0, 8) : [best]) {
        const weight = options.clashStrength / 100 * 0.2 * indices.length / 64;
        const score = candidate.error + (left ? pairDistance(candidate, left, linearPalette) * weight : 0)
          + (above ? pairDistance(candidate, above, linearPalette) * weight : 0);
        if (score < bestScore) { best = candidate; bestScore = score; }
      }
      chosen.set(cell, best);
      neighbors.set(`${position.x},${position.y}`, best);
      const attribute = best.ink | best.paper << 3 | best.bright << 6;
      for (const index of indices) colors[index] = attribute;
    }
    return { chosen, colors };
  }
  function ditherThreshold(mode, options, x, y) {
    if (mode === 'checker' && randomAt(x + 503, y + 907) * 100 <= options.ditherDensity)
      return 0.5 + ((x + y) & 1 ? 1 : -1) * options.checkerStrength / 200;
    const matrix = ordered[mode];
    if (!matrix) return 0.5;
    const size = matrix.length;
    return 0.5 + options.ditherStrength / 100 *
      ((matrix[y % size][x % size] + 0.5) / (size * size) - 0.5);
  }
  function diffuseError(errors, cells, cell, x, y, w, h, reverse, kernel, remainder) {
    for (const [dx, dy, weight] of kernel) {
      const nx = x + (reverse ? -dx : dx), ny = y + dy;
      if (nx < 0 || nx >= w || ny >= h) continue;
      const neighbor = ny * w + nx;
      if (cells[neighbor] === cell) errors[neighbor] += remainder * weight;
    }
  }
  function renderDither(selection, prepared, chosen, options) {
    const { x: x0, y: y0, w, h } = selection;
    const { linear, cellByPixel } = prepared;
    const bits = new Uint8Array(w * h);
    const kernel = kernels[options.ditherMode];
    const errors = kernel ? new Float32Array(w * h) : null;
    for (let y = 0; y < h; y++) {
      const reverse = !!errors && y % 2 === 1;
      for (let column = 0; column < w; column++) {
        const x = reverse ? w - 1 - column : column;
        const index = y * w + x, cell = cellByPixel[index];
        if (cell < 0) continue;
        const pair = chosen.get(cell);
        if (pair.length < 1e-12) continue;
        const amount = mixture(linear, index, pair.paperLinear, pair.delta, pair.length) + (errors ? errors[index] : 0);
        const threshold = ditherThreshold(options.ditherMode, options, x0 + x, y0 + y);
        const on = amount >= threshold ? 1 : 0;
        bits[index] = on;
        if (!errors) continue;
        const remainder = (amount - on) * options.ditherStrength / 100;
        diffuseError(errors, cellByPixel, cell, x, y, w, h, reverse, kernel, remainder);
      }
    }
    return bits;
  }
  function convert(imageData, selection, layer, settings, palette, background) {
    const options = normalize(settings);
    const prepared = prepareImage(imageData, selection, layer, options, background);
    const { chosen, colors } = chooseCellPairs(prepared.groups, prepared.positions, prepared.linear, palette,
      options, selection.w * selection.h);
    const bits = renderDither(selection, prepared, chosen, options);
    return { ...selection, bits, colors, opacity: prepared.opacity };
  }
  return { defaults, ranges, normalize, convert };
})();

window.PIXIE_TRACE_CONTROLS = (() => {
  function bind({ getSettings, setSettings, getPreview, traceState,
    recordTraceChange, updateFloatingTrace }) {
    const controls = [...document.querySelectorAll('[data-trace]')];
    const beforeEdit = new Map();
    let updateTimer = null;
    const clearTimer = () => { clearTimeout(updateTimer); updateTimer = null; };
    const schedule = (callback, delay) => { clearTimer(); updateTimer = setTimeout(callback, delay); };
    const clearHistory = () => beforeEdit.clear();
    function sync() {
      const settings = getSettings();
      for (const control of controls) {
        const key = control.dataset.trace;
        if (control.type === 'checkbox') control.checked = settings[key];
        else control.value = String(settings[key]);
        const output = control.closest('label').querySelector('output');
        if (output) output.textContent = `${settings[key]}${['saturation', 'simplify', 'noise', 'ditherStrength',
          'checkerStrength', 'ditherDensity', 'clashStrength'].includes(key) ? '%' : ''}`;
        const unavailable = key === 'ditherStrength' && ['none', 'checker'].includes(settings.ditherMode)
          || ['checkerStrength', 'ditherDensity'].includes(key) && settings.ditherMode !== 'checker'
          || key === 'clashStrength' && !settings.optimizeClashing;
        control.closest('label').hidden = unavailable;
      }
    }
    function flushHistory() {
      for (const before of beforeEdit.values()) recordTraceChange(before);
      beforeEdit.clear();
    }
    for (const control of controls) {
      const beginEdit = () => {
        if (getPreview() && !beforeEdit.has(control)) beforeEdit.set(control, traceState());
      };
      const finishEdit = () => {
        const before = beforeEdit.get(control);
        if (before) recordTraceChange(before);
        beforeEdit.delete(control);
      };
      control.addEventListener('pointerdown', beginEdit);
      control.addEventListener('keydown', beginEdit);
      control.addEventListener('input', () => {
        beginEdit();
        const key = control.dataset.trace;
        const settings = getSettings();
        settings[key] = control.type === 'checkbox' ? control.checked
          : control.tagName === 'SELECT' ? control.value : Number(control.value);
        setSettings(window.PIXIE_TRACE.normalize(settings));
        sync();
        schedule(updateFloatingTrace, 60);
      });
      control.addEventListener('change', () => {
        clearTimer(); updateFloatingTrace(); finishEdit();
      });
      control.addEventListener('blur', finishEdit);
    }
    sync();
    return { sync, clearTimer, schedule, clearHistory, flushHistory };
  }
  return { bind };
})();

window.PIXIE_TRACE_HISTORY = (() => {
  function bind({ getPreview, getDrag, setDrag, getMove, getSettings, setSettings,
    getControls, changeArea, updateCursor, sameSelection, note, tr }) {
    function state() {
      const preview = getPreview(), move = getMove();
      return { area: { ...preview.area }, target: { ...move.target }, settings: { ...getSettings() } };
    }
    function same(a, b) {
      return sameSelection(a.area, b.area) && sameSelection(a.target, b.target)
        && Object.keys(a.settings).every(key => a.settings[key] === b.settings[key]);
    }
    function record(before) {
      const preview = getPreview();
      if (!preview || !before || same(before, state())) return;
      preview.history.push(before);
      if (preview.history.length > 50) preview.history.shift();
      preview.future.length = 0;
    }
    function restore(saved) {
      getControls().clearTimer();
      setSettings(window.PIXIE_TRACE.normalize(saved.settings));
      getControls().sync();
      changeArea(saved.area, saved.target);
      updateCursor();
    }
    function undo() {
      const preview = getPreview();
      if (!preview) return;
      getControls().flushHistory();
      const drag = getDrag();
      if (drag) {
        setDrag(null); restore(drag.before);
        note(tr('Tracing change undone.')); return;
      }
      const previous = preview.history.pop();
      if (!previous) return;
      preview.future.push(state());
      restore(previous);
      note(tr('Tracing change undone.'));
    }
    function redo() {
      const preview = getPreview();
      if (!preview || getDrag()) return;
      getControls().flushHistory();
      const next = preview.future.pop();
      if (!next) return;
      preview.history.push(state());
      restore(next);
      note(tr('Tracing change redone.'));
    }
    return { state, record, undo, redo };
  }
  return { bind };
})();
