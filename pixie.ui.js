window.PIXIE_I18N = (() => {
  const russian = /^ru(?:-|$)/i.test(navigator.languages?.[0] || navigator.language || '');
  const tr = (english, values = {}) => {
    let template = russian ? window.PIXIE_RU?.[english] ?? english : english;
    if (typeof template === 'object') {
      const plural = new Intl.PluralRules('ru').select(values.count ?? 0);
      template = template[plural] ?? template.other ?? english;
    }
    return template.replace(/\{([a-z]+)\}/g, (match, name) => values[name] ?? match);
  };
  function applyLocale() {
    document.documentElement.lang = russian ? 'ru' : 'en';
    document.title = tr('Pixie — The ZX Spectrum graphics editor');
    const text = {
      'header h1': 'Pixie',
      '#app-tagline': 'The ZX Spectrum graphics editor',
      '#layers-panel .layers-heading strong': 'Layers',
      '#background-panel strong': 'Background',
      '#references-panel .references-heading strong': 'References',
      '#status': 'New blank project. Add a layer or import SCR.',
      '#new-dialog-title': 'New document',
      '#new-dialog legend': 'Size',
      '#new-size-screen-label': 'Full screen 256×192',
      '#new-size-custom-label': 'Custom size',
      '#new-dialog > p': 'Save the current project before creating a new one?',
      '#new-cancel': 'Cancel', '#new-discard': "Don't save", '#new-save': 'Save',
      '#unsaved-dialog-title': 'Unsaved changes',
      '#unsaved-dialog > p': 'Save the current project before replacing it?',
      '#unsaved-cancel': 'Cancel', '#unsaved-discard': "Don't save", '#unsaved-save': 'Save',
      '#name-dialog-title': 'File name', '#name-cancel': 'Cancel', '#name-accept': 'Save',
    };
    for (const [selector, value] of Object.entries(text)) document.querySelector(selector).textContent = tr(value);
    for (const element of document.querySelectorAll('[data-i18n]')) element.textContent = tr(element.dataset.i18n);
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
      '[data-tool="ellipse"]': ['Ellipse (E): two clicks or drag; Shift makes a circle; right button erases', 'Ellipse'],
      '[data-tool="fill"]': ['Fill connected area (P); right button erases', 'Fill'],
      '[data-tool="select"]': ['Select area (S); drag its edges to resize, Shift snaps size to 8×8 cells', 'Select'],
      '[data-tool="move-layer"]': ['Move layer (M; arrows move 1 pixel, Shift+arrows snap to the next 8×8 cell)', 'Move layer'],
      '#attr-mode': ['Draw 8×8 cell attributes (A)', 'Draw cell attributes'],
      '[data-tool="text"]': ['Text: click the canvas and type; Shift snaps to a cell (T)', 'Text'],
      '#text-entry': [null, 'Text on canvas'],
      '.zoom-presets': [null, 'Zoom presets'],
      '#navigator': ['Click or drag to pan the canvas', 'Canvas navigator'],
      '#zoom-1': ['Zoom 1× (Alt+1)'], '#zoom-2': ['Zoom 2× (Alt+2)'],
      '#zoom-fit': ['Fit screen (Alt+0)', 'Fit screen'],
      '#layers-panel': [null, 'Layers'],
      '#layer-add': ['Add layer (L)', 'Add layer'],
      '#layer-up': ['Raise layer (])', 'Raise layer'],
      '#layer-down': ['Lower layer ([)', 'Lower layer'],
      '#layer-merge': ['Merge with layer below (Shift+M)', 'Merge with layer below'],
      '#background-swatches': [null, 'Background color'],
      '#references-panel': [null, 'Reference images'],
      '#reference-add': ['Add reference image', 'Add reference image'],
      '#reference-trace': ['Reference tracing (K)', 'Reference tracing'],
      '#trace-apply': ['Apply tracing (Enter)', 'Apply'],
      '#trace-cancel': ['Cancel tracing (Escape)', 'Cancel'],
      '#reference-frame': [null, 'Selected reference image'],
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
  return { tr, applyLocale };
})();

window.PIXIE_FILES = (() => {
  function create(tr) {
    function decodeReference(dataUrl) {
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(tr('Could not load reference image.')));
        image.src = dataUrl;
      });
    }
    function readReference(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error(tr('Could not load reference image.')));
        reader.readAsDataURL(file);
      });
    }
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
    async function canWriteProject(handle) {
      if (!handle.queryPermission || !handle.requestPermission) return true;
      const permission = { mode: 'readwrite' };
      if (await handle.queryPermission(permission) === 'granted') return true;
      return await handle.requestPermission(permission) === 'granted';
    }
    return { download, fileStem, askName, askFileName, decodeReference, readReference, canWriteProject };
  }
  return { create };
})();

