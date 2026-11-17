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
