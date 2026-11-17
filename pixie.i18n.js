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
      '.zoom-presets': [null, 'Quick zoom'],
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