window.PIXIE_SORTABLE = (() => {
  function bind(list, { rowSelector, blockedSelector, itemAt, reorder }) {
    let drag = null, suppressClick = false;
    const clearMarkers = () => {
      for (const row of list.children) row.classList.remove('drop-before', 'drop-after');
    };
    const clearDragging = () => {
      for (const row of list.children) row.classList.remove('dragging');
      clearMarkers();
    };
    list.addEventListener('pointerdown', event => {
      suppressClick = false;
      if (event.button !== 0 || event.target.closest(blockedSelector)) return;
      const row = event.target.closest(rowSelector);
      if (!row || !list.contains(row)) return;
      drag = { source: itemAt(Number(row.dataset.index)), pointerId: event.pointerId,
        x: event.clientX, y: event.clientY, active: false, target: null, before: false };
    });
    list.addEventListener('pointermove', event => {
      const move = drag;
      if (!move || move.pointerId !== event.pointerId) return;
      if (!move.active) {
        const dx = event.clientX - move.x, dy = event.clientY - move.y;
        if (dx * dx + dy * dy < 16) return;
        move.active = true;
        list.setPointerCapture(event.pointerId);
        const sourceRow = [...list.children].find(row => itemAt(Number(row.dataset.index)) === move.source);
        sourceRow?.classList.add('dragging');
      }
      event.preventDefault(); clearMarkers();
      move.target = null;
      const bounds = list.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right ||
          event.clientY < bounds.top || event.clientY > bounds.bottom) return;
      const rows = [...list.children];
      const targetRow = rows.find(row => event.clientY <= row.getBoundingClientRect().bottom) || rows.at(-1);
      if (!targetRow) return;
      const box = targetRow.getBoundingClientRect();
      move.target = itemAt(Number(targetRow.dataset.index));
      move.before = event.clientY < box.top + box.height / 2;
      targetRow.classList.add(move.before ? 'drop-before' : 'drop-after');
    });
    list.addEventListener('pointerup', event => {
      const move = drag;
      if (!move || move.pointerId !== event.pointerId) return;
      drag = null;
      if (list.hasPointerCapture(event.pointerId)) list.releasePointerCapture(event.pointerId);
      clearDragging();
      if (!move.active) return;
      suppressClick = true;
      if (move.target) reorder(move.source, move.target, move.before);
    });
    list.addEventListener('pointercancel', event => {
      if (drag?.pointerId !== event.pointerId) return;
      drag = null;
      clearDragging();
    });
    return { get suppressClick() { return suppressClick; } };
  }
  return { bind };
})();

window.PIXIE_PANEL_ROWS = (() => {
  function layer({ layer, index, active, muted, canDelete, tr, select, toggle, rename, remove }) {
    const row = document.createElement('div');
    row.dataset.index = String(index);
    row.className = 'layer-row' + (active ? ' active' : '') + (muted ? ' solo-muted' : '');
    row.title = tr('Select or drag layer; double-click its name to rename');
    row.onclick = select;
    const eye = document.createElement('button');
    const state = layer.solo ? 'Solo' : layer.visible ? 'On' : 'Off';
    const next = layer.solo ? 'On' : layer.visible ? 'Off' : 'Solo';
    eye.type = 'button'; eye.className = 'layer-eye';
    eye.title = tr('Layer state: {state}; click for {next} (V for active layer)',
      { state: tr(state), next: tr(next) });
    eye.setAttribute('aria-label', eye.title);
    eye.setAttribute('aria-pressed', layer.solo ? 'mixed' : String(layer.visible));
    eye.innerHTML = layer.solo ? '<span class="solo-mark" aria-hidden="true">S</span>'
      : `<svg class="icon"><use href="#i-eye${layer.visible ? '' : '-off'}"/></svg>`;
    eye.onclick = event => { event.stopPropagation(); toggle(); };
    const name = document.createElement('span');
    name.className = 'layer-name'; name.textContent = layer.name;
    name.ondblclick = event => { event.stopPropagation(); rename(); };
    const coords = document.createElement('span');
    coords.className = 'layer-coords'; coords.textContent = `${layer.x}:${layer.y}`;
    coords.title = tr('Layer offset: x {x}, y {y}', { x: layer.x, y: layer.y });
    const removeButton = document.createElement('button');
    removeButton.type = 'button'; removeButton.className = 'icon-button';
    removeButton.title = tr('Delete layer'); removeButton.setAttribute('aria-label', removeButton.title);
    removeButton.disabled = !canDelete;
    removeButton.innerHTML = '<svg class="icon"><use href="#i-trash"/></svg>';
    removeButton.onclick = event => { event.stopPropagation(); remove(); };
    row.append(eye, name, coords, removeButton);
    return row;
  }

  function reference({ reference, index, active, tr, select, toggle, remove, opacityChange }) {
    const row = document.createElement('div');
    row.dataset.index = String(index);
    row.className = 'reference-row' + (active ? ' active' : '');
    row.title = tr('Select or drag reference; move or resize it on the canvas');
    row.onclick = select;
    const thumb = document.createElement('img');
    thumb.src = reference.dataUrl; thumb.alt = ''; thumb.draggable = false;
    const name = document.createElement('span');
    name.className = 'reference-name'; name.textContent = reference.name; name.title = reference.name;
    const eye = document.createElement('button');
    eye.type = 'button'; eye.className = 'icon-button';
    eye.title = tr(reference.visible ? 'Hide reference' : 'Show reference');
    eye.setAttribute('aria-label', eye.title);
    eye.innerHTML = `<svg class="icon"><use href="#i-eye${reference.visible ? '' : '-off'}"/></svg>`;
    eye.onclick = event => { event.stopPropagation(); toggle(); };
    const removeButton = document.createElement('button');
    removeButton.type = 'button'; removeButton.className = 'icon-button';
    removeButton.title = tr('Delete reference'); removeButton.setAttribute('aria-label', removeButton.title);
    removeButton.innerHTML = '<svg class="icon"><use href="#i-trash"/></svg>';
    removeButton.onclick = event => { event.stopPropagation(); remove(); };
    const opacity = document.createElement('label');
    opacity.className = 'reference-opacity';
    const slider = document.createElement('input');
    slider.type = 'range'; slider.min = '0'; slider.max = '100'; slider.value = String(Math.round(reference.opacity * 100));
    slider.title = tr('Reference opacity');
    slider.setAttribute('aria-label', `${reference.name}: ${tr('Reference opacity')}`);
    const output = document.createElement('output');
    output.textContent = `${slider.value}%`;
    let editing = false;
    slider.oninput = event => {
      event.stopPropagation();
      opacityChange(Number(slider.value) / 100, !editing);
      editing = true;
      output.textContent = `${slider.value}%`;
    };
    slider.onchange = () => { editing = false; };
    slider.onblur = () => { editing = false; };
    slider.onclick = event => event.stopPropagation();
    opacity.append(slider, output);
    row.append(eye, thumb, name, removeButton, opacity);
    return row;
  }
  return { layer, reference };
})();

window.PIXIE_VIEWPORT = (() => {
  function bind({ viewport, stage, getSize, getZoom, setZoom,
    renderReferences, drawOverlay, drawTransparency, updateGrid,
    navigator, navigatorCanvas, navigatorWindow, screen, textCanvas, getNavigatorScene }) {
    const navigatorContext = navigatorCanvas.getContext('2d');
    const checker = document.createElement('canvas');
    checker.width = checker.height = 8;
    const checkerContext = checker.getContext('2d');
    checkerContext.fillStyle = '#30343c';
    checkerContext.fillRect(0, 0, 8, 8);
    checkerContext.fillStyle = '#50545b';
    checkerContext.fillRect(0, 0, 4, 4);
    checkerContext.fillRect(4, 4, 4, 4);
    const checkerPattern = navigatorContext.createPattern(checker, 'repeat');
    let visibleArea = null, navigatorDrag = null;
    function updateNavigatorFrame(redrawOnShow = true) {
      const { width, height } = getSize();
      const wasHidden = navigator.hidden;
      navigator.hidden = viewport.scrollWidth <= viewport.clientWidth + 2 &&
        viewport.scrollHeight <= viewport.clientHeight + 2;
      navigator.parentElement.hidden = navigator.hidden;
      if (navigator.hidden) { visibleArea = null; return; }
      if (wasHidden && redrawOnShow !== false) requestAnimationFrame(drawNavigator);
      const view = viewport.getBoundingClientRect();
      const image = stage.getBoundingClientRect();
      const scale = getZoom();
      const left = Math.max(0, Math.min(width, (view.left - image.left) / scale));
      const top = Math.max(0, Math.min(height, (view.top - image.top) / scale));
      const right = Math.max(left, Math.min(width, (view.left + viewport.clientWidth - image.left) / scale));
      const bottom = Math.max(top, Math.min(height, (view.top + viewport.clientHeight - image.top) / scale));
      visibleArea = { x: left, y: top, w: right - left, h: bottom - top };
      const previewWidth = navigator.clientWidth, previewHeight = navigator.clientHeight;
      navigatorWindow.style.left = `${left * previewWidth / width}px`;
      navigatorWindow.style.top = `${top * previewHeight / height}px`;
      navigatorWindow.style.width = `${(right - left) * previewWidth / width}px`;
      navigatorWindow.style.height = `${(bottom - top) * previewHeight / height}px`;
    }
    function drawNavigator() {
      updateNavigatorFrame(false);
      if (navigator.hidden) return;
      const { width, height } = getSize();
      if (navigatorCanvas.width !== width) navigatorCanvas.width = width;
      if (navigatorCanvas.height !== height) navigatorCanvas.height = height;
      navigator.style.height = `${Math.round(navigator.clientWidth * height / width)}px`;
      updateNavigatorFrame(false);
      const { background, references, tracing } = getNavigatorScene();
      navigatorContext.fillStyle = checkerPattern;
      navigatorContext.fillRect(0, 0, width, height);
      if (background) {
        navigatorContext.fillStyle = background;
        navigatorContext.fillRect(0, 0, width, height);
      }
      for (const reference of references) {
        if (!reference.visible || !reference.image || reference.opacity <= 0 ||
            (tracing && reference !== tracing)) continue;
        navigatorContext.globalAlpha = reference.opacity;
        navigatorContext.drawImage(reference.image, reference.x, reference.y,
          reference.width, reference.height);
      }
      navigatorContext.globalAlpha = 1;
      navigatorContext.drawImage(screen, 0, 0);
      navigatorContext.drawImage(textCanvas, 0, 0);
    }
    function navigatorPoint(event) {
      const bounds = navigatorCanvas.getBoundingClientRect();
      const { width, height } = getSize();
      return { x: Math.max(0, Math.min(width, (event.clientX - bounds.left) * width / bounds.width)),
        y: Math.max(0, Math.min(height, (event.clientY - bounds.top) * height / bounds.height)) };
    }
    function panFromNavigator(event) {
      if (!navigatorDrag) return;
      const point = navigatorPoint(event);
      const scale = getZoom();
      const image = stage.getBoundingClientRect(), view = viewport.getBoundingClientRect();
      viewport.scrollLeft += image.left + (point.x - navigatorDrag.offsetX) * scale -
        (view.left + viewport.clientWidth / 2);
      viewport.scrollTop += image.top + (point.y - navigatorDrag.offsetY) * scale -
        (view.top + viewport.clientHeight / 2);
      updateNavigatorFrame();
    }
    navigator.addEventListener('pointerdown', event => {
      if (event.button !== 0 || navigator.hidden) return;
      event.preventDefault();
      const point = navigatorPoint(event), area = visibleArea;
      const inside = area && point.x >= area.x && point.x <= area.x + area.w &&
        point.y >= area.y && point.y <= area.y + area.h;
      navigatorDrag = { pointerId: event.pointerId,
        offsetX: inside ? point.x - area.x - area.w / 2 : 0,
        offsetY: inside ? point.y - area.y - area.h / 2 : 0 };
      navigator.classList.add('dragging');
      navigator.setPointerCapture(event.pointerId);
      panFromNavigator(event);
    });
    navigator.addEventListener('pointermove', event => {
      if (navigatorDrag?.pointerId === event.pointerId) panFromNavigator(event);
    });
    const finishNavigatorDrag = event => {
      if (navigatorDrag?.pointerId !== event.pointerId) return;
      navigatorDrag = null;
      navigator.classList.remove('dragging');
    };
    navigator.addEventListener('pointerup', finishNavigatorDrag);
    navigator.addEventListener('pointercancel', finishNavigatorDrag);
    navigator.addEventListener('keydown', event => {
      const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (!directions[event.key]) return;
      event.preventDefault(); event.stopPropagation();
      const [dx, dy] = directions[event.key], step = event.shiftKey ? 192 : 48;
      viewport.scrollLeft += dx * step;
      viewport.scrollTop += dy * step;
    });
    viewport.addEventListener('scroll', updateNavigatorFrame);
    if (window.ResizeObserver) {
      new ResizeObserver(updateNavigatorFrame).observe(viewport);
      new ResizeObserver(drawNavigator).observe(navigator.parentElement);
    } else window.addEventListener('resize', drawNavigator);
    function zoomAt(value, clientX, clientY) {
      const next = Math.max(1, Math.min(24, value));
      const current = getZoom();
      if (next === current) return;
      const view = viewport.getBoundingClientRect();
      if (!Number.isFinite(clientX)) clientX = view.left + view.width / 2;
      if (!Number.isFinite(clientY)) clientY = view.top + view.height / 2;
      const rect = stage.getBoundingClientRect();
      const x = (clientX - rect.left) / current, y = (clientY - rect.top) / current;
      const { width, height } = getSize();
      setZoom(next);
      stage.style.width = width * next + 'px';
      stage.style.height = height * next + 'px';
      renderReferences();
      drawOverlay();
      if ((current >= 8) !== (next >= 8)) { drawTransparency(); updateGrid(); }
      viewport.scrollLeft += x * (next - current);
      viewport.scrollTop += y * (next - current);
      updateNavigatorFrame();
    }
    function zoomAtCenter(value) {
      const rect = viewport.getBoundingClientRect();
      zoomAt(value, rect.left + rect.width / 2, rect.top + rect.height / 2);
    }
    function fitZoom() {
      const { width, height } = getSize();
      const fitWidth = (viewport.clientWidth - 60) / width;
      const fitHeight = (viewport.clientHeight - 60) / height;
      zoomAtCenter(Math.max(1, Math.min(fitWidth, fitHeight)));
    }
    document.querySelector('#zoom-1').onclick = () => zoomAtCenter(1);
    document.querySelector('#zoom-2').onclick = () => zoomAtCenter(2);
    document.querySelector('#zoom-fit').onclick = fitZoom;
    // Chromium sends trackpad pinch as Ctrl+wheel. An ordinary wheel scrolls the viewport.
    let safariGesture = false, safariScale = 1;
    viewport.addEventListener('wheel', event => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      if (!safariGesture) zoomAt(getZoom() * Math.exp(-event.deltaY * 0.01), event.clientX, event.clientY);
    }, { passive: false });
    // Safari uses gesture events for the same trackpad motion.
    viewport.addEventListener('gesturestart', event => {
      event.preventDefault(); safariGesture = true; safariScale = 1;
    }, { passive: false });
    viewport.addEventListener('gesturechange', event => {
      event.preventDefault();
      zoomAt(getZoom() * event.scale / safariScale, event.clientX, event.clientY);
      safariScale = event.scale;
    }, { passive: false });
    viewport.addEventListener('gestureend', event => {
      event.preventDefault(); safariGesture = false;
    }, { passive: false });
    updateNavigatorFrame();
    return { zoomAt, zoomAtCenter, fitZoom, drawNavigator };
  }
  return { bind };
})();

window.PIXIE_REFERENCE_FRAME = (() => {
  function bind(frame, { selected, getReferences, getZoom, remember, render }) {
    let drag = null;
    frame.addEventListener('pointerdown', event => {
      const index = selected();
      if (event.button !== 0 || index < 0) return;
      const handle = event.target.dataset.handle || 'move';
      event.preventDefault(); event.stopPropagation();
      const reference = getReferences()[index];
      drag = { reference, handle, pointerId: event.pointerId,
        clientX: event.clientX, clientY: event.clientY,
        x: reference.x, y: reference.y, width: reference.width, height: reference.height, changed: false };
      event.target.setPointerCapture(event.pointerId);
    });
    frame.addEventListener('pointermove', event => {
      const move = drag;
      if (!move || move.pointerId !== event.pointerId || !getReferences().includes(move.reference)) return;
      event.preventDefault();
      const dx = (event.clientX - move.clientX) / getZoom();
      const dy = (event.clientY - move.clientY) / getZoom();
      let x = move.x, y = move.y, width = move.width, height = move.height;
      if (move.handle === 'move') { x += dx; y += dy; }
      else {
        const west = move.handle.includes('w'), north = move.handle.includes('n');
        width = Math.max(1, move.width + (west ? -dx : dx));
        height = Math.max(1, move.height + (north ? -dy : dy));
        if (event.shiftKey) {
          const scaleX = width / move.width, scaleY = height / move.height;
          const scale = Math.max(1 / move.width, 1 / move.height,
            Math.abs(scaleX - 1) >= Math.abs(scaleY - 1) ? scaleX : scaleY);
          width = move.width * scale; height = move.height * scale;
        }
        if (west) x = move.x + move.width - width;
        if (north) y = move.y + move.height - height;
      }
      if (Math.abs(x - move.reference.x) < 0.01 && Math.abs(y - move.reference.y) < 0.01 &&
          Math.abs(width - move.reference.width) < 0.01 && Math.abs(height - move.reference.height) < 0.01) return;
      if (!move.changed) { remember(); move.changed = true; }
      Object.assign(move.reference, { x, y, width, height });
      render();
    });
    const finish = event => { if (drag?.pointerId === event.pointerId) drag = null; };
    frame.addEventListener('pointerup', finish);
    frame.addEventListener('pointercancel', finish);
  }
  return { bind };
})();

window.PIXIE_REFERENCES = (() => {
  function updateFrame(frame, references, selectedIndex, tracing, pendingMove, zoom) {
    const reference = references[selectedIndex];
    frame.hidden = !reference || !reference.visible || !!tracing || !!pendingMove;
    if (frame.hidden) return;
    frame.style.left = `${reference.x * zoom}px`;
    frame.style.top = `${reference.y * zoom}px`;
    frame.style.width = `${reference.width * zoom}px`;
    frame.style.height = `${reference.height * zoom}px`;
  }
  function render(layer, frame, references, selectedIndex, tracing, pendingMove, zoom) {
    const visibleImages = [];
    for (const reference of references) {
      if (tracing && reference !== tracing.reference) continue;
      if (!reference.visible || !reference.image || reference.opacity <= 0) continue;
      const image = reference.image;
      const width = reference.width * zoom, height = reference.height * zoom;
      image.style.left = `${reference.x * zoom}px`;
      image.style.top = `${reference.y * zoom}px`;
      image.style.width = `${width}px`;
      image.style.height = `${height}px`;
      image.style.opacity = String(reference.opacity);
      image.style.imageRendering = width >= image.naturalWidth && height >= image.naturalHeight
        ? 'pixelated' : 'auto';
      visibleImages.push(image);
    }
    layer.replaceChildren(...visibleImages);
    updateFrame(frame, references, selectedIndex, tracing, pendingMove, zoom);
  }
  function sample(reference, width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(reference.image, reference.x, reference.y, reference.width, reference.height);
    return context.getImageData(0, 0, width, height);
  }
  function area(reference, width, height) {
    const left = Math.max(0, Math.floor(reference.x));
    const top = Math.max(0, Math.floor(reference.y));
    const right = Math.min(width, Math.ceil(reference.x + reference.width));
    const bottom = Math.min(height, Math.ceil(reference.y + reference.height));
    return right > left && bottom > top ? { x: left, y: top, w: right - left, h: bottom - top } : null;
  }
  return { updateFrame, render, sample, area };
})();

window.PIXIE_PALETTE = (() => {
  function bind({ backgroundSwatches, inkSwatches, paperSwatches, referenceLayer,
    strokeIndicator, strokeIndicatorSlot, normal, bright, colors, tr,
    getState, chooseColor, chooseBackground }) {
    function updateBackgroundSwatches() {
      const { backgroundCode, brightEnabled } = getState();
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
      referenceLayer.style.backgroundColor = backgroundCode < 0 ? 'transparent'
        : (backgroundCode >= 8 ? bright[backgroundCode - 8] : normal[backgroundCode]);
    }
    function updateSwatches() {
      const { ink, paper, inkTransparent, paperTransparent, brightEnabled } = getState();
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
    for (let i = 0; i < 9; i++) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'swatch' + (i === 8 ? ' transparent' : '');
      button.dataset.color = String(i);
      const label = i === 8 ? tr('Transparent (black in SCR)') : colors[i];
      button.title = `${tr('Background')}: ${label}`;
      button.setAttribute('aria-label', `${tr('Background')}: ${label}`);
      button.onclick = () => chooseBackground(i);
      backgroundSwatches.appendChild(button);
      for (const [kind, group] of [['ink', inkSwatches], ['paper', paperSwatches]]) {
        const colorButton = document.createElement('button');
        colorButton.type = 'button';
        colorButton.className = 'swatch' + (i === 8 ? ' transparent' : '');
        colorButton.dataset.color = String(i);
        const colorLabel = i === 8 ? tr('Transparent') : colors[i];
        colorButton.title = `${kind.toUpperCase()}: ${colorLabel} (${i === 8 ? (kind === 'ink' ? '0' : '⇧0') : (kind === 'ink' ? '' : '⇧') + (i + 1)})`;
        colorButton.setAttribute('aria-label', `${kind.toUpperCase()}: ${colorLabel}`);
        colorButton.onclick = () => chooseColor(kind, i);
        group.appendChild(colorButton);
      }
    }
    updateBackgroundSwatches();
    updateSwatches();
    return { updateBackgroundSwatches, updateSwatches };
  }
  return { bind };
})();
